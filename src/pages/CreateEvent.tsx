import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createEvent } from '../lib/api'
import { saveJwt } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { CarrySong } from '../lib/types'

function formatLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function today() {
  return formatLocal(new Date())
}
function plusDays(yyyyMmDd: string, days: number) {
  const d = new Date(yyyyMmDd + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatLocal(d)
}

export default function CreateEvent() {
  const routerLocation = useLocation()
  const carrySongs =
    (routerLocation.state as { carrySongs?: CarrySong[] } | null)?.carrySongs ?? []

  const [title, setTitle] = useState('次回のバンド練')
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(plusDays(today(), 30))
  const [weekdaysOnly, setWeekdaysOnly] = useState(true)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    url: string
    password: string
    carriedCount: number
    carryFailed: boolean
  } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password && password.length < 4) {
      setError('パスワードを設定する場合は4文字以上にしてください')
      return
    }
    if (end < start) {
      setError('終了日は開始日以降にしてください')
      return
    }
    setLoading(true)
    try {
      const { event, jwt } = await createEvent({
        title,
        start_date: start,
        end_date: end,
        weekdays_only: weekdaysOnly,
        password: password || undefined,
      })
      saveJwt(event.slug, jwt)

      // Carry over candidate songs from the previous event, if any. The JWT we
      // just saved scopes RLS to the new event, so these inserts are allowed.
      let carryFailed = false
      if (carrySongs.length > 0) {
        const { error: songErr } = await supabase()
          .from('songs')
          .insert(
            carrySongs.map((s) => ({
              event_id: event.id,
              picked_by: s.picked_by,
              title: s.title,
              artist: s.artist,
              youtube_url: s.youtube_url,
              source: s.source,
            })),
          )
        if (songErr) carryFailed = true
      }

      const url = `${location.origin}${location.pathname}#/e/${event.slug}`
      setResult({
        url,
        password,
        carriedCount: carryFailed ? 0 : carrySongs.length,
        carryFailed,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const hasPassword = result.password.length > 0
    return (
      <div className="card">
        <h1>募集回を作成しました</h1>
        <p>
          {hasPassword
            ? 'このURLとパスワードをバンドメンバーに共有してください。'
            : 'このURLをバンドメンバーに共有してください。パスワードなしで参加できます。'}
        </p>
        {result.carriedCount > 0 && (
          <p className="muted">前回の候補曲を {result.carriedCount} 曲引き継ぎました。</p>
        )}
        {result.carryFailed && (
          <p className="error">候補曲の引き継ぎに失敗しました。新しいページで手動で追加してください。</p>
        )}
        <label>共有URL</label>
        <input type="text" readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} />
        {hasPassword && (
          <>
            <label>パスワード</label>
            <input
              type="text"
              readOnly
              value={result.password}
              onFocus={(e) => e.currentTarget.select()}
            />
          </>
        )}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                hasPassword
                  ? `${result.url}\nパスワード: ${result.password}`
                  : result.url,
              )
            }}
          >
            {hasPassword ? 'URL+パスワードをコピー' : 'URLをコピー'}
          </button>
          <a className="btn ghost" href={result.url.replace(location.origin + location.pathname, '')}>
            開く
          </a>
        </div>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>募集回を作成</h1>
      {carrySongs.length > 0 && (
        <p className="muted">
          前回の候補曲を <strong>{carrySongs.length}</strong> 曲引き継ぎます（作成後に新しいページへ追加されます）。
        </p>
      )}
      <label>タイトル</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="row">
        <div style={{ flex: 1 }}>
          <label>開始日</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div style={{ flex: 1 }}>
          <label>終了日</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 0', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={weekdaysOnly}
          onChange={(e) => setWeekdaysOnly(e.target.checked)}
          style={{ width: 'auto' }}
        />
        出勤日のみを候補にする（土日祝を除く）
      </label>
      <label>パスワード（任意・メンバーに共有する合言葉）</label>
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="空欄ならURLだけで参加可"
      />
      <p className="muted" style={{ marginTop: 8 }}>
        パスワードは任意です。空欄にするとURLを知っている人は誰でも参加できます。
        時間帯は 18:00-22:00 固定で候補日ごとに ○/△/× で回答してもらいます。
      </p>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
        {loading ? '作成中…' : '作成'}
      </button>
    </form>
  )
}
