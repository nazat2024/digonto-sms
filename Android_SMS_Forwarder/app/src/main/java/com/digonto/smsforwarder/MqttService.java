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
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MqttService extends Service {

    private static final String TAG = "MqttService";
    private static final String CHANNEL_ID = "SmsForwarderServiceChannel";
    private static final int NOTIFICATION_ID = 1;

    private MqttClient mqttClient;
    private SharedPreferences prefs;
    
    // Dedicated background executors - ZERO load on Main UI thread!
    private ScheduledExecutorService pingExecutor;
    private ScheduledExecutorService watchdogExecutor;
    
    // Hardware Power & Wi-Fi locks to keep background connection hot & active
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    
    // Static reference to publish SMS easily from SmsReceiver
    public static MqttService instance;
    
    // Status tracking for MainActivity
    public static boolean isConnectedToBroker = false;
    public static ConcurrentHashMap<String, Long> lastPongReceivedTimes = new ConcurrentHashMap<>();

    private boolean isConnecting = false;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        prefs = getSharedPreferences("SMSConfig", MODE_PRIVATE);
        
        if (prefs.getString("device_id", "").isEmpty()) {
            prefs.edit().putString("device_id", UUID.randomUUID().toString()).apply();
        }
        
        // 1. Acquire WakeLock (Partial) so CPU stays running when phone screen is locked
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DigontoSMS:WakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
                Log.d(TAG, "WakeLock acquired successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire WakeLock", e);
        }

        // 2. Acquire WifiLock so Wi-Fi stays awake in background
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "DigontoSMS:WifiLock");
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
                Log.d(TAG, "WifiLock acquired successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire WifiLock", e);
        }

        createNotificationChannel();
        startWatchdog();
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
                .setContentText("Super Fast Sync Active (1.5s Real-time)")
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .build();

        startForeground(NOTIFICATION_ID, notification);

        connectToMqtt(pairingCodes);
        return START_STICKY;
    }

    public synchronized void connectToMqtt(Set<String> pairingCodes) {
        if (pairingCodes == null || pairingCodes.isEmpty()) return;
        if (isConnecting) return;
        if (mqttClient != null && mqttClient.isConnected()) {
            isConnectedToBroker = true;
            return;
        }

        isConnecting = true;
        new Thread(() -> {
            try {
                if (mqttClient != null) {
                    try {
                        mqttClient.disconnectForcibly();
                        mqttClient.close();
                    } catch (Exception ignored) {}
                    mqttClient = null;
                }

                String clientId = "andr_" + (System.currentTimeMillis() % 1000000) + "_" + (int)(Math.random() * 1000);
                mqttClient = new MqttClient("tcp://broker.emqx.io:1883", clientId, new MemoryPersistence());
                
                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true);
                options.setAutomaticReconnect(true);
                options.setConnectionTimeout(10);
                options.setKeepAliveInterval(15); // Fast 15s keepalive

                // Set Last Will and Testament (LWT) for instant offline detection
                try {
                    JSONObject lwtData = new JSONObject();
                    lwtData.put("type", "offline");
                    lwtData.put("device_id", prefs.getString("device_id", "Unknown"));
                    for (String code : pairingCodes) {
                        String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                        options.setWill(sysTopic, lwtData.toString().getBytes(), 0, false);
                        break;
                    }
                } catch (Exception ignored) {}

                mqttClient.setCallback(new MqttCallbackExtended() {
                    @Override
                    public void connectComplete(boolean reconnect, String serverURI) {
                        isConnectedToBroker = true;
                        isConnecting = false;
                        Log.d(TAG, "MQTT Connected! Reconnect=" + reconnect);
                        
                        try {
                            Set<String> currentCodes = prefs.getStringSet("pairing_codes", new HashSet<>());
                            for (String code : currentCodes) {
                                String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                                mqttClient.subscribe(sysTopic, 0);
                                Log.d(TAG, "Subscribed to sysTopic: " + sysTopic);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error subscribing on connectComplete", e);
                        }

                        // Send an INSTANT ping right now (0ms latency)!
                        sendSinglePing();

                        // Flush pending SMS immediately
                        flushPendingSms();
                    }

                    @Override
                    public void connectionLost(Throwable cause) {
                        isConnectedToBroker = false;
                        Log.e(TAG, "Connection lost, will reconnect immediately...", cause);
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
                isConnecting = false;
                
                startPingLoop();

            } catch (Exception e) {
                isConnectedToBroker = false;
                isConnecting = false;
                Log.e(TAG, "MQTT Connection error", e);
            }
        }).start();
    }

    private void sendSinglePing() {
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
    }

    /**
     * Super-Fast 1.5 Second Real-Time Ping Loop.
     * Runs 100% on background thread pool -> Zero freeze/hang on phone display!
     */
    private synchronized void startPingLoop() {
        if (pingExecutor != null && !pingExecutor.isShutdown()) {
            pingExecutor.shutdownNow();
        }
        pingExecutor = Executors.newSingleThreadScheduledExecutor();
        pingExecutor.scheduleWithFixedDelay(() -> {
            sendSinglePing();
        }, 0, 1500, TimeUnit.MILLISECONDS); // Super fast 1.5s real-time heartbeat
    }

    /**
     * Active Watchdog that guards the connection every 4 seconds.
     */
    private synchronized void startWatchdog() {
        if (watchdogExecutor != null && !watchdogExecutor.isShutdown()) {
            watchdogExecutor.shutdownNow();
        }
        watchdogExecutor = Executors.newSingleThreadScheduledExecutor();
        watchdogExecutor.scheduleWithFixedDelay(() -> {
            try {
                Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
                if (codes.isEmpty()) return;

                if (mqttClient == null || !mqttClient.isConnected()) {
                    isConnectedToBroker = false;
                    Log.d(TAG, "Watchdog: Reconnecting fast...");
                    connectToMqtt(codes);
                }
            } catch (Exception e) {
                Log.e(TAG, "Watchdog error", e);
            }
        }, 3, 4, TimeUnit.SECONDS);
    }

    public void publishSms(long logId, String phone, String smsBody, String simName) {
        new Thread(() -> {
            try {
                if (mqttClient == null || !mqttClient.isConnected()) {
                    Log.w(TAG, "Cannot publish immediately (offline). SMS queued in DB.");
                    return;
                }

                Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
                if (codes.isEmpty()) return;

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
                }
            } catch (Exception e) {
                Log.e(TAG, "Error processing SMS publishing", e);
            }
        }).start();
    }

    private void flushPendingSms() {
        new Thread(() -> {
            try {
                List<SmsLog> pendingLogs = SmsLogDbHelper.getInstance(getApplicationContext()).getPendingLogs();
                if (pendingLogs != null && !pendingLogs.isEmpty()) {
                    Log.d(TAG, "Flushing " + pendingLogs.size() + " pending SMS logs...");
                    for (SmsLog log : pendingLogs) {
                        publishSms(log.getId(), log.getSender(), log.getBody(), log.getSimName());
                        Thread.sleep(150);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error flushing pending SMS", e);
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
        if (pingExecutor != null) {
            pingExecutor.shutdownNow();
        }
        if (watchdogExecutor != null) {
            watchdogExecutor.shutdownNow();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        if (wifiLock != null && wifiLock.isHeld()) {
            try { wifiLock.release(); } catch (Exception ignored) {}
        }
        if (mqttClient != null) {
            try {
                // Send an instant offline broadcast
                JSONObject offlineData = new JSONObject();
                offlineData.put("type", "offline");
                offlineData.put("device_id", prefs.getString("device_id", "Unknown"));
                Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
                for (String code : codes) {
                    mqttClient.publish("digonto_ivac_sms_" + code + "_sys", new MqttMessage(offlineData.toString().getBytes()));
                }
                mqttClient.disconnectForcibly();
                mqttClient.close();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
