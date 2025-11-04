"""
Price extraction, one strategy per store.

The three demo storefronts publish their data three different ways — JSON-LD,
microdata, and nothing but a class name — because that is what real storefronts
do. A single universal selector is the thing that looks like it works in
development and silently returns None in production, so extraction is explicit
per store and every strategy declares what it found.

An extractor that cannot find a price returns None. It never guesses, and it
never falls back to "the first number on the page": a wrong price is worse than
a missing one, because a missing price is visible in the run report and a wrong
one quietly poisons the history and fires a false alert.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

from playwright.async_api import Page

_MONEY = re.compile(r"(\d[\d\s.,]*)")


@dataclass
class Extracted:
    price_cents: int | None
    stock: str            # in_stock | out_of_stock | unknown
    title: str | None
    strategy: str


def _to_cents(text: str) -> int | None:
    m = _MONEY.search(text.replace(" ", "").replace("\xa0", ""))
    if not m:
        return None
    raw = m.group(1).strip().replace(" ", "")
    # European and Anglo formats disagree about which separator is decimal.
    # Decide from position, not from locale guessing: whichever separator is
    # last is the decimal one.
    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".") if raw.rfind(",") > raw.rfind(".") \
            else raw.replace(",", "")
    elif "," in raw:
        head, _, tail = raw.rpartition(",")
        raw = f"{head.replace(',', '')}.{tail}" if len(tail) == 2 else raw.replace(",", "")
    try:
        return round(float(raw) * 100)
    except ValueError:
        return None


async def from_jsonld(page: Page) -> Extracted:
    for handle in await page.query_selector_all('script[type="application/ld+json"]'):
        try:
            data = json.loads(await handle.inner_text())
        except json.JSONDecodeError:
            continue
        for node in (data if isinstance(data, list) else [data]):
            if not isinstance(node, dict) or node.get("@type") != "Product":
                continue
            offer = node.get("offers") or {}
            if isinstance(offer, list):
                offer = offer[0] if offer else {}
            price = _to_cents(str(offer.get("price", "")))
            avail = str(offer.get("availability", "")).lower()
            stock = "in_stock" if "instock" in avail else \
                    "out_of_stock" if "outofstock" in avail else "unknown"
            return Extracted(price, stock, node.get("name"), "jsonld")
    return Extracted(None, "unknown", None, "jsonld")


async def from_microdata(page: Page) -> Extracted:
    price = None
    node = await page.query_selector('[itemprop="price"]')
    if node:
        # `content` is authoritative when present: the visible text is formatted
        # for humans and may carry a currency symbol, thin spaces, or a range.
        price = _to_cents(await node.get_attribute("content") or await node.inner_text())

    stock = "unknown"
    avail = await page.query_selector('[itemprop="availability"]')
    if avail:
        href = (await avail.get_attribute("href") or "").lower()
        stock = "in_stock" if "instock" in href else \
                "out_of_stock" if "outofstock" in href else "unknown"

    name = await page.query_selector('[itemprop="name"]')
    return Extracted(price, stock, await name.inner_text() if name else None, "microdata")


async def from_plain(page: Page) -> Extracted:
    node = await page.query_selector('[data-testid="price"], .price')
    price = _to_cents(await node.inner_text()) if node else None

    stock = "unknown"
    if await page.query_selector(".stock.in"):
        stock = "in_stock"
    elif await page.query_selector(".stock.out"):
        stock = "out_of_stock"

    h1 = await page.query_selector("h1")
    return Extracted(price, stock, await h1.inner_text() if h1 else None, "plain")


STRATEGIES = {"jsonld": from_jsonld, "microdata": from_microdata, "plain": from_plain}


async def extract(page: Page, strategy: str) -> Extracted:
    """Try the store's declared strategy, then the others.

    The fallback is not laziness — a shop changing its markup is the single most
    common way a crawler breaks, and the reported `strategy` makes the change
    visible in the run report instead of showing up as a silent gap in history.
    """
    primary = STRATEGIES.get(strategy, from_plain)
    result = await primary(page)
    if result.price_cents is not None:
        return result
    for name, fn in STRATEGIES.items():
        if name == strategy:
            continue
        alt = await fn(page)
        if alt.price_cents is not None:
            return Extracted(alt.price_cents, alt.stock, alt.title, f"{name} (fallback from {strategy})")
    return result
