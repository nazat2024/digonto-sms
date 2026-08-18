package com.digonto.smsforwarder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.json.JSONObject;

public class MqttService extends Service {

    private static final String TAG = "MqttService";
    private static final String CHANNEL_ID = "SmsForwarderServiceChannel";
    private static final int NOTIFICATION_ID = 1;

    private MqttClient mqttClient;
    private SharedPreferences prefs;
    private Handler pingHandler;
    private Runnable pingRunnable;
    
    // Static reference to publish SMS easily from SmsReceiver
    public static MqttService instance;
    
    // Status tracking for MainActivity
    public static boolean isConnectedToBroker = false;
    public static long lastPongReceivedTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        prefs = getSharedPreferences("SMSConfig", MODE_PRIVATE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String pairingCode = prefs.getString("pairing_code", "");
        if (pairingCode.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("IVAC SMS Sync Active")
                .setContentText("Listening for SMS in background...")
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .build();

        startForeground(NOTIFICATION_ID, notification);

        connectToMqtt(pairingCode);
        return START_STICKY;
    }

    private void connectToMqtt(String pairingCode) {
        new Thread(() -> {
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    return; // Already connected
                }

                String clientId = "android_client_" + System.currentTimeMillis();
                mqttClient = new MqttClient("tcp://broker.hivemq.com:1883", clientId, new MemoryPersistence());
                
                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true);
                options.setAutomaticReconnect(true);
                options.setConnectionTimeout(10);
                options.setKeepAliveInterval(20); // Keep alive

                mqttClient.setCallback(new MqttCallback() {
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
                                    lastPongReceivedTime = System.currentTimeMillis();
                                }
                            } catch (Exception ignored) {}
                        }
                    }

                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {}
                });

                mqttClient.connect(options);
                isConnectedToBroker = true;
                
                String sysTopic = "digonto_ivac_sms_" + pairingCode + "_sys";
                mqttClient.subscribe(sysTopic);

                startPingLoop(pairingCode, sysTopic);

            } catch (Exception e) {
                isConnectedToBroker = false;
                Log.e(TAG, "MQTT Connection error", e);
                // Retry after 5 seconds
                new Handler(Looper.getMainLooper()).postDelayed(() -> connectToMqtt(pairingCode), 5000);
            }
        }).start();
    }

    private void startPingLoop(String pairingCode, String sysTopic) {
        if (pingHandler != null) {
            pingHandler.removeCallbacksAndMessages(null);
        }
        pingHandler = new Handler(Looper.getMainLooper());
        pingRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    if (mqttClient != null && mqttClient.isConnected()) {
                        JSONObject pingData = new JSONObject();
                        pingData.put("type", "ping");
                        pingData.put("device_id", Build.MODEL);
                        pingData.put("sim1_name", prefs.getString("sim1_name", "Unknown SIM 1"));
                        pingData.put("sim2_name", prefs.getString("sim2_name", "Unknown SIM 2"));
                        pingData.put("timestamp", System.currentTimeMillis());

                        MqttMessage msg = new MqttMessage(pingData.toString().getBytes());
                        msg.setQos(0);
                        mqttClient.publish(sysTopic, msg);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Ping error", e);
                }
                pingHandler.postDelayed(this, 2000); // 2 second ping as requested
            }
        };
        pingHandler.post(pingRunnable);
    }

    public void publishSms(String phone, String smsBody, String simName) {
        if (mqttClient == null || !mqttClient.isConnected()) {
            Log.e(TAG, "Cannot publish SMS, not connected!");
            return;
        }
        
        new Thread(() -> {
            try {
                String pairingCode = prefs.getString("pairing_code", "");
                String topic = "digonto_ivac_sms_" + pairingCode;

                JSONObject json = new JSONObject();
                json.put("phone", phone);
                json.put("sms", smsBody);
                json.put("sim", simName);

                String rawJson = json.toString();
                byte[] xored = xorBytes(rawJson.getBytes(), pairingCode.getBytes());
                String payload = Base64.encodeToString(xored, Base64.NO_WRAP);

                MqttMessage message = new MqttMessage(payload.getBytes());
                message.setQos(1);
                mqttClient.publish(topic, message);
                Log.d(TAG, "SMS Published Successfully via MQTT!");
            } catch (Exception e) {
                Log.e(TAG, "Error publishing SMS", e);
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
        if (mqttClient != null) {
            try {
                mqttClient.disconnect();
            } catch (MqttException ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
