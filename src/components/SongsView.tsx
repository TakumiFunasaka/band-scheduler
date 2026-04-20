import { useEffect, useMemo, useState } from 'react'
import { fetchPopularSongs } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { ParticipantRow, PopularSong, SongRow, SongVoteRow } from '../lib/types'

function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    return null
  } catch {
    return null
  }
}

type EnrichedSong = SongRow & { votes: SongVoteRow[] }

const TAG_SUGGESTIONS = [
  'japanese',
  'j-rock',
  'j-pop',
  'city pop',
  'anime',
  'rock',
  'pop',
  'indie',
  'punk',
  'alternative',
  'metal',
  'funk',
  'soul',
  'r&b',
  'jazz',
  'blues',
  'acoustic',
  'electronic',
  '80s',
  '90s',
  '2000s',
]

export default function SongsView({
  eventId,
  me,
}: {
  eventId: string
  me: ParticipantRow
}) {
  const [songs, setSongs] = useState<EnrichedSong[]>([])
  const [popular, setPopular] = useState<PopularSong[]>([])
  const [popularSeed, setPopularSeed] = useState(0)
  const [tag, setTag] = useState('japanese')
  const [lastFetchedTag, setLastFetchedTag] = useState<string | null>(null)
  const [manualUrl, setManualUrl] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [loadingPopular, setLoadingPopular] = useState(false)
  const [popularError, setPopularError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function reload() {
    const { data } = await supabase()
      .from('songs')
      .select('*, song_votes(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (!data) return
    const enriched = (data as (SongRow & { song_votes: SongVoteRow[] })[]).map(
      ({ song_votes, ...rest }) => ({ ...rest, votes: song_votes ?? [] }),
    )
    enriched.sort((a, b) => b.votes.length - a.votes.length)
    setSongs(enriched)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function loadPopular(overrideTag?: string) {
    const t = (overrideTag ?? tag ?? '').trim() || 'japanese'
    if (overrideTag !== undefined) setTag(overrideTag)
    setLoadingPopular(true)
    setPopularError(null)
    try {
      const result = await fetchPopularSongs(t, 100)
      if (result.length === 0) {
        setPopularError(`「${t}」では曲が見つからなかった。別のタグで試してみて。`)
      }
      setPopular(result)
      setLastFetchedTag(t)
      setPopularSeed(Math.random())
    } catch (e) {
      setPopularError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingPopular(false)
    }
  }

  function shufflePopular() {
    setPopularSeed(Math.random())
  }

  // Deterministic shuffle based on popularSeed so re-renders don't re-shuffle.
  const shownPopular = useMemo(() => {
    if (popular.length === 0) return []
    const arr = popular.slice()
    // Fisher–Yates with seeded PRNG (mulberry32).
    let s = Math.floor(popularSeed * 2 ** 32) || 1
    const rand = () => {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, 20)
  }, [popular, popularSeed])

  async function pickFromPopular(s: PopularSong) {
    await supabase().from('songs').insert({
      event_id: eventId,
      picked_by: me.nickname,
      title: s.title,
      artist: s.artist,
      youtube_url: null,
      source: 'lastfm',
    })
    reload()
  }

  async function addManual() {
    const title = manualTitle.trim() || manualUrl.trim()
    if (!title) return
    await supabase().from('songs').insert({
      event_id: eventId,
      picked_by: me.nickname,
      title,
      artist: null,
      youtube_url: manualUrl.trim() || null,
      source: manualUrl ? 'manual' : 'pick',
    })
    setManualUrl('')
    setManualTitle('')
    reload()
  }

  async function toggleVote(song: EnrichedSong) {
    const mine = song.votes.find((v) => v.voter === me.nickname)
    if (mine) {
      await supabase().from('song_votes').delete().eq('id', mine.id)
    } else {
      await supabase()
        .from('song_votes')
        .insert({ song_id: song.id, voter: me.nickname })
    }
    reload()
  }

  async function removeSong(song: EnrichedSong) {
    if (song.picked_by !== me.nickname) return
    if (!confirm('この曲を削除しますか？')) return
    await supabase().from('songs').delete().eq('id', song.id)
    reload()
  }

  return (
    <div>
      <div className="card">
        <h2>候補曲</h2>
        {songs.length === 0 && <p className="muted">まだ候補がありません。下から追加してみよう。</p>}
        {songs.map((s) => {
          const iVoted = s.votes.some((v) => v.voter === me.nickname)
          const embed = s.youtube_url ? youtubeEmbed(s.youtube_url) : null
          return (
            <div key={s.id} style={{ marginBottom: 6 }}>
              <div className="song-item">
                <button
                  className={'chip' + (iVoted ? ' active' : '')}
                  onClick={() => toggleVote(s)}
                  title="投票"
                >
                  ♥
                </button>
                <div className="meta">
                  <div className="title">
                    {s.title}
                    {s.artist && <span className="muted"> — {s.artist}</span>}
                  </div>
                  <div className="sub">
                    by {s.picked_by}
                    {s.youtube_url && (
                      <>
                        ・
                        <a href={s.youtube_url} target="_blank" rel="noreferrer">
                          YouTube
                        </a>
                        ・
                        <button
                          className="ghost"
                          style={{ padding: '0 6px', fontSize: 12 }}
                          onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                        >
                          {expanded === s.id ? '閉じる' : 'プレビュー'}
                        </button>
                      </>
                    )}
                    {s.picked_by === me.nickname && (
                      <>
                        ・
                        <button
                          className="ghost"
                          style={{ padding: '0 6px', fontSize: 12 }}
                          onClick={() => removeSong(s)}
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="votes">♥ {s.votes.length}</div>
              </div>
              {expanded === s.id && embed && (
                <div style={{ marginBottom: 6 }}>
                  <iframe
                    src={embed}
                    title={s.title}
                    width="100%"
                    height="260"
                    allow="accelerometer; encrypted-media; picture-in-picture"
                    allowFullScreen
                    style={{ border: 0, borderRadius: 8 }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card">
        <h2>自分で追加</h2>
        <label>YouTube URL</label>
        <input
          type="url"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <label>曲名（URL無しで曲名だけでもOK）</label>
        <input
          value={manualTitle}
          onChange={(e) => setManualTitle(e.target.value)}
        />
        <button style={{ marginTop: 12 }} onClick={addManual}>
          追加
        </button>
      </div>

      <div className="card">
        <h2 style={{ margin: 0 }}>Last.fm からピック</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Last.fmのタグで検索、シャッフルで別の曲に入れ替え。
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            style={{ flex: 1 }}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="タグ"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                loadPopular(tag)
              }
            }}
          />
          <button onClick={() => loadPopular()} disabled={loadingPopular}>
            {loadingPopular ? '読込中…' : '検索'}
          </button>
          <button
            className="ghost"
            onClick={shufflePopular}
            disabled={popular.length === 0}
          >
            シャッフル
          </button>
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap' }}>
          {TAG_SUGGESTIONS.map((t) => (
            <button
              type="button"
              key={t}
              className={'chip' + (lastFetchedTag === t ? ' active' : '')}
              onClick={() => loadPopular(t)}
              disabled={loadingPopular}
            >
              {t}
            </button>
          ))}
        </div>
        {popularError && <p className="error" style={{ marginTop: 8 }}>{popularError}</p>}
        {lastFetchedTag && popular.length > 0 && (
          <p className="muted" style={{ marginTop: 8 }}>
            「{lastFetchedTag}」の上位 {popular.length} 曲から 20 曲をランダム表示中。
          </p>
        )}
        {shownPopular.map((s) => (
          <div className="song-item" key={s.url}>
            <div className="meta">
              <div className="title">{s.title}</div>
              <div className="sub">
                {s.artist}
                {s.url && (
                  <>
                    ・
                    <a href={s.url} target="_blank" rel="noreferrer">
                      Last.fm
                    </a>
                  </>
                )}
              </div>
            </div>
            <button className="ghost" onClick={() => pickFromPopular(s)}>
              候補に追加
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
