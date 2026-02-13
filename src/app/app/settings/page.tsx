import { revalidatePath } from 'next/cache'
import { KeyRound, ShieldAlert, Clock, SlidersHorizontal } from 'lucide-react'
import { getSettings, saveSettings } from '@/lib/data/queries'
import { getActiveOrg, canManage } from '@/lib/auth/org'
import { ProviderPicker, type Provider } from '@/components/app/ProviderPicker'

export const dynamic = 'force-dynamic'

const PROVIDERS: readonly Provider[] = [
  { id: 'anthropic', name: 'Claude', blurb: 'Anthropic',
    models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'], wired: true },
  { id: 'openai', name: 'GPT', blurb: 'OpenAI',
    models: ['gpt-5', 'gpt-5-mini'], wired: false },
  { id: 'google', name: 'Gemini', blurb: 'Google',
    models: ['gemini-3-pro', 'gemini-3-flash'], wired: false },
]

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
          <header><h2><SlidersHorizontal size={14} aria-hidden /> Matching model</h2></header>
          <div className="card-pad formgrid">
            <ProviderPicker
              providers={PROVIDERS}
              provider={s?.match_provider ?? 'anthropic'}
              model={s?.match_model ?? 'claude-opus-5'}
              disabled={!admin}
            />

            <div className="field">
              <span className="lb">Review floor</span>
              <input name="floor" type="number" step="0.01" min="0" max="1" className="inp num"
                     defaultValue={s?.review_floor ?? '0.55'} disabled={!admin} />
              <em>
                Below this, a proposal is discarded rather than shown to a human. It is a
                floor on what is worth your attention — never a threshold for applying a
                match automatically. Nothing is ever applied without confirmation, at any
                confidence.
              </em>
            </div>

            <div className="field">
              <span className="lb">API key</span>
              <div className="keyrow">
                <KeyRound size={14} aria-hidden />
                <input name="apiKey" type="password" className="inp bare" placeholder={
                  s?.api_key_hint ? `Stored — ends ${s.api_key_hint}` : 'Not set'
                } autoComplete="off" disabled={!admin} />
              </div>
              <em>
                Encrypted at rest and never sent back to this page: the column is not
                granted to your role, so it cannot be read by anyone signed in — only by the
                service role that performs the matching. Leave blank to keep the existing key.
              </em>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: '1rem' }}>
          <header><h2><Clock size={14} aria-hidden /> Crawl schedule</h2></header>
          <div className="card-pad formgrid">
            <div className="field">
              <span className="lb">Frequency</span>
              <div className="selwrap">
                <select name="frequency" className="inp" defaultValue={s?.crawl_frequency ?? 'nightly'}
                        disabled={!admin}>
                  <option value="nightly">Nightly</option>
                  <option value="twice_daily">Twice daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <em>Higher frequency costs more crawl budget and is capped by your plan.</em>
            </div>
            <div className="field">
              <span className="lb">Start hour (UTC)</span>
              <div className="keyrow">
                <Clock size={14} aria-hidden />
                <input name="hour" type="number" min="0" max="23" className="inp bare"
                       defaultValue={s?.crawl_hour ?? 2} disabled={!admin} />
              </div>
              <em>
                Overnight by default. Crawling a storefront at its quietest hour is the
                polite choice as well as the one least likely to be rate-limited.
              </em>
            </div>
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
