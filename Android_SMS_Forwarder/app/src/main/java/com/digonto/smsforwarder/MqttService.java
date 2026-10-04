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

    private final Object reconnectLock = new Object();
    private boolean isReconnecting = false;

    public static MqttService instance;
    public static boolean isConnectedToBroker = false;
    public static ConcurrentHashMap<String, Long> lastPongReceivedTimes = new ConcurrentHashMap<>();

    private final Runnable pingRunnable = new Runnable() {
        @Override
        public void run() {
            ensureWakeLocks();
            sendSinglePing();
            if (pingHandler != null) {
                pingHandler.postDelayed(this, 2000); // Precise 2000ms high-priority ping
            }
        }
    };

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

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DigontoSMS:WakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(10 * 60 * 1000L);
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
        registerNetworkCallback();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_ALARM_HEARTBEAT.equals(intent.getAction())) {
            // Heartbeat woke up device via AlarmManager (Doze mode safe!)
            ensureWakeLocks();
            sendSinglePing();
            scheduleNextAlarmPing();
            return START_STICKY;
        }

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
                .setContentText("Connected & listening for SMS live...")
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .build();

        startForeground(NOTIFICATION_ID, notification);

        connectToMqtt(pairingCodes);
        scheduleNextAlarmPing();
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

                String devId = prefs.getString("device_id", UUID.randomUUID().toString()).replace("-", "");
                String clientId = "digonto_m_" + devId.substring(0, Math.min(devId.length(), 16));

                mqttClient = new MqttClient("tcp://broker.emqx.io:1883", clientId, new MemoryPersistence());

                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(false);
                options.setAutomaticReconnect(true);
                options.setConnectionTimeout(8);
                options.setKeepAliveInterval(20);

                mqttClient.setCallback(new org.eclipse.paho.client.mqttv3.MqttCallbackExtended() {
                    @Override
                    public void connectComplete(boolean reconnect, String serverURI) {
                        isConnectedToBroker = true;
                        Log.d(TAG, "MQTT Connected successfully. Reconnect=" + reconnect);
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
                        Log.e(TAG, "MQTT Connection lost, scheduling active reconnect...", cause);
                        if (netExecutor != null && !netExecutor.isShutdown()) {
                            netExecutor.execute(() -> {
                                try { Thread.sleep(500); } catch (Exception ignored) {}
                                triggerReconnect();
                            });
                        }
                    }

                    @Override
                    public void messageArrived(String topic, MqttMessage message) throws Exception {
                        String payload = new String(message.getPayload());
                        if (topic.endsWith("_sys")) {
                            try {
                                JSONObject sysData = new JSONObject(payload);
                                String type = sysData.optString("type");
                                if ("pong".equals(type)) {
                                    String code = topic.replace("digonto_ivac_sms_", "").replace("_sys", "");
                                    lastPongReceivedTimes.put(code, System.currentTimeMillis());
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

                mqttClient.connect(options);
                isConnectedToBroker = true;

                startPingLoop();
                scheduleNextAlarmPing();

            } catch (Exception e) {
                isConnectedToBroker = false;
                Log.e(TAG, "MQTT Connection error", e);
                if (netExecutor != null && !netExecutor.isShutdown()) {
                    netExecutor.execute(() -> {
                        try { Thread.sleep(2000); } catch (Exception ignored) {}
                        connectToMqtt(pairingCodes);
                    });
                }
            }
        });
    }

    public void triggerReconnect() {
        synchronized (reconnectLock) {
            if (isReconnecting) return;
            isReconnecting = true;
        }
        if (netExecutor != null && !netExecutor.isShutdown()) {
            netExecutor.execute(() -> {
                try {
                    Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
                    if (!codes.isEmpty()) {
                        if (mqttClient != null) {
                            try {
                                if (mqttClient.isConnected()) {
                                    mqttClient.disconnectForcibly(300);
                                }
                            } catch (Exception ignored) {}
                            try {
                                mqttClient.close();
                            } catch (Exception ignored) {}
                            mqttClient = null;
                        }
                        connectToMqtt(codes);
                    }
                } finally {
                    synchronized (reconnectLock) {
                        isReconnecting = false;
                    }
                }
            });
        }
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
                    triggerReconnect();
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
            pingHandler.removeCallbacksAndMessages(null);
        }
        if (pingThread == null || !pingThread.isAlive()) {
            pingThread = new HandlerThread("DigontoHighPriorityPing", Process.THREAD_PRIORITY_FOREGROUND);
            pingThread.start();
            pingHandler = new Handler(pingThread.getLooper());
        }
        pingHandler.post(pingRunnable);
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
                        Log.d(TAG, "Network became available, ensuring MQTT connection...");
                        isConnectedToBroker = false;
                        if (pingHandler != null) {
                            pingHandler.postDelayed(() -> triggerReconnect(), 1000);
                            pingHandler.postDelayed(() -> triggerReconnect(), 3000);
                        } else {
                            triggerReconnect();
                        }
                    }

                    @Override
                    public void onLost(Network network) {
                        isConnectedToBroker = false;
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
