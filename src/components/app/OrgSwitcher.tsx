'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { switchOrg } from '@/app/app/actions'
import type { Membership } from '@/lib/auth/org'

export function OrgSwitcher({ memberships, active }: {
  memberships: Membership[]
  active: Membership
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="orgsw" ref={box}>
      <span className="who">Workspace</span>
      <button type="button" onClick={() => setOpen(o => !o)}
              aria-expanded={open} aria-haspopup="menu">
        <span>{active.organizations.name}</span>
        <ChevronsUpDown size={13} aria-hidden />
      </button>
      {open && (
        <menu>
          {memberships.map(m => (
            <li key={m.organization_id}>
              <form action={switchOrg}>
                <input type="hidden" name="organization_id" value={m.organization_id} />
                <button type="submit" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>{m.organizations.name}</span>
                  {m.organization_id === active.organization_id
                    ? <Check size={13} aria-label="current" /> : null}
                </button>
              </form>
            </li>
          ))}
        </menu>
      )}
    </div>
  )
}
