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
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MqttService extends Service {

    private static final String TAG = "MqttService";
    private static final String CHANNEL_ID = "SmsForwarderServiceChannel";
    private static final int NOTIFICATION_ID = 1;

    private MqttClient mqttClient;
    private SharedPreferences prefs;
    
    private HandlerThread pingThread;
    private Handler pingHandler;
    private Runnable pingRunnable;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    
    // Static reference to publish SMS easily from SmsReceiver
    public static MqttService instance;
    
    // Status tracking for MainActivity
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
                .setContentTitle("IVAC SMS Sync Active")
                .setContentText("Listening for SMS in background...")
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .build();

        startForeground(NOTIFICATION_ID, notification);

        connectToMqtt(pairingCodes);
        return START_STICKY;
    }

    private void connectToMqtt(Set<String> pairingCodes) {
        new Thread(() -> {
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    return; // Already connected
                }

                String clientId = "andr_" + (System.currentTimeMillis() % 1000000);
                mqttClient = new MqttClient("tcp://broker.emqx.io:1883", clientId, new MemoryPersistence());
                
                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true);
                options.setAutomaticReconnect(true);
                options.setConnectionTimeout(15);
                options.setKeepAliveInterval(30);

                mqttClient.setCallback(new org.eclipse.paho.client.mqttv3.MqttCallbackExtended() {
                    @Override
                    public void connectComplete(boolean reconnect, String serverURI) {
                        isConnectedToBroker = true;
                        try {
                            Set<String> currentCodes = prefs.getStringSet("pairing_codes", new HashSet<>());
                            for (String code : currentCodes) {
                                String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                                mqttClient.subscribe(sysTopic);
                                Log.d(TAG, "Subscribed to sysTopic: " + sysTopic);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error subscribing on connectComplete", e);
                        }

                        // Send ping IMMEDIATELY upon connection!
                        sendSinglePing();
                    }

                    @Override
                    public void connectionLost(Throwable cause) {
                        isConnectedToBroker = false;
                        Log.e(TAG, "Connection lost", cause);
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
                new Handler(Looper.getMainLooper()).postDelayed(() -> connectToMqtt(pairingCodes), 5000);
            }
        }).start();
    }

    private void sendSinglePing() {
        new Thread(() -> {
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    JSONObject pingData = new JSONObject();
                    pingData.put("type", "ping");
                    pingData.put("device_id", prefs.getString("device_id", "Unknown"));
                    pingData.put("device_name", Build.MODEL);
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
                }
            } catch (Exception ignored) {}
        }).start();
    }

    private void startPingLoop() {
        if (pingHandler != null) {
            pingHandler.removeCallbacksAndMessages(null);
        }
        if (pingThread != null) {
            pingThread.quitSafely();
        }
        pingThread = new HandlerThread("MqttPingThread");
        pingThread.start();
        pingHandler = new Handler(pingThread.getLooper());

        pingRunnable = new Runnable() {
            @Override
            public void run() {
                sendSinglePing();
                if (pingHandler != null) {
                    pingHandler.postDelayed(this, 1000);
                }
            }
        };
        pingHandler.post(pingRunnable);
    }

    public void publishSms(long logId, String phone, String smsBody, String simName) {
        new Thread(() -> {
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
                        Log.d(TAG, "SMS Published Successfully to topic: " + topic);
                    } catch (Exception e) {
                        Log.e(TAG, "Error publishing SMS to topic " + topic, e);
                    }
                }
                
                if (atLeastOneSuccess) {
                    if (logId != -1) {
                        SmsLogDbHelper.getInstance(getApplicationContext()).updateStatus(logId, SmsLog.STATUS_SUCCESS);
                    }
                } else {
                    if (logId != -1) {
                        SmsLogDbHelper.getInstance(getApplicationContext()).updateStatus(logId, SmsLog.STATUS_FAILED);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error processing SMS publishing", e);
                if (logId != -1) {
                    SmsLogDbHelper.getInstance(getApplicationContext()).updateStatus(logId, SmsLog.STATUS_FAILED);
                }
            }
        }).start();
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
        if (pingHandler != null) {
            pingHandler.removeCallbacksAndMessages(null);
        }
        if (pingThread != null) {
            pingThread.quitSafely();
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
