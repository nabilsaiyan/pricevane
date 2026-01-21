'use client'

import { createBrowserClient } from '@supabase/ssr'
import { supabaseUrl, supabasePublicKey } from './config'

export function getSupabaseBrowser() {
  return createBrowserClient(
    supabaseUrl()!,
    supabasePublicKey()!,
  )
}
