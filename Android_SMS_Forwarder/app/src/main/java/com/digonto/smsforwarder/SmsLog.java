package com.digonto.smsforwarder;

public class SmsLog {
    public static final int STATUS_SENDING = 0;
    public static final int STATUS_SUCCESS = 1;
    public static final int STATUS_FAILED = 2;

    private long id;
    private String sender;
    private String body;
    private String simName;
    private int status;
    private long timestamp;

    public SmsLog(long id, String sender, String body, String simName, int status, long timestamp) {
        this.id = id;
        this.sender = sender;
        this.body = body;
        this.simName = simName;
        this.status = status;
        this.timestamp = timestamp;
    }

    public long getId() { return id; }
    public String getSender() { return sender; }
    public String getBody() { return body; }
    public String getSimName() { return simName; }
    public int getStatus() { return status; }
    public long getTimestamp() { return timestamp; }

    public void setStatus(int status) { this.status = status; }
}
