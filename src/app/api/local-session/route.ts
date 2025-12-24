import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { isLocalAuth, sign, LOCAL_COOKIE } from '@/lib/auth/local'

/**
 * Assume a local development identity.
 *
 * Refuses outright unless PRICEVANE_LOCAL_AUTH is on and we are not in
 * production, so this route cannot become a way in on a deployed build. The id
 * is looked up from auth.users rather than accepted from the caller -- posting
 * an arbitrary uuid gets you nothing.
 */
export async function POST(req: Request) {
  if (!isLocalAuth()) {
    return NextResponse.json({ error: 'local auth disabled' }, { status: 404 })
  }
  const form = await req.formData()
  const email = String(form.get('email') ?? '')
  const { rows } = await getPool().query(
    'select id from auth.users where email = $1', [email])
  if (!rows[0]) {
    return NextResponse.json({ error: 'unknown identity' }, { status: 400 })
  }
  const res = NextResponse.redirect(new URL('/app', req.url), 303)
  res.cookies.set(LOCAL_COOKIE, sign(rows[0].id as string), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  })
  return res
}

/** Sign out. */
export async function DELETE(req: Request) {
  const res = NextResponse.redirect(new URL('/sign-in', req.url), 303)
  res.cookies.delete(LOCAL_COOKIE)
  return res
}
