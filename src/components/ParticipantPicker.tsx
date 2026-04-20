import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ParticipantRow } from '../lib/types'

export default function ParticipantPicker({
  eventId,
  onPick,
  onCreateNew,
}: {
  eventId: string
  onPick: (p: ParticipantRow) => void
  onCreateNew: () => void
}) {
  const [participants, setParticipants] = useState<ParticipantRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data, error: err } = await supabase()
        .from('participants')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
      if (err) {
        setError(err.message)
        setParticipants([])
        return
      }
      setParticipants((data ?? []) as ParticipantRow[])
    })()
  }, [eventId])

  if (participants === null) return <p className="muted">読み込み中…</p>

  if (participants.length === 0) {
    // 誰も回答してない場合は迷わせない
    onCreateNew()
    return null
  }

  return (
    <div className="card">
      <h1>誰として回答しますか？</h1>
      <p className="muted">
        同じアカウントで別の端末から入った場合、既存の自分を選べば回答を引き継げます。
      </p>
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: 12 }}>
        {participants.map((p) => (
          <button
            key={p.id}
            className="ghost"
            style={{
              width: '100%',
              textAlign: 'left',
              marginBottom: 6,
              padding: '10px 14px',
            }}
            onClick={() => onPick(p)}
          >
            <strong>{p.nickname}</strong>{' '}
            {p.instruments.map((i) => (
              <span className="pill" key={i}>
                {i}
              </span>
            ))}
          </button>
        ))}
      </div>
      <button style={{ marginTop: 12 }} onClick={onCreateNew}>
        ＋ 新規で回答
      </button>
    </div>
  )
}
