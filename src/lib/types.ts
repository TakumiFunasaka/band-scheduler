export type Instrument =
  | 'vocal'
  | 'guitar'
  | 'bass'
  | 'drums'
  | 'keyboard'
  | 'other'

export const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: 'vocal', label: 'ボーカル' },
  { value: 'guitar', label: 'ギター' },
  { value: 'bass', label: 'ベース' },
  { value: 'drums', label: 'ドラム' },
  { value: 'keyboard', label: 'キーボード' },
  { value: 'other', label: 'その他' },
]

export type AvailabilityStatus = 'yes' | 'maybe' | 'no'

export type EventRow = {
  id: string
  slug: string
  title: string
  start_date: string // yyyy-mm-dd
  end_date: string
  slot_start_hour: number
  slot_end_hour: number
  created_at: string
}

export type ParticipantRow = {
  id: string
  event_id: string
  nickname: string
  instruments: Instrument[]
  created_at: string
}

export type AvailabilityRow = {
  id: string
  participant_id: string
  date: string // yyyy-mm-dd
  status: AvailabilityStatus
}

export type SongRow = {
  id: string
  event_id: string
  picked_by: string
  title: string
  artist: string | null
  youtube_url: string | null
  source: 'pick' | 'lastfm' | 'manual'
  created_at: string
}

export type SongVoteRow = {
  id: string
  song_id: string
  voter: string
  created_at: string
}

export type PopularSong = {
  title: string
  artist: string
  url: string
  listeners?: number
}

export type EventMeta = {
  id: string
  slug: string
  title: string
  start_date: string
  end_date: string
  slot_start_hour: number
  slot_end_hour: number
}
