"""
Per-domain politeness.

Keyed on the DOMAIN, never on the store row. Two customers watching the same
storefront must share one budget, or being popular becomes a reason to hammer
the target — and the target's rate limiter sees one attacker, not two tenants.
"""
from __future__ import annotations

import asyncio
import random
import time
from collections import defaultdict


class DomainLimiter:
    def __init__(self, min_interval: float = 2.0, jitter: float = 0.6) -> None:
        self._min = min_interval
        self._jitter = jitter
        self._last: dict[str, float] = defaultdict(float)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def wait(self, domain: str) -> None:
        # The lock is per domain, so unrelated domains never queue behind each
        # other — one slow host must not stall the whole run.
        async with self._locks[domain]:
            gap = time.monotonic() - self._last[domain]
            # Jitter matters: perfectly even spacing is a machine signature.
            target = self._min + random.uniform(0, self._jitter)
            if gap < target:
                await asyncio.sleep(target - gap)
            self._last[domain] = time.monotonic()


async def with_backoff(fn, *, attempts: int = 3, base: float = 1.5, on_error=None):
    """Retry with exponential backoff and full jitter.

    Full jitter rather than a fixed multiplier: identical backoff across
    concurrent workers reconverges them into the same retry burst that caused
    the failure.
    """
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            return await fn()
        except Exception as exc:            # noqa: BLE001 - re-raised below
            last = exc
            if on_error:
                on_error(attempt, exc)
            if attempt == attempts - 1:
                break
            await asyncio.sleep(random.uniform(0, base * (2 ** attempt)))
    raise last  # type: ignore[misc]
