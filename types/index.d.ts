// Type definitions for cordova-plugin-push-notification-v2026
// Project: https://github.com/dedrisproject/cordova-plugin-push-notification-v2026

export type RegistrationType = 'FCM' | 'APNS';

export interface AndroidOptions {
  /** Default notification channel id (Android 8+). Defaults to "push_default". */
  channelId?: string;
  /** Human-readable channel name shown in system settings. */
  channelName?: string;
  /** Channel importance: "high" | "default" | "low" | "min". Defaults to "high". */
  importance?: 'high' | 'default' | 'low' | 'min';
  /**
   * Show a notification in the tray even when a *data* message arrives while
   * the app is in the foreground. Defaults to false (foreground data messages
   * are delivered only to JS via the `notification` event).
   */
  forceShow?: boolean;
}

export interface RegisterOptions {
  /** Request alert permission (iOS). Defaults to true. */
  alert?: boolean;
  /** Request badge permission (iOS). Defaults to true. */
  badge?: boolean;
  /** Request sound permission (iOS). Defaults to true. */
  sound?: boolean;
  /** Reset the app badge to 0 on launch (iOS). Defaults to true. */
  clearBadge?: boolean;
  /** Android-specific configuration. */
  android?: AndroidOptions;
}

export interface RegistrationResult {
  /** The FCM (Android) or APNs (iOS) device token. */
  token: string;
  /** The running platform: "android" | "ios". */
  platform: string;
  /** Which push service produced the token. */
  registrationType: RegistrationType;
}

export interface RegistrationEvent extends RegistrationResult {
  event: 'registration';
}

export interface TokenRefreshEvent {
  event: 'tokenRefresh';
  token: string;
}

export interface NotificationEvent {
  event: 'notification';
  /** Notification title (from the `notification` payload, if any). */
  title?: string;
  /** Notification body text. */
  body?: string;
  /** Free-form key/value data payload. */
  data: Record<string, any>;
  /** True if received while the app was in the foreground. */
  foreground: boolean;
  /** True if the event was triggered by the user tapping the notification. */
  tap: boolean;
  /** Badge number carried by the payload, if any (iOS). */
  badge?: number;
  /** Sound name carried by the payload, if any. */
  sound?: string;
  /** Message id assigned by FCM / APNs. */
  messageId?: string;
}

export interface PushError {
  event?: 'error';
  message: string;
  code?: string | number;
}

export interface PushNotificationStatic {
  /** Default Android channel id used by the plugin. */
  readonly DEFAULT_CHANNEL_ID: string;

  /**
   * Initialise push notifications: request permission, register with
   * FCM / APNs and start delivering events. Resolves with the device token.
   */
  register(options?: RegisterOptions): Promise<RegistrationResult>;

  on(event: 'registration', cb: (data: RegistrationEvent) => void): PushNotificationStatic;
  on(event: 'notification', cb: (data: NotificationEvent) => void): PushNotificationStatic;
  on(event: 'tokenRefresh', cb: (data: TokenRefreshEvent) => void): PushNotificationStatic;
  on(event: 'error', cb: (err: PushError) => void): PushNotificationStatic;
  on(event: string, cb: (data: any) => void): PushNotificationStatic;

  once(event: string, cb: (data: any) => void): PushNotificationStatic;
  off(event: string, cb?: (data: any) => void): PushNotificationStatic;

  /** Returns the current device token. */
  getToken(): Promise<string>;

  /** Subscribe to an FCM topic (Android). No-op on iOS. */
  subscribe(topic: string): Promise<void>;
  /** Unsubscribe from an FCM topic (Android). No-op on iOS. */
  unsubscribe(topic: string): Promise<void>;

  /** Stop receiving notifications and delete the token. */
  unregister(): Promise<void>;

  /** Set the app icon badge number (iOS). 0 clears it. */
  setBadge(count: number): Promise<void>;
  /** Get the current app icon badge number (iOS). */
  getBadge(): Promise<number>;

  /** Remove all delivered notifications from the tray / notification center. */
  clearNotifications(): Promise<void>;

  /** Whether notification permission is currently granted. */
  hasPermission(): Promise<boolean>;
  /** Explicitly prompt for notification permission. */
  requestPermission(): Promise<boolean>;
}

declare const PushNotification: PushNotificationStatic;
export default PushNotification;
export as namespace PushNotification;
