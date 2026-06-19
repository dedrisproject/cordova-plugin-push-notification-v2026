# PushDemo — sample app

A minimal Cordova app that exercises every feature of
**[cordova-plugin-push-notification-v2026](https://github.com/dedrisproject/cordova-plugin-push-notification-v2026)**:
register, receive (foreground / background / tap), FCM topics, badge and clear.

<p align="center">⭐ If this helped, please <a href="https://github.com/dedrisproject/cordova-plugin-push-notification-v2026">star the repo</a>!</p>

## Prerequisites

- Node.js ≥ 18 and `cordova` CLI ≥ 12 (`npm i -g cordova`)
- **Android**: Android Studio / SDK, a `google-services.json` from your Firebase project
- **iOS**: macOS + Xcode, an Apple Developer account with the *Push Notifications* capability

## Quick start

```bash
cd example
./setup.sh            # adds the plugin (from local source) + android & ios platforms
```

### Android

1. Create a Firebase project → add an Android app with package id `com.dedrisproject.pushdemo`.
2. Download **google-services.json** and drop it into this `example/` folder.
3. Run:
   ```bash
   cordova run android
   ```
4. Send a test message from **Firebase Console → Messaging**, or via the API
   (see the main README for `curl` examples). Use the token printed in the app.

### iOS

1. Open the workspace:
   ```bash
   open platforms/ios/PushDemo.xcworkspace
   ```
2. Select your **Team** under *Signing & Capabilities* (the *Push Notifications*
   capability and background mode are already added by the plugin).
3. Run on a **real device** (the simulator cannot receive remote pushes):
   ```bash
   cordova run ios --device
   ```
4. Send a test push to the APNs token shown in the app (see the main README).

## What to try in the app

| Button | What it does |
| ------ | ------------ |
| **Register** | Requests permission and prints the device token |
| **Check permission** | Logs whether notifications are authorised |
| **Set badge (3)** | Sets the app icon badge (iOS) |
| **Clear notifications** | Removes delivered notifications |
| **Subscribe / Unsubscribe** | Joins/leaves an FCM topic (Android) |

The **event log** shows registration, token refresh and every incoming
notification tagged `foreground`, `background` or `tapped`.
