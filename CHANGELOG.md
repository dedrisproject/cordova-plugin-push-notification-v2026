# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2026-06-19

### Added
- Initial release. 🎉
- **Android**: Firebase Cloud Messaging (FCM) support with automatic
  `google-services` Gradle plugin application and `google-services.json` copy hook.
- **iOS**: native Apple Push Notification service (APNs) support with
  automatic `aps-environment` entitlement and `remote-notification` background mode.
- Automatic runtime permission handling (`POST_NOTIFICATIONS` on Android 13+, `UNUserNotificationCenter` on iOS).
- Promise-based `register()` plus an event API (`registration`, `notification`, `tokenRefresh`, `error`).
- FCM topic subscribe/unsubscribe, badge management (iOS), notification clearing.
- Foreground, background and cold-start (tap) notification delivery.
- TypeScript definitions.
- Runnable sample app for Android and iOS under `example/`.

[1.0.0]: https://github.com/dedrisproject/cordova-plugin-push-notification-v2026/releases/tag/v1.0.0
