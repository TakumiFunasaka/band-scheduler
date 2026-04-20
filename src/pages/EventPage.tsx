import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { joinEvent } from '../lib/api'
import { getJwtForSlug, jwtExpired, saveJwt, clearJwt, setCurrentSlug } from '../lib/auth'
import type { EventMeta, ParticipantRow } from '../lib/types'
import PasswordGate from '../components/PasswordGate'
import ParticipantForm from '../components/ParticipantForm'
import ScheduleView from '../components/ScheduleView'
import SongsView from '../components/SongsView'
import { supabase } from '../lib/supabase'

const MY_PARTICIPANT_KEY = (slug: string) => `bs_me_${slug}`

export default function EventPage() {
  const { slug = '' } = useParams()
  const [meta, setMeta] = useState<EventMeta | null>(null)
  const [authed, setAuthed] = useState(false)
  const [me, setMe] = useState<ParticipantRow | null>(null)
  const [tab, setTab] = useState<'schedule' | 'songs'>('schedule')
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    const myId = localStorage.getItem(MY_PARTICIPANT_KEY(slug))
    if (!myId) {
      setMe(null)
      return
    }
    const { data } = await supabase()
      .from('participants')
      .select('*')
      .eq('id', myId)
      .maybeSingle()
    if (data) setMe(data as ParticipantRow)
    else setMe(null)
  }, [slug])

  useEffect(() => {
    const existing = getJwtForSlug(slug)
    if (existing && !jwtExpired(existing)) {
      setCurrentSlug(slug)
      setAuthed(true)
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    if (!authed) return
    ;(async () => {
      const { data, error } = await supabase()
        .from('events')
        .select('id, slug, title, start_date, end_date, slot_start_hour, slot_end_hour')
        .eq('slug', slug)
        .maybeSingle()
      if (error || !data) {
        clearJwt(slug)
        setAuthed(false)
        return
      }
      setMeta(data as EventMeta)
      await loadMe()
    })()
  }, [authed, slug, loadMe])

  async function onUnlock(password: string) {
    const { event, jwt } = await joinEvent({ slug, password })
    saveJwt(slug, jwt)
    setMeta(event)
    setAuthed(true)
    await loadMe()
  }

  function onMe(p: ParticipantRow) {
    localStorage.setItem(MY_PARTICIPANT_KEY(slug), p.id)
    setMe(p)
  }

  if (loading) return <p className="muted">Loading…</p>

  if (!authed) {
    return <PasswordGate slug={slug} onUnlock={onUnlock} />
  }

  if (!meta) return <p className="muted">読み込み中…</p>

  if (!me) {
    return <ParticipantForm eventId={meta.id} onCreated={onMe} />
  }

  return (
    <div>
      <div className="card">
        <h1 style={{ marginBottom: 4 }}>{meta.title}</h1>
        <p className="muted">
          {meta.start_date} 〜 {meta.end_date} ・ {meta.slot_start_hour}:00-{meta.slot_end_hour}:00
        </p>
        <p className="muted">
          回答中: <strong>{me.nickname}</strong>{' '}
          {me.instruments.map((i) => (
            <span className="pill" key={i}>
              {i}
            </span>
          ))}{' '}
          <button
            className="ghost"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={() => {
              localStorage.removeItem(MY_PARTICIPANT_KEY(slug))
              setMe(null)
            }}
          >
            別の人で回答
          </button>
        </p>
      </div>

      <div className="tabs">
        <button
          className={'tab' + (tab === 'schedule' ? ' active' : '')}
          onClick={() => setTab('schedule')}
        >
          日程
        </button>
        <button
          className={'tab' + (tab === 'songs' ? ' active' : '')}
          onClick={() => setTab('songs')}
        >
          曲決め
        </button>
      </div>

      {tab === 'schedule' ? (
        <ScheduleView meta={meta} me={me} />
      ) : (
        <SongsView eventId={meta.id} me={me} />
      )}
    </div>
  )
}
