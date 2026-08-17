package com.digonto.smsforwarder;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private EditText pairingCodeInput;
    private Button btnSave, btnPermSms, btnPermBattery;
    private TextView statusText;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences("SMSConfig", MODE_PRIVATE);

        pairingCodeInput = findViewById(R.id.pairingCodeInput);
        btnSave = findViewById(R.id.btnSave);
        btnPermSms = findViewById(R.id.btnPermSms);
        btnPermBattery = findViewById(R.id.btnPermBattery);
        statusText = findViewById(R.id.statusText);

        String savedCode = prefs.getString("pairing_code", "");
        pairingCodeInput.setText(savedCode);
        updateStatus();

        btnSave.setOnClickListener(v -> {
            String code = pairingCodeInput.getText().toString().trim();
            if (code.length() < 6) {
                Toast.makeText(this, "Please enter a valid 6-digit code", Toast.LENGTH_SHORT).show();
                return;
            }
            prefs.edit().putString("pairing_code", code).apply();
            Toast.makeText(this, "Code saved successfully!", Toast.LENGTH_SHORT).show();
            updateStatus();
        });

        btnPermSms.setOnClickListener(v -> {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS}, 101);
            } else {
                Toast.makeText(this, "SMS Permission already granted!", Toast.LENGTH_SHORT).show();
            }
        });

        btnPermBattery.setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent();
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } else {
                    Toast.makeText(this, "Battery Optimization already disabled!", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void updateStatus() {
        if (!prefs.getString("pairing_code", "").isEmpty()) {
            statusText.setText("Status: Ready to Forward SMS");
            statusText.setTextColor(0xFF059669); // Green
        } else {
            statusText.setText("Status: Not Configured");
            statusText.setTextColor(0xFFD32F2F); // Red
        }
    }
}