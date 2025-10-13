import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase session cookie on every matched request.
 *
 * Named proxy.ts, not middleware.ts: Next 16 deprecated the middleware file
 * convention and warns on every build until you move.
 *
 * Without this, an expired access token is only noticed inside a page render,
 * where cookies are read-only, and the user is bounced to sign-in mid-session.
 *
 * This is NOT the authorisation boundary. It gates navigation for a better
 * experience; the boundary is RLS. A request that slips past this middleware
 * still cannot read another tenant's rows.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|products/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
