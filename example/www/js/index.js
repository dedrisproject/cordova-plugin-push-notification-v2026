/*
 * Sample app for cordova-plugin-push-notification-v2026
 * Demonstrates the full lifecycle: register, receive, topics, badge.
 */

(function () {
    'use strict';

    var els = {};
    var lastToken = null;

    document.addEventListener('deviceready', onDeviceReady, false);

    function onDeviceReady() {
        cache();
        bind();
        log('deviceready — tap "Register" to begin', 'reg');
    }

    function cache() {
        ['status', 'platform', 'token', 'log',
         'registerBtn', 'permBtn', 'badgeBtn', 'clearBtn', 'copyBtn',
         'topicInput', 'subBtn', 'unsubBtn', 'clearLogBtn'].forEach(function (id) {
            els[id] = document.getElementById(id);
        });
        els.platform.textContent = (window.cordova && cordova.platformId) || 'browser';
    }

    function bind() {
        els.registerBtn.addEventListener('click', doRegister);
        els.permBtn.addEventListener('click', checkPermission);
        els.badgeBtn.addEventListener('click', function () {
            push().setBadge(3).then(function () { log('badge set to 3'); }).catch(err);
        });
        els.clearBtn.addEventListener('click', function () {
            push().clearNotifications().then(function () { log('notifications cleared'); }).catch(err);
        });
        els.copyBtn.addEventListener('click', copyToken);
        els.subBtn.addEventListener('click', function () { topic(true); });
        els.unsubBtn.addEventListener('click', function () { topic(false); });
        els.clearLogBtn.addEventListener('click', function () { els.log.innerHTML = ''; });
    }

    function push() {
        return cordova.plugins.pushNotification;
    }

    function doRegister() {
        setStatus('Registering…', 'idle');

        push().on('notification', function (n) {
            var tag = n.tap ? 'tapped' : (n.foreground ? 'foreground' : 'background');
            log('🔔 [' + tag + '] ' + (n.title || '(no title)') + ' — ' + (n.body || '') +
                '  data=' + JSON.stringify(n.data || {}), 'notif');
        });

        push().on('tokenRefresh', function (d) {
            lastToken = d.token;
            els.token.textContent = d.token;
            log('token refreshed', 'reg');
        });

        push().on('error', function (e) {
            log('error: ' + (e && e.message), 'err');
        });

        push().register({
            alert: true, badge: true, sound: true,
            android: { channelId: 'demo', channelName: 'Demo Notifications', forceShow: true }
        }).then(function (res) {
            lastToken = res.token;
            els.token.textContent = res.token;
            els.copyBtn.disabled = false;
            setStatus('Registered (' + res.registrationType + ')', 'ok');
            log('registered: ' + res.registrationType + ' token acquired', 'reg');
        }).catch(function (e) {
            setStatus('Registration failed', 'err');
            err(e);
        });
    }

    function checkPermission() {
        push().hasPermission().then(function (granted) {
            log('permission granted? ' + granted);
        }).catch(err);
    }

    function topic(subscribe) {
        var name = (els.topicInput.value || '').trim();
        if (!name) { log('enter a topic name first', 'err'); return; }
        var op = subscribe ? push().subscribe(name) : push().unsubscribe(name);
        op.then(function () {
            log((subscribe ? 'subscribed to' : 'unsubscribed from') + ' "' + name + '"');
        }).catch(err);
    }

    function copyToken() {
        if (!lastToken) { return; }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(lastToken).then(function () { log('token copied'); });
        } else {
            log('token: ' + lastToken);
        }
    }

    // ---- UI helpers ----

    function setStatus(text, kind) {
        els.status.textContent = text;
        els.status.className = 'badge badge-' + (kind || 'idle');
    }

    function err(e) {
        log('error: ' + (e && (e.message || e)) , 'err');
    }

    function log(message, kind) {
        var li = document.createElement('li');
        if (kind) { li.className = kind; }
        var time = new Date().toTimeString().slice(0, 8);
        li.innerHTML = '<span class="ts">' + time + '</span>' + escapeHtml(message);
        els.log.insertBefore(li, els.log.firstChild);
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
})();
