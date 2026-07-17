import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import {
  IconSettings, IconRocket, IconUsers, IconChartBar, IconSearch,
  IconTarget, IconSpeakerphone, IconMessageCircle, IconBook,
  IconHeadphones, IconCamera, IconTrendingUp, IconChevronRight,
} from '@tabler/icons-react'

const BV_GOAL = 1500
const IBV_GOAL = 300
const DAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']

// 設計系統色碼
const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_YELLOW = '#FFD166'
const ACCENT_YELLOW_SOFT = '#FFF7E6'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const ACCENT_PINK = '#F45DA8'
const ACCENT_PINK_SOFT = '#FDE8F3'
const ACCENT_PINK_TEXT = '#D23E8C'
const DANGER = '#E0454A'
const DANGER_SOFT = '#FDE2E2'
const CARD_BG = '#fff'
const PAGE_BG = '#fff'
const SUBCARD_BG = '#F5F8FC'

const DAILY_TASKS = [
  { key: 'goal_declaration', label: '目標宣言', Icon: IconTarget },
  { key: 'backend_announcement', label: '後台公告/管理報告', Icon: IconSpeakerphone, url: 'https://tw.unfranchise.com' },
  { key: 'respond_social', label: '回應臉書IDEA/LINE', Icon: IconMessageCircle, social: true },
  { key: 'daily_practice', label: '每日練習', Icon: IconBook, internalPath: '/daily-practice' },
  { key: 'listen_recording', label: '聽錄音', Icon: IconHeadphones, internalPath: '/recording' },
  { key: 'ig_story', label: 'IG 限動', Icon: IconCamera, url: 'https://www.instagram.com' },
  { key: 'daily_3_contacts', label: '每日3互動', Icon: IconUsers, special: true, toContacts: true },
]

const STARTER_TASKS = [
  { id: 'has_contact',      label: '新增第一筆互動名單',     Icon: IconUsers },
  { id: 'has_checkin',      label: '完成一次打卡',           Icon: IconTarget },
  { id: 'week3_checkin',    label: '一週內累積打卡 3 天',    Icon: IconTrendingUp },
  { id: 'has_log',          label: '新增第一筆互動紀錄',     Icon: IconMessageCircle },
  { id: 'has_declaration',  label: '設定你的目標宣言',       Icon: IconTarget },
]

function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const diff = (dow + 1) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - diff)
  const days = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(toDateStr(day))
  }
  return days
}

function formatFollowDate(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((new Date(today()) - new Date(dateStr)) / 86400000)
  if (diff === 0) return '今天到期'
  if (diff > 0) return `逾期${diff}天`
  return `${Math.abs(diff)}天後`
}
function isOverdue(d) { return d && d < today() }
function isDueToday(d) { return d === today() }
function getEggColor(t) { return t==='茶葉蛋'?'#F97316':t==='荷包蛋'?'#3B82F6':t==='生雞蛋'?'#22C55E':'#9CA3AF' }
function getEggBg(t) { return t==='茶葉蛋'?'#FFF7ED':t==='荷包蛋'?'#EFF6FF':t==='生雞蛋'?'#F0FDF4':'#F9FAFB' }
function avatarBg(name) {
  const colors=['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n=0; for(let i=0;i<(name||'').length;i++) n+=name.charCodeAt(i)
  return colors[n%colors.length]
}
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
}

function Avatar({ name, size=36 }) {
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',background:avatarBg(name||''),
      display:'flex',alignItems:'center',justifyContent:'center',
      color:'#fff',fontWeight:700,fontSize:size*0.42,flexShrink:0 }}>
      {name?name[0]:'?'}
    </div>
  )
}
function ProgressBar({ value, max, color, trackColor }) {
  const pct = max>0 ? Math.min((value/max)*100,100) : 0
  return (
    <div style={{ background:trackColor||'#F3F4F6',borderRadius:999,height:8,overflow:'hidden' }}>
      <div style={{ width:`${pct}%`,height:'100%',borderRadius:999,background:color,
        transition:'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </div>
  )
}
function QuickBtn({ Icon, label, onClick, color, bg }) {
  return (
    <button onClick={onClick}
      onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
      onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
      style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:8,
        padding:'14px 4px',borderRadius:18,border:'none',
        background:bg,cursor:'pointer',transition:'all 0.15s' }}>
      <div style={{ width:32,height:32,borderRadius:10,background:'rgba(255,255,255,0.65)',
        display:'flex',alignItems:'center',justifyContent:'center' }}>
        <Icon size={16} stroke={1.9} color={color} />
      </div>
      <span style={{ fontSize:12,fontWeight:700,color:TEXT_MAIN,whiteSpace:'nowrap' }}>{label}</span>
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [bvTotal, setBvTotal] = useState(0)
  const [ibvTotal, setIbvTotal] = useState(0)
  const [profit, setProfit] = useState(0)
  const [overdueContacts, setOverdueContacts] = useState([])
  const [todayDueContacts, setTodayDueContacts] = useState([])
  const [checkins, setCheckins] = useState({})
  const [viewContacted, setViewContacted] = useState([])
  const [checkTotal, setCheckTotal] = useState(0)
  const [weekStatus, setWeekStatus] = useState([])
  const [viewDate, setViewDate] = useState(today())
  const [loading, setLoading] = useState(true)

  const [goalModal, setGoalModal] = useState(false)
  const [goalText, setGoalText] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const [socialModal, setSocialModal] = useState(false)
  const goalTextareaRef = useRef(null)

  const [starterTasks, setStarterTasks] = useState(null)
  const [starterExpanded, setStarterExpanded] = useState(true)
  const [onboardingDone, setOnboardingDone] = useState(true)

  const isToday = viewDate === today()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchAll() }, [user])

  useEffect(() => {
    if (user) {
      fetchCheckin()
      fetchWeekStatus()
      fetchViewContacted()
    }
  }, [user, viewDate])

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
      fetchProfile(), fetchMonthlyStats(), fetchFollowUps(),
      fetchCheckin(), fetchWeekStatus(), fetchViewContacted(),
      fetchGoalText(), fetchStarterTasks()
    ])
    setLoading(false)
  }

  async function fetchProfile() {
    const { data } = await supabase.from('users')
      .select('name, onboarding_done')
      .eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setOnboardingDone(data.onboarding_done === true)
    }
  }

  async function fetchGoalText() {
    const { data } = await supabase.from('users').select('goal_declaration').eq('id', user.id).single()
    if (data?.goal_declaration) setGoalText(data.goal_declaration)
  }

  async function fetchStarterTasks() {
    const todayStr = today()
    const { count: contactCount } = await supabase
      .from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    // 「完成一次打卡」是一次性成就，只要史上曾經打過卡就算完成，不限定「今天」
    // （原本寫成查「今天」，會導致隔天沒打卡任務又重新變成未完成，永遠卡住）
    const { data: everCheckin } = await supabase
      .from('daily_checkins').select('id')
      .eq('user_id', user.id).eq('is_done', true).limit(1)
    const sevenDaysAgo = toDateStr(new Date(Date.now() - 6 * 86400000))
    const { data: weekCheckins } = await supabase
      .from('daily_checkins').select('date')
      .eq('user_id', user.id).eq('is_done', true)
      .gte('date', sevenDaysAgo).lte('date', todayStr)
    const uniqueDays = new Set((weekCheckins || []).map(r => r.date)).size
    const { count: logCount } = await supabase
      .from('contact_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const { data: userData } = await supabase
      .from('users').select('goal_declaration, onboarding_done').eq('id', user.id).single()
    const tasks = {
      has_contact:     (contactCount || 0) > 0,
      has_checkin:     (everCheckin || []).length > 0,
      week3_checkin:   uniqueDays >= 3,
      has_log:         (logCount || 0) > 0,
      has_declaration: !!(userData?.goal_declaration?.trim()),
    }
    setOnboardingDone(userData?.onboarding_done === true)
    setStarterTasks(tasks)
    const doneCount = Object.values(tasks).filter(Boolean).length
    if (doneCount >= 3) setStarterExpanded(false)
  }

  async function fetchMonthlyStats() {
    const now = new Date()
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    const quarterStart = `${now.getFullYear()}-${String(quarterStartMonth+1).padStart(2,'0')}-01`
    const { data } = await supabase.from('transactions').select('type,points,amount,cost')
      .eq('user_id',user.id).gte('date',quarterStart)
    if (!data) return
    let bv=0,ibv=0,p=0
    data.forEach(t => {
      if(t.type==='BV') bv+=t.points
      if(t.type==='IBV') ibv+=t.points
      p += (t.amount||0)-(t.cost||0)
    })
    setBvTotal(bv); setIbvTotal(ibv); setProfit(p)
  }

  async function fetchFollowUps() {
    const { data } = await supabase.from('contacts')
      .select('id,name,occupation,egg_type,action_type,next_contact_date')
      .eq('user_id',user.id).eq('is_archived',false)
      .lte('next_contact_date',today()).order('next_contact_date',{ascending:true}).limit(20)
    if (!data) return
    setTodayDueContacts(data.filter(c=>isDueToday(c.next_contact_date)))
    setOverdueContacts(data.filter(c=>isOverdue(c.next_contact_date)))
  }

  async function fetchCheckin() {
    const { data } = await supabase.from('daily_checkins')
      .select('task_key,is_done').eq('user_id',user.id).eq('date',viewDate)
    const map={}
    if(data) data.forEach(d=>{ map[d.task_key]=d.is_done })
    setCheckins(map)
    setCheckTotal(data ? data.filter(d => d.is_done && DAILY_TASKS.some(t => t.key === d.task_key)).length : 0)
  }

  async function fetchViewContacted() {
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
      setViewContacted(list.slice(0, 5))
    }
  }

  async function fetchWeekStatus() {
    const days = getWeekDays(viewDate)
    const { data } = await supabase.from('daily_checkins')
      .select('date,is_done').eq('user_id',user.id).in('date',days)
    const sm={}
    if(data) days.forEach(d=>{
      const dc=data.filter(c=>c.date===d)
      if(dc.length===0) sm[d]='none'
      else if(dc.filter(c=>c.is_done).length>=DAILY_TASKS.length) sm[d]='full'
      else sm[d]='partial'
    })
    setWeekStatus(days.map(d=>({date:d,status:sm[d]||'none'})))
  }

  function changeDate(delta) {
    const d = new Date(viewDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    const nd = toDateStr(d)
    if (nd <= today()) setViewDate(nd)
  }

  async function toggleCheckin(key) {
    const cur=checkins[key], nv=!cur
    setCheckins(p=>({...p,[key]:nv}))
    setCheckTotal(p => {
      const isDailyKey = DAILY_TASKS.some(t => t.key === key)
      return isDailyKey ? (nv ? p+1 : p-1) : p
    })
    const { error } = await supabase.from('daily_checkins').upsert(
      { user_id:user.id, date:viewDate, task_key:key, is_done:nv, updated_at:new Date().toISOString() },
      { onConflict:'user_id,date,task_key' }
    )
    if(error){
      setCheckins(p=>({...p,[key]:cur}))
      setCheckTotal(p => {
        const isDailyKey = DAILY_TASKS.some(t => t.key === key)
        return isDailyKey ? (nv ? p-1 : p+1) : p
      })
    }
    setTimeout(() => fetchStarterTasks(), 500)
  }

  function handleTaskAction(task) {
    if (task.key === 'goal_declaration') { setGoalModal(true); return }
    if (task.social) { setSocialModal(true); return }
    if (task.toContacts) { navigate('/contacts'); return }
    if (task.internalPath) { navigate(task.internalPath); return }
    if (task.url) { window.open(task.url, '_blank'); return }
  }

  async function saveGoalText() {
    setGoalSaving(true)
    await supabase.from('users').update({ goal_declaration: goalText }).eq('id', user.id)
    setGoalSaving(false)
    setGoalSaved(true)
    setTimeout(() => setGoalSaved(false), 2000)
    setTimeout(() => fetchStarterTasks(), 500)
  }

  const displayName = profile?.name || user?.email?.split('@')[0] || 'Annie'
  const todayStr = (()=>{
    const d=new Date()
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} 星期${DAYS_ZH[d.getDay()]}`
  })()
  const allDue = [...overdueContacts,...todayDueContacts]
  const starterDoneCount = starterTasks ? Object.values(starterTasks).filter(Boolean).length : 0
  const starterAllDone = starterDoneCount === STARTER_TASKS.length
  const showStarterCard = onboardingDone && starterTasks !== null && !starterAllDone

  if(loading) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <div style={{ width:36,height:36,borderRadius:'50%',border:'3px solid #F0F1F4',
        borderTopColor:PRIMARY,animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:TEXT_MUTED,marginTop:16,fontSize:14 }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:PAGE_BG,minHeight:'100vh' }}>
      <style>{`
        .dashboard-wrap { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dashboard-wrap { max-width: 1600px; margin: 0; }
        }
        .dash-grid { display: block; }
        @media (min-width: 1024px) {
          .dash-grid {
            display: grid;
            grid-template-columns: 1.6fr 1fr;
            grid-template-areas:
              "starter starter"
              "kpi followup"
              "quick followup"
              "checkin followup";
            gap: 14px;
            align-items: start;
          }
          .area-starter { grid-area: starter; margin-bottom: 0 !important; }
          .area-kpi { grid-area: kpi; margin-bottom: 0 !important; }
          .area-followup { grid-area: followup; margin-bottom: 0 !important; }
          .area-quick { grid-area: quick; margin-bottom: 0 !important; }
          .area-checkin { grid-area: checkin; margin-bottom: 0 !important; }
        }
      `}</style>

      <div className="dashboard-wrap" style={{ padding:'20px 16px 0' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
          <div>
            <p style={{ fontSize:19,fontWeight:700,color:TEXT_MAIN,margin:0 }}>嗨，{displayName} 👋</p>
            <p style={{ fontSize:12,color:TEXT_MUTED,margin:'5px 0 0' }}>{todayStr}</p>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <NotificationBell userId={user?.id} />
            <button onClick={()=>navigate('/settings')}
              style={{ background:PRIMARY_SOFT,border:'none',borderRadius:'50%',
              width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
              <IconSettings size={17} stroke={1.9} color={PRIMARY} />
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-wrap" style={{ padding:'14px 16px 0' }}>
        <div className="dash-grid">

        {showStarterCard && (
          <section className="area-starter" style={{ borderRadius:18,overflow:'hidden',marginBottom:10,
            border:'1px solid #F0F1F4' }}>
            {!starterExpanded && (
              <button onClick={() => setStarterExpanded(true)}
                style={{ width:'100%',background:PRIMARY_SOFT,border:'none',cursor:'pointer',
                  padding:'10px 14px',display:'flex',alignItems:'center',gap:10 }}>
                <IconRocket size={15} stroke={1.9} color={PRIMARY} />
                <div style={{ flex:1,height:6,background:'rgba(22,104,227,0.15)',borderRadius:99,overflow:'hidden' }}>
                  <div style={{ height:'100%',borderRadius:99,background:PRIMARY,
                    width:`${Math.round((starterDoneCount/STARTER_TASKS.length)*100)}%`,
                    transition:'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize:12,fontWeight:700,color:PRIMARY,whiteSpace:'nowrap' }}>
                  {starterDoneCount} / {STARTER_TASKS.length}
                </span>
                <span style={{ fontSize:12,color:PRIMARY }}>▼</span>
              </button>
            )}
            {starterExpanded && (
              <div style={{ background:'#fff' }}>
                <div style={{ background:PRIMARY_SOFT,padding:'14px',
                  display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div>
                    <p style={{ fontSize:14,fontWeight:700,color:PRIMARY,margin:0,display:'flex',alignItems:'center',gap:6 }}>
                      <IconRocket size={15} stroke={1.9} color={PRIMARY} /> 新手起步任務
                    </p>
                    <p style={{ fontSize:11,color:'#5B8FE0',margin:'4px 0 0' }}>完成這 5 件事，讓你的事業正式起步！</p>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:12,fontWeight:700,background:PRIMARY,color:'#fff',
                      padding:'3px 10px',borderRadius:99 }}>
                      {starterDoneCount}/{STARTER_TASKS.length}
                    </span>
                    <button onClick={() => setStarterExpanded(false)}
                      style={{ background:'none',border:'none',color:PRIMARY,cursor:'pointer',fontSize:14,padding:0 }}>▲</button>
                  </div>
                </div>
                <div style={{ padding:'10px 14px 14px' }}>
                  {STARTER_TASKS.map(task => {
                    const done = starterTasks?.[task.id] === true
                    return (
                      <div key={task.id} style={{ display:'flex',alignItems:'center',gap:10,
                        padding:'10px 0',borderBottom:'1px solid #F5F6F8' }}>
                        <div style={{ width:22,height:22,borderRadius:'50%',flexShrink:0,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          background: done ? ACCENT_GREEN : '#F0F1F4',
                          border: done ? 'none' : '1.5px solid #D8DCE8' }}>
                          {done && <span style={{ fontSize:12,color:'#fff' }}>✓</span>}
                        </div>
                        <span style={{ fontSize:13,fontWeight:600,color: done?TEXT_MUTED:TEXT_MAIN,
                          textDecoration: done?'line-through':'none',flex:1 }}>
                          {task.label}
                        </span>
                        {done && <span style={{ fontSize:11,color:ACCENT_GREEN_TEXT,fontWeight:700 }}>完成</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="area-kpi" style={{ background:'linear-gradient(135deg,#1668E3,#2E8FEA)',borderRadius:20,marginBottom:10,
          padding:'18px 18px',boxShadow:'0 12px 28px rgba(22,104,227,0.2)' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
            <span style={{ fontSize:14,fontWeight:700,color:'#fff' }}>本季業績進度</span>
            <button style={{ fontSize:12,color:'rgba(255,255,255,0.85)',background:'none',border:'none',cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:2 }}
              onClick={()=>navigate('/transactions')}>查看詳情 <IconChevronRight size={13} stroke={2} /></button>
          </div>
          <div style={{ display:'flex',gap:16,marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                <span style={{ fontSize:12,fontWeight:700,color:ACCENT_YELLOW }}>BV</span>
                <span style={{ fontSize:14,fontWeight:700,color:'#fff' }}>{bvTotal.toFixed(0)} <span style={{ color:'rgba(255,255,255,0.6)',fontSize:12,fontWeight:400 }}>/ {BV_GOAL}</span></span>
              </div>
              <ProgressBar value={bvTotal} max={BV_GOAL} color={ACCENT_YELLOW} trackColor="rgba(255,255,255,0.22)" />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                <span style={{ fontSize:12,fontWeight:700,color:'#fff' }}>IBV</span>
                <span style={{ fontSize:14,fontWeight:700,color:'#fff' }}>{ibvTotal.toFixed(0)} <span style={{ color:'rgba(255,255,255,0.6)',fontSize:12,fontWeight:400 }}>/ {IBV_GOAL}</span></span>
              </div>
              <ProgressBar value={ibvTotal} max={IBV_GOAL} color="#fff" trackColor="rgba(255,255,255,0.22)" />
            </div>
          </div>
          <div style={{ display:'flex',justifyContent:'space-between',paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.18)' }}>
            <span style={{ color:'rgba(255,255,255,0.75)',fontSize:12 }}>本月獲利</span>
            <span style={{ color:'#fff',fontWeight:700,fontSize:16 }}>
              NT${profit.toLocaleString()}
            </span>
          </div>
        </section>

        <section className="area-followup" style={{ background:CARD_BG,borderRadius:18,marginBottom:10,padding:16,border:'1px solid #F0F1F4' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN,display:'flex',alignItems:'center',gap:8 }}>
              待跟進
              {allDue.length>0 && <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99,background:DANGER_SOFT,color:DANGER }}>{allDue.length} 人今天</span>}
            </span>
            <button style={{ fontSize:12,color:PRIMARY,background:'none',border:'none',cursor:'pointer',fontWeight:700 }}
              onClick={()=>navigate('/contacts?filter=due')}>全部 →</button>
          </div>
          {allDue.length===0
            ? <p style={{ fontSize:14,color:TEXT_MUTED,textAlign:'center',padding:'16px 0',margin:0 }}>今天沒有待跟進的聯絡人 🎉</p>
            : <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {allDue.slice(0,5).map(c=>{
                  const ov=isOverdue(c.next_contact_date)
                  return (
                    <button key={c.id} onClick={()=>navigate(`/contacts/${c.id}`)}
                      style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:14,width:'100%',
                        background:ov?DANGER_SOFT:SUBCARD_BG,border:'none',
                        cursor:'pointer',textAlign:'left' }}>
                      <Avatar name={c.name} size={38} />
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>{c.name}</span>
                          <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:6,
                            background:getEggBg(c.egg_type),color:getEggColor(c.egg_type) }}>{c.egg_type}</span>
                        </div>
                        <div style={{ fontSize:12,color:TEXT_SECONDARY,marginTop:2,display:'flex',gap:4 }}>
                          {c.occupation&&<span>{c.occupation}</span>}{c.occupation&&<span>·</span>}
                          <span>{c.action_type}</span>
                        </div>
                      </div>
                      <span style={{ fontSize:12,fontWeight:700,whiteSpace:'nowrap',color:ov?DANGER:ACCENT_YELLOW_TEXT }}>
                        {formatFollowDate(c.next_contact_date)}
                      </span>
                    </button>
                  )
                })}
              </div>
          }
        </section>

        <section className="area-quick" style={{ marginBottom:10 }}>
          <div style={{ display:'flex',gap:10 }}>
            <QuickBtn Icon={IconUsers} label="+互動" color={ACCENT_YELLOW_TEXT} bg={ACCENT_YELLOW_SOFT} onClick={()=>navigate('/contacts/new')} />
            <QuickBtn Icon={IconChartBar} label="+業績" color={ACCENT_GREEN_TEXT} bg={ACCENT_GREEN_SOFT} onClick={()=>navigate('/transactions/new')} />
            <QuickBtn Icon={IconSearch} label="查顧客" color={ACCENT_PINK_TEXT} bg={ACCENT_PINK_SOFT} onClick={()=>navigate('/customers')} />
          </div>
        </section>

        <section className="area-checkin" style={{ background:CARD_BG,borderRadius:18,marginBottom:10,padding:16,border:'1px solid #F0F1F4' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
            <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>
              {isToday ? '今日打卡' : '打卡紀錄'}
            </span>
            <span style={{ fontSize:13,color:TEXT_SECONDARY,fontWeight:600 }}>{checkTotal}/{DAILY_TASKS.length}</span>
          </div>

          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
            marginBottom:10,background:SUBCARD_BG,borderRadius:12,padding:'6px 10px' }}>
            <button onClick={() => changeDate(-1)}
              style={{ background:'none',border:'none',color:TEXT_SECONDARY,
                fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1 }}>‹</button>
            <div style={{ textAlign:'center' }}>
              <span style={{ fontSize:13,fontWeight:700,color: isToday?PRIMARY:'#C9902E' }}>
                {isToday ? '今天' : formatDateLabel(viewDate)}
              </span>
              {!isToday && (
                <button onClick={() => setViewDate(today())}
                  style={{ marginLeft:8,fontSize:11,color:PRIMARY,background:'none',
                    border:'none',cursor:'pointer',fontWeight:700 }}>回今天</button>
              )}
            </div>
            <button onClick={() => changeDate(1)}
              style={{ background:'none',border:'none',
                color: isToday?'#D8DCE8':TEXT_SECONDARY,
                fontSize:18,cursor: isToday?'default':'pointer',
                padding:'0 4px',lineHeight:1 }}>›</button>
          </div>

          <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 4px',
            background:SUBCARD_BG,borderRadius:12,marginBottom:8 }}>
            {weekStatus.map((w,i)=>{
              const isSelected = w.date === viewDate
              const isT = w.date === today()
              const dc=w.status==='full'?ACCENT_GREEN:w.status==='partial'?ACCENT_YELLOW:'#E1E5EE'
              return (
                <div key={i} onClick={() => { if(w.date<=today()) setViewDate(w.date) }}
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                    cursor: w.date<=today()?'pointer':'default' }}>
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

          <div style={{ display:'flex',flexDirection:'column',gap:2 }}>
            {DAILY_TASKS.map(task=>{
              const done=!!checkins[task.key]
              const hasAction = task.url || task.internalPath || task.social || task.toContacts || task.key === 'goal_declaration'
              const TaskIcon = task.Icon
              return (
                <div key={task.key} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',
                  borderBottom:'1px solid #F5F6F8' }}>
                  <button onClick={()=>toggleCheckin(task.key)}
                    style={{ width:20,height:20,borderRadius:7,flexShrink:0,
                      border:done?'none':'2px solid #D8DCE8',background:done?ACCENT_GREEN:'#fff',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      transition:'all 0.15s',cursor:'pointer' }}>
                    {done&&<span style={{ fontSize:11,color:'#fff' }}>✓</span>}
                  </button>
                  <TaskIcon size={16} stroke={1.9} color={done?'#C7CEDD':PRIMARY} />
                  <button onClick={()=> hasAction && handleTaskAction(task)}
                    style={{ flex:1,background:'none',border:'none',textAlign:'left',
                      cursor: hasAction?'pointer':'default',padding:0,
                      display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <span style={{ fontSize:13,fontWeight:600,color:done?TEXT_MUTED:TEXT_MAIN,
                      textDecoration:done?'line-through':'none' }}>
                      {task.label}
                      {task.special&&viewContacted.length>0&&(
                        <span style={{ marginLeft:6,display:'inline-flex',gap:4,flexWrap:'wrap' }}>
                          {viewContacted.map((c,i) => (
                            <span key={c.id}
                              onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${c.id}`) }}
                              style={{ color:ACCENT_GREEN_TEXT,fontWeight:700,cursor:'pointer',
                                textDecoration:'underline' }}>
                              {c.name}{i<viewContacted.length-1?'、':''}
                            </span>
                          ))}
                          <span style={{ color:ACCENT_GREEN_TEXT,fontWeight:700 }}>✓</span>
                        </span>
                      )}
                    </span>
                    {hasAction&&(
                      <span style={{ fontSize:12,color:TEXT_MUTED,marginLeft:8,flexShrink:0 }}>›</span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        </div>
        <div style={{ height:80 }} />
      </div>

      {goalModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e=>{ if(e.target===e.currentTarget) setGoalModal(false) }}>
          <div style={{ background:'#fff',borderRadius:'22px 22px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:0,display:'flex',alignItems:'center',gap:6 }}>
                <IconTarget size={17} stroke={1.9} color={PRIMARY} /> 我的目標宣言
              </h3>
              <button onClick={()=>setGoalModal(false)}
                style={{ background:'none',border:'none',fontSize:20,color:TEXT_MUTED,cursor:'pointer' }}>✕</button>
            </div>
            <textarea ref={goalTextareaRef} value={goalText}
              onChange={e=>{ setGoalText(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px' }}
              placeholder="寫下你的目標宣言，每天提醒自己為什麼出發..." rows={4}
              style={{ width:'100%',padding:'12px',borderRadius:12,border:'1px solid #E1E5EE',
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
          onClick={e=>{ if(e.target===e.currentTarget) setSocialModal(false) }}>
          <div style={{ background:'#fff',borderRadius:'22px 22px 0 0',padding:24,width:'100%',maxWidth:430 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:0,display:'flex',alignItems:'center',gap:6 }}>
                <IconMessageCircle size={17} stroke={1.9} color={PRIMARY} /> 前往回應
              </h3>
              <button onClick={()=>setSocialModal(false)}
                style={{ background:'none',border:'none',fontSize:20,color:TEXT_MUTED,cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex',gap:12,marginBottom:8 }}>
              <button onClick={()=>{ window.open('https://www.facebook.com/groups/710836659091767/','_blank'); setSocialModal(false) }}
                style={{ flex:1,padding:'16px 8px',borderRadius:16,border:'none',
                  background:'#1877F2',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                📘 臉書 IDEA
              </button>
              <button onClick={()=>{ window.open('https://line.me','_blank'); setSocialModal(false) }}
                style={{ flex:1,padding:'16px 8px',borderRadius:16,border:'none',
                  background:'#06C755',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                💚 LINE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

if(typeof document!=='undefined'&&!document.getElementById('dash-anim')){
  const s=document.createElement('style'); s.id='dash-anim'
  s.textContent='@keyframes spin{to{transform:rotate(360deg)}}'
  document.head.appendChild(s)
}
