import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseUrl, supabasePublicKey } from './config'

/**
 * Request-scoped Supabase client carrying the user's session.
 *
 * Every tenant-facing read and write goes through this, never through the
 * service-role pool in lib/db.ts. That is the point: this connection is subject
 * to RLS, so the database decides what the caller may see. Route handlers do
 * not get to be trusted.
 */
export async function getSupabaseServer() {
  const store = await cookies()
  return createServerClient(
    supabaseUrl()!,
    supabasePublicKey()!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) store.set(name, value, options)
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to swallow.
          }
        },
      },
    },
  )
}

/** The signed-in user, or null. */
export async function getUser() {
  const supabase = await getSupabaseServer()
  const { data } = await supabase.auth.getUser()
  return data.user
}
