import { revalidatePath } from 'next/cache'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { getSettings, saveSettings } from '@/lib/data/queries'
import { getActiveOrg, canManage } from '@/lib/auth/org'

export const dynamic = 'force-dynamic'

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'], wired: true },
  { id: 'openai', name: 'OpenAI', models: ['gpt-5', 'gpt-5-mini'], wired: false },
  { id: 'google', name: 'Google', models: ['gemini-3-pro', 'gemini-3-flash'], wired: false },
] as const

async function save(formData: FormData) {
  'use server'
  // No permission check here on purpose. The UPDATE policy requires
  // app.is_admin, so a member who is not an admin updates zero rows whatever
  // this action does -- the database is the boundary, and this page is not
  // trusted to be the one enforcing it.
  const n = await saveSettings({
    match_provider: String(formData.get('provider') ?? 'anthropic'),
    match_model: String(formData.get('model') ?? 'claude-opus-5'),
    review_floor: Number(formData.get('floor') ?? 0.55),
    crawl_hour: Number(formData.get('hour') ?? 2),
    crawl_frequency: String(formData.get('frequency') ?? 'nightly'),
    apiKey: String(formData.get('apiKey') ?? '') || null,
  })
  revalidatePath('/app/settings')
  return void n
}

export default async function Settings() {
  const [s, org] = await Promise.all([getSettings(), getActiveOrg()])
  const admin = org ? canManage(org.role) : false
  const current = PROVIDERS.find(p => p.id === s?.match_provider) ?? PROVIDERS[0]

  return (
    <>
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p>Which model does the matching, how sure it must be, and when we crawl.</p>
        </div>
      </div>

      {!admin && (
        <div className="iso warn">
          <ShieldAlert aria-hidden />
          <span>
            You are a <b>{org?.role}</b> in this workspace. You can read these settings but
            not change them — the update policy on the table requires an admin, so a save
            here would affect nothing.
          </span>
        </div>
      )}

      <form action={save} className="setform">
        <section className="card">
          <header><h2>Matching model</h2></header>
          <div className="card-pad formgrid">
            <label>
              <span className="lb">Provider</span>
              <select name="provider" defaultValue={s?.match_provider ?? 'anthropic'} disabled={!admin}>
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.wired ? '' : ' — not wired yet'}
                  </option>
                ))}
              </select>
              <em>
                Only Anthropic is implemented in the running code today
                (<code>src/lib/matching/claude.ts</code>). The other two are selectable so the
                setting exists; they will not answer until the provider is written.
              </em>
            </label>

            <label>
              <span className="lb">Model</span>
              <input name="model" defaultValue={s?.match_model ?? 'claude-opus-5'}
                     list="models" disabled={!admin} />
              <datalist id="models">
                {PROVIDERS.flatMap(p => p.models).map(m => <option key={m} value={m} />)}
              </datalist>
              <em>Currently answering with <b>{current.name}</b>.</em>
            </label>

            <label>
              <span className="lb">Review floor</span>
              <input name="floor" type="number" step="0.01" min="0" max="1"
                     defaultValue={s?.review_floor ?? '0.55'} disabled={!admin} />
              <em>
                Below this, a proposal is discarded rather than shown to a human. It is a
                floor on what is worth your attention — never a threshold for applying a
                match automatically. Nothing is ever applied without confirmation, at any
                confidence.
              </em>
            </label>

            <label>
              <span className="lb">API key</span>
              <div className="keyrow">
                <KeyRound size={14} aria-hidden />
                <input name="apiKey" type="password" placeholder={
                  s?.api_key_hint ? `Stored — ends ${s.api_key_hint}` : 'Not set'
                } autoComplete="off" disabled={!admin} />
              </div>
              <em>
                Encrypted at rest and never sent back to this page: the column is not
                granted to your role, so it cannot be read by anyone signed in — only by the
                service role that performs the matching. Leave blank to keep the existing key.
              </em>
            </label>
          </div>
        </section>

        <section className="card" style={{ marginTop: '1rem' }}>
          <header><h2>Crawl schedule</h2></header>
          <div className="card-pad formgrid">
            <label>
              <span className="lb">Frequency</span>
              <select name="frequency" defaultValue={s?.crawl_frequency ?? 'nightly'} disabled={!admin}>
                <option value="nightly">Nightly</option>
                <option value="twice_daily">Twice daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <em>Higher frequency costs more crawl budget and is capped by your plan.</em>
            </label>
            <label>
              <span className="lb">Start hour (UTC)</span>
              <input name="hour" type="number" min="0" max="23"
                     defaultValue={s?.crawl_hour ?? 2} disabled={!admin} />
              <em>
                Overnight by default. Crawling a storefront at its quietest hour is the
                polite choice as well as the one least likely to be rate-limited.
              </em>
            </label>
          </div>
        </section>

        {admin && (
          <div className="formactions">
            <button className="btn" type="submit">Save settings</button>
          </div>
        )}
      </form>
    </>
  )
}
