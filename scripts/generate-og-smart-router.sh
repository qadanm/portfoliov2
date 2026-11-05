#!/usr/bin/env bash
#
# OG card for the Smart Router case study. Built as a 1200x675 poster and
# captured headlessly: heading, brand row, npm chip on the left; the router
# panel itself (a still of the demo film at the self-heal moment) on the right.
#
# The panel still comes from the film build (assets/screenshots/src/demo.html
# in the router repo, frame ~17s). After a release, bump the NPM_VERSION and
# TESTS_COUNT chips below, re-run this, commit.
#
# Requires: headless Chrome at /Applications/Google Chrome.app, ImageMagick.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRAME_DIR="$(mktemp -d)"
trap 'rm -rf "$FRAME_DIR"' EXIT
NPM="${NPM_VERSION:-0.4.0}"; TESTS="${TESTS_COUNT:-759}"
# 1) panel still from the film (frame ~17s at 12fps == frame 204)
SRC=~/.opencode-smart-router/assets/screenshots/src/demo.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --window-size=1200,675 --screenshot="$FRAME_DIR/film.png" "file://$SRC?t=17.0&still=1" 2>/dev/null
magick "$FRAME_DIR/film.png" -crop 340x614+806+42 +repage "$FRAME_DIR/panel.png"
# 2) poster compose + capture (og.html reads panel.png from its own directory)
HTML="$DIR/scripts/og-smart-router.html"
sed "s|panelcrop3.png|$FRAME_DIR/panel.png|; s|npm v0.4.0|npm v$NPM|; s|759 tests|$TESTS tests|" "$HTML" > "$FRAME_DIR/og.html"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --window-size=1200,675 --screenshot="$DIR/public/og/smart-router.png" "file://$FRAME_DIR/og.html" 2>/dev/null
magick "$DIR/public/og/smart-router.png" -quality 88 -strip "$DIR/public/og/smart-router.jpg"
rm -f "$DIR/public/og/smart-router.png"
echo "✓ og/smart-router.jpg (npm v$NPM, $TESTS tests)"
