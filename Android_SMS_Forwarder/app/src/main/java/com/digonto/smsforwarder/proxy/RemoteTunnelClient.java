package com.digonto.smsforwarder.proxy;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Remote Reverse Proxy Tunnel Client.
 * Connects outbound to central relay server to bypass CGNAT and allow
 * remote laptops to tunnel through this phone's 4G mobile data from anywhere.
 */
public class RemoteTunnelClient {
    private static final String TAG = "RemoteTunnelClient";
    private static final String DEFAULT_RELAY_HOST = "relay.ivacmaster.pro"; // Configurable
    private static final int DEFAULT_RELAY_PORT = 9050;

    public interface OnTunnelStateListener {
        void onTunnelStateChanged(String status, String assignedAddress);
    }

    private final String nodeId;
    private final String relayHost;
    private final int relayPort;
    private final CellularNetworkBinder cellularBinder;
    private final ProxyTrafficStats stats;

    private Socket controlSocket;
    private ExecutorService executor;
    private volatile boolean isRunning = false;
    private OnTunnelStateListener listener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public RemoteTunnelClient(String nodeId, String relayHost, int relayPort,
                              CellularNetworkBinder cellularBinder, ProxyTrafficStats stats) {
        this.nodeId = nodeId != null && !nodeId.trim().isEmpty() ? nodeId : "NODE-" + System.currentTimeMillis() % 10000;
        this.relayHost = relayHost != null && !relayHost.trim().isEmpty() ? relayHost : DEFAULT_RELAY_HOST;
        this.relayPort = relayPort > 0 ? relayPort : DEFAULT_RELAY_PORT;
        this.cellularBinder = cellularBinder;
        this.stats = stats;
    }

    public void setListener(OnTunnelStateListener listener) {
        this.listener = listener;
    }

    public synchronized void start() {
        if (isRunning) return;
        isRunning = true;
        executor = Executors.newCachedThreadPool();

        executor.execute(this::runTunnelLoop);
    }

    public synchronized void stop() {
        isRunning = false;
        try {
            if (controlSocket != null && !controlSocket.isClosed()) {
                controlSocket.close();
            }
        } catch (Exception ignored) {}

        if (executor != null) {
            executor.shutdownNow();
        }
        notifyState("ডিসকানেক্টেড", null);
        Log.d(TAG, "Remote tunnel client stopped");
    }

    public boolean isRunning() {
        return isRunning;
    }

    private void runTunnelLoop() {
        int backoffMs = 2000;
        int failCount = 0;
        while (isRunning) {
            notifyState("কানেক্ট হচ্ছে (" + relayHost + ")...", null);
            try {
                controlSocket = new Socket();
                controlSocket.setTcpNoDelay(true);
                controlSocket.setKeepAlive(true);

                // Control socket can connect directly via current active internet
                controlSocket.connect(new InetSocketAddress(relayHost, relayPort), 7000);

                OutputStream out = controlSocket.getOutputStream();
                InputStream in = controlSocket.getInputStream();

                // Send Registration Handshake
                JSONObject reg = new JSONObject();
                reg.put("action", "REGISTER_NODE");
                reg.put("node_id", nodeId);
                reg.put("carrier", cellularBinder != null ? cellularBinder.getCarrierName() : "4G Mobile");
                reg.put("timestamp", System.currentTimeMillis());

                byte[] payload = (reg.toString() + "\n").getBytes(StandardCharsets.UTF_8);
                out.write(payload);
                out.flush();

                failCount = 0;
                String assignedAddr = relayHost + ":" + (relayPort + (Math.abs(nodeId.hashCode()) % 1000));
                notifyState("🟢 ক্লাউড টানেল সক্রিয়", assignedAddr);
                backoffMs = 2000; // reset backoff on success

                // Listen for tunnel connection requests from relay
                byte[] buf = new byte[8192];
                while (isRunning && !controlSocket.isClosed()) {
                    int read = in.read(buf);
                    if (read == -1) break;

                    String msg = new String(buf, 0, read, StandardCharsets.UTF_8);
                    if (msg.contains("PING")) {
                        out.write("PONG\n".getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    } else if (msg.contains("OPEN_STREAM")) {
                        executor.execute(() -> handleRemoteStreamRequest(msg));
                    }
                }
            } catch (Exception e) {
                if (!isRunning) break;
                failCount++;
                String errStatus = (failCount >= 2) ? "সার্ভার অফলাইন (" + relayHost + ":" + relayPort + ")" : "রি-কানেক্ট হচ্ছে...";
                notifyState(errStatus, null);
                Log.w(TAG, "Tunnel connection lost/failed: " + e.getMessage() + ", retry in " + backoffMs + "ms");
            } finally {
                safeClose(controlSocket);
            }

            if (isRunning) {
                try {
                    Thread.sleep(backoffMs);
                    backoffMs = Math.min(backoffMs * 2, 30000); // Exponential backoff up to 30s
                } catch (InterruptedException ignored) {
                    break;
                }
            }
        }
    }

    private void handleRemoteStreamRequest(String requestJson) {
        // Stream bridge for remote incoming requests
        try {
            JSONObject obj = new JSONObject(requestJson);
            String targetHost = obj.optString("host");
            int targetPort = obj.optInt("port", 443);
            String channelId = obj.optString("channel_id");

            if (targetHost == null || targetHost.isEmpty()) return;

            // Connect to target website via 4G Cellular data
            Socket destSocket = new Socket();
            destSocket.setTcpNoDelay(true);
            if (cellularBinder != null) {
                cellularBinder.bindSocket(destSocket);
            }
            destSocket.connect(new InetSocketAddress(targetHost, targetPort), 10000);

            // Connect dedicated stream channel back to relay
            Socket streamSocket = new Socket();
            streamSocket.setTcpNoDelay(true);
            streamSocket.connect(new InetSocketAddress(relayHost, relayPort), 10000);

            JSONObject streamAuth = new JSONObject();
            streamAuth.put("action", "ATTACH_CHANNEL");
            streamAuth.put("channel_id", channelId);
            streamSocket.getOutputStream().write((streamAuth.toString() + "\n").getBytes(StandardCharsets.UTF_8));
            streamSocket.getOutputStream().flush();

            // Bridge data between destSocket and streamSocket
            startStreamBridge(destSocket, streamSocket);
        } catch (Exception e) {
            Log.e(TAG, "Error handling remote stream: " + e.getMessage());
        }
    }

    private void startStreamBridge(Socket destSocket, Socket streamSocket) {
        stats.connectionOpened();
        byte[] b1 = new byte[16384];
        byte[] b2 = new byte[16384];

        executor.execute(() -> {
            try (InputStream in = destSocket.getInputStream();
                 OutputStream out = streamSocket.getOutputStream()) {
                int r;
                while ((r = in.read(b1)) != -1) {
                    out.write(b1, 0, r);
                    out.flush();
                    stats.addDownload(r);
                }
            } catch (Exception ignored) {
            } finally {
                safeClose(destSocket);
                safeClose(streamSocket);
                stats.connectionClosed();
            }
        });

        executor.execute(() -> {
            try (InputStream in = streamSocket.getInputStream();
                 OutputStream out = destSocket.getOutputStream()) {
                int r;
                while ((r = in.read(b2)) != -1) {
                    out.write(b2, 0, r);
                    out.flush();
                    stats.addUpload(r);
                }
            } catch (Exception ignored) {
            } finally {
                safeClose(streamSocket);
                safeClose(destSocket);
            }
        });
    }

    private void notifyState(String status, String assignedAddr) {
        if (listener != null) {
            mainHandler.post(() -> listener.onTunnelStateChanged(status, assignedAddr));
        }
    }

    private void safeClose(Socket s) {
        try {
            if (s != null && !s.isClosed()) s.close();
        } catch (Exception ignored) {}
    }
}
