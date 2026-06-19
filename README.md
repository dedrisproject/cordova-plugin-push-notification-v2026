<h1 align="center">🔔 cordova-plugin-push-notification-v2026</h1>

<p align="center">
  <strong>Zero-config push notifications for Apache Cordova.</strong><br />
  Firebase Cloud Messaging on Android · native APNs on iOS · you only write JavaScript.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cordova-plugin-push-notification-v2026"><img src="https://img.shields.io/npm/v/cordova-plugin-push-notification-v2026.svg?color=cb3837&logo=npm" alt="npm version" /></a>
  <a href="https://github.com/dedrisproject/cordova-plugin-push-notification-v2026/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/platforms-android%20%7C%20ios-brightgreen.svg" alt="Platforms" />
  <img src="https://img.shields.io/badge/cordova--android-%E2%89%A515-success.svg" alt="cordova-android" />
  <img src="https://img.shields.io/badge/cordova--ios-%E2%89%A58-success.svg" alt="cordova-ios" />
  <a href="https://github.com/dedrisproject/cordova-plugin-push-notification-v2026"><img src="https://img.shields.io/github/stars/dedrisproject/cordova-plugin-push-notification-v2026?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  ⭐ <strong>If this plugin saves you time, please <a href="https://github.com/dedrisproject/cordova-plugin-push-notification-v2026">give it a star on GitHub</a></strong> — it really helps! ⭐
</p>

---

## ✨ Why this plugin?

Most push plugins make you hand-edit Gradle files, AppDelegates, manifests and entitlements. This one does the boring wiring **for you**:

| Task | Other plugins | This plugin |
| ---- | ------------- | ----------- |
| Apply the Firebase `google-services` Gradle plugin | manual | ✅ automatic |
| Copy `google-services.json` into the build | manual | ✅ automatic (build hook) |
| Request `POST_NOTIFICATIONS` (Android 13+) | manual | ✅ automatic |
| Add the iOS *Push Notifications* entitlement | manual (Xcode) | ✅ automatic (`plugin.xml`) |
| Add the `remote-notification` background mode | manual | ✅ automatic |
| Foreground / background / tap handling | varies | ✅ unified events |
| TypeScript types | rarely | ✅ included |

The only thing **you** provide is your Firebase / Apple credentials. Everything else is one `register()` call.

---

## 📦 Installation

```bash
cordova plugin add cordova-plugin-push-notification-v2026
```

> Requires **cordova-android ≥ 14** (tested on 15) and **cordova-ios ≥ 7** (tested on 8.1).

---

## 🤖 Android setup (Firebase Cloud Messaging)

1. Create a project in the [Firebase Console](https://console.firebase.google.com/) and add an **Android app** using your app's package id (the `id` in `config.xml`).
2. Download **`google-services.json`**.
3. Drop it in your **project root** (next to `config.xml`):

   ```
   my-app/
   ├── config.xml
   ├── google-services.json   ← here
   └── www/
   ```

   The plugin's build hook copies it into `platforms/android/app/` on every build and auto-applies the Firebase Gradle plugin. **No Gradle editing required.**

4. Build & run:

   ```bash
   cordova run android
   ```

> 💡 Other accepted locations: `res/`, `www/`, or a `google-services/` folder. Keep `google-services.json` out of version control (it's already in `.gitignore`).

---

## 🍏 iOS setup (Apple Push Notification service)

The plugin adds the **Push Notifications capability**, the `aps-environment` entitlement and the `remote-notification` background mode automatically. You only need a signing identity:

1. In the [Apple Developer portal](https://developer.apple.com/account/resources/authkeys/list), create an **APNs Auth Key (.p8)** (recommended) — you'll use it on your push server.
2. Add the iOS platform and open the workspace:

   ```bash
   cordova platform add ios
   open platforms/ios/*.xcworkspace
   ```
3. Under **Signing & Capabilities**, select your **Team**. (The *Push Notifications* capability is already present.)
4. Run on a **physical device** — the simulator can't receive remote pushes:

   ```bash
   cordova run ios --device
   ```

---

## 🚀 Quick start

```js
document.addEventListener('deviceready', async () => {
  const push = cordova.plugins.pushNotification;

  // Fires for every incoming notification (foreground, background-tap, etc.)
  push.on('notification', (n) => {
    console.log('Notification:', n.title, n.body, n.data);
    if (n.tap) {
      // The user tapped the notification — navigate accordingly.
    }
  });

  push.on('error', (e) => console.error('Push error:', e.message));

  // Requests permission, registers with FCM/APNs and returns the token.
  const { token, platform, registrationType } = await push.register();
  console.log(`Registered on ${platform} (${registrationType}):`, token);

  // Send `token` to your backend to target this device.
});
```

That's the whole integration. 🎉

---

## 📖 API

All methods return a `Promise`. The module is clobbered onto `cordova.plugins.pushNotification`.

### `register(options?) → Promise<RegistrationResult>`

Requests permission, registers with FCM/APNs, starts event delivery and resolves with the device token.

```ts
interface RegisterOptions {
  alert?: boolean;       // iOS — request alert permission (default true)
  badge?: boolean;       // iOS — request badge permission (default true)
  sound?: boolean;       // iOS — request sound permission (default true)
  clearBadge?: boolean;  // iOS — reset badge on launch (default true)
  android?: {
    channelId?: string;            // default "push_default"
    channelName?: string;          // shown in system settings
    importance?: 'high' | 'default' | 'low' | 'min';
    forceShow?: boolean;           // show a tray notification even in foreground
  };
}

interface RegistrationResult {
  token: string;
  platform: 'android' | 'ios';
  registrationType: 'FCM' | 'APNS';
}
```

### Events — `on(event, cb)` / `once(event, cb)` / `off(event, cb?)`

| Event | Payload | When |
| ----- | ------- | ---- |
| `registration` | `{ token, platform, registrationType }` | Token obtained / changed |
| `notification` | see below | A push arrives or is tapped |
| `tokenRefresh` | `{ token }` | The FCM token rotated |
| `error` | `{ message, code? }` | Something failed |

**`notification` payload**

```ts
{
  title?: string;
  body?: string;
  data: Record<string, any>;  // your custom key/values
  foreground: boolean;        // received while app was visible
  tap: boolean;               // user tapped the notification
  badge?: number;             // iOS
  sound?: string;
  messageId?: string;
}
```

### Other methods

| Method | Platform | Description |
| ------ | -------- | ----------- |
| `getToken()` | both | Resolve the current device token |
| `subscribe(topic)` | Android | Join an FCM topic (no-op on iOS) |
| `unsubscribe(topic)` | Android | Leave an FCM topic |
| `unregister()` | both | Stop notifications and delete the token |
| `setBadge(n)` / `getBadge()` | iOS | Manage the app icon badge |
| `clearNotifications()` | both | Remove delivered notifications |
| `hasPermission()` | both | `true` if notifications are authorised |
| `requestPermission()` | both | Explicitly prompt for permission |

---

## 📤 Sending a notification (server side)

### Android / cross-platform via FCM HTTP v1

```bash
curl -X POST \
  https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "DEVICE_FCM_TOKEN",
      "notification": { "title": "Hello 👋", "body": "Sent via FCM v1" },
      "data": { "screen": "inbox", "id": "42" }
    }
  }'
```

> Use a **data** payload (or `data` alongside `notification`) to receive custom key/values in the `notification` event's `data` field.

### iOS via APNs (token-based auth, `.p8` key)

```bash
curl -v \
  --http2 \
  --header "apns-topic: com.dedrisproject.pushdemo" \
  --header "apns-push-type: alert" \
  --header "authorization: bearer $APNS_JWT" \
  --data '{
    "aps": { "alert": { "title": "Hello 👋", "body": "Sent via APNs" }, "sound": "default", "badge": 1 },
    "screen": "inbox", "id": "42"
  }' \
  https://api.push.apple.com/3/device/DEVICE_APNS_TOKEN
```

> Keys outside the `aps` object are delivered as `data` in the `notification` event.

---

## 🧪 Sample app

A complete, runnable demo for **Android and iOS** lives in [`example/`](example/) — register, receive, topics, badge and a live event log.

```bash
cd example
./setup.sh          # adds the plugin + both platforms
cordova run android # or: cordova run ios --device
```

See [`example/README.md`](example/README.md) for details.

---

## 🛠 Troubleshooting

<details>
<summary><strong>Android build fails: "File google-services.json is missing"</strong></summary>

Place `google-services.json` in your project root (next to `config.xml`) and rebuild. The plugin warns at build time if it can't find it.
</details>

<details>
<summary><strong>No token / "Firebase not initialised"</strong></summary>

The package id in `google-services.json` must exactly match your `config.xml` `id`. Re-download the file from Firebase if you changed the id.
</details>

<details>
<summary><strong>iOS: not receiving pushes</strong></summary>

- Test on a **real device** (the simulator can't receive remote pushes).
- Make sure a signing **Team** is selected and the provisioning profile includes the Push Notifications capability.
- Production builds use `aps-environment = production`; send to `api.push.apple.com`. Debug builds use `development`; send to `api.sandbox.push.apple.com`.
</details>

<details>
<summary><strong>Android 13+: notifications don't appear</strong></summary>

`register()` requests the `POST_NOTIFICATIONS` runtime permission. If the user previously denied it, send them to system settings to re-enable.
</details>

---

## 📋 Compatibility

| Component | Version |
| --------- | ------- |
| Cordova CLI | ≥ 12 |
| cordova-android | ≥ 14 (tested 15) |
| cordova-ios | ≥ 7 (tested 8.1) |
| Android min SDK | 24 |
| iOS deployment target | 13.0 |
| Firebase Messaging | 24.x |

---

## 🤝 Contributing

Issues and PRs are very welcome! If you find a bug or want a feature, open an
[issue](https://github.com/dedrisproject/cordova-plugin-push-notification-v2026/issues).

## ⭐ Star the repo

If this plugin helped you ship faster, please **[star it on GitHub](https://github.com/dedrisproject/cordova-plugin-push-notification-v2026)** — it motivates continued maintenance and helps other developers find it. Thank you! 🙏

## 📄 License

[MIT](LICENSE) © dedrisproject
