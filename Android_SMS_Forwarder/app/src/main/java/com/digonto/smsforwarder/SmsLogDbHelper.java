package com.digonto.smsforwarder;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

public class SmsLogDbHelper extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "sms_history.db";
    private static final int DATABASE_VERSION = 1;

    public static final String TABLE_NAME = "sms_logs";
    public static final String COL_ID = "id";
    public static final String COL_SENDER = "sender";
    public static final String COL_BODY = "body";
    public static final String COL_SIM_NAME = "sim_name";
    public static final String COL_STATUS = "status";
    public static final String COL_TIMESTAMP = "timestamp";

    private static SmsLogDbHelper instance;

    public static synchronized SmsLogDbHelper getInstance(Context context) {
        if (instance == null) {
            instance = new SmsLogDbHelper(context.getApplicationContext());
        }
        return instance;
    }

    private SmsLogDbHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        String createTable = "CREATE TABLE " + TABLE_NAME + " (" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                COL_SENDER + " TEXT, " +
                COL_BODY + " TEXT, " +
                COL_SIM_NAME + " TEXT, " +
                COL_STATUS + " INTEGER, " +
                COL_TIMESTAMP + " INTEGER)";
        db.execSQL(createTable);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_NAME);
        onCreate(db);
    }

    public long insertLog(String sender, String body, String simName, int status) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put(COL_SENDER, sender);
        values.put(COL_BODY, body);
        values.put(COL_SIM_NAME, simName);
        values.put(COL_STATUS, status);
        values.put(COL_TIMESTAMP, System.currentTimeMillis());
        
        long id = db.insert(TABLE_NAME, null, values);
        Log.d("SmsLogDb", "Inserted log: ID " + id);
        return id;
    }

    public void updateStatus(long id, int newStatus) {
        SQLiteDatabase db = this.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put(COL_STATUS, newStatus);
        db.update(TABLE_NAME, values, COL_ID + " = ?", new String[]{String.valueOf(id)});
        Log.d("SmsLogDb", "Updated log " + id + " to status " + newStatus);
    }

    public List<SmsLog> getAllLogs() {
        List<SmsLog> logs = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        Cursor cursor = db.query(TABLE_NAME, null, null, null, null, null, COL_TIMESTAMP + " DESC");

        if (cursor.moveToFirst()) {
            do {
                SmsLog log = new SmsLog(
                        cursor.getLong(cursor.getColumnIndexOrThrow(COL_ID)),
                        cursor.getString(cursor.getColumnIndexOrThrow(COL_SENDER)),
                        cursor.getString(cursor.getColumnIndexOrThrow(COL_BODY)),
                        cursor.getString(cursor.getColumnIndexOrThrow(COL_SIM_NAME)),
                        cursor.getInt(cursor.getColumnIndexOrThrow(COL_STATUS)),
                        cursor.getLong(cursor.getColumnIndexOrThrow(COL_TIMESTAMP))
                );
                logs.add(log);
            } while (cursor.moveToNext());
        }
        cursor.close();
        return logs;
    }
}
