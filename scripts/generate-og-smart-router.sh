#!/usr/bin/env bash
#
# OG card for the Smart Router case study. It is a still of the demo film's
# end card, with the npm chip and test count beside it, so the card reads as a
# product even at feed size. Regenerate after a release with the new version
# number and test count in the two annotate lines.
#
# Requires: ImageMagick 7+. Fonts live in scripts/_og-fonts (see generate-og.sh
# for the one-time download; the film frame is committed alongside so this runs
# without the demo build).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FONTS="$DIR/scripts/_og-fonts"
OUT="$DIR/public/og/smart-router.jpg"
[ -f "$FONTS/smart-router-film-frame.png" ] || { echo "film frame missing" >&2; exit 1; }
NPM="${NPM_VERSION:-0.4.0}"; TESTS="${TESTS_COUNT:-759}"
magick "$FONTS/smart-router-film-frame.png" -gravity South -crop 1200x630+0+30 +repage \
  \( "$FONTS/_grid.png" -alpha set -channel A -evaluate multiply 0.35 +channel \) -compose over -composite \
  -strokewidth 1 -stroke '#7C8BA0' -fill none \
  -draw "line 32,32 32,52   line 32,32 52,32" \
  -draw "line 1168,32 1168,52  line 1168,32 1148,32" \
  -draw "line 32,598 32,578   line 32,598 52,598" \
  -draw "line 1168,598 1168,578  line 1168,598 1148,598" \
  -fill '#0F766E33' -stroke '#0F766EAA' -strokewidth 1 \
  -draw "roundrectangle 964,44 1168,80 19,19" \
  -font "$FONTS/JetBrainsMono.ttf" -pointsize 14 -fill '#7ADCC8' -stroke none \
  -gravity NorthEast -annotate +60+56 "npm v$NPM" \
  -fill '#7ADCC833' -stroke '#7ADCC899' -strokewidth 1 \
  -draw "roundrectangle 976,92 1168,128 19,19" \
  -font "$FONTS/JetBrainsMono.ttf" -pointsize 14 -fill '#BFEDE2' -stroke none \
  -gravity NorthEast -annotate +60+104 "$TESTS tests · MIT" \
  -font "$FONTS/JetBrainsMono.ttf" -pointsize 13 -fill '#74839A' -stroke none -kerning 0.5 \
  -gravity SouthWest -annotate +60+44 "for OpenCode · qadan.co" \
  -strip -quality 90 -interlace Plane "$OUT"
echo "✓ og/smart-router.jpg (npm v$NPM, $TESTS tests)"
