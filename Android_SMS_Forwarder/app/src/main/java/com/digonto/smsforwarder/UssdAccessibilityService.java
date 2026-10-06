package com.digonto.smsforwarder;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UssdAccessibilityService extends AccessibilityService {
    public static final String ACTION_SIM_AUTO_DETECTED = "com.digonto.smsforwarder.ACTION_SIM_AUTO_DETECTED";
    public static final String EXTRA_SLOT = "slot";
    public static final String EXTRA_NUMBER = "number";

    private long lastProcessedTime = 0;
    private String lastDetectedNumber = "";

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        int eventType = event.getEventType();
        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            return;
        }

        List<String> texts = new ArrayList<>();

        // 1. Collect event text
        if (event.getText() != null) {
            for (CharSequence cs : event.getText()) {
                if (cs != null && cs.length() > 0) {
                    texts.add(cs.toString());
                }
            }
        }

        // 2. Scan window hierarchy
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            collectAllNodeTexts(root, texts);
        }

        if (texts.isEmpty()) return;

        // Combine and inspect texts for USSD phone number responses
        for (String rawText : texts) {
            String text = convertBengaliToEnglishDigits(rawText);

            // Pattern specifically matching BD mobile numbers, especially with prefixes like "Your Cirkle mobile no is 8801604686192"
            Matcher matcher = Pattern.compile("(?:(?:mobile\\s*no(?:\\s*is)?|number(?:\\s*is)?|msisdn[:\\s]*|cirkle)\\s*(?:88)?)?(?:88)?(01[3-9]\\d{8})", Pattern.CASE_INSENSITIVE).matcher(text);
            if (!matcher.find()) {
                matcher = Pattern.compile("(?:88)?(01[3-9]\\d{8})").matcher(text);
                if (!matcher.find()) {
                    continue;
                }
            }

            String found = matcher.group(1);
            if (found == null || found.length() != 11 || !found.startsWith("01")) {
                continue;
            }

            // Prevent rapid re-processing within 2.5 seconds for the same number
            long now = System.currentTimeMillis();
            if (found.equals(lastDetectedNumber) && (now - lastProcessedTime < 2500)) {
                return;
            }

            lastProcessedTime = now;
            lastDetectedNumber = found;

            handleDetectedNumber(found, root);
            break;
        }
    }

    private void handleDetectedNumber(String detectedNumber, AccessibilityNodeInfo root) {
        SharedPreferences prefs = getSharedPreferences("SMSConfig", Context.MODE_PRIVATE);

        // Determine target slot
        int targetSlot = prefs.getInt("pending_ussd_slot", -1);
        if (targetSlot == -1) {
            String op1 = prefs.getString("sim1_operator", "").toLowerCase();
            String op2 = prefs.getString("sim2_operator", "").toLowerCase();

            if (detectedNumber.startsWith("016")) { // Airtel
                targetSlot = op2.contains("airtel") ? 1 : (op1.contains("airtel") ? 0 : 1);
            } else if (detectedNumber.startsWith("018")) { // Robi
                targetSlot = op2.contains("robi") ? 1 : (op1.contains("robi") ? 0 : 1);
            } else if (detectedNumber.startsWith("017") || detectedNumber.startsWith("013")) { // GP
                targetSlot = op1.contains("gp") || op1.contains("grameen") ? 0 : (op2.contains("gp") || op2.contains("grameen") ? 1 : 0);
            } else if (detectedNumber.startsWith("019") || detectedNumber.startsWith("014")) { // Banglalink
                targetSlot = op1.contains("banglalink") || op1.contains("bl") ? 0 : (op2.contains("banglalink") || op2.contains("bl") ? 1 : 0);
            } else {
                targetSlot = 1;
            }
        }

        // Save immediately into SharedPreferences
        String keyNumber = (targetSlot == 0) ? "sim1_number" : "sim2_number";
        String keyName = (targetSlot == 0) ? "sim1_name" : "sim2_name";
        prefs.edit()
                .putString(keyNumber, detectedNumber)
                .putString(keyName, detectedNumber)
                .remove("pending_ussd_slot")
                .apply();

        // Automatically dismiss the USSD popup dialog
        dismissUssdDialog(root);

        // Broadcast to MainActivity
        Intent intent = new Intent(ACTION_SIM_AUTO_DETECTED);
        intent.setPackage(getPackageName());
        intent.putExtra(EXTRA_SLOT, targetSlot);
        intent.putExtra(EXTRA_NUMBER, detectedNumber);
        sendBroadcast(intent);

        // Bring MainActivity back to foreground
        final int slotFinal = targetSlot;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                Intent launch = new Intent(this, MainActivity.class);
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(launch);
                Toast.makeText(this, "🎉 SIM " + (slotFinal + 1) + " অটো-ডিটেক্ট সম্পন্ন: " + detectedNumber, Toast.LENGTH_LONG).show();
            } catch (Exception ignored) {}
        }, 200);

        // Instantly trigger MQTT sync ping
        if (MqttService.instance != null) {
            MqttService.instance.sendSinglePing();
        }
    }

    private void dismissUssdDialog(AccessibilityNodeInfo root) {
        if (root == null) {
            performGlobalAction(GLOBAL_ACTION_BACK);
            return;
        }

        // Try clicking CANCEL / Cancel / বাতিল / OK / ঠিক আছে / Close
        boolean clicked = clickButtonWithText(root, "cancel", "বাতিল", "ok", "ঠিক আছে", "close", "বন্ধ");
        if (!clicked) {
            performGlobalAction(GLOBAL_ACTION_BACK);
        }
    }

    private boolean clickButtonWithText(AccessibilityNodeInfo node, String... keywords) {
        if (node == null) return false;
        if (node.isClickable() && node.getText() != null) {
            String text = node.getText().toString().trim().toLowerCase();
            for (String kw : keywords) {
                if (text.equalsIgnoreCase(kw) || text.contains(kw)) {
                    node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    return true;
                }
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            if (clickButtonWithText(node.getChild(i), keywords)) {
                return true;
            }
        }
        return false;
    }

    private void collectAllNodeTexts(AccessibilityNodeInfo node, List<String> texts) {
        if (node == null) return;
        if (node.getText() != null && node.getText().length() > 0) {
            texts.add(node.getText().toString());
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            collectAllNodeTexts(node.getChild(i), texts);
        }
    }

    private String convertBengaliToEnglishDigits(String str) {
        if (str == null) return "";
        return str.replace('০', '0')
                  .replace('১', '1')
                  .replace('২', '2')
                  .replace('৩', '3')
                  .replace('৪', '4')
                  .replace('৫', '5')
                  .replace('৬', '6')
                  .replace('৭', '7')
                  .replace('৮', '8')
                  .replace('৯', '9');
    }

    @Override
    public void onInterrupt() {}
}
