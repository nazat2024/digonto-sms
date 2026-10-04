package com.digonto.smsforwarder.proxy;

import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Ultra-fast, zero-MITM HTTP/HTTPS CONNECT Proxy Engine.
 * Supports raw bidirectional streaming with TCP_NODELAY and Cellular binding.
 */
public class HttpConnectEngine {
    private static final String TAG = "HttpConnectEngine";
    private static final int BUFFER_SIZE = 32768; // 32KB ultra-responsive buffer

    private final int port;
    private final CellularNetworkBinder cellularBinder;
    private final ProxyTrafficStats stats;

    private ServerSocket serverSocket;
    private ExecutorService threadPool;
    private volatile boolean isRunning = false;

    public HttpConnectEngine(int port, CellularNetworkBinder cellularBinder, ProxyTrafficStats stats) {
        this.port = port;
        this.cellularBinder = cellularBinder;
        this.stats = stats;
    }

    public synchronized void start() throws IOException {
        if (isRunning) return;

        serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress("0.0.0.0", port), 256);

        threadPool = Executors.newCachedThreadPool();
        isRunning = true;

        threadPool.execute(() -> {
            Log.d(TAG, "Proxy server listening on 0.0.0.0:" + port);
            while (isRunning && !serverSocket.isClosed()) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    clientSocket.setTcpNoDelay(true);
                    threadPool.execute(() -> handleClient(clientSocket));
                } catch (IOException e) {
                    if (!isRunning) break;
                    Log.w(TAG, "Server socket accept error: " + e.getMessage());
                }
            }
        });
    }

    public synchronized void stop() {
        isRunning = false;
        try {
            if (serverSocket != null && !serverSocket.isClosed()) {
                serverSocket.close();
            }
        } catch (Exception ignored) {}

        if (threadPool != null) {
            threadPool.shutdownNow();
        }
        Log.d(TAG, "Proxy engine stopped");
    }

    public boolean isRunning() {
        return isRunning && serverSocket != null && !serverSocket.isClosed();
    }

    private void handleClient(Socket clientSocket) {
        stats.connectionOpened();
        try {
            InputStream clientIn = clientSocket.getInputStream();
            OutputStream clientOut = clientSocket.getOutputStream();

            String initialLine = readLine(clientIn);
            if (initialLine == null || initialLine.trim().isEmpty()) {
                safeClose(clientSocket);
                stats.connectionClosed();
                return;
            }

            String[] parts = initialLine.split(" ");
            if (parts.length < 2) {
                safeClose(clientSocket);
                stats.connectionClosed();
                return;
            }

            String method = parts[0].toUpperCase();
            String uri = parts[1];

            if ("CONNECT".equals(method)) {
                // HTTPS Tunneling
                handleHttpsConnect(clientSocket, clientIn, clientOut, uri);
            } else {
                // Plain HTTP Forwarding
                handlePlainHttp(clientSocket, clientIn, clientOut, initialLine, uri);
            }
        } catch (Exception e) {
            Log.d(TAG, "Client handle exception: " + e.getMessage());
            safeClose(clientSocket);
            stats.connectionClosed();
        }
    }

    private void handleHttpsConnect(Socket clientSocket, InputStream clientIn, OutputStream clientOut, String uri) throws IOException {
        String targetHost;
        int targetPort = 443;

        int colonIdx = uri.indexOf(':');
        if (colonIdx != -1) {
            targetHost = uri.substring(0, colonIdx);
            try {
                targetPort = Integer.parseInt(uri.substring(colonIdx + 1));
            } catch (NumberFormatException ignored) {}
        } else {
            targetHost = uri;
        }

        // Consume all remaining headers until empty line
        String header;
        while ((header = readLine(clientIn)) != null && !header.isEmpty()) {}

        // Connect outbound socket to target
        Socket targetSocket = new Socket();
        targetSocket.setTcpNoDelay(true);

        // Bind outbound socket strictly to 4G Cellular data interface!
        if (cellularBinder != null) {
            cellularBinder.bindSocket(targetSocket);
        }

        try {
            targetSocket.connect(new InetSocketAddress(targetHost, targetPort), 10000);
        } catch (IOException e) {
            clientOut.write("HTTP/1.1 502 Bad Gateway\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
            clientOut.flush();
            safeClose(clientSocket);
            stats.connectionClosed();
            return;
        }

        // Send 200 Connection Established to Chrome
        clientOut.write("HTTP/1.1 200 Connection Established\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
        clientOut.flush();

        // Start bidirectional transparent stream pipe
        startBidirectionalPipe(clientSocket, targetSocket);
    }

    private void handlePlainHttp(Socket clientSocket, InputStream clientIn, OutputStream clientOut, String initialLine, String uri) throws IOException {
        String targetHost = "";
        int targetPort = 80;

        ByteArrayOutputStream headerBuf = new ByteArrayOutputStream();
        headerBuf.write((initialLine + "\r\n").getBytes(StandardCharsets.US_ASCII));

        String header;
        while ((header = readLine(clientIn)) != null && !header.isEmpty()) {
            headerBuf.write((header + "\r\n").getBytes(StandardCharsets.US_ASCII));
            if (header.toLowerCase().startsWith("host:")) {
                String hostVal = header.substring(5).trim();
                int cIdx = hostVal.indexOf(':');
                if (cIdx != -1) {
                    targetHost = hostVal.substring(0, cIdx);
                    try {
                        targetPort = Integer.parseInt(hostVal.substring(cIdx + 1));
                    } catch (NumberFormatException ignored) {}
                } else {
                    targetHost = hostVal;
                }
            }
        }
        headerBuf.write("\r\n".getBytes(StandardCharsets.US_ASCII));

        if (targetHost.isEmpty()) {
            safeClose(clientSocket);
            stats.connectionClosed();
            return;
        }

        Socket targetSocket = new Socket();
        targetSocket.setTcpNoDelay(true);

        if (cellularBinder != null) {
            cellularBinder.bindSocket(targetSocket);
        }

        try {
            targetSocket.connect(new InetSocketAddress(targetHost, targetPort), 10000);
        } catch (IOException e) {
            clientOut.write("HTTP/1.1 502 Bad Gateway\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
            clientOut.flush();
            safeClose(clientSocket);
            stats.connectionClosed();
            return;
        }

        OutputStream targetOut = targetSocket.getOutputStream();
        byte[] headers = headerBuf.toByteArray();
        targetOut.write(headers);
        targetOut.flush();
        stats.addUpload(headers.length);

        startBidirectionalPipe(clientSocket, targetSocket);
    }

    private void startBidirectionalPipe(Socket clientSocket, Socket targetSocket) {
        // Upstream thread: Client -> Target
        Thread upstream = new Thread(() -> {
            byte[] buf = new byte[BUFFER_SIZE];
            try (InputStream in = clientSocket.getInputStream();
                 OutputStream out = targetSocket.getOutputStream()) {
                int read;
                while ((read = in.read(buf)) != -1) {
                    out.write(buf, 0, read);
                    out.flush();
                    stats.addUpload(read);
                }
            } catch (Exception ignored) {
            } finally {
                safeClose(targetSocket);
                safeClose(clientSocket);
            }
        });

        // Downstream thread: Target -> Client
        Thread downstream = new Thread(() -> {
            byte[] buf = new byte[BUFFER_SIZE];
            try (InputStream in = targetSocket.getInputStream();
                 OutputStream out = clientSocket.getOutputStream()) {
                int read;
                while ((read = in.read(buf)) != -1) {
                    out.write(buf, 0, read);
                    out.flush();
                    stats.addDownload(read);
                }
            } catch (Exception ignored) {
            } finally {
                safeClose(clientSocket);
                safeClose(targetSocket);
                stats.connectionClosed();
            }
        });

        upstream.start();
        downstream.start();
    }

    private String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\n') break;
            if (b != '\r') {
                sb.append((char) b);
            }
        }
        return sb.length() == 0 && b == -1 ? null : sb.toString();
    }

    private void safeClose(Socket s) {
        try {
            if (s != null && !s.isClosed()) {
                s.close();
            }
        } catch (Exception ignored) {}
    }
}
