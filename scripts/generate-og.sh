#!/usr/bin/env bash
#
# OG card generator. Composes 1200×630 JPEG cards for the default site
# and each case study. Output goes to ../public/og.jpg and ../public/og/.
#
# Setup (one-time):
#   mkdir -p ./scripts/_og-fonts
#   curl -L https://github.com/google/fonts/raw/main/ofl/instrumentserif/InstrumentSerif-Regular.ttf -o ./scripts/_og-fonts/InstrumentSerif-Regular.ttf
#   curl -L 'https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf' -o ./scripts/_og-fonts/JetBrainsMono.ttf
#   # Inter TTF (extract Inter-Regular.ttf from any Inter release zip)
#   # Place it as ./scripts/_og-fonts/Inter-Regular.ttf
#
# Run:
#   bash scripts/generate-og.sh
#
# Requires: ImageMagick 7+ (`magick` command).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FONT_DIR="${SCRIPT_DIR}/_og-fonts"
SERIF="${FONT_DIR}/InstrumentSerif-Regular.ttf"
MONO="${FONT_DIR}/JetBrainsMono.ttf"
SANS="${FONT_DIR}/Inter-Regular.ttf"

if [ ! -f "$SERIF" ] || [ ! -f "$MONO" ] || [ ! -f "$SANS" ]; then
  echo "Missing fonts in ${FONT_DIR}/." >&2
  echo "See setup instructions at the top of this script." >&2
  exit 1
fi

OUT_PUBLIC="${ROOT_DIR}/public"
OUT_DIR="${OUT_PUBLIC}/og"
mkdir -p "$OUT_DIR"

GRID="${FONT_DIR}/_grid.png"
if [ ! -f "$GRID" ]; then
  magick -size 40x40 xc:transparent \
    -fill none -stroke 'rgba(255,255,255,0.04)' -strokewidth 1 \
    -draw "line 0,0 0,40" -draw "line 0,0 40,0" \
    "$GRID"
fi

GLOW="${FONT_DIR}/_glow.png"
if [ ! -f "$GLOW" ]; then
  magick -size 800x800 radial-gradient:'rgba(245,158,11,0.30)-rgba(245,158,11,0)' "$GLOW"
fi

# Generate one card.
# Args: out_path, title, subtitle, tag_label, tag_color_hex, footer_left, footer_right
gen_card() {
  local out="$1"
  local title="$2"
  local subtitle="$3"
  local tag_label="$4"
  local tag_color="$5"
  local footer_left="$6"
  local footer_right="$7"

  local base="${FONT_DIR}/_base.png"
  magick \
    -size 1200x630 gradient:'#0B0B0F-#06060A' \
    \( -size 1200x630 tile:"$GRID" \) -compose over -composite \
    \( "$GLOW" -resize 900x900 -geometry +-200+-300 \) -compose screen -composite \
    "$base"

  magick "$base" \
    -strokewidth 1 -stroke '#71717A' -fill none \
    -draw "line 32,32 32,52   line 32,32 52,32" \
    -draw "line 1168,32 1168,52  line 1168,32 1148,32" \
    -draw "line 32,598 32,578   line 32,598 52,598" \
    -draw "line 1168,598 1168,578  line 1168,598 1148,598" \
    -fill '#101013' -stroke '#27272A' -strokewidth 1 \
    -draw "roundrectangle 60,60 116,116 8,8" \
    -font "$MONO" -pointsize 18 -fill '#FAFAFA' -stroke none \
    -gravity NorthWest -annotate +75+82 "MQ" \
    -font "$MONO" -pointsize 18 -fill '#A1A1AA' -kerning 1 \
    -annotate +132+92 "qadan.co" \
    -fill "#${tag_color}26" -stroke "#${tag_color}AA" -strokewidth 1 \
    -draw "roundrectangle 1000,68 1168,108 20,20" \
    -font "$MONO" -pointsize 14 -fill "#${tag_color}" -stroke none \
    -gravity NorthEast -annotate +60+85 "● ${tag_label}" \
    -font "$SERIF" -pointsize 92 -fill '#FAFAFA' -stroke none -kerning -2 \
    -gravity NorthWest -annotate +60+220 "$title" \
    -font "$SANS" -pointsize 22 -fill '#A1A1AA' -kerning 0 \
    -gravity NorthWest -annotate +60+450 "$subtitle" \
    -strokewidth 1 -stroke '#A1A1AA' -fill none \
    -draw "line 60,540 200,540" \
    -font "$MONO" -pointsize 16 -fill '#A1A1AA' -stroke none -kerning 0.6 \
    -gravity NorthWest -annotate +60+562 "$footer_left" \
    -font "$MONO" -pointsize 14 -fill '#71717A' \
    -gravity NorthEast -annotate +32+562 "$footer_right" \
    -strip -quality 90 -interlace Plane \
    "$out"

  rm -f "$base"
  echo "✓ $(basename "$out")"
}

gen_card "${OUT_PUBLIC}/og.jpg" \
  "I do UX and frontend\nas one job." \
  "Senior UX, frontend, design systems & AI-assisted product work." \
  "qadan.co" \
  "F59E0B" \
  "Selected work · case studies" \
  "Los Angeles · 2026"

gen_card "${OUT_DIR}/chatobd2.jpg" \
  "ChatOBD2." \
  "AI-native automotive diagnostics product, designed and engineered solo." \
  "FLAGSHIP" \
  "F59E0B" \
  "Case study" \
  "qadan.co · 2026"

gen_card "${OUT_DIR}/magtek-platform.jpg" \
  "MagTek Platform." \
  "UX and frontend systems across a multi-site enterprise platform." \
  "PLATFORM" \
  "60A5FA" \
  "Case study" \
  "qadan.co · 2026"

gen_card "${OUT_DIR}/sawa.jpg" \
  "Sawa." \
  "Marketing site for an iMessage-native group dining app." \
  "PRODUCT" \
  "A78BFA" \
  "Case study" \
  "qadan.co · 2026"

gen_card "${OUT_DIR}/financial-platforms.jpg" \
  "Advisor Platforms." \
  "Customer portals across 50+ wealth and banking institutions." \
  "PRODUCT" \
  "60A5FA" \
  "Case study · InvestCloud" \
  "qadan.co · 2026"

echo "Done."
