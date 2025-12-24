import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Local development identity.
 *
 * There is no Supabase project on this machine, and the app should still be
 * runnable end to end rather than sitting behind a setup screen. This provides
 * the one thing Supabase Auth was providing -- a verified user id -- and
 * nothing else. Everything downstream is unchanged: the id goes into
 * request.jwt.claims and RLS decides what that user can see.
 *
 * The cookie is HMAC-signed so it cannot be edited into another user's id in
 * devtools. That is not because this is a security boundary -- it is not, and
 * it never runs in production -- but because an unsigned one would make the
 * isolation demo a lie: you could "become" another tenant by typing.
 *
 * Guarded by PRICEVANE_LOCAL_AUTH. With Supabase configured this file is dead
 * code and the real client takes over.
 */
const COOKIE = 'pv_local_user'

export function isLocalAuth(): boolean {
  return process.env.PRICEVANE_LOCAL_AUTH === '1' &&
    process.env.NODE_ENV !== 'production'
}

function secret(): string {
  return process.env.PRICEVANE_LOCAL_SECRET ?? 'pricevane-local-development-only'
}

export function sign(userId: string): string {
  const mac = createHmac('sha256', secret()).update(userId).digest('hex').slice(0, 32)
  return `${userId}.${mac}`
}

export function verify(token: string | undefined): string | null {
  if (!token) return null
  const i = token.lastIndexOf('.')
  if (i < 0) return null
  const id = token.slice(0, i)
  const got = Buffer.from(token.slice(i + 1))
  const want = Buffer.from(createHmac('sha256', secret()).update(id).digest('hex').slice(0, 32))
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  return id
}

/** The local user's id, or null. */
export async function getLocalUserId(): Promise<string | null> {
  if (!isLocalAuth()) return null
  return verify((await cookies()).get(COOKIE)?.value)
}

export { COOKIE as LOCAL_COOKIE }
