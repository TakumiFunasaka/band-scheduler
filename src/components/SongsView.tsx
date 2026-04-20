import { useEffect, useState } from 'react'
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

export default function SongsView({
  eventId,
  me,
}: {
  eventId: string
  me: ParticipantRow
}) {
  const [songs, setSongs] = useState<EnrichedSong[]>([])
  const [popular, setPopular] = useState<PopularSong[]>([])
  const [manualUrl, setManualUrl] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [loadingPopular, setLoadingPopular] = useState(false)
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

  async function loadPopular() {
    setLoadingPopular(true)
    try {
      setPopular(await fetchPopularSongs('japanese'))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPopular(false)
    }
  }

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
          placeholder="例: 小さな恋のうた"
        />
        <button style={{ marginTop: 12 }} onClick={addManual}>
          追加
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Last.fm 人気曲（japanese タグ）</h2>
          <button className="ghost" onClick={loadPopular} disabled={loadingPopular}>
            {loadingPopular ? '読込中…' : popular.length ? '再読込' : '読み込む'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          雑にインスピレーションを拾う用。クリックで候補曲に追加。
        </p>
        {popular.slice(0, 20).map((s) => (
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
