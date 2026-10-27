import SocialModal from './socialModal'
import GoalModal from './goalModal'
import WeeklyReviewCard from './weeklyReview'
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
  IconFlag, IconUsersGroup, IconHeart, IconChevronDown, IconChevronUp, IconX,
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
  DANGER, DANGER_SOFT, CARD_BG, PAGE_BG, SUBCARD_BG, RADIUS, ORANGE, ORANGE_TEXT, ORANGE_SOFT,
  getEggColor, getEggBg, avatarBg,
} from './designTokens'
import { resolveMode, resolveFavProducts, saveTagSetting, resolveWeeklyMeet, resolveEventWeeks } from './dailyMode'
import MonthBvCard, { BvTargetSheet, resolveBvTarget } from './monthBv'
import { fetchTrialStrips } from './trialRun'
import { pickMeetingContact, pickInviteCandidates, pickInteractionContacts, meetingReason, isContactWarm, isFreshFriend } from './followUp'
import { upcomingPlans, fmtPlanDate } from './meetingFlow'
import StudyThemeCard from './StudyThemeCard'
import { logCareInteraction } from './customerLink'
import { fetchUpcomingEvents, inviteToEvent, cancelInvite, isInvitedTo, daysUntil } from './eventInvite'
import { askConfirm } from './confirmDialog'
import { cardStyle, SectionHeader, Tile, SoftBtn, Tag } from './ui'


function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function greetingByHour() {
  const h = new Date().getHours()
  return h < 5 ? '夜深了' : h < 12 ? '早安' : h < 18 ? '午安' : '晚安'
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
      color:'#fff',fontWeight:600,fontSize:size*0.42,flexShrink:0 }}>
      {name?name[0]:'?'}
    </div>
  )
}
function ProgressBar({ value, max, color, trackColor }) {
  const pct = max>0 ? Math.min((value/max)*100,100) : 0
  return (
    <div style={{ background:trackColor||'var(--sub2)',borderRadius:RADIUS.pill,height:4,overflow:'hidden' }}>
      <div style={{ width:`${pct}%`,height:'100%',borderRadius:RADIUS.pill,background:color,
        transition:'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </div>
  )
}
function QuickBtn({ Icon, label, onClick, color, bg }) {
  return (
    <button onClick={onClick}
      style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
        padding:'12px 4px',borderRadius:RADIUS.lg,border:'none',background:bg,cursor:'pointer' }}>
      <Icon size={17} stroke={1.9} color={color} />
      <span style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN,whiteSpace:'nowrap' }}>{label}</span>
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showFullHome, setShowFullHome] = useState(() => { try { return localStorage.getItem('ufa_home_full') === '1' } catch { return false } })
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [bvTotal, setBvTotal] = useState(0)
  const [ibvTotal, setIbvTotal] = useState(0)
  const [profit, setProfit] = useState(0)
  const [activeContacts, setActiveContacts] = useState([])
  const [customerContactIds, setCustomerContactIds] = useState(() => new Set())
  const [skipMeeting, setSkipMeeting] = useState([])
  const [weekPlanned, setWeekPlanned] = useState(0)
  const [events, setEvents] = useState([])
  const [showNewList, setShowNewList] = useState(false)
  const [today312, setToday312] = useState({ contacted: [], fresh: 0, planCount: 0 })
  const [trialStrips, setTrialStrips] = useState([])
  const [progTab, setProgTab] = useState('season')
  const [showBvTarget, setShowBvTarget] = useState(false)
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
    // 記下最近一次關心，同時記成一筆互動（算進今天的 3 位互動）
    await logCareInteraction(supabase, customerId)
    fetchFollowUps()
  }
  async function snoozeCustomerCare(customerId) {
    setCareList(prev => prev.filter(c => c.id !== customerId))
    const until = toDateStr(new Date(Date.now() + 14 * 86400000))
    await supabase.from('customers').update({ care_snoozed_until: until }).eq('id', customerId)
  }

  async function fetchProfile() {
    const { data } = await supabase.from('users')
      .select('name, onboarding_done, why_here, created_at, tag_settings')
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
    const { count: contactCount } = await supabase
      .from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const { data: everCheckin } = await supabase
      .from('daily_checkins').select('id')
      .eq('user_id', user.id).eq('is_done', true).limit(1)
    const { count: logCount } = await supabase
      .from('contact_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const { count: txCount } = await supabase
      .from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const { count: sampleCount } = await supabase
      .from('sample_tracking').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const { data: userData } = await supabase
      .from('users').select('onboarding_done').eq('id', user.id).single()
    const tasks = {
      has_contact:     (contactCount || 0) > 0,
      has_log:         (logCount || 0) > 0,
      has_checkin:     (everCheckin || []).length > 0,
      has_transaction: (txCount || 0) > 0,
      has_sample:      (sampleCount || 0) > 0,
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
      .select('id,name,occupation,egg_type,need_level,action_type,relationship_stage,referral_stage,is_muted,last_interacted_at,created_at,source,next_plan,next_plan_date,need_tags,last_quote,interest_level,last_contact_date')
      .eq('user_id',user.id).eq('is_archived',false)
      .order('last_interacted_at',{ascending:true,nullsFirst:true}).limit(200)
    if (data) { setActiveContacts(data); fetchTrialStrips(user.id, data).then(setTrialStrips) }
    // 已是顧客的人：他們的互動照算，但不當「新名單」、也不被當成要邀約的對象
    const { data: custRows } = await supabase.from('customers')
      .select('contact_id').eq('user_id', user.id).eq('is_archived', false).not('contact_id', 'is', null)
    setCustomerContactIds(new Set((custRows || []).map(r => r.contact_id)))
    // 「這週已經新增」＝本結算週（週六 00:00 起）新增的聯絡人，不是往前數 7 天
    const weekStartTaipei = new Date(getWeekStart(today()) + 'T00:00:00+08:00').toISOString()
    const { count } = await supabase.from('contacts')
      .select('id',{count:'exact',head:true})
      .eq('user_id',user.id).is('source', null).gte('created_at',weekStartTaipei)
    setNewContactCount(count || 0)
    // 今天的 3-1-2 進度：互動過幾位、新增幾位、有沒有定下碰面
    const t = today()
    const { data: logs } = await supabase.from('contact_logs')
      .select('contact_id,kind').eq('user_id', user.id).eq('date', t)
    const { count: freshToday } = await supabase.from('contacts')
      .select('id',{count:'exact',head:true})
      .eq('user_id',user.id).is('source', null).gte('created_at', t + 'T00:00:00+08:00')
    // 本週（週六到週五）定下幾位碰面：同一位算一次，跟每週回顧算法一樣
    const wsDate = getWeekStart(t)
    const weDate = toDateStr(new Date(new Date(wsDate + 'T00:00:00').getTime() + 6 * 86400000))
    const { data: weekPlans } = await supabase.from('contact_logs')
      .select('contact_id').eq('user_id', user.id).eq('kind', 'meet_plan').gte('date', wsDate).lte('date', weDate)
    setWeekPlanned(new Set((weekPlans || []).map(l => l.contact_id)).size)
    setEvents(await fetchUpcomingEvents(supabase, 20))
    setToday312({
      contacted: [...new Set((logs || []).map(l => l.contact_id))],
      fresh: freshToday || 0,
      planCount: (logs || []).filter(l => l.kind === 'meet_plan').length,
    })
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

  // 新人（加入 14 天內）：先只看今天要做的事，不被本季進度、戰隊、共學主題嚇到
  const daysSinceJoin = profile?.created_at ? (Date.now() - new Date(profile.created_at).getTime()) / 86400000 : 999
  const isNewbie = daysSinceJoin < 14 && !showFullHome
  const CORE_TASKS = ['goal_declaration', 'daily_3_contacts', 'listen_recording']
  const shownTasks = isNewbie && !showAllTasks ? DAILY_TASKS.filter(t => CORE_TASKS.includes(t.key)) : DAILY_TASKS
  function toggleFullHome(v) {
    setShowFullHome(v)
    try { localStorage.setItem('ufa_home_full', v ? '1' : '0') } catch { /* ignore */ }
  }
  const displayName = profile?.name || user?.email?.split('@')[0] || 'Annie'
  const todayStr = (()=>{
    const d=new Date()
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} 星期${DAYS_ZH[d.getDay()]}`
  })()
  // 單純的顧客（沒有轉介紹進度）不被自動推薦；有轉介紹進度的才會進推薦
  const pickPool = activeContacts.filter(c => !(customerContactIds.has(c.id) && !c.referral_stage))
  const meetingContact = pickMeetingContact(pickPool, undefined, skipMeeting)
  const mode = resolveMode(profile?.tag_settings, profile?.created_at)
  const weeklyMeetTarget = resolveWeeklyMeet(profile?.tag_settings, mode)
  // 這週新增的名單（不含自動建立的顧客檔案），今天新增的另外標出來
  const weekStartMs = new Date(getWeekStart(today()) + 'T00:00:00+08:00').getTime()
  const todayStartMs = new Date(today() + 'T00:00:00+08:00').getTime()
  const newThisWeek = activeContacts
    .filter(c => !c.source && c.created_at && new Date(c.created_at).getTime() >= weekStartMs)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const newToday = newThisWeek.filter(c => new Date(c.created_at).getTime() >= todayStartMs)
  const newEarlier = newThisWeek.filter(c => new Date(c.created_at).getTime() < todayStartMs)
  function goAllNewest() {
    try { sessionStorage.setItem('contacts_sortBy', 'created'); sessionStorage.setItem('contacts_sortDir', 'desc'); sessionStorage.setItem('contacts_eggFilter', '全部') } catch { /* ignore */ }
    navigate('/contacts')
  }
  // 活動邀請：進了提醒範圍的活動列出可以邀的人，更遠的只顯示一行倒數
  const remindDays = resolveEventWeeks(profile?.tag_settings) * 7
  const nearEvents = events.filter(e => daysUntil(e.event_date) <= remindDays)
  const farEvent = events.find(e => daysUntil(e.event_date) > remindDays)
  async function handleInvite(c, ev) {
    const ok = await askConfirm({ title: `邀請 ${c.name} 參加？`, message: `會記成「邀請參加 ${ev.title}」，約在 ${fmtPlanDate(ev.event_date)}。`, okText: '記下' })
    if (!ok) return
    await inviteToEvent(supabase, user.id, c, ev)
    fetchFollowUps()
  }
  async function handleCancelInvite(c, ev) {
    const ok = await askConfirm({ title: `取消邀請 ${c.name}？`, message: `會清掉「邀請參加 ${ev.title}」這個約定。`, okText: '取消邀請', danger: true })
    if (!ok) return
    await cancelInvite(supabase, c, ev)
    fetchFollowUps()
  }
  const favProducts = resolveFavProducts(profile?.tag_settings)
  const doneContacts = today312.contacted.map(id => activeContacts.find(c => c.id === id)).filter(Boolean)
  const talkDone = today312.contacted.length
  const interactionContacts = pickInteractionContacts(pickPool, [meetingContact?.id, ...today312.contacted], Math.max(0, mode.talk - talkDone)).slice(0, 5)
  const all312 = talkDone >= mode.talk && today312.planCount >= mode.meet && today312.fresh >= mode.fresh
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
        .care-scroll { display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x mandatory; margin:0 -16px; padding:0 16px 4px; -webkit-overflow-scrolling:touch; }
        .care-scroll::-webkit-scrollbar { display:none; }
        .care-card { flex:0 0 82%; scroll-snap-align:start; }
        @media (min-width: 1024px) {
          .dash-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "quick quick"
              "starter starter"
              "todo checkin"
              "care checkin"
              "stats theme";
            gap: 0 18px;
            align-items: start;
          }
          .area-quick { grid-area: quick; }
          .area-starter { grid-area: starter; }
          .area-todo { grid-area: todo; }
          .area-care { grid-area: care; }
          .area-checkin { grid-area: checkin; }
          .area-stats { grid-area: stats; }
          .area-theme { grid-area: theme; }
          .care-scroll { flex-wrap:wrap; overflow:visible; margin:0; padding:0; }
          .care-card { flex:1 1 280px; }
        }
      `}</style>

      <div className="dashboard-wrap" style={{ padding:'20px 16px 0' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',gap:10 }}>
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:19,fontWeight:600,color:TEXT_MAIN,margin:0 }}>{greetingByHour()}，{displayName}</p>
            <p style={{ fontSize:12,color:TEXT_MUTED,margin:'4px 0 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {todayStr}
            </p>
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
        {whyHerePreview && (
          <p onClick={() => navigate('/settings')}
            style={{ fontSize:14,fontStyle:'italic',color:TEXT_SECONDARY,lineHeight:1.6,margin:'12px 0 0',
              padding:'2px 0 2px 12px',borderLeft:'2px solid var(--primary)',cursor:'pointer',overflowWrap:'anywhere' }}>
            「{whyHerePreview}」
          </p>
        )}
      </div>

      <div className="dashboard-wrap" style={{ padding:'12px 16px 0' }}>
        <div className="dash-grid">

        {/* 常用入口 */}
        <section className="area-quick">
          <div style={{ display:'flex',gap:8 }}>
            <QuickBtn Icon={IconUsers} label="+互動" color={ACCENT_YELLOW_TEXT} bg={ACCENT_YELLOW_SOFT} onClick={()=>navigate('/contacts/new')} />
            <QuickBtn Icon={IconChartBar} label="+業績" color={ACCENT_GREEN_TEXT} bg={ACCENT_GREEN_SOFT} onClick={()=>navigate('/transactions/new')} />
            <QuickBtn Icon={IconSearch} label="查顧客" color={ACCENT_PINK_TEXT} bg={ACCENT_PINK_SOFT} onClick={()=>navigate('/customers')} />
          </div>
        </section>

        {/* 新手起步：做完就消失 */}
        {showStarterCard && (
          <section className="area-starter" style={{ ...cardStyle, overflow:'hidden', marginTop:12 }}>
            {!starterExpanded && (
              <button onClick={() => setStarterExpanded(true)}
                style={{ width:'100%',background:'var(--card)',border:'none',cursor:'pointer',
                  padding:'10px 14px',display:'flex',alignItems:'center',gap:10 }}>
                <IconRocket size={15} stroke={1.9} color={PRIMARY} />
                <span style={{ fontSize:12,fontWeight:600,color:TEXT_MAIN,whiteSpace:'nowrap' }}>新手起步</span>
                <div style={{ flex:1,height:5,background:PRIMARY_SOFT,borderRadius:RADIUS.pill,overflow:'hidden' }}>
                  <div style={{ height:'100%',borderRadius:RADIUS.pill,background:PRIMARY,
                    width:`${Math.round((starterDoneCount/STARTER_TASKS.length)*100)}%`,
                    transition:'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize:12,fontWeight:600,color:PRIMARY,whiteSpace:'nowrap' }}>
                  {starterDoneCount}/{STARTER_TASKS.length}
                </span>
                <IconChevronDown size={14} stroke={1.9} color={TEXT_MUTED} />
              </button>
            )}
            {starterExpanded && (
              <div style={{ background:'var(--card)' }}>
                <div style={{ padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div>
                    <p style={{ fontSize:14,fontWeight:600,color:TEXT_MAIN,margin:0,display:'flex',alignItems:'center',gap:6 }}>
                      <IconRocket size={15} stroke={1.9} color={PRIMARY} /> 新手起步任務
                    </p>
                    <p style={{ fontSize:11,color:TEXT_MUTED,margin:'4px 0 0' }}>完成這 5 件事，讓你的事業正式起步！</p>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:12,fontWeight:600,background:PRIMARY_SOFT,color:PRIMARY,
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
                        padding:'9px 0',borderTop:'1px solid var(--sub2)' }}>
                        <div style={{ width:20,height:20,borderRadius:RADIUS.circle,flexShrink:0,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          background: done ? ACCENT_GREEN : 'var(--border)',
                          border: done ? 'none' : '1.5px solid var(--border2)' }}>
                          {done && <span style={{ fontSize:11,color:'#fff' }}>✓</span>}
                        </div>
                        <span style={{ fontSize:13,fontWeight:600,color: done?TEXT_MUTED:TEXT_MAIN,
                          textDecoration: done?'line-through':'none',flex:1 }}>
                          {task.label}
                        </span>
                        {done && <span style={{ fontSize:11,color:ACCENT_GREEN_TEXT,fontWeight:600 }}>完成</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 今天要做的：3-1-2，三張同規格的卡 */}
        <section className="area-todo">
          <SectionHeader title={`今天的 ${mode.label}`} hint="查看全部聯絡人 ›" onHint={()=>navigate('/contacts')} hintColor={PRIMARY} />

          <div style={{ ...cardStyle, overflow:'hidden' }}>
          {trialStrips.map(ts => (
            <div key={ts.contactId} onClick={()=>navigate(`/contacts/${ts.contactId}`)}
              style={{ padding:'10px 14px', background:PRIMARY_SOFT, cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:13,fontWeight:600,color:PRIMARY }}>{ts.text}</div>
            </div>
          ))}
          {all312 && (
            <div style={{ padding:'12px 14px', background:ACCENT_GREEN_SOFT, color:ACCENT_GREEN_TEXT, fontSize:14, fontWeight:600, borderBottom:'1px solid var(--border)' }}>
              今天的 {mode.label} 做滿了
            </div>
          )}
          {upcomingPlans(activeContacts).map(c => (
            <div key={c.id} onClick={()=>navigate(`/contacts/${c.id}`)}
              style={{ padding:'10px 14px', background:PRIMARY_SOFT, cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:13,fontWeight:600,color:PRIMARY }}>
                {fmtPlanDate(c.next_plan_date)} 和{c.name}　{c.next_plan}
              </div>
              {(c.need_tags||[]).length>0 && (
                <div style={{ fontSize:12,color:TEXT_SECONDARY,marginTop:2 }}>她在意：{c.need_tags.join('、')}</div>
              )}
            </div>
          ))}
          <div style={{ padding:14, display:'flex', gap:12 }}>
            <Tile bg={PRIMARY_SOFT} color={PRIMARY}>{mode.talk}</Tile>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14,fontWeight:600,color:TEXT_MAIN }}>
                <span style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                  <span>位互動<span style={{ fontSize:11,fontWeight:400,color:TEXT_MUTED,marginLeft:8 }}>不要老是同樣那幾位</span></span>
                  <span style={{ fontSize:13,fontWeight:600,color:PRIMARY,whiteSpace:'nowrap' }}>今天 {Math.min(talkDone,mode.talk)}/{mode.talk}</span>
                </span>
              </div>
              {mode.talk > 3 && (
                <div style={{ height:6, background:SUBCARD_BG, borderRadius:3, marginTop:8 }}>
                  <div style={{ width:`${Math.min(100, Math.round(talkDone / mode.talk * 100))}%`, height:6, background:PRIMARY, borderRadius:3 }} />
                </div>
              )}
              {interactionContacts.length===0 && doneContacts.length===0
                ? <p style={{ fontSize:12,color:TEXT_SECONDARY,margin:'6px 0 0' }}>還沒有可以互動的聯絡人，先去新增幾位吧</p>
                : <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginTop:8 }}>
                    {doneContacts.map(c=>(
                      <button key={'d'+c.id} onClick={()=>navigate(`/contacts/${c.id}`)}
                        style={{ display:'inline-flex',alignItems:'center',gap:6,background:SUBCARD_BG,border:'none',
                          borderRadius:RADIUS.pill,padding:'3px 12px 3px 3px',cursor:'pointer',opacity:0.6,
                          fontSize:12,fontWeight:600,color:TEXT_MUTED,textDecoration:'line-through' }}>
                        <Avatar name={c.name} size={24} />{c.name}
                      </button>
                    ))}
                    {interactionContacts.map(c=>(
                      <button key={c.id} onClick={()=>navigate(`/contacts/${c.id}`)}
                        style={{ display:'inline-flex',alignItems:'center',gap:6,background:SUBCARD_BG,border:'none',
                          borderRadius:RADIUS.pill,padding:'3px 12px 3px 3px',cursor:'pointer',
                          fontSize:12,fontWeight:600,color:TEXT_MAIN }}>
                        <Avatar name={c.name} size={24} />{c.name}
                        {isFreshFriend(c) && <span style={{ fontSize:11,fontWeight:400,color:ACCENT_GREEN_TEXT }}>新朋友</span>}
                      </button>
                    ))}
                  </div>
              }
              {interactionContacts.length>0 && (
                <div style={{ fontSize:11,color:TEXT_MUTED,marginTop:6 }}>點名字，到他的頁面記一下</div>
              )}
            </div>
          </div>

          <div style={{ padding:14, display:'flex', gap:12, alignItems:'center', borderTop:'1px solid var(--border)' }}>
            <Tile bg={ORANGE_SOFT} color={ORANGE_TEXT}>{mode.meet}</Tile>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14,fontWeight:600,color:TEXT_MAIN }}>
                <span style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                  <span>{mode.meet > 1 ? '個約會' : '個會議'}{meetingContact && <span style={{ fontWeight:500,marginLeft:8 }}>{meetingContact.name}</span>}</span>
                  {weeklyMeetTarget > 0
                    ? <span style={{ fontSize:13,fontWeight:600,whiteSpace:'nowrap',color: weekPlanned >= weeklyMeetTarget ? ACCENT_GREEN_TEXT : TEXT_SECONDARY }}>本週 {weekPlanned}/{weeklyMeetTarget}</span>
                    : <span style={{ fontSize:13,fontWeight:600,whiteSpace:'nowrap',color: today312.planCount >= mode.meet ? ACCENT_GREEN_TEXT : TEXT_SECONDARY }}>{mode.meet > 1 ? `今天 ${Math.min(today312.planCount, mode.meet)}/${mode.meet}` : (today312.planCount >= 1 ? '今天已定下' : '還沒定下')}</span>}
                </span>
              </div>
              <div style={{ fontSize:12,color:TEXT_SECONDARY,lineHeight:1.5,marginTop:2 }}>
                {meetingContact
                  ? (mode.meet > 1 ? '其中 1 個由你主持。建議：' + meetingContact.name + '，' : '') + meetingReason(meetingContact)
                  : '今天沒有適合約的人，先把 ' + mode.talk + ' 位互動做完，聊出下一位'}
              </div>
              {meetingContact && favProducts.length > 0 && (
                <div style={{ fontSize:12,color:TEXT_SECONDARY,marginTop:2 }}>
                  可以聊：你自己用{favProducts[0].name}{favProducts[0].note ? '，' + favProducts[0].note : ''}
                </div>
              )}
              {meetingContact && meetingContact.last_quote && (
                <div style={{ fontSize:12,color:TEXT_MUTED,marginTop:2,fontStyle:'italic' }}>上次她說：「{meetingContact.last_quote}」</div>
              )}
              {weeklyMeetTarget > 0 && (
                <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:'4px 8px', marginTop:6 }}>
                  {weeklyMeetTarget <= 7
                    ? <div style={{ display:'flex', gap:4 }}>
                        {Array.from({ length: weeklyMeetTarget }).map((_, i) => (
                          <span key={i} style={{ width:14, height:14, borderRadius:7, background: i < weekPlanned ? ORANGE : 'var(--border)' }} />
                        ))}
                      </div>
                    : <div style={{ width:90, height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                        <div style={{ width: Math.min(100, Math.round(weekPlanned / weeklyMeetTarget * 100)) + '%', height:'100%', background:ORANGE }} />
                      </div>}
                  <span style={{ fontSize:11, color:TEXT_MUTED, whiteSpace:'nowrap' }}>{today312.planCount >= 1 ? '今天已定下' : '今天還沒定下'}</span>
                </div>
              )}
              {nearEvents.map(ev => {
                const invited = activeContacts.filter(c => isInvitedTo(c, ev))
                const cands = pickInviteCandidates(pickPool, ev.id, 5)
                const n = daysUntil(ev.event_date)
                return (
                  <div key={ev.id} style={{ marginTop:10, paddingTop:8, borderTop:'1px dashed var(--border)' }}>
                    <div style={{ fontSize:12,fontWeight:600,color:ORANGE_TEXT }}>
                      {fmtPlanDate(ev.event_date)} {ev.title}，{n === 0 ? '就是今天' : n === 1 ? '明天' : `還有 ${n} 天`}
                    </div>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginTop:6 }}>
                      {invited.map(c => (
                        <button key={'i'+c.id} onClick={() => handleCancelInvite(c, ev)}
                          style={{ background:ACCENT_GREEN_SOFT,border:'none',borderRadius:RADIUS.pill,padding:'4px 12px',cursor:'pointer',
                            fontSize:12,fontWeight:600,color:ACCENT_GREEN_TEXT }}>
                          {c.name} 已邀
                        </button>
                      ))}
                      {cands.map(c => (
                        <button key={c.id} onClick={() => handleInvite(c, ev)}
                          style={{ background:SUBCARD_BG,border:'none',borderRadius:RADIUS.pill,padding:'4px 12px',cursor:'pointer',
                            fontSize:12,fontWeight:600,color:TEXT_MAIN }}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                    {cands.length > 0 && <div style={{ fontSize:11,color:TEXT_MUTED,marginTop:4 }}>點名字，記成邀請參加並約在那天</div>}
                  </div>
                )
              })}
              {farEvent && (
                <div style={{ fontSize:11,color:TEXT_MUTED,marginTop:8 }}>
                  {fmtPlanDate(farEvent.event_date)} {farEvent.title} · 還有 {daysUntil(farEvent.event_date)} 天
                </div>
              )}
              {!meetingContact && <div style={{ fontSize:11,color:TEXT_MUTED }}>1 是定下一個碰面，不用急，也別漫無目的</div>}
            </div>
            {meetingContact && (
              <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'stretch' }}>
                <SoftBtn solid color={ORANGE}
                  onClick={()=>navigate(`/contacts/${meetingContact.id}`)}>
                  {isContactWarm(meetingContact) ? '約下一次' : '先暖身'}
                </SoftBtn>
                <button onClick={()=>setSkipMeeting(s => [...s, meetingContact.id])}
                  style={{ background:'none', border:'none', color:TEXT_SECONDARY, fontSize:12, padding:'4px 0', cursor:'pointer' }}>
                  換一位
                </button>
              </div>
            )}
          </div>

          <div style={{ padding:14, display:'flex', gap:12, alignItems:'center', borderTop:'1px solid var(--border)' }}>
            <Tile bg={ACCENT_GREEN_SOFT} color={ACCENT_GREEN_TEXT}>{mode.fresh}</Tile>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14,fontWeight:600,color:TEXT_MAIN, display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <span>位新名單</span>
                <span style={{ fontSize:13,fontWeight:600,color:ACCENT_GREEN_TEXT,whiteSpace:'nowrap' }}>今天 {Math.min(today312.fresh,mode.fresh)}/{mode.fresh}</span>
              </div>
              <div style={{ fontSize:12,color:TEXT_SECONDARY,lineHeight:1.5,marginTop:2 }}>
                去認識新朋友，不是從舊名單湊數。這週已新增 {newContactCount} 位
              </div>
              {newThisWeek.length > 0 && (
                <button onClick={() => setShowNewList(v => !v)}
                  style={{ background:'none',border:'none',padding:'4px 0 0',cursor:'pointer',fontSize:12,fontWeight:600,color:ACCENT_GREEN_TEXT }}>
                  {showNewList ? '收起 ‹' : '看是誰 ›'}
                </button>
              )}
              {showNewList && (
                <div style={{ marginTop:6 }}>
                  {[['今天', newToday], ['這週稍早', newEarlier]].filter(g => g[1].length > 0).map(([label, list]) => (
                    <div key={label} style={{ marginTop:4 }}>
                      <div style={{ fontSize:11,color:TEXT_MUTED }}>{label} {list.length} 位</div>
                      <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginTop:4 }}>
                        {list.map(c => (
                          <button key={c.id} onClick={() => navigate(`/contacts/${c.id}`)}
                            style={{ display:'inline-flex',alignItems:'center',gap:6,background:SUBCARD_BG,border:'none',
                              borderRadius:RADIUS.pill,padding:'3px 12px 3px 3px',cursor:'pointer',fontSize:12,fontWeight:600,color:TEXT_MAIN }}>
                            <Avatar name={c.name} size={24} />{c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button onClick={goAllNewest}
                    style={{ background:'none',border:'none',padding:'8px 0 0',cursor:'pointer',fontSize:12,fontWeight:600,color:PRIMARY }}>
                    依最近新增看全部名單 ›
                  </button>
                </div>
              )}
            </div>
            <SoftBtn bg={ACCENT_GREEN_SOFT} color={ACCENT_GREEN_TEXT} onClick={()=>navigate('/contacts/new')}>+ 新增</SoftBtn>
          </div>
          </div>
        </section>

        {/* 老顧客關心：橫向滑動的卡片，露出下一張的邊緣 */}
        {careList.length > 0 && (
          <section className="area-care">
            <SectionHeader title="老顧客，問問用得好不好" hint="先關心，買不買是之後的事" hintColor={ACCENT_PINK_TEXT} />
            <div className="care-scroll">
              {careList.map(c => (
                <div key={c.id} className="care-card"
                  style={{ background:'var(--card)',border:`1px solid var(--pink-border)`,borderRadius:RADIUS.card,padding:12 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:6 }}>
                    <Avatar name={c.name} size={32} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:600,color:TEXT_MAIN,wordBreak:'break-word',overflowWrap:'anywhere' }}>{c.name}</div>
                      {c.tag && <Tag bg={ACCENT_YELLOW_SOFT} color={ACCENT_YELLOW_TEXT}>{c.tag}</Tag>}
                    </div>
                  </div>
                  <div style={{ fontSize:12,color:TEXT_MAIN,lineHeight:1.5 }}>{c.line}</div>
                  {c.meta && <div style={{ fontSize:11,color:TEXT_MUTED,marginTop:2 }}>{c.meta}</div>}
                  <div style={{ display:'flex',alignItems:'center',gap:14,marginTop:10,flexWrap:'wrap' }}>
                    <SoftBtn bg={ACCENT_PINK_SOFT} color={ACCENT_PINK_TEXT}
                      onClick={() => navigate(c.contactId ? `/contacts/${c.contactId}` : `/customers/${c.id}`)}>去聊聊 ›</SoftBtn>
                    <button onClick={() => markCustomerCared(c.id)}
                      style={{ background:'none',border:'none',padding:0,fontSize:12,color:TEXT_SECONDARY,cursor:'pointer' }}>我關心過了</button>
                    <button onClick={() => snoozeCustomerCare(c.id)}
                      style={{ background:'none',border:'none',padding:0,fontSize:12,color:TEXT_MUTED,cursor:'pointer' }}>這次先不打擾</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 今日打卡：維持原樣 */}
        <section className="area-checkin">
          <SectionHeader title={isToday ? '今日打卡' : '打卡紀錄'} hint={`${checkTotal}/${DAILY_TASKS.length}`} />
          <div style={{ ...cardStyle, padding:'12px 14px 12px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
              marginBottom:10,background:SUBCARD_BG,borderRadius:RADIUS.md,padding:'6px 10px' }}>
              <button onClick={() => changeDate(-1)}
                style={{ background:'none',border:'none',color:TEXT_SECONDARY,
                  fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1 }}>‹</button>
              <div style={{ textAlign:'center' }}>
                <span style={{ fontSize:13,fontWeight:600,color: isToday?PRIMARY:'var(--yellow-text)' }}>
                  {isToday ? '今天' : formatDateLabel(viewDate)}
                </span>
                {!isToday && (
                  <button onClick={() => setViewDate(today())}
                    style={{ marginLeft:8,fontSize:11,color:PRIMARY,background:'none',
                      border:'none',cursor:'pointer',fontWeight:600 }}>回今天</button>
                )}
              </div>
              <button onClick={() => changeDate(1)}
                style={{ background:'none',border:'none',
                  color: isToday?'var(--border2)':TEXT_SECONDARY,
                  fontSize:18,cursor: isToday?'default':'pointer',
                  padding:'0 4px',lineHeight:1 }}>›</button>
            </div>

            <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 4px',
              background:SUBCARD_BG,borderRadius:RADIUS.md,marginBottom:8 }}>
              {weekStatus.map((w,i)=>{
                const isSelected = w.date === viewDate
                const isT = w.date === today()
                const dc=w.status==='full'?ACCENT_GREEN:w.status==='partial'?ACCENT_YELLOW:'var(--border)'
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
              {shownTasks.map(task=>{
                const done=!!checkins[task.key]
                const hasAction = task.url || task.internalPath || task.social || task.toContacts || task.key === 'goal_declaration'
                const TaskIcon = task.Icon
                return (
                  <div key={task.key} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',
                    borderBottom:'1px solid var(--sub2)' }}>
                    <button onClick={()=>toggleCheckin(task.key)}
                      style={{ width:20,height:20,borderRadius:7,flexShrink:0,
                        border:done?'none':'2px solid var(--border2)',background:done?ACCENT_GREEN:'var(--card)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        transition:'all 0.15s',cursor:'pointer' }}>
                      {done&&<span className="ufa-pop" style={{ fontSize:11,color:'#fff',lineHeight:1 }}>✓</span>}
                    </button>
                    <TaskIcon size={16} stroke={1.9} color={done?'var(--border2)':PRIMARY} />
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
                                style={{ color:ACCENT_GREEN_TEXT,fontWeight:600,cursor:'pointer',
                                  textDecoration:'underline' }}>
                                {c.name}{i<viewContacted.length-1?'、':''}
                              </span>
                            ))}
                            <span style={{ color:ACCENT_GREEN_TEXT,fontWeight:600 }}>✓</span>
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
            {isNewbie && !showAllTasks && (
              <div style={{ textAlign:'center',marginTop:6 }}>
                <button onClick={() => setShowAllTasks(true)}
                  style={{ fontSize:12,color:TEXT_SECONDARY,background:'none',border:'none',cursor:'pointer',padding:'8px 12px' }}>更多 ▾</button>
              </div>
            )}
            {DAILY_TASKS.length>0 && DAILY_TASKS.every(t=>checkins[t.key]) && (
              <div style={{ textAlign:'center',padding:'12px 0 2px',fontSize:13,color:ACCENT_GREEN_TEXT,fontWeight:500 }}>
                今天的行動都完成了，好好休息。
              </div>
            )}
            <div style={{ textAlign:'right',marginTop:10 }}>
              <button onClick={() => navigate('/daily')}
                style={{ fontSize:12,color:PRIMARY,background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
                每週、每月行動 ›
              </button>
            </div>
          </div>
        </section>

        {/* 本季進度：看結果的區塊，放在要做的事後面 */}
        {isNewbie && (
          <section className="area-stats" style={{ marginTop:16,textAlign:'center' }}>
            <div style={{ fontSize:12,color:TEXT_MUTED,lineHeight:1.6 }}>本季進度、戰隊、共學主題會在第 15 天出現</div>
            <button onClick={() => toggleFullHome(true)}
              style={{ fontSize:13,color:PRIMARY,background:'none',border:'none',cursor:'pointer',padding:'8px 12px',fontWeight:600 }}>現在就看全部</button>
          </section>
        )}
        {!isNewbie && (
        <section className="area-stats">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, margin:'16px 4px 8px' }}>
            <span style={{ fontSize:15, fontWeight:600, color:TEXT_MAIN }}>
              進度{progTab === 'season' && <span onClick={()=>navigate('/transactions')} style={{ fontSize:12, fontWeight:400, color:PRIMARY, marginLeft:10, cursor:'pointer' }}>查看詳情 ›</span>}
            </span>
            <div style={{ display:'flex', gap:4 }}>
              {[['season','本季'],['month','本月顧客']].map(([k,label]) => (
                <button key={k} onClick={()=>setProgTab(k)}
                  style={{ border:'none', cursor:'pointer', padding:'4px 12px', borderRadius:RADIUS.pill, fontSize:12,
                    fontWeight: progTab===k ? 600 : 400,
                    background: progTab===k ? PRIMARY_SOFT : 'transparent', color: progTab===k ? PRIMARY : TEXT_SECONDARY }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {progTab === 'month' && user && (
            <MonthBvCard userId={user.id} target={resolveBvTarget(profile?.tag_settings)} onEditTarget={()=>setShowBvTarget(true)} />
          )}
          {progTab !== 'month' && (
          <div style={{ ...cardStyle,padding:'18px 18px 16px',color:TEXT_MAIN }}>
            <div style={{ display:'flex',gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                  <span style={{ fontSize:12,fontWeight:600,color:ORANGE_TEXT }}>BV</span>
                  <span style={{ fontSize:22,fontWeight:500,fontVariantNumeric:'tabular-nums',letterSpacing:-0.5 }}>{bvTotal.toFixed(0)} <span style={{ color:'var(--muted)',fontSize:12,fontWeight:400 }}>/ {BV_GOAL}</span></span>
                </div>
                <ProgressBar value={bvTotal} max={BV_GOAL} color={ORANGE} trackColor="var(--sub2)" />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                  <span style={{ fontSize:12,fontWeight:600,color:PRIMARY }}>IBV</span>
                  <span style={{ fontSize:22,fontWeight:500,fontVariantNumeric:'tabular-nums',letterSpacing:-0.5 }}>{ibvTotal.toFixed(0)} <span style={{ color:'var(--muted)',fontSize:12,fontWeight:400 }}>/ {IBV_GOAL}</span></span>
                </div>
                <ProgressBar value={ibvTotal} max={IBV_GOAL} color={PRIMARY} trackColor="var(--sub2)" />
              </div>
            </div>
            <div style={{ display:'flex',marginTop:12,paddingTop:10,borderTop:'1px solid var(--border)' }}>
              <div style={{ flex:1.2 }}>
                <div style={{ fontSize:11,color:'var(--text2)' }}>本月獲利</div>
                <div style={{ fontSize:15,fontWeight:600 }}>NT${profit.toLocaleString()}</div>
              </div>
              <div style={{ flex:1,borderLeft:'1px solid var(--border)',paddingLeft:12 }}>
                <div style={{ fontSize:11,color:'var(--text2)' }}>本週訪談</div>
                <div style={{ fontSize:15,fontWeight:600 }}>
                  {meetupCard ? meetupCard.count : '–'}<span style={{ color:'var(--muted)',fontSize:12,fontWeight:400 }}>/2</span>
                </div>
                {meetupCard && (
                  <div style={{ fontSize:11,color:'var(--text2)' }}>
                    {meetupCard.count === 0 ? '想約誰？' : meetupCard.count === 1 ? '只差一位' : '達標了'}
                    {meetupCard.streak >= 2 && `・連續 ${meetupCard.streak} 週`}
                  </div>
                )}
              </div>
              {teamCard && (
                <div style={{ flex:1,borderLeft:'1px solid var(--border)',paddingLeft:12 }}>
                  <div style={{ fontSize:11,color:'var(--text2)' }}>戰隊打卡率</div>
                  <div style={{ fontSize:15,fontWeight:600 }}>{teamCard.teamAvgRate}%</div>
                </div>
              )}
            </div>
          </div>
          )}
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <button onClick={() => navigate('/team')}
              style={{ ...cardStyle, flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                padding:'10px 0',color:TEXT_MAIN,fontSize:13,fontWeight:600,cursor:'pointer' }}>
              <IconFlag size={16} stroke={1.9} color={PRIMARY} /> 戰隊
            </button>
            <button onClick={() => navigate('/partners')}
              style={{ ...cardStyle, flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                padding:'10px 0',color:TEXT_MAIN,fontSize:13,fontWeight:600,cursor:'pointer' }}>
              <IconUsersGroup size={16} stroke={1.9} color={PRIMARY} /> 我的夥伴
            </button>
          </div>
        </section>

        )}
        {showBvTarget && (
          <BvTargetSheet current={resolveBvTarget(profile?.tag_settings)}
            onClose={()=>setShowBvTarget(false)}
            onSave={async (n) => {
              setShowBvTarget(false)
              setProfile(p => ({ ...(p||{}), tag_settings: { ...((p&&p.tag_settings)||{}), bv_target: n } }))
              await saveTagSetting(user.id, { bv_target: n })
            }} />
        )}

        {user && onboardingDone && !isNewbie && (
          <section className="area-review" style={{ marginTop:16 }}>
            <WeeklyReviewCard userId={user.id} />
          </section>
        )}

        {user && onboardingDone && !isNewbie && (
          <section className="area-theme" style={{ marginTop:16 }}>
            <StudyThemeCard user={user} />
          </section>
        )}

        </div>
        <div style={{ height:80 }} />
      </div>

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
    </div>
  )
}
