import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { joinEvent } from '../lib/api'
import { getJwtForSlug, jwtExpired, saveJwt, clearJwt, setCurrentSlug } from '../lib/auth'
import type { EventMeta, ParticipantRow } from '../lib/types'
import PasswordGate from '../components/PasswordGate'
import ParticipantForm from '../components/ParticipantForm'
import ParticipantPicker from '../components/ParticipantPicker'
import InstrumentEditor from '../components/InstrumentEditor'
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
  const [editingInstruments, setEditingInstruments] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)

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

  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!authed) return
    ;(async () => {
      const { data, error } = await supabase()
        .from('events')
        .select(
          'id, slug, title, start_date, end_date, slot_start_hour, slot_end_hour, weekdays_only',
        )
        .eq('slug', slug)
        .maybeSingle()
      if (error) {
        // Auth/RLS errors → clear JWT and ask again. Other errors → show.
        const authCode = error.code === 'PGRST301' || error.code === '42501'
        if (authCode) {
          clearJwt(slug)
          setAuthed(false)
        } else {
          setFetchError(`${error.code ?? ''} ${error.message}`.trim())
        }
        return
      }
      if (!data) {
        // JWT probably expired / mismatched.
        clearJwt(slug)
        setAuthed(false)
        return
      }
      setFetchError(null)
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

  if (!meta) {
    if (fetchError) {
      return (
        <div className="card">
          <h2>読み込みエラー</h2>
          <p className="error">{fetchError}</p>
          <p className="muted">
            DBマイグレーション未適用か、ネットワーク一時エラーの可能性。再読込するか、管理者に連絡してください。
          </p>
          <button onClick={() => location.reload()}>再読込</button>
        </div>
      )
    }
    return <p className="muted">読み込み中…</p>
  }

  if (!me) {
    if (creatingNew) {
      return <ParticipantForm eventId={meta.id} onCreated={onMe} />
    }
    return (
      <ParticipantPicker
        eventId={meta.id}
        onPick={onMe}
        onCreateNew={() => setCreatingNew(true)}
      />
    )
  }

  return (
    <div>
      <div className="card">
        <h1 style={{ marginBottom: 4 }}>{meta.title}</h1>
        <p className="muted">
          {meta.start_date} 〜 {meta.end_date} ・ {meta.slot_start_hour}:00-{meta.slot_end_hour}:00
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          回答中: <strong>{me.nickname}</strong>{' '}
          {me.instruments.map((i) => (
            <span className="pill" key={i}>
              {i}
            </span>
          ))}{' '}
          <button
            className="ghost"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={() => setEditingInstruments((v) => !v)}
          >
            {editingInstruments ? '閉じる' : '楽器を編集'}
          </button>{' '}
          <button
            className="ghost"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={() => {
              localStorage.removeItem(MY_PARTICIPANT_KEY(slug))
              setMe(null)
              setEditingInstruments(false)
              setCreatingNew(false)
            }}
          >
            別の人で回答
          </button>
        </p>
        {editingInstruments && (
          <InstrumentEditor
            participant={me}
            onSaved={(p) => {
              setMe(p)
              setEditingInstruments(false)
            }}
            onCancel={() => setEditingInstruments(false)}
          />
        )}
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
