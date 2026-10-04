package com.digonto.smsforwarder.proxy;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.telephony.TelephonyManager;
import android.util.Log;

import java.net.Socket;

/**
 * Manages cellular (4G/LTE) network binding so that outbound proxy sockets
 * are strictly routed through the mobile SIM interface even when Wi-Fi is active.
 */
public class CellularNetworkBinder {
    private static final String TAG = "CellularNetworkBinder";

    public interface OnCellularStateListener {
        void onCellularAvailable(String carrierName);
        void onCellularLost();
    }

    private final Context context;
    private final ConnectivityManager connectivityManager;
    private Network cellularNetwork;
    private ConnectivityManager.NetworkCallback networkCallback;
    private OnCellularStateListener listener;
    private boolean isRegistered = false;

    public CellularNetworkBinder(Context context) {
        this.context = context.getApplicationContext();
        this.connectivityManager = (ConnectivityManager) this.context.getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    public void setListener(OnCellularStateListener listener) {
        this.listener = listener;
    }

    public synchronized void start() {
        if (isRegistered || connectivityManager == null) return;

        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
                .build();

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                super.onAvailable(network);
                synchronized (CellularNetworkBinder.this) {
                    cellularNetwork = network;
                }
                String carrier = getCarrierName();
                Log.d(TAG, "Cellular 4G network acquired: " + network + " (Carrier: " + carrier + ")");
                if (listener != null) {
                    listener.onCellularAvailable(carrier);
                }
            }

            @Override
            public void onLost(Network network) {
                super.onLost(network);
                synchronized (CellularNetworkBinder.this) {
                    if (cellularNetwork != null && cellularNetwork.equals(network)) {
                        cellularNetwork = null;
                    }
                }
                Log.w(TAG, "Cellular 4G network lost");
                if (listener != null) {
                    listener.onCellularLost();
                }
            }
        };

        try {
            connectivityManager.requestNetwork(request, networkCallback);
            isRegistered = true;
            Log.d(TAG, "Requested cellular network binding");
        } catch (Exception e) {
            Log.e(TAG, "Error requesting cellular network: " + e.getMessage());
        }
    }

    public synchronized void stop() {
        if (!isRegistered || connectivityManager == null) return;
        try {
            if (networkCallback != null) {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering network callback: " + e.getMessage());
        } finally {
            isRegistered = false;
            cellularNetwork = null;
        }
    }

    /**
     * Binds a client/outbound socket to the cellular 4G network interface.
     */
    public synchronized boolean bindSocket(Socket socket) {
        if (socket == null || socket.isClosed()) return false;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (cellularNetwork != null) {
                try {
                    cellularNetwork.bindSocket(socket);
                    return true;
                } catch (Exception e) {
                    Log.w(TAG, "Failed to bind socket to cellular network: " + e.getMessage());
                }
            }
        }
        return false;
    }

    public synchronized boolean isCellularAvailable() {
        return cellularNetwork != null;
    }

    public String getCarrierName() {
        try {
            TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm != null) {
                String name = tm.getNetworkOperatorName();
                if (name != null && !name.trim().isEmpty()) {
                    return name.trim();
                }
                name = tm.getSimOperatorName();
                if (name != null && !name.trim().isEmpty()) {
                    return name.trim();
                }
            }
        } catch (Exception ignored) {}
        return "Cellular 4G";
    }
}
