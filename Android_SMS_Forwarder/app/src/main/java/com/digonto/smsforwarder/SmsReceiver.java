package com.digonto.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Log;
import android.widget.Toast;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class SmsReceiver extends BroadcastReceiver {
    
    private static final String TAG = "SmsReceiver";
    public static final String ACTION_NEW_SMS = "com.digonto.smsforwarder.SMS_RECEIVED_EVENT";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction() == null || !intent.getAction().equals("android.provider.Telephony.SMS_RECEIVED")) {
            return;
        }

        try {
            SharedPreferences prefs = context.getSharedPreferences("SMSConfig", Context.MODE_PRIVATE);

            // 1. Extract and reconstruct SMS messages (KitKat+ Telephony intent decoder with fallback)
            SmsMessage[] messages = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                try {
                    messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                } catch (Exception ignored) {}
            }

            if (messages == null || messages.length == 0) {
                Bundle bundle = intent.getExtras();
                if (bundle != null) {
                    Object[] pdus = (Object[]) bundle.get("pdus");
                    if (pdus != null && pdus.length > 0) {
                        String format = bundle.getString("format");
                        messages = new SmsMessage[pdus.length];
                        for (int i = 0; i < pdus.length; i++) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && format != null) {
                                messages[i] = SmsMessage.createFromPdu((byte[]) pdus[i], format);
                            } else {
                                messages[i] = SmsMessage.createFromPdu((byte[]) pdus[i]);
                            }
                        }
                    }
                }
            }

            if (messages == null || messages.length == 0) {
                Log.w(TAG, "No SMS messages extracted from intent");
                return;
            }

            StringBuilder fullMessage = new StringBuilder();
            String sender = "";
            for (SmsMessage sms : messages) {
                if (sms != null) {
                    if (sender.isEmpty()) {
                        sender = sms.getDisplayOriginatingAddress();
                        if (sender == null || sender.isEmpty()) {
                            sender = sms.getOriginatingAddress();
                        }
                    }
                    if (sms.getMessageBody() != null) {
                        fullMessage.append(sms.getMessageBody());
                    }
                }
            }

            if (sender == null || sender.isEmpty()) sender = "Unknown Sender";
            String body = fullMessage.toString();
            Log.d(TAG, "SMS Received From: " + sender + ", Length: " + body.length());

            // 2. Identify receiving SIM slot
            int slotIndex = -1;
            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                int subId = bundle.getInt("subscription", -1);
                if (subId == -1) {
                    subId = bundle.getInt("android.telephony.extra.SUBSCRIPTION_INDEX", -1);
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && subId != -1) {
                    try {
                        SubscriptionManager sm = SubscriptionManager.from(context);
                        List<SubscriptionInfo> activeList = sm.getActiveSubscriptionInfoList();
                        if (activeList != null) {
                            for (SubscriptionInfo info : activeList) {
                                if (info.getSubscriptionId() == subId) {
                                    slotIndex = info.getSimSlotIndex();
                                    break;
                                }
                            }
                        }
                    } catch (SecurityException ignored) {}
                }

                if (slotIndex == -1) {
                    if (bundle.containsKey("simSlot")) slotIndex = bundle.getInt("simSlot", -1);
                    else if (bundle.containsKey("slot")) slotIndex = bundle.getInt("slot", -1);
                    else if (bundle.containsKey("phone")) slotIndex = bundle.getInt("phone", -1);
                    else if (bundle.containsKey("slot_id")) slotIndex = bundle.getInt("slot_id", -1);
                }
            }

            String simName;
            if (slotIndex == 0) {
                String n1 = prefs.getString("sim1_number", "");
                String o1 = prefs.getString("sim1_operator", "");
                simName = !n1.isEmpty() ? n1 : (!o1.isEmpty() ? o1 : "SIM 1");
            } else if (slotIndex == 1) {
                String n2 = prefs.getString("sim2_number", "");
                String o2 = prefs.getString("sim2_operator", "");
                simName = !n2.isEmpty() ? n2 : (!o2.isEmpty() ? o2 : "SIM 2");
            } else {
                simName = "Active SIM";
            }

            // 3. Desktop connection check
            Set<String> pairingCodes = prefs.getStringSet("pairing_codes", new HashSet<>());
            String oldCode = prefs.getString("pairing_code", "");
            boolean hasDesktop = !pairingCodes.isEmpty() || !oldCode.isEmpty();

            int initialStatus = hasDesktop ? SmsLog.STATUS_SENDING : SmsLog.STATUS_LOCAL;

            // 4. ALWAYS log to SQLite database so message appears in Message tab!
            long logId = SmsLogDbHelper.getInstance(context.getApplicationContext()).insertLog(
                    sender, body, simName, initialStatus
            );
            Log.d(TAG, "Saved incoming SMS to DB with ID: " + logId + ", Status: " + initialStatus);

            // 5. Instantly notify MainActivity UI so Message Tab updates in real time!
            try {
                Intent liveIntent = new Intent(ACTION_NEW_SMS);
                liveIntent.putExtra("log_id", logId);
                liveIntent.setPackage(context.getPackageName());
                context.sendBroadcast(liveIntent);
            } catch (Exception ignored) {}

            if (MainActivity.instance != null) {
                MainActivity.instance.notifyNewSmsReceived();
            }

            // 6. Forward to Desktop via MQTT if paired
            if (hasDesktop) {
                if (MqttService.instance != null) {
                    MqttService.instance.publishSms(logId, sender, body, simName);
                } else {
                    Log.w(TAG, "MqttService instance null, starting service...");
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
            }

            // 7. Toast feedback
            final String toastMsg = hasDesktop ? ("SMS Forwarded: " + simName) : ("SMS Received: " + sender);
            new Handler(Looper.getMainLooper()).post(() -> {
                try {
                    Toast.makeText(context.getApplicationContext(), toastMsg, Toast.LENGTH_SHORT).show();
                } catch (Exception ignored) {}
            });

        } catch (Exception e) {
            Log.e(TAG, "Error handling incoming SMS", e);
        }
    }
}
