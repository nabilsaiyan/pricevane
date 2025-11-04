"""
Pricevane crawler.

Discovers listings on a demo storefront, records a price snapshot for each, and
writes a crawl_runs row so every data point traces back to the run — and the
identity — that produced it.

    python run_crawl.py --org <uuid> --store <uuid> --base-url http://localhost:3100 --slug northwind

Only the fictional storefronts in ../storefronts are ever crawled. No real
retailer is touched by this code.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent))

import psycopg
from dotenv import load_dotenv
from playwright.async_api import async_playwright

from pricevane_crawler import identity as ident
from pricevane_crawler.extract import extract
from pricevane_crawler.ratelimit import DomainLimiter, with_backoff

load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv(Path(__file__).parent.parent / ".env")

CONN = os.environ.get("DATABASE_URL") or os.environ.get("TEST_DATABASE_URL")


async def crawl(org: str, store: str, base_url: str, slug: str, markup: str) -> int:
    if not CONN:
        raise SystemExit("set DATABASE_URL or TEST_DATABASE_URL")

    who = ident.pick(proxy_pool=None)     # a real deployment passes its proxy pool here
    limiter = DomainLimiter(min_interval=1.0, jitter=0.5)
    domain = urlparse(base_url).netloc

    conn = psycopg.connect(CONN, autocommit=True)
    with conn.cursor() as cur:
        cur.execute(
            """insert into crawl_runs (organization_id, store_id, status, started_at,
                 proxy_label, user_agent, locale, timezone)
               values (%s,%s,'running',now(),%s,%s,%s,%s) returning id""",
            (org, store, who.label, who.user_agent, who.locale, who.timezone))
        run_id = cur.fetchone()[0]

    print(f"run {run_id}  identity={who.label} {who.locale} {who.timezone}")

    seen = written = 0
    errors: list[tuple[str, str, int | None, str]] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(**who.as_context_kwargs())
        page = await context.new_page()

        await limiter.wait(domain)
        await page.goto(f"{base_url}/{slug}", wait_until="domcontentloaded")
        hrefs = [h for h in await page.eval_on_selector_all(
            "a.card", "els => els.map(e => e.getAttribute('href'))") if h]
        print(f"discovered {len(hrefs)} listings")

        for href in hrefs:
            url = f"{base_url}{href}"
            seen += 1
            try:
                async def visit():
                    await limiter.wait(domain)
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                    if resp and resp.status >= 400:
                        raise RuntimeError(f"http {resp.status}")
                    return await extract(page, markup)

                data = await with_backoff(visit, attempts=3)

                if data.price_cents is None:
                    errors.append((url, "parse", None,
                                   f"no price found via {data.strategy}"))
                    continue

                sku = href.rsplit("/", 1)[-1].upper()
                with conn.cursor() as cur:
                    # Upsert the listing, then snapshot it. The listing is
                    # identified by URL because that is the only identifier the
                    # shop guarantees to keep stable.
                    cur.execute(
                        """insert into competitor_listings
                             (organization_id, store_id, external_id, url, title, last_seen_at, is_active)
                           values (%s,%s,%s,%s,%s,now(),true)
                           on conflict (store_id, url) do update
                             set title = excluded.title, last_seen_at = now(), is_active = true
                           returning id""",
                        (org, store, sku, url, data.title or sku))
                    listing_id = cur.fetchone()[0]

                    cur.execute(
                        """insert into price_snapshots
                             (organization_id, listing_id, run_id, price_cents, stock, captured_at)
                           values (%s,%s,%s,%s,%s,now())""",
                        (org, listing_id, run_id, data.price_cents, data.stock))
                written += 1
                print(f"  {sku:14} {data.price_cents/100:>8.2f}  {data.stock:<13} [{data.strategy}]")

            except Exception as exc:                       # noqa: BLE001
                kind = "timeout" if "imeout" in str(exc) else \
                       "blocked" if "403" in str(exc) else "http_4xx" if "http" in str(exc) else "unknown"
                errors.append((url, kind, None, str(exc)[:300]))
                print(f"  FAILED {url}: {exc}", file=sys.stderr)

        await context.close()
        await browser.close()

    with conn.cursor() as cur:
        for url, kind, status, detail in errors:
            cur.execute(
                """insert into crawl_errors (organization_id, run_id, listing_url, kind, http_status, detail)
                   values (%s,%s,%s,%s,%s,%s)""",
                (org, run_id, url, kind, status, detail))
        # 'partial' is a real outcome, not a rounding of failure: a run that got
        # 300 of 312 listings produced usable data, and calling it failed would
        # hide that the other 300 are fine.
        status = "succeeded" if not errors else ("partial" if written else "failed")
        cur.execute(
            """update crawl_runs set status=%s, finished_at=now(),
                 listings_seen=%s, snapshots_written=%s where id=%s""",
            (status, seen, written, run_id))
    conn.close()

    print(f"\n{status}: {written}/{seen} snapshots, {len(errors)} error(s)")
    return 0 if written else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--org", required=True)
    ap.add_argument("--store", required=True)
    ap.add_argument("--base-url", default="http://localhost:3100")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--markup", default="plain", choices=["jsonld", "microdata", "plain"])
    a = ap.parse_args()
    return asyncio.run(crawl(a.org, a.store, a.base_url, a.slug, a.markup))


if __name__ == "__main__":
    raise SystemExit(main())
