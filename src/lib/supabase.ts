import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getJwt } from './auth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surface early during dev — without these, nothing works.
  console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')
}

let clientCache: { jwt: string | null; client: SupabaseClient } | null = null

export function supabase(): SupabaseClient {
  const jwt = getJwt()
  if (clientCache && clientCache.jwt === jwt) return clientCache.client
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: jwt
      ? { headers: { Authorization: `Bearer ${jwt}` } }
      : undefined,
  })
  clientCache = { jwt, client }
  return client
}

export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`
export { SUPABASE_ANON_KEY }
