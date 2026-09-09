package com.digonto.smsforwarder;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import android.widget.Toast;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class NotificationReceiverService extends NotificationListenerService {

    private static final String TAG = "NotifReceiverService";

    // Deduplication cache to prevent sending the same notification multiple times
    private static final Map<String, Long> recentOtpCache = new HashMap<>();

    // Word to digit mapping (English words in IVAC OTPs)
    private static final Map<String, String> WORD_TO_DIGIT = new HashMap<>();
    static {
        WORD_TO_DIGIT.put("zero", "0");
        WORD_TO_DIGIT.put("one", "1");
        WORD_TO_DIGIT.put("two", "2");
        WORD_TO_DIGIT.put("three", "3");
        WORD_TO_DIGIT.put("four", "4");
        WORD_TO_DIGIT.put("five", "5");
        WORD_TO_DIGIT.put("six", "6");
        WORD_TO_DIGIT.put("seven", "7");
        WORD_TO_DIGIT.put("eight", "8");
        WORD_TO_DIGIT.put("nine", "9");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null) return;

        // Target Mail and Messaging apps (Gmail, Outlook, Yahoo, Samsung Mail, etc.)
        boolean isMailApp = packageName.equals("com.google.android.gm") ||
                            packageName.contains("mail") ||
                            packageName.contains("outlook") ||
                            packageName.contains("yahoo") ||
                            packageName.contains("email") ||
                            packageName.contains("messaging");

        if (!isMailApp) return;

        Bundle extras = sbn.getNotification().extras;
        if (extras == null) return;

        String title = extras.getString(Notification.EXTRA_TITLE, "");
        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence subTextChar = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

        StringBuilder sb = new StringBuilder();
        if (title != null && !title.isEmpty()) sb.append(title).append(" ");
        if (subTextChar != null && subTextChar.length() > 0) sb.append(subTextChar).append(" ");
        if (textChar != null && textChar.length() > 0) sb.append(textChar).append(" ");
        if (bigTextChar != null && bigTextChar.length() > 0) sb.append(bigTextChar).append(" ");

        // Also check inbox lines if available (common in Gmail bundled notifications)
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (CharSequence line : lines) {
                if (line != null) sb.append(line).append(" ");
            }
        }

        String fullContent = sb.toString().trim();
        if (fullContent.isEmpty()) return;

        String contentLower = fullContent.toLowerCase();

        // Detect if this is an IVAC / Visa / Verification / Payment OTP
        boolean isIvac = contentLower.contains("ivac") ||
                         contentLower.contains("visa") ||
                         contentLower.contains("indian") ||
                         contentLower.contains("sequence when prompted") ||
                         contentLower.contains("verification code") ||
                         contentLower.contains("one time password") ||
                         contentLower.contains("otp");

        boolean isPayment = contentLower.contains("bkash") ||
                            contentLower.contains("rocket") ||
                            contentLower.contains("nagad");

        if (!isIvac && !isPayment) return;

        // Try to extract OTP
        String extractedOtp = extractOtp(fullContent);
        if (extractedOtp == null || extractedOtp.isEmpty()) {
            Log.d(TAG, "Relevant notification found but could not extract OTP: " + fullContent);
            return;
        }

        // Deduplication check: ignore if exact same OTP was processed in last 15 seconds
        long now = System.currentTimeMillis();
        synchronized (recentOtpCache) {
            cleanOldCache(now);
            if (recentOtpCache.containsKey(extractedOtp)) {
                long lastTime = recentOtpCache.get(extractedOtp);
                if (now - lastTime < 15000) {
                    Log.d(TAG, "Duplicate OTP ignored within 15s window: " + extractedOtp);
                    return;
                }
            }
            recentOtpCache.put(extractedOtp, now);
        }

        Log.i(TAG, "✅ Notification OTP Captured: " + extractedOtp + " from [" + packageName + "]");

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences("SMSConfig", Context.MODE_PRIVATE);

        String simName = "GMAIL";
        String customerEmail = prefs.getString("customer_email", "");
        String sender = (customerEmail != null && !customerEmail.isEmpty()) ? customerEmail : ((title != null && !title.isEmpty()) ? title : packageName);

        // Save to local SQLite database
        long logId = -1;
        try {
            logId = SmsLogDbHelper.getInstance(context).insertLog(
                    sender, fullContent, simName, SmsLog.STATUS_SENDING
            );
        } catch (Exception e) {
            Log.e(TAG, "DB insert error", e);
        }

        // Forward via MqttService
        if (MqttService.instance != null) {
            MqttService.instance.publishSms(logId, sender, fullContent, simName);
        } else {
            Log.w(TAG, "MqttService instance is null! Starting service...");
            try {
                Intent serviceIntent = new Intent(context, MqttService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error starting MqttService", e);
            }
        }

        // Toast feedback on UI thread
        final String otpDisplay = extractedOtp;
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Toast.makeText(context, "Gmail OTP Forwarded: " + otpDisplay, Toast.LENGTH_SHORT).show();
            } catch (Exception ignored) {}
        });
    }

    /**
     * Extracts 4 to 6 digit numeric OTP or word-based sequence (Nine-Zero-Six...).
     */
    public static String extractOtp(String text) {
        if (text == null || text.isEmpty()) return null;

        // 1. Check for IVAC word sequence (Nine-Zero-Six-Five-Two-Six)
        Pattern wordPattern = Pattern.compile("prompted\\s+([\\w\\-]+)", Pattern.CASE_INSENSITIVE);
        Matcher wordMatcher = wordPattern.matcher(text);
        if (wordMatcher.find()) {
            String seq = wordMatcher.group(1);
            String parsed = parseWordSequence(seq);
            if (parsed != null && parsed.length() >= 4) {
                return parsed;
            }
        }

        // 2. Check for standard 6-digit numeric OTP
        Pattern digitPattern6 = Pattern.compile("\\b(\\d{6})\\b");
        Matcher digitMatcher6 = digitPattern6.matcher(text);
        if (digitMatcher6.find()) {
            return digitMatcher6.group(1);
        }

        // 3. Check for 4-digit numeric OTP (common in payments/DGPay)
        Pattern digitPattern4 = Pattern.compile("\\b(\\d{4})\\b");
        Matcher digitMatcher4 = digitPattern4.matcher(text);
        if (digitMatcher4.find()) {
            return digitMatcher4.group(1);
        }

        return null;
    }

    private static String parseWordSequence(String sequence) {
        if (sequence == null) return null;
        String[] parts = sequence.split("-");
        StringBuilder digits = new StringBuilder();
        for (String part : parts) {
            String key = part.trim().toLowerCase();
            if (WORD_TO_DIGIT.containsKey(key)) {
                digits.append(WORD_TO_DIGIT.get(key));
            }
        }
        return digits.length() > 0 ? digits.toString() : null;
    }

    private static void cleanOldCache(long now) {
        recentOtpCache.entrySet().removeIf(entry -> (now - entry.getValue()) > 60000);
    }
}
