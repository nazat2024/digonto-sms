package com.digonto.smsforwarder;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.textfield.TextInputEditText;

import java.util.HashSet;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private TextInputEditText pairingCodeInput, sim1Input, sim2Input;
    private Button btnAddDesktop, btnAddAnotherDesktop, btnSaveSim, btnHistory;
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
        btnAddDesktop = findViewById(R.id.btnAddDesktop);
        btnAddAnotherDesktop = findViewById(R.id.btnAddAnotherDesktop);
        btnCancelAddDesktop = findViewById(R.id.btnCancelAddDesktop);
        tvDesktopCount = findViewById(R.id.tvDesktopCount);
        layoutPairingInputBox = findViewById(R.id.layoutPairingInputBox);
        btnSaveSim = findViewById(R.id.btnSaveSim);
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

        // Load saved SIM names and lock if they exist
        String savedSim1 = prefs.getString("sim1_name", "");
        String savedSim2 = prefs.getString("sim2_name", "");
        sim1Input.setText(savedSim1);
        sim2Input.setText(savedSim2);
        
        if (!savedSim1.isEmpty() || !savedSim2.isEmpty()) {
            lockSimInputs();
        } else {
            unlockSimInputs();
        }

        btnSaveSim.setOnClickListener(v -> {
            if (isSimLocked) {
                unlockSimInputs();
            } else {
                prefs.edit()
                    .putString("sim1_name", sim1Input.getText().toString().trim())
                    .putString("sim2_name", sim2Input.getText().toString().trim())
                    .apply();
                Toast.makeText(this, "SIM Names Saved!", Toast.LENGTH_SHORT).show();
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

    private void lockSimInputs() {
        isSimLocked = true;
        sim1Input.setEnabled(false);
        sim2Input.setEnabled(false);
        btnSaveSim.setText("EDIT");
        btnSaveSim.setTextColor(android.graphics.Color.parseColor("#0284C7"));
    }

    private void unlockSimInputs() {
        isSimLocked = false;
        sim1Input.setEnabled(true);
        sim2Input.setEnabled(true);
        sim1Input.requestFocus();
        btnSaveSim.setText("SAVE");
        btnSaveSim.setTextColor(android.graphics.Color.parseColor("#10B981"));
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