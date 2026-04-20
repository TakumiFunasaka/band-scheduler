import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  type AvailabilityRow,
  type AvailabilityStatus,
  type EventMeta,
  type ParticipantRow,
} from '../lib/types'
import { datesInRange, scoreDates } from '../lib/scoring'

const STATUSES: AvailabilityStatus[] = ['yes', 'maybe', 'no']
const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  yes: '○',
  maybe: '△',
  no: '×',
}

function formatDate(d: string) {
  const date = new Date(d + 'T00:00:00')
  const day = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  return `${date.getMonth() + 1}/${date.getDate()} (${day})`
}

export default function ScheduleView({
  meta,
  me,
}: {
  meta: EventMeta
  me: ParticipantRow
}) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const dates = useMemo(
    () =>
      datesInRange(meta.start_date, meta.end_date, {
        weekdaysOnly: meta.weekdays_only,
      }),
    [meta.start_date, meta.end_date, meta.weekdays_only],
  )

  async function reload() {
    const [pRes, aRes] = await Promise.all([
      supabase().from('participants').select('*').eq('event_id', meta.id),
      supabase()
        .from('availability')
        .select('*, participants!inner(event_id)')
        .eq('participants.event_id', meta.id),
    ])
    if (pRes.data) setParticipants(pRes.data as ParticipantRow[])
    if (aRes.data) {
      const rows = aRes.data as AvailabilityRow[]
      setAvailability(
        rows.map((r) => ({
          id: r.id,
          participant_id: r.participant_id,
          date: r.date,
          status: r.status,
        })),
      )
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id])

  const myById = useMemo(() => {
    const m = new Map<string, AvailabilityStatus>()
    for (const a of availability) {
      if (a.participant_id === me.id) m.set(a.date, a.status)
    }
    return m
  }, [availability, me.id])

  async function setStatus(date: string, status: AvailabilityStatus) {
    const existing = availability.find(
      (a) => a.participant_id === me.id && a.date === date,
    )
    setAvailability((prev) => {
      const without = prev.filter(
        (a) => !(a.participant_id === me.id && a.date === date),
      )
      return [
        ...without,
        {
          id: existing?.id ?? 'tmp-' + date,
          participant_id: me.id,
          date,
          status,
        },
      ]
    })
    if (existing && !existing.id.startsWith('tmp-')) {
      await supabase()
        .from('availability')
        .update({ status })
        .eq('id', existing.id)
    } else {
      await supabase()
        .from('availability')
        .insert({ participant_id: me.id, date, status })
    }
    reload()
  }

  const scores = useMemo(
    () => scoreDates(dates, participants, availability),
    [dates, participants, availability],
  )

  return (
    <div>
      <div className="card">
        <h2>あなたの回答（{me.nickname}）</h2>
        <p className="muted">
          18:00-22:00 の参加可否を ○/△/× で。<strong>押した瞬間に自動保存</strong>されるので保存ボタンはありません。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          {dates.map((d) => (
            <div
              key={d}
              style={{
                display: 'contents',
              }}
            >
              <div style={{ alignSelf: 'center' }}>{formatDate(d)}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    className={
                      'status-btn ' +
                      s +
                      (myById.get(d) === s ? ' active' : '')
                    }
                    onClick={() => setStatus(d, s)}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>日程スコア</h2>
        <p className="muted">
          ○=1、△=0.5 で数えつつ、楽器の種類が揃うほど＆人が増えるほど加点（いずれも飽和するので2人目以降は効きが弱め）。
        </p>
        {scores.map((s, i) => (
          <div key={s.date} className={'date-score' + (i === 0 && s.score > 0 ? ' top' : '')}>
            <div className="date">{formatDate(s.date)}</div>
            <div className="score">{s.score.toFixed(1)}</div>
            <div style={{ flex: 1, fontSize: 13 }}>
              <span className="muted">
                ○ {s.attendees.length}人 / △ {s.maybes.length}人
              </span>{' '}
              {Object.entries(s.coverage)
                .filter(([, v]) => (v ?? 0) > 0)
                .map(([inst]) => (
                  <span className="pill" key={inst}>
                    {inst}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>全員の回答</h2>
        <div className="schedule-grid" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>名前</th>
                {dates.map((d) => (
                  <th key={d}>{formatDate(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  <td className="name">
                    {p.nickname}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {p.instruments.join(', ')}
                    </div>
                  </td>
                  {dates.map((d) => {
                    const a = availability.find(
                      (x) => x.participant_id === p.id && x.date === d,
                    )
                    const cls = a ? a.status : ''
                    return (
                      <td key={d} className={cls}>
                        {a ? STATUS_LABEL[a.status] : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
