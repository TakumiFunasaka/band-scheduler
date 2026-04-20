import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { INSTRUMENTS, type Instrument, type ParticipantRow } from '../lib/types'

export default function ParticipantForm({
  eventId,
  onCreated,
}: {
  eventId: string
  onCreated: (p: ParticipantRow) => void
}) {
  const [nickname, setNickname] = useState('')
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(inst: Instrument) {
    setInstruments((prev) =>
      prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst],
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim()) return
    if (instruments.length === 0) {
      setError('楽器を1つ以上選んでください')
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase()
      .from('participants')
      .insert({ event_id: eventId, nickname: nickname.trim(), instruments })
      .select()
      .single()
    setLoading(false)
    if (err || !data) {
      setError(err?.message ?? '登録に失敗しました')
      return
    }
    onCreated(data as ParticipantRow)
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>参加登録</h1>
      <label>ニックネーム</label>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="例: ふなさか"
        required
      />
      <label>やりたい楽器（複数選択可）</label>
      <div>
        {INSTRUMENTS.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            className={'chip' + (instruments.includes(value) ? ' active' : '')}
            onClick={() => toggle(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading} style={{ marginTop: 16 }}>
        {loading ? '登録中…' : '登録して回答する'}
      </button>
    </form>
  )
}
