import { redirect } from 'next/navigation'
import { getSupabaseServer, getUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { SetupNotice } from '@/components/app/SetupNotice'
import { LocalSignIn } from '@/components/app/LocalSignIn'
import { isLocalAuth, getLocalUserId } from '@/lib/auth/local'
import './auth.css'

export const dynamic = 'force-dynamic'

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
  searchParams: Promise<{ sent?: string; next?: string }>
}) {
  // Local development: identity comes from the seeded auth.users table rather
  // than an emailed link, since there is no mail provider or Supabase project.
  if (isLocalAuth()) {
    if (await getLocalUserId()) redirect('/app')
    return <div className="authwrap"><div className="authcard wide"><LocalSignIn /></div></div>
  }
  if (!isSupabaseConfigured()) return <SetupNotice />
  if (await getUser()) redirect('/app')
  const { sent } = await searchParams

  return (
    <div className="authwrap">
      <div className="authcard">
        <span className="brandline">Price<b>vane</b></span>
        <h1>Sign in</h1>
        {sent
          ? <p className="note">Check your inbox — the link signs you straight in. It expires in an hour.</p>
          : (
            <>
              <p className="note">No password. We email you a link.</p>
              <form action={sendLink}>
                <label htmlFor="email" className="lbl">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email"
                       placeholder="you@company.com" className="inp" />
                <button className="btn3" type="submit">Email me a link</button>
              </form>
            </>
          )}
      </div>
    </div>
  )
}
