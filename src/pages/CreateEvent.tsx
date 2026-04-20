import { useState } from 'react'
import { createEvent } from '../lib/api'
import { saveJwt } from '../lib/auth'

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
  const [title, setTitle] = useState('次回のバンド練')
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(plusDays(today(), 30))
  const [excludeHolidays, setExcludeHolidays] = useState(true)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ url: string; password: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!password || password.length < 4) {
      setError('パスワードは4文字以上にしてください')
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
        exclude_holidays: excludeHolidays,
        password,
      })
      saveJwt(event.slug, jwt)
      const url = `${location.origin}${location.pathname}#/e/${event.slug}`
      setResult({ url, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="card">
        <h1>募集回を作成しました</h1>
        <p>このURLとパスワードをバンドメンバーに共有してください。</p>
        <label>共有URL</label>
        <input type="text" readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} />
        <label>パスワード</label>
        <input type="text" readOnly value={result.password} onFocus={(e) => e.currentTarget.select()} />
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${result.url}\nパスワード: ${result.password}`)
            }}
          >
            URL+パスワードをコピー
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
          checked={excludeHolidays}
          onChange={(e) => setExcludeHolidays(e.target.checked)}
          style={{ width: 'auto' }}
        />
        祝日を候補日から除外する
      </label>
      <label>パスワード（メンバーに共有する合言葉）</label>
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="4文字以上"
        required
      />
      <p className="muted" style={{ marginTop: 8 }}>
        時間帯は 18:00-22:00 固定で候補日ごとに ○/△/× で回答してもらいます。
      </p>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
        {loading ? '作成中…' : '作成'}
      </button>
    </form>
  )
}
