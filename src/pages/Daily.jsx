import { useState, useEffect } from 'react'
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
  { key: 'daily_practice', label: '每日練習', icon: '📚', url: 'https://drive.google.com/drive/folders/1v6jtYu5wrYJLX1Uqj9W_s2b15-ZK4Ckf' },
  { key: 'listen_recording', label: '聽錄音', icon: '🎧', url: 'https://docs.google.com/document/d/112pPi7ulPzb7Gex3ZDsUFb6E6lhfCgpFrtIuftc0E64/edit?usp=drivesdk' },
  { key: 'ig_story', label: 'IG 限動', icon: '📸', url: 'https://www.instagram.com' },
  { key: 'daily_3_contacts', label: '每日3互動', icon: '👥', special: true, toContacts: true },
]

const WEEKLY_COUNTERS = [
  { key: 'bv_share',      label: 'BV 分享',      mode: 'product' },
  { key: 'ibv_share',     label: 'IBV 分享',     mode: 'product' },
  { key: 'meetup',        label: '見面',          mode: 'contact' },
  { key: 'show_business', label: '展示生意',      mode: 'contact' },
  { key: 'sell_ticket',   label: '賣票',          mode: 'contact' },
  { key: 'stranger',      label: '與陌生人互動',  mode: 'stranger' },
]

const WEEKLY_TASKS = [
  { key: 'contact_referrer', label: '與推薦人聯絡' },
  { key: 'coring', label: 'Coring 培訓' },
]

const MONTH_ITEMS = [
  { key: 'new_product', label: '認識新產品', placeholder: '產品名稱' },
  { key: 'gmtss', label: 'GMTSS 課程', placeholder: '課程名稱' },
]

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - d.getDay())
  return toDateStr(d)
}
function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
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
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
}
function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth()+1}/${d.getDate()} 週${DAYS_ZH[d.getDay()]}`
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

  const [goalModal, setGoalModal] = useState(false)
  const [goalText, setGoalText] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const [socialModal, setSocialModal] = useState(false)

  // 新增記錄 Modal
  const [logModal, setLogModal] = useState(null) // { key, label, counterMode, mode:'week'|'month' }
  const [logDate, setLogDate] = useState(today())
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
    setCheckins(daily)
    setWeekTaskCheckins(weekly)
  }

  async function fetchWeekStatus() {
    const days = getWeekDays(viewDate)
    const { data } = await supabase.from('daily_checkins')
      .select('date,is_done').eq('user_id', user.id).in('date', days)
    const sm = {}
    if (data) days.forEach(d => {
      const dc = data.filter(c => c.date === d)
      if (dc.length === 0) sm[d] = 'none'
      else if (dc.filter(c => c.is_done).length >= DAILY_TASKS.length) sm[d] = 'full'
      else sm[d] = 'partial'
    })
    setWeekStatus(days.map(d => ({ date: d, status: sm[d] || 'none' })))
  }

  async function fetchTodayContacted() {
    const { data } = await supabase.from('contacts').select('name')
      .eq('user_id', user.id).eq('last_contact_date', viewDate).limit(5)
    if (data) setTodayContacted(data.map(c => c.name))
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
    const d = new Date(monthViewDate + 'T00:00:00')
    const me = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()).padStart(2,'0')}`
    const { data } = await supabase.from('counter_logs')
      .select('id,counter_key,date,planned_date,is_done,product_name,note,contact_id,contacts(name)')
      .eq('user_id', user.id)
      .in('counter_key', ['new_product', 'gmtss'])
      .gte('date', ms).lte('date', me)
    setMonthLogs(data || [])
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
    const newDate = toDateStr(d)
    if (newDate <= today()) setViewDate(newDate)
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
    if (task.url) { window.open(task.url, '_blank'); return }
  }

  function openLogModal(key, label, counterMode, mode = 'week') {
    setLogModal({ key, label, counterMode, mode })
    setLogDate(today())
    setLogContact(''); setLogContactId(null)
    setLogStrangerName(''); setLogProduct(''); setLogNote('')
    setContactSearch([])
  }

  async function searchContacts(q) {
    if (!q) { setContactSearch([]); return }
    const { data } = await supabase.from('contacts').select('id,name')
      .eq('user_id', user.id).ilike('name', `%${q}%`).limit(8)
    setContactSearch(data || [])
  }

  async function confirmLog() {
    setLogSaving(true)
    const isFuture = logDate > today()
    await supabase.from('counter_logs').insert({
      user_id: user.id,
      counter_key: logModal.key,
      date: isFuture ? today() : logDate,
      planned_date: isFuture ? logDate : null,
      is_done: !isFuture,
      contact_id: logContactId || null,
      product_name: logModal.counterMode === 'stranger'
        ? (logStrangerName || null)
        : (logProduct || null),
      note: logNote || null,
    })
    setLogSaving(false)
    setLogModal(null)
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
  }

  function changeMonthViewDate(delta) {
    const d = new Date(monthViewDate + 'T00:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonthViewDate(toDateStr(d))
  }

  function getDateOptions() {
    const opts = []
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today() + 'T00:00:00')
      d.setDate(d.getDate() + i)
      opts.push(toDateStr(d))
    }
    return opts
  }

  // 確認按鈕是否可以送出
  function canConfirm() {
    if (!logModal) return false
    if (logModal.mode === 'month') return !!logProduct
    if (logModal.counterMode === 'stranger') return true // 全選填
    return !!logContactId // product / contact 模式必填對象
  }

  const doneCount = DAILY_TASKS.filter(t => checkins[t.key]).length
  const isToday = viewDate === today()
  const weekDays = getWeekDays(weekViewDate)

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:'#9CA3AF' }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2563EB)' }}>
        <div style={{ maxWidth:430,margin:'0 auto',padding:'52px 20px 20px' }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#fff',margin:0 }}>每日行動</h1>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8 }}>
            <button onClick={() => changeDate(-1)}
              style={{ background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',
                width:32,height:32,borderRadius:8,fontSize:18,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:14,color:'#E0F2FE',margin:0,fontWeight:600 }}>
                {formatDateLabel(viewDate)}
              </p>
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

        {/* ── 每日任務 ── */}
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
                  <span style={{ fontSize:11,
                    color: isSelected?'#2563EB':isT?'#3B82F6':'#9CA3AF',
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
            const hasAction = task.url || task.social || task.toContacts || task.key === 'goal_declaration'
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
                      <span style={{ color:'#22C55E',fontWeight:600,marginLeft:6 }}>
                        {todayContacted.join('、')} ✓
                      </span>
                    )}
                  </span>
                  {hasAction && <span style={{ fontSize:12,color:'#9CA3AF',marginLeft:8,flexShrink:0 }}>›</span>}
                </button>
              </div>
            )
          })}
        </div>

        {/* ── 每週行動 ── */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={sectionTitle}>每週行動</span>
          </div>

          {/* 週導航 */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
            background:'#F8FAFC',borderRadius:10,padding:'6px 10px',marginBottom:10 }}>
            <button onClick={() => changeWeekViewDate(-1)}
              style={{ background:'none',border:'none',color:'#6B7280',fontSize:18,cursor:'pointer',padding:'0 4px' }}>‹</button>
            <span style={{ fontSize:13,fontWeight:600,color:'#374151' }}>
              {formatShortDate(weekDays[0])} — {formatShortDate(weekDays[6])}
            </span>
            <button onClick={() => changeWeekViewDate(1)}
              style={{ background:'none',border:'none',
                color: weekDays[6] >= today() ? '#D1D5DB':'#6B7280',
                fontSize:18,cursor: weekDays[6] >= today() ? 'default':'pointer',padding:'0 4px' }}>›</button>
          </div>

          {/* 週點狀圖 */}
          <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 4px',
            background:'#F8FAFC',borderRadius:10,marginBottom:12 }}>
            {weekDays.map((d,i) => {
              const isSelected = d === weekViewDate
              const isT = d === today()
              const isFut = d > today()
              const dayLogs = weekLogs.filter(l => (l.planned_date || l.date) === d)
              const hasDone = dayLogs.some(l => l.is_done)
              const hasPlan = dayLogs.some(l => !l.is_done)
              const dot = hasDone ? '#22C55E' : hasPlan ? '#F59E0B' : '#E5E7EB'
              return (
                <div key={i} onClick={() => setWeekViewDate(d)}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer' }}>
                  <span style={{ fontSize:11,
                    color: isSelected?'#2563EB':isT?'#3B82F6':isFut?'#D1D5DB':'#9CA3AF',
                    fontWeight: isSelected||isT?700:400 }}>
                    {DAYS_ZH[new Date(d+'T00:00:00').getDay()]}
                  </span>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:dot,
                    outline: isSelected?'2px solid #2563EB':isT?'2px solid #3B82F6':'none',
                    outlineOffset:2 }} />
                </div>
              )
            })}
          </div>

          {/* 選中日標題 */}
          <div style={{ fontSize:13,fontWeight:600,color:'#6B7280',marginBottom:8 }}>
            {formatDateLabel(weekViewDate)}
            {weekViewDate > today() && <span style={{ marginLeft:6,fontSize:11,color:'#F59E0B' }}>預排</span>}
          </div>

          {/* 每週 checkbox 任務 */}
          {WEEKLY_TASKS.map(task => {
            const done = !!weekTaskCheckins[task.key]?.[weekViewDate]
            return (
              <div key={task.key} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                borderBottom:'1px solid #F9FAFB' }}>
                <button onClick={() => toggleWeekTask(task.key, weekViewDate)}
                  style={{ width:22,height:22,borderRadius:6,flexShrink:0,
                    border:done?'none':'2px solid #D1D5DB',background:done?'#22C55E':'#fff',
                    display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                  {done&&<span style={{ fontSize:12,color:'#fff' }}>✓</span>}
                </button>
                <span style={{ fontSize:14,color:done?'#9CA3AF':'#374151',
                  textDecoration:done?'line-through':'none',flex:1 }}>{task.label}</span>
              </div>
            )
          })}

          {/* 週計數項目 */}
          {WEEKLY_COUNTERS.map(c => {
            const dayLogs = weekLogs.filter(l =>
              l.counter_key === c.key && (l.planned_date || l.date) === weekViewDate
            )
            const weekTotal = weekLogs.filter(l => l.counter_key === c.key && l.is_done).length
            return (
              <div key={c.key} style={{ padding:'10px 0',borderBottom:'1px solid #F9FAFB' }}>
                <div style={{ display:'flex',alignItems:'center',marginBottom: dayLogs.length>0?8:0 }}>
                  <span style={{ flex:1,fontSize:14,color:'#374151',fontWeight:600 }}>{c.label}</span>
                  <span style={{ fontSize:12,color:'#9CA3AF',marginRight:8 }}>本週 {weekTotal} 次</span>
                  <button onClick={() => openLogModal(c.key, c.label, c.mode, 'week')}
                    style={{ ...counterBtn,background:'#2563EB',color:'#fff' }}>+</button>
                </div>
                {dayLogs.length > 0 ? (
                  <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                    {dayLogs.map(log => {
                      const displayName = c.mode === 'stranger'
                        ? (log.product_name || '陌生人')
                        : (log.contacts?.name || '—')
                      return (
                        <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                          background: log.is_done?'#F0FDF4':'#FFFBEB',borderRadius:8,padding:'7px 10px' }}>
                          <span style={{ fontSize:13 }}>{log.is_done ? '✅' : '📅'}</span>
                          <div style={{ flex:1,minWidth:0 }}>
                            <span style={{ fontSize:13,color:'#374151',fontWeight:600 }}>{displayName}</span>
                            {c.mode === 'product' && log.product_name && (
                              <span style={{ fontSize:12,color:'#6B7280',marginLeft:6 }}>{log.product_name}</span>
                            )}
                            {log.note && (
                              <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>{log.note}</p>
                            )}
                          </div>
                          {!log.is_done && (
                            <button onClick={() => confirmDone(log)}
                              style={{ fontSize:12,color:'#16A34A',background:'none',border:'none',
                                cursor:'pointer',fontWeight:600,whiteSpace:'nowrap' }}>完成</button>
                          )}
                          <button onClick={() => deleteLog(log.id, 'week')}
                            style={{ fontSize:12,color:'#EF4444',background:'none',border:'none',cursor:'pointer' }}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize:12,color:'#D1D5DB',margin:'2px 0 0' }}>這天沒有記錄</p>
                )}
              </div>
            )
          })}
        </div>

        {/* ── 每月目標 ── */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={sectionTitle}>每月目標</span>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <button onClick={() => changeMonthViewDate(-1)}
                style={{ background:'none',border:'none',color:'#6B7280',fontSize:18,cursor:'pointer' }}>‹</button>
              <span style={{ fontSize:13,fontWeight:600,color:'#374151' }}>
                {new Date(monthViewDate+'T00:00:00').toLocaleDateString('zh-TW',{year:'numeric',month:'long'})}
              </span>
              <button onClick={() => changeMonthViewDate(1)}
                style={{ background:'none',border:'none',
                  color: monthViewDate.slice(0,7) >= today().slice(0,7) ? '#D1D5DB':'#6B7280',
                  fontSize:18,cursor: monthViewDate.slice(0,7) >= today().slice(0,7) ? 'default':'pointer' }}>›</button>
            </div>
          </div>

          {MONTH_ITEMS.map(item => {
            const logs = monthLogs.filter(l => l.counter_key === item.key)
            const doneCount = logs.filter(l => l.is_done).length
            return (
              <div key={item.key} style={{ padding:'12px 0',borderBottom:'1px solid #F9FAFB' }}>
                <div style={{ display:'flex',alignItems:'center',marginBottom: logs.length>0?8:0 }}>
                  <span style={{ flex:1,fontSize:14,color:'#374151',fontWeight:600 }}>{item.label}</span>
                  <span style={{ fontSize:12,color:'#9CA3AF',marginRight:8 }}>完成 {doneCount} 次</span>
                  <button onClick={() => openLogModal(item.key, item.label, 'month_item', 'month')}
                    style={{ ...counterBtn,background:'#2563EB',color:'#fff' }}>+</button>
                </div>
                {logs.length > 0 ? (
                  <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                    {logs.map(log => {
                      const displayDate = log.planned_date || log.date
                      return (
                        <div key={log.id} style={{ display:'flex',alignItems:'center',gap:8,
                          background: log.is_done?'#F0FDF4':'#FFFBEB',borderRadius:8,padding:'7px 10px' }}>
                          <span style={{ fontSize:13 }}>{log.is_done ? '✅' : '📅'}</span>
                          <div style={{ flex:1,minWidth:0 }}>
                            <span style={{ fontSize:13,color:'#374151',fontWeight:600 }}>
                              {log.product_name || '—'}
                            </span>
                            <span style={{ fontSize:12,color:'#9CA3AF',marginLeft:6 }}>
                              {formatShortDate(displayDate)}
                            </span>
                            {log.note && (
                              <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>{log.note}</p>
                            )}
                          </div>
                          {!log.is_done && (
                            <button onClick={() => confirmDone(log)}
                              style={{ fontSize:12,color:'#16A34A',background:'none',border:'none',
                                cursor:'pointer',fontWeight:600,whiteSpace:'nowrap' }}>完成</button>
                          )}
                          <button onClick={() => deleteLog(log.id, 'month')}
                            style={{ fontSize:12,color:'#EF4444',background:'none',border:'none',cursor:'pointer' }}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize:12,color:'#D1D5DB',margin:'2px 0 0' }}>這個月還沒有記錄</p>
                )}
              </div>
            )
          })}
        </div>

      </div>

      {/* ── 目標宣言 Modal ── */}
      {goalModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setGoalModal(false) }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',padding:24,width:'100%',maxWidth:430 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:'#111827',margin:0 }}>🎯 我的目標宣言</h3>
              <button onClick={() => setGoalModal(false)}
                style={{ background:'none',border:'none',fontSize:20,color:'#9CA3AF',cursor:'pointer' }}>✕</button>
            </div>
            <textarea value={goalText} onChange={e => setGoalText(e.target.value)}
              placeholder="寫下你的目標宣言，每天提醒自己為什麼出發..."
              style={{ width:'100%',minHeight:120,padding:'12px',borderRadius:10,
                border:'1px solid #D1D5DB',fontSize:15,boxSizing:'border-box',
                outline:'none',resize:'vertical',lineHeight:1.6 }} />
            <button onClick={saveGoalText} disabled={goalSaving}
              style={{ width:'100%',padding:'13px',borderRadius:12,border:'none',
                background: goalSaved?'#22C55E':goalSaving?'#93C5FD':'#2563EB',
                color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:12 }}>
              {goalSaved ? '✓ 已儲存' : goalSaving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}

      {/* ── 社群連結 Modal ── */}
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
            <div style={{ display:'flex',gap:12,marginBottom:8 }}>
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

      {/* ── 新增記錄 Modal ── */}
      {logModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setLogModal(null) }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:'#111827',margin:0 }}>
                {logModal.label} — 新增記錄
              </h3>
              <button onClick={() => setLogModal(null)}
                style={{ background:'none',border:'none',fontSize:20,color:'#9CA3AF',cursor:'pointer' }}>✕</button>
            </div>

            {/* 日期選擇 */}
            <div style={{ marginBottom:16 }}>
              <label style={labelStyle}>日期</label>
              <div style={{ display:'flex',gap:6,overflowX:'auto',paddingBottom:4 }}>
                {getDateOptions().map(d => {
                  const isFut = d > today()
                  const isSelected = logDate === d
                  return (
                    <button key={d} onClick={() => setLogDate(d)}
                      style={{ flexShrink:0,padding:'6px 10px',borderRadius:8,fontSize:12,
                        fontWeight: isSelected?700:400,cursor:'pointer',
                        border: isSelected?'2px solid #2563EB':'1px solid #E5E7EB',
                        background: isSelected?(isFut?'#FFFBEB':'#EFF6FF'):'#F9FAFB',
                        color: isSelected?(isFut?'#B45309':'#1D4ED8'):'#6B7280' }}>
                      {d === today() ? '今天' : formatShortDate(d)}{isFut ? ' 📅' : ''}
                    </button>
                  )
                })}
              </div>
              {logDate > today() && (
                <p style={{ fontSize:12,color:'#F59E0B',margin:'6px 0 0',fontWeight:600 }}>
                  📅 預排模式：儲存後顯示為「待完成」
                </p>
              )}
            </div>

            {/* A: product 模式 — 對象(必填) + 產品(選填) */}
            {logModal.counterMode === 'product' && (
              <>
                <div style={{ marginBottom:16 }}>
                  <label style={labelStyle}>分享對象 <span style={{ color:'#EF4444' }}>必填</span></label>
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
                <div style={{ marginBottom:16 }}>
                  <label style={labelStyle}>分享產品 <span style={{ color:'#9CA3AF',fontSize:12 }}>選填</span></label>
                  <input placeholder="輸入產品名稱..." value={logProduct}
                    onChange={e => setLogProduct(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}

            {/* B: contact 模式 — 對象(必填) */}
            {logModal.counterMode === 'contact' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>對象 <span style={{ color:'#EF4444' }}>必填</span></label>
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

            {/* C: stranger 模式 — 姓名(選填) */}
            {logModal.counterMode === 'stranger' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>姓名 <span style={{ color:'#9CA3AF',fontSize:12 }}>選填，不認識可不填</span></label>
                <input placeholder="例：捷運旁的阿姨、咖啡廳客人…" value={logStrangerName}
                  onChange={e => setLogStrangerName(e.target.value)} style={inputStyle} />
              </div>
            )}

            {/* D: month 模式 — 名稱(必填) */}
            {logModal.counterMode === 'month_item' && (
              <div style={{ marginBottom:16 }}>
                <label style={labelStyle}>
                  {MONTH_ITEMS.find(i=>i.key===logModal.key)?.placeholder || '名稱'}
                  <span style={{ color:'#EF4444' }}> 必填</span>
                </label>
                <input placeholder="請輸入名稱..." value={logProduct}
                  onChange={e => setLogProduct(e.target.value)} style={inputStyle} />
              </div>
            )}

            {/* 備註（所有模式都有） */}
            <div style={{ marginBottom:20 }}>
              <label style={labelStyle}>備註 <span style={{ color:'#9CA3AF',fontSize:12 }}>選填</span></label>
              <textarea placeholder="記錄重點..." value={logNote}
                onChange={e => setLogNote(e.target.value)}
                style={{ ...inputStyle,height:72,resize:'none' }} />
            </div>

            <button onClick={confirmLog} disabled={logSaving || !canConfirm()}
              style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
                background: canConfirm() ? '#2563EB':'#D1D5DB',
                color:'#fff',fontSize:15,fontWeight:700,
                cursor: canConfirm() ? 'pointer':'not-allowed' }}>
              {logSaving ? '儲存中…' : logDate > today() ? '📅 預排' : '確認儲存'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const card = { background:'#fff',borderRadius:16,padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }
const sectionTitle = { fontSize:15,fontWeight:700,color:'#111827' }
const counterBtn = {
  width:30,height:30,borderRadius:8,border:'1px solid #E5E7EB',
  background:'#F9FAFB',color:'#374151',fontSize:16,
  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,
}
const labelStyle = { fontSize:13,color:'#374151',fontWeight:600,display:'block',marginBottom:6 }
const inputStyle = {
  width:'100%',padding:'10px 12px',borderRadius:10,
  border:'1px solid #D1D5DB',fontSize:15,boxSizing:'border-box',outline:'none',
}