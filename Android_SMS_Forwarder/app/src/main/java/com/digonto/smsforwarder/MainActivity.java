package com.digonto.smsforwarder;

import android.Manifest;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.text.InputType;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.res.ColorStateList;
import com.digonto.smsforwarder.proxy.ProxyServerService;
import com.digonto.smsforwarder.proxy.ProxyTrafficStats;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.button.MaterialButton;
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

    // Tab 3: Proxy View Elements
    private TextView btnModeWifi, btnModeUsb, btnModeRemote;
    private TextView tvProxyStatusBadge, tvProxyCarrier, tvProxyAddress, tvProxyHelpText;
    private Button btnCopyProxy, btnToggleProxy;
    private TextView tvProxyDownload, tvProxyUpload, tvProxySpeed, tvProxyConnections;
    private String selectedProxyMode = ProxyServerService.MODE_WIFI;
    private boolean isProxyServiceRunning = false;
    private BroadcastReceiver proxyStatusReceiver;
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

    public static MainActivity instance;
    private BroadcastReceiver newSmsReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // Permissions check fallback
        if (!hasAllPermissions()) {
            startActivity(new Intent(this, PermissionsActivity.class));
            finish();
            return;
        }

        // Register dynamic receiver for real-time live SMS updates
        newSmsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                notifyNewSmsReceived();
            }
        };
        IntentFilter filter = new IntentFilter("com.digonto.smsforwarder.SMS_RECEIVED_EVENT");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(newSmsReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(newSmsReceiver, filter);
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
        setupProxyTab();
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

        // Tab 3: Proxy
        btnModeWifi = findViewById(R.id.btnModeWifi);
        btnModeUsb = findViewById(R.id.btnModeUsb);
        btnModeRemote = findViewById(R.id.btnModeRemote);
        tvProxyStatusBadge = findViewById(R.id.tvProxyStatusBadge);
        tvProxyCarrier = findViewById(R.id.tvProxyCarrier);
        tvProxyAddress = findViewById(R.id.tvProxyAddress);
        btnCopyProxy = findViewById(R.id.btnCopyProxy);
        btnToggleProxy = findViewById(R.id.btnToggleProxy);
        tvProxyDownload = findViewById(R.id.tvProxyDownload);
        tvProxyUpload = findViewById(R.id.tvProxyUpload);
        tvProxySpeed = findViewById(R.id.tvProxySpeed);
        tvProxyConnections = findViewById(R.id.tvProxyConnections);
        tvProxyHelpText = findViewById(R.id.tvProxyHelpText);

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
        tvSim1Operator.setOnClickListener(v -> triggerSimUssdForSlot(0));
        tvSim2Operator.setOnClickListener(v -> triggerSimUssdForSlot(1));

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
            Intent serviceIntent = new Intent(this, MqttService.class);
            serviceIntent.putExtra("new_pairing_code", code);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
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

    public void notifyNewSmsReceived() {
        runOnUiThread(() -> {
            loadHistoryTab();
            if (rvHistoryTab != null && historyAdapter != null && historyAdapter.getItemCount() > 0) {
                rvHistoryTab.scrollToPosition(0);
            }
        });
    }

    private void loadHistoryTab() {
        syncRecentInboxSms();
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

    private void syncRecentInboxSms() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        Cursor cursor = null;
        try {
            Uri uri = Uri.parse("content://sms/inbox");
            String[] projection = new String[]{"_id", "address", "body", "date", "sub_id"};
            String sortOrder = "date DESC LIMIT 30";
            cursor = getContentResolver().query(uri, projection, null, null, sortOrder);
            if (cursor != null && cursor.moveToFirst()) {
                int addrIdx = cursor.getColumnIndex("address");
                int bodyIdx = cursor.getColumnIndex("body");
                int dateIdx = cursor.getColumnIndex("date");
                int subIdIdx = cursor.getColumnIndex("sub_id");

                SmsLogDbHelper db = SmsLogDbHelper.getInstance(this);

                do {
                    String address = addrIdx != -1 ? cursor.getString(addrIdx) : "Unknown";
                    String body = bodyIdx != -1 ? cursor.getString(bodyIdx) : "";
                    long date = dateIdx != -1 ? cursor.getLong(dateIdx) : System.currentTimeMillis();
                    int subId = subIdIdx != -1 ? cursor.getInt(subIdIdx) : -1;

                    if (body != null && !body.trim().isEmpty() && !db.logExists(address, body)) {
                        String simName = resolveSimNameForSubId(subId);
                        db.insertLogWithTimestamp(address, body, simName, SmsLog.STATUS_LOCAL, date);
                    }
                } while (cursor.moveToNext());
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
    }

    private String resolveSimNameForSubId(int subId) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && subId != -1) {
                SubscriptionManager sm = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                if (sm != null && ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                    SubscriptionInfo info = sm.getActiveSubscriptionInfo(subId);
                    if (info != null) {
                        int slot = info.getSimSlotIndex();
                        if (slot == 0) {
                            String n1 = prefs.getString("sim1_number", "");
                            return !n1.isEmpty() ? n1 : prefs.getString("sim1_operator", "SIM 1");
                        } else if (slot == 1) {
                            String n2 = prefs.getString("sim2_number", "");
                            return !n2.isEmpty() ? n2 : prefs.getString("sim2_operator", "SIM 2");
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return "SIM 1";
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
            if (!isChecked) {
                exitAmoledMode();
            }
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
                MqttService.instance.sendSinglePing();
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

    // ==================== TAB 3: PROXY SETUP ====================
    private void setupProxyTab() {
        btnModeWifi.setOnClickListener(v -> selectProxyMode(ProxyServerService.MODE_WIFI));
        btnModeUsb.setOnClickListener(v -> selectProxyMode(ProxyServerService.MODE_USB));
        btnModeRemote.setOnClickListener(v -> selectProxyMode(ProxyServerService.MODE_REMOTE));

        btnCopyProxy.setOnClickListener(v -> {
            String addr = tvProxyAddress.getText().toString().trim();
            if (!addr.isEmpty()) {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                ClipData clip = ClipData.newPlainText("Proxy Address", addr);
                if (clipboard != null) {
                    clipboard.setPrimaryClip(clip);
                    Toast.makeText(this, "📋 প্রক্সি অ্যাড্রেস কপি করা হয়েছে: " + addr, Toast.LENGTH_SHORT).show();
                }
            }
        });

        btnToggleProxy.setOnClickListener(v -> {
            if (isProxyServiceRunning) {
                // Stop Proxy
                Intent stopIntent = new Intent(this, ProxyServerService.class);
                stopIntent.setAction(ProxyServerService.ACTION_STOP);
                startService(stopIntent);
                updateProxyUi(false, selectedProxyMode, tvProxyAddress.getText().toString(), "Cellular 4G", 0, 0, 0, 0);
            } else {
                // Start Proxy
                Intent startIntent = new Intent(this, ProxyServerService.class);
                startIntent.setAction(ProxyServerService.ACTION_START);
                startIntent.putExtra("mode", selectedProxyMode);
                startIntent.putExtra("port", 8080);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(startIntent);
                } else {
                    startService(startIntent);
                }
                updateProxyUi(true, selectedProxyMode, tvProxyAddress.getText().toString(), "Cellular 4G", 0, 0, 0, 0);
            }
        });

        proxyStatusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent != null && ProxyServerService.ACTION_BROADCAST_STATUS.equals(intent.getAction())) {
                    boolean running = intent.getBooleanExtra("isRunning", false);
                    String mode = intent.getStringExtra("mode");
                    int port = intent.getIntExtra("port", 8080);
                    String ip = intent.getStringExtra("ip");
                    String carrier = intent.getStringExtra("carrier");
                    long downBytes = intent.getLongExtra("downloadBytes", 0);
                    long upBytes = intent.getLongExtra("uploadBytes", 0);
                    double downSpeed = intent.getDoubleExtra("downloadSpeed", 0);
                    int activeConns = intent.getIntExtra("activeConnections", 0);

                    String displayIp;
                    if (ip != null && !ip.isEmpty()) {
                        if (ip.contains(":") || ip.contains(" ") || ip.contains("।") || ip.contains("(") || ip.contains(")")) {
                            displayIp = ip;
                        } else {
                            displayIp = ip + ":" + port;
                        }
                    } else {
                        displayIp = "127.0.0.1:8080";
                    }

                    updateProxyUi(running, mode, displayIp,
                            carrier != null ? carrier : "4G Mobile", downBytes, upBytes, downSpeed, activeConns);
                }
            }
        };

        IntentFilter filter = new IntentFilter(ProxyServerService.ACTION_BROADCAST_STATUS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(proxyStatusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(proxyStatusReceiver, filter);
        }

        selectProxyMode(ProxyServerService.MODE_WIFI);
    }

    private void selectProxyMode(String mode) {
        selectedProxyMode = mode;

        btnModeWifi.setBackgroundColor(Color.TRANSPARENT);
        btnModeWifi.setTextColor(Color.parseColor("#475569"));
        btnModeUsb.setBackgroundColor(Color.TRANSPARENT);
        btnModeUsb.setTextColor(Color.parseColor("#475569"));
        btnModeRemote.setBackgroundColor(Color.TRANSPARENT);
        btnModeRemote.setTextColor(Color.parseColor("#475569"));

        int activeBg = Color.parseColor("#0284C7");
        int activeText = Color.parseColor("#FFFFFF");

        if (ProxyServerService.MODE_WIFI.equals(mode)) {
            btnModeWifi.setBackgroundColor(activeBg);
            btnModeWifi.setTextColor(activeText);
            tvProxyHelpText.setText("১. ল্যাপটপ ও ফোন একই ওয়াইফাই বা হটস্পটে রাখুন।\n২. উপরের '📋 কপি' বাটনে চেপে IP:Port কপি করুন।\n৩. ল্যাপটপের IVAC Master Pro-তে প্রোফাইল এডিটে প্রক্সি ঘরে বসিয়ে দিন। ক্রোম সরাসরি এই সিমের 4G দিয়ে চলবে!");
            tvProxyAddress.setText(getWifiIpFormatted());
        } else if (ProxyServerService.MODE_USB.equals(mode)) {
            btnModeUsb.setBackgroundColor(activeBg);
            btnModeUsb.setTextColor(activeText);
            tvProxyHelpText.setText("১. চার্জিং ক্যাবল দিয়ে ফোন ল্যাপটপের সাথে লাগান এবং USB Tethering অন করুন।\n২. অথবা ADB কমান্ড: adb forward tcp:8080 tcp:8080 চালান।\n৩. ল্যাপটপের প্রোফাইলে 127.0.0.1:8080 প্রক্সি বসিয়ে দিন। জিরো-ল্যাগ স্পিড পাবেন!");
            tvProxyAddress.setText("127.0.0.1:8080");
        } else if (ProxyServerService.MODE_REMOTE.equals(mode)) {
            btnModeRemote.setBackgroundColor(activeBg);
            btnModeRemote.setTextColor(activeText);
            tvProxyHelpText.setText("১. কাস্টমার দেশের যেকোনো প্রান্তে থাকলে ক্লাউড রিলে সার্ভার (VPS)-এর মাধ্যমে 4G ডাটা শেয়ার করতে হয়।\n২. আপনি যদি একই ওয়াইফাই বা হটস্পটে থাকেন, তবে 'Wi-Fi' ট্যাব ব্যবহার করুন (যা সরাসরি ১০০% ফুল স্পিডে চলবে)।\n৩. ক্লাউড সার্ভার সক্রিয় হলে উপরে স্বয়ংক্রিয়ভাবে রিমোট প্রক্সি অ্যাড্রেস চলে আসবে।");
            tvProxyAddress.setText("ক্লাউড সার্ভার অফলাইন");
        }

        if (isProxyServiceRunning) {
            Intent intent = new Intent(this, ProxyServerService.class);
            intent.setAction(ProxyServerService.ACTION_START);
            intent.putExtra("mode", selectedProxyMode);
            intent.putExtra("port", 8080);
            startService(intent);
        }
    }

    private void updateProxyUi(boolean isRunning, String mode, String displayAddress, String carrier,
                               long downBytes, long upBytes, double speedBps, int activeConns) {
        this.isProxyServiceRunning = isRunning;

        if (isRunning) {
            tvProxyStatusBadge.setText("🟢 প্রক্সি চলছে (সক্রিয়)");
            tvProxyStatusBadge.setTextColor(Color.parseColor("#16A34A"));
            tvProxyStatusBadge.setBackgroundColor(Color.parseColor("#DCFCE7"));

            btnToggleProxy.setText("⏹️ প্রক্সি বন্ধ করুন");
            btnToggleProxy.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#EF4444")));
        } else {
            tvProxyStatusBadge.setText("🔴 প্রক্সি বন্ধ আছে");
            tvProxyStatusBadge.setTextColor(Color.parseColor("#EF4444"));
            tvProxyStatusBadge.setBackgroundColor(Color.parseColor("#FEE2E2"));

            btnToggleProxy.setText("▶️ 4G প্রক্সি চালু করুন");
            btnToggleProxy.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#10B981")));
        }

        if (displayAddress != null && !displayAddress.isEmpty()) {
            tvProxyAddress.setText(displayAddress);
        }
        if (carrier != null && !carrier.isEmpty()) {
            tvProxyCarrier.setText("📶 " + carrier + " (Locked)");
        }

        tvProxyDownload.setText(ProxyTrafficStats.formatBytes(downBytes));
        tvProxyUpload.setText(ProxyTrafficStats.formatBytes(upBytes));
        tvProxySpeed.setText(ProxyTrafficStats.formatSpeed(speedBps));
        tvProxyConnections.setText(activeConns + " টি");
    }

    private String getWifiIpFormatted() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                if (intf.getName().startsWith("wlan")) {
                    for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                        if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                            return addr.getHostAddress() + ":8080";
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return "192.168.0.105:8080";
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

    private void enterAmoledMode() {
        if (layoutBlackSaverOverlay != null) {
            layoutBlackSaverOverlay.setVisibility(View.VISIBLE);
        }
        if (bottomNavigation != null) {
            bottomNavigation.setVisibility(View.GONE);
        }
        Window window = getWindow();
        if (window != null) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.BLACK);
            window.setNavigationBarColor(Color.BLACK);
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }

    private void exitAmoledMode() {
        if (layoutBlackSaverOverlay != null) {
            layoutBlackSaverOverlay.setVisibility(View.GONE);
        }
        if (bottomNavigation != null) {
            bottomNavigation.setVisibility(View.VISIBLE);
        }
        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.parseColor("#F8FAFC"));
            window.setNavigationBarColor(Color.parseColor("#FFFFFF"));
            View decor = window.getDecorView();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            } else {
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            }
        }
    }

    private void setupAmoledBlackSaver() {
        amoledRunnable = () -> {
            boolean isSaverEnabled = prefs.getBoolean("amoled_black_saver", false);
            if (isSaverEnabled) {
                enterAmoledMode();
            }
        };

        if (layoutBlackSaverOverlay != null) {
            layoutBlackSaverOverlay.setOnClickListener(v -> {
                exitAmoledMode();
                resetAmoledTimer();
            });
        }
        resetAmoledTimer();
    }

    @Override
    public void onUserInteraction() {
        super.onUserInteraction();
        if (layoutBlackSaverOverlay != null && layoutBlackSaverOverlay.getVisibility() == View.VISIBLE) {
            exitAmoledMode();
        }
        resetAmoledTimer();
    }

    @Override
    public void onBackPressed() {
        if (layoutBlackSaverOverlay != null && layoutBlackSaverOverlay.getVisibility() == View.VISIBLE) {
            exitAmoledMode();
            resetAmoledTimer();
            return;
        }
        super.onBackPressed();
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

    // ==================== SIM AUTO DETECT & LOCK (LIVE HARDWARE & USSD ENGINE) ====================
    private static final int PERMISSION_REQ_SIM_DETECT = 555;

    private String getSimCardIdentifier(SubscriptionInfo info) {
        if (info == null) return "";
        StringBuilder sb = new StringBuilder();
        sb.append(info.getSubscriptionId());
        try {
            if (info.getIccId() != null && !info.getIccId().isEmpty()) {
                sb.append("_").append(info.getIccId());
            }
        } catch (Exception ignored) {}
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                sb.append("_").append(info.getCardId());
            } catch (Exception ignored) {}
        }
        if (info.getCarrierName() != null) {
            sb.append("_").append(info.getCarrierName().toString().trim());
        }
        return sb.toString();
    }

    private void autoDetectSims(boolean showToast) {
        try {
            boolean hasPhone = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
            boolean hasCall = ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;

            if (!hasPhone || !hasCall) {
                if (showToast) {
                    ActivityCompat.requestPermissions(this, new String[]{
                            Manifest.permission.READ_PHONE_STATE,
                            Manifest.permission.CALL_PHONE,
                            Manifest.permission.READ_PHONE_NUMBERS
                    }, PERMISSION_REQ_SIM_DETECT);
                    Toast.makeText(this, "Please allow Phone & Call permissions to detect live SIM numbers", Toast.LENGTH_SHORT).show();
                }
                return;
            }

            SubscriptionManager sm = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
            if (sm == null || tm == null) {
                if (showToast) Toast.makeText(this, "Telephony services unavailable", Toast.LENGTH_SHORT).show();
                return;
            }

            List<SubscriptionInfo> subList = sm.getActiveSubscriptionInfoList();
            if (subList == null || subList.isEmpty()) {
                tvSim1Operator.setText("No SIM 1");
                tvSim2Operator.setText("No SIM 2");
                sim1Input.setText("");
                sim2Input.setText("");
                prefs.edit()
                        .remove("sim1_number").remove("sim1_name").remove("sim1_operator").remove("sim1_id")
                        .remove("sim2_number").remove("sim2_name").remove("sim2_operator").remove("sim2_id")
                        .apply();
                unlockSimInputs();
                if (showToast) Toast.makeText(this, "No active SIM cards detected", Toast.LENGTH_SHORT).show();
                return;
            }

            boolean slot0Found = false;
            boolean slot1Found = false;

            for (SubscriptionInfo info : subList) {
                int slot = info.getSimSlotIndex();
                if (slot == 0) slot0Found = true;
                if (slot == 1) slot1Found = true;
                processSingleSimSlot(sm, tm, info, slot, showToast);
            }

            // Invalidate slots where physical SIM was removed
            if (!slot0Found) {
                tvSim1Operator.setText("No SIM 1");
                sim1Input.setText("");
                prefs.edit().remove("sim1_number").remove("sim1_name").remove("sim1_operator").remove("sim1_id").apply();
            }
            if (!slot1Found) {
                tvSim2Operator.setText("No SIM 2");
                sim2Input.setText("");
                prefs.edit().remove("sim2_number").remove("sim2_name").remove("sim2_operator").remove("sim2_id").apply();
            }

        } catch (Exception e) {
            if (showToast) Toast.makeText(this, "Detection Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void processSingleSimSlot(SubscriptionManager sm, TelephonyManager tm, SubscriptionInfo info, int slot, boolean showToast) {
        int subId = info.getSubscriptionId();
        String carrier = cleanCarrierName(info.getCarrierName() != null ? info.getCarrierName().toString().trim() : "");
        String currentSimId = getSimCardIdentifier(info);

        String keySimId = (slot == 0) ? "sim1_id" : "sim2_id";
        String keySimNumber = (slot == 0) ? "sim1_number" : "sim2_number";
        String keySimName = (slot == 0) ? "sim1_name" : "sim2_name";
        String keySimOp = (slot == 0) ? "sim1_operator" : "sim2_operator";
        TextInputEditText targetInput = (slot == 0) ? sim1Input : sim2Input;
        TextView targetTvOp = (slot == 0) ? tvSim1Operator : tvSim2Operator;

        targetTvOp.setText("📶 " + carrier + " (Tap to query)");
        updateSimHint(targetInput, carrier);
        prefs.edit().putString(keySimOp, carrier).apply();

        String savedSimId = prefs.getString(keySimId, "");
        if (!savedSimId.isEmpty() && !savedSimId.equals(currentSimId)) {
            // Physical SIM was SWAPPED or REPLACED!
            // Instantly clear old number so removed SIM number is NEVER retained!
            prefs.edit()
                    .remove(keySimNumber)
                    .remove(keySimName)
                    .putString(keySimId, currentSimId)
                    .apply();
            targetInput.setText("");
            unlockSimInputs();
            if (showToast) {
                Toast.makeText(this, "SIM " + (slot + 1) + " changed! Old number wiped.", Toast.LENGTH_SHORT).show();
            }
        } else {
            prefs.edit().putString(keySimId, currentSimId).apply();
        }

        // Check if current slot already has a valid saved number for this exact SIM
        String currentSavedNum = prefs.getString(keySimNumber, "");
        if (isPhoneNumber(currentSavedNum)) {
            targetInput.setText(currentSavedNum);
            return;
        }

        // Layer 1: Query live hardware chip / EF_MSISDN (Zero SMS history)
        String detectedNum = extractNumberFromSubscription(sm, tm, info);
        if (!detectedNum.isEmpty()) {
            applyDetectedNumber(slot, detectedNum);
            if (showToast) {
                Toast.makeText(this, "SIM " + (slot + 1) + " Hardware Detected: " + detectedNum, Toast.LENGTH_SHORT).show();
            }
            return;
        }

        // Layer 2: Query Live Carrier Network via USSD only when user explicitly requested detection
        if (showToast) {
            requestNetworkUssd(tm, subId, slot, carrier, true);
        }
    }

    private String extractNumberFromSubscription(SubscriptionManager sm, TelephonyManager tm, SubscriptionInfo info) {
        String num = "";
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                try {
                    num = sm.getPhoneNumber(info.getSubscriptionId());
                } catch (Exception ignored) {}
            }
            if (!isPhoneNumber(num) && info.getNumber() != null) {
                num = info.getNumber();
            }
            if (!isPhoneNumber(num) && tm != null) {
                try {
                    TelephonyManager subTm = tm.createForSubscriptionId(info.getSubscriptionId());
                    num = subTm.getLine1Number();
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
        return isPhoneNumber(num) ? cleanPhoneNumber(num) : "";
    }

    private void requestNetworkUssd(TelephonyManager tm, int subId, int slot, String carrier, boolean userFeedback) {
        String ussdCode = getCarrierUssdCode(carrier);
        if (ussdCode.isEmpty()) {
            if (userFeedback) {
                Toast.makeText(this, "Please enter SIM " + (slot + 1) + " number manually.", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            if (userFeedback) {
                promptDirectUssdDial(slot, carrier, ussdCode);
            }
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            if (userFeedback) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CALL_PHONE}, PERMISSION_REQ_SIM_DETECT);
            }
            return;
        }

        if (userFeedback) {
            Toast.makeText(this, "Contacting " + carrier + " tower (" + ussdCode + ")...", Toast.LENGTH_SHORT).show();
        }

        try {
            TelephonyManager subTm = tm.createForSubscriptionId(subId);
            subTm.sendUssdRequest(ussdCode, new TelephonyManager.UssdResponseCallback() {
                @Override
                public void onReceiveUssdResponse(TelephonyManager telephonyManager, String request, CharSequence returnMessage) {
                    if (returnMessage != null) {
                        String msg = returnMessage.toString();
                        Matcher m = Pattern.compile("(?:\\+?88)?(01[3-9]\\d{8})\\b").matcher(msg);
                        if (m.find()) {
                            String found = cleanPhoneNumber(m.group(1));
                            if (isPhoneNumber(found)) {
                                runOnUiThread(() -> {
                                    applyDetectedNumber(slot, found);
                                    Toast.makeText(MainActivity.this, "SIM " + (slot + 1) + " Network Verified: " + found, Toast.LENGTH_LONG).show();
                                });
                                return;
                            }
                        }
                    }
                    if (userFeedback) {
                        runOnUiThread(() -> promptDirectUssdDial(slot, carrier, ussdCode));
                    }
                }

                @Override
                public void onReceiveUssdResponseFailed(TelephonyManager telephonyManager, String request, int failureCode) {
                    if (userFeedback) {
                        runOnUiThread(() -> promptDirectUssdDial(slot, carrier, ussdCode));
                    }
                }
            }, new Handler(Looper.getMainLooper()));
        } catch (Exception e) {
            if (userFeedback) {
                promptDirectUssdDial(slot, carrier, ussdCode);
            }
        }
    }

    private void promptDirectUssdDial(int slot, String carrier, String ussdCode) {
        new AlertDialog.Builder(this)
                .setTitle("Verify SIM " + (slot + 1) + " (" + carrier + ")")
                .setMessage("To view your active mobile number, query " + carrier + " network using code " + ussdCode + ".\n\nTap 'Dial Now' to proceed.")
                .setPositiveButton("Dial Now", (dialog, which) -> {
                    try {
                        Uri uri = Uri.parse("tel:" + Uri.encode(ussdCode));
                        Intent intent = new Intent(Intent.ACTION_CALL, uri);
                        intent.putExtra("com.android.phone.extra.slot", slot);
                        intent.putExtra("simSlot", slot);
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Dial failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private String getCarrierUssdCode(String carrier) {
        if (carrier == null) return "";
        String l = carrier.toLowerCase();
        if (l.contains("banglalink") || l.contains("bl")) return "*511#";
        if (l.contains("grameen") || l.contains("gp")) return "*2#";
        if (l.contains("robi")) return "*2#";
        if (l.contains("airtel")) return "*2#";
        if (l.contains("teletalk")) return "*551#";
        return "";
    }

    private void triggerSimUssdForSlot(int targetSlot) {
        try {
            SubscriptionManager sm = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
            if (sm == null || tm == null) return;
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED
                    || ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.READ_PHONE_STATE, Manifest.permission.CALL_PHONE}, PERMISSION_REQ_SIM_DETECT);
                return;
            }
            List<SubscriptionInfo> subList = sm.getActiveSubscriptionInfoList();
            if (subList != null) {
                for (SubscriptionInfo info : subList) {
                    if (info.getSimSlotIndex() == targetSlot) {
                        String carrier = cleanCarrierName(info.getCarrierName() != null ? info.getCarrierName().toString().trim() : "");
                        requestNetworkUssd(tm, info.getSubscriptionId(), targetSlot, carrier, true);
                        return;
                    }
                }
            }
            Toast.makeText(this, "SIM " + (targetSlot + 1) + " not inserted", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void applyDetectedNumber(int slot, String number) {
        if (!isPhoneNumber(number)) return;
        if (slot == 0) {
            sim1Input.setText(number);
            prefs.edit().putString("sim1_number", number).putString("sim1_name", number).apply();
        } else if (slot == 1) {
            sim2Input.setText(number);
            prefs.edit().putString("sim2_number", number).putString("sim2_name", number).apply();
        }
        lockSimInputs();
        if (MqttService.instance != null) {
            MqttService.instance.sendSinglePing();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_SIM_DETECT) {
            autoDetectSims(true);
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
        String clean = num.replaceAll("[^0-9]", "");
        if (clean.startsWith("8801") && clean.length() == 13) {
            clean = clean.substring(2);
        }
        return clean;
    }

    private boolean isPhoneNumber(String str) {
        if (str == null) return false;
        String clean = cleanPhoneNumber(str);
        return clean.startsWith("01") && clean.length() == 11;
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

    private void checkAndPromptBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                boolean alreadyPrompted = prefs.getBoolean("battery_dialog_shown", false);
                if (!alreadyPrompted) {
                    prefs.edit().putBoolean("battery_dialog_shown", true).apply();
                    new AlertDialog.Builder(this)
                            .setTitle("২৪ ঘণ্টা কানেকশন চালু রাখুন")
                            .setMessage("মোবাইলের স্ক্রিন বন্ধ থাকলেও যাতে কানেকশন কখনো ডিসকানেক্ট না হয়, সেজন্য 'অনুমতি দিন (Allow)' চেপে ব্যাটারি অপটিমাইজেশন বন্ধ (Unrestricted) করুন।")
                            .setPositiveButton("অনুমতি দিন (Allow)", (dialog, which) -> {
                                try {
                                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                                    intent.setData(Uri.parse("package:" + getPackageName()));
                                    startActivity(intent);
                                } catch (Exception e) {
                                    try {
                                        Intent appSettings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                                        appSettings.setData(Uri.parse("package:" + getPackageName()));
                                        startActivity(appSettings);
                                    } catch (Exception ignored) {}
                                }
                            })
                            .setNegativeButton("পরে করব", null)
                            .show();
                }
            }
        }
    }

    private void startMqttService() {
        Intent serviceIntent = new Intent(this, MqttService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
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
            autoDetectSims(false);
            checkAndPromptBatteryOptimization();
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
        if (instance == this) {
            instance = null;
        }
        if (newSmsReceiver != null) {
            try {
                unregisterReceiver(newSmsReceiver);
            } catch (Exception ignored) {}
        }
        if (statusPollHandler != null && statusPollRunnable != null) {
            statusPollHandler.removeCallbacks(statusPollRunnable);
        }
        if (amoledHandler != null && amoledRunnable != null) {
            amoledHandler.removeCallbacks(amoledRunnable);
        }
        if (proxyStatusReceiver != null) {
            try {
                unregisterReceiver(proxyStatusReceiver);
            } catch (Exception ignored) {}
        }
    }
}