// Activities.jsx — 我的活動：團隊活動（領導人建立、全隊看得到）＋個人活動
// 入口：設定 → 我的活動
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { IconArrowLeft, IconCalendarEvent } from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'
import { DateField } from './pickers'
import { askConfirm } from './confirmDialog'
import { fetchMyTeam } from './teamStats'
import { fetchUpcomingEvents, daysUntil } from './eventInvite'
import { resolveEventWeeks } from './dailyMode'
import { cardStyle, SectionHeader, Tile, Tag } from './ui'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS, SUBCARD_BG,
  ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, DANGER,
} from './designTokens'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
function todayStr() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function parts(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: WEEK[d.getUTCDay()] }
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: RADIUS.sm,
  border: `1px solid ${BORDER}`, background: SUBCARD_BG, color: TEXT_MAIN, fontSize: 14, outline: 'none',
}

export default function Activities() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [team, setTeam] = useState(null)
  const [events, setEvents] = useState([])
  const [weeks, setWeeks] = useState(3)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null) // null = 不顯示；否則是正在新增/編輯的活動
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    const u = session?.user
    if (!u) { setLoading(false); return }
    setUser(u)
    const [tm, evs, prof] = await Promise.all([
      fetchMyTeam(u.id),
      fetchUpcomingEvents(supabase, 100),
      supabase.from('users').select('tag_settings').eq('id', u.id).single(),
    ])
    setTeam(tm)
    setEvents(evs)
    setWeeks(resolveEventWeeks(prof.data && prof.data.tag_settings))
    setLoading(false)
  }

  async function reload() { setEvents(await fetchUpcomingEvents(supabase, 100)) }

  const isLeader = !!team && team.creator_id === user?.id

  function openNew() {
    setErr('')
    setForm({ id: null, title: '', event_date: '', event_time: '', place: '', shared: false })
  }
  function openEdit(ev) {
    if (ev.owner_id !== user?.id) return
    setErr('')
    setForm({ id: ev.id, title: ev.title, event_date: ev.event_date, event_time: ev.event_time || '', place: ev.place || '', shared: !!ev.team_id })
  }

  async function save() {
    const title = form.title.trim()
    if (!title) { setErr('請填活動名稱'); return }
    if (!form.event_date) { setErr('請選活動日期'); return }
    setSaving(true); setErr('')
    const row = {
      title, event_date: form.event_date,
      event_time: form.event_time || null, place: form.place.trim() || null,
    }
    let error
    if (form.id) {
      ({ error } = await supabase.from('events').update(row).eq('id', form.id))
    } else {
      ({ error } = await supabase.from('events').insert({
        ...row, owner_id: user.id, team_id: form.shared && isLeader ? team.id : null,
      }))
    }
    setSaving(false)
    if (error) { setErr('沒有存成功，請再試一次'); return }
    setForm(null)
    reload()
  }

  async function remove() {
    const ok = await askConfirm({ title: `刪除「${form.title}」？`, message: '刪掉之後，已經邀請的約定不會被改動。', okText: '刪除', danger: true })
    if (!ok) return
    await supabase.from('events').delete().eq('id', form.id)
    setForm(null)
    reload()
  }

  if (loading) return <LoadingSpinner />

  const t = todayStr()
  const near = events.filter(e => daysUntil(e.event_date) <= weeks * 7)
  const far = events.filter(e => daysUntil(e.event_date) > weeks * 7)

  function Row({ ev, first }) {
    const p = parts(ev.event_date)
    const n = daysUntil(ev.event_date)
    const mine = ev.owner_id === user?.id
    return (
      <div onClick={() => mine && openEdit(ev)}
        style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px',
          borderTop: first ? 'none' : `1px solid ${BORDER}`, cursor: mine ? 'pointer' : 'default' }}>
        <Tile bg={PRIMARY_SOFT} color={PRIMARY} size={44}>
          <span style={{ fontSize: 15, lineHeight: 1.1, textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 600 }}>{p.m}月</span>{p.d}
          </span>
        </Tile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
            {ev.team_id && <Tag bg={ACCENT_GREEN_SOFT} color={ACCENT_GREEN_TEXT}>團隊</Tag>}
          </div>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
            週{p.w}{ev.event_time ? ` ${ev.event_time.slice(0, 5)}` : ''}{ev.place ? ` · ${ev.place}` : ''}
            {' · '}{n === 0 ? '今天' : n === 1 ? '明天' : `還有 ${n} 天`}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--page)', minHeight: '100vh', paddingBottom: 80, overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box' }}>
      <style>{`.dash-container { max-width: 430px; margin: 0 auto; } @media (min-width: 1024px) { .dash-container { max-width: 720px; } }`}</style>
      <div style={{ background: 'var(--hero)', padding: '52px 0 20px' }}>
        <div className="dash-container" style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/settings')} aria-label="返回"
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', padding: 6, borderRadius: RADIUS.sm, display: 'flex' }}>
              <IconArrowLeft size={20} stroke={1.9} />
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCalendarEvent size={19} stroke={1.9} /> 我的活動
            </h1>
          </div>
        </div>
      </div>

      <div className="dash-container" style={{ padding: '0 16px' }}>
        {form && (
          <>
            <SectionHeader title={form.id ? '修改活動' : '新增活動'} />
            <div style={{ ...cardStyle, padding: 14 }}>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 }}>活動名稱</div>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例如 週五實體說明會" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 }}>日期</div>
                  <DateField value={form.event_date} min={t} clearable={false}
                    onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 }}>時間 選填</div>
                  <input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '10px 0 4px' }}>地點 選填</div>
              <input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
                placeholder="例如 台北辦公室" style={inputStyle} />
              {isLeader && !form.id && (
                <>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '10px 0 6px' }}>誰看得到</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[[false, '只有我'], [true, '全團隊']].map(([v, label]) => (
                      <button key={label} onClick={() => setForm(f => ({ ...f, shared: v }))}
                        style={{ padding: '6px 16px', borderRadius: RADIUS.pill, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          background: form.shared === v ? PRIMARY : SUBCARD_BG, color: form.shared === v ? '#fff' : TEXT_SECONDARY }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {err && <div style={{ fontSize: 12, color: DANGER, marginTop: 10 }}>{err}</div>}
              <button onClick={save} disabled={saving}
                style={{ width: '100%', marginTop: 12, padding: 11, borderRadius: RADIUS.md, border: 'none', background: PRIMARY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? '儲存中…' : '儲存活動'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
                <button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: TEXT_SECONDARY, fontSize: 13, padding: 8, cursor: 'pointer' }}>取消</button>
                {form.id && <button onClick={remove} style={{ background: 'none', border: 'none', color: DANGER, fontSize: 13, padding: 8, cursor: 'pointer' }}>刪除這個活動</button>}
              </div>
            </div>
          </>
        )}

        {!form && (
          <>
            <SectionHeader title="近期" hint={`活動前 ${weeks} 週，首頁會提醒你邀人`} />
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              {near.length === 0
                ? <div style={{ padding: 16, fontSize: 13, color: TEXT_SECONDARY }}>最近沒有活動。有計畫的活動可以先加進來，到時候首頁會提醒你邀人。</div>
                : near.map((ev, i) => <Row key={ev.id} ev={ev} first={i === 0} />)}
            </div>

            {far.length > 0 && (
              <>
                <SectionHeader title="較遠" hint="還沒到提醒時間" />
                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                  {far.map((ev, i) => <Row key={ev.id} ev={ev} first={i === 0} />)}
                </div>
              </>
            )}

            <button onClick={openNew}
              style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: RADIUS.md, border: 'none', background: PRIMARY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              新增活動
            </button>
            <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '10px 4px 0', lineHeight: 1.6 }}>
              標「團隊」的是團隊領導人建立的，全隊都看得到；你自己加的只有你看得到。點自己加的活動可以修改或刪除。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
