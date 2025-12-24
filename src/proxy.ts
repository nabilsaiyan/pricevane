import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Refreshes the Supabase session cookie on every matched request.
 *
 * Named proxy.ts, not middleware.ts: Next 16 deprecated the middleware file
 * convention and warns on every build until you move.
 *
 * Without this, an expired access token is only noticed inside a page render,
 * where cookies are read-only, and the user is bounced to sign-in mid-session.
 *
 * It runs on far fewer routes than it once did. Matching everything meant a
 * missing environment variable took down the landing page and /architecture —
 * pages that never touch auth. A missing variable should degrade the app, not
 * delete the site.
 *
 * This is NOT the authorisation boundary. It gates navigation for a better
 * experience; the boundary is RLS. A request that slips past this proxy
 * still cannot read another tenant's rows.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Local development runs without Supabase entirely: identity comes from a
  // signed cookie and the page layer resolves it. Nothing to refresh here.
  if (process.env.PRICEVANE_LOCAL_AUTH === '1') return response

  // No Supabase configured — a fresh clone before .env.local exists. Let the
  // request through; /app renders a setup screen that says what to do, which is
  // more use than a stack trace in the dev overlay.
  if (!isSupabaseConfigured()) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    },
  )

  // getUser(), not getSession(): getSession reads the cookie without verifying
  // it against the auth server, so a forged cookie would look like a session.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isApp = path.startsWith('/app')

  if (isApp && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Only the routes that actually depend on a session. The landing page,
  // /architecture and every static asset are deliberately outside it.
  matcher: ['/app/:path*', '/sign-in', '/onboarding'],
}
