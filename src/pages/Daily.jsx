import SocialModal from './socialModal'
import { DateField } from './pickers'
import { CloseBtn } from './ui'
import GoalModal from './goalModal'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { askConfirm } from './confirmDialog'
import { undoableDelete } from './undoDelete'
import { fetchAddedContacts } from './addedDate'
import { useNavigate } from 'react-router-dom'
import {
  IconTarget, IconSpeakerphone, IconMessageCircle, IconBook,
  IconHeadphones, IconCamera, IconUsers, IconX, IconCalendar,
  IconCheck, IconPlus, IconPencil, IconTrash,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'
import { loadDailyMode, saveTagSetting, resolveMode, resolveWeeklyMeet, resolveWeeklyMet } from './dailyMode'
import { AfterMeetSheet } from './meetingFlow'
import {
  ScheduleSheet, fetchMeetings, removeMeetingWithUndo, isMet, isPending, splitTime, taipeiToday, PersonPickSheet, fetchUnplannedMeets,
} from './meetings'
import { DAILY_TASKS, WEEKLY_TASKS, WEEKLY_COUNTERS, MONTH_ITEMS, COUNTER_COLORS } from './taskDefinitions'

// 設計系統色碼
const PRIMARY = 'var(--primary)'
const PRIMARY_SOFT = 'var(--primary-soft)'
const TEXT_MAIN = 'var(--text)'
const TEXT_MUTED = 'var(--muted)'
const TEXT_SECONDARY = 'var(--text2)'
const ACCENT_YELLOW = '#FFD166'
const ACCENT_YELLOW_TEXT = 'var(--yellow-text)'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_SOFT = 'var(--green-soft)'
const ACCENT_GREEN_TEXT = 'var(--green-text)'
const DANGER = '#E0454A'
const BORDER = 'var(--border)'
const SUBCARD_BG = 'var(--sub)'
const PINK = 'var(--pink-text)'
const ORANGE = '#F97316'
const DAYS_LONG = ['日','一','二','三','四','五','六']

const DAYS_ZH = ['日','一','二','三','四','五','六']
function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const diff = (dow + 1) % 7
  d.setDate(d.getDate() - diff)
  return toDateStr(d)
}
function getWeekDays(dateStr) {
  const start = new Date(getWeekStart(dateStr) + 'T00:00:00')
  const days = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(toDateStr(day))
  }
  return days
}
function getMonthStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function getMonthEnd(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0)
  return toDateStr(last)
}
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
}
function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth()+1}/${d.getDate()}`
}

export default function Daily() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [viewDate, setViewDate] = useState(today())
  const [weekViewDate, setWeekViewDate] = useState(today())
  const [monthViewDate, setMonthViewDate] = useState(today())
  const [checkins, setCheckins] = useState({})
  const [weekTaskCheckins, setWeekTaskCheckins] = useState({})
  const [weekStatus, setWeekStatus] = useState([])
  const [d312, setD312] = useState({ talk: 0, plan: 0, fresh: 0 })
  const [profile, setProfile] = useState(null)
  const [weekMeets, setWeekMeets] = useState([])
  const [monthMeets, setMonthMeets] = useState([])
  const [todayMeets, setTodayMeets] = useState([])
  const [weekPlanned, setWeekPlanned] = useState(0)
  const [allContacts, setAllContacts] = useState([])
  const [sched, setSched] = useState(null)
  const [afterMeet, setAfterMeet] = useState(null)
  const [hideSheet, setHideSheet] = useState(false)
  const [weekLogs, setWeekLogs] = useState([])
  const [pickFor, setPickFor] = useState(null) // 補記見面：要記哪一天（先選人）
  const [monthLogs, setMonthLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedWeekDay, setSelectedWeekDay] = useState(null)
  const [selectedMonthDay, setSelectedMonthDay] = useState(null)

  const [goalModal, setGoalModal] = useState(false)
  const [goalText, setGoalText] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const [socialModal, setSocialModal] = useState(false)
  const goalTextareaRef = useRef(null)

  const [logModal, setLogModal] = useState(null)
  const [logDate, setLogDate] = useState(today())
  const [logCounterKey, setLogCounterKey] = useState('')
  const [logContact, setLogContact] = useState('')
  const [logContactId, setLogContactId] = useState(null)
  const [logStrangerName, setLogStrangerName] = useState('')
  const [logProduct, setLogProduct] = useState('')
  const [logNote, setLogNote] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [contactSearch, setContactSearch] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])
  useEffect(() => { if (user) fetchAll() }, [user, viewDate])
  useEffect(() => { if (user) fetchWeekLogs() }, [user, weekViewDate])
  useEffect(() => { if (user) fetchMonthLogs() }, [user, monthViewDate])
  useEffect(() => {
    if (!user) return
    reloadMeets()
    supabase.from('contacts').select('id,name,interest_level,need_tags,last_quote')
      .eq('user_id', user.id).eq('is_archived', false).order('name').limit(500)
      .then(({ data }) => setAllContacts(data || []))
  }, [user])
  useEffect(() => {
    if (goalModal && goalTextareaRef.current) {
      const el = goalTextareaRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [goalModal])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([
      fetchCheckins(), fetchWeekStatus(), fetch312(),
      fetchGoalText(), fetchWeekLogs(), fetchMonthLogs()
    ])
    setLoading(false)
  }

  async function fetchCheckins() {
    const ws = getWeekStart(viewDate)
    const { data } = await supabase.from('daily_checkins')
      .select('task_key,is_done,date').eq('user_id', user.id).gte('date', ws)
    if (!data) return
    const daily = {}, weekly = {}
    data.forEach(d => {
      if (d.date === viewDate) daily[d.task_key] = d.is_done
      if (WEEKLY_TASKS.find(t => t.key === d.task_key)) {
        if (!weekly[d.task_key]) weekly[d.task_key] = {}
        weekly[d.task_key][d.date] = d.is_done
      }
    })
    setCheckins(daily); setWeekTaskCheckins(weekly)
  }

  async function fetchWeekStatus() {
    const days = getWeekDays(viewDate)
    const { data } = await supabase.from('daily_checkins')
      .select('date,is_done').eq('user_id', user.id).in('date', days)
    const sm = {}
    if (data) days.forEach(d => {
      const dc = data.filter(c => c.date === d)
      sm[d] = dc.length === 0 ? 'none' : dc.filter(c => c.is_done).length >= DAILY_TASKS.length ? 'full' : 'partial'
    })
    setWeekStatus(days.map(d => ({ date: d, status: sm[d] || 'none' })))
  }

  async function fetch312() {
    const t = viewDate
    const { data: logs } = await supabase.from('contact_logs')
      .select('contact_id,kind').eq('user_id', user.id).eq('date', t)
    const count = (await fetchAddedContacts(supabase, { userId: user.id, from: t, to: t })).length
    setD312({
      talk: new Set((logs || []).map(l => l.contact_id)).size,
      plan: (logs || []).filter(l => l.kind === 'meet_plan').length + (await fetchUnplannedMeets(user.id, t, t)).length,
      fresh: count || 0,
    })
  }

  async function fetchGoalText() {
    const { data } = await supabase.from('users').select('goal_declaration,tag_settings,created_at').eq('id', user.id).single()
    if (data?.goal_declaration) setGoalText(data.goal_declaration)
    if (data) setProfile(data)
  }

  async function fetchWeekLogs() {
    if (!user) return
    const days = getWeekDays(weekViewDate)
    const ws = days[0], we = days[6]
    const { data } = await supabase.from('counter_logs')
      .select('id,counter_key,date,planned_date,is_done,product_name,note,contact_id,contacts(name)')
      .eq('user_id', user.id)
      .not('counter_key', 'in', '("new_product","gmtss","meetup","stranger")')
    const filtered = (data || []).filter(l => {
      const d = l.planned_date || l.date
      return d >= ws && d <= we
    })
    setWeekLogs(filtered)
    setWeekMeets(await fetchMeetings(user.id, ws, we))
    const { data: pl } = await supabase.from('contact_logs')
      .select('contact_id').eq('user_id', user.id).eq('kind', 'meet_plan').gte('date', ws).lte('date', we)
    const unplanned = await fetchUnplannedMeets(user.id, ws, we) // 沒先約、直接見面的也算定下
    setWeekPlanned(new Set([...(pl || []), ...unplanned].map(l => l.contact_id)).size)
  }

  async function fetchMonthLogs() {
    if (!user) return
    const ms = getMonthStart(monthViewDate)
    const me = getMonthEnd(monthViewDate)
    const { data } = await supabase.from('counter_logs')
      .select('id,counter_key,date,planned_date,is_done,product_name,note,contact_id,contacts(name)')
      .eq('user_id', user.id)
      .in('counter_key', ['new_product', 'gmtss'])
    const filtered = (data || []).filter(l => {
      const d = l.planned_date || l.date
      return d >= ms && d <= me
    })
    setMonthLogs(filtered)
    setMonthMeets(await fetchMeetings(user.id, ms, me))
  }

  async function fetchTodayMeets() {
    if (!user) return
    const t = today()
    setTodayMeets(await fetchMeetings(user.id, t, t))
  }

  function reloadMeets() {
    fetchWeekLogs(); fetchMonthLogs(); fetchTodayMeets(); fetch312()
  }

  async function openMet(m) {
    if (!m.contact_id) return
    const { data } = await supabase.from('contacts').select('*').eq('id', m.contact_id).single()
    if (data) setAfterMeet({ contact: data, logId: m.id, date: m.planned_date })
  }

  async function deleteMeet(m) {
    await removeMeetingWithUndo(user.id, m, reloadMeets)
  }

  async function toggleHidden(key) {
    const cur = (profile?.tag_settings?.hidden_daily_tasks) || []
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
    setProfile(p => ({ ...p, tag_settings: { ...(p?.tag_settings || {}), hidden_daily_tasks: next } }))
    await saveTagSetting(user.id, { hidden_daily_tasks: next })
  }

  async function saveGoalText() {
    setGoalSaving(true)
    await supabase.from('users').update({ goal_declaration: goalText }).eq('id', user.id)
    setGoalSaving(false); setGoalSaved(true)
    setTimeout(() => setGoalSaved(false), 2000)
  }

  function changeDate(delta) {
    const d = new Date(viewDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    const nd = toDateStr(d)
    if (nd <= today()) setViewDate(nd)
  }

  async function toggleCheckin(key) {
    const cur = checkins[key], nv = !cur
    setCheckins(p => ({ ...p, [key]: nv }))
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: viewDate, task_key: key, is_done: nv,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
  }

  async function toggleWeekTask(key, date) {
    const cur = weekTaskCheckins[key]?.[date], nv = !cur
    setWeekTaskCheckins(p => ({ ...p, [key]: { ...(p[key]||{}), [date]: nv } }))
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date, task_key: key, is_done: nv,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
  }

  function handleTaskAction(task) {
    if (task.key === 'goal_declaration') { setGoalModal(true); return }
    if (task.social) { setSocialModal(true); return }
    if (task.toContacts) { navigate('/contacts'); return }
    if (task.internalPath) { navigate(task.internalPath); return }
    if (task.url) { window.open(task.url, '_blank'); return }
  }

  function openAddModal(mode, date, counterKey = '') {
    const defaultKey = counterKey || (mode === 'month' ? 'new_product' : 'bv_share')
    setLogModal({ mode, editId: null })
    setLogDate(date || today())
    setLogCounterKey(defaultKey)
    setLogContact(''); setLogContactId(null)
    setLogStrangerName(''); setLogProduct(''); setLogNote('')
    setContactSearch([])
  }

  function openEditModal(mode, log) {
    const counterKey = log.counter_key
    const counterMode = WEEKLY_COUNTERS.find(c => c.key === counterKey)?.mode || 'month_item'
    setLogModal({ mode, editId: log.id, counterMode })
    setLogDate(log.planned_date || log.date)
    setLogCounterKey(counterKey)
    setLogProduct(log.product_name || '')
    setLogNote(log.note || '')
    if (log.contacts?.name) {
      setLogContact(log.contacts.name)
      setLogContactId(log.contact_id)
    } else {
      setLogContact(''); setLogContactId(null)
    }
    if (counterMode === 'stranger') setLogStrangerName(log.product_name || '')
    setContactSearch([])
  }

  async function searchContacts(q) {
    if (!q) { setContactSearch([]); return }
    const { data } = await supabase.from('contacts').select('id,name')
      .eq('user_id', user.id).ilike('name', `%${q}%`).limit(8)
    setContactSearch(data || [])
  }

  function getCounterMode() {
    if (!logCounterKey) return logModal?.mode === 'month' ? 'month_item' : ''
    const c = WEEKLY_COUNTERS.find(x => x.key === logCounterKey)
    return c?.mode || 'month_item'
  }

  function canConfirm() {
    if (!logModal) return false
    const mode = getCounterMode()
    if (mode === 'month_item') return !!logProduct
    if (mode === 'stranger') return true
    return !!logContactId
  }

  async function confirmLog() {
    setLogSaving(true)
    const isFuture = logDate > today()
    const counterMode = getCounterMode()
    const payload = {
      user_id: user.id,
      counter_key: logCounterKey,
      date: isFuture ? today() : logDate,
      planned_date: isFuture ? logDate : null,
      is_done: !isFuture,
      contact_id: logContactId || null,
      product_name: counterMode === 'stranger' ? (logStrangerName || null) : (logProduct || null),
      note: logNote || null,
    }
    if (logModal.editId) {
      await supabase.from('counter_logs').update(payload).eq('id', logModal.editId)
    } else {
      await supabase.from('counter_logs').insert(payload)
    }
    setLogSaving(false); setLogModal(null)
    if (logModal.mode === 'month') fetchMonthLogs()
    else fetchWeekLogs()
  }

  async function confirmDone(log) {
    await supabase.from('counter_logs').update({ is_done: true, date: today() }).eq('id', log.id)
    fetchWeekLogs(); fetchMonthLogs()
  }

  async function deleteLog(log, mode) {
    if (!(await askConfirm({ title:'刪除這筆紀錄？', message:'刪除後 8 秒內可以按「復原」。', okText:'刪除', danger:true }))) return
    const refetch = () => { if (mode === 'month') fetchMonthLogs(); else fetchWeekLogs() }
    undoableDelete({
      label: log.note || log.product_name || '這筆紀錄',
      hide: () => (mode === 'month' ? setMonthLogs : setWeekLogs)(ls => ls.filter(l => l.id !== log.id)),
      undo: refetch,
      commit: async () => {
        const res = await supabase.from('counter_logs').delete().eq('id', log.id)
        refetch()
        return res
      },
    })
  }

  function changeWeekViewDate(delta) {
    const days = getWeekDays(weekViewDate)
    const d = new Date((delta < 0 ? days[0] : days[6]) + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setWeekViewDate(toDateStr(d))
    setSelectedWeekDay(null)
  }

  function changeMonthViewDate(delta) {
    const d = new Date(monthViewDate + 'T00:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonthViewDate(toDateStr(d))
    setSelectedMonthDay(null)
  }

  const mode = resolveMode(profile?.tag_settings, profile?.created_at)
  const hidden = profile?.tag_settings?.hidden_daily_tasks || []
  const visibleTasks = DAILY_TASKS.filter(t => !hidden.includes(t.key))
  const all312 = d312.talk >= mode.talk && d312.plan >= mode.meet && d312.fresh >= mode.fresh
  const isDone = t => (t.key === 'daily_3_contacts' ? (all312 || !!checkins[t.key]) : !!checkins[t.key])
  const doneCount = visibleTasks.filter(isDone).length
  const planTarget = resolveWeeklyMeet(profile?.tag_settings, mode)
  const metTarget = resolveWeeklyMet(profile?.tag_settings)
  const weekMet = weekMeets.filter(isMet).length
  const dotN = Math.min(Math.max(planTarget, metTarget), 15)
  const isToday = viewDate === today()
  const weekDays = getWeekDays(weekViewDate)

  const monthYear = new Date(monthViewDate + 'T00:00:00')
  const monthNum = monthYear.getMonth()
  const yearNum = monthYear.getFullYear()
  const daysInMonth = new Date(yearNum, monthNum+1, 0).getDate()
  const firstDow = new Date(yearNum, monthNum, 1).getDay()
  const calDays = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearNum}-${String(monthNum+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const logs = monthLogs.filter(l => (l.planned_date || l.date) === dateStr)
    const ms2 = monthMeets.filter(m => m.eff === dateStr)
    const hasMeet = ms2.length > 0
    const hasDone = logs.some(l => l.is_done) || ms2.some(isMet)
    const hasPlan = logs.some(l => !l.is_done) || ms2.some(m => !isMet(m) && !isPending(m))
    const hasPending = ms2.some(isPending)
    const hasProduct = logs.some(l => l.counter_key === 'new_product')
    const hasGmtss = logs.some(l => l.counter_key === 'gmtss')
    calDays.push({ d, dateStr, logs, hasDone, hasPlan, hasPending, hasProduct, hasGmtss, hasMeet })
  }

  function MeetRow({ m }) {
    const { time, label } = splitTime(m.note)
    const t = today()
    const isT = m.eff === t
    const past = m.eff < t
    const met = isMet(m)
    return (
      <div style={{ display:'flex',alignItems:'center',gap:10,borderRadius:10,padding:'8px 10px',marginBottom:6,
        background: isT ? PRIMARY_SOFT : 'var(--card)', border:`1px solid ${BORDER}` }}>
        <div style={{ width:46,flexShrink:0,textAlign:'center' }}>
          {time && <div style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>{time}</div>}
          <div style={{ fontSize:11,color:TEXT_MUTED }}>{formatShortDate(m.eff)}（{DAYS_LONG[new Date(m.eff+'T00:00:00').getDay()]}）</div>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
            <span style={{ fontSize:11,padding:'1px 6px',borderRadius:99,fontWeight:600,
              background:`color-mix(in srgb, ${PINK} 14%, transparent)`,color:PINK }}>見面</span>
            <span style={{ fontSize:13,color:TEXT_MAIN,fontWeight:600 }}>{m.contacts?.name || '（已刪除的名單）'}</span>
            {met && <IconCheck size={13} stroke={2.6} color={ACCENT_GREEN_TEXT} />}
          </div>
          {label && <div style={{ fontSize:12,color:TEXT_MUTED,marginTop:2 }}>{label}</div>}
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end',flexShrink:0 }}>
          {met ? (
            <button onClick={() => deleteMeet(m)} aria-label="刪除" style={{ ...miniLink(DANGER), display:'flex' }}><IconTrash size={17} stroke={1.8} /></button>
          ) : past ? (
            <>
              {m.contact_id && <button onClick={() => openMet(m)} style={softBtn(PRIMARY_SOFT, PRIMARY)}>見完了</button>}
              <button onClick={() => setSched({ log: m })} style={miniLink(TEXT_SECONDARY)}>沒見成？改時間</button>
              <button onClick={() => deleteMeet(m)} aria-label="刪除" style={{ ...miniLink(DANGER), display:'flex' }}><IconTrash size={17} stroke={1.8} /></button>
            </>
          ) : (
            <>
              {isT && m.contact_id && <button onClick={() => openMet(m)} style={softBtn(PRIMARY_SOFT, PRIMARY)}>見完了</button>}
              <button onClick={() => setSched({ log: m })} style={softBtn(SUBCARD_BG, TEXT_SECONDARY)}>改時間</button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ background:'var(--page)',minHeight:'100vh',paddingBottom:80 }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div className="dash-container" style={{ padding:'20px 16px 0' }}>
        <h1 style={{ fontSize:19,fontWeight:600,color:TEXT_MAIN,margin:0 }}>每日行動</h1>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12,
          background:SUBCARD_BG,borderRadius:12,padding:'6px 10px' }}>
          <button onClick={() => changeDate(-1)}
            style={{ background:'none',border:'none',color:TEXT_SECONDARY,
              width:28,height:28,fontSize:18,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:13,color:PRIMARY,margin:0,fontWeight:600 }}>{formatDateLabel(viewDate)}</p>
            {!isToday && <span style={{ fontSize:11,color:ACCENT_YELLOW_TEXT,fontWeight:600 }}>補打模式</span>}
          </div>
          <button onClick={() => changeDate(1)}
            style={{ background:'none',
              border:'none',color: isToday?'var(--border2)':TEXT_SECONDARY,
              width:28,height:28,fontSize:18,
              cursor: isToday?'default':'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
        </div>
        {!isToday && (
          <div style={{ textAlign:'center',marginTop:8 }}>
            <button onClick={() => setViewDate(today())}
              style={{ background:PRIMARY_SOFT,border:'none',color:PRIMARY,
                padding:'4px 14px',borderRadius:20,fontSize:12,cursor:'pointer',fontWeight:600 }}>
              回到今天
            </button>
          </div>
        )}
      </div>

      <div className="dash-container" style={{ padding:'14px 16px',display:'flex',flexDirection:'column',gap:12 }}>

        {isToday && todayMeets.length > 0 && (
          <div style={{ background:PRIMARY_SOFT,borderRadius:18,padding:'14px 16px',border:`1px solid ${BORDER}` }}>
            <div style={{ fontSize:13,fontWeight:700,color:PRIMARY,marginBottom:8 }}>今天的約會</div>
            {todayMeets.map(m => {
              const { time, label } = splitTime(m.note)
              const needs = (m.contacts?.need_tags || []).slice(0, 3)
              return (
                <div key={m.id} style={{ background:'var(--card)',borderRadius:12,padding:'10px 12px',marginBottom:8 }}>
                  <div style={{ display:'flex',alignItems:'baseline',gap:8 }}>
                    {time && <span style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN }}>{time}</span>}
                    <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>{m.contacts?.name || '（已刪除的名單）'}</span>
                    {label && <span style={{ fontSize:12,color:TEXT_SECONDARY }}>{label}</span>}
                  </div>
                  {needs.length > 0 && (
                    <div style={{ fontSize:12,color:TEXT_SECONDARY,marginTop:4 }}>對方在意：{needs.join('、')}</div>
                  )}
                  {m.contacts?.last_quote && (
                    <div style={{ fontSize:12,color:TEXT_MUTED,marginTop:2 }}>上次說：「{m.contacts.last_quote}」</div>
                  )}
                  <div style={{ display:'flex',gap:8,marginTop:10 }}>
                    {m.contact_id && (
                      <button onClick={() => openMet(m)} style={softBtn(PRIMARY_SOFT, PRIMARY)}>見完了，記一下</button>
                    )}
                    <button onClick={() => setSched({ log: m })} style={softBtn(SUBCARD_BG, TEXT_SECONDARY)}>改時間</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={sectionTitle}>每日行動</span>
            <span style={{ fontSize:13,color:TEXT_SECONDARY,fontWeight:600 }}>{doneCount}/{visibleTasks.length}</span>
          </div>

          <div style={{ display:'flex',justifyContent:'space-between',padding:'8px',
            background:SUBCARD_BG,borderRadius:12,marginBottom:10 }}>
            {weekStatus.map((w,i) => {
              const isSelected = w.date === viewDate
              const isT = w.date === today()
              const dc = w.status==='full'?ACCENT_GREEN:w.status==='partial'?ACCENT_YELLOW:'var(--border)'
              return (
                <div key={i} onClick={() => { if (w.date <= today()) setViewDate(w.date) }}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                    cursor: w.date <= today()?'pointer':'default' }}>
                  <span style={{ fontSize:11,color: isSelected?PRIMARY:isT?PRIMARY:TEXT_MUTED,
                    fontWeight: isSelected||isT?700:600 }}>
                    {DAYS_ZH[new Date(w.date+'T00:00:00').getDay()]}
                  </span>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:dc,
                    outline: isSelected?`2px solid ${PRIMARY}`:'none', // 藍圈只畫在正在看的那天；今天只把星期字變藍
                    outlineOffset:2 }} />
                </div>
              )
            })}
          </div>

          {visibleTasks.map(task => {
            const done = isDone(task)
            const is312 = task.key === 'daily_3_contacts'
            const hasAction = task.url || task.internalPath || task.social || task.toContacts || task.key === 'goal_declaration'
            const TaskIcon = task.Icon
            return (
              <div key={task.key} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',
                borderBottom:`1px solid ${BORDER}` }}>
                <button onClick={() => toggleCheckin(task.key)}
                  style={{ width:20,height:20,borderRadius:7,flexShrink:0,
                    border:done?'none':'2px solid var(--border2)',background:done?ACCENT_GREEN:'var(--card)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    transition:'all 0.15s',cursor:'pointer' }}>
                  {done&&<IconCheck size={12} stroke={2.5} color="#fff" />}
                </button>
                <TaskIcon size={16} stroke={1.9} color={done?'var(--border2)':PRIMARY} />
                <button onClick={() => hasAction && handleTaskAction(task)}
                  style={{ flex:1,background:'none',border:'none',textAlign:'left',
                    cursor: hasAction?'pointer':'default',padding:0,
                    display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:13,fontWeight:600,color:done?TEXT_MUTED:TEXT_MAIN,
                    textDecoration:done&&!is312?'line-through':'none' }}>
                    {is312 ? `${isToday ? '今天' : '這天'}的 ${mode.label}` : task.label}
                    {is312 && (
                      <span style={{ display:'block',fontSize:12,fontWeight:600,marginTop:2,textDecoration:'none',
                        color: all312 ? ACCENT_GREEN_TEXT : TEXT_SECONDARY }}>
                        互動 {Math.min(d312.talk, mode.talk)}/{mode.talk}　邀約 {Math.min(d312.plan, mode.meet)}/{mode.meet}　新名單 {Math.min(d312.fresh, mode.fresh)}/{mode.fresh}
                      </span>
                    )}
                  </span>
                  {hasAction && <span style={{ fontSize:12,color:TEXT_MUTED,marginLeft:8,flexShrink:0 }}>›</span>}
                </button>
              </div>
            )
          })}
          <button onClick={() => setHideSheet(true)}
            style={{ background:'none',border:'none',color:TEXT_MUTED,fontSize:12,cursor:'pointer',
              padding:'10px 0 0',width:'100%',textAlign:'center' }}>
            調整要顯示的項目 ›
          </button>
        </div>

        <div style={card}>
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={sectionTitle}>每週行動</span>
              <button onClick={() => navigate('/report')}
                style={{ background:'none',border:'none',color:PRIMARY,fontSize:12,fontWeight:600,cursor:'pointer',padding:'4px 0' }}>
                給帶領者的報告 ›
              </button>
            </div>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginTop:8 }}>
              <button onClick={() => changeWeekViewDate(-1)} style={navBtn}>‹</button>
              <span style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN }}>
                {formatShortDate(weekDays[0])} 週六 — {formatShortDate(weekDays[6])} 週五
              </span>
              <button onClick={() => changeWeekViewDate(1)} style={navBtn}>›</button>
            </div>
          </div>

          <div style={{ marginBottom:12,background:SUBCARD_BG,borderRadius:12,padding:'8px 10px' }}>
            {WEEKLY_TASKS.map(task => {
              const anyDone = weekDays.some(d => weekTaskCheckins[task.key]?.[d])
              return (
                <div key={task.key} style={{ display:'flex',alignItems:'center',gap:10,padding:'6px 0' }}>
                  <button onClick={() => {
                    const targetDate = weekDays.find(d => d <= today()) || today()
                    toggleWeekTask(task.key, targetDate)
                  }}
                    style={{ width:20,height:20,borderRadius:6,flexShrink:0,
                      border:anyDone?'none':'2px solid var(--border2)',background:anyDone?ACCENT_GREEN:'var(--card)',
                      display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                    {anyDone&&<IconCheck size={11} stroke={2.5} color="#fff" />}
                  </button>
                  <span style={{ fontSize:13,fontWeight:600,color:anyDone?TEXT_MUTED:TEXT_MAIN,
                    textDecoration:anyDone?'line-through':'none' }}>{task.label}</span>
                </div>
              )
            })}
          </div>

          <div style={{ marginBottom:12, background: weekMet >= metTarget ? ACCENT_GREEN_SOFT : SUBCARD_BG,
            borderRadius:12, padding:'10px 12px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN }}>每週見面</span>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={() => setPickFor(selectedWeekDay && selectedWeekDay <= today() ? selectedWeekDay : today())}
                  style={{ display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:10,border:`1px solid ${PRIMARY}`,
                    background:'var(--card)',color:PRIMARY,fontSize:12,fontWeight:600,cursor:'pointer' }}>
                  <IconPlus size={12} stroke={2.2} /> 補記見面
                </button>
                <button onClick={() => setSched({ log: null, date: selectedWeekDay && selectedWeekDay >= today() ? selectedWeekDay : '' })}
                  style={{ display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:10,border:'none',
                    background:PRIMARY,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer' }}>
                  <IconPlus size={12} stroke={2.2} /> 定時間
                </button>
              </div>
            </div>
            <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:6 }}>
              {Array.from({ length: dotN }).map((_, i) => (
                <div key={i} style={{ width:16,height:16,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                  background: i < weekMet ? ACCENT_GREEN : i < weekPlanned ? ORANGE : BORDER }}>
                  {i < weekMet && <IconCheck size={10} stroke={3} color="#fff" />}
                </div>
              ))}
            </div>
            <div style={{ fontSize:12,color:TEXT_SECONDARY }}>
              定下 {weekPlanned}/{planTarget}　見到 {weekMet}/{metTarget}
              <span style={{ color:TEXT_MUTED }}>（目標可在設定調整）</span>
            </div>
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4 }}>
            {weekDays.map(d => {
              const isT = d === today()
              const isFut = d > today()
              const dayLogs = weekLogs.filter(l => (l.planned_date || l.date) === d)
              const dayMeets = weekMeets.filter(m => m.eff === d)
              const hasDone = dayLogs.some(l => l.is_done) || dayMeets.some(isMet)
              const hasPlan = dayLogs.some(l => !l.is_done) || dayMeets.some(m => !isMet(m) && !isPending(m))
              const hasPending = dayMeets.some(isPending)
              const isSelected = selectedWeekDay === d
              let bg = 'var(--card)', border = BORDER, dashed = false
              if (hasPending) { border = 'var(--yellow-border)'; dashed = true }
              else if (hasDone) { bg = ACCENT_GREEN_SOFT; border = 'var(--green-border)' }
              else if (hasPlan) { bg = 'var(--yellow-soft)'; border = 'var(--yellow-border)' }
              if (isSelected) border = PRIMARY
              const dots = []
              if (dayMeets.length) dots.push(PINK)
              dayLogs.forEach(l => { const c = COUNTER_COLORS[l.counter_key] || TEXT_MUTED; if (!dots.includes(c)) dots.push(c) })
              return (
                <div key={d} onClick={() => setSelectedWeekDay(isSelected ? null : d)}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer' }}>
                  <span style={{ fontSize:11,color: isT?PRIMARY:isFut?'var(--border2)':TEXT_MUTED,
                    fontWeight: isT?700:600,textAlign:'center' }}>
                    {DAYS_ZH[new Date(d+'T00:00:00').getDay()]}<br/>{formatShortDate(d)}
                  </span>
                  <div style={{ width:'100%',height:44,borderRadius:10,boxSizing:'border-box',
                    background:bg, border:`1.5px ${dashed ? 'dashed' : 'solid'} ${border}`,
                    display:'flex',alignItems:'center',justifyContent:'center',gap:3,
                    outline: isSelected?`2px solid ${PRIMARY}`:'none',outlineOffset:1 }}>
                    {hasPending && <span style={{ fontSize:13,fontWeight:700,color:ACCENT_YELLOW_TEXT }}>？</span>}
                    {!hasPending && hasDone && dayMeets.some(isMet) && <IconCheck size={13} stroke={2.6} color={ACCENT_GREEN_TEXT} />}
                    {dots.slice(0,3).map((c, i) => (
                      <div key={i} style={{ width:6,height:6,borderRadius:'50%',background:c }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop:14,borderTop:`1px solid ${BORDER}`,paddingTop:12 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>
                {selectedWeekDay ? formatDateLabel(selectedWeekDay) : '本週安排'}
              </span>
              <button onClick={() => openAddModal('week', selectedWeekDay || today(), 'bv_share')}
                style={{ background:'none',border:'none',color:PRIMARY,fontSize:12,fontWeight:600,cursor:'pointer' }}>
                + 記錄其他行動
              </button>
            </div>
            {(() => {
              const meetsShown = weekMeets.filter(m => !selectedWeekDay || m.eff === selectedWeekDay)
              const othersShown = weekLogs.filter(l => !selectedWeekDay || (l.planned_date || l.date) === selectedWeekDay)
              if (meetsShown.length === 0 && othersShown.length === 0) {
                return (
                  <p style={{ fontSize:12,color:TEXT_MUTED,textAlign:'center',padding:'8px 0' }}>
                    {selectedWeekDay ? '這天沒有安排。見過人了按「+ 補記見面」，要約人按「+ 定時間」' : '這週還沒有安排，點上面的「+ 定時間」'}
                  </p>
                )
              }
              return (
                <>
                  {meetsShown.map(m => <MeetRow key={m.id} m={m} />)}
                  {othersShown.map(log => {
                    const c = WEEKLY_COUNTERS.find(x => x.key === log.counter_key)
                    const color = COUNTER_COLORS[log.counter_key] || TEXT_MUTED
                    return (
                      <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                        background: log.is_done?ACCENT_GREEN_SOFT:'var(--yellow-soft)',
                        borderRadius:10,padding:'8px 10px',marginBottom:6 }}>
                        {log.is_done
                          ? <IconCheck size={14} stroke={2.2} color={ACCENT_GREEN_TEXT} />
                          : <IconCalendar size={14} stroke={1.9} color={ACCENT_YELLOW_TEXT} />}
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                            <span style={{ fontSize:11,padding:'1px 6px',borderRadius:99,
                              background:`color-mix(in srgb, ${color} 14%, transparent)`,color,fontWeight:600 }}>{c?.label}</span>
                            <span style={{ fontSize:13,color:TEXT_MAIN,fontWeight:600 }}>{log.contacts?.name || '—'}</span>
                            <span style={{ fontSize:11,color:TEXT_MUTED }}>{formatShortDate(log.planned_date || log.date)}</span>
                          </div>
                          {c?.mode === 'product' && log.product_name && (
                            <span style={{ fontSize:12,color:TEXT_SECONDARY }}>{log.product_name}</span>
                          )}
                          {log.note && <p style={{ fontSize:12,color:TEXT_MUTED,margin:'2px 0 0' }}>{log.note}</p>}
                        </div>
                        <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end' }}>
                          {!log.is_done && (
                            <button onClick={() => confirmDone(log)}
                              style={{ fontSize:11,color:ACCENT_GREEN_TEXT,background:'none',border:'none',
                                cursor:'pointer',fontWeight:600 }}>完成</button>
                          )}
                          <div style={{ display:'flex', gap:16, alignItems:'center', padding:'6px 2px' }}>
                            <button onClick={() => openEditModal('week', log)} aria-label="編輯"
                              style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED,display:'flex',padding:0 }}><IconPencil size={17} stroke={1.8} /></button>
                            <button onClick={() => deleteLog(log, 'week')} aria-label="刪除"
                              style={{ background:'none',border:'none',cursor:'pointer',color:DANGER,display:'flex',padding:0 }}><IconTrash size={17} stroke={1.8} /></button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        </div>

        <div style={card}>
          <div style={{ marginBottom:12 }}>
            <span style={sectionTitle}>每月目標</span>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginTop:8 }}>
              <button onClick={() => changeMonthViewDate(-1)} style={navBtn}>‹</button>
              <span style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN }}>
                {monthYear.toLocaleDateString('zh-TW',{year:'numeric',month:'long'})}
              </span>
              <button onClick={() => changeMonthViewDate(1)} style={navBtn}>›</button>
            </div>
          </div>

          <div style={{ display:'flex',gap:10,marginBottom:6,padding:'6px 10px',
            background:SUBCARD_BG,borderRadius:10,flexWrap:'wrap' }}>
            {[
              { color:PRIMARY, label:'新產品' },
              { color:ACCENT_GREEN_TEXT, label:'GMTSS' },
              { color:PINK, label:'見面' },
            ].map(l => (
              <div key={l.label} style={{ display:'flex',alignItems:'center',gap:4 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:l.color }} />
                <span style={{ fontSize:11,color:TEXT_SECONDARY }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11,color:TEXT_MUTED,marginBottom:10 }}>黃底是約好了，黃虛線是過了還沒記，綠底是見完了</div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,marginBottom:3 }}>
            {DAYS_ZH.map(d => (
              <div key={d} style={{ textAlign:'center',fontSize:11,color:TEXT_MUTED,padding:'2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,marginBottom:8 }}>
            {Array.from({ length: firstDow }).map((_,i) => <div key={`e${i}`} />)}
            {calDays.map(day => {
              const isFut = day.dateStr > today()
              const isT = day.dateStr === today()
              const isSelected = selectedMonthDay === day.dateStr
              let bg = SUBCARD_BG, border = BORDER, dashed = false
              if (day.hasPending) { bg = 'var(--card)'; border = 'var(--yellow-border)'; dashed = true }
              else if (day.hasDone) { bg = ACCENT_GREEN_SOFT; border = 'var(--green-border)' }
              else if (day.hasPlan) { bg = 'var(--yellow-soft)'; border = 'var(--yellow-border)' }
              if (isSelected) border = PRIMARY
              return (
                <div key={day.dateStr}
                  onClick={() => setSelectedMonthDay(isSelected ? null : day.dateStr)}
                  style={{ aspectRatio:'1',minWidth:0,width:'100%',borderRadius:9,background:bg,
                    border:`1.5px ${dashed ? 'dashed' : 'solid'} ${isT&&!isSelected?PRIMARY:border}`,
                    boxSizing:'border-box',
                    display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',cursor:'pointer',gap:2,
                    outline: isSelected?`2px solid ${PRIMARY}`:'none',outlineOffset:-2 }}>
                  <span style={{ fontSize:12,fontWeight: isT?700:600,
                    color: day.hasPending?ACCENT_YELLOW_TEXT:day.hasDone?ACCENT_GREEN_TEXT:day.hasPlan?ACCENT_YELLOW_TEXT:isFut?TEXT_MUTED:TEXT_MAIN }}>
                    {day.d}
                  </span>
                  {day.hasPending && <span style={{ fontSize:10,fontWeight:700,color:ACCENT_YELLOW_TEXT,lineHeight:1 }}>？</span>}
                  {(day.hasProduct || day.hasGmtss || day.hasMeet) && (
                    <div style={{ display:'flex',gap:2 }}>
                      {day.hasMeet && <div style={{ width:5,height:5,borderRadius:'50%',background:PINK }} />}
                      {day.hasProduct && <div style={{ width:5,height:5,borderRadius:'50%',background:PRIMARY }} />}
                      {day.hasGmtss && <div style={{ width:5,height:5,borderRadius:'50%',background:ACCENT_GREEN_TEXT }} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ borderTop:`1px solid ${BORDER}`,paddingTop:12 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>
                {selectedMonthDay ? formatDateLabel(selectedMonthDay) : '這個月的安排'}
              </span>
              <div style={{ display:'flex',gap:6 }}>
                {(() => {
                  const d = selectedMonthDay || today()
                  const fut = d > today()
                  return (
                    <button onClick={() => (fut ? setSched({ log: null, date: d }) : setPickFor(d))}
                      style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:10,border:`1px solid ${PRIMARY}`,
                        background:'var(--card)',color:PRIMARY,fontSize:12,fontWeight:600,cursor:'pointer' }}>
                      <IconPlus size={13} stroke={2.2} /> {fut ? '定時間' : '記見面'}
                    </button>
                  )
                })()}
                <button onClick={() => openAddModal('month', selectedMonthDay || today())}
                  style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:10,border:'none',
                    background:PRIMARY,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer' }}>
                  <IconPlus size={13} stroke={2.2} /> 新增學習
                </button>
              </div>
            </div>
            {(() => {
              const dayOf = l => l.planned_date || l.date
              const meetsShown = monthMeets.filter(m => !selectedMonthDay || m.eff === selectedMonthDay)
              const logsShown = monthLogs.filter(l => !selectedMonthDay || dayOf(l) === selectedMonthDay)
              if (meetsShown.length === 0 && logsShown.length === 0) {
                return (
                  <p style={{ fontSize:12,color:TEXT_MUTED,textAlign:'center',padding:'8px 0' }}>
                    {selectedMonthDay ? '這天沒有安排' : '這個月還沒有安排'}
                  </p>
                )
              }
              const items = [
                ...meetsShown.map(m => ({ kind: 'meet', date: m.eff, m })),
                ...logsShown.map(l => ({ kind: 'log', date: dayOf(l), l })),
              ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
              return items.map(it => {
                if (it.kind === 'meet') return <MeetRow key={it.m.id} m={it.m} />
                const log = it.l
                const item = MONTH_ITEMS.find(x => x.key === log.counter_key)
                const color = log.counter_key === 'new_product' ? PRIMARY : ACCENT_GREEN_TEXT
                return (
                  <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                    background: log.is_done?ACCENT_GREEN_SOFT:'var(--yellow-soft)',
                    borderRadius:10,padding:'8px 10px',marginBottom:6 }}>
                    {log.is_done
                      ? <IconCheck size={14} stroke={2.2} color={ACCENT_GREEN_TEXT} />
                      : <IconCalendar size={14} stroke={1.9} color={ACCENT_YELLOW_TEXT} />}
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap' }}>
                        <span style={{ fontSize:11,color:TEXT_MUTED }}>{formatShortDate(it.date)}</span>
                        <span style={{ fontSize:11,padding:'1px 6px',borderRadius:99,
                          background:`color-mix(in srgb, ${color} 14%, transparent)`,color,fontWeight:600 }}>{item?.label}</span>
                        <span style={{ fontSize:13,color:TEXT_MAIN,fontWeight:600 }}>{log.product_name || '—'}</span>
                      </div>
                      {log.note && <p style={{ fontSize:12,color:TEXT_MUTED,margin:0 }}>{log.note}</p>}
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end' }}>
                      {!log.is_done && (
                        <button onClick={() => confirmDone(log)}
                          style={{ fontSize:11,color:ACCENT_GREEN_TEXT,background:'none',border:'none',
                            cursor:'pointer',fontWeight:600 }}>完成</button>
                      )}
                      <div style={{ display:'flex', gap:16, alignItems:'center', padding:'6px 2px' }}>
                        <button onClick={() => openEditModal('month', log)} aria-label="編輯"
                          style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED,display:'flex',padding:0 }}><IconPencil size={17} stroke={1.8} /></button>
                        <button onClick={() => deleteLog(log, 'month')} aria-label="刪除"
                          style={{ background:'none',border:'none',cursor:'pointer',color:DANGER,display:'flex',padding:0 }}><IconTrash size={17} stroke={1.8} /></button>
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>

      </div>

      {sched && (
        <ScheduleSheet userId={user.id} contact={sched.log ? sched.log.contacts : null} contacts={allContacts}
          log={sched.log} initialDate={sched.date} onClose={() => setSched(null)} onSaved={reloadMeets} />
      )}
      {afterMeet && (
        <AfterMeetSheet contact={afterMeet.contact} userId={user.id} logId={afterMeet.logId} initialDate={afterMeet.date}
          onClose={() => setAfterMeet(null)} onSaved={reloadMeets} />
      )}
      {pickFor && (
        <PersonPickSheet userId={user.id} title={`${formatShortDate(pickFor)} 跟誰見面？`}
          onClose={() => setPickFor(null)}
          onPick={c => { const d = pickFor; setPickFor(null); setAfterMeet({ contact: c, logId: null, date: d }) }} />
      )}
      {hideSheet && (
        <div onClick={() => setHideSheet(false)}
          style={{ position:'fixed',inset:0,background:'var(--overlay)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--card)',borderRadius:'22px 22px 0 0',padding:24,width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
              <h3 style={{ fontSize:16,fontWeight:600,color:TEXT_MAIN,margin:0 }}>要顯示哪些每日行動</h3>
              <CloseBtn onClick={() => setHideSheet(false)} />
            </div>
            <p style={{ fontSize:12,color:TEXT_MUTED,margin:'0 0 12px' }}>不需要的可以關掉，只影響你自己</p>
            {DAILY_TASKS.map(t => {
              const on = !hidden.includes(t.key)
              return (
                <button key={t.key} onClick={() => toggleHidden(t.key)}
                  style={{ display:'flex',alignItems:'center',gap:10,width:'100%',padding:'12px 4px',background:'none',border:'none',
                    borderBottom:`1px solid ${BORDER}`,cursor:'pointer',textAlign:'left' }}>
                  <span style={{ width:20,height:20,borderRadius:6,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                    background:on?ACCENT_GREEN:'var(--card)',border:on?'none':'2px solid var(--border2)' }}>
                    {on && <IconCheck size={12} stroke={2.5} color="#fff" />}
                  </span>
                  <span style={{ fontSize:14,color:TEXT_MAIN,fontWeight:600 }}>{t.key === 'daily_3_contacts' ? `${mode.label}（互動／邀約／新名單）` : t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {goalModal && (
        <GoalModal text={goalText} setText={setGoalText} saving={goalSaving} saved={goalSaved}
          onSave={saveGoalText} onClose={() => setGoalModal(false)}
          onRead={() => {
            const t = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
            if (viewDate === t && !checkins.goal_declaration) toggleCheckin('goal_declaration')
            setGoalModal(false)
          }} />
      )}

      {socialModal && <SocialModal onClose={() => setSocialModal(false)} />}

      {logModal && (
        <div style={{ position:'fixed',inset:0,background:'var(--overlay)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setLogModal(null) }}>
          <div style={{ background:'var(--card)',borderRadius:'22px 22px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:600,color:TEXT_MAIN,margin:0 }}>
                {logModal.editId ? '編輯記錄' : '新增記錄'}
              </h3>
              <CloseBtn onClick={() => setLogModal(null)} />
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={labelStyle}>日期</label>
              <DateField value={logDate} onChange={e => setLogDate(e.target.value)} style={inputStyle} />
              {logDate > today() && (
                <p style={{ fontSize:12,color:ACCENT_YELLOW_TEXT,margin:'6px 0 0',fontWeight:600 }}>
                  預排模式：儲存後顯示為「待完成」
                </p>
              )}
            </div>

            {logModal.mode === 'week' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>行動類型</label>
                <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                  {WEEKLY_COUNTERS.filter(c => c.key !== 'meetup' && c.key !== 'stranger').map(c => (
                    <button key={c.key} onClick={() => setLogCounterKey(c.key)}
                      style={{ padding:'6px 12px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',
                        border:`1.5px solid ${logCounterKey===c.key?COUNTER_COLORS[c.key]:BORDER}`,
                        background: logCounterKey===c.key?`${COUNTER_COLORS[c.key]}18`:SUBCARD_BG,
                        color: logCounterKey===c.key?COUNTER_COLORS[c.key]:TEXT_SECONDARY }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {logModal.mode === 'month' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>類型</label>
                <div style={{ display:'flex',gap:8 }}>
                  {MONTH_ITEMS.map(item => (
                    <button key={item.key} onClick={() => setLogCounterKey(item.key)}
                      style={{ flex:1,padding:'8px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',
                        border:`1.5px solid ${logCounterKey===item.key?PRIMARY:BORDER}`,
                        background: logCounterKey===item.key?PRIMARY_SOFT:SUBCARD_BG,
                        color: logCounterKey===item.key?PRIMARY:TEXT_SECONDARY }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(getCounterMode() === 'product' || getCounterMode() === 'contact') && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>
                  {getCounterMode() === 'product' ? '分享對象' : '對象'}
                  <span style={{ color:DANGER }}> 必填</span>
                </label>
                <input placeholder="搜尋互動名單..." value={logContact}
                  onChange={e => { setLogContact(e.target.value); setLogContactId(null); searchContacts(e.target.value) }}
                  style={inputStyle} />
                {contactSearch.length > 0 && (
                  <div style={{ border:`1px solid ${BORDER}`,borderRadius:10,marginTop:4,overflow:'hidden' }}>
                    {contactSearch.map(c => (
                      <button key={c.id} onClick={() => { setLogContact(c.name); setLogContactId(c.id); setContactSearch([]) }}
                        style={{ display:'block',width:'100%',textAlign:'left',padding:'10px 12px',
                          background: logContactId===c.id?PRIMARY_SOFT:'var(--card)',border:'none',
                          borderBottom:`1px solid ${BORDER}`,fontSize:14,cursor:'pointer',color:TEXT_MAIN }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {logContactId && <p style={{ fontSize:12,color:ACCENT_GREEN_TEXT,margin:'4px 0 0' }}>✓ 已選擇：{logContact}</p>}
              </div>
            )}

            {getCounterMode() === 'product' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>分享產品 <span style={{ color:TEXT_MUTED,fontSize:12 }}>選填</span></label>
                <input placeholder="輸入產品名稱..." value={logProduct}
                  onChange={e => setLogProduct(e.target.value)} style={inputStyle} />
              </div>
            )}

            {getCounterMode() === 'month_item' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>
                  {MONTH_ITEMS.find(i=>i.key===logCounterKey)?.placeholder || '名稱'}
                  <span style={{ color:DANGER }}> 必填</span>
                </label>
                <input placeholder="請輸入名稱..." value={logProduct}
                  onChange={e => setLogProduct(e.target.value)} style={inputStyle} />
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <label style={labelStyle}>備註 <span style={{ color:TEXT_MUTED,fontSize:12 }}>選填</span></label>
              <textarea placeholder="記錄重點..." value={logNote}
                onChange={e => setLogNote(e.target.value)}
                style={{ ...inputStyle,height:72,resize:'none' }} />
            </div>

            <button onClick={confirmLog} disabled={logSaving || !canConfirm()}
              style={{ width:'100%',padding:'14px',borderRadius:14,border:'none',
                background: canConfirm()?PRIMARY:'var(--border2)',
                color:'#fff',fontSize:15,fontWeight:600,
                cursor: canConfirm()?'pointer':'not-allowed' }}>
              {logSaving ? '儲存中…' : logModal.editId ? '儲存修改' : logDate > today() ? '預排' : '確認儲存'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const card = { background:'var(--card)',borderRadius:18,padding:'16px',border:`1px solid ${BORDER}` }
const sectionTitle = { fontSize:14,fontWeight:600,color:TEXT_MAIN }
const navBtn = { background:'none',border:`1px solid ${BORDER}`,borderRadius:10,
  width:36,height:36,cursor:'pointer',fontSize:16,color:TEXT_SECONDARY,
  display:'flex',alignItems:'center',justifyContent:'center' }
const labelStyle = { fontSize:13,color:TEXT_MAIN,fontWeight:600,display:'block',marginBottom:6 }
const inputStyle = { width:'100%',padding:'10px 12px',borderRadius:12,
  border:`1px solid ${BORDER}`,fontSize:15,boxSizing:'border-box',outline:'none' }

const softBtn = (bg, color) => ({ background:bg,color,border:'none',borderRadius:10,padding:'7px 12px',
  fontSize:12,fontWeight:600,cursor:'pointer' })
const miniLink = color => ({ background:'none',border:'none',color,fontSize:12,cursor:'pointer',padding:'4px 2px' })
