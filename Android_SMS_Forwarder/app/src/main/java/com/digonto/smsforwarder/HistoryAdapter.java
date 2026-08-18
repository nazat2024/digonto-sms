package com.digonto.smsforwarder;

import android.content.Context;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class HistoryAdapter extends RecyclerView.Adapter<HistoryAdapter.ViewHolder> {

    private List<SmsLog> logs;
    private Context context;
    private SimpleDateFormat dateFormat;

    public HistoryAdapter(Context context, List<SmsLog> logs) {
        this.context = context;
        this.logs = logs;
        this.dateFormat = new SimpleDateFormat("MM/dd, hh:mm a", Locale.getDefault());
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_sms_log, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        try {
            SmsLog log = logs.get(position);
            
            holder.tvSender.setText(log.getSender());
            holder.tvBody.setText(log.getBody());
            holder.tvTime.setText(dateFormat.format(new Date(log.getTimestamp())));
            
            // Set SIM Info
            String simInfo = (log.getSimName() != null && !log.getSimName().isEmpty()) ? log.getSimName() : "Unknown SIM";
            holder.tvDestination.setText(simInfo + " ➔ Forwarded to Desktop");

            if (log.getStatus() == SmsLog.STATUS_SUCCESS) {
                holder.tvStatus.setText("Success");
                holder.tvStatus.setTextColor(Color.parseColor("#10B981")); // Green
            } else if (log.getStatus() == SmsLog.STATUS_FAILED) {
                holder.tvStatus.setText("Failed");
                holder.tvStatus.setTextColor(Color.parseColor("#EF4444")); // Red
            } else {
                holder.tvStatus.setText("Sending...");
                holder.tvStatus.setTextColor(Color.parseColor("#3B82F6")); // Blue
            }
            
            // Button always visible so user can resend
            holder.btnRetry.setVisibility(View.VISIBLE);

            holder.btnRetry.setOnClickListener(v -> {
                if (MqttService.instance != null) {
                    holder.tvStatus.setText("Retrying...");
                    holder.tvStatus.setTextColor(Color.parseColor("#F59E0B")); // Orange
                    holder.btnRetry.setVisibility(View.GONE);
                    
                    // Set status in DB to sending
                    SmsLogDbHelper.getInstance(context).updateStatus(log.getId(), SmsLog.STATUS_SENDING);
                    
                    // Attempt to publish again
                    MqttService.instance.publishSms(log.getSender(), log.getBody(), log.getSimName());
                    Toast.makeText(context, "Retrying SMS...", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(context, "Service not running. Please reconnect.", Toast.LENGTH_SHORT).show();
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public int getItemCount() {
        return logs.size();
    }
    
    public void updateData(List<SmsLog> newLogs) {
        this.logs = newLogs;
        notifyDataSetChanged();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvSender, tvStatus, tvDestination, tvBody, tvTime;
        Button btnRetry;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvSender = itemView.findViewById(R.id.tvSender);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            tvDestination = itemView.findViewById(R.id.tvDestination);
            tvBody = itemView.findViewById(R.id.tvBody);
            tvTime = itemView.findViewById(R.id.tvTime);
            btnRetry = itemView.findViewById(R.id.btnRetry);
        }
    }
}
