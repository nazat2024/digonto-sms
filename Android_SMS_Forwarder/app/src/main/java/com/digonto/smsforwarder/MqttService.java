package com.digonto.smsforwarder;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.Process;
import android.os.SystemClock;
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

public class MqttService extends Service {

    public static final String ACTION_ALARM_HEARTBEAT = "com.digonto.smsforwarder.ACTION_ALARM_HEARTBEAT";
    private static final String TAG = "MqttService";
    private static final String CHANNEL_ID = "SmsForwarderServiceChannel";
    private static final int NOTIFICATION_ID = 1;

    private MqttClient mqttClient;
    private SharedPreferences prefs;

    // Dedicated background thread executors so the UI NEVER hangs or freezes!
    private ExecutorService netExecutor;
    private ExecutorService smsExecutor;
    private HandlerThread pingThread;
    private Handler pingHandler;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private ConnectivityManager.NetworkCallback networkCallback;
    private PendingIntent alarmPingIntent;

    private final Object connectionLock = new Object();
    private volatile boolean isConnecting = false;
    private volatile long lastConnectAttemptTime = 0;

    public static MqttService instance;
    public static boolean isConnectedToBroker = false;
    public static ConcurrentHashMap<String, Long> lastPongReceivedTimes = new ConcurrentHashMap<>();

    private final Runnable pingRunnable = new Runnable() {
        @Override
        public void run() {
            ensureWakeLocks();
            if (mqttClient != null && mqttClient.isConnected()) {
                sendSinglePingInternal();
            } else {
                checkAndEnsureConnection();
            }
            if (pingHandler != null) {
                pingHandler.postDelayed(this, 3000); // 3000ms periodic heartbeat
            }
        }
    };

    public void checkAndEnsureConnection() {
        if (mqttClient == null || !mqttClient.isConnected()) {
            triggerReconnect();
        }
    }

    private void ensureWakeLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(10 * 60 * 1000L);
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}
    }

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

        // Initialize pingThread and pingHandler right away so pingHandler is NEVER null!
        pingThread = new HandlerThread("IVACHighPriorityPing", Process.THREAD_PRIORITY_FOREGROUND);
        pingThread.start();
        pingHandler = new Handler(pingThread.getLooper());

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IVACMasterPro:WakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(10 * 60 * 1000L);
            }
        } catch (Exception ignored) {}

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "IVACMasterPro:WifiLock");
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}

        createNotificationChannel();
        registerNetworkCallback();

        // Start ping and connection guardian loop immediately
        pingHandler.post(pingRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_ALARM_HEARTBEAT.equals(intent.getAction())) {
            // Heartbeat woke up device via AlarmManager (Doze mode safe!)
            ensureWakeLocks();
            if (mqttClient != null && mqttClient.isConnected()) {
                sendSinglePing();
            } else {
                checkAndEnsureConnection();
            }
            scheduleNextAlarmPing();
            return START_STICKY;
        }

        Set<String> pairingCodes = new HashSet<>(prefs.getStringSet("pairing_codes", new HashSet<>()));

        if (intent != null && intent.hasExtra("new_pairing_code")) {
            String newCode = intent.getStringExtra("new_pairing_code");
            if (newCode != null && !newCode.isEmpty()) {
                pairingCodes.add(newCode);
                prefs.edit().putStringSet("pairing_codes", pairingCodes).apply();
            }
        }

        if (pairingCodes.isEmpty()) {
            String oldCode = prefs.getString("pairing_code", "");
            if (!oldCode.isEmpty()) {
                pairingCodes = new HashSet<>();
                pairingCodes.add(oldCode);
                prefs.edit().putStringSet("pairing_codes", pairingCodes).apply();
            }
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("IVAC Master Pro Active")
                .setContentText(pairingCodes.isEmpty() ? "Waiting for desktop pairing..." : "Connected & listening for SMS live...")
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .build();

        startForeground(NOTIFICATION_ID, notification);

        connectToMqtt(pairingCodes);
        scheduleNextAlarmPing();
        return START_STICKY;
    }

    public void triggerReconnect() {
        triggerReconnect(false);
    }

    public void triggerReconnect(boolean forceReset) {
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
        connectToMqtt(codes, forceReset);
    }

    public void connectToMqtt(final Set<String> pairingCodes) {
        connectToMqtt(pairingCodes, false);
    }

    public void connectToMqtt(final Set<String> pairingCodes, final boolean forceReset) {
        if (netExecutor == null || netExecutor.isShutdown()) {
            netExecutor = Executors.newSingleThreadExecutor();
        }

        netExecutor.execute(() -> {
            synchronized (connectionLock) {
                if (!forceReset && mqttClient != null && mqttClient.isConnected()) {
                    if (pairingCodes != null) {
                        for (String code : pairingCodes) {
                            try {
                                String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                                mqttClient.subscribe(sysTopic);
                            } catch (Exception ignored) {}
                        }
                    }
                    sendSinglePingInternal();
                    return;
                }

                long now = System.currentTimeMillis();
                if (isConnecting) {
                    Log.d(TAG, "Connection already in progress, skipping.");
                    return;
                }
                if (!forceReset && (now - lastConnectAttemptTime < 2000)) {
                    Log.d(TAG, "Throttled: connection attempt too frequent.");
                    return;
                }

                isConnecting = true;
                lastConnectAttemptTime = now;
            }

            try {
                if (mqttClient != null) {
                    try {
                        mqttClient.setCallback(null);
                        if (mqttClient.isConnected()) {
                            mqttClient.disconnectForcibly(300);
                        }
                    } catch (Exception ignored) {}
                    try {
                        mqttClient.close();
                    } catch (Exception ignored) {}
                    mqttClient = null;
                }

                String devId = prefs.getString("device_id", UUID.randomUUID().toString()).replace("-", "");
                String clientId = "ivac_m_" + devId.substring(0, Math.min(devId.length(), 10)) + "_" + (System.currentTimeMillis() % 100000);

                mqttClient = new MqttClient("tcp://broker.emqx.io:1883", clientId, new MemoryPersistence());

                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true); // Always clean session to avoid broker session lock!
                options.setConnectionTimeout(8);
                options.setKeepAliveInterval(15);
                options.setAutomaticReconnect(false); // We manage reconnection cleanly and reliably

                mqttClient.setCallback(new org.eclipse.paho.client.mqttv3.MqttCallback() {
                    @Override
                    public void connectionLost(Throwable cause) {
                        isConnectedToBroker = false;
                        Log.e(TAG, "MQTT Connection lost: " + (cause != null ? cause.getMessage() : "unknown"));
                        if (pingHandler != null) {
                            pingHandler.postDelayed(() -> triggerReconnect(true), 2000);
                        }
                    }

                    @Override
                    public void messageArrived(String topic, MqttMessage message) throws Exception {
                        String payload = new String(message.getPayload());
                        if (topic.endsWith("_sys")) {
                            try {
                                JSONObject sysData = new JSONObject(payload);
                                String type = sysData.optString("type");
                                if ("pong".equals(type) || "desktop_ready".equals(type)) {
                                    String code = topic.replace("digonto_ivac_sms_", "").replace("_sys", "");
                                    lastPongReceivedTimes.put(code, System.currentTimeMillis());
                                    if ("desktop_ready".equals(type)) {
                                        // Desktop announced startup: send ping immediately!
                                        sendSinglePingInternal();
                                    }
                                } else if ("set_device_name".equals(type)) {
                                    String targetDevId = sysData.optString("device_id");
                                    String myDevId = prefs.getString("device_id", "");
                                    if (targetDevId.equals(myDevId) || targetDevId.isEmpty()) {
                                        String newName = sysData.optString("custom_name", "").trim();
                                        if (!newName.isEmpty()) {
                                            prefs.edit().putString("custom_device_name", newName).apply();
                                            Log.i(TAG, "Device name updated from desktop: " + newName);
                                        }
                                    }
                                }
                            } catch (Exception ignored) {}
                        }
                    }

                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {}
                });

                Log.d(TAG, "Connecting to MQTT broker...");
                mqttClient.connect(options);
                isConnectedToBroker = true;
                Log.d(TAG, "Connected to MQTT broker successfully!");

                Set<String> currentCodes = prefs.getStringSet("pairing_codes", new HashSet<>());
                for (String code : currentCodes) {
                    String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                    try {
                        mqttClient.subscribe(sysTopic);
                        Log.d(TAG, "Subscribed: " + sysTopic);
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to subscribe to " + sysTopic + ": " + e.getMessage());
                    }
                }

                sendSinglePingInternal();
                scheduleNextAlarmPing();

            } catch (Exception e) {
                isConnectedToBroker = false;
                Log.e(TAG, "MQTT Connection error: " + e.getMessage());
                if (pingHandler != null) {
                    pingHandler.postDelayed(() -> triggerReconnect(true), 3000);
                }
            } finally {
                synchronized (connectionLock) {
                    isConnecting = false;
                }
            }
        });
    }

    public void subscribeToCode(String code) {
        if (code == null || code.trim().isEmpty()) return;
        final String cleanCode = code.trim();

        Set<String> codes = new HashSet<>(prefs.getStringSet("pairing_codes", new HashSet<>()));
        codes.add(cleanCode);
        prefs.edit().putStringSet("pairing_codes", codes).apply();

        if (netExecutor == null || netExecutor.isShutdown()) {
            netExecutor = Executors.newSingleThreadExecutor();
        }
        netExecutor.execute(() -> {
            if (mqttClient != null && mqttClient.isConnected()) {
                try {
                    String sysTopic = "digonto_ivac_sms_" + cleanCode + "_sys";
                    mqttClient.subscribe(sysTopic);
                    Log.d(TAG, "Dynamically subscribed to sysTopic: " + sysTopic);
                    sendSinglePingInternal();
                } catch (Exception e) {
                    Log.e(TAG, "Error dynamically subscribing: " + cleanCode, e);
                    triggerReconnect(true);
                }
            } else {
                triggerReconnect(true);
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
            triggerReconnect();
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

            // Real-Time 4G Mobile Proxy Status
            boolean proxyActive = com.digonto.smsforwarder.proxy.ProxyServerService.isServiceRunning;
            String proxyAddr = com.digonto.smsforwarder.proxy.ProxyServerService.activeProxyAddress;
            pingData.put("proxy_active", proxyActive);
            pingData.put("proxy_address", (proxyActive && proxyAddr != null) ? proxyAddr : "");

            MqttMessage msg = new MqttMessage(pingData.toString().getBytes());
            msg.setQos(0);

            Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
            for (String code : codes) {
                String sysTopic = "digonto_ivac_sms_" + code + "_sys";
                try {
                    mqttClient.publish(sysTopic, msg);
                } catch (Exception e) {
                    Log.w(TAG, "MQTT ping publish failed: " + e.getMessage());
                    isConnectedToBroker = false;
                    triggerReconnect(true);
                }
            }
        } catch (Exception ignored) {}
    }

    public static void triggerPingNow() {
        if (instance != null) {
            try {
                instance.sendSinglePing();
            } catch (Exception ignored) {}
        }
    }

    private synchronized void startPingLoop() {
        if (pingHandler != null) {
            pingHandler.removeCallbacks(pingRunnable);
            pingHandler.post(pingRunnable);
        }
    }

    private void scheduleNextAlarmPing() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                Intent intent = new Intent(this, MqttService.class);
                intent.setAction(ACTION_ALARM_HEARTBEAT);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                alarmPingIntent = PendingIntent.getService(this, 999, intent, flags);
                long nextTrigger = SystemClock.elapsedRealtime() + 15000; // 15 seconds watchdog
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTrigger, alarmPingIntent);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTrigger, alarmPingIntent);
                } else {
                    am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, nextTrigger, alarmPingIntent);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling alarm ping", e);
        }
    }

    private void registerNetworkCallback() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                networkCallback = new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(Network network) {
                        Log.d(TAG, "Network became available, ensuring fresh MQTT connection...");
                        isConnectedToBroker = false;
                        if (pingHandler != null) {
                            pingHandler.removeCallbacksAndMessages(null);
                            pingHandler.postDelayed(() -> triggerReconnect(true), 800);
                            pingHandler.postDelayed(pingRunnable, 2000);
                        } else {
                            triggerReconnect(true);
                        }
                    }

                    @Override
                    public void onLost(Network network) {
                        Log.d(TAG, "Network lost - destroying dead socket");
                        isConnectedToBroker = false;
                        if (netExecutor != null && !netExecutor.isShutdown()) {
                            netExecutor.execute(() -> {
                                synchronized (connectionLock) {
                                    if (mqttClient != null) {
                                        try {
                                            mqttClient.setCallback(null);
                                            mqttClient.disconnectForcibly(200);
                                        } catch (Exception ignored) {}
                                        try {
                                            mqttClient.close();
                                        } catch (Exception ignored) {}
                                        mqttClient = null;
                                    }
                                }
                            });
                        }
                    }
                };
                cm.registerDefaultNetworkCallback(networkCallback);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error registering network callback", e);
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "onTaskRemoved triggered - scheduling service revival");
        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), MqttService.class);
            restartServiceIntent.setPackage(getPackageName());
            int flags = PendingIntent.FLAG_ONE_SHOT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent restartPendingIntent = PendingIntent.getService(
                    getApplicationContext(), 1, restartServiceIntent, flags
            );
            AlarmManager am = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 1000, restartPendingIntent);
            }
        } catch (Exception ignored) {}
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
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            serviceChannel.setDescription("Permanent connection for SMS forwarder");
            serviceChannel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        if (networkCallback != null) {
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    cm.unregisterNetworkCallback(networkCallback);
                }
            } catch (Exception ignored) {}
        }
        if (alarmPingIntent != null) {
            try {
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                if (am != null) {
                    am.cancel(alarmPingIntent);
                }
            } catch (Exception ignored) {}
        }
        if (pingHandler != null) {
            pingHandler.removeCallbacksAndMessages(null);
        }
        if (pingThread != null) {
            pingThread.quitSafely();
        }
        if (netExecutor != null) {
            netExecutor.shutdownNow();
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
                mqttClient.disconnect();
            } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
