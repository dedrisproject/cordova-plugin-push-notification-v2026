/*!
 * cordova-plugin-push-notification-v2026
 * Zero-config push notifications for Apache Cordova.
 *   - Android : Firebase Cloud Messaging (FCM)
 *   - iOS     : native Apple Push Notification service (APNs)
 *
 * Released under the MIT License.
 * https://github.com/dedrisproject/cordova-plugin-push-notification-v2026
 */

var exec = require('cordova/exec');

var SERVICE = 'PushNotificationPlugin';

/* Supported event names (canonical, lower-case). */
var EVENTS = ['registration', 'notification', 'tokenrefresh', 'error'];

/* Internal state */
var listeners = { registration: [], notification: [], tokenrefresh: [], error: [] };
var streamStarted = false;
var lastToken = null;

function platformId() {
    return (typeof cordova !== 'undefined' && cordova.platformId) ? cordova.platformId : 'unknown';
}

function normalizeEvent(name) {
    return String(name || '').toLowerCase().replace(/[_\s-]/g, '');
}

function emit(event, data) {
    event = normalizeEvent(event);
    var cbs = listeners[event];
    if (!cbs) { return; }
    // Iterate over a copy so handlers can safely add/remove listeners.
    cbs.slice().forEach(function (cb) {
        try {
            cb(data);
        } catch (e) {
            if (event !== 'error') {
                emit('error', { message: 'Listener for "' + event + '" threw: ' + (e && e.message), error: e });
            } else if (typeof console !== 'undefined') {
                console.error('[PushNotification] error listener threw', e);
            }
        }
    });
}

/**
 * Opens the long-lived native event stream. The native side keeps the
 * callback alive (keepCallback) and pushes one event object at a time:
 *   { event: 'registration', token, platform, registrationType }
 *   { event: 'notification', title, body, data, foreground, tap, ... }
 *   { event: 'tokenrefresh', token }
 *   { event: 'error', message, code }
 */
function startStream(options) {
    if (streamStarted) { return; }
    streamStarted = true;

    exec(function (payload) {
        if (!payload || !payload.event) { return; }
        var name = normalizeEvent(payload.event);

        if (name === 'registration' || name === 'tokenrefresh') {
            lastToken = payload.token || payload.registrationId || lastToken;
        }

        emit(name, payload);
    }, function (error) {
        emit('error', typeof error === 'string' ? { message: error } : (error || { message: 'Unknown push error' }));
    }, SERVICE, 'register', [options || {}]);
}

var PushNotification = {

    /**
     * Default notification channel id used on Android for foreground builds.
     * Exposed for reference; override per-call via register({ android: { channelId } }).
     */
    DEFAULT_CHANNEL_ID: 'push_default',

    /**
     * Initialise push notifications. Requests permission (Android 13+, iOS),
     * registers with FCM / APNs and starts delivering events.
     *
     * @param {Object} [options]
     * @param {boolean} [options.alert=true]  Request alert permission (iOS).
     * @param {boolean} [options.badge=true]  Request badge permission (iOS).
     * @param {boolean} [options.sound=true]  Request sound permission (iOS).
     * @param {boolean} [options.clearBadge=true] Reset the badge on launch (iOS).
     * @param {Object}  [options.android]     Android-specific settings.
     * @param {string}  [options.android.channelId]   Default channel id.
     * @param {string}  [options.android.channelName] Human-readable channel name.
     * @param {boolean} [options.android.forceShow=false] Show a notification even
     *        when a data message arrives while the app is in the foreground.
     * @returns {Promise<{token:string, platform:string, registrationType:string}>}
     *          Resolves with the device token once registration succeeds.
     */
    register: function (options) {
        options = options || {};
        return new Promise(function (resolve, reject) {
            var settled = false;

            function onReg(data) {
                if (settled) { return; }
                settled = true;
                PushNotification.off('registration', onReg);
                PushNotification.off('error', onErr);
                resolve({
                    token: data.token || data.registrationId,
                    platform: data.platform || platformId(),
                    registrationType: data.registrationType || (platformId() === 'ios' ? 'APNS' : 'FCM')
                });
            }

            function onErr(err) {
                if (settled) { return; }
                settled = true;
                PushNotification.off('registration', onReg);
                PushNotification.off('error', onErr);
                reject(err);
            }

            PushNotification.on('registration', onReg);
            PushNotification.on('error', onErr);
            startStream(options);
        });
    },

    /**
     * Subscribe to a listener. Returns the PushNotification object for chaining.
     * @param {'registration'|'notification'|'tokenRefresh'|'error'} event
     * @param {Function} callback
     */
    on: function (event, callback) {
        var name = normalizeEvent(event);
        if (listeners[name] && typeof callback === 'function') {
            listeners[name].push(callback);
        }
        return this;
    },

    /** Remove a previously registered listener (or all for an event if no cb). */
    off: function (event, callback) {
        var name = normalizeEvent(event);
        if (!listeners[name]) { return this; }
        if (!callback) {
            listeners[name] = [];
        } else {
            listeners[name] = listeners[name].filter(function (cb) { return cb !== callback; });
        }
        return this;
    },

    /** Subscribe to a single occurrence of an event. */
    once: function (event, callback) {
        var self = this;
        function wrapper(data) {
            self.off(event, wrapper);
            callback(data);
        }
        return this.on(event, wrapper);
    },

    /** @returns {Promise<string>} the current device token (cached if available). */
    getToken: function () {
        return new Promise(function (resolve, reject) {
            exec(function (token) { lastToken = token || lastToken; resolve(lastToken); },
                reject, SERVICE, 'getToken', []);
        });
    },

    /**
     * Subscribe the device to an FCM topic (Android). On iOS this resolves
     * without effect — manage topics server-side.
     * @param {string} topic
     * @returns {Promise<void>}
     */
    subscribe: function (topic) {
        return new Promise(function (resolve, reject) {
            if (platformId() !== 'android') { return resolve(); }
            exec(resolve, reject, SERVICE, 'subscribe', [topic]);
        });
    },

    /** Unsubscribe the device from an FCM topic (Android). */
    unsubscribe: function (topic) {
        return new Promise(function (resolve, reject) {
            if (platformId() !== 'android') { return resolve(); }
            exec(resolve, reject, SERVICE, 'unsubscribe', [topic]);
        });
    },

    /** Stop receiving notifications and delete the token. */
    unregister: function () {
        return new Promise(function (resolve, reject) {
            exec(function () { lastToken = null; resolve(); }, reject, SERVICE, 'unregister', []);
        });
    },

    /** Set the app icon badge number (iOS). 0 clears it. */
    setBadge: function (count) {
        return new Promise(function (resolve, reject) {
            exec(resolve, reject, SERVICE, 'setBadge', [count | 0]);
        });
    },

    /** @returns {Promise<number>} the current badge number (iOS). */
    getBadge: function () {
        return new Promise(function (resolve, reject) {
            exec(resolve, reject, SERVICE, 'getBadge', []);
        });
    },

    /** Remove all delivered notifications from the tray / notification center. */
    clearNotifications: function () {
        return new Promise(function (resolve, reject) {
            exec(resolve, reject, SERVICE, 'clearNotifications', []);
        });
    },

    /** @returns {Promise<boolean>} whether notification permission is granted. */
    hasPermission: function () {
        return new Promise(function (resolve, reject) {
            exec(function (granted) { resolve(!!granted); }, reject, SERVICE, 'hasPermission', []);
        });
    },

    /**
     * Explicitly prompt for notification permission. Usually unnecessary —
     * register() already requests it — but handy for custom UX flows.
     * @returns {Promise<boolean>} whether permission was granted.
     */
    requestPermission: function () {
        return new Promise(function (resolve, reject) {
            exec(function (granted) { resolve(!!granted); }, reject, SERVICE, 'requestPermission', []);
        });
    }
};

module.exports = PushNotification;
