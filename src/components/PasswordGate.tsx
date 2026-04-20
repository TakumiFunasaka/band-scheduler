import { useState } from 'react'

export default function PasswordGate({
  slug,
  onUnlock,
}: {
  slug: string
  onUnlock: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onUnlock(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワードが違います')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>パスワードを入力</h1>
      <p className="muted">イベント <code>{slug}</code> にアクセスするには合言葉が必要です。</p>
      <label>パスワード</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        required
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
        {loading ? '確認中…' : '入室'}
      </button>
    </form>
  )
}
