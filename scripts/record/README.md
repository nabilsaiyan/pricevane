# Recording the product clips

The landing page shows the product moving. Every reference we studied does the
same thing — Supercut, Strawberry, Supademo, Humblytics, Polymer all put a
short, silent, looping clip of the real UI directly under the fold. None of
them use a static screenshot for the primary product shot.

There are two ways to produce those clips. **Use the first one.**

---

## 1. Scripted (preferred)

```bash
# the app must be running and signed in to the demo org
npm run dev

./crawlers/.venv/bin/python scripts/record/record.py     # capture masters
scripts/record/encode.sh                                  # crop + encode + posters
```

Output lands in `public/clips/` as `<name>.webm`, `<name>.mp4`, `<name>.webp`.

Why this and not a screen recorder:

- **It survives the next UI change.** Re-run two commands and every clip is
  re-cut against the new dashboard. A hand-recorded clip is stale the moment
  someone moves a button, and nobody re-records six videos by hand.
- **The geometry is exact.** Every master is 1440×900. The landing page markup
  can hard-code an aspect ratio and never suffer layout shift.
- **No studio accidents.** No notification banner, no dock, no menu bar, no
  three-second fumble at the head of the take, no cursor drifting while you
  find the next button.

`clips.py` is the manifest — route, crop, display width, byte budget, and the
click script. Edit it there; `record.py` and `encode.sh` need no changes.

### The cursor

Playwright records the *page*, not the screen, so the operating system's mouse
pointer does not appear in the output. Without a fix, a clip of a click
sequence looks like the UI operating itself, which reads as a mockup — the
opposite of what these clips are for.

`record.py` therefore injects a small ring into the page that follows the real
`mousemove` and `mousedown` events Playwright dispatches. It is a genuine
pointer track, not an animation laid on afterwards: if a click lands in the
wrong place, the clip shows it landing in the wrong place.

### Dependencies

- `ffmpeg` — `brew install ffmpeg`
- `cwebp` — `brew install webp` (optional; without it posters fall back to PNG)
- The Python venv at `crawlers/.venv`, which already has Playwright.

---

## 2. By hand, with a screen recorder (fallback)

Use this only if you want a take the script cannot produce — something
involving a real second device, or an OS-level interaction.

### Set up the window first

The recording is only as good as the window geometry. Do all four:

1. **Resize the browser window to exactly 1440×900 CSS pixels.** Do not
   eyeball it. Open the console on the page and run:
   ```js
   window.resizeTo(1440 + (window.outerWidth - window.innerWidth),
                   900  + (window.outerHeight - window.innerHeight))
   ```
   Then confirm with `innerWidth, innerHeight` → must read `1440, 900`.
2. **Hide the browser chrome.** Cmd-Shift-F for full screen, or use a clean
   profile with no bookmarks bar and no extension icons.
3. **Turn off notifications.** Focus mode on. A Slack banner mid-take costs you
   the whole clip.
4. **Set the display scale to Retina (2×)** so the capture is 2880×1800 and
   downscales cleanly.

### Capture

QuickTime → File → New Screen Recording → **Options → record the window**, not
the whole screen. Or `Cmd-Shift-5` → Record Selected Portion, and drag to the
window edges.

Record at 60fps if the tool offers it; the encode drops it to 30.

### What to click — per clip

Keep every take **under 8 seconds**. These loop. A long clip is a video nobody
watches; a short one is a texture people absorb without deciding to.
Pause ~600 ms on each landing state so the eye can read it before the next move.

| Clip | Route | Do this |
|---|---|---|
| `night-run` | `/app` | Land on Overview. Pause 1 s. Move the pointer to the "last run" timestamp and rest on it. Scroll down slowly, about a third of a page, so the overnight rows come up. Stop. |
| `undercut-alert` | `/app/alerts` | Land on Alerts. Pause. Hover the top alert card and hold — long enough that the price, the competitor and the timestamp are all readable. Do not click. |
| `price-history` | `/app/products` | Click the first product. Wait for the chart to draw. Sweep the pointer left→right across the chart in one slow pass so the readout tracks. Stop at the crossing point. |
| `match-confirm` | `/app/matches` | Land on Matches. Hover the confidence figure. Then click **Confirm** on the top proposal and let the row settle into its confirmed state. |
| `org-switch` | `/app` | Land on Overview with the numbers visible. Open the org switcher. Pick the other org. **Hold for two full seconds** on the new numbers — this clip's entire job is showing that every figure changed. |
| `usage-meter` | `/app/billing` | Land on Billing. Scroll a little so the usage meter is centred. Hold while it fills and hits the cap. |

### Encode a hand-recorded take

Drop the `.mov` into `scripts/record/out/raw/` renamed to `<clip-name>.webm`
— or convert first, then run `encode.sh`, which crops and re-encodes whatever
it finds:

```bash
ffmpeg -i take.mov -an -c:v libvpx -crf 10 -b:v 2M scripts/record/out/raw/org-switch.webm
scripts/record/encode.sh
```

Trim the fumble off the head before encoding: `-ss 1.4 -t 6.0`.

---

## Geometry and budgets

Measured off the reference sites rather than guessed. Supercut ships its
feature clips at 380×286 natural and **76–97 KB**; its hero streams in ~900 KB
chunks. Strawberry's hero is 1722×1080 natural displayed at 1038 CSS — about
1.6× — and its small looping clips run 147–864 KB each.

So:

| | Capture | Displayed at | Density | Budget |
|---|---|---|---|---|
| Hero / wide | 1440×900 | ≤ 720 CSS | 2× | ≤ 900 KB |
| Feature | crop of the master | 460–700 CSS | 2× | ≤ 420 KB |
| Detail | crop of the master | 380 CSS | 2× | ≤ 140 KB |

Everything is captured once at 1440×900 and cropped from that single master, so
the app's layout is identical in every clip on the page. Recording each clip at
its own viewport would give six subtly different dashboards.

`encode.sh` prints `OVER BUDGET` when a clip exceeds its number. Fix it by
shortening the take, not by raising the budget — a 12-second clip is nearly
always a 6-second clip with a slow start.

## Embedding

Use the `<ProductClip>` component. It handles the parts that are easy to get
wrong: `muted` + `playsinline` (without both, iOS refuses to autoplay),
`preload="metadata"` (so six clips do not cost 4 MB on first paint), a poster
that carries the frame before decode, and `prefers-reduced-motion`, where it
renders the poster alone and never fetches the video at all.
