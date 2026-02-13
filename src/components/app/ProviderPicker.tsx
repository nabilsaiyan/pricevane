'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

/**
 * Provider + model, as one control.
 *
 * These were two disconnected fields before: a <select> of vendors and a free
 * text input with a datalist holding every model from every vendor, so it was
 * possible -- and easy -- to save "google" with "claude-opus-5". The model list
 * now follows the chosen provider, and changing provider moves the model to
 * that provider's default rather than leaving a stale one behind.
 *
 * The marks come from public/providers/<id>.svg, painted through a mask so
 * they take the surrounding text colour. See the README there.
 */
export type Provider = { id: string; name: string; blurb: string; models: string[]; wired: boolean }

export function ProviderPicker({
  providers, provider, model, disabled,
}: { providers: readonly Provider[]; provider: string; model: string; disabled: boolean }) {
  const [pid, setPid] = useState(providers.some(p => p.id === provider) ? provider : providers[0].id)
  const [mid, setMid] = useState(model)
  const active = providers.find(p => p.id === pid) ?? providers[0]

  function pick(p: Provider) {
    if (disabled) return
    setPid(p.id)
    // Carry the model over only if it belongs to the provider being chosen.
    if (!p.models.includes(mid)) setMid(p.models[0])
  }

  return (
    <>
      <input type="hidden" name="provider" value={pid} />
      <div className="field">
        <span className="lb">Provider</span>
        <div className="provgrid" role="radiogroup" aria-label="Matching provider">
          {providers.map(p => (
            <button
              key={p.id} type="button" role="radio" aria-checked={pid === p.id}
              disabled={disabled} onClick={() => pick(p)}
              className={`provcard${pid === p.id ? ' on' : ''}`}
            >
              <i className="provmark lg" data-provider={p.id} aria-hidden />
              <span className="pc-name">{p.name}</span>
              <span className={`pc-flag${p.wired ? ' live' : ''}`}>
                {p.wired ? 'Wired' : 'Not wired yet'}
              </span>
              <span className="pc-blurb">{p.blurb}</span>
              {pid === p.id && <Check className="pc-tick" size={13} aria-hidden />}
            </button>
          ))}
        </div>
        <em>
          Only Anthropic is implemented in the running code today, in{' '}
          <code>src/lib/matching/claude.ts</code>. The other two are selectable so the
          setting exists and is stored; they will not answer until the provider is written.
          Selecting one is not a partnership with that vendor.
        </em>
      </div>

      <div className="field">
        <span className="lb">Model</span>
        <div className="segbar" role="radiogroup" aria-label="Model">
          {active.models.map(m => (
            <button
              key={m} type="button" role="radio" aria-checked={mid === m}
              disabled={disabled} onClick={() => setMid(m)}
              className={`seg${mid === m ? ' on' : ''}`}
            >{m}</button>
          ))}
        </div>
        <input type="hidden" name="model" value={mid} />
        <em>
          Answering with <b>{active.name}</b> · <code>{mid}</code>.
          {!active.wired && ' This provider is not wired, so matching will not run until it is.'}
        </em>
      </div>
    </>
  )
}
