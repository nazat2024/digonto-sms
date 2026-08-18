package com.digonto.smsforwarder;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.switchmaterial.SwitchMaterial;
import com.google.android.material.textfield.TextInputEditText;

import java.util.HashSet;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private TextInputEditText pairingCodeInput, sim1Input, sim2Input;
    private Button btnAddDesktop, btnSaveSim, btnHistory;
    private ChipGroup chipGroupDesktops;
    private SwitchMaterial switchSms, switchPhone, switchBattery, switchNotification;
    private TextView statusText;
    private ImageView statusIcon;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences("SMSConfig", MODE_PRIVATE);

        pairingCodeInput = findViewById(R.id.pairingCodeInput);
        sim1Input = findViewById(R.id.sim1Input);
        sim2Input = findViewById(R.id.sim2Input);
        btnAddDesktop = findViewById(R.id.btnAddDesktop);
        btnSaveSim = findViewById(R.id.btnSaveSim);
        btnHistory = findViewById(R.id.btnHistory);
        chipGroupDesktops = findViewById(R.id.chipGroupDesktops);

        // History Button Click Listener
        btnHistory.setOnClickListener(v -> {
            startActivity(new Intent(MainActivity.this, HistoryActivity.class));
        });
        
        switchSms = findViewById(R.id.switchSms);
        switchPhone = findViewById(R.id.switchPhone);
        switchBattery = findViewById(R.id.switchBattery);
        switchNotification = findViewById(R.id.switchNotification);
        
        statusText = findViewById(R.id.statusText);
        statusIcon = findViewById(R.id.statusIcon);

        // Load saved data
        sim1Input.setText(prefs.getString("sim1_name", ""));
        sim2Input.setText(prefs.getString("sim2_name", ""));
        
        loadChips();
        updateStatusUI();

        // Start checking connection status periodically
        Handler statusHandler = new Handler(android.os.Looper.getMainLooper());
        statusHandler.post(new Runnable() {
            @Override
            public void run() {
                updateConnectionStatusLive();
                statusHandler.postDelayed(this, 1000); // Check every second
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
            
            // For backwards compatibility (if needed by other parts temporarily)
            prefs.edit().putString("pairing_code", code).apply();
            
            pairingCodeInput.setText("");
            loadChips();
            Toast.makeText(this, "Desktop added! Restarting service...", Toast.LENGTH_SHORT).show();
            updateStatusUI();
            startMqttService();
        });

        btnSaveSim.setOnClickListener(v -> {
            prefs.edit()
                .putString("sim1_name", sim1Input.getText().toString().trim())
                .putString("sim2_name", sim2Input.getText().toString().trim())
                .apply();
            Toast.makeText(this, "SIM Names Saved!", Toast.LENGTH_SHORT).show();
        });

        setupPermissionSwitches();
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

        for (String code : codes) {
            Chip chip = new Chip(this);
            chip.setText("Desktop: " + code);
            chip.setCloseIconVisible(true);
            chip.setOnCloseIconClickListener(v -> {
                Set<String> currentCodes = new HashSet<>(prefs.getStringSet("pairing_codes", new HashSet<>()));
                currentCodes.remove(code);
                prefs.edit().putStringSet("pairing_codes", currentCodes).apply();
                
                // If we removed the last one, also clear the legacy key
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
        checkPermissionsAndUpdateSwitches();
        startMqttService(); // Ensure service is running
    }

    private void setupPermissionSwitches() {
        switchSms.setOnClickListener(v -> {
            if (switchSms.isChecked()) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS}, 101);
            } else {
                Toast.makeText(this, "Cannot disable from here. Go to App Settings.", Toast.LENGTH_SHORT).show();
                switchSms.setChecked(true); // Revert
            }
        });

        switchPhone.setOnClickListener(v -> {
            if (switchPhone.isChecked()) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.READ_PHONE_STATE}, 102);
            } else {
                Toast.makeText(this, "Cannot disable from here. Go to App Settings.", Toast.LENGTH_SHORT).show();
                switchPhone.setChecked(true);
            }
        });

        switchBattery.setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent();
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            }
        });

        switchNotification.setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (switchNotification.isChecked()) {
                    ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 103);
                } else {
                    Toast.makeText(this, "Cannot disable from here. Go to App Settings.", Toast.LENGTH_SHORT).show();
                    switchNotification.setChecked(true);
                }
            } else {
                Toast.makeText(this, "Not required for your Android version", Toast.LENGTH_SHORT).show();
                switchNotification.setChecked(true);
            }
        });
    }

    private void checkPermissionsAndUpdateSwitches() {
        boolean hasSms = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        switchSms.setChecked(hasSms);

        boolean hasPhone = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        switchPhone.setChecked(hasPhone);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            switchBattery.setChecked(pm.isIgnoringBatteryOptimizations(getPackageName()));
        } else {
            switchBattery.setChecked(true);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean hasNotif = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            switchNotification.setChecked(hasNotif);
        } else {
            switchNotification.setChecked(true);
        }
    }

    private void updateStatusUI() {
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
        if (!codes.isEmpty()) {
            statusText.setText("Ready to Connect");
            statusText.setTextColor(0xFFF57F17); // Yellow/Orange
            statusIcon.setColorFilter(0xFFF57F17);
        } else {
            statusText.setText("Disconnected");
            statusText.setTextColor(0xFFD32F2F); // Red
            statusIcon.setColorFilter(0xFFD32F2F);
        }
    }

    private void updateConnectionStatusLive() {
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());
        if (codes.isEmpty()) {
            return;
        }
        
        if (MqttService.isConnectedToBroker) {
            long timeSinceLastPong = System.currentTimeMillis() - MqttService.lastPongReceivedTime;
            if (timeSinceLastPong < 10000) { // 10 seconds timeout for pong
                statusText.setText("Connected to Desktop (Online)");
                statusText.setTextColor(0xFF059669); // Green
                statusIcon.setColorFilter(0xFF059669);
            } else {
                statusText.setText("Waiting for Desktop...");
                statusText.setTextColor(0xFFF57F17); // Yellow
                statusIcon.setColorFilter(0xFFF57F17);
            }
        } else {
            statusText.setText("Connecting to Server...");
            statusText.setTextColor(0xFFD32F2F); // Red
            statusIcon.setColorFilter(0xFFD32F2F);
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
            // Stop service if no codes are available
            Intent serviceIntent = new Intent(this, MqttService.class);
            stopService(serviceIntent);
        }
    }
}