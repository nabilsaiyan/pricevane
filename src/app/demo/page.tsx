import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { SetupNotice } from '@/components/app/SetupNotice'
import '../sign-in/auth.css'

export const dynamic = 'force-dynamic'

/**
 * Enter the demo: sign in anonymously, take real membership of both demo
 * workspaces, land in the dashboard.
 *
 * The visitor gets a genuine auth user and genuine membership rows. No policy
 * is relaxed for them, which is the only way the isolation banner in the app
 * can honestly claim what it claims.
 */
async function enterDemo() {
  'use server'
  const supabase = await getSupabaseServer()

  const { error: authError } = await supabase.auth.signInAnonymously()
  if (authError) throw new Error(
    `anonymous sign-in failed: ${authError.message}. ` +
    'Enable it in Supabase > Authentication > Sign In / Providers > Anonymous.')

  const { error } = await supabase.rpc('join_demo')
  if (error) throw error

  redirect('/app')
}

export default async function Demo() {
  if (!isSupabaseConfigured()) return <SetupNotice />

  return (
    <div className="authwrap">
      <div className="authcard" style={{ maxWidth: 460 }}>
        <span className="brandline">Price<b>vane</b></span>
        <h1>Look around.</h1>
        <p className="note">
          Two seeded workspaces with six months of real price history — a price war, a stockout,
          a discontinued listing. No signup, no card.
        </p>

        <ul style={{ listStyle: 'none', margin: '0 0 1.5rem', padding: 0, display: 'grid', gap: '.6rem' }}>
          {[
            'Switch workspaces and watch the data change completely',
            'Confirm or reject a proposed product match',
            'Subscribe with Stripe test card 4242 4242 4242 4242, then cancel',
          ].map(t => (
            <li key={t} style={{ display: 'flex', gap: '.6rem', alignItems: 'baseline',
                                 color: 'var(--t2)', fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--lime)', fontFamily: 'var(--fm)', fontSize: 11 }}>→</span>
              {t}
            </li>
          ))}
        </ul>

        <form action={enterDemo}>
          <button className="btn3" type="submit">Enter the demo</button>
        </form>

        <p style={{ color: 'var(--t3)', fontSize: 11.5, lineHeight: 1.55, margin: '1.1rem 0 0' }}>
          You get a real anonymous account with real membership rows. No policy is relaxed for
          demo visitors — that is the only way the isolation claim means anything.{' '}
          <Link href="/architecture" style={{ color: 'var(--lime)' }}>How it works</Link>.
        </p>
      </div>
    </div>
  )
}
