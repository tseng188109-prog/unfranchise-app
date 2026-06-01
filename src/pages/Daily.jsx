import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DAYS_ZH = ['日','一','二','三','四','五','六']
function toDateStr(d) { return d.toISOString().split('T')[0] }
function today() { return toDateStr(new Date()) }

const DAILY_TASKS = [
  { key: 'goal_declaration', label: '目標宣言' },
  { key: 'backend_announcement', label: '後台公告/管理報告' },
  { key: 'respond_social', label: '回應臉書IDEA/LINE' },
  { key: 'daily_practice', label: '每日練習' },
  { key: 'listen_recording', label: '聽錄音' },
  { key: 'ig_story', label: 'IG 限動' },
  { key: 'daily_3_contacts', label: '每日3互動', special: true },
]

const WEEKLY_COUNTERS = [
  { key: 'daily_3_contacts', label: '每日3互動' },
  { key: 'bv_share', label: 'BV 分享' },
  { key: 'ibv_share', label: 'IBV 分享' },
  { key: 'meetup', label: '見面' },
  { key: 'show_business', label: '展示生意' },
  { key: 'sell_ticket', label: '賣票' },
  { key: 'stranger', label: '與陌生人互動' },
]

const WEEKLY_TASKS = [
  { key: 'contact_referrer', label: '與推薦人聯絡' },
  { key: 'coring', label: 'Coring 培訓' },
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

export default function Daily() {
  const [user, setUser] = useState(null)
  const [viewDate, setViewDate] = useState(today())
  const [checkins, setCheckins] = useState({})
  const [weekCheckins, setWeekCheckins] = useState({})
  const [counters, setCounters] = useState({})
  const [goals, setGoals] = useState({})
  const [weekStatus, setWeekStatus] = useState([])
  const [todayContacted, setTodayContacted] = useState([])
  const [monthGoals, setMonthGoals] = useState({ new_product: 0, gmtss: 0 })
  const [monthProgress, setMonthProgress] = useState({ new_product: 0, gmtss: 0 })
  const [editingMonth, setEditingMonth] = useState(false)
  const [monthGoalInput, setMonthGoalInput] = useState({ new_product: '', gmtss: '' })
  const [loading, setLoading] = useState(true)

  const isToday = viewDate === today()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchAll() }, [user, viewDate])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchCheckins(), fetchWeekStatus(), fetchCounters(), fetchTodayContacted(), fetchMonthGoals()])
    setLoading(false)
  }

  async function fetchCheckins() {
    const ws = getWeekStart(viewDate)
    const { data } = await supabase.from('daily_checkins')
      .select('task_key,is_done,date').eq('user_id', user.id)
      .gte('date', ws)
    if (!data) return
    const daily = {}, weekly = {}
    data.forEach(d => {
      if (d.date === viewDate) daily[d.task_key] = d.is_done
      if (WEEKLY_TASKS.find(t => t.key === d.task_key)) weekly[d.task_key] = d.is_done
    })
    setCheckins(daily)
    setWeekCheckins(weekly)
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

  async function fetchCounters() {
    const ws = getWeekStart(viewDate)
    const { data } = await supabase.from('weekly_counters')
      .select('counter_key,count,goal').eq('user_id', user.id).eq('week_start', ws)
    const c = {}, g = {}
    if (data) data.forEach(d => { c[d.counter_key] = d.count; g[d.counter_key] = d.goal })
    setCounters(c)
    setGoals(g)
  }

  async function fetchTodayContacted() {
    const { data } = await supabase.from('contacts').select('name')
      .eq('user_id', user.id).eq('last_contact_date', viewDate).limit(5)
    if (data) setTodayContacted(data.map(c => c.name))
  }

  async function fetchMonthGoals() {
    const ms = getMonthStart(viewDate)
    const { data } = await supabase.from('weekly_counters')
      .select('counter_key,count,goal').eq('user_id', user.id)
      .eq('week_start', ms).in('counter_key', ['new_product', 'gmtss'])
    if (data) {
      const g = { new_product: 0, gmtss: 0 }
      const p = { new_product: 0, gmtss: 0 }
      data.forEach(d => { g[d.counter_key] = d.goal; p[d.counter_key] = d.count })
      setMonthGoals(g)
      setMonthProgress(p)
    }
  }

  function changeDate(delta) {
    const d = new Date(viewDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    const newDate = toDateStr(d)
    if (newDate <= today()) setViewDate(newDate)
  }

  async function toggleCheckin(key, isWeekly = false) {
    const cur = isWeekly ? weekCheckins[key] : checkins[key]
    const nv = !cur
    if (isWeekly) setWeekCheckins(p => ({ ...p, [key]: nv }))
    else setCheckins(p => ({ ...p, [key]: nv }))
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: viewDate, task_key: key, is_done: nv,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
  }

  async function adjustCounter(key, delta) {
    const cur = counters[key] || 0
    const nv = Math.max(0, cur + delta)
    setCounters(p => ({ ...p, [key]: nv }))
    const ws = getWeekStart(viewDate)
    await supabase.from('weekly_counters').upsert({
      user_id: user.id, week_start: ws, counter_key: key,
      count: nv, goal: goals[key] || 0,
    }, { onConflict: 'user_id,week_start,counter_key' })
  }

  async function adjustMonthProgress(key, delta) {
    const cur = monthProgress[key] || 0
    const nv = Math.max(0, cur + delta)
    setMonthProgress(p => ({ ...p, [key]: nv }))
    const ms = getMonthStart(viewDate)
    await supabase.from('weekly_counters').upsert({
      user_id: user.id, week_start: ms, counter_key: key,
      count: nv, goal: monthGoals[key] || 0,
    }, { onConflict: 'user_id,week_start,counter_key' })
  }

  async function saveMonthGoals() {
    const ms = getMonthStart(viewDate)
    const ng = {
      new_product: parseInt(monthGoalInput.new_product) || monthGoals.new_product,
      gmtss: parseInt(monthGoalInput.gmtss) || monthGoals.gmtss,
    }
    setMonthGoals(ng)
    setEditingMonth(false)
    for (const key of ['new_product', 'gmtss']) {
      await supabase.from('weekly_counters').upsert({
        user_id: user.id, week_start: ms, counter_key: key,
        count: monthProgress[key] || 0, goal: ng[key],
      }, { onConflict: 'user_id,week_start,counter_key' })
    }
  }

  const doneCount = DAILY_TASKS.filter(t => checkins[t.key]).length

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

          {/* 日期切換列 */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8 }}>
            <button onClick={() => changeDate(-1)}
              style={{ background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',
                width:32,height:32,borderRadius:8,fontSize:18,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>

            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:14,color:'#E0F2FE',margin:0,fontWeight:600 }}>
                {formatDateLabel(viewDate)}
              </p>
              {!isToday && (
                <span style={{ fontSize:11,color:'#FCD34D',fontWeight:600 }}>補打模式</span>
              )}
            </div>

            <button onClick={() => changeDate(1)}
              style={{ background: isToday ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
                border:'none',color: isToday ? 'rgba(255,255,255,0.3)' : '#fff',
                width:32,height:32,borderRadius:8,fontSize:18,cursor: isToday ? 'default' : 'pointer',
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

        {/* 每日任務 */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={sectionTitle}>每日任務</span>
            <span style={{ fontSize:13,color:'#6B7280' }}>{doneCount}/{DAILY_TASKS.length}</span>
          </div>

          {/* 週點狀 */}
          <div style={{ display:'flex',justifyContent:'space-between',padding:'8px',
            background:'#F8FAFC',borderRadius:10,marginBottom:10 }}>
            {weekStatus.map((w,i) => {
              const isSelected = w.date === viewDate
              const isT = w.date === today()
              const dc = w.status==='full'?'#22C55E':w.status==='partial'?'#F97316':'#E5E7EB'
              return (
                <div key={i} onClick={() => { if (w.date <= today()) setViewDate(w.date) }}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                    cursor: w.date <= today() ? 'pointer' : 'default' }}>
                  <span style={{ fontSize:11,
                    color: isSelected ? '#2563EB' : isT ? '#3B82F6' : '#9CA3AF',
                    fontWeight: isSelected || isT ? 700 : 400 }}>
                    {DAYS_ZH[new Date(w.date+'T00:00:00').getDay()]}
                  </span>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:dc,
                    outline: isSelected ? '2px solid #2563EB' : isT ? '2px solid #3B82F6' : 'none',
                    outlineOffset:2 }} />
                </div>
              )
            })}
          </div>

          {DAILY_TASKS.map(task => {
            const done = !!checkins[task.key]
            return (
              <button key={task.key} onClick={() => toggleCheckin(task.key)}
                style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                  borderBottom:'1px solid #F9FAFB',background:'none',border:'none',
                  width:'100%',textAlign:'left',cursor:'pointer' }}>
                <div style={{ width:22,height:22,borderRadius:6,flexShrink:0,
                  border:done?'none':'2px solid #D1D5DB',background:done?'#22C55E':'#fff',
                  display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}>
                  {done&&<span style={{ fontSize:12,color:'#fff' }}>✓</span>}
                </div>
                <span style={{ fontSize:14,color:done?'#9CA3AF':'#374151',
                  textDecoration:done?'line-through':'none',flex:1 }}>
                  {task.label}
                  {task.special&&todayContacted.length>0&&(
                    <span style={{ color:'#22C55E',fontWeight:600,marginLeft:6 }}>
                      {todayContacted.join('、')} ✓
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* 週目標計數器 */}
        <div style={card}>
          <span style={{ ...sectionTitle, display:'block', marginBottom:12 }}>週目標計數器</span>
          {WEEKLY_COUNTERS.map(c => {
            const count = counters[c.key] || 0
            const goal = goals[c.key] || 0
            return (
              <div key={c.key} style={{ display:'flex',alignItems:'center',
                padding:'10px 0',borderBottom:'1px solid #F9FAFB' }}>
                <span style={{ flex:1,fontSize:14,color:'#374151' }}>{c.label}</span>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <span style={{ fontSize:13,color:'#9CA3AF',minWidth:40,textAlign:'right' }}>
                    {count}/{goal||'—'}
                  </span>
                  <button onClick={() => adjustCounter(c.key, -1)} style={counterBtn}>−</button>
                  <button onClick={() => adjustCounter(c.key, 1)}
                    style={{ ...counterBtn,background:'#2563EB',color:'#fff' }}>+</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 每週任務 */}
        <div style={card}>
          <span style={{ ...sectionTitle, display:'block', marginBottom:12 }}>每週任務</span>
          {WEEKLY_TASKS.map(task => {
            const done = !!weekCheckins[task.key]
            return (
              <button key={task.key} onClick={() => toggleCheckin(task.key, true)}
                style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                  borderBottom:'1px solid #F9FAFB',background:'none',border:'none',
                  width:'100%',textAlign:'left',cursor:'pointer' }}>
                <div style={{ width:22,height:22,borderRadius:6,flexShrink:0,
                  border:done?'none':'2px solid #D1D5DB',background:done?'#22C55E':'#fff',
                  display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {done&&<span style={{ fontSize:12,color:'#fff' }}>✓</span>}
                </div>
                <span style={{ fontSize:14,color:done?'#9CA3AF':'#374151',
                  textDecoration:done?'line-through':'none' }}>{task.label}</span>
              </button>
            )
          })}
        </div>

        {/* 每月目標 */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={sectionTitle}>每月目標</span>
            <button onClick={() => {
              setMonthGoalInput({ new_product: String(monthGoals.new_product), gmtss: String(monthGoals.gmtss) })
              setEditingMonth(true)
            }} style={{ fontSize:13,color:'#2563EB',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
              編輯
            </button>
          </div>

          {[
            { key:'new_product', label:'認識新產品', unit:'樣' },
            { key:'gmtss', label:'GMTSS 課程', unit:'次' },
          ].map(item => (
            <div key={item.key} style={{ display:'flex',alignItems:'center',
              padding:'10px 0',borderBottom:'1px solid #F9FAFB' }}>
              <span style={{ flex:1,fontSize:14,color:'#374151' }}>{item.label}</span>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <span style={{ fontSize:13,color:'#9CA3AF',minWidth:50,textAlign:'right' }}>
                  {monthProgress[item.key]}/{monthGoals[item.key]||'—'} {item.unit}
                </span>
                <button onClick={() => adjustMonthProgress(item.key, -1)} style={counterBtn}>−</button>
                <button onClick={() => adjustMonthProgress(item.key, 1)}
                  style={{ ...counterBtn,background:'#2563EB',color:'#fff' }}>+</button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* 每月目標編輯 Modal */}
      {editingMonth && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',padding:24,
            width:'100%',maxWidth:430 }}>
            <h3 style={{ fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 16px' }}>設定每月目標</h3>
            {[
              { key:'new_product', label:'認識新產品（樣）' },
              { key:'gmtss', label:'GMTSS 課程（次）' },
            ].map(item => (
              <div key={item.key} style={{ marginBottom:16 }}>
                <label style={{ fontSize:13,color:'#6B7280',display:'block',marginBottom:4 }}>{item.label}</label>
                <input type="number" min="0"
                  value={monthGoalInput[item.key]}
                  onChange={e => setMonthGoalInput(p => ({ ...p, [item.key]: e.target.value }))}
                  style={{ width:'100%',padding:'10px 12px',borderRadius:10,
                    border:'1px solid #D1D5DB',fontSize:15,boxSizing:'border-box' }}
                />
              </div>
            ))}
            <div style={{ display:'flex',gap:10,marginTop:8 }}>
              <button onClick={() => setEditingMonth(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:15,cursor:'pointer',color:'#6B7280' }}>取消</button>
              <button onClick={saveMonthGoals}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#2563EB',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card = {
  background:'#fff',borderRadius:16,padding:'16px',
  boxShadow:'0 1px 3px rgba(0,0,0,0.07)',
}
const sectionTitle = { fontSize:15,fontWeight:700,color:'#111827' }
const counterBtn = {
  width:30,height:30,borderRadius:8,border:'1px solid #E5E7EB',
  background:'#F9FAFB',color:'#374151',fontSize:16,
  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
  fontWeight:700,
}