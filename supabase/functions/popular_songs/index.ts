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

    const { tag = 'japanese' } = await req.json().catch(() => ({}))
    const url = new URL('https://ws.audioscrobbler.com/2.0/')
    url.searchParams.set('method', 'tag.gettoptracks')
    url.searchParams.set('tag', tag)
    url.searchParams.set('limit', '30')
    url.searchParams.set('api_key', LASTFM_API_KEY)
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString())
    if (!res.ok) {
      const text = await res.text()
      return jsonResponse({ error: `last.fm ${res.status}: ${text}` }, 502)
    }
    const data = await res.json()
    const tracks: LastFmTrack[] = data?.tracks?.track ?? []

    const songs = tracks.map((t) => ({
      title: t.name,
      artist: typeof t.artist === 'string' ? t.artist : t.artist?.name ?? '',
      url: t.url,
      listeners: t.listeners ? Number(t.listeners) : undefined,
    }))

    return jsonResponse({ songs })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
