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
  IconFlag, IconUsersGroup, IconHeart, IconChevronDown, IconChevronUp,
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
import { pickMeetingContact, pickInteractionContacts, getSuggestion, markDaily312, isContactWarm } from './followUp'
import StudyThemeCard from './StudyThemeCard'


function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

// 「本週」＝業績結算週：週六 00:00 到週五 24:00（跟公司結算時間一致）。
// 下面兩個函式的 diff = (星期幾 + 1) % 7，週六=0、週日=1 … 週五=6，起點永遠是最近的週六。
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

// （舊的「逾期N天」跟進日期系統已經被 3-1-2 取代，不再用天數嚇自己，這裡不留殘留函式）
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
function QuickBtn({ Icon, label, onClick, color }) {
  return (
    <button onClick={onClick}
      style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
        padding:'10px 4px',borderRadius:RADIUS.lg,border:'1px solid #F0F1F4',
        background:'#fff',cursor:'pointer' }}>
      <Icon size={16} stroke={1.9} color={color} />
      <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN,whiteSpace:'nowrap' }}>{label}</span>
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
  const [activeContacts, setActiveContacts] = useState([])
  const [newContactCount, setNewContactCount] = useState(0)
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
  const [starterExpanded, setStarterExpanded] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(true)

  // 戰隊本週打卡率（沒加入戰隊時是 null，卡片不顯示；「戰隊」「我的夥伴」兩個入口按鈕永遠顯示）
  const [teamCard, setTeamCard] = useState(null)

  // 本週訪談狀態（本週見面次數/2，教練語氣，跟自己比不跟別人比）
  const [meetupCard, setMeetupCard] = useState(null)

  // 我為什麼留在這裡：首頁安靜預覽一行，沒寫過就不顯示，不主動邀請填寫
  const [whyHerePreview, setWhyHerePreview] = useState('')

  // 老顧客關心卡：最多 3 位，沒有需要關心的人就整張卡不出現
  const [careList, setCareList] = useState([])

  // 首頁收合狀態：預設都收起來，只有「3 位互動」展開（每天最常用）
  const [statsOpen, setStatsOpen] = useState(false)
  const [careOpen, setCareOpen] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [interactOpen, setInteractOpen] = useState(true)
  const checkinRef = useRef(null)

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
      fetchGoalText(), fetchStarterTasks(), fetchTeamCard(), fetchMeetupCard(), fetchCareCard()
    ])
    setLoading(false)
  }

  // 老顧客關心卡（先關心、不催單）。最多 3 位，最久沒關心的排前面。
  // 先排除：14 天內已經關心／互動過、被按了「這次先不打擾」（14 天內）。
  // 再看是不是符合下面任一種：
  //   A. 買完之後：新顧客（只買過一次）買完 7 天起、老顧客 14 天起，到 60 天為止；買完之後關心過就不再出現
  //   B. 回購日：自己設的回購日前 3 天起，到過期 30 天為止；回購日前後關心過、或回購日附近又買了，就不再出現
  //   C. 送了贈品：送出 5 天起，到 60 天為止；送完之後關心過、或後來買了，就不再出現
  //   D. 久沒聊：買過東西，最後一次購買超過 60 天（一年內），而且 60 天以上沒關心；只在前三種不夠 3 位時補 1 位
  // 「最近一次關心」取三個來源最新的：顧客自己的 last_cared_at、連結聯絡人的 last_interacted_at、
  // 連結聯絡人的 last_contact_date，所以沒連結聯絡人的顧客也算得出來（按過「我關心過了」就有）。
  async function fetchCareCard() {
    const todayStr = today()
    const nowMs = Date.now()
    const DAY = 86400000
    const { data: custs } = await supabase.from('customers')
      .select('id,name,contact_id,repurchase_reminder,last_cared_at,care_snoozed_until')
      .eq('user_id', user.id).eq('is_archived', false).limit(500)
    if (!custs || custs.length === 0) { setCareList([]); return }
    const { data: tx } = await supabase.from('transactions')
      .select('customer_id,date,is_gift,line_kind,order_id,product_name')
      .eq('user_id', user.id).not('customer_id', 'is', null)
      .order('date', { ascending: false }).limit(3000)

    // 每位顧客：最後一次付費購買、購買次數（同一張訂單算一次）、最近一次送贈品
    const lastPurchase = {}
    const purchaseKeys = {}
    const lastGift = {}
    ;(tx || []).forEach(t => {
      if (t.line_kind) return
      if (t.is_gift) {
        const g = lastGift[t.customer_id]
        if (!g) lastGift[t.customer_id] = { date: t.date, names: [t.product_name] }
        else if (g.date === t.date) g.names.push(t.product_name)
        return
      }
      if (!lastPurchase[t.customer_id]) lastPurchase[t.customer_id] = t.date
      if (!purchaseKeys[t.customer_id]) purchaseKeys[t.customer_id] = new Set()
      purchaseKeys[t.customer_id].add(t.order_id || t.date)
    })
    const { data: cts } = await supabase.from('contacts')
      .select('id,last_interacted_at,last_contact_date')
      .eq('user_id', user.id).limit(2000)
    const contactMap = {}
    ;(cts || []).forEach(c => { contactMap[c.id] = c })

    const toMs = (d) => new Date(d + 'T00:00:00+08:00').getTime()
    const soon = toDateStr(new Date(nowMs + 3 * DAY))
    const list = []
    const lapsed = []
    custs.forEach(c => {
      if (c.care_snoozed_until && c.care_snoozed_until >= todayStr) return
      const ct = c.contact_id ? contactMap[c.contact_id] : null
      const careTimes = [
        c.last_cared_at ? new Date(c.last_cared_at).getTime() : 0,
        ct?.last_interacted_at ? new Date(ct.last_interacted_at).getTime() : 0,
        ct?.last_contact_date ? toMs(ct.last_contact_date) : 0,
      ]
      const lastCareMs = Math.max(...careTimes)
      if (lastCareMs && nowMs - lastCareMs < 14 * DAY) return

      const lp = lastPurchase[c.id] || null
      const lpMs = lp ? toMs(lp) : 0
      const lpDays = lp ? (nowMs - lpMs) / DAY : Infinity
      const purchaseCount = purchaseKeys[c.id] ? purchaseKeys[c.id].size : 0
      const caredSincePurchase = !!(lastCareMs && lpMs && lastCareMs >= lpMs)
      const md = (s) => { const p = s.split('-'); return `${Number(p[1])}/${Number(p[2])}` }

      // A. 買完之後
      const startDays = purchaseCount <= 1 ? 7 : 14
      const caseA = lp && lpDays >= startDays && lpDays <= 60 && !caredSincePurchase

      // B. 回購日
      let caseB = false
      if (c.repurchase_reminder && c.repurchase_reminder <= soon) {
        const remMs = toMs(c.repurchase_reminder)
        const stale = nowMs - remMs > 30 * DAY
        const caredAround = lastCareMs >= remMs - 3 * DAY
        const boughtAround = lp && lpMs >= remMs - 14 * DAY
        caseB = !stale && !caredAround && !boughtAround
      }

      // C. 送了贈品
      let caseC = false
      const g = lastGift[c.id]
      if (g) {
        const gMs = toMs(g.date)
        const gDays = (nowMs - gMs) / DAY
        const caredSinceGift = lastCareMs >= gMs
        const boughtSinceGift = lp && lp >= g.date
        caseC = gDays >= 5 && gDays <= 60 && !caredSinceGift && !boughtSinceGift
      }

      if (!caseA && !caseB && !caseC) {
        // D. 久沒聊（候補）
        if (lp && lpDays > 60 && lpDays <= 365 && (!lastCareMs || nowMs - lastCareMs > 60 * DAY)) {
          const gapMs = nowMs - Math.max(lpMs, lastCareMs)
          const months = Math.max(2, Math.round(gapMs / DAY / 30))
          lapsed.push({ id: c.id, name: c.name, contactId: c.contact_id,
            tag: '好久沒聊', line: `大約 ${months} 個月沒聊了，打聲招呼就好`,
            meta: `上次購買 ${md(lp)}`, lastCareMs, gapMs })
        }
        return
      }

      let line, tag = null
      if (caseC && !caseA) {
        tag = '上次送了' + g.names.slice(0, 2).join('、')
        line = '問問他試用得怎麼樣'
      } else if (caseA) {
        line = purchaseCount <= 1 ? '第一次買，問問他用得順不順' : '買完之後還沒聊過，問問他用得順不順'
      } else {
        line = lastCareMs
          ? `上次聊是 ${Math.max(2, Math.floor((nowMs - lastCareMs) / DAY / 7))} 週前，聊聊近況就好`
          : '回購日快到了，先問問他用得順不順'
      }
      const meta = []
      if (lp) meta.push(`上次購買 ${md(lp)}`)
      if (c.repurchase_reminder) meta.push(`你設的回購日 ${md(c.repurchase_reminder)}`)
      list.push({ id: c.id, name: c.name, contactId: c.contact_id, tag, line, meta: meta.join('、'), lastCareMs })
    })
    list.sort((a, b) => a.lastCareMs - b.lastCareMs)
    const result = list.slice(0, 3)
    if (result.length < 3 && lapsed.length > 0) {
      lapsed.sort((a, b) => a.gapMs - b.gapMs)
      result.push(lapsed[0])
    }
    setCareList(result)
  }

  async function markCustomerCared(customerId) {
    setCareList(prev => prev.filter(c => c.id !== customerId))
    await supabase.from('customers')
      .update({ last_cared_at: new Date().toISOString(), care_snoozed_until: null }).eq('id', customerId)
  }
  async function snoozeCustomerCare(customerId) {
    setCareList(prev => prev.filter(c => c.id !== customerId))
    const until = toDateStr(new Date(Date.now() + 14 * 86400000))
    await supabase.from('customers').update({ care_snoozed_until: until }).eq('id', customerId)
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

  // 戰隊本週 3-1-2 推進率：只算全隊平均，不顯示個人名次。
  // 跟 Team.jsx「戰隊旅程」同一個 task_key（daily_312），兩邊算的是同一件事。
  async function fetchTeamCard() {
    const teamData = await fetchMyTeam(user.id)
    if (!teamData) { setTeamCard(null); return }
    const teamWeekDays = getTeamWeekDays()
    const ranked = await fetchTeamRanking(teamData.id, teamWeekDays, ['daily_312'])
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
    // 一週內累積 3 天：用結算週（週六到週五）算，跟其他「本週」同一條線。
    // 為了不讓週六 0 點一到、已經達成的任務又退回去，這週或上一個結算週任一週達標都算完成。
    const thisWeekDays = getWeekDays(todayStr)
    const prevWeekDays = getWeekDays(toDateStr(new Date(new Date(thisWeekDays[0] + 'T00:00:00').getTime() - 86400000)))
    const { data: weekCheckins } = await supabase
      .from('daily_checkins').select('date')
      .eq('user_id', user.id).eq('is_done', true)
      .gte('date', prevWeekDays[0]).lte('date', todayStr)
    const checkinDates = new Set((weekCheckins || []).map(r => r.date))
    const daysIn = (days) => days.filter(d => checkinDates.has(d)).length
    const uniqueDays = Math.max(daysIn(thisWeekDays), daysIn(prevWeekDays))
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
      .select('id,name,occupation,egg_type,need_level,action_type,relationship_stage,referral_stage,is_muted,last_interacted_at,created_at')
      .eq('user_id',user.id).eq('is_archived',false)
      .order('last_interacted_at',{ascending:true,nullsFirst:true}).limit(200)
    if (data) setActiveContacts(data)
    // 「這週已經新增」＝本結算週（週六 00:00 起）新增的聯絡人，不是往前數 7 天
    const weekStartTaipei = new Date(getWeekStart(today()) + 'T00:00:00+08:00').toISOString()
    const { count } = await supabase.from('contacts')
      .select('id',{count:'exact',head:true})
      .eq('user_id',user.id).gte('created_at',weekStartTaipei)
    setNewContactCount(count || 0)
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
  const meetingContact = pickMeetingContact(activeContacts)
  const interactionContacts = pickInteractionContacts(activeContacts, meetingContact?.id, 3)
  const starterDoneCount = starterTasks ? Object.values(starterTasks).filter(Boolean).length : 0
  const starterAllDone = starterDoneCount === STARTER_TASKS.length
  const showStarterCard = onboardingDone && starterTasks !== null && !starterAllDone

  if(loading) return <LoadingSpinner />

  return (
    <div style={{ background:PAGE_BG,minHeight:'100vh',overflowX:'hidden',maxWidth:'100vw',boxSizing:'border-box' }}>
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
              "quick quick"
              "starter starter"
              "stats followup"
              "care followup"
              "theme followup"
              "checkin followup";
            gap: 14px;
            align-items: start;
          }
          .area-theme { grid-area: theme; margin-bottom: 0 !important; }
          .area-care { grid-area: care; margin-bottom: 0 !important; }
          .area-starter { grid-area: starter; margin-bottom: 0 !important; }
          .area-stats { grid-area: stats; margin-bottom: 0 !important; }
          .area-followup { grid-area: followup; margin-bottom: 0 !important; }
          .area-quick { grid-area: quick; margin-bottom: 0 !important; }
          .area-checkin { grid-area: checkin; margin-bottom: 0 !important; }
        }
      `}</style>

      <div className="dashboard-wrap" style={{ padding:'20px 16px 0' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10 }}>
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:19,fontWeight:700,color:TEXT_MAIN,margin:0 }}>嗨，{displayName} 👋</p>
            <p style={{ fontSize:12,color:TEXT_MUTED,margin:'5px 0 0' }}>{todayStr}</p>
            {whyHerePreview && (
              <p onClick={() => navigate('/settings')}
                style={{ fontSize:12,fontStyle:'italic',color:TEXT_SECONDARY,margin:'6px 0 0',cursor:'pointer',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                「{whyHerePreview}」
              </p>
            )}
          </div>
          <div style={{ display:'flex',gap:8,flexShrink:0 }}>
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

        {/* 常用入口：一排小按鈕，放最上面，拇指最好按 */}
        <section className="area-quick" style={{ marginBottom:10 }}>
          <div style={{ display:'flex',gap:8 }}>
            <QuickBtn Icon={IconUsers} label="+互動" color={ACCENT_YELLOW_TEXT} onClick={()=>navigate('/contacts/new')} />
            <QuickBtn Icon={IconChartBar} label="+業績" color={ACCENT_GREEN_TEXT} onClick={()=>navigate('/transactions/new')} />
            <QuickBtn Icon={IconSearch} label="查顧客" color={ACCENT_PINK_TEXT} onClick={()=>navigate('/customers')} />
          </div>
        </section>

        {/* 新手起步：一條細線，做完就消失 */}
        {showStarterCard && (
          <section className="area-starter" style={{ borderRadius:RADIUS.lg,overflow:'hidden',marginBottom:10,
            border:'1px solid #F0F1F4',background:'#fff' }}>
            {!starterExpanded && (
              <button onClick={() => setStarterExpanded(true)}
                style={{ width:'100%',background:'#fff',border:'none',cursor:'pointer',
                  padding:'9px 14px',display:'flex',alignItems:'center',gap:10 }}>
                <IconRocket size={15} stroke={1.9} color={PRIMARY} />
                <span style={{ fontSize:12,fontWeight:700,color:TEXT_MAIN,whiteSpace:'nowrap' }}>新手起步</span>
                <div style={{ flex:1,height:5,background:PRIMARY_SOFT,borderRadius:RADIUS.pill,overflow:'hidden' }}>
                  <div style={{ height:'100%',borderRadius:RADIUS.pill,background:PRIMARY,
                    width:`${Math.round((starterDoneCount/STARTER_TASKS.length)*100)}%`,
                    transition:'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize:12,fontWeight:700,color:PRIMARY,whiteSpace:'nowrap' }}>
                  {starterDoneCount}/{STARTER_TASKS.length}
                </span>
                <IconChevronDown size={14} stroke={1.9} color={TEXT_MUTED} />
              </button>
            )}
            {starterExpanded && (
              <div style={{ background:'#fff' }}>
                <div style={{ padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div>
                    <p style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN,margin:0,display:'flex',alignItems:'center',gap:6 }}>
                      <IconRocket size={15} stroke={1.9} color={PRIMARY} /> 新手起步任務
                    </p>
                    <p style={{ fontSize:11,color:TEXT_MUTED,margin:'4px 0 0' }}>完成這 5 件事，讓你的事業正式起步！</p>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:12,fontWeight:700,background:PRIMARY_SOFT,color:PRIMARY,
                      padding:'3px 10px',borderRadius:RADIUS.pill }}>
                      {starterDoneCount}/{STARTER_TASKS.length}
                    </span>
                    <button onClick={() => setStarterExpanded(false)}
                      style={{ background:'none',border:'none',cursor:'pointer',padding:0,display:'flex' }}>
                      <IconChevronUp size={16} stroke={1.9} color={TEXT_MUTED} />
                    </button>
                  </div>
                </div>
                <div style={{ padding:'0 14px 12px' }}>
                  {STARTER_TASKS.map(task => {
                    const done = starterTasks?.[task.id] === true
                    return (
                      <div key={task.id} style={{ display:'flex',alignItems:'center',gap:10,
                        padding:'9px 0',borderTop:'1px solid #F5F6F8' }}>
                        <div style={{ width:20,height:20,borderRadius:RADIUS.circle,flexShrink:0,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          background: done ? ACCENT_GREEN : '#F0F1F4',
                          border: done ? 'none' : '1.5px solid #D8DCE8' }}>
                          {done && <span style={{ fontSize:11,color:'#fff' }}>✓</span>}
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

        {/* 數字列：三個最重要的數字一眼看完，點開才看細節 */}
        <section className="area-stats" style={{ background:CARD_BG,border:'1px solid #F0F1F4',borderRadius:RADIUS.lg,marginBottom:10 }}>
          <div style={{ display:'flex',alignItems:'stretch' }}>
            <button onClick={() => setStatsOpen(v => !v)}
              style={{ flex:2,display:'flex',background:'none',border:'none',cursor:'pointer',padding:'12px 4px 12px 0',textAlign:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11,color:TEXT_MUTED,fontWeight:600 }}>本週訪談</div>
                <div style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,marginTop:2 }}>
                  {meetupCard ? meetupCard.count : '–'}<span style={{ fontSize:12,color:TEXT_MUTED,fontWeight:600 }}>/2</span>
                </div>
              </div>
              <div style={{ flex:1,borderLeft:'1px solid #F0F1F4' }}>
                <div style={{ fontSize:11,color:TEXT_MUTED,fontWeight:600 }}>本季 BV</div>
                <div style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,marginTop:2 }}>
                  {bvTotal.toFixed(0)}<span style={{ fontSize:12,color:TEXT_MUTED,fontWeight:600 }}>/{BV_GOAL}</span>
                </div>
              </div>
            </button>
            <button onClick={() => { setCheckinOpen(true); setTimeout(() => checkinRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 50) }}
              style={{ flex:1,background:'none',border:'none',borderLeft:'1px solid #F0F1F4',cursor:'pointer',padding:'12px 0',textAlign:'center' }}>
              <div style={{ fontSize:11,color:TEXT_MUTED,fontWeight:600 }}>{isToday ? '今日打卡' : '打卡'}</div>
              <div style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,marginTop:2 }}>
                {checkTotal}<span style={{ fontSize:12,color:TEXT_MUTED,fontWeight:600 }}>/{DAILY_TASKS.length}</span>
              </div>
            </button>
          </div>
          <button onClick={() => setStatsOpen(v => !v)}
            style={{ width:'100%',background:'none',border:'none',borderTop:'1px solid #F0F1F4',cursor:'pointer',
              padding:'6px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:4,
              fontSize:11,color:TEXT_MUTED }}>
            {statsOpen ? '收起' : '看細節'}
            {statsOpen ? <IconChevronUp size={13} stroke={1.9} /> : <IconChevronDown size={13} stroke={1.9} />}
          </button>

          {statsOpen && (
            <div style={{ padding:'4px 16px 16px',borderTop:'1px solid #F0F1F4' }}>
              {meetupCard && (
                <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',margin:'12px 0 14px' }}>
                  <span style={{ fontSize:13,color:TEXT_SECONDARY,fontWeight:600 }}>
                    本週訪談：{meetupCard.count === 0 ? '想約誰？' : meetupCard.count === 1 ? '只差一位' : '達標了'}
                  </span>
                  {meetupCard.streak >= 2 && (
                    <span style={{ background:ACCENT_YELLOW_SOFT,borderRadius:RADIUS.pill,padding:'3px 10px',
                      fontSize:12,fontWeight:700,color:ACCENT_YELLOW_TEXT }}>連續 {meetupCard.streak} 週達標</span>
                  )}
                </div>
              )}
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
                <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>本季業績進度</span>
                <button style={{ fontSize:12,color:PRIMARY,background:'none',border:'none',cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:2 }}
                  onClick={()=>navigate('/transactions')}>查看詳情 <IconChevronRight size={13} stroke={2} /></button>
              </div>
              <div style={{ display:'flex',gap:16,marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                    <span style={{ fontSize:12,fontWeight:700,color:ACCENT_YELLOW_TEXT }}>BV</span>
                    <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>{bvTotal.toFixed(0)} <span style={{ color:TEXT_MUTED,fontSize:12,fontWeight:400 }}>/ {BV_GOAL}</span></span>
                  </div>
                  <ProgressBar value={bvTotal} max={BV_GOAL} color={ACCENT_YELLOW} trackColor="#F0F1F4" />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                    <span style={{ fontSize:12,fontWeight:700,color:PRIMARY }}>IBV</span>
                    <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>{ibvTotal.toFixed(0)} <span style={{ color:TEXT_MUTED,fontSize:12,fontWeight:400 }}>/ {IBV_GOAL}</span></span>
                  </div>
                  <ProgressBar value={ibvTotal} max={IBV_GOAL} color={PRIMARY} trackColor="#F0F1F4" />
                </div>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:'1px solid #F0F1F4' }}>
                <span style={{ color:TEXT_SECONDARY,fontSize:12 }}>本月獲利</span>
                <span style={{ color:TEXT_MAIN,fontWeight:700,fontSize:15 }}>NT${profit.toLocaleString()}</span>
              </div>

              {/* 戰隊：只顯示全隊平均打卡率，不顯示個人名次；「戰隊」「我的夥伴」入口永遠顯示 */}
              {teamCard && (
                <div style={{ padding:'10px 0 4px',borderTop:'1px solid #F0F1F4' }}>
                  <p style={{ fontSize:12,color:TEXT_SECONDARY,margin:'0 0 8px',fontWeight:700 }}>戰隊本週打卡率</p>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <div style={{ flex:1,height:8,background:'#F0F1F4',borderRadius:RADIUS.pill,overflow:'hidden' }}>
                      <div style={{ height:'100%',borderRadius:RADIUS.pill,width:`${teamCard.teamAvgRate}%`,
                        background: teamCard.teamAvgRate>=70?ACCENT_GREEN:teamCard.teamAvgRate>=40?ACCENT_YELLOW:DANGER,
                        transition:'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>{teamCard.teamAvgRate}%</span>
                  </div>
                </div>
              )}
              <div style={{ display:'flex',gap:10,marginTop:12 }}>
                <button onClick={() => navigate('/team')}
                  style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                    padding:'10px 0',borderRadius:RADIUS.md,border:'1px solid #F0F1F4',
                    background:SUBCARD_BG,color:TEXT_MAIN,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                  <IconFlag size={16} stroke={1.9} color={PRIMARY} /> 戰隊
                </button>
                <button onClick={() => navigate('/partners')}
                  style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                    padding:'10px 0',borderRadius:RADIUS.md,border:'1px solid #F0F1F4',
                    background:SUBCARD_BG,color:TEXT_MAIN,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                  <IconUsersGroup size={16} stroke={1.9} color={PRIMARY} /> 我的夥伴
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 今天的 3-1-2：首頁主角，每一項一行 */}
        <section className="area-followup" style={{ background:CARD_BG,borderRadius:RADIUS.lg,marginBottom:10,padding:'14px 14px 10px',border:'1px solid #F0F1F4' }}>
          <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8 }}>
            <div style={{ fontSize:15,fontWeight:700,color:TEXT_MAIN }}>今天的 3-1-2</div>
            <div style={{ fontSize:11,color:TEXT_MUTED }}>建立長期有意義的關係</div>
          </div>

          {/* 3 互動 */}
          <div style={{ borderTop:'1px solid #F5F6F8',padding:'10px 0' }}>
            <button onClick={() => setInteractOpen(v => !v)}
              style={{ width:'100%',display:'flex',alignItems:'center',gap:10,background:'none',border:'none',padding:0,cursor:'pointer',textAlign:'left' }}>
              <span style={{ background:PRIMARY,color:'#fff',fontSize:12,fontWeight:700,width:22,height:22,flexShrink:0,
                borderRadius:RADIUS.circle,display:'flex',alignItems:'center',justifyContent:'center' }}>3</span>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>位互動</div>
                {!interactOpen && (
                  <div style={{ fontSize:12,color:TEXT_SECONDARY,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {interactionContacts.length === 0 ? '還沒有可以互動的聯絡人' : interactionContacts.map(c => c.name).join('、')}
                  </div>
                )}
              </div>
              {interactOpen ? <IconChevronUp size={16} stroke={1.9} color={TEXT_MUTED} /> : <IconChevronDown size={16} stroke={1.9} color={TEXT_MUTED} />}
            </button>
            {interactOpen && (
              <div style={{ marginTop:8,paddingLeft:32 }}>
                <div style={{ fontSize:11,color:TEXT_MUTED,marginBottom:8 }}>不要老是同樣那幾位</div>
                {interactionContacts.length===0
                  ? <p style={{ fontSize:13,color:TEXT_MUTED,margin:0 }}>還沒有可以互動的聯絡人，先去新增幾位吧</p>
                  : <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                      {interactionContacts.map(c=>(
                        <div key={c.id} style={{ display:'flex',alignItems:'center',gap:10 }}>
                          <Avatar name={c.name} size={28} />
                          <span onClick={()=>navigate(`/contacts/${c.id}`)}
                            style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN,flex:1,cursor:'pointer' }}>{c.name}</span>
                          <button onClick={()=>navigate(`/contacts/${c.id}`)}
                            style={{ background:PRIMARY_SOFT,color:PRIMARY,border:'none',borderRadius:RADIUS.xs,
                              padding:'5px 10px',fontSize:12,fontWeight:600,cursor:'pointer' }}>記一下</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}
          </div>

          {/* 1 會議 */}
          <div style={{ borderTop:'1px solid #F5F6F8',padding:'10px 0' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <span style={{ background:'#F97316',color:'#fff',fontSize:12,fontWeight:700,width:22,height:22,flexShrink:0,
                borderRadius:RADIUS.circle,display:'flex',alignItems:'center',justifyContent:'center' }}>1</span>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>
                  個會議{meetingContact && <span style={{ fontWeight:600,color:TEXT_SECONDARY }}>　{meetingContact.name}</span>}
                </div>
                <div style={{ fontSize:12,color:TEXT_SECONDARY,lineHeight:1.5 }}>
                  {meetingContact
                    ? getSuggestion(meetingContact)
                    : '目前沒有準備好約會議的人，先專心做 3 位互動就好'}
                </div>
                {!meetingContact && <div style={{ fontSize:11,color:TEXT_MUTED }}>別漫無目的，挑最接近臨門一腳的人</div>}
              </div>
              {meetingContact && (
                <button onClick={()=>{ markDaily312(supabase, user.id); navigate(`/contacts/${meetingContact.id}`) }}
                  style={{ background:'#F97316',color:'#fff',border:'none',borderRadius:RADIUS.xs,padding:'7px 10px',
                    fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0 }}>
                  {isContactWarm(meetingContact) ? '約時間碰面' : '先互動暖身'}
                </button>
              )}
            </div>
          </div>

          {/* 2 新名單 */}
          <div style={{ borderTop:'1px solid #F5F6F8',padding:'10px 0' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <span style={{ background:ACCENT_GREEN,color:'#fff',fontSize:12,fontWeight:700,width:22,height:22,flexShrink:0,
                borderRadius:RADIUS.circle,display:'flex',alignItems:'center',justifyContent:'center' }}>2</span>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>位新名單</div>
                <div style={{ fontSize:12,color:TEXT_SECONDARY,lineHeight:1.5 }}>
                  這週已經新增 {newContactCount} 位，去認識新朋友，不是從舊名單湊數
                </div>
              </div>
              <button onClick={()=>navigate('/contacts/new')}
                style={{ background:'#fff',color:ACCENT_GREEN_TEXT,border:`1.5px solid ${ACCENT_GREEN_TEXT}`,
                  borderRadius:RADIUS.xs,padding:'6px 10px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0 }}>+ 新增</button>
            </div>
          </div>

          <div style={{ textAlign:'right',borderTop:'1px solid #F5F6F8',paddingTop:8 }}>
            <button style={{ fontSize:12,color:PRIMARY,background:'none',border:'none',cursor:'pointer',fontWeight:700 }}
              onClick={()=>navigate('/contacts')}>查看全部聯絡人 →</button>
          </div>
        </section>

        {/* 老顧客關心：預設收成一行，點開才是名單 */}
        {careList.length > 0 && (
          <section className="area-care" style={{ marginBottom:10 }}>
            <div style={{ background:'#fff',border:'1px solid #F0F1F4',borderRadius:RADIUS.lg,overflow:'hidden' }}>
              <button onClick={() => setCareOpen(v => !v)}
                style={{ width:'100%',display:'flex',alignItems:'center',gap:8,background:'none',border:'none',
                  cursor:'pointer',padding:'12px 14px',textAlign:'left' }}>
                <span style={{ background:ACCENT_PINK_SOFT,color:ACCENT_PINK_TEXT,width:22,height:22,borderRadius:RADIUS.circle,flexShrink:0,
                  display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <IconHeart size={12} stroke={2.2} />
                </span>
                <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN,flex:1 }}>
                  老顧客，問問用得好不好
                </span>
                <span style={{ fontSize:12,fontWeight:700,color:ACCENT_PINK_TEXT,background:ACCENT_PINK_SOFT,
                  borderRadius:RADIUS.pill,padding:'2px 9px' }}>{careList.length} 位</span>
                {careOpen ? <IconChevronUp size={16} stroke={1.9} color={TEXT_MUTED} /> : <IconChevronDown size={16} stroke={1.9} color={TEXT_MUTED} />}
              </button>
              {careOpen && (
                <div style={{ padding:'0 14px 14px' }}>
                  <div style={{ fontSize:11,color:ACCENT_PINK_TEXT,marginBottom:8 }}>先關心，買不買是之後的事</div>
                  <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                    {careList.map(c => (
                      <div key={c.id} style={{ background:SUBCARD_BG,borderRadius:RADIUS.sm,padding:'10px 12px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                          <Avatar name={c.name} size={28} />
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN,wordBreak:'break-word',overflowWrap:'anywhere' }}>
                              {c.name}
                              {c.tag && (
                                <span style={{ marginLeft:6,fontSize:10,fontWeight:600,padding:'1px 7px',borderRadius:RADIUS.pill,
                                  background:ACCENT_YELLOW_SOFT,color:ACCENT_YELLOW_TEXT }}>{c.tag}</span>
                              )}
                            </div>
                            <div style={{ fontSize:12,color:TEXT_MAIN,lineHeight:1.5 }}>{c.line}</div>
                            {c.meta && <div style={{ fontSize:11,color:TEXT_MUTED }}>{c.meta}</div>}
                          </div>
                        </div>
                        <div style={{ display:'flex',gap:14,marginTop:8,paddingLeft:38,flexWrap:'wrap' }}>
                          <button onClick={() => navigate(c.contactId ? `/contacts/${c.contactId}` : `/customers/${c.id}`)}
                            style={{ background:'none',border:'none',padding:0,fontSize:12,fontWeight:700,color:ACCENT_PINK_TEXT,cursor:'pointer' }}>去聊聊 ›</button>
                          <button onClick={() => markCustomerCared(c.id)}
                            style={{ background:'none',border:'none',padding:0,fontSize:12,color:TEXT_SECONDARY,cursor:'pointer' }}>我關心過了</button>
                          <button onClick={() => snoozeCustomerCare(c.id)}
                            style={{ background:'none',border:'none',padding:0,fontSize:12,color:TEXT_MUTED,cursor:'pointer' }}>這次先不打擾</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {user && onboardingDone && (
          <section className="area-theme" style={{ marginBottom:10 }}>
            <StudyThemeCard user={user} />
          </section>
        )}

        {/* 今日打卡：預設一行，點開在原地勾選；每週、每月行動在「每日行動」頁 */}
        <section ref={checkinRef} className="area-checkin" style={{ background:CARD_BG,borderRadius:RADIUS.lg,marginBottom:10,border:'1px solid #F0F1F4',overflow:'hidden' }}>
          <button onClick={() => setCheckinOpen(v => !v)}
            style={{ width:'100%',display:'flex',alignItems:'center',gap:8,background:'none',border:'none',
              cursor:'pointer',padding:'12px 14px',textAlign:'left' }}>
            <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN,flex:1 }}>
              {isToday ? '今日打卡' : '打卡紀錄'}
            </span>
            <span style={{ fontSize:13,color:TEXT_SECONDARY,fontWeight:600 }}>{checkTotal}/{DAILY_TASKS.length}</span>
            {checkinOpen ? <IconChevronUp size={16} stroke={1.9} color={TEXT_MUTED} /> : <IconChevronDown size={16} stroke={1.9} color={TEXT_MUTED} />}
          </button>

          {checkinOpen && (
            <div style={{ padding:'0 14px 14px' }}>
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
              <div style={{ textAlign:'right',marginTop:10 }}>
                <button onClick={() => navigate('/daily')}
                  style={{ fontSize:12,color:PRIMARY,background:'none',border:'none',cursor:'pointer',fontWeight:700 }}>
                  每週、每月行動 ›
                </button>
              </div>
            </div>
          )}
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
