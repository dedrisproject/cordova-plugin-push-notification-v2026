#!/usr/bin/env node
/*
 * Cordova hook — copies google-services.json into the Android app module.
 *
 * Drop your google-services.json anywhere obvious in the project (root,
 * /res, /www, or /google-services) and this hook places it where the
 * Gradle google-services plugin expects it on every build. No manual steps.
 *
 * Part of cordova-plugin-push-notification-v2026
 */

'use strict';

var fs = require('fs');
var path = require('path');

module.exports = function (context) {
    var projectRoot = (context && context.opts && context.opts.projectRoot) || process.cwd();

    // Only act when the Android platform is being built.
    var platforms = (context && context.opts && context.opts.platforms) || [];
    if (platforms.length && platforms.indexOf('android') === -1) {
        return;
    }

    var androidAppDir = path.join(projectRoot, 'platforms', 'android', 'app');
    if (!fs.existsSync(androidAppDir)) {
        // Android platform not added yet — nothing to do.
        return;
    }

    // Candidate source locations, in priority order.
    var candidates = [
        path.join(projectRoot, 'google-services.json'),
        path.join(projectRoot, 'res', 'google-services.json'),
        path.join(projectRoot, 'res', 'android', 'google-services.json'),
        path.join(projectRoot, 'www', 'google-services.json'),
        path.join(projectRoot, 'google-services', 'google-services.json'),
        path.join(projectRoot, 'src', 'google-services.json')
    ];

    var source = candidates.filter(fs.existsSync)[0];
    var dest = path.join(androidAppDir, 'google-services.json');

    if (!source) {
        if (!fs.existsSync(dest)) {
            console.warn(
                '\n\x1b[33m[push-notification] google-services.json not found.\x1b[0m\n' +
                '  Download it from the Firebase console and place it in your project root:\n' +
                '    ' + path.join(projectRoot, 'google-services.json') + '\n' +
                '  Android push notifications will not work until it is present.\n'
            );
        }
        return;
    }

    try {
        fs.copyFileSync(source, dest);
        console.log('\x1b[32m[push-notification]\x1b[0m copied google-services.json -> platforms/android/app/');
    } catch (e) {
        console.error('[push-notification] failed to copy google-services.json:', e.message);
    }
};
