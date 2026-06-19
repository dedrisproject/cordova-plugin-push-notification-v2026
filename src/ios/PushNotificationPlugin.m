/*
 * cordova-plugin-push-notification-v2026 — iOS (native APNs)
 * https://github.com/dedrisproject/cordova-plugin-push-notification-v2026
 */

#import "PushNotificationPlugin.h"
#import <objc/runtime.h>

static NSString *const kDidRegisterNotification = @"PushPluginDidRegisterForRemoteNotifications";
static NSString *const kDidFailNotification     = @"PushPluginDidFailToRegister";
static NSString *const kDidReceiveNotification  = @"PushPluginDidReceiveRemoteNotification";

#pragma mark - AppDelegate swizzling

static IMP gOrigDidRegister = NULL;
static IMP gOrigDidFail     = NULL;
static IMP gOrigDidReceive  = NULL;

static void push_didRegister(id self, SEL _cmd, UIApplication *app, NSData *deviceToken) {
    [[NSNotificationCenter defaultCenter] postNotificationName:kDidRegisterNotification object:deviceToken];
    if (gOrigDidRegister) {
        ((void (*)(id, SEL, UIApplication *, NSData *))gOrigDidRegister)(self, _cmd, app, deviceToken);
    }
}

static void push_didFail(id self, SEL _cmd, UIApplication *app, NSError *error) {
    [[NSNotificationCenter defaultCenter] postNotificationName:kDidFailNotification object:error];
    if (gOrigDidFail) {
        ((void (*)(id, SEL, UIApplication *, NSError *))gOrigDidFail)(self, _cmd, app, error);
    }
}

static void push_didReceive(id self, SEL _cmd, UIApplication *app, NSDictionary *userInfo,
                            void (^completionHandler)(UIBackgroundFetchResult)) {
    [[NSNotificationCenter defaultCenter] postNotificationName:kDidReceiveNotification object:userInfo];
    if (gOrigDidReceive) {
        ((void (*)(id, SEL, UIApplication *, NSDictionary *, void (^)(UIBackgroundFetchResult)))gOrigDidReceive)
            (self, _cmd, app, userInfo, completionHandler);
    } else if (completionHandler) {
        completionHandler(UIBackgroundFetchResultNewData);
    }
}

static void push_installSwizzling(void) {
    id delegate = [UIApplication sharedApplication].delegate;
    if (!delegate) { return; }
    Class cls = object_getClass(delegate);

    SEL selRegister = @selector(application:didRegisterForRemoteNotificationsWithDeviceToken:);
    Method mRegister = class_getInstanceMethod(cls, selRegister);
    if (mRegister) {
        gOrigDidRegister = method_getImplementation(mRegister);
        method_setImplementation(mRegister, (IMP)push_didRegister);
    } else {
        class_addMethod(cls, selRegister, (IMP)push_didRegister, "v@:@@");
    }

    SEL selFail = @selector(application:didFailToRegisterForRemoteNotificationsWithError:);
    Method mFail = class_getInstanceMethod(cls, selFail);
    if (mFail) {
        gOrigDidFail = method_getImplementation(mFail);
        method_setImplementation(mFail, (IMP)push_didFail);
    } else {
        class_addMethod(cls, selFail, (IMP)push_didFail, "v@:@@");
    }

    SEL selReceive = @selector(application:didReceiveRemoteNotification:fetchCompletionHandler:);
    Method mReceive = class_getInstanceMethod(cls, selReceive);
    if (mReceive) {
        gOrigDidReceive = method_getImplementation(mReceive);
        method_setImplementation(mReceive, (IMP)push_didReceive);
    } else {
        class_addMethod(cls, selReceive, (IMP)push_didReceive, "v@:@@@?");
    }
}

#pragma mark - Plugin

@interface PushNotificationPlugin ()
@property (nonatomic, strong) NSMutableArray *pendingEvents;
@end

@implementation PushNotificationPlugin

- (void)pluginInitialize {
    self.pendingEvents = [NSMutableArray array];
    self.clearBadgeOnLaunch = YES;

    push_installSwizzling();
    [UNUserNotificationCenter currentNotificationCenter].delegate = self;

    NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
    [nc addObserver:self selector:@selector(onDidRegister:) name:kDidRegisterNotification object:nil];
    [nc addObserver:self selector:@selector(onDidFail:) name:kDidFailNotification object:nil];
    [nc addObserver:self selector:@selector(onDidReceive:) name:kDidReceiveNotification object:nil];
}

- (void)dispose {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [super dispose];
}

#pragma mark - Actions

- (void)register:(CDVInvokedUrlCommand *)command {
    self.eventCallbackId = command.callbackId;

    NSDictionary *options = [command argumentAtIndex:0 withDefault:@{}];
    self.clearBadgeOnLaunch = [options[@"clearBadge"] boolValue] || options[@"clearBadge"] == nil;

    UNAuthorizationOptions authOptions = 0;
    if (![options[@"alert"] isEqual:@NO]) { authOptions |= UNAuthorizationOptionAlert; }
    if (![options[@"badge"] isEqual:@NO]) { authOptions |= UNAuthorizationOptionBadge; }
    if (![options[@"sound"] isEqual:@NO]) { authOptions |= UNAuthorizationOptionSound; }

    __weak PushNotificationPlugin *weakSelf = self;
    [[UNUserNotificationCenter currentNotificationCenter]
        requestAuthorizationWithOptions:authOptions
                      completionHandler:^(BOOL granted, NSError *error) {
        if (error) {
            [weakSelf emitEvent:@{ @"event": @"error", @"message": error.localizedDescription }];
            return;
        }
        if (!granted) {
            [weakSelf emitEvent:@{ @"event": @"error", @"message": @"Notification permission denied", @"code": @"denied" }];
            return;
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            [[UIApplication sharedApplication] registerForRemoteNotifications];
        });
    }];

    if (self.clearBadgeOnLaunch) {
        [self applyBadge:0];
    }

    [self flushPendingEvents];
}

- (void)unregister:(CDVInvokedUrlCommand *)command {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[UIApplication sharedApplication] unregisterForRemoteNotifications];
    });
    self.eventCallbackId = nil;
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
                                callbackId:command.callbackId];
}

- (void)getToken:(CDVInvokedUrlCommand *)command {
    // APNs has no synchronous token getter; re-registering triggers the
    // didRegister callback. Return whatever the last cached token was.
    NSString *token = [[NSUserDefaults standardUserDefaults] stringForKey:@"PushPluginToken"];
    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:token ?: @""];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)subscribe:(CDVInvokedUrlCommand *)command {
    // Topics are an FCM concept; manage them server-side for APNs.
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
                                callbackId:command.callbackId];
}

- (void)unsubscribe:(CDVInvokedUrlCommand *)command {
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
                                callbackId:command.callbackId];
}

- (void)setBadge:(CDVInvokedUrlCommand *)command {
    NSInteger count = [[command argumentAtIndex:0 withDefault:@0] integerValue];
    [self applyBadge:count];
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
                                callbackId:command.callbackId];
}

- (void)getBadge:(CDVInvokedUrlCommand *)command {
    __block NSInteger count = 0;
    dispatch_sync(dispatch_get_main_queue(), ^{
        count = [UIApplication sharedApplication].applicationIconBadgeNumber;
    });
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:(int)count]
                                callbackId:command.callbackId];
}

- (void)clearNotifications:(CDVInvokedUrlCommand *)command {
    [[UNUserNotificationCenter currentNotificationCenter] removeAllDeliveredNotifications];
    [self applyBadge:0];
    [self.commandDelegate sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
                                callbackId:command.callbackId];
}

- (void)hasPermission:(CDVInvokedUrlCommand *)command {
    [[UNUserNotificationCenter currentNotificationCenter] getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
        BOOL granted = settings.authorizationStatus == UNAuthorizationStatusAuthorized
                    || settings.authorizationStatus == UNAuthorizationStatusProvisional;
        CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsBool:granted];
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
    }];
}

- (void)requestPermission:(CDVInvokedUrlCommand *)command {
    UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound;
    [[UNUserNotificationCenter currentNotificationCenter]
        requestAuthorizationWithOptions:options
                      completionHandler:^(BOOL granted, NSError *error) {
        CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsBool:granted];
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        if (granted) {
            dispatch_async(dispatch_get_main_queue(), ^{
                [[UIApplication sharedApplication] registerForRemoteNotifications];
            });
        }
    }];
}

#pragma mark - APNs callbacks (via swizzling notifications)

- (void)onDidRegister:(NSNotification *)notification {
    NSData *deviceToken = notification.object;
    NSMutableString *token = [NSMutableString string];
    const unsigned char *bytes = (const unsigned char *)deviceToken.bytes;
    for (NSUInteger i = 0; i < deviceToken.length; i++) {
        [token appendFormat:@"%02x", bytes[i]];
    }
    [[NSUserDefaults standardUserDefaults] setObject:token forKey:@"PushPluginToken"];

    [self emitEvent:@{
        @"event": @"registration",
        @"token": token,
        @"registrationId": token,
        @"registrationType": @"APNS",
        @"platform": @"ios"
    }];
}

- (void)onDidFail:(NSNotification *)notification {
    NSError *error = notification.object;
    [self emitEvent:@{ @"event": @"error", @"message": error.localizedDescription ?: @"Failed to register for remote notifications" }];
}

- (void)onDidReceive:(NSNotification *)notification {
    NSDictionary *userInfo = notification.object;
    // Silent / background content notification.
    [self emitNotificationFromUserInfo:userInfo foreground:NO tap:NO];
}

#pragma mark - UNUserNotificationCenterDelegate

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
    [self emitNotificationFromUserInfo:notification.request.content.userInfo foreground:YES tap:NO];
    if (@available(iOS 14.0, *)) {
        completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
    } else {
        completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
    }
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
    [self emitNotificationFromUserInfo:response.notification.request.content.userInfo foreground:NO tap:YES];
    completionHandler();
}

#pragma mark - Helpers

- (void)emitNotificationFromUserInfo:(NSDictionary *)userInfo foreground:(BOOL)foreground tap:(BOOL)tap {
    NSMutableDictionary *data = [NSMutableDictionary dictionary];
    NSString *title = nil;
    NSString *body = nil;
    NSNumber *badge = nil;
    NSString *sound = nil;

    NSDictionary *aps = userInfo[@"aps"];
    if ([aps isKindOfClass:[NSDictionary class]]) {
        id alert = aps[@"alert"];
        if ([alert isKindOfClass:[NSDictionary class]]) {
            title = alert[@"title"];
            body = alert[@"body"];
        } else if ([alert isKindOfClass:[NSString class]]) {
            body = alert;
        }
        badge = aps[@"badge"];
        sound = aps[@"sound"];
    }

    for (NSString *key in userInfo) {
        if ([key isEqualToString:@"aps"]) { continue; }
        data[key] = userInfo[key];
    }

    NSMutableDictionary *event = [NSMutableDictionary dictionaryWithDictionary:@{
        @"event": @"notification",
        @"data": data,
        @"foreground": @(foreground),
        @"tap": @(tap)
    }];
    if (title) { event[@"title"] = title; }
    if (body)  { event[@"body"] = body; }
    if (badge) { event[@"badge"] = badge; }
    if (sound) { event[@"sound"] = sound; }

    [self emitEvent:event];
}

- (void)emitEvent:(NSDictionary *)event {
    if (!self.eventCallbackId) {
        [self.pendingEvents addObject:event];
        return;
    }
    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:event];
    [result setKeepCallbackAsBool:YES];
    [self.commandDelegate sendPluginResult:result callbackId:self.eventCallbackId];
}

- (void)flushPendingEvents {
    if (!self.eventCallbackId) { return; }
    NSArray *events = [self.pendingEvents copy];
    [self.pendingEvents removeAllObjects];
    for (NSDictionary *event in events) {
        [self emitEvent:event];
    }
}

- (void)applyBadge:(NSInteger)count {
    dispatch_async(dispatch_get_main_queue(), ^{
        [UIApplication sharedApplication].applicationIconBadgeNumber = count;
    });
}

@end
