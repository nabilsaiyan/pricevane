"""
The clip manifest.

One entry per video on the landing page. Each clip is a short, silent, looping
WebM/MP4 pair plus a poster frame, produced by driving the real running app --
not by hand-recording a screen.

Why scripted rather than QuickTime:

  * It is repeatable. The dashboard will change; re-running the script
    re-cuts every clip against the new UI in one pass.
  * It is deterministic. No cursor jitter, no OS chrome, no notification
    banner sliding in on take four, no 3-second fumble at the start.
  * The output is exactly the pixel size we asked for, every time, so the
    landing page markup never has to guess an aspect ratio.

MASTER GEOMETRY
---------------
Everything is captured at 1440x900. That is a natural desktop dashboard width
(the app's own layout breakpoints are built for it) and it gives us a master we
can crop from. On the page each clip is displayed at *half* its captured width,
so a 1440px-wide master shown in a 720px box renders at 2x density on a retina
screen and stays sharp. Region clips are cropped out of the same master by
ffmpeg rather than re-recorded at a different viewport, so the app's layout is
identical across every clip on the page.

`crop` is (x, y, w, h) in master pixels, or None for the full frame.
`display` is the CSS width the clip is intended to occupy on the landing page.
"""

MASTER = {"width": 1440, "height": 900}

CLIPS = [
    dict(
        name="night-run",
        route="/app",
        # The proof beat: rows that landed overnight, with real timestamps.
        crop=(24, 150, 1392, 780),
        display=696,
        budget_kb=420,
        caption="Last night's run, 03:12 to 04:48",
        steps=[
            ("wait", 900),
            ("hover", "text=Last run"),
            ("wait", 700),
            ("scroll", 260),
            ("wait", 1600),
        ],
    ),
    dict(
        name="undercut-alert",
        route="/app/alerts",
        # Tight on a single alert card -- this is the 380x286-class clip,
        # the kind Supercut ships at under 100 KB.
        crop=(300, 190, 760, 572),
        display=380,
        budget_kb=140,
        caption="A competitor crosses under you",
        steps=[
            ("wait", 800),
            ("hover", "article:first-of-type, li:first-of-type"),
            ("wait", 1400),
        ],
    ),
    dict(
        name="price-history",
        route="/app/products",
        # Click into a product, land on the chart, sweep across it.
        crop=None,
        display=720,
        budget_kb=900,
        caption="Six months of both lines",
        steps=[
            ("wait", 800),
            ("click", "main a[href^='/app/products/']"),
            ("wait", 1600),
            ("sweep", "svg"),
            ("wait", 900),
        ],
    ),
    dict(
        name="match-confirm",
        route="/app/matches",
        # The human-in-the-loop beat: a proposal, its confidence, a decision.
        crop=(220, 170, 1000, 660),
        display=500,
        budget_kb=320,
        caption="Nothing is matched without a human",
        steps=[
            ("wait", 800),
            ("hover", "text=/0\\.\\d\\d/"),
            ("wait", 900),
            ("click", "button:has-text('Confirm')"),
            ("wait", 1500),
        ],
    ),
    dict(
        name="org-switch",
        route="/app",
        # The multi-tenancy money shot. Two orgs, one click, every number
        # on screen changes. This is the clip that sells the RLS work.
        crop=(0, 0, 1440, 620),
        display=720,
        budget_kb=520,
        caption="Two tenants, one click, nothing leaks",
        steps=[
            ("wait", 900),
            ("click", "[data-org-switcher], .aside select, .aside button:first-of-type"),
            ("wait", 600),
            ("click", "text=Halvard"),
            ("wait", 2000),
        ],
    ),
    dict(
        name="usage-meter",
        route="/app/billing",
        crop=(260, 200, 920, 560),
        display=460,
        budget_kb=260,
        caption="The meter fills, then it stops you",
        steps=[
            ("wait", 900),
            ("scroll", 180),
            ("wait", 1800),
        ],
    ),
]
