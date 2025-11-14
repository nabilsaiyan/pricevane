/**
 * Is Supabase configured in this environment?
 *
 * A fresh clone has no .env.local, and the honest answer is "not yet" rather
 * than a stack trace. Every entry point that needs Supabase asks this first, so
 * the parts of the site that do not need it — the landing page, /architecture —
 * keep working. A missing environment variable should degrade the app, not
 * delete it.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export const SETUP_HINT =
  'Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
