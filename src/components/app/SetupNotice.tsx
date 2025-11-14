import Link from 'next/link'

/**
 * Shown wherever the app needs Supabase and there is none configured.
 *
 * The default failure was a stack trace pointing at createServerClient, which
 * tells you what threw but not what to do. This tells you what to do.
 */
export function SetupNotice() {
  return (
    <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center',
                  padding: '1.5rem', background: 'var(--ink)' }}>
      <div style={{ maxWidth: 560, width: '100%', background: 'var(--s1)',
                    border: '1px solid var(--rule2)', borderRadius: 6, padding: '1.9rem' }}>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.26em',
                       textTransform: 'uppercase', color: 'var(--t1)', display: 'block' }}>
          Price<b style={{ color: 'var(--lime)', fontWeight: 400 }}>vane</b>
        </span>

        <h1 style={{ fontSize: '1.7rem', fontVariationSettings: "'wdth' 116, 'wght' 700",
                     letterSpacing: '-.035em', margin: '1.4rem 0 .6rem' }}>
          The app needs a database.
        </h1>
        <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.6, margin: '0 0 1.3rem' }}>
          No Supabase project is configured, so the dashboard has nothing to read. The
          landing page and{' '}
          <Link href="/architecture" style={{ color: 'var(--lime)' }}>the architecture write-up</Link>{' '}
          work without one.
        </p>

        <pre style={{ background: '#0B0D0E', border: '1px solid var(--rule)', borderRadius: 5,
                      padding: '.95rem 1.05rem', overflowX: 'auto', margin: '0 0 1.2rem' }}>
          <code style={{ fontFamily: 'var(--fm)', fontSize: 12, lineHeight: 1.7,
                         color: 'var(--t2)', display: 'block' }}>
            cp .env.example .env.local{'\n'}
            <span style={{ color: 'var(--t3)' }}># then fill in, from Supabase &gt; Settings &gt; API:</span>{'\n'}
            <span style={{ color: 'var(--lime)' }}>NEXT_PUBLIC_SUPABASE_URL</span>{'\n'}
            <span style={{ color: 'var(--lime)' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>{'\n'}
            <span style={{ color: 'var(--lime)' }}>DATABASE_URL</span>{'  '}
            <span style={{ color: 'var(--t3)' }}># Settings &gt; Database</span>
          </code>
        </pre>

        <p style={{ color: 'var(--t3)', fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          Then <code style={{ fontFamily: 'var(--fm)', color: 'var(--t2)' }}>npm run db:push</code>{' '}
          to apply the migrations and{' '}
          <code style={{ fontFamily: 'var(--fm)', color: 'var(--t2)' }}>npm run seed</code>{' '}
          for six months of demo history. To see the tests without any of this, run{' '}
          <code style={{ fontFamily: 'var(--fm)', color: 'var(--t2)' }}>npm test</code>{' '}
          — it spins up its own Postgres in Docker.
        </p>
      </div>
    </div>
  )
}
