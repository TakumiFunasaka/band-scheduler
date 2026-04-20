import { createClient } from 'jsr:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2.4.3'
import { jsonResponse, preflight } from '../_shared/cors.ts'
import { signJwt } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)

  try {
    const { slug, password } = await req.json()
    if (!slug || !password) {
      return jsonResponse({ error: 'slug and password required' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const JWT_SECRET = Deno.env.get('JWT_SECRET')!
    if (!JWT_SECRET) return jsonResponse({ error: 'JWT_SECRET not configured' }, 500)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    })

    const { data: event, error } = await admin
      .from('events')
      .select(
        'id, slug, title, start_date, end_date, slot_start_hour, slot_end_hour, exclude_holidays, password_hash',
      )
      .eq('slug', slug)
      .maybeSingle()

    if (error) return jsonResponse({ error: error.message }, 500)
    if (!event) return jsonResponse({ error: 'event not found' }, 404)

    const ok = await bcrypt.compare(password, event.password_hash)
    if (!ok) return jsonResponse({ error: 'パスワードが違います' }, 401)

    const jwt = await signJwt(
      {
        role: 'authenticated',
        aud: 'authenticated',
        sub: `event-${event.id}`,
        event_id: event.id,
      },
      JWT_SECRET,
      60 * 60 * 24 * 30, // 30 days for participants
    )

    const { password_hash: _omit, ...safe } = event
    return jsonResponse({ event: safe, jwt })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
