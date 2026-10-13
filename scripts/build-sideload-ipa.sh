#!/usr/bin/env bash
#
# Builds an UNSIGNED Financify .ipa for sideloading with a free Apple ID.
#
# SideStore (or AltStore/Sideloadly) re-signs the .ipa on-device with your
# personal team, so this build deliberately skips code signing.
#
# The API URL is compiled into the bundle: use the Vercel deployment,
# e.g. https://<project>.vercel.app
#
#   ./scripts/build-sideload-ipa.sh   (API_URL defaults to https://financify-one.vercel.app)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$REPO_ROOT/mobile"
IOS="$MOBILE/ios"
OUT="${OUT_DIR:-$REPO_ROOT/build}"

API_URL="${API_URL:-${EXPO_PUBLIC_API_URL:-https://financify-one.vercel.app}}"
if [ -z "$API_URL" ]; then
  echo "API_URL is unset. Pass the public https URL the phone will call, e.g." >&2
  echo "  API_URL=https://<project>.vercel.app $0" >&2
  exit 1
fi
case "$API_URL" in
  https://*) ;;
  *)
    echo "API_URL must be https:// — iOS App Transport Security blocks plain http" >&2
    echo "from a non-local host, so an http URL would fail on the phone." >&2
    exit 1
    ;;
esac

# CocoaPods runs on the portable Ruby, because macOS system Ruby (2.6) is too
# old for any current CocoaPods and there is no Homebrew on this machine.
PORTABLE_RUBY="$HOME/.local/portable-ruby/3.4.5/bin"
if [ -d "$PORTABLE_RUBY" ]; then
  export PATH="$PORTABLE_RUBY:$PATH"
fi
if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods not found. Install it with the portable Ruby:" >&2
  echo "  PATH=\"$PORTABLE_RUBY:\$PATH\" gem install cocoapods" >&2
  exit 1
fi

export EXPO_PUBLIC_API_URL="$API_URL"

echo "==> Prebuild (API $API_URL)"
cd "$MOBILE"
npx expo prebuild --platform ios --clean

echo "==> Build (unsigned)"
cd "$IOS"
xcodebuild \
  -workspace Financify.xcworkspace \
  -scheme Financify \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  ONLY_ACTIVE_ARCH=NO \
  build

APP="$IOS/build/Build/Products/Release-iphoneos/Financify.app"
[ -d "$APP" ] || { echo "Build produced no Financify.app at $APP" >&2; exit 1; }

# An .ipa is just a zip with the .app inside a top-level Payload/ directory.
echo "==> Packaging .ipa"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/Payload"
cp -R "$APP" "$STAGE/Payload/"
mkdir -p "$OUT"
IPA="$OUT/Financify-sideload.ipa"
rm -f "$IPA"
(cd "$STAGE" && zip -qry "$IPA" Payload)

echo
echo "IPA:  $IPA"
echo "Size: $(du -h "$IPA" | cut -f1)"
echo "API:  $API_URL"
echo
echo "Next: open SideStore on the iPhone, '+', pick this file."
