import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { INSTRUMENTS, type Instrument, type ParticipantRow } from '../lib/types'

export default function InstrumentEditor({
  participant,
  onSaved,
  onCancel,
}: {
  participant: ParticipantRow
  onSaved: (p: ParticipantRow) => void
  onCancel: () => void
}) {
  const [instruments, setInstruments] = useState<Instrument[]>(participant.instruments)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(inst: Instrument) {
    setInstruments((prev) =>
      prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst],
    )
  }

  async function save() {
    if (instruments.length === 0) {
      setError('楽器を1つ以上選んでください')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase()
      .from('participants')
      .update({ instruments })
      .eq('id', participant.id)
      .select()
      .single()
    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? '更新に失敗しました')
      return
    }
    onSaved(data as ParticipantRow)
  }

  return (
    <div style={{ marginTop: 8 }}>
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
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
        <button className="ghost" onClick={onCancel} disabled={saving}>
          キャンセル
        </button>
      </div>
    </div>
  )
}
