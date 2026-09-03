package com.digonto.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.telephony.SmsMessage;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Log;
import android.widget.Toast;

import java.util.List;

public class SmsReceiver extends BroadcastReceiver {
    
    private static final String TAG = "SmsReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction() != null && intent.getAction().equals("android.provider.Telephony.SMS_RECEIVED")) {
            SharedPreferences prefs = context.getSharedPreferences("SMSConfig", Context.MODE_PRIVATE);
            java.util.Set<String> pairingCodes = prefs.getStringSet("pairing_codes", new java.util.HashSet<>());
            if (pairingCodes.isEmpty()) {
                String oldCode = prefs.getString("pairing_code", "");
                if (oldCode.isEmpty()) return;
            }

            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                try {
                    Object[] pdus = (Object[]) bundle.get("pdus");
                    if (pdus == null) return;
                    
                    StringBuilder fullMessage = new StringBuilder();
                    String sender = "";
                    
                    for (Object pdu : pdus) {
                        SmsMessage smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                        sender = smsMessage.getDisplayOriginatingAddress();
                        fullMessage.append(smsMessage.getMessageBody());
                    }

                    Log.d(TAG, "SMS Received From: " + sender);

                    // Determine which SIM slot received the SMS
                    int subId = bundle.getInt("subscription", -1);
                    int slotIndex = -1;
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && subId != -1) {
                        SubscriptionManager subscriptionManager = SubscriptionManager.from(context);
                        try {
                            List<SubscriptionInfo> activeSubscriptionInfoList = subscriptionManager.getActiveSubscriptionInfoList();
                            if (activeSubscriptionInfoList != null) {
                                for (SubscriptionInfo info : activeSubscriptionInfoList) {
                                    if (info.getSubscriptionId() == subId) {
                                        slotIndex = info.getSimSlotIndex();
                                        break;
                                    }
                                }
                            }
                        } catch (SecurityException e) {
                            Log.e(TAG, "No permission to read subscription info", e);
                        }
                    }

                    // Fallback to extras if SubscriptionManager fails
                    if (slotIndex == -1) {
                        slotIndex = bundle.getInt("phone", -1);
                        if (slotIndex == -1) {
                            slotIndex = bundle.getInt("slot", -1);
                        }
                    }

                    String simName;
                    if (slotIndex == 0) {
                        simName = prefs.getString("sim1_name", "SIM 1");
                    } else if (slotIndex == 1) {
                        simName = prefs.getString("sim2_name", "SIM 2");
                    } else {
                        simName = prefs.getString("sim1_name", "Unknown SIM");
                    }

                    // Insert as STATUS_SENDING into local SQLite DB
                    long logId = SmsLogDbHelper.getInstance(context.getApplicationContext()).insertLog(
                            sender, fullMessage.toString(), simName, SmsLog.STATUS_SENDING
                    );

                    // Publish to MQTT via Foreground Service
                    if (MqttService.instance != null) {
                        MqttService.instance.publishSms(logId, sender, fullMessage.toString(), simName);
                    } else {
                        Log.w(TAG, "MqttService instance is null! Kept queued as STATUS_SENDING. Restarting service...");
                        try {
                            Intent serviceIntent = new Intent(context, MqttService.class);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                context.startForegroundService(serviceIntent);
                            } else {
                                context.startService(serviceIntent);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Error restarting MqttService from receiver", e);
                        }
                    }

                    // Safe Toast feedback on UI thread
                    final String feedbackSim = simName;
                    new Handler(Looper.getMainLooper()).post(() -> {
                        try {
                            Toast.makeText(context.getApplicationContext(), "SMS Forwarded: " + feedbackSim, Toast.LENGTH_SHORT).show();
                        } catch (Exception ignored) {}
                    });

                } catch (Exception e) {
                    Log.e(TAG, "Error processing incoming SMS", e);
                }
            }
        }
    }
}
