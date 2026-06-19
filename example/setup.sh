#!/usr/bin/env bash
#
# Bootstraps the PushDemo sample app against the LOCAL plugin source.
#
#   ./setup.sh            # add both platforms + plugin
#   ./setup.sh android    # android only
#   ./setup.sh ios        # ios only
#
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$HERE/.." && pwd)"
cd "$HERE"

echo "▶ Using local plugin: $PLUGIN_DIR"

# Install the plugin from the local checkout (use the npm name in real apps:
#   cordova plugin add cordova-plugin-push-notification-v2026 )
if ! cordova plugin ls | grep -q "cordova-plugin-push-notification-v2026"; then
    echo "▶ Adding plugin from local source…"
    cordova plugin add "$PLUGIN_DIR"
fi

add_platform() {
    if ! cordova platform ls | grep -q "^Installed platforms:.*$1"; then
        echo "▶ Adding platform: $1"
        cordova platform add "$1"
    fi
}

TARGET="${1:-all}"
case "$TARGET" in
    android) add_platform android@latest ;;
    ios)     add_platform ios@latest ;;
    all)
        add_platform android@latest
        add_platform ios@latest
        ;;
    *) echo "Unknown target: $TARGET (use android|ios|all)"; exit 1 ;;
esac

echo ""
echo "✅ Done."
echo ""
echo "Next steps:"
echo "  Android: place google-services.json in this folder, then:  cordova run android"
echo "  iOS:     open platforms/ios/*.xcworkspace in Xcode, set your Team & Push capability,"
echo "           then:  cordova run ios"
