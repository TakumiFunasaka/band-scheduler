import { jsonResponse, preflight } from '../_shared/cors.ts'

type LastFmTrack = {
  name: string
  artist: { name: string } | string
  url: string
  listeners?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)

  try {
    const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY')
    if (!LASTFM_API_KEY) {
      return jsonResponse({ error: 'LASTFM_API_KEY not set' }, 500)
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const tag = typeof body.tag === 'string' && body.tag.trim()
      ? body.tag.trim()
      : 'japanese'
    const limit = Math.min(
      typeof body.limit === 'number' && body.limit > 0 ? body.limit : 100,
      200,
    )

    // Pull a larger pool from Last.fm so the caller can shuffle client-side.
    const url = new URL('https://ws.audioscrobbler.com/2.0/')
    url.searchParams.set('method', 'tag.gettoptracks')
    url.searchParams.set('tag', tag)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('api_key', LASTFM_API_KEY)
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString())
    if (!res.ok) {
      const text = await res.text()
      return jsonResponse({ error: `last.fm ${res.status}: ${text}` }, 502)
    }
    const data = await res.json()
    // Last.fm returns `error` field for bad tags etc.
    if (data?.error) {
      return jsonResponse(
        { error: `last.fm: ${data.message ?? 'unknown error'}` },
        502,
      )
    }
    const tracks: LastFmTrack[] = data?.tracks?.track ?? []

    const songs = tracks.map((t) => ({
      title: t.name,
      artist: typeof t.artist === 'string' ? t.artist : t.artist?.name ?? '',
      url: t.url,
      listeners: t.listeners ? Number(t.listeners) : undefined,
    }))

    return jsonResponse({ tag, songs })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
