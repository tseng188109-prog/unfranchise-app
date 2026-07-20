import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import LoadingSpinner from './LoadingSpinner'
import { DAILY_TASKS, STARTER_TASKS } from './taskDefinitions'
import { fetchMyTeam, fetchTeamRanking, getWeekDays as getTeamWeekDays } from './teamStats'
import {
  IconSettings, IconRocket, IconUsers, IconChartBar, IconSearch,
  IconTarget, IconSpeakerphone, IconMessageCircle, IconBook,
  IconHeadphones, IconCamera, IconTrendingUp, IconChevronRight,
  IconFlag, IconUsersGroup,
} from '@tabler/icons-react'

const BV_GOAL = 1500
const IBV_GOAL = 300
const DAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']

// 設計系統色碼：統一從共用檔案 import
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_YELLOW, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT,
  ACCENT_GREEN, ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT,
  ACCENT_PINK, ACCENT_PINK_SOFT, ACCENT_PINK_TEXT,
  DANGER, DANGER_SOFT, CARD_BG, PAGE_BG, SUBCARD_BG, RADIUS,
  getEggColor, getEggBg, avatarBg,
} from './designTokens'


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
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
}

function Avatar({ name, size=36 }) {
  return (
    <div style={{ width:size,height:size,borderRadius:RADIUS.circle,background:avatarBg(name||''),
      display:'flex',alignItems:'center',justifyContent:'center',
      color:'#fff',fontWeight:700,fontSize:size*0.42,flexShrink:0 }}>
      {name?name[0]:'?'}
    </div>
  )
}
function ProgressBar({ value, max, color, trackColor }) {
  const pct = max>0 ? Math.min((value/max)*100,100) : 0
  return (
    <div style={{ background:trackColor||'#F3F4F6',borderRadius:RADIUS.pill,height:8,overflow:'hidden' }}>
      <div style={{ width:`${pct}%`,height:'100%',borderRadius:RADIUS.pill,background:color,
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
        padding:'14px 4px',borderRadius:RADIUS.xl,border:'none',
        background:bg,cursor:'pointer',transition:'all 0.15s' }}>
      <div style={{ width:32,height:32,borderRadius:RADIUS.sm,background:'rgba(255,255,255,0.65)',
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

  // 戰隊本週打卡率（沒加入戰隊時是 null，卡片不顯示；「戰隊」「我的夥伴」兩個入口按鈕永遠顯示）
  const [teamCard, setTeamCard] = useState(null)

  // 本週訪談狀態（本週見面次數/2，教練語氣，跟自己比不跟別人比）
  const [meetupCard, setMeetupCard] = useState(null)

  // 我為什麼留在這裡：首頁安靜預覽一行，沒寫過就不顯示，不主動邀請填寫
  const [whyHerePreview, setWhyHerePreview] = useState('')

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
      fetchGoalText(), fetchStarterTasks(), fetchTeamCard(), fetchMeetupCard()
    ])
    setLoading(false)
  }

  async function fetchProfile() {
    const { data } = await supabase.from('users')
      .select('name, onboarding_done, why_here')
      .eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setOnboardingDone(data.onboarding_done === true)
      setWhyHerePreview(data.why_here || '')
    }
  }

  // 戰隊本週打卡率：只算全隊平均，不顯示個人名次（排名跟心法文件「永不做業績排名」衝突，
  // 等 Team.jsx 改成共同完成視覺化再一起處理，這裡先不做排名卡片）
  async function fetchTeamCard() {
    const teamData = await fetchMyTeam(user.id)
    if (!teamData) { setTeamCard(null); return }
    const teamWeekDays = getTeamWeekDays()
    const ranked = await fetchTeamRanking(teamData.id, teamWeekDays)
    if (!ranked.length) { setTeamCard(null); return }
    const teamAvgRate = Math.round(
      ranked.reduce((s,m) => s + (m.weekCheckinDays/7), 0) / ranked.length * 100
    )
    setTeamCard({ teamAvgRate })
  }

  // 本週訪談狀態：本週見面次數（counter_logs, counter_key='meetup', is_done=true）跟連續達標週數
  // 跟自己比，不跟隊友比——這是 Dashboard 唯一保留的「訪談狀態」教練語氣卡片
  async function fetchMeetupCard() {
    const currentWeekStart = getWeekStart(today())
    // 抓最近 12 週的資料，夠算連續達標週數
    const twelveWeeksAgo = (() => {
      const d = new Date(currentWeekStart + 'T00:00:00')
      d.setDate(d.getDate() - 7 * 11)
      return toDateStr(d)
    })()
    const { data } = await supabase.from('counter_logs')
      .select('date')
      .eq('user_id', user.id).eq('counter_key', 'meetup').eq('is_done', true)
      .gte('date', twelveWeeksAgo)
    const weeklyCounts = {}
    ;(data || []).forEach(l => {
      const wk = getWeekStart(l.date)
      weeklyCounts[wk] = (weeklyCounts[wk] || 0) + 1
    })
    const count = weeklyCounts[currentWeekStart] || 0
    let streak = 0
    let cursor = currentWeekStart
    while ((weeklyCounts[cursor] || 0) >= 2) {
      streak++
      const d = new Date(cursor + 'T00:00:00')
      d.setDate(d.getDate() - 7)
      cursor = toDateStr(d)
    }
    setMeetupCard({ count, streak })
  }

  async function fetchGoalText() {
    const { data } = await supabase.from('users').select('goal_declaration').eq('id', user.id).single()
    if (data?.goal_declaration) setGoalText(data.goal_declaration)
  }

  async function fetchStarterTasks() {
    const todayStr = today()
    const { count: contactCount } = await supabase
      .from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
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

  if(loading) return <LoadingSpinner />

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
              "meetup meetup"
              "starter starter"
              "kpi followup"
              "team followup"
              "quick followup"
              "checkin followup";
            gap: 14px;
            align-items: start;
          }
          .area-meetup { grid-area: meetup; margin-bottom: 0 !important; }
          .area-starter { grid-area: starter; margin-bottom: 0 !important; }
          .area-kpi { grid-area: kpi; margin-bottom: 0 !important; }
          .area-team { grid-area: team; margin-bottom: 0 !important; }
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
            {whyHerePreview && (
              <p onClick={() => navigate('/settings')}
                style={{ fontSize:13,fontStyle:'italic',color:TEXT_SECONDARY,margin:'8px 0 0',cursor:'pointer' }}>
                「{whyHerePreview}」
              </p>
            )}
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <NotificationBell userId={user?.id} />
            <button onClick={()=>navigate('/settings')}
              style={{ background:PRIMARY_SOFT,border:'none',borderRadius:RADIUS.circle,
              width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
              <IconSettings size={17} stroke={1.9} color={PRIMARY} />
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-wrap" style={{ padding:'14px 16px 0' }}>
        <div className="dash-grid">

        {meetupCard && (
          <section className="area-meetup" style={{ marginBottom:10 }}>
            <div style={{ background:CARD_BG, border:'1px solid #F0F1F4', borderRadius:RADIUS.xl, padding:'18px' }}>
              <p style={{ fontSize:12, color:TEXT_SECONDARY, margin:'0 0 8px', fontWeight:700 }}>本週訪談</p>
              <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                <span style={{ fontSize:34, fontWeight:700, color:TEXT_MAIN, lineHeight:1 }}>
                  {meetupCard.count}<span style={{ fontSize:17, color:TEXT_MUTED, fontWeight:600 }}>/2</span>
                </span>
                <span style={{ fontSize:14, color:TEXT_SECONDARY, fontWeight:600 }}>
                  {meetupCard.count === 0 ? '想約誰？' : meetupCard.count === 1 ? '只差一位' : '達標了'}
                </span>
              </div>
              {meetupCard.streak >= 2 && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:ACCENT_YELLOW_SOFT,
                  borderRadius:RADIUS.pill, padding:'4px 10px', marginTop:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:ACCENT_YELLOW_TEXT }}>連續 {meetupCard.streak} 週達標</span>
                </div>
              )}
            </div>
          </section>
        )}

        {showStarterCard && (
          <section className="area-starter" style={{ borderRadius:RADIUS.xl,overflow:'hidden',marginBottom:10,
            border:'1px solid #F0F1F4' }}>
            {!starterExpanded && (
              <button onClick={() => setStarterExpanded(true)}
                style={{ width:'100%',background:PRIMARY_SOFT,border:'none',cursor:'pointer',
                  padding:'10px 14px',display:'flex',alignItems:'center',gap:10 }}>
                <IconRocket size={15} stroke={1.9} color={PRIMARY} />
                <div style={{ flex:1,height:6,background:'rgba(22,104,227,0.15)',borderRadius:RADIUS.pill,overflow:'hidden' }}>
                  <div style={{ height:'100%',borderRadius:RADIUS.pill,background:PRIMARY,
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
                      padding:'3px 10px',borderRadius:RADIUS.pill }}>
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
                        <div style={{ width:22,height:22,borderRadius:RADIUS.circle,flexShrink:0,
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

        {/* 戰隊：只顯示全隊平均打卡率，不顯示個人名次（排名等 Team.jsx 改成共同完成視覺化再一起做）；
            「戰隊」「我的夥伴」兩個入口按鈕永遠顯示，不管有沒有加入戰隊 */}
        <section className="area-team" style={{ marginBottom:10 }}>
          {teamCard && (
            <div style={{ background:CARD_BG, border:'1px solid #F0F1F4', borderRadius:RADIUS.xl,
              padding:'14px 16px', marginBottom:10 }}>
              <p style={{ fontSize:12, color:TEXT_SECONDARY, margin:'0 0 10px', fontWeight:700 }}>戰隊本週打卡率</p>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1, height:8, background:'#F0F1F4', borderRadius:RADIUS.pill, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:RADIUS.pill, width:`${teamCard.teamAvgRate}%`,
                    background: teamCard.teamAvgRate>=70?ACCENT_GREEN:teamCard.teamAvgRate>=40?ACCENT_YELLOW:DANGER,
                    transition:'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize:14, fontWeight:700, color:TEXT_MAIN }}>{teamCard.teamAvgRate}%</span>
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => navigate('/team')}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                padding:'11px 0', borderRadius:RADIUS.lg, border:'1px solid #F0F1F4',
                background:SUBCARD_BG, color:TEXT_MAIN, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              <IconFlag size={16} stroke={1.9} color={PRIMARY} /> 戰隊
            </button>
            <button onClick={() => navigate('/partners')}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                padding:'11px 0', borderRadius:RADIUS.lg, border:'1px solid #F0F1F4',
                background:SUBCARD_BG, color:TEXT_MAIN, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              <IconUsersGroup size={16} stroke={1.9} color={PRIMARY} /> 我的夥伴
            </button>
          </div>
        </section>

        <section className="area-followup" style={{ background:CARD_BG,borderRadius:RADIUS.xl,marginBottom:10,padding:16,border:'1px solid #F0F1F4' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN,display:'flex',alignItems:'center',gap:8 }}>
              待跟進
              {allDue.length>0 && <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:RADIUS.pill,background:DANGER_SOFT,color:DANGER }}>{allDue.length} 人今天</span>}
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
                      style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:RADIUS.lg,width:'100%',
                        background:ov?DANGER_SOFT:SUBCARD_BG,border:'none',
                        cursor:'pointer',textAlign:'left' }}>
                      <Avatar name={c.name} size={38} />
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>{c.name}</span>
                          <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:RADIUS.xs,
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

        <section className="area-checkin" style={{ background:CARD_BG,borderRadius:RADIUS.xl,marginBottom:10,padding:16,border:'1px solid #F0F1F4' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
            <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>
              {isToday ? '今日打卡' : '打卡紀錄'}
            </span>
            <span style={{ fontSize:13,color:TEXT_SECONDARY,fontWeight:600 }}>{checkTotal}/{DAILY_TASKS.length}</span>
          </div>

          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
            marginBottom:10,background:SUBCARD_BG,borderRadius:RADIUS.md,padding:'6px 10px' }}>
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
            background:SUBCARD_BG,borderRadius:RADIUS.md,marginBottom:8 }}>
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
                  <div style={{ width:10,height:10,borderRadius:RADIUS.circle,background:dc,
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
              style={{ width:'100%',padding:'12px',borderRadius:RADIUS.md,border:'1px solid #E1E5EE',
                fontSize:15,boxSizing:'border-box',outline:'none',resize:'none',lineHeight:1.8,display:'block' }} />
            <button onClick={saveGoalText} disabled={goalSaving}
              style={{ width:'100%',padding:'13px',borderRadius:RADIUS.lg,border:'none',
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
