import { redirect } from 'next/navigation'
import { getSupabaseServer, getUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { SetupNotice } from '@/components/app/SetupNotice'
import { LocalSignIn } from '@/components/app/LocalSignIn'
import { isLocalAuth, getLocalUserId } from '@/lib/auth/local'
import './auth.css'

export const dynamic = 'force-dynamic'

/**
 * Password sign-in.
 *
 * The magic link stays the primary route, but it is unusable on its own here:
 * Supabase's built-in sender is rate limited to a handful of messages an hour
 * and is explicitly not for production, so a demo that depends on it is a demo
 * that stops working when someone tries it twice. A password path makes the
 * seeded identities reachable now, and stays useful for anyone who would
 * rather not wait for an email.
 *
 * The error is deliberately the same whether the address is unknown or the
 * password is wrong -- distinguishing them turns this form into a way to
 * enumerate who has an account.
 */
async function signInWithPassword(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return

  const supabase = await getSupabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/sign-in?error=1')
  redirect('/app')
}

async function sendLink(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return
  const supabase = await getSupabaseServer()
  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/app` },
  })
  redirect('/sign-in?sent=1')
}

export default async function SignIn({ searchParams }: {
  searchParams: Promise<{ sent?: string; next?: string; error?: string }>
}) {
  // Local development: identity comes from the seeded auth.users table rather
  // than an emailed link, since there is no mail provider or Supabase project.
  if (isLocalAuth()) {
    if (await getLocalUserId()) redirect('/app')
    return <div className="authwrap"><div className="authcard wide"><LocalSignIn /></div></div>
  }
  if (!isSupabaseConfigured()) return <SetupNotice />
  if (await getUser()) redirect('/app')
  const { sent, error } = await searchParams

  return (
    <div className="authwrap">
      <div className="authcard">
        <span className="brandline">Price<b>vane</b></span>
        <h1>Sign in</h1>
        {sent
          ? <p className="note">Check your inbox — the link signs you straight in. It expires in an hour.</p>
          : (
            <>
              {error && (
                <p className="note err">That email and password do not match an account.</p>
              )}

              <form action={signInWithPassword}>
                <label htmlFor="email" className="lbl">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email"
                       placeholder="you@company.com" className="inp" />
                <label htmlFor="password" className="lbl">Password</label>
                <input id="password" name="password" type="password" required
                       autoComplete="current-password" className="inp" />
                <button className="btn3" type="submit">Sign in</button>
              </form>

              <div className="orline"><span>or</span></div>

              <form action={sendLink}>
                <input type="hidden" name="email" value="" />
                <label htmlFor="magic" className="lbl">Email me a link instead</label>
                <input id="magic" name="email" type="email" required autoComplete="email"
                       placeholder="you@company.com" className="inp" />
                <button className="btn3 ghost" type="submit">Email me a link</button>
              </form>
            </>
          )}
      </div>
    </div>
  )
}
