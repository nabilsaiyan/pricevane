# Crawlers

Playwright, Python 3.11+. Only the fictional storefronts in `../storefronts` are
ever crawled — no real retailer is touched by this code.

```bash
/opt/homebrew/bin/python3.14 -m venv .venv
.venv/bin/pip install playwright 'psycopg[binary]' python-dotenv
.venv/bin/playwright install chromium
```

Quote `'psycopg[binary]'` — zsh treats the brackets as a glob and the install
silently does nothing.

Run it against a storefront on localhost:

```bash
cd ../storefronts && npm run build && npm start &     # serves :3100
.venv/bin/python run_crawl.py \
  --org <uuid> --store <uuid> --slug northwind --markup jsonld \
  --base-url http://localhost:3100
```

## What is worth reading

`identity.py` — proxy, user agent, locale, timezone and viewport are chosen
**together**. A fresh IP behind an unchanged fingerprint is not a new identity,
it is a label on the old one. Every `crawl_runs` row records which identity it
wore.

`ratelimit.py` — politeness is keyed on the **domain**, not the store row. Two
customers watching the same shop share one budget, or being popular becomes a
reason to hammer the target. Backoff uses full jitter, because identical backoff
across workers reconverges them into the burst that caused the failure.

`extract.py` — one strategy per store (JSON-LD, microdata, plain), because the
three demo shops publish differently, as real shops do. An extractor that cannot
find a price returns `None` and never guesses: a missing price shows up in the
run report, a wrong one quietly poisons the history and fires a false alert.
