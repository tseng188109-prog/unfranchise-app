import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconTarget, IconSpeakerphone, IconMessageCircle, IconBook,
  IconHeadphones, IconCamera, IconUsers, IconX, IconCalendar,
  IconCheck, IconPlus, IconPencil, IconTrash,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'

// 設計系統色碼
const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_YELLOW = '#FFD166'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const DANGER = '#E0454A'
const BORDER = '#F0F1F4'
const SUBCARD_BG = '#F5F8FC'

const DAYS_ZH = ['日','一','二','三','四','五','六']
function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

const DAILY_TASKS = [
  { key: 'goal_declaration', label: '目標宣言', Icon: IconTarget },
  { key: 'backend_announcement', label: '後台公告/管理報告', Icon: IconSpeakerphone, url: 'https://tw.unfranchise.com' },
  { key: 'respond_social', label: '回應臉書IDEA/LINE', Icon: IconMessageCircle, social: true },
  { key: 'daily_practice', label: '每日練習', Icon: IconBook, internalPath: '/daily-practice' },
  { key: 'listen_recording', label: '聽錄音', Icon: IconHeadphones, internalPath: '/recording' },
  { key: 'ig_story', label: 'IG 限動', Icon: IconCamera, url: 'https://www.instagram.com' },
  { key: 'daily_3_contacts', label: '每日3互動', Icon: IconUsers, special: true, toContacts: true },
]

const WEEKLY_COUNTERS = [
  { key: 'bv_share',      label: 'BV 分享',     mode: 'product' },
  { key: 'ibv_share',     label: 'IBV 分享',    mode: 'product' },
  { key: 'meetup',        label: '見面',         mode: 'contact' },
  { key: 'show_business', label: '展示生意',     mode: 'contact' },
  { key: 'sell_ticket',   label: '賣票',         mode: 'contact' },
  { key: 'stranger',      label: '與陌生人互動', mode: 'stranger' },
]

const WEEKLY_TASKS = [
  { key: 'contact_referrer', label: '與推薦人聯絡' },
  { key: 'coring', label: 'Coring 培訓' },
]

const MONTH_ITEMS = [
  { key: 'new_product', label: '認識新產品', placeholder: '產品名稱' },
  { key: 'gmtss',       label: 'GMTSS 課程', placeholder: '課程名稱' },
]

const COUNTER_COLORS = {
  bv_share:      '#1668E3', ibv_share: '#2C9C6A',
  meetup:        '#D23E8C', show_business: '#9A6A16',
  sell_ticket:   '#7C5CD6', stranger: '#17A2A2',
}

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
  const [todayContacted, setTodayContacted] = useState([])
  const [weekLogs, setWeekLogs] = useState([])
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
    if (goalModal && goalTextareaRef.current) {
      const el = goalTextareaRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [goalModal])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([
      fetchCheckins(), fetchWeekStatus(), fetchTodayContacted(),
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

  async function fetchTodayContacted() {
    const { data } = await supabase.from('contact_logs')
      .select('contact_id,contacts(id,name)')
      .eq('user_id', user.id).eq('date', viewDate)
    if (data) {
      const seen = new Set()
      const list = []
      data.forEach(l => {
        if (l.contacts && !seen.has(l.contacts.id)) {
          seen.add(l.contacts.id)
          list.push({ id: l.contacts.id, name: l.contacts.name })
        }
      })
      setTodayContacted(list.slice(0, 5))
    }
  }

  async function fetchGoalText() {
    const { data } = await supabase.from('users').select('goal_declaration').eq('id', user.id).single()
    if (data?.goal_declaration) setGoalText(data.goal_declaration)
  }

  async function fetchWeekLogs() {
    if (!user) return
    const days = getWeekDays(weekViewDate)
    const ws = days[0], we = days[6]
    const { data } = await supabase.from('counter_logs')
      .select('id,counter_key,date,planned_date,is_done,product_name,note,contact_id,contacts(name)')
      .eq('user_id', user.id)
      .not('counter_key', 'in', '("new_product","gmtss")')
    const filtered = (data || []).filter(l => {
      const d = l.planned_date || l.date
      return d >= ws && d <= we
    })
    setWeekLogs(filtered)
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

  async function deleteLog(id, mode) {
    await supabase.from('counter_logs').delete().eq('id', id)
    if (mode === 'month') fetchMonthLogs()
    else fetchWeekLogs()
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

  const doneCount = DAILY_TASKS.filter(t => checkins[t.key]).length
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
    const hasDone = logs.some(l => l.is_done)
    const hasPlan = logs.some(l => !l.is_done)
    const hasProduct = logs.some(l => l.counter_key === 'new_product')
    const hasGmtss = logs.some(l => l.counter_key === 'gmtss')
    calDays.push({ d, dateStr, logs, hasDone, hasPlan, hasProduct, hasGmtss })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ background:'#fff',minHeight:'100vh',paddingBottom:80 }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div className="dash-container" style={{ padding:'20px 16px 0' }}>
        <h1 style={{ fontSize:19,fontWeight:700,color:TEXT_MAIN,margin:0 }}>每日行動</h1>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12,
          background:SUBCARD_BG,borderRadius:12,padding:'6px 10px' }}>
          <button onClick={() => changeDate(-1)}
            style={{ background:'none',border:'none',color:TEXT_SECONDARY,
              width:28,height:28,fontSize:18,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:13,color:PRIMARY,margin:0,fontWeight:700 }}>{formatDateLabel(viewDate)}</p>
            {!isToday && <span style={{ fontSize:11,color:ACCENT_YELLOW_TEXT,fontWeight:600 }}>補打模式</span>}
          </div>
          <button onClick={() => changeDate(1)}
            style={{ background:'none',
              border:'none',color: isToday?'#C7CEDD':TEXT_SECONDARY,
              width:28,height:28,fontSize:18,
              cursor: isToday?'default':'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
        </div>
        {!isToday && (
          <div style={{ textAlign:'center',marginTop:8 }}>
            <button onClick={() => setViewDate(today())}
              style={{ background:PRIMARY_SOFT,border:'none',color:PRIMARY,
                padding:'4px 14px',borderRadius:20,fontSize:12,cursor:'pointer',fontWeight:700 }}>
              回到今天
            </button>
          </div>
        )}
      </div>

      <div className="dash-container" style={{ padding:'14px 16px',display:'flex',flexDirection:'column',gap:12 }}>

        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={sectionTitle}>每日任務</span>
            <span style={{ fontSize:13,color:TEXT_SECONDARY,fontWeight:600 }}>{doneCount}/{DAILY_TASKS.length}</span>
          </div>

          <div style={{ display:'flex',justifyContent:'space-between',padding:'8px',
            background:SUBCARD_BG,borderRadius:12,marginBottom:10 }}>
            {weekStatus.map((w,i) => {
              const isSelected = w.date === viewDate
              const isT = w.date === today()
              const dc = w.status==='full'?ACCENT_GREEN:w.status==='partial'?ACCENT_YELLOW:'#E1E5EE'
              return (
                <div key={i} onClick={() => { if (w.date <= today()) setViewDate(w.date) }}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                    cursor: w.date <= today()?'pointer':'default' }}>
                  <span style={{ fontSize:11,color: isSelected?PRIMARY:isT?PRIMARY:TEXT_MUTED,
                    fontWeight: isSelected||isT?700:600 }}>
                    {DAYS_ZH[new Date(w.date+'T00:00:00').getDay()]}
                  </span>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:dc,
                    outline: isSelected?`2px solid ${PRIMARY}`:isT?`2px solid ${PRIMARY}`:'none',
                    outlineOffset:2 }} />
                </div>
              )
            })}
          </div>

          {DAILY_TASKS.map(task => {
            const done = !!checkins[task.key]
            const hasAction = task.url || task.internalPath || task.social || task.toContacts || task.key === 'goal_declaration'
            const TaskIcon = task.Icon
            return (
              <div key={task.key} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',
                borderBottom:`1px solid ${BORDER}` }}>
                <button onClick={() => toggleCheckin(task.key)}
                  style={{ width:20,height:20,borderRadius:7,flexShrink:0,
                    border:done?'none':'2px solid #D8DCE8',background:done?ACCENT_GREEN:'#fff',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    transition:'all 0.15s',cursor:'pointer' }}>
                  {done&&<IconCheck size={12} stroke={2.5} color="#fff" />}
                </button>
                <TaskIcon size={16} stroke={1.9} color={done?'#C7CEDD':PRIMARY} />
                <button onClick={() => hasAction && handleTaskAction(task)}
                  style={{ flex:1,background:'none',border:'none',textAlign:'left',
                    cursor: hasAction?'pointer':'default',padding:0,
                    display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:13,fontWeight:600,color:done?TEXT_MUTED:TEXT_MAIN,
                    textDecoration:done?'line-through':'none' }}>
                    {task.label}
                    {task.special&&todayContacted.length>0&&(
                      <span style={{ marginLeft:6,display:'inline-flex',gap:4,flexWrap:'wrap' }}>
                        {todayContacted.map((c,i) => (
                          <span key={c.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${c.id}`) }}
                            style={{ color:ACCENT_GREEN_TEXT,fontWeight:700,cursor:'pointer',
                              textDecoration:'underline' }}>
                            {c.name}{i<todayContacted.length-1?'、':''}
                          </span>
                        ))}
                        <span style={{ color:ACCENT_GREEN_TEXT,fontWeight:700 }}>✓</span>
                      </span>
                    )}
                  </span>
                  {hasAction && <span style={{ fontSize:12,color:TEXT_MUTED,marginLeft:8,flexShrink:0 }}>›</span>}
                </button>
              </div>
            )
          })}
        </div>

        <div style={card}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
            <span style={sectionTitle}>每週行動</span>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <button onClick={() => changeWeekViewDate(-1)} style={navBtn}>‹</button>
              <span style={{ fontSize:12,fontWeight:600,color:TEXT_MAIN }}>
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
                      border:anyDone?'none':'2px solid #D8DCE8',background:anyDone?ACCENT_GREEN:'#fff',
                      display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                    {anyDone&&<IconCheck size={11} stroke={2.5} color="#fff" />}
                  </button>
                  <span style={{ fontSize:13,fontWeight:600,color:anyDone?TEXT_MUTED:TEXT_MAIN,
                    textDecoration:anyDone?'line-through':'none' }}>{task.label}</span>
                </div>
              )
            })}
          </div>

          {(() => {
            const meetupLogs = weekLogs.filter(l => l.counter_key === 'meetup')
            const meetupDone = meetupLogs.filter(l => l.is_done).length
            const meetupPlanned = meetupLogs.filter(l => !l.is_done).length
            const hitTarget = meetupDone >= 2
            return (
              <div style={{ marginBottom:12, background: hitTarget ? ACCENT_GREEN_SOFT : SUBCARD_BG,
                borderRadius:12, padding:'10px 12px' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                  <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>每週2訪</span>
                  <button onClick={() => openAddModal('week', today(), 'meetup')}
                    style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:10,border:'none',
                      background:PRIMARY,color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer' }}>
                    <IconPlus size={12} stroke={2.2} /> 記錄見面
                  </button>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <div style={{ flex:1,height:6,background:BORDER,borderRadius:99,overflow:'hidden' }}>
                    <div style={{ height:'100%',borderRadius:99,
                      width:`${Math.min((meetupDone/2)*100,100)}%`,
                      background: hitTarget ? ACCENT_GREEN : ACCENT_YELLOW,
                      transition:'width 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize:12,fontWeight:700,
                    color: hitTarget ? ACCENT_GREEN_TEXT : ACCENT_YELLOW_TEXT }}>{meetupDone}/2</span>
                </div>
                {meetupPlanned > 0 && (
                  <p style={{ fontSize:11,color:TEXT_MUTED,margin:'6px 0 0' }}>
                    另有 {meetupPlanned} 筆已預排待完成
                  </p>
                )}
              </div>
            )
          })()}

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4 }}>
            {weekDays.map((d,i) => {
              const isT = d === today()
              const isFut = d > today()
              const dayLogs = weekLogs.filter(l => (l.planned_date || l.date) === d)
              const hasDone = dayLogs.some(l => l.is_done)
              const hasPlan = dayLogs.some(l => !l.is_done)
              const isSelected = selectedWeekDay === d
              let bg = '#fff', border = BORDER
              if (hasDone) { bg = ACCENT_GREEN_SOFT; border = '#B7EBD3' }
              else if (hasPlan) { bg = '#FFF3D6'; border = '#FFDF9E' }
              if (isSelected) border = PRIMARY
              return (
                <div key={d} onClick={() => setSelectedWeekDay(isSelected ? null : d)}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',
                    gap:2,cursor:'pointer' }}>
                  <span style={{ fontSize:10,color: isT?PRIMARY:isFut?'#C7CEDD':TEXT_MUTED,
                    fontWeight: isT?700:600 }}>
                    {DAYS_ZH[new Date(d+'T00:00:00').getDay()]}<br/>{formatShortDate(d)}
                  </span>
                  <div style={{ width:'100%',minHeight:52,borderRadius:10,
                    background:bg, border:`1.5px solid ${border}`,
                    padding:3,display:'flex',flexDirection:'column',gap:2,
                    outline: isSelected?`2px solid ${PRIMARY}`:'none',
                    outlineOffset:1 }}>
                    {dayLogs.slice(0,3).map(log => {
                      const c = WEEKLY_COUNTERS.find(x => x.key === log.counter_key)
                      const color = COUNTER_COLORS[log.counter_key] || TEXT_MUTED
                      return (
                        <div key={log.id} style={{ fontSize:9,padding:'1px 3px',borderRadius:4,
                          background: log.is_done ? `${color}22` : '#FFDF9E66',
                          color: log.is_done ? color : '#9A6A16',
                          fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                          {c?.label || ''}
                        </div>
                      )
                    })}
                    {dayLogs.length > 3 && (
                      <div style={{ fontSize:9,color:TEXT_MUTED,textAlign:'center' }}>+{dayLogs.length-3}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {selectedWeekDay && (
            <div style={{ marginTop:12,borderTop:`1px solid ${BORDER}`,paddingTop:12 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>
                  {formatDateLabel(selectedWeekDay)}
                </span>
                <button onClick={() => openAddModal('week', selectedWeekDay)}
                  style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:10,border:'none',
                    background:PRIMARY,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
                  <IconPlus size={13} stroke={2.2} /> 新增
                </button>
              </div>
              {weekLogs.filter(l => (l.planned_date || l.date) === selectedWeekDay).length === 0 ? (
                <p style={{ fontSize:12,color:TEXT_MUTED,textAlign:'center',padding:'8px 0' }}>
                  這天沒有記錄，點「+ 新增」來新增
                </p>
              ) : (
                weekLogs.filter(l => (l.planned_date || l.date) === selectedWeekDay).map(log => {
                  const c = WEEKLY_COUNTERS.find(x => x.key === log.counter_key)
                  const color = COUNTER_COLORS[log.counter_key] || TEXT_MUTED
                  const displayName = c?.mode === 'stranger'
                    ? (log.product_name || '陌生人')
                    : (log.contacts?.name || '—')
                  return (
                    <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                      background: log.is_done?ACCENT_GREEN_SOFT:'#FFF9EC',
                      borderRadius:10,padding:'8px 10px',marginBottom:6 }}>
                      {log.is_done
                        ? <IconCheck size={14} stroke={2.2} color={ACCENT_GREEN_TEXT} />
                        : <IconCalendar size={14} stroke={1.9} color={ACCENT_YELLOW_TEXT} />}
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <span style={{ fontSize:10,padding:'1px 6px',borderRadius:99,
                            background:`${color}22`,color,fontWeight:700 }}>{c?.label}</span>
                          <span style={{ fontSize:13,color:TEXT_MAIN,fontWeight:600 }}>{displayName}</span>
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
                              cursor:'pointer',fontWeight:700 }}>完成</button>
                        )}
                        <button onClick={() => openEditModal('week', log)}
                          style={{ fontSize:11,color:PRIMARY,background:'none',border:'none',cursor:'pointer' }}>編輯</button>
                        <button onClick={() => deleteLog(log.id, 'week')}
                          style={{ fontSize:11,color:DANGER,background:'none',border:'none',cursor:'pointer' }}>刪除</button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
            <span style={sectionTitle}>每月目標</span>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <button onClick={() => changeMonthViewDate(-1)} style={navBtn}>‹</button>
              <span style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN }}>
                {monthYear.toLocaleDateString('zh-TW',{year:'numeric',month:'long'})}
              </span>
              <button onClick={() => changeMonthViewDate(1)} style={navBtn}>›</button>
            </div>
          </div>

          <div style={{ display:'flex',gap:10,marginBottom:10,padding:'6px 10px',
            background:SUBCARD_BG,borderRadius:10,flexWrap:'wrap' }}>
            {[
              { color:PRIMARY, label:'新產品（完成）' },
              { color:ACCENT_GREEN_TEXT, label:'GMTSS（完成）' },
              { color:ACCENT_YELLOW_TEXT, label:'預排' },
            ].map(l => (
              <div key={l.label} style={{ display:'flex',alignItems:'center',gap:4 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:l.color }} />
                <span style={{ fontSize:11,color:TEXT_SECONDARY }}>{l.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,marginBottom:3 }}>
            {DAYS_ZH.map(d => (
              <div key={d} style={{ textAlign:'center',fontSize:10,color:TEXT_MUTED,padding:'2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,marginBottom:8 }}>
            {Array.from({ length: firstDow }).map((_,i) => <div key={`e${i}`} />)}
            {calDays.map(day => {
              const isFut = day.dateStr > today()
              const isT = day.dateStr === today()
              const isSelected = selectedMonthDay === day.dateStr
              let bg = SUBCARD_BG, border = BORDER
              if (day.hasDone) { bg = ACCENT_GREEN_SOFT; border = '#B7EBD3' }
              else if (day.hasPlan) { bg = '#FFF3D6'; border = '#FFDF9E' }
              if (isSelected) border = PRIMARY
              return (
                <div key={day.dateStr}
                  onClick={() => setSelectedMonthDay(isSelected ? null : day.dateStr)}
                  style={{ aspectRatio:'1',minWidth:0,width:'100%',borderRadius:9,background:bg,
                    border:`1.5px solid ${isT&&!isSelected?PRIMARY:border}`,
                    boxSizing:'border-box',
                    display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',cursor:'pointer',gap:2,
                    outline: isSelected?`2px solid ${PRIMARY}`:'none',outlineOffset:-2 }}>
                  <span style={{ fontSize:12,fontWeight: isT?700:600,
                    color: day.hasDone?ACCENT_GREEN_TEXT:day.hasPlan?ACCENT_YELLOW_TEXT:isFut?TEXT_MUTED:TEXT_MAIN }}>
                    {day.d}
                  </span>
                  {(day.hasProduct || day.hasGmtss || day.hasPlan) && (
                    <div style={{ display:'flex',gap:2 }}>
                      {day.hasProduct && <div style={{ width:5,height:5,borderRadius:'50%',background:PRIMARY }} />}
                      {day.hasGmtss && <div style={{ width:5,height:5,borderRadius:'50%',background:ACCENT_GREEN_TEXT }} />}
                      {day.hasPlan && !day.hasDone && <div style={{ width:5,height:5,borderRadius:'50%',background:ACCENT_YELLOW_TEXT }} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {selectedMonthDay && (
            <div style={{ borderTop:`1px solid ${BORDER}`,paddingTop:12 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>
                  {formatDateLabel(selectedMonthDay)}
                </span>
                <button onClick={() => openAddModal('month', selectedMonthDay)}
                  style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:10,border:'none',
                    background:PRIMARY,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
                  <IconPlus size={13} stroke={2.2} /> 新增
                </button>
              </div>
              {monthLogs.filter(l => (l.planned_date || l.date) === selectedMonthDay).length === 0 ? (
                <p style={{ fontSize:12,color:TEXT_MUTED,textAlign:'center',padding:'8px 0' }}>
                  這天沒有記錄，點「+ 新增」來新增
                </p>
              ) : (
                monthLogs.filter(l => (l.planned_date || l.date) === selectedMonthDay).map(log => {
                  const item = MONTH_ITEMS.find(x => x.key === log.counter_key)
                  const color = log.counter_key === 'new_product' ? PRIMARY : ACCENT_GREEN_TEXT
                  return (
                    <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                      background: log.is_done?ACCENT_GREEN_SOFT:'#FFF9EC',
                      borderRadius:10,padding:'8px 10px',marginBottom:6 }}>
                      {log.is_done
                        ? <IconCheck size={14} stroke={2.2} color={ACCENT_GREEN_TEXT} />
                        : <IconCalendar size={14} stroke={1.9} color={ACCENT_YELLOW_TEXT} />}
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                          <span style={{ fontSize:10,padding:'1px 6px',borderRadius:99,
                            background:`${color}22`,color,fontWeight:700 }}>{item?.label}</span>
                          <span style={{ fontSize:13,color:TEXT_MAIN,fontWeight:600 }}>
                            {log.product_name || '—'}
                          </span>
                        </div>
                        {log.note && <p style={{ fontSize:12,color:TEXT_MUTED,margin:0 }}>{log.note}</p>}
                      </div>
                      <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end' }}>
                        {!log.is_done && (
                          <button onClick={() => confirmDone(log)}
                            style={{ fontSize:11,color:ACCENT_GREEN_TEXT,background:'none',border:'none',
                              cursor:'pointer',fontWeight:700 }}>完成</button>
                        )}
                        <button onClick={() => openEditModal('month', log)}
                          style={{ fontSize:11,color:PRIMARY,background:'none',border:'none',cursor:'pointer' }}>編輯</button>
                        <button onClick={() => deleteLog(log.id, 'month')}
                          style={{ fontSize:11,color:DANGER,background:'none',border:'none',cursor:'pointer' }}>刪除</button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

      </div>

      {goalModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setGoalModal(false) }}>
          <div style={{ background:'#fff',borderRadius:'22px 22px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:0,display:'flex',alignItems:'center',gap:6 }}>
                <IconTarget size={17} stroke={1.9} color={PRIMARY} /> 我的目標宣言
              </h3>
              <button onClick={() => setGoalModal(false)}
                style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED }}><IconX size={20} /></button>
            </div>
            <textarea ref={goalTextareaRef} value={goalText}
              onChange={e => {
                setGoalText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              placeholder="寫下你的目標宣言..." rows={4}
              style={{ width:'100%',padding:'12px',borderRadius:12,border:`1px solid ${BORDER}`,
                fontSize:15,boxSizing:'border-box',outline:'none',resize:'none',lineHeight:1.8,display:'block' }} />
            <button onClick={saveGoalText} disabled={goalSaving}
              style={{ width:'100%',padding:'13px',borderRadius:14,border:'none',
                background: goalSaved?ACCENT_GREEN:goalSaving?'#9BBBF2':PRIMARY,
                color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:12 }}>
              {goalSaved ? '✓ 已儲存' : goalSaving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}

      {socialModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setSocialModal(false) }}>
          <div style={{ background:'#fff',borderRadius:'22px 22px 0 0',padding:24,width:'100%',maxWidth:430 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:0,display:'flex',alignItems:'center',gap:6 }}>
                <IconMessageCircle size={17} stroke={1.9} color={PRIMARY} /> 前往回應
              </h3>
              <button onClick={() => setSocialModal(false)}
                style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED }}><IconX size={20} /></button>
            </div>
            <div style={{ display:'flex',gap:12 }}>
              <button onClick={() => { window.open('https://www.facebook.com/groups/710836659091767/','_blank'); setSocialModal(false) }}
                style={{ flex:1,padding:'16px 8px',borderRadius:16,border:'none',
                  background:'#1877F2',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                臉書 IDEA
              </button>
              <button onClick={() => { window.open('https://line.me','_blank'); setSocialModal(false) }}
                style={{ flex:1,padding:'16px 8px',borderRadius:16,border:'none',
                  background:'#06C755',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                LINE
              </button>
            </div>
          </div>
        </div>
      )}

      {logModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setLogModal(null) }}>
          <div style={{ background:'#fff',borderRadius:'22px 22px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:0 }}>
                {logModal.editId ? '編輯記錄' : '新增記錄'}
              </h3>
              <button onClick={() => setLogModal(null)}
                style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED }}><IconX size={20} /></button>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={labelStyle}>日期</label>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={inputStyle} />
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
                  {WEEKLY_COUNTERS.map(c => (
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
                          background: logContactId===c.id?PRIMARY_SOFT:'#fff',border:'none',
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

            {getCounterMode() === 'stranger' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>姓名 <span style={{ color:TEXT_MUTED,fontSize:12 }}>選填</span></label>
                <input placeholder="例：捷運旁的阿姨…" value={logStrangerName}
                  onChange={e => setLogStrangerName(e.target.value)} style={inputStyle} />
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
                background: canConfirm()?PRIMARY:'#D8DCE8',
                color:'#fff',fontSize:15,fontWeight:700,
                cursor: canConfirm()?'pointer':'not-allowed' }}>
              {logSaving ? '儲存中…' : logModal.editId ? '儲存修改' : logDate > today() ? '預排' : '確認儲存'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const card = { background:'#fff',borderRadius:18,padding:'16px',border:`1px solid ${BORDER}` }
const sectionTitle = { fontSize:14,fontWeight:700,color:TEXT_MAIN }
const navBtn = { background:'none',border:`1px solid ${BORDER}`,borderRadius:10,
  width:28,height:28,cursor:'pointer',fontSize:14,color:TEXT_SECONDARY,
  display:'flex',alignItems:'center',justifyContent:'center' }
const labelStyle = { fontSize:13,color:TEXT_MAIN,fontWeight:600,display:'block',marginBottom:6 }
const inputStyle = { width:'100%',padding:'10px 12px',borderRadius:12,
  border:`1px solid ${BORDER}`,fontSize:15,boxSizing:'border-box',outline:'none' }
