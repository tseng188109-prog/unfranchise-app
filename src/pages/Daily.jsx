import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DAYS_ZH = ['日','一','二','三','四','五','六']
function today() { return new Date().toISOString().split('T')[0] }

const DAILY_TASKS = [
  { key: 'goal_declaration', label: '目標宣言' },
  { key: 'ig_story', label: 'IG 限動' },
  { key: 'daily_3_contacts', label: '每日3互動', special: true },
  { key: 'daily_practice', label: '每日練習' },
  { key: 'listen_recording', label: '聽錄音' },
  { key: 'backend_announcement', label: '後台公告' },
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

function getWeekStart() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().split('T')[0]
}

export default function Daily() {
  const [user, setUser] = useState(null)
  const [checkins, setCheckins] = useState({})
  const [weekCheckins, setWeekCheckins] = useState({})
  const [counters, setCounters] = useState({})
  const [goals, setGoals] = useState({})
  const [weekStatus, setWeekStatus] = useState([])
  const [todayContacted, setTodayContacted] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchCheckins(), fetchWeekStatus(), fetchCounters(), fetchTodayContacted()])
    setLoading(false)
  }

  async function fetchCheckins() {
    const { data } = await supabase.from('daily_checkins')
      .select('task_key,is_done,date').eq('user_id', user.id)
      .gte('date', getWeekStart())
    if (!data) return
    const daily = {}, weekly = {}
    data.forEach(d => {
      if (d.date === today()) daily[d.task_key] = d.is_done
      if (WEEKLY_TASKS.find(t => t.key === d.task_key)) weekly[d.task_key] = d.is_done
    })
    setCheckins(daily)
    setWeekCheckins(weekly)
  }

  async function fetchWeekStatus() {
    const now = new Date()
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(now.getDate() - now.getDay() + i)
      days.push(d.toISOString().split('T')[0])
    }
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
    const ws = getWeekStart()
    const { data } = await supabase.from('weekly_counters')
      .select('counter_key,count,goal').eq('user_id', user.id).eq('week_start', ws)
    const c = {}, g = {}
    if (data) data.forEach(d => { c[d.counter_key] = d.count; g[d.counter_key] = d.goal })
    setCounters(c)
    setGoals(g)
  }

  async function fetchTodayContacted() {
    const { data } = await supabase.from('contacts').select('name')
      .eq('user_id', user.id).eq('last_contact_date', today()).limit(5)
    if (data) setTodayContacted(data.map(c => c.name))
  }

  async function toggleCheckin(key, isWeekly = false) {
    const cur = isWeekly ? weekCheckins[key] : checkins[key]
    const nv = !cur
    if (isWeekly) setWeekCheckins(p => ({ ...p, [key]: nv }))
    else setCheckins(p => ({ ...p, [key]: nv }))

    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: today(), task_key: key, is_done: nv,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
  }

  async function adjustCounter(key, delta) {
    const cur = counters[key] || 0
    const nv = Math.max(0, cur + delta)
    setCounters(p => ({ ...p, [key]: nv }))
    const ws = getWeekStart()
    await supabase.from('weekly_counters').upsert({
      user_id: user.id, week_start: ws, counter_key: key,
      count: nv, goal: goals[key] || 0,
    }, { onConflict: 'user_id,week_start,counter_key' })
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
          <p style={{ fontSize:13,color:'#93C5FD',margin:'4px 0 0' }}>
            {new Date().toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'})}
          </p>
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
              const isT = w.date === today()
              const dc = w.status==='full'?'#22C55E':w.status==='partial'?'#F97316':'#E5E7EB'
              return (
                <div key={i} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                  <span style={{ fontSize:11,color:isT?'#3B82F6':'#9CA3AF',fontWeight:isT?700:400 }}>
                    {DAYS_ZH[new Date(w.date+'T00:00:00').getDay()]}
                  </span>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:dc,
                    outline:isT?'2px solid #3B82F6':'none',outlineOffset:2 }} />
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
                  <button onClick={() => adjustCounter(c.key, -1)}
                    style={counterBtn}>−</button>
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

      </div>
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