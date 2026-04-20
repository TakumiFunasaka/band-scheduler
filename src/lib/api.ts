import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './supabase'
import type { EventMeta, PopularSong } from './types'

async function callFn<T>(name: string, body: unknown, jwt?: string): Promise<T> {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // anon key required by Supabase gateway; our function does its own auth.
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

export type CreateEventInput = {
  title: string
  start_date: string
  end_date: string
  slot_start_hour?: number
  slot_end_hour?: number
  password: string
}

export type CreateEventResult = {
  event: EventMeta
  jwt: string
}

export async function createEvent(
  input: CreateEventInput,
): Promise<CreateEventResult> {
  return callFn<CreateEventResult>('create_event', input)
}

export type JoinEventInput = {
  slug: string
  password: string
}

export type JoinEventResult = {
  event: EventMeta
  jwt: string
}

export async function joinEvent(
  input: JoinEventInput,
): Promise<JoinEventResult> {
  return callFn<JoinEventResult>('join_event', input)
}

export async function fetchPopularSongs(tag = 'japanese'): Promise<PopularSong[]> {
  const res = await callFn<{ songs: PopularSong[] }>('popular_songs', { tag })
  return res.songs
}
