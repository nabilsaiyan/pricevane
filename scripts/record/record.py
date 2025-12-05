#!/usr/bin/env python3
"""
Drive the running app through each clip in the manifest and capture video.

Usage:
    ./crawlers/.venv/bin/python scripts/record/record.py [--base http://localhost:3000] [--only name]

Writes raw 1440x900 VP8 WebM masters to scripts/record/out/raw/.
Run scripts/record/encode.sh afterwards to crop, re-encode and cut posters.

THE CURSOR PROBLEM
------------------
Playwright's video capture records the page, not the operating system, so the
real mouse pointer is invisible in the output. A naive recording of a click
sequence looks like the UI is operating itself, which reads as a fake mockup --
exactly the impression we are trying to avoid.

So we draw our own. An init script installs a small ring that listens for the
trusted mousemove/mousedown events Playwright's mouse actually dispatches, and
follows them. It is a real pointer track, not an animation: if a click lands
somewhere unexpected, the clip shows it landing somewhere unexpected.
"""
from __future__ import annotations

import argparse
import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from clips import CLIPS, MASTER  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

OUT = pathlib.Path(__file__).parent / "out" / "raw"

# A pointer that exists inside the page, because the OS one is not captured.
CURSOR_JS = """
(() => {
  const c = document.createElement('div');
  c.id = '__rec_cursor';
  c.style.cssText = [
    'position:fixed','z-index:2147483647','pointer-events:none',
    'width:22px','height:22px','margin:-11px 0 0 -11px','border-radius:50%',
    'border:2px solid rgba(255,255,255,.92)',
    'box-shadow:0 0 0 1px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.45)',
    'background:rgba(255,255,255,.14)',
    'transition:transform .09s ease-out, background .12s ease-out',
    'left:-50px','top:-50px',
  ].join(';');
  const add = () => (document.body || document.documentElement).appendChild(c);
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', add) : add();
  addEventListener('mousemove', e => { c.style.left = e.clientX+'px'; c.style.top = e.clientY+'px'; }, true);
  addEventListener('mousedown', () => { c.style.transform='scale(.72)'; c.style.background='rgba(198,242,78,.55)'; }, true);
  addEventListener('mouseup',   () => { c.style.transform='scale(1)';   c.style.background='rgba(255,255,255,.14)'; }, true);
})();
"""

# The dev overlay and the scrollbar are studio equipment, not product.
HIDE_JS = """
(() => {
  const s = document.createElement('style');
  s.textContent = `
    nextjs-portal, #__next-build-watcher { display:none !important; }
    ::-webkit-scrollbar { width:0 !important; height:0 !important; }
    * { scrollbar-width: none !important; }
  `;
  const add = () => document.head.appendChild(s);
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', add) : add();
})();
"""


def glide(page, x: float, y: float) -> None:
    """Move in visible steps. A single jump would teleport the cursor."""
    page.mouse.move(x, y, steps=26)


def center(page, selector: str):
    """Centre of the element, in viewport coordinates, guaranteed on screen.

    bounding_box() is relative to the viewport, so an element that a previous
    scroll step pushed above the fold reports a negative y. Moving the mouse
    there is legal and silently useless: the cursor leaves the frame and the
    clip shows nothing happening. Scroll it back into view first, and refuse
    the step outright if it still lands outside -- a loud skip in the log beats
    a clip that looks fine until someone watches it.
    """
    loc = page.locator(selector).first
    loc.wait_for(state="visible", timeout=6000)
    loc.scroll_into_view_if_needed(timeout=4000)
    page.wait_for_timeout(220)          # let smooth scrolling settle
    box = loc.bounding_box()
    if not box:
        raise RuntimeError(f"no box for {selector}")
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    vw, vh = MASTER["width"], MASTER["height"]
    if not (0 <= x <= vw and 0 <= y <= vh):
        raise RuntimeError(f"{selector} centres off-frame at ({x:.0f},{y:.0f})")
    return x, y, box


def run_step(page, step) -> None:
    kind, arg = step[0], step[1]
    if kind == "wait":
        page.wait_for_timeout(arg)
    elif kind == "hover":
        x, y, _ = center(page, arg)
        glide(page, x, y)
    elif kind == "click":
        x, y, _ = center(page, arg)
        glide(page, x, y)
        page.wait_for_timeout(260)          # let the hover state read before the press
        page.mouse.down(); page.wait_for_timeout(90); page.mouse.up()
    elif kind == "scroll":
        page.mouse.wheel(0, arg)
    elif kind == "sweep":
        # Drag the pointer across an element -- for charts, where the value
        # readout follows the cursor and the movement *is* the demonstration.
        _, _, box = center(page, arg)
        y = box["y"] + box["height"] * 0.55
        glide(page, box["x"] + box["width"] * 0.08, y)
        page.wait_for_timeout(200)
        for frac in (0.3, 0.52, 0.74, 0.93):
            page.mouse.move(box["x"] + box["width"] * frac, y, steps=18)
            page.wait_for_timeout(220)
    else:
        raise ValueError(f"unknown step {kind}")


def record(pw, base: str, clip: dict) -> pathlib.Path:
    browser = pw.chromium.launch(args=["--force-color-profile=srgb", "--hide-scrollbars"])
    ctx = browser.new_context(
        viewport=MASTER,
        record_video_dir=str(OUT),
        record_video_size=MASTER,
        color_scheme="dark",
        reduced_motion="no-preference",   # the animations are the point
    )
    ctx.add_init_script(HIDE_JS)
    ctx.add_init_script(CURSOR_JS)
    page = ctx.new_page()

    page.goto(base.rstrip("/") + clip["route"], wait_until="networkidle")
    # Park the cursor off-frame so it enters deliberately on the first move.
    page.mouse.move(-40, -40)
    page.wait_for_timeout(700)

    failed = None
    for step in clip["steps"]:
        try:
            run_step(page, step)
        except Exception as exc:                      # noqa: BLE001
            failed = f"{step[0]} {step[1]!r}: {str(exc).splitlines()[0][:90]}"
            print(f"    ! step skipped -- {failed}")
            page.wait_for_timeout(500)

    page.wait_for_timeout(500)
    src = pathlib.Path(page.video.path())
    ctx.close()
    browser.close()

    dest = OUT / f"{clip['name']}.webm"
    if dest.exists():
        dest.unlink()
    shutil.move(str(src), dest)
    return dest


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--only", default=None, help="record a single clip by name")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    wanted = [c for c in CLIPS if args.only in (None, c["name"])]
    if not wanted:
        print(f"no clip named {args.only!r}", file=sys.stderr)
        return 2

    with sync_playwright() as pw:
        for clip in wanted:
            print(f"  {clip['name']:<16} {clip['route']}")
            path = record(pw, args.base, clip)
            print(f"    -> {path.name}  {path.stat().st_size // 1024} KB raw")

    print("\nnow run: scripts/record/encode.sh")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
