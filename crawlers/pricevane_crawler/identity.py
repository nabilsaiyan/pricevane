"""
Crawler identity.

The mistake this module exists to prevent: rotating the proxy and leaving
everything else alone. A fresh IP carrying the same browser fingerprint, the
same timezone and the same Accept-Language is trivially linkable across
sessions — you have not gained a new identity, you have labelled your old one.

So an Identity is atomic. Proxy, user agent, locale, timezone, viewport and
platform are chosen together and consistently: a French residential exit does
not browse in en-US at America/Los_Angeles with a Windows user agent. Every
crawl_runs row records which identity it wore, so a suspicious data point can
be traced back to the exact session that produced it.
"""
from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Identity:
    label: str
    proxy: str | None
    user_agent: str
    locale: str
    timezone: str
    viewport: tuple[int, int]
    platform: str

    def as_context_kwargs(self) -> dict:
        """Playwright browser-context arguments for this identity."""
        kwargs: dict = {
            "user_agent": self.user_agent,
            "locale": self.locale,
            "timezone_id": self.timezone,
            "viewport": {"width": self.viewport[0], "height": self.viewport[1]},
            # Accept-Language must agree with locale, or the mismatch is itself
            # a signal — one of the cheapest bot tells there is.
            "extra_http_headers": {"Accept-Language": f"{self.locale},{self.locale.split('-')[0]};q=0.9"},
        }
        if self.proxy:
            kwargs["proxy"] = {"server": self.proxy}
        return kwargs


# Coherent bundles. A region implies its language, its timezone and the kind of
# machine that plausibly sits there.
_REGIONS = [
    ("fr", "fr-FR", "Europe/Paris"),
    ("de", "de-DE", "Europe/Berlin"),
    ("nl", "nl-NL", "Europe/Amsterdam"),
    ("es", "es-ES", "Europe/Madrid"),
]

_MACHINES = [
    ("macOS",
     "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
     (1512, 982)),
    ("Windows",
     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
     (1920, 1080)),
]


def pick(proxy_pool: list[str] | None = None, rng: random.Random | None = None) -> Identity:
    """One coherent identity. Never mix a region's proxy with another's locale."""
    r = rng or random.Random()
    region, locale, tz = r.choice(_REGIONS)
    platform, ua, viewport = r.choice(_MACHINES)
    proxy = r.choice(proxy_pool) if proxy_pool else None
    return Identity(
        label=f"{region}-{platform.lower()}-{r.randrange(1, 9)}",
        proxy=proxy, user_agent=ua, locale=locale, timezone=tz,
        viewport=viewport, platform=platform,
    )
