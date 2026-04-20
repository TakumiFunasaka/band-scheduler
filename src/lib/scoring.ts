import { isHoliday } from '@holiday-jp/holiday_jp'
import type {
  AvailabilityRow,
  AvailabilityStatus,
  Instrument,
  ParticipantRow,
} from './types'

// Per-instrument relative weight.
// Rhythm section is slightly more load-bearing; "other" is light.
const INSTRUMENT_WEIGHT: Record<Instrument, number> = {
  drums: 1.2,
  bass: 1.1,
  vocal: 1.0,
  guitar: 0.9,
  keyboard: 0.8,
  other: 0.4,
}

const STATUS_WEIGHT: Record<AvailabilityStatus, number> = {
  yes: 1,
  maybe: 0.5,
  no: 0,
}

// Diminishing returns: first person in a role contributes most, nth much less.
// f(0)=0, f(1)≈0.63, f(2)≈0.86, f(3)≈0.95
const saturate = (x: number) => 1 - Math.exp(-x)

export type DateScore = {
  date: string
  score: number
  attendees: ParticipantRow[]
  maybes: ParticipantRow[]
  coverage: Partial<Record<Instrument, number>>
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
      let headcount = 0

      for (const row of availability) {
        if (row.date !== date) continue
        const p = byParticipant.get(row.participant_id)
        if (!p) continue
        const sw = STATUS_WEIGHT[row.status]
        if (sw === 0) continue
        if (row.status === 'yes') attendees.push(p)
        else maybes.push(p)
        headcount += sw
        for (const inst of p.instruments) {
          coverage[inst] = (coverage[inst] ?? 0) + sw
        }
      }

      // Weighted & saturated per-instrument contribution.
      let roleScore = 0
      for (const inst of Object.keys(INSTRUMENT_WEIGHT) as Instrument[]) {
        roleScore += INSTRUMENT_WEIGHT[inst] * saturate(coverage[inst] ?? 0)
      }
      // Headcount bonus (also saturating — after ~3 people it plateaus).
      const headcountBonus = 2 * saturate(headcount / 2.5)

      const score = roleScore + headcountBonus

      return { date, score, attendees, maybes, coverage }
    })
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
}

export function datesInRange(
  start: string,
  end: string,
  opts: { weekdaysOnly?: boolean } = {},
): string[] {
  const result: string[] = []
  const cur = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cur <= last) {
    const day = cur.getDay() // 0=Sun, 6=Sat
    const isWeekend = day === 0 || day === 6
    const skip = opts.weekdaysOnly && (isWeekend || isHoliday(cur))
    if (!skip) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      result.push(`${y}-${m}-${d}`)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return result
}
