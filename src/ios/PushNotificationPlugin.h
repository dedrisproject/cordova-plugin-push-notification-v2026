/*
 * cordova-plugin-push-notification-v2026 — iOS (native APNs)
 * https://github.com/dedrisproject/cordova-plugin-push-notification-v2026
 */

#import <Cordova/CDVPlugin.h>
#import <UserNotifications/UserNotifications.h>

@interface PushNotificationPlugin : CDVPlugin <UNUserNotificationCenterDelegate>

@property (nonatomic, copy) NSString *eventCallbackId;
@property (nonatomic, assign) BOOL clearBadgeOnLaunch;

// Cordova actions
- (void)register:(CDVInvokedUrlCommand *)command;
- (void)unregister:(CDVInvokedUrlCommand *)command;
- (void)getToken:(CDVInvokedUrlCommand *)command;
- (void)subscribe:(CDVInvokedUrlCommand *)command;
- (void)unsubscribe:(CDVInvokedUrlCommand *)command;
- (void)setBadge:(CDVInvokedUrlCommand *)command;
- (void)getBadge:(CDVInvokedUrlCommand *)command;
- (void)clearNotifications:(CDVInvokedUrlCommand *)command;
- (void)hasPermission:(CDVInvokedUrlCommand *)command;
- (void)requestPermission:(CDVInvokedUrlCommand *)command;

@end
