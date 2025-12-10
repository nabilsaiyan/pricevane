'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'

/**
 * The closing accordion, matching the reference skeleton's last band.
 *
 * Built on <button aria-expanded> rather than <details>, because the reference
 * layout wants a rotating icon and an animated height, and <details> gives
 * neither without fighting it. The trade is that the answers must be reachable
 * from the keyboard, which the button provides for free.
 */
const QA: [string, string][] = [
  [
    'Do you crawl real retailers?',
    'No. Pricevane crawls three fictional storefronts built for this project and ' +
    'deployed separately. The crawler is real, the rate limiting and identity ' +
    'rotation are real, and the shops it visits are ours.',
  ],
  [
    'How is one customer stopped from reading another one’s data?',
    'By Postgres row-level security, not by application code. Every tenant table ' +
    'carries an organization_id and a policy, and the policy is FORCEd so it ' +
    'applies to the table owner as well. There is a test that signs in as one ' +
    'organisation, crafts a query for another organisation’s rows, and asserts ' +
    'it gets none.',
  ],
  [
    'What happens if Stripe sends the same webhook twice?',
    'Nothing the second time. Every event is claimed in an event ledger inside ' +
    'the same transaction that applies it, keyed on Stripe’s own event id. A ' +
    'replay finds the row already processed and stops. Out-of-order delivery is ' +
    'handled separately, with a watermark on the subscription.',
  ],
  [
    'Does the matching ever merge products on its own?',
    'Never. The model returns a confidence and a written reason, and anything it ' +
    'proposes waits for a person to confirm or reject it — at 0.94 and at 0.99 ' +
    'alike. Both answers are stored and fed back as examples.',
  ],
  [
    'What happens when I hit my plan limit?',
    'The insert is refused by a database trigger, not by a check in the interface. ' +
    'Downgrading never traps you: only an insert or update that adds to the ' +
    'tracked set is blocked, so an over-limit account can still be edited down.',
  ],
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="qa">
      {QA.map(([q, a], i) => (
        <div className={`qitem${open === i ? ' on' : ''}`} key={q}>
          <button
            type="button"
            aria-expanded={open === i}
            aria-controls={`qa-${i}`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span>{q}</span>
            <Plus size={16} aria-hidden />
          </button>
          <div className="qbody" id={`qa-${i}`} role="region" hidden={open !== i}>
            <p>{a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
