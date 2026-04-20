import { createClient } from 'jsr:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2.4.3'
import { corsHeaders, jsonResponse, preflight } from '../_shared/cors.ts'
import { signJwt } from '../_shared/jwt.ts'

function randomSlug(len = 8): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789' // no 0/1/l/o
  let s = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length]
  return s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)

  try {
    const {
      title,
      start_date,
      end_date,
      slot_start_hour = 18,
      slot_end_hour = 22,
      password,
    } = await req.json()

    if (!title || !start_date || !end_date || !password) {
      return jsonResponse({ error: 'missing required field' }, 400)
    }
    if (typeof password !== 'string' || password.length < 4) {
      return jsonResponse({ error: 'password too short' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const JWT_SECRET = Deno.env.get('JWT_SECRET')!
    if (!JWT_SECRET) return jsonResponse({ error: 'JWT_SECRET not configured' }, 500)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    })

    const password_hash = await bcrypt.hash(password, 10)

    // Try a few slugs in case of unlikely collision.
    let slug = randomSlug()
    let inserted: { id: string; slug: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await admin
        .from('events')
        .insert({
          slug,
          title,
          password_hash,
          start_date,
          end_date,
          slot_start_hour,
          slot_end_hour,
        })
        .select('id, slug')
        .single()
      if (!error && data) {
        inserted = data
        break
      }
      if (error && error.code === '23505') {
        slug = randomSlug()
        continue
      }
      return jsonResponse({ error: error?.message ?? 'insert failed' }, 500)
    }
    if (!inserted) return jsonResponse({ error: 'slug collision' }, 500)

    const jwt = await signJwt(
      {
        role: 'authenticated',
        aud: 'authenticated',
        sub: `event-${inserted.id}`,
        event_id: inserted.id,
      },
      JWT_SECRET,
      60 * 60 * 24 * 30, // 30 days for host
    )

    return jsonResponse({
      event: {
        id: inserted.id,
        slug: inserted.slug,
        title,
        start_date,
        end_date,
        slot_start_hour,
        slot_end_hour,
      },
      jwt,
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
