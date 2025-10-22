import { redirect } from 'next/navigation'
import { getSupabaseServer, getUser } from '@/lib/supabase/server'
import { getMemberships } from '@/lib/auth/org'
import '../sign-in/auth.css'

export const dynamic = 'force-dynamic'

async function createOrg(formData: FormData) {
  'use server'
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46)
  const supabase = await getSupabaseServer()

  // The RPC creates the organization, the owner membership and the free
  // subscription in one transaction. Doing it as three client calls would leave
  // an org with no owner if the second failed — and no policy would let the
  // creator fix it, because they would not be a member of their own org.
  const { error } = await supabase.rpc('create_organization', {
    p_name: name,
    p_slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
  })
  if (error) throw error
  redirect('/app')
}

export default async function Onboarding() {
  if (!await getUser()) redirect('/sign-in')
  if ((await getMemberships()).length > 0) redirect('/app')

  return (
    <div className="authwrap">
      <div className="authcard">
        <span className="brandline">Price<b>vane</b></span>
        <h1>Name your workspace</h1>
        <p className="note">
          Everything — products, competitors, alerts — lives inside a workspace.
          You can create more later and switch between them.
        </p>
        <form action={createOrg}>
          <label htmlFor="name" className="lbl">Workspace name</label>
          <input id="name" name="name" required maxLength={120} className="inp"
                 placeholder="Northlight Home" autoComplete="organization" />
          <button className="btn3" type="submit">Create workspace</button>
        </form>
      </div>
    </div>
  )
}
