package com.digonto.smsforwarder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MqttService extends Service {

    private static final String TAG = "MqttService";
    private static final String CHANNEL_ID = "SmsForwarderServiceChannel";
    private static final int NOTIFICATION_ID = 1;

    private MqttClient mqttClient;
    private SharedPreferences prefs;

    // Dedicated background thread executors so the UI NEVER hangs or freezes!
    private ExecutorService netExecutor;
    private ScheduledExecutorService pingExecutor;
    private ExecutorService smsExecutor;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    public static MqttService instance;
    public static boolean isConnectedToBroker = false;
    public static ConcurrentHashMap<String, Long> lastPongReceivedTimes = new ConcurrentHashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        prefs = getSharedPreferences("SMSConfig", MODE_PRIVATE);

        if (prefs.getString("device_id", "").isEmpty()) {
            prefs.edit().putString("device_id", UUID.randomUUID().toString()).apply();
        }

        netExecutor = Executors.newSingleThreadExecutor();
        smsExecutor = Executors.newSingleThreadExecutor();
        pingExecutor = Executors.newSingleThreadScheduledExecutor();

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DigontoSMS:WakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        } catch (Exception ignored) {}

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "DigontoSMS:WifiLock");
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}

        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Set<String> pairingCodes = prefs.getStringSet("pairing_codes", new HashSet<>());

        if (pairingCodes.isEmpty()) {
            String oldCode = prefs.getString("pairing_code", "");
            if (!oldCode.isEmpty()) {
                pairingCodes = new HashSet<>();
                pairingCodes.add(oldCode);
                prefs.edit().putStringSet("pairing_codes", pairingCodes).apply();
            } else {
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("IVAC Master Pro Active")
                .setContentText("Listening for SMS & live desktop sync...")
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();

        startForeground(NOTIFICATION_ID, notification);

        connectToMqtt(pairingCodes);
        return START_STICKY;
    }

    public void connectToMqtt(Set<String> pairingCodes) {
        if (netExecutor == null || netExecutor.isShutdown()) {
            netExecutor = Executors.newSingleThreadExecutor();
        }

        netExecutor.execute(() -> {
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    for (String code : pairingCodes) {
                        try {
                            String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                            mqttClient.subscribe(sysTopic);
                        } catch (Exception ignored) {}
                    }
                    sendSinglePingInternal();
                    return;
                }

                String clientId = "andr_" + (System.currentTimeMillis() % 1000000);
                mqttClient = new MqttClient("tcp://broker.emqx.io:1883", clientId, new MemoryPersistence());

                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true);
                options.setAutomaticReconnect(true);
                options.setConnectionTimeout(10);
                options.setKeepAliveInterval(25);

                mqttClient.setCallback(new org.eclipse.paho.client.mqttv3.MqttCallbackExtended() {
                    @Override
                    public void connectComplete(boolean reconnect, String serverURI) {
                        isConnectedToBroker = true;
                        if (netExecutor != null && !netExecutor.isShutdown()) {
                            netExecutor.execute(() -> {
                                try {
                                    Set<String> currentCodes = prefs.getStringSet("pairing_codes", new HashSet<>());
                                    for (String code : currentCodes) {
                                        String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                                        mqttClient.subscribe(sysTopic);
                                        Log.d(TAG, "Subscribed on connect: " + sysTopic);
                                    }
                                } catch (Exception ignored) {}
                                sendSinglePingInternal();
                            });
                        }
                    }

                    @Override
                    public void connectionLost(Throwable cause) {
                        isConnectedToBroker = false;
                        Log.e(TAG, "MQTT Connection lost", cause);
                    }

                    @Override
                    public void messageArrived(String topic, MqttMessage message) throws Exception {
                        String payload = new String(message.getPayload());
                        if (topic.endsWith("_sys")) {
                            try {
                                JSONObject sysData = new JSONObject(payload);
                                if (sysData.optString("type").equals("pong")) {
                                    String code = topic.replace("digonto_ivac_sms_", "").replace("_sys", "");
                                    lastPongReceivedTimes.put(code, System.currentTimeMillis());
                                }
                            } catch (Exception ignored) {}
                        }
                    }

                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {}
                });

                mqttClient.connect(options);
                isConnectedToBroker = true;

                startPingLoop();

            } catch (Exception e) {
                isConnectedToBroker = false;
                Log.e(TAG, "MQTT Connection error", e);
                if (pingExecutor != null && !pingExecutor.isShutdown()) {
                    pingExecutor.schedule(() -> connectToMqtt(pairingCodes), 5, TimeUnit.SECONDS);
                }
            }
        });
    }

    public void subscribeToCode(String code) {
        if (netExecutor == null || netExecutor.isShutdown()) {
            netExecutor = Executors.newSingleThreadExecutor();
        }
        netExecutor.execute(() -> {
            if (mqttClient != null && mqttClient.isConnected()) {
                try {
                    String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                    mqttClient.subscribe(sysTopic);
                    Log.d(TAG, "Dynamically subscribed to sysTopic: " + sysTopic);
                } catch (Exception e) {
                    Log.e(TAG, "Error dynamically subscribing: " + code, e);
                }
            }
        });
    }

    public void unsubscribeFromCode(String code) {
        if (netExecutor == null || netExecutor.isShutdown()) {
            netExecutor = Executors.newSingleThreadExecutor();
        }
        netExecutor.execute(() -> {
            if (mqttClient != null && mqttClient.isConnected()) {
                try {
                    String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                    mqttClient.unsubscribe(sysTopic);
                    lastPongReceivedTimes.remove(code);
                    Log.d(TAG, "Unsubscribed from sysTopic: " + sysTopic);
                } catch (Exception ignored) {}
            }
        });
    }

    public void sendSinglePing() {
        if (netExecutor == null || netExecutor.isShutdown()) {
            netExecutor = Executors.newSingleThreadExecutor();
        }
        netExecutor.execute(this::sendSinglePingInternal);
    }

    private void sendSinglePingInternal() {
        if (mqttClient == null || !mqttClient.isConnected()) {
            return;
        }
        try {
            String customName = prefs.getString("custom_device_name", "");
            boolean hasCustom = !customName.isEmpty();
            if (customName.isEmpty()) {
                customName = Build.MODEL;
            }

            JSONObject pingData = new JSONObject();
            pingData.put("type", "ping");
            pingData.put("device_id", prefs.getString("device_id", "Unknown"));
            pingData.put("device_name", Build.MODEL);
            pingData.put("custom_name", customName);
            pingData.put("has_custom_name", hasCustom);
            pingData.put("sim1_name", prefs.getString("sim1_name", "Unknown SIM 1"));
            pingData.put("sim2_name", prefs.getString("sim2_name", "Unknown SIM 2"));
            pingData.put("timestamp", System.currentTimeMillis());

            MqttMessage msg = new MqttMessage(pingData.toString().getBytes());
            msg.setQos(0);

            Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
            for (String code : codes) {
                String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                try {
                    mqttClient.publish(sysTopic, msg);
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    private synchronized void startPingLoop() {
        if (pingExecutor != null && !pingExecutor.isShutdown()) {
            pingExecutor.shutdownNow();
        }
        pingExecutor = Executors.newSingleThreadScheduledExecutor();
        // 2000ms periodic ping loop dispatched via netExecutor
        pingExecutor.scheduleAtFixedRate(this::sendSinglePing, 1000, 2000, TimeUnit.MILLISECONDS);
    }

    public void updateCustomDeviceName(String newName) {
        prefs.edit().putString("custom_device_name", newName).apply();
        if (netExecutor == null || netExecutor.isShutdown()) {
            netExecutor = Executors.newSingleThreadExecutor();
        }
        netExecutor.execute(() -> {
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    JSONObject updateData = new JSONObject();
                    updateData.put("type", "update_device_name");
                    updateData.put("device_id", prefs.getString("device_id", "Unknown"));
                    updateData.put("custom_name", newName);
                    updateData.put("has_custom_name", true);
                    updateData.put("timestamp", System.currentTimeMillis());

                    MqttMessage msg = new MqttMessage(updateData.toString().getBytes());
                    msg.setQos(1);

                    Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
                    for (String code : codes) {
                        String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                        try {
                            mqttClient.publish(sysTopic, msg);
                        } catch (Exception ignored) {}
                    }
                    sendSinglePingInternal();
                }
            } catch (Exception ignored) {}
        });
    }

    public void publishSms(long logId, String phone, String smsBody, String simName) {
        if (smsExecutor == null || smsExecutor.isShutdown()) {
            smsExecutor = Executors.newSingleThreadExecutor();
        }

        smsExecutor.execute(() -> {
            try {
                if (mqttClient == null || !mqttClient.isConnected()) {
                    Log.e(TAG, "Cannot publish SMS, not connected!");
                    if (logId != -1) {
                        SmsLogDbHelper.getInstance(getApplicationContext()).updateStatus(logId, SmsLog.STATUS_FAILED);
                    }
                    return;
                }

                Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
                if (codes.isEmpty()) {
                    if (logId != -1) {
                        SmsLogDbHelper.getInstance(getApplicationContext()).updateStatus(logId, SmsLog.STATUS_FAILED);
                    }
                    return;
                }

                JSONObject json = new JSONObject();
                json.put("device_id", prefs.getString("device_id", "Unknown"));
                json.put("phone", phone);
                json.put("sms", smsBody);
                json.put("sim", simName);
                String rawJson = json.toString();

                boolean atLeastOneSuccess = false;

                for (String code : codes) {
                    String topic = "digonto_ivac_sms_" + code;
                    try {
                        byte[] xored = xorBytes(rawJson.getBytes(), code.getBytes());
                        String payload = Base64.encodeToString(xored, Base64.NO_WRAP);

                        MqttMessage message = new MqttMessage(payload.getBytes());
                        message.setQos(1);
                        mqttClient.publish(topic, message);
                        atLeastOneSuccess = true;
                        Log.d(TAG, "SMS VIP Express Published Successfully to topic: " + topic);
                    } catch (Exception e) {
                        Log.e(TAG, "Error publishing SMS to topic " + topic, e);
                    }
                }

                if (logId != -1) {
                    int status = atLeastOneSuccess ? SmsLog.STATUS_SUCCESS : SmsLog.STATUS_FAILED;
                    SmsLogDbHelper.getInstance(getApplicationContext()).updateStatus(logId, status);
                    if (MainActivity.instance != null) {
                        MainActivity.instance.notifyNewSmsReceived();
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error processing VIP SMS publishing", e);
                if (logId != -1) {
                    SmsLogDbHelper.getInstance(getApplicationContext()).updateStatus(logId, SmsLog.STATUS_FAILED);
                    if (MainActivity.instance != null) {
                        MainActivity.instance.notifyNewSmsReceived();
                    }
                }
            }
        });
    }

    private byte[] xorBytes(byte[] data, byte[] key) {
        byte[] result = new byte[data.length];
        for (int i = 0; i < data.length; i++) {
            result[i] = (byte) (data[i] ^ key[i % key.length]);
        }
        return result;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "SMS Forwarder Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        if (netExecutor != null) {
            netExecutor.shutdownNow();
        }
        if (pingExecutor != null) {
            pingExecutor.shutdownNow();
        }
        if (smsExecutor != null) {
            smsExecutor.shutdownNow();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        if (wifiLock != null && wifiLock.isHeld()) {
            try { wifiLock.release(); } catch (Exception ignored) {}
        }
        if (mqttClient != null) {
            try {
                if (mqttClient.isConnected()) {
                    JSONObject offData = new JSONObject();
                    offData.put("type", "offline");
                    offData.put("device_id", prefs.getString("device_id", "Unknown"));
                    Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
                    for (String code : codes) {
                        mqttClient.publish("digonto_ivac_sms_" + code + "_sys", new MqttMessage(offData.toString().getBytes()));
                    }
                }
                mqttClient.disconnect();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
