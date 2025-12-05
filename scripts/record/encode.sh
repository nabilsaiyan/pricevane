#!/usr/bin/env bash
# Crop, re-encode and cut poster frames from the raw Playwright masters.
#
# Playwright writes VP8 at 25fps, which is fine as a master but soft and
# oversized for the web. This pass produces, per clip:
#
#   <name>.webm   VP9   -- the one nearly every browser will actually load
#   <name>.mp4    H.264 -- Safari's fallback, and any browser that refuses VP9
#   <name>.webp   poster frame, shown before the video decodes and whenever
#                 the visitor has asked for reduced motion
#
# Each clip is cropped from the 1440x900 master and scaled to exactly twice its
# CSS display width, so it is 2x on a retina screen and never upscaled.
#
# Requires: ffmpeg. Optionally cwebp (brew install webp) for WebP posters;
# without it the poster falls back to PNG, which is bigger but works.
set -euo pipefail

cd "$(dirname "$0")"
RAW=out/raw
WEB=../../public/clips
mkdir -p "$WEB"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found: brew install ffmpeg" >&2; exit 1; }
HAVE_CWEBP=0; command -v cwebp >/dev/null && HAVE_CWEBP=1

# name|crop(x:y:w:h or -)|display_css_width|budget_kb
while IFS='|' read -r NAME CROP DISPLAY BUDGET; do
  [ -z "${NAME:-}" ] && continue
  SRC="$RAW/$NAME.webm"
  if [ ! -f "$SRC" ]; then echo "  skip $NAME (no master)"; continue; fi

  OUTW=$(( DISPLAY * 2 ))
  FILTER=""
  if [ "$CROP" != "-" ]; then
    # The table below, and clips.py, write crops as x:y:w:h because that is how
    # you read a rectangle off a screenshot. ffmpeg's crop filter wants
    # w:h:x:y. Reorder here, in the one place that talks to ffmpeg, rather
    # than making every human-edited crop obey ffmpeg's argument order.
    IFS=: read -r CX CY CW CH <<<"$CROP"
    FILTER="crop=${CW}:${CH}:${CX}:${CY},"
  fi
  # -2 keeps the height even, which yuv420p requires.
  FILTER="${FILTER}scale=${OUTW}:-2:flags=lanczos"

  ffmpeg -nostdin -v error -y -i "$SRC" -vf "$FILTER" -an \
    -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 \
    -pix_fmt yuv420p "$WEB/$NAME.webm"

  ffmpeg -nostdin -v error -y -i "$SRC" -vf "$FILTER" -an \
    -c:v libx264 -crf 24 -preset slow -profile:v high -pix_fmt yuv420p \
    -movflags +faststart "$WEB/$NAME.mp4"

  # Poster: a frame from ~40% in, not frame 0 -- frame 0 is often mid-fade.
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
  AT=$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d*0.4}')
  ffmpeg -nostdin -v error -y -ss "$AT" -i "$SRC" -vf "$FILTER" -frames:v 1 "$WEB/$NAME.png"
  if [ "$HAVE_CWEBP" = 1 ]; then
    cwebp -quiet -q 82 "$WEB/$NAME.png" -o "$WEB/$NAME.webp" && rm "$WEB/$NAME.png"
    POSTER="$NAME.webp"
  else
    POSTER="$NAME.png"
  fi

  KB=$(( $(stat -f%z "$WEB/$NAME.webm") / 1024 ))
  FLAG=""; [ "$KB" -gt "$BUDGET" ] && FLAG="  OVER BUDGET (${BUDGET} KB)"
  printf '  %-16s %sx? webm %4s KB   mp4 %4s KB   %s%s\n' \
    "$NAME" "$OUTW" "$KB" "$(( $(stat -f%z "$WEB/$NAME.mp4") / 1024 ))" "$POSTER" "$FLAG"
done <<'CLIPS'
night-run|24:150:1392:780|696|420
undercut-alert|300:190:760:572|380|140
price-history|-|720|900
match-confirm|220:170:1000:660|500|320
org-switch|0:0:1440:620|720|520
usage-meter|260:200:920:560|460|260
CLIPS

echo
echo "written to public/clips/ -- reference them as /clips/<name>.webm"
