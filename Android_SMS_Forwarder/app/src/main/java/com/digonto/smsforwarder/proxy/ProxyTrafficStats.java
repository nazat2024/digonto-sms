package com.digonto.smsforwarder.proxy;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe live traffic and connection tracker for the proxy engine.
 */
public class ProxyTrafficStats {
    private final AtomicLong totalBytesDownloaded = new AtomicLong(0);
    private final AtomicLong totalBytesUploaded = new AtomicLong(0);
    private final AtomicInteger activeConnections = new AtomicInteger(0);
    private final AtomicLong totalConnectionsCount = new AtomicLong(0);

    private long lastDownloadMark = 0;
    private long lastUploadMark = 0;
    private long lastTimeMark = System.currentTimeMillis();

    private double currentDownloadSpeedBps = 0;
    private double currentUploadSpeedBps = 0;

    public void addDownload(long bytes) {
        if (bytes > 0) {
            totalBytesDownloaded.addAndGet(bytes);
        }
    }

    public void addUpload(long bytes) {
        if (bytes > 0) {
            totalBytesUploaded.addAndGet(bytes);
        }
    }

    public void connectionOpened() {
        activeConnections.incrementAndGet();
        totalConnectionsCount.incrementAndGet();
    }

    public void connectionClosed() {
        activeConnections.decrementAndGet();
        if (activeConnections.get() < 0) {
            activeConnections.set(0);
        }
    }

    public synchronized void updateSpeeds() {
        long now = System.currentTimeMillis();
        long elapsedMs = now - lastTimeMark;
        if (elapsedMs >= 1000) {
            long currentDown = totalBytesDownloaded.get();
            long currentUp = totalBytesUploaded.get();

            long downDiff = currentDown - lastDownloadMark;
            long upDiff = currentUp - lastUploadMark;

            currentDownloadSpeedBps = (downDiff * 1000.0) / elapsedMs;
            currentUploadSpeedBps = (upDiff * 1000.0) / elapsedMs;

            lastDownloadMark = currentDown;
            lastUploadMark = currentUp;
            lastTimeMark = now;
        }
    }

    public int getActiveConnections() {
        return Math.max(0, activeConnections.get());
    }

    public long getTotalConnectionsCount() {
        return totalConnectionsCount.get();
    }

    public long getTotalBytesDownloaded() {
        return totalBytesDownloaded.get();
    }

    public long getTotalBytesUploaded() {
        return totalBytesUploaded.get();
    }

    public double getCurrentDownloadSpeedBps() {
        return currentDownloadSpeedBps;
    }

    public double getCurrentUploadSpeedBps() {
        return currentUploadSpeedBps;
    }

    public static String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        String pre = "KMGTPE".charAt(exp - 1) + "";
        return String.format(Locale.US, "%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }

    public static String formatSpeed(double bytesPerSec) {
        if (bytesPerSec < 1024) return String.format(Locale.US, "%.0f B/s", bytesPerSec);
        if (bytesPerSec < 1024 * 1024) return String.format(Locale.US, "%.1f KB/s", bytesPerSec / 1024.0);
        return String.format(Locale.US, "%.1f MB/s", bytesPerSec / (1024.0 * 1024.0));
    }

    public synchronized void reset() {
        totalBytesDownloaded.set(0);
        totalBytesUploaded.set(0);
        activeConnections.set(0);
        totalConnectionsCount.set(0);
        lastDownloadMark = 0;
        lastUploadMark = 0;
        lastTimeMark = System.currentTimeMillis();
        currentDownloadSpeedBps = 0;
        currentUploadSpeedBps = 0;
    }
}
