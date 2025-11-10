import { Resend } from 'resend'
import type { Candidate } from './engine'
import { describe as render } from './engine'

/**
 * Alert delivery.
 *
 * Every channel is best-effort and isolated. A dead Slack webhook must not stop
 * the email, and neither must stop the alert being recorded — the row in
 * `alerts` is the source of truth, and delivery is a side effect on top of it.
 * Inverting that (write only if sent) loses the alert entirely when a provider
 * has a bad minute.
 */
export type Channel =
  | { kind: 'email'; target: string }
  | { kind: 'slack'; target: string }
  | { kind: 'webhook'; target: string; secret?: string | null }

export type DeliveryResult = { channel: Channel['kind']; ok: boolean; error?: string }

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function deliver(
  candidate: Candidate,
  storeName: string,
  channels: Channel[],
): Promise<DeliveryResult[]> {
  const { title, body } = render(candidate, storeName)

  // Promise.allSettled, not Promise.all: one rejection must not cancel the rest.
  const settled = await Promise.allSettled(channels.map(async (c): Promise<DeliveryResult> => {
    try {
      switch (c.kind) {
        case 'email': await sendEmail(c.target, title, body, candidate); break
        case 'slack': await sendSlack(c.target, title, body, candidate); break
        case 'webhook': await sendWebhook(c.target, title, body, candidate); break
      }
      return { channel: c.kind, ok: true }
    } catch (err) {
      return { channel: c.kind, ok: false, error: err instanceof Error ? err.message : 'unknown' }
    }
  }))

  return settled.map((s, i) => s.status === 'fulfilled'
    ? s.value
    : { channel: channels[i].kind, ok: false, error: 'threw' })
}

async function sendEmail(to: string, title: string, body: string, c: Candidate) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not set')
  const resend = new Resend(key)
  const colour = c.severity === 'critical' ? '#FF2E4C' : '#C6F24E'
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'Pricevane <alerts@pricevane.dev>',
    to,
    subject: title,
    // Table layout and inline styles: email clients are not browsers, and flex
    // and external stylesheets are still unreliable across Outlook and Gmail.
    html: `<table width="100%" cellpadding="0" cellspacing="0" style="background:#08090A;padding:32px 0">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111315;border:1px solid #2a2d30;border-radius:6px">
      <tr><td style="padding:22px 24px;border-left:3px solid ${colour}">
        <p style="margin:0 0 10px;font:11px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:${colour}">
          ${c.kind.replace(/_/g, ' ')}</p>
        <h1 style="margin:0 0 8px;font:700 19px/1.3 Helvetica,Arial,sans-serif;color:#ECEAE4">${escapeHtml(title)}</h1>
        <p style="margin:0 0 18px;font:14px/1.55 Helvetica,Arial,sans-serif;color:#8A9195">${escapeHtml(body)}</p>
        <a href="${APP}/app/alerts" style="display:inline-block;background:${colour};color:#08090A;text-decoration:none;padding:9px 18px;border-radius:3px;font:700 13px Helvetica,Arial,sans-serif">Open Pricevane</a>
      </td></tr>
    </table>
    <p style="font:11px Helvetica,Arial,sans-serif;color:#4E5559;margin:14px 0 0">
      You are receiving this because you track this product.</p>
  </td></tr>
</table>`,
    text: `${title}\n\n${body}\n\n${APP}/app/alerts`,
  })
}

async function sendSlack(webhookUrl: string, title: string, body: string, c: Candidate) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: title,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*${title}*\n${body}` } },
        { type: 'context', elements: [
          { type: 'mrkdwn', text: `${c.kind.replace(/_/g, ' ')} · <${APP}/app/alerts|open in Pricevane>` },
        ] },
      ],
    }),
  })
  if (!res.ok) throw new Error(`slack responded ${res.status}`)
}

async function sendWebhook(url: string, title: string, body: string, c: Candidate) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: c.kind, severity: c.severity, title, body,
      listing_id: c.listingId, product_id: c.productId,
      old_price_cents: c.oldPriceCents, new_price_cents: c.newPriceCents,
      // The receiver needs this to drop replays if we retry.
      idempotency_key: c.dedupeKey,
    }),
  })
  if (!res.ok) throw new Error(`webhook responded ${res.status}`)
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}
