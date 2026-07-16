import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

const DAYS_ZH = ['日','一','二','三','四','五','六']
function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

const DAILY_TASKS = [
  { key: 'goal_declaration', label: '目標宣言', icon: '🎯' },
  { key: 'backend_announcement', label: '後台公告/管理報告', icon: '📋', url: 'https://tw.unfranchise.com' },
  { key: 'respond_social', label: '回應臉書IDEA/LINE', icon: '💬', social: true },
  { key: 'daily_practice', label: '每日練習', icon: '📚', internalPath: '/daily-practice' },
  { key: 'listen_recording', label: '聽錄音', icon: '🎧', internalPath: '/recording' },
  { key: 'ig_story', label: 'IG 限動', icon: '📸', url: 'https://www.instagram.com' },
  { key: 'daily_3_contacts', label: '每日3互動', icon: '👥', special: true, toContacts: true },
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
  bv_share:      '#639922', ibv_share: '#185FA5',
  meetup:        '#854F0B', show_business: '#993556',
  sell_ticket:   '#534AB7', stranger: '#0F6E56',
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

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:'#9CA3AF' }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>

      <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
        <div style={{ maxWidth:430,margin:'0 auto',padding:'52px 20px 20px' }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#fff',margin:0 }}>每日行動</h1>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8 }}>
            <button onClick={() => changeDate(-1)}
              style={{ background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',
                width:32,height:32,borderRadius:8,fontSize:18,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:14,color:'#E0F2FE',margin:0,fontWeight:600 }}>{formatDateLabel(viewDate)}</p>
              {!isToday && <span style={{ fontSize:11,color:'#FCD34D',fontWeight:600 }}>補打模式</span>}
            </div>
            <button onClick={() => changeDate(1)}
              style={{ background: isToday?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.15)',
                border:'none',color: isToday?'rgba(255,255,255,0.3)':'#fff',
                width:32,height:32,borderRadius:8,fontSize:18,
                cursor: isToday?'default':'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
          </div>
          {!isToday && (
            <div style={{ textAlign:'center',marginTop:8 }}>
              <button onClick={() => setViewDate(today())}
                style={{ background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',
                  padding:'4px 14px',borderRadius:20,fontSize:12,cursor:'pointer',fontWeight:600 }}>
                回到今天
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:430,margin:'0 auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:12 }}>

        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={sectionTitle}>每日任務</span>
            <span style={{ fontSize:13,color:'#6B7280' }}>{doneCount}/{DAILY_TASKS.length}</span>
          </div>

          <div style={{ display:'flex',justifyContent:'space-between',padding:'8px',
            background:'#F8FAFC',borderRadius:10,marginBottom:10 }}>
            {weekStatus.map((w,i) => {
              const isSelected = w.date === viewDate
              const isT = w.date === today()
              const dc = w.status==='full'?'#22C55E':w.status==='partial'?'#F97316':'#E5E7EB'
              return (
                <div key={i} onClick={() => { if (w.date <= today()) setViewDate(w.date) }}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                    cursor: w.date <= today()?'pointer':'default' }}>
                  <span style={{ fontSize:11,color: isSelected?'#2563EB':isT?'#3B82F6':'#9CA3AF',
                    fontWeight: isSelected||isT?700:400 }}>
                    {DAYS_ZH[new Date(w.date+'T00:00:00').getDay()]}
                  </span>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:dc,
                    outline: isSelected?'2px solid #2563EB':isT?'2px solid #3B82F6':'none',
                    outlineOffset:2 }} />
                </div>
              )
            })}
          </div>

          {DAILY_TASKS.map(task => {
            const done = !!checkins[task.key]
            const hasAction = task.url || task.internalPath || task.social || task.toContacts || task.key === 'goal_declaration'
            return (
              <div key={task.key} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                borderBottom:'1px solid #F9FAFB' }}>
                <button onClick={() => toggleCheckin(task.key)}
                  style={{ width:22,height:22,borderRadius:6,flexShrink:0,
                    border:done?'none':'2px solid #D1D5DB',background:done?'#22C55E':'#fff',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    transition:'all 0.15s',cursor:'pointer' }}>
                  {done&&<span style={{ fontSize:12,color:'#fff' }}>✓</span>}
                </button>
                <button onClick={() => hasAction && handleTaskAction(task)}
                  style={{ flex:1,background:'none',border:'none',textAlign:'left',
                    cursor: hasAction?'pointer':'default',padding:0,
                    display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:14,color:done?'#9CA3AF':'#374151',
                    textDecoration:done?'line-through':'none' }}>
                    {task.icon} {task.label}
                    {task.special&&todayContacted.length>0&&(
                      <span style={{ marginLeft:6,display:'inline-flex',gap:4,flexWrap:'wrap' }}>
                        {todayContacted.map((c,i) => (
                          <span key={c.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${c.id}`) }}
                            style={{ color:'#22C55E',fontWeight:600,cursor:'pointer',
                              textDecoration:'underline' }}>
                            {c.name}{i<todayContacted.length-1?'、':''}
                          </span>
                        ))}
                        <span style={{ color:'#22C55E',fontWeight:600 }}>✓</span>
                      </span>
                    )}
                  </span>
                  {hasAction && <span style={{ fontSize:12,color:'#9CA3AF',marginLeft:8,flexShrink:0 }}>›</span>}
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
              <span style={{ fontSize:12,fontWeight:600,color:'#374151' }}>
                {formatShortDate(weekDays[0])} 週六 — {formatShortDate(weekDays[6])} 週五
              </span>
              <button onClick={() => changeWeekViewDate(1)} style={navBtn}>›</button>
            </div>
          </div>

          <div style={{ marginBottom:12,background:'#F8FAFC',borderRadius:10,padding:'8px 10px' }}>
            {WEEKLY_TASKS.map(task => {
              const anyDone = weekDays.some(d => weekTaskCheckins[task.key]?.[d])
              return (
                <div key={task.key} style={{ display:'flex',alignItems:'center',gap:10,padding:'6px 0' }}>
                  <button onClick={() => {
                    const targetDate = weekDays.find(d => d <= today()) || today()
                    toggleWeekTask(task.key, targetDate)
                  }}
                    style={{ width:20,height:20,borderRadius:5,flexShrink:0,
                      border:anyDone?'none':'2px solid #D1D5DB',background:anyDone?'#22C55E':'#fff',
                      display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                    {anyDone&&<span style={{ fontSize:11,color:'#fff' }}>✓</span>}
                  </button>
                  <span style={{ fontSize:13,color:anyDone?'#9CA3AF':'#374151',
                    textDecoration:anyDone?'line-through':'none' }}>{task.label}</span>
                </div>
              )
            })}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4 }}>
            {weekDays.map((d,i) => {
              const isT = d === today()
              const isFut = d > today()
              const dayLogs = weekLogs.filter(l => (l.planned_date || l.date) === d)
              const hasDone = dayLogs.some(l => l.is_done)
              const hasPlan = dayLogs.some(l => !l.is_done)
              const isSelected = selectedWeekDay === d
              let bg = '#fff', border = '#E5E7EB'
              if (hasDone) { bg = '#EAF3DE'; border = '#C0DD97' }
              else if (hasPlan) { bg = '#FAEEDA'; border = '#FAC775' }
              if (isSelected) border = '#2563EB'
              return (
                <div key={d} onClick={() => setSelectedWeekDay(isSelected ? null : d)}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',
                    gap:2,cursor:'pointer' }}>
                  <span style={{ fontSize:10,color: isT?'#2563EB':isFut?'#D1D5DB':'#9CA3AF',
                    fontWeight: isT?700:400 }}>
                    {DAYS_ZH[new Date(d+'T00:00:00').getDay()]}<br/>{formatShortDate(d)}
                  </span>
                  <div style={{ width:'100%',minHeight:52,borderRadius:8,
                    background:bg, border:`1.5px solid ${border}`,
                    padding:3,display:'flex',flexDirection:'column',gap:2,
                    outline: isSelected?`2px solid #2563EB`:'none',
                    outlineOffset:1 }}>
                    {dayLogs.slice(0,3).map(log => {
                      const c = WEEKLY_COUNTERS.find(x => x.key === log.counter_key)
                      const color = COUNTER_COLORS[log.counter_key] || '#9CA3AF'
                      return (
                        <div key={log.id} style={{ fontSize:9,padding:'1px 3px',borderRadius:4,
                          background: log.is_done ? `${color}22` : '#FAC77544',
                          color: log.is_done ? color : '#854F0B',
                          fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                          {c?.label || ''}
                        </div>
                      )
                    })}
                    {dayLogs.length > 3 && (
                      <div style={{ fontSize:9,color:'#9CA3AF',textAlign:'center' }}>+{dayLogs.length-3}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {selectedWeekDay && (
            <div style={{ marginTop:12,borderTop:'1px solid #F3F4F6',paddingTop:12 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                <span style={{ fontSize:13,fontWeight:700,color:'#374151' }}>
                  {formatDateLabel(selectedWeekDay)}
                </span>
                <button onClick={() => openAddModal('week', selectedWeekDay)}
                  style={{ padding:'4px 10px',borderRadius:8,border:'none',
                    background:'#2563EB',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
                  + 新增
                </button>
              </div>
              {weekLogs.filter(l => (l.planned_date || l.date) === selectedWeekDay).length === 0 ? (
                <p style={{ fontSize:12,color:'#D1D5DB',textAlign:'center',padding:'8px 0' }}>
                  這天沒有記錄，點「+ 新增」來新增
                </p>
              ) : (
                weekLogs.filter(l => (l.planned_date || l.date) === selectedWeekDay).map(log => {
                  const c = WEEKLY_COUNTERS.find(x => x.key === log.counter_key)
                  const color = COUNTER_COLORS[log.counter_key] || '#9CA3AF'
                  const displayName = c?.mode === 'stranger'
                    ? (log.product_name || '陌生人')
                    : (log.contacts?.name || '—')
                  return (
                    <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                      background: log.is_done?'#F0FDF4':'#FFFBEB',
                      borderRadius:8,padding:'8px 10px',marginBottom:6 }}>
                      <span style={{ fontSize:13 }}>{log.is_done ? '✅' : '📅'}</span>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <span style={{ fontSize:10,padding:'1px 6px',borderRadius:99,
                            background:`${color}22`,color,fontWeight:700 }}>{c?.label}</span>
                          <span style={{ fontSize:13,color:'#374151',fontWeight:600 }}>{displayName}</span>
                        </div>
                        {c?.mode === 'product' && log.product_name && (
                          <span style={{ fontSize:12,color:'#6B7280' }}>{log.product_name}</span>
                        )}
                        {log.note && <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>{log.note}</p>}
                      </div>
                      <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end' }}>
                        {!log.is_done && (
                          <button onClick={() => confirmDone(log)}
                            style={{ fontSize:11,color:'#16A34A',background:'none',border:'none',
                              cursor:'pointer',fontWeight:600 }}>完成</button>
                        )}
                        <button onClick={() => openEditModal('week', log)}
                          style={{ fontSize:11,color:'#2563EB',background:'none',border:'none',cursor:'pointer' }}>編輯</button>
                        <button onClick={() => deleteLog(log.id, 'week')}
                          style={{ fontSize:11,color:'#EF4444',background:'none',border:'none',cursor:'pointer' }}>刪除</button>
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
              <span style={{ fontSize:13,fontWeight:600,color:'#374151' }}>
                {monthYear.toLocaleDateString('zh-TW',{year:'numeric',month:'long'})}
              </span>
              <button onClick={() => changeMonthViewDate(1)} style={navBtn}>›</button>
            </div>
          </div>

          <div style={{ display:'flex',gap:10,marginBottom:10,padding:'6px 10px',
            background:'#F8FAFC',borderRadius:8,flexWrap:'wrap' }}>
            {[
              { color:'#639922', label:'新產品（完成）' },
              { color:'#185FA5', label:'GMTSS（完成）' },
              { color:'#EF9F27', label:'預排' },
            ].map(l => (
              <div key={l.label} style={{ display:'flex',alignItems:'center',gap:4 }}>
                <div style={{ width:8,height:8,borderRadius:'50%',background:l.color }} />
                <span style={{ fontSize:11,color:'#6B7280' }}>{l.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:3 }}>
            {DAYS_ZH.map(d => (
              <div key={d} style={{ textAlign:'center',fontSize:10,color:'#9CA3AF',padding:'2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:8 }}>
            {Array.from({ length: firstDow }).map((_,i) => <div key={`e${i}`} />)}
            {calDays.map(day => {
              const isFut = day.dateStr > today()
              const isT = day.dateStr === today()
              const isSelected = selectedMonthDay === day.dateStr
              let bg = 'transparent', border = 'transparent'
              if (day.hasDone) { bg = '#EAF3DE'; border = '#C0DD97' }
              else if (day.hasPlan) { bg = '#FAEEDA'; border = '#FAC775' }
              if (isSelected) border = '#2563EB'
              return (
                <div key={day.dateStr}
                  onClick={() => setSelectedMonthDay(isSelected ? null : day.dateStr)}
                  style={{ aspectRatio:'1',borderRadius:6,background:bg,
                    border:`1.5px solid ${isT&&!isSelected?'#2563EB':border}`,
                    display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',cursor:'pointer',gap:2,
                    outline: isSelected?'2px solid #2563EB':'none',outlineOffset:1 }}>
                  <span style={{ fontSize:11,fontWeight: isT?700:400,
                    color: day.hasDone?'#3B6D11':day.hasPlan?'#854F0B':isFut?'#9CA3AF':'#374151' }}>
                    {day.d}
                  </span>
                  {(day.hasProduct || day.hasGmtss || day.hasPlan) && (
                    <div style={{ display:'flex',gap:2 }}>
                      {day.hasProduct && <div style={{ width:5,height:5,borderRadius:'50%',background:'#639922' }} />}
                      {day.hasGmtss && <div style={{ width:5,height:5,borderRadius:'50%',background:'#185FA5' }} />}
                      {day.hasPlan && !day.hasDone && <div style={{ width:5,height:5,borderRadius:'50%',background:'#EF9F27' }} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {selectedMonthDay && (
            <div style={{ borderTop:'1px solid #F3F4F6',paddingTop:12 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                <span style={{ fontSize:13,fontWeight:700,color:'#374151' }}>
                  {formatDateLabel(selectedMonthDay)}
                </span>
                <button onClick={() => openAddModal('month', selectedMonthDay)}
                  style={{ padding:'4px 10px',borderRadius:8,border:'none',
                    background:'#2563EB',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
                  + 新增
                </button>
              </div>
              {monthLogs.filter(l => (l.planned_date || l.date) === selectedMonthDay).length === 0 ? (
                <p style={{ fontSize:12,color:'#D1D5DB',textAlign:'center',padding:'8px 0' }}>
                  這天沒有記錄，點「+ 新增」來新增
                </p>
              ) : (
                monthLogs.filter(l => (l.planned_date || l.date) === selectedMonthDay).map(log => {
                  const item = MONTH_ITEMS.find(x => x.key === log.counter_key)
                  const color = log.counter_key === 'new_product' ? '#639922' : '#185FA5'
                  return (
                    <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                      background: log.is_done?'#F0FDF4':'#FFFBEB',
                      borderRadius:8,padding:'8px 10px',marginBottom:6 }}>
                      <span style={{ fontSize:13 }}>{log.is_done ? '✅' : '📅'}</span>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                          <span style={{ fontSize:10,padding:'1px 6px',borderRadius:99,
                            background:`${color}22`,color,fontWeight:700 }}>{item?.label}</span>
                          <span style={{ fontSize:13,color:'#374151',fontWeight:600 }}>
                            {log.product_name || '—'}
                          </span>
                        </div>
                        {log.note && <p style={{ fontSize:12,color:'#9CA3AF',margin:0 }}>{log.note}</p>}
                      </div>
                      <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end' }}>
                        {!log.is_done && (
                          <button onClick={() => confirmDone(log)}
                            style={{ fontSize:11,color:'#16A34A',background:'none',border:'none',
                              cursor:'pointer',fontWeight:600 }}>完成</button>
                        )}
                        <button onClick={() => openEditModal('month', log)}
                          style={{ fontSize:11,color:'#2563EB',background:'none',border:'none',cursor:'pointer' }}>編輯</button>
                        <button onClick={() => deleteLog(log.id, 'month')}
                          style={{ fontSize:11,color:'#EF4444',background:'none',border:'none',cursor:'pointer' }}>刪除</button>
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
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setGoalModal(false) }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:'#111827',margin:0 }}>🎯 我的目標宣言</h3>
              <button onClick={() => setGoalModal(false)}
                style={{ background:'none',border:'none',fontSize:20,color:'#9CA3AF',cursor:'pointer' }}>✕</button>
            </div>
            <textarea ref={goalTextareaRef} value={goalText}
              onChange={e => {
                setGoalText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              placeholder="寫下你的目標宣言..." rows={4}
              style={{ width:'100%',padding:'12px',borderRadius:10,border:'1px solid #D1D5DB',
                fontSize:15,boxSizing:'border-box',outline:'none',resize:'none',lineHeight:1.8,display:'block' }} />
            <button onClick={saveGoalText} disabled={goalSaving}
              style={{ width:'100%',padding:'13px',borderRadius:12,border:'none',
                background: goalSaved?'#22C55E':goalSaving?'#93C5FD':'#2563EB',
                color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:12 }}>
              {goalSaved ? '✓ 已儲存' : goalSaving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}

      {socialModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setSocialModal(false) }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',padding:24,width:'100%',maxWidth:430 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:'#111827',margin:0 }}>💬 前往回應</h3>
              <button onClick={() => setSocialModal(false)}
                style={{ background:'none',border:'none',fontSize:20,color:'#9CA3AF',cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex',gap:12 }}>
              <button onClick={() => { window.open('https://www.facebook.com/groups/710836659091767/','_blank'); setSocialModal(false) }}
                style={{ flex:1,padding:'16px 8px',borderRadius:14,border:'none',
                  background:'#1877F2',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                📘 臉書 IDEA
              </button>
              <button onClick={() => { window.open('https://line.me','_blank'); setSocialModal(false) }}
                style={{ flex:1,padding:'16px 8px',borderRadius:14,border:'none',
                  background:'#06C755',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                💚 LINE
              </button>
            </div>
          </div>
        </div>
      )}

      {logModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setLogModal(null) }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:'#111827',margin:0 }}>
                {logModal.editId ? '編輯記錄' : '新增記錄'}
              </h3>
              <button onClick={() => setLogModal(null)}
                style={{ background:'none',border:'none',fontSize:20,color:'#9CA3AF',cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={labelStyle}>日期</label>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={inputStyle} />
              {logDate > today() && (
                <p style={{ fontSize:12,color:'#F59E0B',margin:'6px 0 0',fontWeight:600 }}>
                  📅 預排模式：儲存後顯示為「待完成」
                </p>
              )}
            </div>

            {logModal.mode === 'week' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>行動類型</label>
                <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                  {WEEKLY_COUNTERS.map(c => (
                    <button key={c.key} onClick={() => setLogCounterKey(c.key)}
                      style={{ padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
                        border:`1.5px solid ${logCounterKey===c.key?COUNTER_COLORS[c.key]:'#E5E7EB'}`,
                        background: logCounterKey===c.key?`${COUNTER_COLORS[c.key]}18`:'#F9FAFB',
                        color: logCounterKey===c.key?COUNTER_COLORS[c.key]:'#374151' }}>
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
                      style={{ flex:1,padding:'8px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
                        border:`1.5px solid ${logCounterKey===item.key?'#2563EB':'#E5E7EB'}`,
                        background: logCounterKey===item.key?'#EFF6FF':'#F9FAFB',
                        color: logCounterKey===item.key?'#1D4ED8':'#374151' }}>
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
                  <span style={{ color:'#EF4444' }}> 必填</span>
                </label>
                <input placeholder="搜尋互動名單..." value={logContact}
                  onChange={e => { setLogContact(e.target.value); setLogContactId(null); searchContacts(e.target.value) }}
                  style={inputStyle} />
                {contactSearch.length > 0 && (
                  <div style={{ border:'1px solid #E5E7EB',borderRadius:8,marginTop:4,overflow:'hidden' }}>
                    {contactSearch.map(c => (
                      <button key={c.id} onClick={() => { setLogContact(c.name); setLogContactId(c.id); setContactSearch([]) }}
                        style={{ display:'block',width:'100%',textAlign:'left',padding:'10px 12px',
                          background: logContactId===c.id?'#EFF6FF':'#fff',border:'none',
                          borderBottom:'1px solid #F3F4F6',fontSize:14,cursor:'pointer',color:'#374151' }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {logContactId && <p style={{ fontSize:12,color:'#22C55E',margin:'4px 0 0' }}>✓ 已選擇：{logContact}</p>}
              </div>
            )}

            {getCounterMode() === 'product' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>分享產品 <span style={{ color:'#9CA3AF',fontSize:12 }}>選填</span></label>
                <input placeholder="輸入產品名稱..." value={logProduct}
                  onChange={e => setLogProduct(e.target.value)} style={inputStyle} />
              </div>
            )}

            {getCounterMode() === 'stranger' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>姓名 <span style={{ color:'#9CA3AF',fontSize:12 }}>選填</span></label>
                <input placeholder="例：捷運旁的阿姨…" value={logStrangerName}
                  onChange={e => setLogStrangerName(e.target.value)} style={inputStyle} />
              </div>
            )}

            {getCounterMode() === 'month_item' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>
                  {MONTH_ITEMS.find(i=>i.key===logCounterKey)?.placeholder || '名稱'}
                  <span style={{ color:'#EF4444' }}> 必填</span>
                </label>
                <input placeholder="請輸入名稱..." value={logProduct}
                  onChange={e => setLogProduct(e.target.value)} style={inputStyle} />
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <label style={labelStyle}>備註 <span style={{ color:'#9CA3AF',fontSize:12 }}>選填</span></label>
              <textarea placeholder="記錄重點..." value={logNote}
                onChange={e => setLogNote(e.target.value)}
                style={{ ...inputStyle,height:72,resize:'none' }} />
            </div>

            <button onClick={confirmLog} disabled={logSaving || !canConfirm()}
              style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
                background: canConfirm()?'#2563EB':'#D1D5DB',
                color:'#fff',fontSize:15,fontWeight:700,
                cursor: canConfirm()?'pointer':'not-allowed' }}>
              {logSaving ? '儲存中…' : logModal.editId ? '儲存修改' : logDate > today() ? '📅 預排' : '確認儲存'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const card = { background:'#fff',borderRadius:16,padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }
const sectionTitle = { fontSize:15,fontWeight:700,color:'#111827' }
const navBtn = { background:'none',border:'1px solid #E5E7EB',borderRadius:8,
  width:28,height:28,cursor:'pointer',fontSize:14,color:'#6B7280',
  display:'flex',alignItems:'center',justifyContent:'center' }
const labelStyle = { fontSize:13,color:'#374151',fontWeight:600,display:'block',marginBottom:6 }
const inputStyle = { width:'100%',padding:'10px 12px',borderRadius:10,
  border:'1px solid #D1D5DB',fontSize:15,boxSizing:'border-box',outline:'none' }
