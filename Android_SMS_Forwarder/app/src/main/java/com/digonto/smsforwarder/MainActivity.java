package com.digonto.smsforwarder;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.textfield.TextInputEditText;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private TextInputEditText pairingCodeInput, sim1Input, sim2Input;
    private TextView tvSim1Operator, tvSim2Operator;
    private Button btnAddDesktop, btnAddAnotherDesktop, btnSaveSim, btnAutoDetectSim, btnHistory;
    private TextView btnCancelAddDesktop, tvDesktopCount;
    private LinearLayout layoutPairingInputBox;
    private ChipGroup chipGroupDesktops;
    private TextView statusText;
    private ImageView statusIcon;
    private SharedPreferences prefs;

    private boolean isSimLocked = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Permissions check fallback
        if (!hasAllPermissions()) {
            startActivity(new Intent(this, PermissionsActivity.class));
            finish();
            return;
        }
        
        setContentView(R.layout.activity_main);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#F8FAFC"));
        }

        prefs = getSharedPreferences("SMSConfig", MODE_PRIVATE);

        pairingCodeInput = findViewById(R.id.pairingCodeInput);
        sim1Input = findViewById(R.id.sim1Input);
        sim2Input = findViewById(R.id.sim2Input);
        tvSim1Operator = findViewById(R.id.tvSim1Operator);
        tvSim2Operator = findViewById(R.id.tvSim2Operator);
        btnAddDesktop = findViewById(R.id.btnAddDesktop);
        btnAddAnotherDesktop = findViewById(R.id.btnAddAnotherDesktop);
        btnCancelAddDesktop = findViewById(R.id.btnCancelAddDesktop);
        tvDesktopCount = findViewById(R.id.tvDesktopCount);
        layoutPairingInputBox = findViewById(R.id.layoutPairingInputBox);
        btnSaveSim = findViewById(R.id.btnSaveSim);
        btnAutoDetectSim = findViewById(R.id.btnAutoDetectSim);
        btnHistory = findViewById(R.id.btnHistory);
        chipGroupDesktops = findViewById(R.id.chipGroupDesktops);
        
        statusText = findViewById(R.id.statusText);
        statusIcon = findViewById(R.id.statusIcon);

        // History Button Click Listener
        btnHistory.setOnClickListener(v -> {
            startActivity(new Intent(MainActivity.this, HistoryActivity.class));
        });

        // "+ Add Another Desktop" click
        btnAddAnotherDesktop.setOnClickListener(v -> {
            layoutPairingInputBox.setVisibility(View.VISIBLE);
            btnAddAnotherDesktop.setVisibility(View.GONE);
            btnCancelAddDesktop.setVisibility(View.VISIBLE);
            pairingCodeInput.requestFocus();
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.showSoftInput(pairingCodeInput, InputMethodManager.SHOW_IMPLICIT);
            }
        });

        // "Cancel" click
        btnCancelAddDesktop.setOnClickListener(v -> {
            layoutPairingInputBox.setVisibility(View.GONE);
            btnAddAnotherDesktop.setVisibility(View.VISIBLE);
            pairingCodeInput.setText("");
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.hideSoftInputFromWindow(pairingCodeInput.getWindowToken(), 0);
            }
        });

        // Load saved SIM info
        String savedSim1 = prefs.getString("sim1_name", "");
        String savedSim2 = prefs.getString("sim2_name", "");
        String savedOp1 = prefs.getString("sim1_operator", "");
        String savedOp2 = prefs.getString("sim2_operator", "");

        // Auto-migration: if savedSim1 was an operator name rather than a phone number
        if (!savedSim1.isEmpty() && !isPhoneNumber(savedSim1)) {
            if (savedOp1.isEmpty()) savedOp1 = savedSim1;
            savedSim1 = ""; // clear input so ghost hint 019XXXXXXXX shows!
        }
        if (!savedSim2.isEmpty() && !isPhoneNumber(savedSim2)) {
            if (savedOp2.isEmpty()) savedOp2 = savedSim2;
            savedSim2 = ""; // clear input so ghost hint 017XXXXXXXX shows!
        }

        sim1Input.setText(savedSim1);
        sim2Input.setText(savedSim2);

        if (!savedOp1.isEmpty()) {
            tvSim1Operator.setText("📶 " + savedOp1);
            updateSimHint(sim1Input, savedOp1);
        }
        if (!savedOp2.isEmpty()) {
            tvSim2Operator.setText("📶 " + savedOp2);
            updateSimHint(sim2Input, savedOp2);
        }

        // If either has a real saved phone number, lock them. Otherwise unlock so user can type directly!
        if (!savedSim1.isEmpty() || !savedSim2.isEmpty()) {
            lockSimInputs();
        } else {
            unlockSimInputs();
            // Auto detect carrier operators on startup if not yet detected
            if (savedOp1.isEmpty() && savedOp2.isEmpty()) {
                autoDetectSims(false);
            }
        }

        // Manual Auto Detect Button Click
        btnAutoDetectSim.setOnClickListener(v -> {
            autoDetectSims(true);
        });

        btnSaveSim.setOnClickListener(v -> {
            if (isSimLocked) {
                unlockSimInputs();
            } else {
                String num1 = sim1Input.getText() != null ? sim1Input.getText().toString().trim() : "";
                String num2 = sim2Input.getText() != null ? sim2Input.getText().toString().trim() : "";

                String op1 = prefs.getString("sim1_operator", "Banglalink");
                String op2 = prefs.getString("sim2_operator", "Grameenphone");

                // If user entered number, use it as sim name. Otherwise fallback to operator name for MQTT/SMS
                String name1 = !num1.isEmpty() ? num1 : op1;
                String name2 = !num2.isEmpty() ? num2 : op2;

                prefs.edit()
                    .putString("sim1_number", num1)
                    .putString("sim2_number", num2)
                    .putString("sim1_name", name1)
                    .putString("sim2_name", name2)
                    .apply();

                Toast.makeText(this, "SIM Numbers Saved!", Toast.LENGTH_SHORT).show();
                lockSimInputs();
            }
        });
        
        loadChips();
        updateStatusUI();

        // Check connection status periodically
        Handler statusHandler = new Handler(android.os.Looper.getMainLooper());
        statusHandler.post(new Runnable() {
            @Override
            public void run() {
                updateConnectionStatusLive();
                statusHandler.postDelayed(this, 1000);
            }
        });

        btnAddDesktop.setOnClickListener(v -> {
            String code = pairingCodeInput.getText().toString().trim();
            if (code.length() < 6) {
                Toast.makeText(this, "Please enter a valid 6-digit code", Toast.LENGTH_SHORT).show();
                return;
            }
            Set<String> codes = new HashSet<>(prefs.getStringSet("pairing_codes", new HashSet<>()));
            if (codes.contains(code)) {
                Toast.makeText(this, "Code already added", Toast.LENGTH_SHORT).show();
                return;
            }
            codes.add(code);
            prefs.edit().putStringSet("pairing_codes", codes).apply();
            
            // For backwards compatibility
            prefs.edit().putString("pairing_code", code).apply();
            
            pairingCodeInput.setText("");
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.hideSoftInputFromWindow(pairingCodeInput.getWindowToken(), 0);
            }
            
            loadChips();
            Toast.makeText(this, "Desktop added successfully!", Toast.LENGTH_SHORT).show();
            updateStatusUI();
            startMqttService();
        });
    }

    /**
     * Auto detects SIM carrier names and phone numbers from the device hardware.
     */
    private void autoDetectSims(boolean showToast) {
        try {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                if (showToast) Toast.makeText(this, "Permission required to read SIM details", Toast.LENGTH_SHORT).show();
                return;
            }

            SubscriptionManager sm = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (sm == null) {
                if (showToast) Toast.makeText(this, "SubscriptionManager unavailable", Toast.LENGTH_SHORT).show();
                return;
            }

            List<SubscriptionInfo> subList = sm.getActiveSubscriptionInfoList();
            if (subList == null || subList.isEmpty()) {
                if (showToast) Toast.makeText(this, "No active SIM cards detected", Toast.LENGTH_SHORT).show();
                return;
            }

            String detectedOp1 = "";
            String detectedOp2 = "";
            String detectedNum1 = "";
            String detectedNum2 = "";

            for (SubscriptionInfo info : subList) {
                int slot = info.getSimSlotIndex();
                String number = "";

                // Android 13+ (Tiramisu) specific phone number getter
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    try {
                        number = sm.getPhoneNumber(info.getSubscriptionId());
                    } catch (Exception ignored) {}
                }

                if (number == null || number.isEmpty()) {
                    try {
                        number = info.getNumber();
                    } catch (Exception ignored) {}
                }

                CharSequence carrier = info.getCarrierName();
                CharSequence displayName = info.getDisplayName();
                String opName = "";
                if (carrier != null && !carrier.toString().trim().isEmpty()) {
                    opName = carrier.toString().trim();
                } else if (displayName != null && !displayName.toString().trim().isEmpty()) {
                    opName = displayName.toString().trim();
                } else {
                    opName = "SIM " + (slot + 1);
                }

                if (slot == 0) {
                    detectedOp1 = opName;
                    if (number != null && isPhoneNumber(number)) {
                        detectedNum1 = formatBDNumber(number);
                    }
                } else if (slot == 1) {
                    detectedOp2 = opName;
                    if (number != null && isPhoneNumber(number)) {
                        detectedNum2 = formatBDNumber(number);
                    }
                }
            }

            SharedPreferences.Editor editor = prefs.edit();
            boolean updated = false;

            if (!detectedOp1.isEmpty()) {
                tvSim1Operator.setText("📶 " + detectedOp1);
                updateSimHint(sim1Input, detectedOp1);
                editor.putString("sim1_operator", detectedOp1);
                updated = true;

                // Only setText if hardware returned an actual phone number
                if (!detectedNum1.isEmpty()) {
                    sim1Input.setText(detectedNum1);
                    editor.putString("sim1_name", detectedNum1);
                } else if (sim1Input.getText() == null || sim1Input.getText().toString().trim().isEmpty()) {
                    // Box stays empty with ghost hint 019XXXXXXXX
                    editor.putString("sim1_name", detectedOp1);
                }
            }

            if (!detectedOp2.isEmpty()) {
                tvSim2Operator.setText("📶 " + detectedOp2);
                updateSimHint(sim2Input, detectedOp2);
                editor.putString("sim2_operator", detectedOp2);
                updated = true;

                // Only setText if hardware returned an actual phone number
                if (!detectedNum2.isEmpty()) {
                    sim2Input.setText(detectedNum2);
                    editor.putString("sim2_name", detectedNum2);
                } else if (sim2Input.getText() == null || sim2Input.getText().toString().trim().isEmpty()) {
                    // Box stays empty with ghost hint 017XXXXXXXX
                    editor.putString("sim2_name", detectedOp2);
                }
            }

            if (updated) {
                editor.apply();
                if (showToast) {
                    Toast.makeText(this, "Operators detected!", Toast.LENGTH_SHORT).show();
                }
                if (MqttService.instance != null) {
                    MqttService.instance.sendSinglePing();
                }
            } else {
                if (showToast) {
                    Toast.makeText(this, "Could not determine SIM details", Toast.LENGTH_SHORT).show();
                }
            }
        } catch (Exception e) {
            if (showToast) {
                Toast.makeText(this, "Error detecting SIMs: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void lockSimInputs() {
        isSimLocked = true;
        sim1Input.setEnabled(false);
        sim2Input.setEnabled(false);
        btnSaveSim.setText("EDIT");
        btnSaveSim.setTextColor(android.graphics.Color.parseColor("#0284C7"));
        if (MqttService.instance != null) {
            MqttService.instance.sendSinglePing();
        }
    }

    private void unlockSimInputs() {
        isSimLocked = false;
        sim1Input.setEnabled(true);
        sim2Input.setEnabled(true);
        btnSaveSim.setText("SAVE");
        btnSaveSim.setTextColor(android.graphics.Color.parseColor("#10B981"));
    }

    private boolean isPhoneNumber(String text) {
        if (text == null) return false;
        String clean = text.replaceAll("[\\s\\-\\(\\)]", "");
        return clean.matches("^(\\+?88)?01[3-9]\\d{8}$");
    }

    private String formatBDNumber(String number) {
        if (number == null) return "";
        String clean = number.replaceAll("[^0-9]", "");
        if (clean.startsWith("8801") && clean.length() == 13) {
            return clean.substring(2);
        }
        if (clean.startsWith("01") && clean.length() == 11) {
            return clean;
        }
        return number.trim();
    }

    private void updateSimHint(TextInputEditText input, String operatorName) {
        if (input == null) return;
        if (operatorName == null || operatorName.trim().isEmpty()) {
            input.setHint("017XXXXXXXX");
            return;
        }
        String lower = operatorName.toLowerCase();
        if (lower.contains("banglalink")) {
            input.setHint("019XXXXXXXX");
        } else if (lower.contains("grameen") || lower.contains("gp")) {
            input.setHint("017XXXXXXXX");
        } else if (lower.contains("robi")) {
            input.setHint("018XXXXXXXX");
        } else if (lower.contains("airtel")) {
            input.setHint("016XXXXXXXX");
        } else if (lower.contains("teletalk")) {
            input.setHint("015XXXXXXXX");
        } else {
            input.setHint("017XXXXXXXX");
        }
    }

    private boolean hasAllPermissions() {
        boolean hasSms = androidx.core.content.ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        boolean hasPhone = androidx.core.content.ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        
        boolean hasBattery = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            hasBattery = pm.isIgnoringBatteryOptimizations(getPackageName());
        }
        
        boolean hasNotif = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasNotif = androidx.core.content.ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        
        return hasSms && hasPhone && hasBattery && hasNotif;
    }

    private void loadChips() {
        chipGroupDesktops.removeAllViews();
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
        
        // Handle migration from old single code to set
        String oldCode = prefs.getString("pairing_code", "");
        if (!oldCode.isEmpty() && codes.isEmpty()) {
            codes = new HashSet<>();
            codes.add(oldCode);
            prefs.edit().putStringSet("pairing_codes", codes).apply();
        }

        int count = codes.size();
        if (count == 0) {
            tvDesktopCount.setText("No Desktops");
            layoutPairingInputBox.setVisibility(View.VISIBLE);
            btnAddAnotherDesktop.setVisibility(View.GONE);
            btnCancelAddDesktop.setVisibility(View.GONE);
        } else {
            tvDesktopCount.setText(count + (count == 1 ? " Desktop" : " Desktops"));
            layoutPairingInputBox.setVisibility(View.GONE);
            btnAddAnotherDesktop.setVisibility(View.VISIBLE);
            btnCancelAddDesktop.setVisibility(View.GONE);
        }

        for (String code : codes) {
            Chip chip = new Chip(this);
            chip.setText("🖥️ Desktop: " + code);
            chip.setChipBackgroundColorResource(android.R.color.white);
            chip.setChipStrokeColor(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#E2E8F0")));
            chip.setChipStrokeWidth(2f);
            chip.setTextColor(android.graphics.Color.parseColor("#0F172A"));
            chip.setTextSize(13f);
            chip.setCloseIconVisible(true);
            chip.setCloseIconTint(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#EF4444")));
            chip.setOnCloseIconClickListener(v -> {
                Set<String> currentCodes = new HashSet<>(prefs.getStringSet("pairing_codes", new HashSet<>()));
                currentCodes.remove(code);
                prefs.edit().putStringSet("pairing_codes", currentCodes).apply();
                
                if (currentCodes.isEmpty()) {
                    prefs.edit().remove("pairing_code").apply();
                } else if (code.equals(prefs.getString("pairing_code", ""))) {
                    prefs.edit().putString("pairing_code", currentCodes.iterator().next()).apply();
                }
                
                loadChips();
                updateStatusUI();
                startMqttService();
            });
            chipGroupDesktops.addView(chip);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (hasAllPermissions()) {
            startMqttService();
            if (MqttService.instance != null) {
                MqttService.instance.sendSinglePing();
            }
        } else {
            startActivity(new Intent(this, PermissionsActivity.class));
            finish();
        }
    }

    private void updateStatusUI() {
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
        if (!codes.isEmpty()) {
            statusText.setText("Ready");
            statusText.setTextColor(0xFF0284C7); // Sky blue
            statusIcon.setColorFilter(0xFF0284C7);
        } else {
            statusText.setText("Offline");
            statusText.setTextColor(0xFFDC2626); // Red
            statusIcon.setColorFilter(0xFFDC2626);
        }
    }

    private void updateConnectionStatusLive() {
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
        if (codes.isEmpty()) {
            statusText.setText("Offline");
            statusText.setTextColor(0xFFDC2626);
            statusIcon.setColorFilter(0xFFDC2626);
            return;
        }
        
        if (MqttService.isConnectedToBroker) {
            int onlineCount = 0;
            for (String code : codes) {
                long lastPong = MqttService.lastPongReceivedTimes.containsKey(code) ? MqttService.lastPongReceivedTimes.get(code) : 0;
                long timeSinceLastPong = System.currentTimeMillis() - lastPong;
                if (timeSinceLastPong < 10000) {
                    onlineCount++;
                }
            }
            
            if (onlineCount == codes.size()) {
                statusText.setText("Live Sync (" + onlineCount + ")");
                statusText.setTextColor(0xFF10B981); // Emerald Green
                statusIcon.setColorFilter(0xFF10B981);
            } else if (onlineCount > 0) {
                statusText.setText("Partial (" + onlineCount + "/" + codes.size() + ")");
                statusText.setTextColor(0xFFF59E0B); // Amber
                statusIcon.setColorFilter(0xFFF59E0B);
            } else {
                statusText.setText("Waiting...");
                statusText.setTextColor(0xFF0284C7); // Blue
                statusIcon.setColorFilter(0xFF0284C7);
            }
        } else {
            statusText.setText("Connecting...");
            statusText.setTextColor(0xFFDC2626); // Red
            statusIcon.setColorFilter(0xFFDC2626);
        }
    }

    private void startMqttService() {
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
        if (!codes.isEmpty()) {
            Intent serviceIntent = new Intent(this, MqttService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } else {
            Intent serviceIntent = new Intent(this, MqttService.class);
            stopService(serviceIntent);
        }
    }
}