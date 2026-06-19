package com.dedrisproject.pushnotification;

import android.app.ActivityManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;
import java.util.Map;

/**
 * Receives FCM messages. Foreground messages are forwarded straight to
 * JavaScript; background/data messages are rendered as a system notification
 * whose tap re-opens the app and replays the payload to JS.
 */
public class PushFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "PushNotification";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        try {
            JSONObject ev = new JSONObject();
            ev.put("event", "tokenRefresh");
            ev.put("token", token);
            PushNotificationPlugin.sendEvent(ev);
        } catch (JSONException e) {
            Log.e(TAG, "onNewToken serialization failed", e);
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);

        JSONObject data = new JSONObject();
        for (Map.Entry<String, String> entry : message.getData().entrySet()) {
            try { data.put(entry.getKey(), entry.getValue()); } catch (JSONException ignored) { }
        }

        String title = null;
        String body = null;
        RemoteMessage.Notification n = message.getNotification();
        if (n != null) {
            title = n.getTitle();
            body = n.getBody();
        }
        if (title == null) { title = data.optString("title", null); }
        if (body == null) { body = data.optString("body", null); }

        boolean foreground = isAppInForeground();

        if (foreground) {
            // App is active — hand the payload straight to JS.
            emitNotification(title, body, data, true, false, message.getMessageId());
            if (PushNotificationPlugin.shouldForceShow() && (title != null || body != null)) {
                showNotification(title, body, data);
            }
        } else {
            // App is backgrounded/closed — surface a tappable system notification.
            showNotification(title, body, data);
        }
    }

    private void emitNotification(String title, String body, JSONObject data,
                                  boolean foreground, boolean tap, String messageId) {
        try {
            JSONObject ev = new JSONObject();
            ev.put("event", "notification");
            ev.put("title", title);
            ev.put("body", body);
            ev.put("data", data);
            ev.put("foreground", foreground);
            ev.put("tap", tap);
            if (messageId != null) { ev.put("messageId", messageId); }
            PushNotificationPlugin.sendEvent(ev);
        } catch (JSONException e) {
            Log.e(TAG, "emitNotification failed", e);
        }
    }

    private void showNotification(String title, String body, JSONObject data) {
        Context ctx = getApplicationContext();

        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) { launch = new Intent(); }
        launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launch.putExtra(PushNotificationPlugin.EXTRA_PUSH_TAP, true);
        launch.putExtra(PushNotificationPlugin.EXTRA_PUSH_DATA, data.toString());
        if (title != null) { launch.putExtra("title", title); }
        if (body != null) { launch.putExtra("body", body); }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { flags |= PendingIntent.FLAG_IMMUTABLE; }
        int requestCode = (int) (System.currentTimeMillis() & 0xfffffff);
        PendingIntent contentIntent = PendingIntent.getActivity(ctx, requestCode, launch, flags);

        int smallIcon = ctx.getApplicationInfo().icon;

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(ctx, PushNotificationPlugin.getChannelId())
                        .setSmallIcon(smallIcon)
                        .setContentTitle(title != null ? title : appName(ctx))
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setContentIntent(contentIntent);

        if (body != null) {
            builder.setContentText(body);
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        }

        try {
            NotificationManagerCompat.from(ctx).notify(requestCode, builder.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS not granted (Android 13+).
            Log.w(TAG, "Cannot post notification — permission not granted", e);
        }
    }

    private CharSequence appName(Context ctx) {
        return ctx.getApplicationInfo().loadLabel(ctx.getPackageManager());
    }

    private boolean isAppInForeground() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) { return false; }
        List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
        if (processes == null) { return false; }
        String packageName = getPackageName();
        for (ActivityManager.RunningAppProcessInfo info : processes) {
            if (info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                    && info.processName.equals(packageName)) {
                return true;
            }
        }
        return false;
    }
}
