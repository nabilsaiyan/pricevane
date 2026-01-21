/**
 * Where the Supabase URL and public key come from.
 *
 * Supabase renamed the browser-safe key: what the dashboard used to call the
 * "anon key" is now the "publishable key", and new projects hand you
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY with an sb_publishable_ prefix rather
 * than a JWT. Both are the same thing to the client library, so both names are
 * accepted here and resolved in one place -- otherwise a project created this
 * year silently reads as "not configured" and the app shows a setup screen to
 * someone who has already configured it.
 *
 * The publishable key is safe to ship to the browser. It carries no authority
 * of its own; RLS decides what the bearer may see.
 */
export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function supabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * Is Supabase configured in this environment?
 *
 * A fresh clone has no .env.local, and the honest answer is "not yet" rather
 * than a stack trace. Every entry point that needs Supabase asks this first, so
 * the parts of the site that do not need it -- the landing page, /architecture
 * -- keep working. A missing environment variable should degrade the app, not
 * delete it.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublicKey())
}

export const SETUP_HINT =
  'Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and ' +
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (older projects: NEXT_PUBLIC_SUPABASE_ANON_KEY).'
