package com.digonto.smsforwarder;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.Button;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.switchmaterial.SwitchMaterial;

public class PermissionsActivity extends AppCompatActivity {

    private SwitchMaterial switchSms, switchPhone, switchBattery, switchNotification;
    private Button btnContinue;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // If all permissions are already granted, go to MainActivity directly
        if (areAllPermissionsGranted()) {
            goToMainActivity();
            return;
        }
        
        setContentView(R.layout.activity_permissions);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#F8FAFC"));
        }

        switchSms = findViewById(R.id.switchSms);
        switchPhone = findViewById(R.id.switchPhone);
        switchBattery = findViewById(R.id.switchBattery);
        switchNotification = findViewById(R.id.switchNotification);
        btnContinue = findViewById(R.id.btnContinue);

        setupPermissionSwitches();

        btnContinue.setOnClickListener(v -> {
            if (areAllPermissionsGranted()) {
                goToMainActivity();
            } else {
                Toast.makeText(this, "Please grant all permissions to continue", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkPermissionsAndUpdateUI();
    }

    private void setupPermissionSwitches() {
        switchSms.setOnClickListener(v -> {
            if (switchSms.isChecked()) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECEIVE_SMS}, 101);
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

    private void checkPermissionsAndUpdateUI() {
        boolean hasSms = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        switchSms.setChecked(hasSms);

        boolean hasPhone = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        switchPhone.setChecked(hasPhone);

        boolean hasBattery = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            hasBattery = pm.isIgnoringBatteryOptimizations(getPackageName());
        }
        switchBattery.setChecked(hasBattery);

        boolean hasNotif = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasNotif = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        switchNotification.setChecked(hasNotif);

        if (hasSms && hasPhone && hasBattery && hasNotif) {
            btnContinue.setBackgroundTintList(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#3B82F6")));
        } else {
            btnContinue.setBackgroundTintList(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#9CA3AF")));
        }
    }
    
    private boolean areAllPermissionsGranted() {
        boolean hasSms = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasPhone = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        
        boolean hasBattery = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            hasBattery = pm.isIgnoringBatteryOptimizations(getPackageName());
        }
        
        boolean hasNotif = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasNotif = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        
        return hasSms && hasPhone && hasBattery && hasNotif;
    }

    private void goToMainActivity() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }
}
