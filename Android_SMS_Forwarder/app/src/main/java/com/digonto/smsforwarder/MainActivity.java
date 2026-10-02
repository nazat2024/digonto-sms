package com.digonto.smsforwarder;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.switchmaterial.SwitchMaterial;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    // Tab Views
    private ScrollView tabHomeLayout;
    private LinearLayout tabMessageLayout;
    private ScrollView tabProxyLayout;
    private ScrollView tabSettingLayout;
    private BottomNavigationView bottomNavigation;

    // Tab 1: Home View Elements
    private TextInputEditText pairingCodeInput, sim1Input, sim2Input;
    private TextView tvSim1Operator, tvSim2Operator;
    private Button btnAddDesktop, btnAddAnotherDesktop, btnSaveSim, btnAutoDetectSim;
    private TextView btnCancelAddDesktop, tvDesktopCount;
    private LinearLayout layoutPairingInputBox;
    private ChipGroup chipGroupDesktops;
    private TextView statusText;
    private ImageView statusIcon;
    private LinearLayout layoutHomeDivertAlert;
    private Button btnQuickCancelDivert;

    // Tab 2: Message View Elements
    private RecyclerView rvHistoryTab;
    private TextView tvEmptyHistoryTab;
    private Button btnRefreshMessages, btnClearMessages;
    private HistoryAdapter historyAdapter;

    // Tab 4: Setting View Elements
    private SwitchMaterial switchKeepScreenAwake, switchAmoledSaver, switchFocusModeDnd;
    private TextInputEditText etCustomDeviceName;
    private Button btnSaveCustomDeviceName, btnStartCallDivert, btnCancelCallDivert;

    // AMOLED Black Saver Elements
    private FrameLayout layoutBlackSaverOverlay;
    private Handler amoledHandler = new Handler(Looper.getMainLooper());
    private Runnable amoledRunnable;
    private static final long AMOLED_TIMEOUT_MS = 120_000; // 2 minutes

    private SharedPreferences prefs;
    private boolean isSimLocked = false;
    private Handler statusPollHandler;
    private Runnable statusPollRunnable;

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

        initViews();
        setupBottomNavigation();
        setupHomeTab();
        setupMessageTab();
        setupSettingTab();
        setupAmoledBlackSaver();

        // Screen Awake Preference Init
        boolean keepAwake = prefs.getBoolean("keep_screen_awake", true);
        applyScreenAwake(keepAwake);

        // Start Background MQTT Service
        startMqttService();

        // Periodic Status Polling Loop for live UI & chip LEDs
        statusPollHandler = new Handler(Looper.getMainLooper());
        statusPollRunnable = new Runnable() {
            @Override
            public void run() {
                updateConnectionStatusLive();
                statusPollHandler.postDelayed(this, 1500);
            }
        };
        statusPollHandler.post(statusPollRunnable);
    }

    private void initViews() {
        // Tabs
        tabHomeLayout = findViewById(R.id.tabHomeLayout);
        tabMessageLayout = findViewById(R.id.tabMessageLayout);
        tabProxyLayout = findViewById(R.id.tabProxyLayout);
        tabSettingLayout = findViewById(R.id.tabSettingLayout);
        bottomNavigation = findViewById(R.id.bottomNavigation);

        // Tab 1: Home
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
        chipGroupDesktops = findViewById(R.id.chipGroupDesktops);
        statusText = findViewById(R.id.statusText);
        statusIcon = findViewById(R.id.statusIcon);
        layoutHomeDivertAlert = findViewById(R.id.layoutHomeDivertAlert);
        btnQuickCancelDivert = findViewById(R.id.btnQuickCancelDivert);

        // Tab 2: Message
        rvHistoryTab = findViewById(R.id.rvHistoryTab);
        tvEmptyHistoryTab = findViewById(R.id.tvEmptyHistoryTab);
        btnRefreshMessages = findViewById(R.id.btnRefreshMessages);
        btnClearMessages = findViewById(R.id.btnClearMessages);

        // Tab 4: Setting
        switchKeepScreenAwake = findViewById(R.id.switchKeepScreenAwake);
        switchAmoledSaver = findViewById(R.id.switchAmoledSaver);
        switchFocusModeDnd = findViewById(R.id.switchFocusModeDnd);
        etCustomDeviceName = findViewById(R.id.etCustomDeviceName);
        btnSaveCustomDeviceName = findViewById(R.id.btnSaveCustomDeviceName);
        btnStartCallDivert = findViewById(R.id.btnStartCallDivert);
        btnCancelCallDivert = findViewById(R.id.btnCancelCallDivert);

        // AMOLED Overlay
        layoutBlackSaverOverlay = findViewById(R.id.layoutBlackSaverOverlay);
    }

    private void setupBottomNavigation() {
        bottomNavigation.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_home) {
                switchTab(0);
                return true;
            } else if (itemId == R.id.nav_message) {
                switchTab(1);
                loadHistoryTab();
                return true;
            } else if (itemId == R.id.nav_proxy) {
                switchTab(2);
                return true;
            } else if (itemId == R.id.nav_setting) {
                switchTab(3);
                return true;
            }
            return false;
        });
    }

    private void switchTab(int index) {
        tabHomeLayout.setVisibility(index == 0 ? View.VISIBLE : View.GONE);
        tabMessageLayout.setVisibility(index == 1 ? View.VISIBLE : View.GONE);
        tabProxyLayout.setVisibility(index == 2 ? View.VISIBLE : View.GONE);
        tabSettingLayout.setVisibility(index == 3 ? View.VISIBLE : View.GONE);
    }

    // ==================== TAB 1: HOME SETUP ====================
    private void setupHomeTab() {
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

        if (!savedSim1.isEmpty() && !isPhoneNumber(savedSim1)) {
            if (savedOp1.isEmpty()) savedOp1 = savedSim1;
            savedSim1 = "";
        }
        if (!savedSim2.isEmpty() && !isPhoneNumber(savedSim2)) {
            if (savedOp2.isEmpty()) savedOp2 = savedSim2;
            savedSim2 = "";
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

        if (!savedSim1.isEmpty() || !savedSim2.isEmpty()) {
            lockSimInputs();
        } else {
            unlockSimInputs();
            if (savedOp1.isEmpty() && savedOp2.isEmpty()) {
                autoDetectSims(false);
            }
        }

        btnAutoDetectSim.setOnClickListener(v -> autoDetectSims(true));

        btnSaveSim.setOnClickListener(v -> {
            if (isSimLocked) {
                unlockSimInputs();
            } else {
                String num1 = sim1Input.getText() != null ? sim1Input.getText().toString().trim() : "";
                String num2 = sim2Input.getText() != null ? sim2Input.getText().toString().trim() : "";

                String op1 = prefs.getString("sim1_operator", "Banglalink");
                String op2 = prefs.getString("sim2_operator", "Grameenphone");

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

                // Trigger instant sync ping
                if (MqttService.instance != null) {
                    MqttService.instance.sendSinglePing();
                }
            }
        });

        // Add Desktop Code with Instant Dynamic MQTT Subscription
        btnAddDesktop.setOnClickListener(v -> {
            String code = pairingCodeInput.getText() != null ? pairingCodeInput.getText().toString().trim() : "";
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
            prefs.edit().putString("pairing_code", code).apply();

            pairingCodeInput.setText("");
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.hideSoftInputFromWindow(pairingCodeInput.getWindowToken(), 0);
            }

            // Start service and connect
            startMqttService();
            if (MqttService.instance != null) {
                MqttService.instance.subscribeToCode(code);
                MqttService.instance.sendSinglePing();
            }

            loadChips();
            Toast.makeText(this, "Desktop added!", Toast.LENGTH_SHORT).show();
            updateConnectionStatusLive();
        });

        // Quick Cancel Divert from banner
        btnQuickCancelDivert.setOnClickListener(v -> executeCallDivert("##21#", false));

        // Update Divert Banner visibility on launch
        boolean isDivertActive = prefs.getBoolean("divert_active", false);
        layoutHomeDivertAlert.setVisibility(isDivertActive ? View.VISIBLE : View.GONE);

        loadChips();
    }

    // ==================== TAB 2: MESSAGE (SMS HISTORY) ====================
    private void setupMessageTab() {
        rvHistoryTab.setLayoutManager(new LinearLayoutManager(this));
        historyAdapter = new HistoryAdapter(this, new ArrayList<>());
        rvHistoryTab.setAdapter(historyAdapter);

        btnRefreshMessages.setOnClickListener(v -> loadHistoryTab());

        btnClearMessages.setOnClickListener(v -> {
            new AlertDialog.Builder(this)
                    .setTitle("Clear History")
                    .setMessage("Are you sure you want to delete all saved SMS logs?")
                    .setPositiveButton("Clear", (dialog, which) -> {
                        SmsLogDbHelper.getInstance(this).deleteAllLogs();
                        loadHistoryTab();
                        Toast.makeText(this, "All SMS logs deleted", Toast.LENGTH_SHORT).show();
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
        });
    }

    private void loadHistoryTab() {
        if (historyAdapter != null) {
            List<SmsLog> logs = SmsLogDbHelper.getInstance(this).getAllLogs();
            historyAdapter.updateData(logs);
            if (logs.isEmpty()) {
                tvEmptyHistoryTab.setVisibility(View.VISIBLE);
                rvHistoryTab.setVisibility(View.GONE);
            } else {
                tvEmptyHistoryTab.setVisibility(View.GONE);
                rvHistoryTab.setVisibility(View.VISIBLE);
            }
        }
    }

    // ==================== TAB 4: SETTING SETUP ====================
    private void setupSettingTab() {
        // Screen Awake switch
        boolean keepAwake = prefs.getBoolean("keep_screen_awake", true);
        switchKeepScreenAwake.setChecked(keepAwake);
        switchKeepScreenAwake.setOnCheckedChangeListener((buttonView, isChecked) -> {
            prefs.edit().putBoolean("keep_screen_awake", isChecked).apply();
            applyScreenAwake(isChecked);
            Toast.makeText(this, isChecked ? "Screen will stay awake" : "Normal screen timeout restored", Toast.LENGTH_SHORT).show();
        });

        // AMOLED Black Saver switch
        boolean amoledSaver = prefs.getBoolean("amoled_black_saver", false);
        switchAmoledSaver.setChecked(amoledSaver);
        switchAmoledSaver.setOnCheckedChangeListener((buttonView, isChecked) -> {
            prefs.edit().putBoolean("amoled_black_saver", isChecked).apply();
            resetAmoledTimer();
            Toast.makeText(this, isChecked ? "AMOLED Saver Enabled (2 min idle)" : "AMOLED Saver Disabled", Toast.LENGTH_SHORT).show();
        });

        // Custom Device Name
        String savedCustomName = prefs.getString("custom_device_name", "");
        if (savedCustomName.isEmpty()) {
            savedCustomName = Build.MODEL;
        }
        etCustomDeviceName.setText(savedCustomName);

        btnSaveCustomDeviceName.setOnClickListener(v -> {
            String name = etCustomDeviceName.getText() != null ? etCustomDeviceName.getText().toString().trim() : "";
            if (name.isEmpty()) {
                name = Build.MODEL;
            }
            prefs.edit().putString("custom_device_name", name).apply();
            if (MqttService.instance != null) {
                MqttService.instance.updateCustomDeviceName(name);
            }
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.hideSoftInputFromWindow(etCustomDeviceName.getWindowToken(), 0);
            }
            Toast.makeText(this, "Device name saved & synced to all desktops!", Toast.LENGTH_SHORT).show();
        });

        // Focus Mode: DND
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && nm != null) {
            switchFocusModeDnd.setChecked(nm.getCurrentInterruptionFilter() == NotificationManager.INTERRUPTION_FILTER_NONE
                    || nm.getCurrentInterruptionFilter() == NotificationManager.INTERRUPTION_FILTER_PRIORITY);
        }
        switchFocusModeDnd.setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && nm != null) {
                if (!nm.isNotificationPolicyAccessGranted()) {
                    Toast.makeText(this, "Please grant Do Not Disturb access", Toast.LENGTH_SHORT).show();
                    Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
                    startActivity(intent);
                    switchFocusModeDnd.setChecked(false);
                } else {
                    if (switchFocusModeDnd.isChecked()) {
                        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE);
                        Toast.makeText(this, "Focus Mode (DND) Activated: Calls & Popups Muted", Toast.LENGTH_SHORT).show();
                    } else {
                        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                        Toast.makeText(this, "Focus Mode Disabled", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });

        // GSM Call Divert Controls
        btnStartCallDivert.setOnClickListener(v -> {
            new AlertDialog.Builder(this)
                    .setTitle("কল ব্লক (Call Divert)")
                    .setMessage("কল ব্লক মোড চালু করলে কোনো সাধারণ ভয়েস কল ঢুকবে না (কলারকে বলবে নম্বরটি বন্ধ/ব্যস্ত), কিন্তু 4G ইন্টারনেট ও SMS/OTP ১০০% চালু থাকবে।\n\nআপনি কি কল ব্লক করতে চান?")
                    .setPositiveButton("চালু করুন", (dialog, which) -> executeCallDivert("*21*01700000000#", true))
                    .setNegativeButton("বাতিল", null)
                    .show();
        });

        btnCancelCallDivert.setOnClickListener(v -> executeCallDivert("##21#", false));
    }

    private void executeCallDivert(String ussdCode, boolean isDiverting) {
        try {
            // Encode '#' as '%23' for USSD dialer intent
            String encodedUssd = "tel:" + Uri.encode(ussdCode);
            Intent callIntent = new Intent(Intent.ACTION_CALL, Uri.parse(encodedUssd));
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                startActivity(callIntent);
            } else {
                Intent dialIntent = new Intent(Intent.ACTION_DIAL, Uri.parse(encodedUssd));
                startActivity(dialIntent);
            }

            prefs.edit().putBoolean("divert_active", isDiverting).apply();
            layoutHomeDivertAlert.setVisibility(isDiverting ? View.VISIBLE : View.GONE);

            if (isDiverting) {
                Toast.makeText(this, "কল ব্লক কোড ডায়াল করা হয়েছে। 4G ও SMS সচল থাকবে।", Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(this, "কল স্বাভাবিক করার কোড ডায়াল করা হয়েছে।", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "Error executing USSD: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    // ==================== SCREEN AWAKE & AMOLED SAVER ====================
    private void applyScreenAwake(boolean awake) {
        if (awake) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    private void setupAmoledBlackSaver() {
        amoledRunnable = () -> {
            boolean isSaverEnabled = prefs.getBoolean("amoled_black_saver", false);
            if (isSaverEnabled && layoutBlackSaverOverlay != null) {
                layoutBlackSaverOverlay.setVisibility(View.VISIBLE);
            }
        };

        if (layoutBlackSaverOverlay != null) {
            layoutBlackSaverOverlay.setOnClickListener(v -> {
                layoutBlackSaverOverlay.setVisibility(View.GONE);
                resetAmoledTimer();
            });
        }
        resetAmoledTimer();
    }

    @Override
    public void onUserInteraction() {
        super.onUserInteraction();
        resetAmoledTimer();
    }

    private void resetAmoledTimer() {
        if (amoledHandler != null && amoledRunnable != null) {
            amoledHandler.removeCallbacks(amoledRunnable);
            boolean isSaverEnabled = prefs.getBoolean("amoled_black_saver", false);
            if (isSaverEnabled) {
                amoledHandler.postDelayed(amoledRunnable, AMOLED_TIMEOUT_MS);
            }
        }
    }

    // ==================== DESKTOP CHIPS & STATUS LEDS ====================
    private void loadChips() {
        chipGroupDesktops.removeAllViews();
        Set<String> codes = prefs.getStringSet("pairing_codes", new HashSet<>());

        tvDesktopCount.setText(codes.size() + " Paired");

        if (codes.isEmpty()) {
            layoutPairingInputBox.setVisibility(View.VISIBLE);
            btnAddAnotherDesktop.setVisibility(View.GONE);
            btnCancelAddDesktop.setVisibility(View.GONE);
        } else {
            layoutPairingInputBox.setVisibility(View.GONE);
            btnAddAnotherDesktop.setVisibility(View.VISIBLE);
            btnCancelAddDesktop.setVisibility(View.GONE);
        }

        for (String code : codes) {
            Chip chip = new Chip(this);
            chip.setTag(code);
            chip.setChipCornerRadius(16f);
            chip.setTextSize(13f);
            chip.setCloseIconVisible(true);
            chip.setCloseIconTint(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#EF4444")));

            // Update chip text and LED state
            updateSingleChipState(chip, code);

            chip.setOnCloseIconClickListener(v -> {
                Set<String> currentCodes = new HashSet<>(prefs.getStringSet("pairing_codes", new HashSet<>()));
                currentCodes.remove(code);
                prefs.edit().putStringSet("pairing_codes", currentCodes).apply();

                if (currentCodes.isEmpty()) {
                    prefs.edit().remove("pairing_code").apply();
                } else if (code.equals(prefs.getString("pairing_code", ""))) {
                    prefs.edit().putString("pairing_code", currentCodes.iterator().next()).apply();
                }

                if (MqttService.instance != null) {
                    MqttService.instance.unsubscribeFromCode(code);
                }

                loadChips();
                updateConnectionStatusLive();
            });

            chipGroupDesktops.addView(chip);
        }
    }

    /**
     * Individual LED Badge: 🟢 Live, 🔴 Offline, 🟡 Waiting per desktop!
     */
    private void updateSingleChipState(Chip chip, String code) {
        Long lp = MqttService.lastPongReceivedTimes.get(code);
        long lastPong = lp != null ? lp : 0;
        long timeSinceLastPong = System.currentTimeMillis() - lastPong;

        if (timeSinceLastPong < 10000 && lastPong > 0) {
            // Live Online: Emerald Green
            chip.setText("🟢 Desktop: " + code + " (Live)");
            chip.setChipBackgroundColor(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#F0FDF4")));
            chip.setChipStrokeColor(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#10B981")));
            chip.setChipStrokeWidth(2f);
            chip.setTextColor(android.graphics.Color.parseColor("#065F46"));
        } else if (MqttService.isConnectedToBroker) {
            // Broker connected, but desktop pong not received: Offline Red
            chip.setText("🔴 Desktop: " + code + " (Offline)");
            chip.setChipBackgroundColor(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#FEF2F2")));
            chip.setChipStrokeColor(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#EF4444")));
            chip.setChipStrokeWidth(2f);
            chip.setTextColor(android.graphics.Color.parseColor("#991B1B"));
        } else {
            // Connecting / Waiting: Amber
            chip.setText("🟡 Desktop: " + code + " (Waiting...)");
            chip.setChipBackgroundColor(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#FFFBEB")));
            chip.setChipStrokeColor(android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#F59E0B")));
            chip.setChipStrokeWidth(2f);
            chip.setTextColor(android.graphics.Color.parseColor("#92400E"));
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

        // Refresh each chip's individual LED without recreating chips
        for (int i = 0; i < chipGroupDesktops.getChildCount(); i++) {
            View child = chipGroupDesktops.getChildAt(i);
            if (child instanceof Chip) {
                Chip chip = (Chip) child;
                String code = (String) chip.getTag();
                if (code != null) {
                    updateSingleChipState(chip, code);
                }
            }
        }

        if (MqttService.isConnectedToBroker) {
            int onlineCount = 0;
            for (String code : codes) {
                Long lp = MqttService.lastPongReceivedTimes.get(code);
                long lastPong = lp != null ? lp : 0;
                long timeSinceLastPong = System.currentTimeMillis() - lastPong;
                if (timeSinceLastPong < 10000 && lastPong > 0) {
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

    // ==================== SIM AUTO DETECT & LOCK ====================
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
                String carrier = info.getCarrierName() != null ? info.getCarrierName().toString().trim() : "";
                String number = info.getNumber() != null ? info.getNumber().trim() : "";

                if (slot == 0) {
                    detectedOp1 = cleanCarrierName(carrier);
                    if (isPhoneNumber(number)) detectedNum1 = cleanPhoneNumber(number);
                } else if (slot == 1) {
                    detectedOp2 = cleanCarrierName(carrier);
                    if (isPhoneNumber(number)) detectedNum2 = cleanPhoneNumber(number);
                }
            }

            if (!detectedOp1.isEmpty()) {
                tvSim1Operator.setText("📶 " + detectedOp1);
                updateSimHint(sim1Input, detectedOp1);
                prefs.edit().putString("sim1_operator", detectedOp1).apply();
            }
            if (!detectedOp2.isEmpty()) {
                tvSim2Operator.setText("📶 " + detectedOp2);
                updateSimHint(sim2Input, detectedOp2);
                prefs.edit().putString("sim2_operator", detectedOp2).apply();
            }

            if (!detectedNum1.isEmpty() && (sim1Input.getText() == null || sim1Input.getText().toString().isEmpty())) {
                sim1Input.setText(detectedNum1);
                prefs.edit().putString("sim1_number", detectedNum1).putString("sim1_name", detectedNum1).apply();
            }
            if (!detectedNum2.isEmpty() && (sim2Input.getText() == null || sim2Input.getText().toString().isEmpty())) {
                sim2Input.setText(detectedNum2);
                prefs.edit().putString("sim2_number", detectedNum2).putString("sim2_name", detectedNum2).apply();
            }

            if (showToast) {
                Toast.makeText(this, "SIM Auto-Detected Successfully!", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            if (showToast) Toast.makeText(this, "Detection Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void lockSimInputs() {
        isSimLocked = true;
        sim1Input.setEnabled(false);
        sim2Input.setEnabled(false);
        sim1Input.setFocusable(false);
        sim2Input.setFocusable(false);
        btnSaveSim.setText("EDIT");
        btnSaveSim.setTextColor(0xFF0284C7);
    }

    private void unlockSimInputs() {
        isSimLocked = false;
        sim1Input.setEnabled(true);
        sim2Input.setEnabled(true);
        sim1Input.setFocusableInTouchMode(true);
        sim2Input.setFocusableInTouchMode(true);
        btnSaveSim.setText("SAVE");
        btnSaveSim.setTextColor(0xFF10B981);
    }

    private String cleanCarrierName(String raw) {
        if (raw == null) return "Unknown";
        String l = raw.toLowerCase();
        if (l.contains("grameen") || l.contains("gp")) return "Grameenphone";
        if (l.contains("banglalink") || l.contains("bl")) return "Banglalink";
        if (l.contains("robi")) return "Robi";
        if (l.contains("airtel")) return "Airtel";
        if (l.contains("teletalk")) return "Teletalk";
        return raw;
    }

    private String cleanPhoneNumber(String num) {
        if (num == null) return "";
        String clean = num.replaceAll("[^0-9+]", "");
        if (clean.startsWith("+880")) clean = clean.substring(3);
        if (clean.startsWith("880")) clean = clean.substring(2);
        return clean;
    }

    private boolean isPhoneNumber(String str) {
        if (str == null) return false;
        String clean = str.replaceAll("[^0-9]", "");
        return (clean.startsWith("01") && clean.length() == 11) || (clean.startsWith("8801") && clean.length() == 13);
    }

    private void updateSimHint(TextInputEditText input, String op) {
        if (input == null) return;
        String l = op.toLowerCase();
        if (l.contains("banglalink")) input.setHint("019XXXXXXXX");
        else if (l.contains("grameen")) input.setHint("017XXXXXXXX");
        else if (l.contains("robi")) input.setHint("018XXXXXXXX");
        else if (l.contains("airtel")) input.setHint("016XXXXXXXX");
        else if (l.contains("teletalk")) input.setHint("015XXXXXXXX");
        else input.setHint("01XXXXXXXXX");
    }

    private boolean hasAllPermissions() {
        boolean sms = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean phone = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        return sms && phone;
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
        }
        resetAmoledTimer();
        // If message tab is open, refresh logs
        if (tabMessageLayout.getVisibility() == View.VISIBLE) {
            loadHistoryTab();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (statusPollHandler != null && statusPollRunnable != null) {
            statusPollHandler.removeCallbacks(statusPollRunnable);
        }
        if (amoledHandler != null && amoledRunnable != null) {
            amoledHandler.removeCallbacks(amoledRunnable);
        }
    }
}