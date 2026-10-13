#!/usr/bin/env bash
# Build a standalone Release app and install it on a paired physical iPhone.
#
#   ./scripts/ios-device.sh            # first paired iPhone
#   ./scripts/ios-device.sh <UDID>     # a specific one
#
# Release bundles the JS into the app (no Metro). API defaults to production;
# override with API_URL=https://... . Free "Personal Team" builds expire after
# 7 days; re-run this script to refresh.
set -euo pipefail

cd "$(dirname "$0")/.."

# CocoaPods runs on the portable Ruby (macOS system Ruby is too old).
export PATH="$HOME/.local/portable-ruby/3.4.5/bin:$PATH"
export LANG="${LANG:-en_US.UTF-8}"
export EXPO_PUBLIC_API_URL="${API_URL:-https://financify-one.vercel.app}"

UDID="${1:-}"
if [[ -z "$UDID" ]]; then
  tmp="$(mktemp)"
  xcrun devicectl list devices --json-output "$tmp" >/dev/null
  UDID="$(node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const phone = (d.result?.devices ?? []).find(
      (x) => x.hardwareProperties?.reality === "physical" && x.hardwareProperties?.platform === "iOS",
    );
    process.stdout.write(phone?.hardwareProperties?.udid ?? "");
  ' "$tmp")"
  rm -f "$tmp"
fi
if [[ -z "$UDID" ]]; then
  echo "No paired physical iPhone found. Connect it once by cable, trust this Mac, then retry." >&2
  exit 1
fi

echo "› Device $UDID, API $EXPO_PUBLIC_API_URL"
CI=1 npx expo prebuild --platform ios

(cd ios && xcodebuild \
  -workspace Financify.xcworkspace \
  -scheme Financify \
  -configuration Release \
  -destination "id=$UDID" \
  -derivedDataPath build \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  build | tail -n 5)

APP="ios/build/Build/Products/Release-iphoneos/Financify.app"
xcrun devicectl device install app --device "$UDID" "$APP"
if ! xcrun devicectl device process launch --device "$UDID" com.mileshamilton.financify; then
  echo "Installed. First install from this Apple ID: on the iPhone open Settings > General >" >&2
  echo "VPN & Device Management > Developer App > Trust, then open Financify." >&2
fi
