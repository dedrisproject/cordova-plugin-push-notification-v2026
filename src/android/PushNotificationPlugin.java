package com.dedrisproject.pushnotification;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessaging;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Cordova bridge for Firebase Cloud Messaging. Handles permission, token
 * retrieval, topic (un)subscription and streams push events to JavaScript.
 */
public class PushNotificationPlugin extends CordovaPlugin {

    private static final String TAG = "PushNotification";
    private static final int REQ_POST_NOTIFICATIONS = 7593;
    private static final String POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS";

    public static final String EXTRA_PUSH_DATA = "pushNotificationData";
    public static final String EXTRA_PUSH_TAP = "pushNotificationTap";

    /** Shared, statically held so the FirebaseMessagingService can reach JS. */
    private static PushNotificationPlugin instance;
    private static CallbackContext eventCallback;
    private static final List<JSONObject> pendingEvents = new ArrayList<JSONObject>();

    private static String channelId = "push_default";
    private static String channelName = "Notifications";
    private static String channelImportance = "high";
    private static boolean forceShow = false;

    private CallbackContext permissionCallback;

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        instance = this;
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        switch (action) {
            case "register":
                register(args.optJSONObject(0), callbackContext);
                return true;
            case "unregister":
                unregister(callbackContext);
                return true;
            case "getToken":
                getToken(callbackContext);
                return true;
            case "subscribe":
                topic(args.optString(0), true, callbackContext);
                return true;
            case "unsubscribe":
                topic(args.optString(0), false, callbackContext);
                return true;
            case "clearNotifications":
                clearNotifications(callbackContext);
                return true;
            case "hasPermission":
                callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, hasPermission()));
                return true;
            case "requestPermission":
                permissionCallback = callbackContext;
                requestNotificationPermission();
                return true;
            // iOS-only operations resolve as no-ops on Android.
            case "setBadge":
            case "getBadge":
                callbackContext.success();
                return true;
            default:
                return false;
        }
    }

    // ----------------------------------------------------------------- register

    private void register(JSONObject options, final CallbackContext callbackContext) {
        if (options != null) {
            JSONObject android = options.optJSONObject("android");
            if (android != null) {
                channelId = android.optString("channelId", channelId);
                channelName = android.optString("channelName", channelName);
                channelImportance = android.optString("importance", channelImportance);
                forceShow = android.optBoolean("forceShow", forceShow);
            }
        }

        eventCallback = callbackContext;
        createDefaultChannel();
        requestNotificationPermission();

        cordova.getThreadPool().execute(new Runnable() {
            @Override
            public void run() {
                fetchToken();
            }
        });

        // Replay anything that arrived before JS was ready (e.g. cold start by tap).
        flushPendingEvents();

        // The activity may have been launched by tapping a notification.
        handleLaunchIntent();
    }

    private void fetchToken() {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(new com.google.android.gms.tasks.OnCompleteListener<String>() {
                @Override
                public void onComplete(com.google.android.gms.tasks.Task<String> task) {
                    if (!task.isSuccessful() || task.getResult() == null) {
                        emitError("Failed to obtain FCM token: "
                                + (task.getException() != null ? task.getException().getMessage() : "unknown"));
                        return;
                    }
                    try {
                        JSONObject ev = new JSONObject();
                        ev.put("event", "registration");
                        ev.put("token", task.getResult());
                        ev.put("registrationId", task.getResult());
                        ev.put("registrationType", "FCM");
                        ev.put("platform", "android");
                        sendEvent(ev);
                    } catch (JSONException e) {
                        emitError("Registration serialization failed: " + e.getMessage());
                    }
                }
            });
        } catch (Exception e) {
            emitError("Firebase not initialised. Is google-services.json present? " + e.getMessage());
        }
    }

    private void getToken(final CallbackContext cb) {
        cordova.getThreadPool().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    FirebaseMessaging.getInstance().getToken().addOnCompleteListener(new com.google.android.gms.tasks.OnCompleteListener<String>() {
                        @Override
                        public void onComplete(com.google.android.gms.tasks.Task<String> task) {
                            if (task.isSuccessful() && task.getResult() != null) {
                                cb.success(task.getResult());
                            } else {
                                cb.error("Failed to obtain FCM token");
                            }
                        }
                    });
                } catch (Exception e) {
                    cb.error(e.getMessage());
                }
            }
        });
    }

    private void unregister(final CallbackContext cb) {
        cordova.getThreadPool().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(new com.google.android.gms.tasks.OnCompleteListener<Void>() {
                        @Override
                        public void onComplete(com.google.android.gms.tasks.Task<Void> task) {
                            eventCallback = null;
                            if (task.isSuccessful()) { cb.success(); } else { cb.error("Failed to delete token"); }
                        }
                    });
                } catch (Exception e) {
                    cb.error(e.getMessage());
                }
            }
        });
    }

    private void topic(final String topic, final boolean subscribe, final CallbackContext cb) {
        if (topic == null || topic.isEmpty()) { cb.error("Topic is required"); return; }
        com.google.android.gms.tasks.Task<Void> task = subscribe
                ? FirebaseMessaging.getInstance().subscribeToTopic(topic)
                : FirebaseMessaging.getInstance().unsubscribeFromTopic(topic);
        task.addOnCompleteListener(new com.google.android.gms.tasks.OnCompleteListener<Void>() {
            @Override
            public void onComplete(com.google.android.gms.tasks.Task<Void> t) {
                if (t.isSuccessful()) { cb.success(); }
                else { cb.error("Topic operation failed for '" + topic + "'"); }
            }
        });
    }

    private void clearNotifications(CallbackContext cb) {
        NotificationManagerCompat.from(getContext()).cancelAll();
        cb.success();
    }

    // -------------------------------------------------------------- permissions

    private boolean hasPermission() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !cordova.hasPermission(POST_NOTIFICATIONS)) {
            cordova.requestPermission(this, REQ_POST_NOTIFICATIONS, POST_NOTIFICATIONS);
        } else if (permissionCallback != null) {
            permissionCallback.sendPluginResult(new PluginResult(PluginResult.Status.OK, hasPermission()));
            permissionCallback = null;
        }
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQ_POST_NOTIFICATIONS) { return; }
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (permissionCallback != null) {
            permissionCallback.sendPluginResult(new PluginResult(PluginResult.Status.OK, granted));
            permissionCallback = null;
        }
        if (!granted) {
            emitError("POST_NOTIFICATIONS permission denied");
        }
    }

    // ------------------------------------------------------------- channel / UI

    private void createDefaultChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { return; }
        int importance;
        switch (channelImportance) {
            case "default": importance = NotificationManager.IMPORTANCE_DEFAULT; break;
            case "low":     importance = NotificationManager.IMPORTANCE_LOW; break;
            case "min":     importance = NotificationManager.IMPORTANCE_MIN; break;
            default:        importance = NotificationManager.IMPORTANCE_HIGH; break;
        }
        NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
        channel.enableVibration(true);
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) { nm.createNotificationChannel(channel); }
    }

    // ------------------------------------------------------------- intent / tap

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        emitTapFromIntent(intent);
    }

    private void handleLaunchIntent() {
        Activity activity = cordova.getActivity();
        if (activity != null) {
            emitTapFromIntent(activity.getIntent());
        }
    }

    private void emitTapFromIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_PUSH_TAP, false)) { return; }
        try {
            String raw = intent.getStringExtra(EXTRA_PUSH_DATA);
            JSONObject data = (raw != null) ? new JSONObject(raw) : new JSONObject();
            JSONObject ev = new JSONObject();
            ev.put("event", "notification");
            ev.put("data", data);
            ev.put("title", data.optString("title", intent.getStringExtra("title")));
            ev.put("body", data.optString("body", intent.getStringExtra("body")));
            ev.put("foreground", false);
            ev.put("tap", true);
            sendEvent(ev);
            // Consume so we don't re-fire on the next resume.
            intent.removeExtra(EXTRA_PUSH_TAP);
        } catch (JSONException e) {
            Log.e(TAG, "Failed to parse tapped notification data", e);
        }
    }

    // --------------------------------------------------------- event plumbing

    /** Called by PushFirebaseMessagingService and internally. Thread-safe enough. */
    public static synchronized void sendEvent(JSONObject event) {
        if (eventCallback != null) {
            PluginResult result = new PluginResult(PluginResult.Status.OK, event);
            result.setKeepCallback(true);
            eventCallback.sendPluginResult(result);
        } else {
            pendingEvents.add(event);
        }
    }

    private void flushPendingEvents() {
        synchronized (PushNotificationPlugin.class) {
            if (eventCallback == null) { return; }
            for (Iterator<JSONObject> it = pendingEvents.iterator(); it.hasNext(); ) {
                PluginResult result = new PluginResult(PluginResult.Status.OK, it.next());
                result.setKeepCallback(true);
                eventCallback.sendPluginResult(result);
                it.remove();
            }
        }
    }

    private void emitError(String message) {
        try {
            JSONObject ev = new JSONObject();
            ev.put("event", "error");
            ev.put("message", message);
            sendEvent(ev);
        } catch (JSONException ignored) { }
        Log.w(TAG, message);
    }

    // ------------------------------------------------------------------ helpers

    static boolean shouldForceShow() { return forceShow; }
    static String getChannelId() { return channelId; }

    private Context getContext() {
        return cordova.getActivity().getApplicationContext();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (instance == this) { instance = null; }
    }
}
