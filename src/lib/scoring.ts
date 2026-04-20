import type {
  AvailabilityRow,
  AvailabilityStatus,
  Instrument,
  ParticipantRow,
} from './types'

const INSTRUMENT_WEIGHT: Record<Instrument, number> = {
  drums: 4,
  bass: 4,
  vocal: 3,
  guitar: 2,
  keyboard: 1,
  other: 0.5,
}

const STATUS_WEIGHT: Record<AvailabilityStatus, number> = {
  yes: 1,
  maybe: 0.4,
  no: 0,
}

export type DateScore = {
  date: string
  score: number
  attendees: ParticipantRow[]
  maybes: ParticipantRow[]
  coverage: Partial<Record<Instrument, number>> // weighted count per instrument
  balanced: boolean // true if Dr + Ba + (Gt|Key) + Vo present with at least "maybe"
}

export function scoreDates(
  dates: string[],
  participants: ParticipantRow[],
  availability: AvailabilityRow[],
): DateScore[] {
  const byParticipant = new Map<string, ParticipantRow>()
  participants.forEach((p) => byParticipant.set(p.id, p))

  return dates
    .map((date) => {
      const attendees: ParticipantRow[] = []
      const maybes: ParticipantRow[] = []
      const coverage: Partial<Record<Instrument, number>> = {}
      let score = 0

      for (const row of availability) {
        if (row.date !== date) continue
        const p = byParticipant.get(row.participant_id)
        if (!p) continue
        const w = STATUS_WEIGHT[row.status]
        if (w === 0) continue
        if (row.status === 'yes') attendees.push(p)
        else maybes.push(p)
        for (const inst of p.instruments) {
          coverage[inst] = (coverage[inst] ?? 0) + w
          score += (INSTRUMENT_WEIGHT[inst] ?? 0) * w
        }
      }

      const has = (i: Instrument) => (coverage[i] ?? 0) > 0
      const hasHarmony = has('guitar') || has('keyboard')
      const balanced =
        has('drums') && has('bass') && hasHarmony && has('vocal')
      if (balanced) score *= 1.5

      return { date, score, attendees, maybes, coverage, balanced }
    })
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
}

export function datesInRange(start: string, end: string): string[] {
  const result: string[] = []
  const cur = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cur <= last) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    result.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return result
}
