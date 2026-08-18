package com.digonto.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Log;
import android.widget.Toast;

import java.util.List;

public class SmsReceiver extends BroadcastReceiver {
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction() != null && intent.getAction().equals("android.provider.Telephony.SMS_RECEIVED")) {
            SharedPreferences prefs = context.getSharedPreferences("SMSConfig", Context.MODE_PRIVATE);
            String pairingCode = prefs.getString("pairing_code", "");
            if (pairingCode.isEmpty()) return;

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

                    Log.d("SmsReceiver", "SMS From: " + sender);

                    // Determine which SIM slot received the SMS
                    int subId = bundle.getInt("subscription", -1);
                    int slotIndex = -1;
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1 && subId != -1) {
                        SubscriptionManager subscriptionManager = SubscriptionManager.from(context);
                        try {
                            // Suppress permission check because we might not have READ_PHONE_STATE,
                            // but we can sometimes still read active subscription info if the OS allows.
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
                            Log.e("SmsReceiver", "No permission to read subscription info", e);
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

                    // Publish to MQTT via Foreground Service
                    if (MqttService.instance != null) {
                        MqttService.instance.publishSms(sender, fullMessage.toString(), simName);
                        // Show visual feedback that SMS was forwarded
                        Toast.makeText(context, "SMS Forwarded: " + simName, Toast.LENGTH_SHORT).show();
                    } else {
                        Log.e("SmsReceiver", "MqttService is not running!");
                        Toast.makeText(context, "Failed to forward SMS. Service stopped.", Toast.LENGTH_LONG).show();
                    }

                } catch (Exception e) {
                    Log.e("SmsReceiver", "Error", e);
                }
            }
        }
    }
}