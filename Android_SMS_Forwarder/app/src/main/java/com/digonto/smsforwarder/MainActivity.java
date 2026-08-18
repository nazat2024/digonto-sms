package com.digonto.smsforwarder;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
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
    private Button btnAddDesktop, btnSaveSim, btnHistory;
    private ChipGroup chipGroupDesktops;
    private TextView statusText;
    private ImageView statusIcon;
    private SharedPreferences prefs;

    private boolean isSimLocked = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // This check acts as a fallback. 
        // PermissionsActivity is the real launcher, but just in case MainActivity is started directly:
        if (!hasAllPermissions()) {
            startActivity(new Intent(this, PermissionsActivity.class));
            finish();
            return;
        }
        
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences("SMSConfig", MODE_PRIVATE);

        pairingCodeInput = findViewById(R.id.pairingCodeInput);
        sim1Input = findViewById(R.id.sim1Input);
        sim2Input = findViewById(R.id.sim2Input);
        btnAddDesktop = findViewById(R.id.btnAddDesktop);
        btnSaveSim = findViewById(R.id.btnSaveSim);
        btnHistory = findViewById(R.id.btnHistory);
        chipGroupDesktops = findViewById(R.id.chipGroupDesktops);
        
        statusText = findViewById(R.id.statusText);
        statusIcon = findViewById(R.id.statusIcon);

        // History Button Click Listener
        btnHistory.setOnClickListener(v -> {
            startActivity(new Intent(MainActivity.this, HistoryActivity.class));
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
                // Currently locked, so unlock it
                unlockSimInputs();
            } else {
                // Currently unlocked, so save and lock it
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
            
            // For backwards compatibility
            prefs.edit().putString("pairing_code", code).apply();
            
            pairingCodeInput.setText("");
            loadChips();
            Toast.makeText(this, "Desktop added! Restarting service...", Toast.LENGTH_SHORT).show();
            updateStatusUI();
            startMqttService();
        });
    }

    private void lockSimInputs() {
        isSimLocked = true;
        sim1Input.setEnabled(false);
        sim2Input.setEnabled(false);
        btnSaveSim.setText("EDIT SIM NAMES");
        btnSaveSim.setBackgroundTintList(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#9CA3AF"))); // Gray
    }

    private void unlockSimInputs() {
        isSimLocked = false;
        sim1Input.setEnabled(true);
        sim2Input.setEnabled(true);
        sim1Input.requestFocus();
        btnSaveSim.setText("SAVE SIM NAMES");
        btnSaveSim.setBackgroundTintList(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#3B82F6"))); // Blue
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

        for (String code : codes) {
            Chip chip = new Chip(this);
            chip.setText("Desktop: " + code);
            chip.setCloseIconVisible(true);
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
            StringBuilder sb = new StringBuilder();
            int onlineCount = 0;
            
            for (String code : codes) {
                long lastPong = MqttService.lastPongReceivedTimes.containsKey(code) ? MqttService.lastPongReceivedTimes.get(code) : 0;
                long timeSinceLastPong = System.currentTimeMillis() - lastPong;
                
                if (sb.length() > 0) sb.append("\n");
                
                if (timeSinceLastPong < 10000) { // 10 seconds timeout for pong
                    sb.append("Desktop ").append(code).append(": Online 🟢");
                    onlineCount++;
                } else {
                    sb.append("Desktop ").append(code).append(": Waiting... 🟠");
                }
            }
            
            statusText.setText(sb.toString());
            
            if (onlineCount == codes.size()) {
                statusText.setTextColor(0xFF059669); // Green
                statusIcon.setColorFilter(0xFF059669);
            } else if (onlineCount > 0) {
                statusText.setTextColor(0xFFF57F17); // Yellow
                statusIcon.setColorFilter(0xFFF57F17);
            } else {
                statusText.setTextColor(0xFFD32F2F); // Red
                statusIcon.setColorFilter(0xFFD32F2F);
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