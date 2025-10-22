'use client'

import { useState } from 'react'

type Tier = 'free' | 'starter' | 'growth' | 'scale'

export function PlanActions({ organizationId, tier, current, canManage }: {
  organizationId: string; tier: Tier; current: boolean; canManage: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go(path: 'checkout' | 'portal') {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/billing/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          path === 'checkout' ? { organization_id: organizationId, tier } : { organization_id: organizationId }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Something went wrong.'); return }
      // A plan swap on an existing subscription returns no URL — Stripe applied
      // the proration server-side and the webhook writes the new tier, so we
      // just reload and let the server tell us what it is now.
      if (body.url) window.location.href = body.url
      else window.location.reload()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (current) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
        <span className="pill warn">current plan</span>
        {canManage && tier !== 'free' && (
          <button className="btn2 ghost" onClick={() => go('portal')} disabled={busy}>
            {busy ? 'Opening…' : 'Manage or cancel'}
          </button>
        )}
      </div>
    )
  }

  if (tier === 'free') return <span className="pill ok">downgrade via portal</span>

  return (
    <>
      <button className="btn2" onClick={() => go('checkout')} disabled={busy || !canManage}>
        {busy ? 'Opening…' : 'Choose'}
      </button>
      {error && <p style={{ color: 'var(--alert)', fontSize: 11, marginTop: '.4rem' }}>{error}</p>}
    </>
  )
}
