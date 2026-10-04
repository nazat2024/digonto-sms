package com.digonto.smsforwarder.proxy;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.digonto.smsforwarder.MainActivity;
import com.digonto.smsforwarder.R;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

/**
 * Foreground Service running the 4G Mobile Proxy Server.
 * Supports Mode 1: WiFi LAN, Mode 2: USB Cable, Mode 3: Remote Reverse Tunnel.
 */
public class ProxyServerService extends Service {
    private static final String TAG = "ProxyServerService";
    private static final String CHANNEL_ID = "proxy_service_channel";
    private static final int NOTIFICATION_ID = 4040;

    public static final String ACTION_START = "com.digonto.smsforwarder.proxy.START";
    public static final String ACTION_STOP = "com.digonto.smsforwarder.proxy.STOP";
    public static final String ACTION_BROADCAST_STATUS = "com.digonto.smsforwarder.proxy.STATUS_UPDATE";

    public static final String MODE_WIFI = "WIFI";
    public static final String MODE_USB = "USB";
    public static final String MODE_REMOTE = "REMOTE";

    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        public ProxyServerService getService() {
            return ProxyServerService.this;
        }
    }

    private CellularNetworkBinder cellularBinder;
    private ProxyTrafficStats stats;
    private HttpConnectEngine httpEngine;
    private RemoteTunnelClient remoteTunnel;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    public static volatile boolean isServiceRunning = false;
    public static volatile String activeProxyAddress = "";

    private String currentMode = MODE_WIFI;
    private int proxyPort = 8080;
    private String remoteAssignedAddress = "";
    private boolean isRunning = false;

    private final Handler tickerHandler = new Handler(Looper.getMainLooper());
    private String lastReportedAddress = "";
    private final Runnable tickerRunnable = new Runnable() {
        @Override
        public void run() {
            if (isRunning) {
                updateActiveAddress();
                if (activeProxyAddress != null && !activeProxyAddress.isEmpty() && !activeProxyAddress.equals(lastReportedAddress)) {
                    lastReportedAddress = activeProxyAddress;
                    com.digonto.smsforwarder.MqttService.triggerPingNow();
                }
                stats.updateSpeeds();
                broadcastStatus();
                updateNotification();
                tickerHandler.postDelayed(this, 1000);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        stats = new ProxyTrafficStats();
        cellularBinder = new CellularNetworkBinder(this);
        cellularBinder.start();

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SMSForwarder:ProxyWakeLock");
            wakeLock.acquire(12 * 60 * 60 * 1000L); // 12 hours max
        }

        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "SMSForwarder:ProxyWifiLock");
            wifiLock.acquire();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_START.equals(action)) {
                String mode = intent.getStringExtra("mode");
                int port = intent.getIntExtra("port", 8080);
                startProxy(mode != null ? mode : MODE_WIFI, port);
            } else if (ACTION_STOP.equals(action)) {
                stopProxy();
                stopSelf();
            }
        }
        return START_STICKY;
    }

    public synchronized void startProxy(String mode, int port) {
        this.currentMode = mode;
        this.proxyPort = port > 0 ? port : 8080;

        startForeground(NOTIFICATION_ID, buildNotification("Starting Proxy Engine..."));
        isRunning = true;
        stats.reset();

        // 1. Stop any existing engine
        stopEngines();

        try {
            if (MODE_REMOTE.equals(mode)) {
                // Mode 3: Remote Reverse Tunnel
                String nodeId = getSharedPreferences("proxy_prefs", MODE_PRIVATE).getString("remote_node_id", "BD-" + System.currentTimeMillis() % 10000);
                remoteTunnel = new RemoteTunnelClient(nodeId, "relay.digonto.com", 9050, cellularBinder, stats);
                remoteTunnel.setListener((status, assignedAddr) -> {
                    remoteAssignedAddress = assignedAddr != null ? assignedAddr : "";
                    if (isRunning) {
                        activeProxyAddress = remoteAssignedAddress;
                        com.digonto.smsforwarder.MqttService.triggerPingNow();
                    }
                    broadcastStatus();
                });
                remoteTunnel.start();
            } else {
                // Mode 1: WiFi LAN or Mode 2: USB Direct
                httpEngine = new HttpConnectEngine(proxyPort, cellularBinder, stats);
                httpEngine.start();
            }
            Log.d(TAG, "Proxy started in mode: " + mode + " on port: " + port);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start proxy engine: " + e.getMessage());
            isRunning = false;
        }

        if (isRunning) {
            isServiceRunning = true;
            updateActiveAddress();
            com.digonto.smsforwarder.MqttService.triggerPingNow();
        } else {
            isServiceRunning = false;
            activeProxyAddress = "";
            com.digonto.smsforwarder.MqttService.triggerPingNow();
        }

        tickerHandler.removeCallbacks(tickerRunnable);
        tickerHandler.post(tickerRunnable);
        broadcastStatus();
    }

    public synchronized void stopProxy() {
        isRunning = false;
        isServiceRunning = false;
        activeProxyAddress = "";
        com.digonto.smsforwarder.MqttService.triggerPingNow();
        tickerHandler.removeCallbacks(tickerRunnable);
        stopEngines();
        broadcastStatus();
        stopForeground(true);
        Log.d(TAG, "Proxy stopped");
    }

    public void updateActiveAddress() {
        if (!isRunning) {
            isServiceRunning = false;
            activeProxyAddress = "";
            return;
        }
        isServiceRunning = true;
        if (MODE_REMOTE.equals(currentMode)) {
            activeProxyAddress = (remoteAssignedAddress != null && !remoteAssignedAddress.isEmpty()) ? remoteAssignedAddress : "";
        } else if (MODE_USB.equals(currentMode)) {
            String usbIp = getUsbIpAddress();
            activeProxyAddress = (usbIp != null ? usbIp : "127.0.0.1") + ":" + proxyPort;
        } else {
            String wifiIp = getWifiIpAddress();
            activeProxyAddress = (wifiIp != null ? wifiIp : "127.0.0.1") + ":" + proxyPort;
        }
    }

    private void stopEngines() {
        if (httpEngine != null) {
            httpEngine.stop();
            httpEngine = null;
        }
        if (remoteTunnel != null) {
            remoteTunnel.stop();
            remoteTunnel = null;
        }
    }

    public boolean isRunning() {
        return isRunning;
    }

    public String getCurrentMode() {
        return currentMode;
    }

    public int getProxyPort() {
        return proxyPort;
    }

    public ProxyTrafficStats getStats() {
        return stats;
    }

    public String getCarrierName() {
        return cellularBinder != null ? cellularBinder.getCarrierName() : "4G Cellular";
    }

    public String getDisplayIpAddress() {
        if (MODE_REMOTE.equals(currentMode)) {
            return remoteAssignedAddress.isEmpty() ? "Connecting to Relay..." : remoteAssignedAddress;
        } else if (MODE_USB.equals(currentMode)) {
            String usbIp = getUsbIpAddress();
            return usbIp != null ? usbIp : "127.0.0.1 (ADB Forward)";
        } else {
            String wifiIp = getWifiIpAddress();
            return wifiIp != null ? wifiIp : "127.0.0.1";
        }
    }

    public String getWifiIpAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                String n = intf.getName().toLowerCase();
                if (n.startsWith("wlan") || n.contains("wifi") || n.startsWith("ap") || n.startsWith("p2p")) {
                    for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                        if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                            return addr.getHostAddress();
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    public String getUsbIpAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                String name = intf.getName().toLowerCase();
                if (name.contains("rndis") || name.contains("usb") || name.contains("eth")) {
                    for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                        if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                            return addr.getHostAddress();
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private void broadcastStatus() {
        Intent intent = new Intent(ACTION_BROADCAST_STATUS);
        intent.putExtra("isRunning", isRunning);
        intent.putExtra("mode", currentMode);
        intent.putExtra("port", proxyPort);
        intent.putExtra("ip", getDisplayIpAddress());
        intent.putExtra("carrier", getCarrierName());
        intent.putExtra("downloadBytes", stats.getTotalBytesDownloaded());
        intent.putExtra("uploadBytes", stats.getTotalBytesUploaded());
        intent.putExtra("downloadSpeed", stats.getCurrentDownloadSpeedBps());
        intent.putExtra("uploadSpeed", stats.getCurrentUploadSpeedBps());
        intent.putExtra("activeConnections", stats.getActiveConnections());
        sendBroadcast(intent);
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && isRunning) {
            String title = "4G Proxy Active [" + currentMode + "]";
            String content = getDisplayIpAddress() + ":" + proxyPort + " | ⬇ " +
                    ProxyTrafficStats.formatSpeed(stats.getCurrentDownloadSpeedBps());
            nm.notify(NOTIFICATION_ID, buildNotification(content));
        }
    }

    private Notification buildNotification(String contentText) {
        Intent notifIntent = new Intent(this, MainActivity.class);
        notifIntent.putExtra("tab_index", 2); // Open Tab 3 (Proxy)
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notifIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("4G Mobile Proxy Server")
                .setContentText(contentText)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Proxy Server Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active 4G proxy engine status and live data speed");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopProxy();

        if (cellularBinder != null) {
            cellularBinder.stop();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (wifiLock != null && wifiLock.isHeld()) {
            wifiLock.release();
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }
}
