#!/usr/bin/env bash
# Product renders come out of the generator at ~1500px and 1.7MB of PNG. The
# landing page never shows them larger than ~520px, so we ship a JPEG at 2x
# that width. sips is macOS-native; no dependency to install.
set -euo pipefail
SRC="public/products"
OUT="public/products/web"
mkdir -p "$OUT"
for f in "$SRC"/*.png; do
  [ -e "$f" ] || continue
  name=$(basename "$f" .png)
  sips -s format jpeg -s formatOptions 72 -Z 1040 "$f" --out "$OUT/$name.jpg" >/dev/null
  printf '%-26s %6sK -> %5sK\n' "$name" \
    $(( $(stat -f%z "$f") / 1024 )) $(( $(stat -f%z "$OUT/$name.jpg") / 1024 ))
done
