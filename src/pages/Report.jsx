// Report.jsx — 給帶領者的報告：只列事實（數字、人、互動內容），判斷留給帶領者。
// 入口：每日行動 → 每週行動卡片右上角「給帶領者的報告 ›」；首頁 › 本週回顧（點開）最下面「給帶領者的報告 ›」。
// 順序：想討論 → 成果（跟分享圖卡同一套算法）→ 行動和目標 → 潛在夥伴（分組）→ 首選 10 → 顧客。
// 手機：複製按鈕固定在畫面下面；電腦：左邊設定和卡片，右邊是要貼出去的文字和複製按鈕。
// 選最近 3／5／7 天或自選日期（最多 31 天）。「做了什麼」只列實際的數字；「目標」另外看：每天 3-1-2 和每週目標（週六到週五）。
// 每一筆互動可以選「不放」進報告（只記在這台手機）。
// 兩個開關（顧客交易、互動內容）和討論事項存在 users.tag_settings，不用另外建表。
import { fetchTop10, top10NeedsAction, TOP10_MAX, weekStartOf } from './top10'
import { planOf } from './invite'
import { NO_HEAD, SUPERSEDED } from './beanJar'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import LoadingSpinner from './LoadingSpinner'
import { RangeCalendar } from './rangeCalendar'
import { loadPeriod, loadActionDays } from './periodData'
import { resultTiles, dayFull, groupPeople, GROUP_TITLES, INVITE_KINDS } from '../lib/results'
import { saveTagSetting, resolveMode, resolveWeeklyMeet, resolveWeeklyMet } from './dailyMode'
import { taipeiToday, addDaysStr, splitTime, fetchUnplannedMeets } from './meetings'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_SECONDARY, TEXT_MUTED, BORDER, SUBCARD_BG,
  ACCENT_GREEN_TEXT, ACCENT_YELLOW_TEXT,
} from './designTokens'

const NEED_RANK = { '大四': 4, '大三': 3, '大二': 2, '大一': 1 }
const NEED_DESC = { '大一': '沒需求', '大二': '小抱怨', '大三': '想改變', '大四': '有行動' }
const RANK = { '很有興趣': 4, '有點興趣': 3, '觀望中': 2, '看不出來': 1, '沒興趣': 0 }
const WD = ['日', '一', '二', '三', '四', '五', '六']
const md = ds => { const [, m, d] = ds.split('-'); return `${+m}/${+d}` }
const wday = ds => WD[new Date(ds + 'T00:00:00').getDay()]
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
const tpDate = iso => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
const nt = n => 'NT$ ' + Math.round(n).toLocaleString()

// 抓一段日期內的所有事實（行動和成果用 periodData，跟分享圖卡同一份算法）
async function loadFacts(userId, from, to) {
  const [P, cntR, allCustR, orderR, ctR] = await Promise.all([
    loadPeriod(userId, from, to, { rich: true }),
    supabase.from('counter_logs').select('counter_key,date')
      .eq('user_id', userId).eq('is_done', true).in('counter_key', ['bv_share', 'ibv_share']).gte('date', from).lte('date', to),
    supabase.from('customers').select('id,name,contact_id,last_cared_at')
      .eq('user_id', userId).eq('is_archived', false).limit(500),
    supabase.from('transactions').select('customer_id,date,is_gift,line_kind,product_name')
      .eq('user_id', userId).not('customer_id', 'is', null).order('date', { ascending: false }).limit(3000),
    supabase.from('contacts').select('id,last_interacted_at,last_contact_date').eq('user_id', userId).limit(2000),
  ])
  const { days, allLogs, logs, unplanned } = P
  const custs = allCustR.data || []
  const custByContact = new Map(custs.filter(c => c.contact_id).map(c => [c.contact_id, c]))
  const careLogs = allLogs.filter(l => !logs.includes(l))
  const care = buildCare(careLogs, custByContact, custs, from, to, to)
  const careIds = new Set(care.map(c => c.cid))
  const lastOrder = {}
  ;(orderR.data || []).forEach(t => { if (!t.is_gift && !t.line_kind && !lastOrder[t.customer_id]) lastOrder[t.customer_id] = { date: t.date, name: t.product_name } })
  const ctMap = new Map((ctR.data || []).map(c => [c.id, c]))
  const lapsed = []
  custs.forEach(c => {
    if (careIds.has(c.id) || !lastOrder[c.id]) return
    const ct = c.contact_id ? ctMap.get(c.contact_id) : null
    const times = [c.last_cared_at ? tpDate(c.last_cared_at) : '', ct && ct.last_interacted_at ? tpDate(ct.last_interacted_at) : '', ct && ct.last_contact_date ? ct.last_contact_date : ''].filter(Boolean).sort()
    const lastCare = times.pop() || ''
    const days2 = lastCare ? dayDiff(lastCare, to) : null
    if (days2 !== null && days2 <= 30) return
    lapsed.push({ id: c.id, name: c.name, days: days2, order: lastOrder[c.id] })
  })
  lapsed.sort((a, b) => (b.days === null ? 9999 : b.days) - (a.days === null ? 9999 : a.days))
  // 首選 10：欄位還沒建好時 ok=false，報告不顯示這一段
  const t10 = await fetchTop10(userId)
  let pick10 = { ok: false }
  if (t10.ok) {
    const touchedIds = new Set(allLogs.map(l => l.contact_id))
    const plannedIds = new Set([...allLogs.filter(l => l.kind === 'meet_plan'), ...(await fetchUnplannedMeets(userId, from, to))].map(l => l.contact_id))
    pick10 = {
      ok: true, total: t10.rows.length,
      touched: t10.rows.filter(r => touchedIds.has(r.id)).map(r => r.name),
      untouched: t10.rows.filter(r => !touchedIds.has(r.id)).map(r => r.name),
      planned: t10.rows.filter(r => plannedIds.has(r.id)).length,
      swap: t10.rows.map(r => ({ name: r.name, reason: top10NeedsAction(r) })).filter(x => x.reason),
    }
  }
  let sale = 0, profit = 0
  P.tx.forEach(t => { sale += t.amount || 0; if (!t.is_gift) profit += (t.amount || 0) - (t.cost || 0) })
  const planned = new Set([...logs.filter(l => l.kind === 'meet_plan'), ...unplanned].map(l => l.contact_id))
  return {
    days, logs, perDay: P.actions.perDay, care, lapsed, pick10, results: P.results,
    met: P.results.met.length,
    plan: planned.size,
    // 開口邀約幾次：約成的、沒先約直接見的、邀了沒約成的
    asks: P.actions.asks,
    askBreak: askBreakdown(logs, unplanned),
    fresh: P.actions.fresh,
    talk: P.actions.talk,
    bvShare: (cntR.data || []).filter(c => c.counter_key === 'bv_share').length,
    ibvShare: (cntR.data || []).filter(c => c.counter_key === 'ibv_share').length,
    newCust: P.results.newCust.length,
    bv: P.results.bv, ibv: P.results.ibv, sale, profit,
  }
}

// 開口邀約的結果：約成／沒約成／等回覆，和邀了什麼（約聚餐 2、一對一會談 1…）
function askBreakdown(logs, unplanned) {
  const asks = logs.filter(l => l.kind === 'meet_plan' || l.kind === 'invite_no' || l.kind === 'invite_wait')
  const plans = {}
  asks.forEach(l => { const p = planOf(l); if (p) plans[p] = (plans[p] || 0) + 1 })
  return {
    yes: asks.filter(l => l.kind === 'meet_plan').length + unplanned.length,
    direct: unplanned.length,
    blank: asks.filter(l => !planOf(l)).length,
    no: asks.filter(l => l.kind === 'invite_no').length,
    wait: asks.filter(l => l.kind === 'invite_wait').length,
    plans: Object.entries(plans).sort((a, b) => b[1] - a[1]),
  }
}
// 約成 4 次、沒約成 1 次（等回覆是 0 就不寫）
export function askResultText(b, unit = ' 次') {
  if (!b) return ''
  return [`約成 ${b.yes}${unit}`, `沒約成 ${b.no}${unit}`, b.wait ? `等回覆 ${b.wait}${unit}` : ''].filter(Boolean).join('、')
}
// 邀了：茶聊近況、見面、逛網站各 1 次，另外 2 次是直接見面後補記
export function askPlanText(b) {
  if (!b) return ''
  const same = b.plans.length > 1 && b.plans.every(([, n]) => n === b.plans[0][1])
  const main = !b.plans.length ? '' : same
    ? `${b.plans.map(([p]) => p).join('、')}各 ${b.plans[0][1]} 次`
    : b.plans.map(([p, n]) => `${p} ${n} 次`).join('、')
  const extra = [b.direct ? `${b.direct} 次是直接見面後補記` : '', b.blank ? `${b.blank} 次沒寫邀了什麼` : ''].filter(Boolean)
  if (!main && !extra.length) return ''
  if (!main) return extra.join('、')
  return main + (extra.length ? '，另外 ' + extra.join('、') : '')
}

// 互動內容改成好讀的句子：工具寫成「（用二對一會談）」，邀約紀錄寫成「邀逛網站，沒約成：…」
function inviteWhat(plan) { return !plan ? '邀了' : plan.startsWith('邀請參加') ? plan : '邀' + plan }
export function lineBody(l) {
  const note = String(l.note || '')
  if (l.kind === 'invite_no') {
    const segs = note.split('　')
    if (segs.includes(SUPERSEDED)) return `${inviteWhat(planOf(l))}，${SUPERSEDED}`
    const first = segs[0]
    const reason = first.startsWith(NO_HEAD + '：') ? first.slice(NO_HEAD.length + 1) : ''
    const said = segs.slice(1).filter(x => x && !x.startsWith('邀的是 ') && !(x.startsWith('（') && x.endsWith(' 確認）'))).join(' ')
    const why = [reason, said].filter(Boolean).join('，')
    return `${inviteWhat(planOf(l))}，沒約成${why ? '：' + why : ''}`
  }
  if (l.kind === 'invite_wait') return `${inviteWhat(planOf(l))}，還在等回覆`
  return note
}
export function lineHead(l) { return `${md(l.date)}${l.tool ? `（用${l.tool}）` : ''}` }

// 每週目標：照結算週（週六到週五），報告範圍碰到的每一週各算一次
// 見到＝按了「見完了」的次數；定下＝那週約成的人（同一位算一次），跟首頁、每日行動同一個算法
async function loadWeekGoals(userId, from, to) {
  const weeks = []
  for (let ws = weekStartOf(from); ws <= to; ws = addDaysStr(ws, 7)) weeks.push(ws)
  const first = weeks[0], last = addDaysStr(weeks[weeks.length - 1], 6)
  const [metR, planR, unplanned] = await Promise.all([
    supabase.from('counter_logs').select('date').eq('user_id', userId).eq('counter_key', 'meetup').eq('is_done', true).gte('date', first).lte('date', last),
    supabase.from('contact_logs').select('contact_id,date').eq('user_id', userId).eq('kind', 'meet_plan').gte('date', first).lte('date', last),
    fetchUnplannedMeets(userId, first, last),
  ])
  return weeks.map(ws => {
    const we = addDaysStr(ws, 6)
    const inW = r => r.date >= ws && r.date <= we
    return {
      ws, we,
      met: (metR.data || []).filter(inW).length,
      planned: new Set([...(planR.data || []).filter(inW), ...unplanned.filter(inW)].map(r => r.contact_id)).size,
    }
  })
}

// 不放進報告的互動（只記在這台手機）
const HIDE_KEY = 'ufa_report_hidden'
function loadHidden() { try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]')) } catch { return new Set() } }
function saveHidden(set) { try { localStorage.setItem(HIDE_KEY, JSON.stringify([...set].slice(-500))) } catch { /* 存不了就只在這次有效 */ } }

// 這段時間關心過的顧客：互動紀錄 + 「我關心過了」。同一位顧客合併成一筆
function buildCare(logs, custByContact, custs, from, to, today) {
  const map = new Map()
  const get = (cid, name) => { if (!map.has(cid)) map.set(cid, { cid, name, lines: [], last: '' }); return map.get(cid) }
  logs.forEach(l => {
    const c = custByContact.get(l.contact_id)
    const p = get(c ? c.id : 'k' + l.contact_id, c ? c.name : (l.contacts && l.contacts.name) || '')
    if (l.date > p.last) p.last = l.date
    if (l.kind !== 'meet_plan' && (l.note || l.tool)) p.lines.push({ id: l.id, date: l.date, tool: l.tool, note: l.note, kind: l.kind })
  })
  custs.forEach(c => {
    if (!c.last_cared_at) return
    const d = tpDate(c.last_cared_at)
    if (d < from || d > to) return
    const p = get(c.id, c.name)
    if (d > p.last) p.last = d
  })
  const list = [...map.values()].map(p => {
    p.lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const n = dayDiff(p.last, today)
    return { ...p, id: 'care' + p.cid, ago: n <= 0 ? '今天' : `${n} 天前` }
  })
  list.sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
  return list
}

// 這段時間接觸的人：需求度高的排前面，同需求度看興趣程度（有記才算），再看最近互動
function buildPeople(logs, today) {
  const map = new Map()
  logs.forEach(l => {
    if (!l.contacts) return
    if (!map.has(l.contact_id)) map.set(l.contact_id, { c: l.contacts, lines: [], last: l.date, inv: null })
    const p = map.get(l.contact_id)
    if (l.date > p.last) p.last = l.date
    // 這段時間最後一次邀約的結果（分組用）
    if (INVITE_KINDS.includes(l.kind) && (!p.inv || l.date >= p.inv.date)) p.inv = { kind: l.kind, date: l.date }
    if (l.kind !== 'meet_plan' && (l.note || l.tool)) p.lines.push({ id: l.id, date: l.date, tool: l.tool, note: l.note, kind: l.kind })
  })
  const list = [...map.values()].map(p => {
    p.lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const lastDate = [p.c.last_contact_date, p.last].filter(Boolean).sort().pop()
    const n = dayDiff(lastDate, today)
    const hasNext = p.c.next_plan && p.c.next_plan_date && p.c.next_plan_date >= today
    let next = '還沒約'
    if (hasNext) { const { time, label } = splitTime(p.c.next_plan); next = `${md(p.c.next_plan_date)}${time ? ' ' + time : ''}${label ? ' ' + label : ''}` }
    return { id: p.c.id, name: p.c.name, egg: p.c.egg_type || '', need: p.c.need_level ? p.c.need_level + '（' + (NEED_DESC[p.c.need_level] || '') + '）' : '',
      interest: p.c.interest_level || '', nrank: NEED_RANK[p.c.need_level] || 0, rank: p.c.interest_level ? (RANK[p.c.interest_level] ?? 1) : -1,
      next, hasNext: !!hasNext, inv: p.inv, ago: n <= 0 ? '今天' : `${n} 天前`, lines: p.lines, last: p.last }
  })
  list.sort((a, b) => b.nrank - a.nrank || b.rank - a.rank || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
  return list
}

function tagsOf(p) {
  const t = []
  if (p.egg) t.push(p.egg)
  if (p.need) t.push(p.need)
  if (p.interest) t.push('興趣：' + p.interest)
  return t
}


// 成果每一項的人（文字和畫面共用）
function resultPeople(r, key) {
  const uniq = list => [...new Set(list.filter(Boolean))]
  if (key === 'met') return uniq(r.met.map(p => p.name))
  if (key === 'bizPlanned') return r.bizPlanned.map(p => `${p.name}（${p.label}）`)
  if (key === 'bizMet') return r.bizMet.map(p => `${p.name}（${p.label}）`)
  if (key === 'survey') return r.survey.map(p => `${p.name}（${p.what}）`)
  if (key === 'newCust') return uniq(r.newCust.map(p => p.name))
  return []
}
const EGG_LABEL = e => e || '還沒分類'

export default function Report() {
  const navigate = useNavigate()
  const today = taipeiToday()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [n, setN] = useState(5) // 0 = 自選
  const [d1, setD1] = useState(addDaysStr(today, -13))
  const [d2, setD2] = useState(today)
  const [cur, setCur] = useState(null)
  const [weeks, setWeeks] = useState(null)
  const [hidden, setHidden] = useState(() => loadHidden())
  const [showBiz, setShowBiz] = useState(true)
  const [showText, setShowText] = useState(true)
  const [topics, setTopics] = useState('')
  const [when, setWhen] = useState('')
  const [open, setOpen] = useState({})
  const [top10, setTop10] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [warmOpen, setWarmOpen] = useState(false)
  const [marks, setMarks] = useState(() => new Set())

  useEffect(() => { supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u)) }, [])
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name,tag_settings,created_at').eq('id', user.id).single().then(({ data }) => {
      setProfile(data || {})
      const ts = (data && data.tag_settings) || {}
      if (ts.report_biz === 0) setShowBiz(false)
      if (ts.report_text === 0) setShowText(false)
      if ([3, 5, 7].includes(ts.report_range)) setN(ts.report_range)
      if (ts.report_draft) { setTopics(ts.report_draft.topics || ''); setWhen(ts.report_draft.when || '') }
    })
  }, [user])

  let from, to
  if (n === 0) {
    to = d2 > today ? today : d2
    from = d1 > to ? to : d1
    if (dayDiff(from, to) > 30) from = addDaysStr(to, -30)
  } else { to = today; from = addDaysStr(today, -(n - 1)) }
  const len = dayDiff(from, to) + 1

  useEffect(() => {
    if (!user) return
    let dead = false
    setLoading(true)
    ;(async () => {
      const [a, w] = await Promise.all([loadFacts(user.id, from, to), loadWeekGoals(user.id, from, to)])
      if (dead) return
      setCur(a); setWeeks(w); setLoading(false)
    })()
    return () => { dead = true }
  }, [user, from, to])

  const ts = (profile && profile.tag_settings) || {}
  const mode = resolveMode(ts, profile && profile.created_at)
  const planTarget = resolveWeeklyMeet(ts, mode)
  const metTarget = resolveWeeklyMet(ts)
  const people = cur ? buildPeople(cur.logs, today) : []
  const shown = people.length > 15 && top10 ? people.slice(0, 10) : people
  const groups = groupPeople(shown)
  const tiles = cur ? resultTiles(cur.results) : []

  function pickRange(v) { setN(v); if (v) saveTagSetting(user.id, { report_range: v }) }
  function setBiz(v) { setShowBiz(v); saveTagSetting(user.id, { report_biz: v ? 1 : 0 }) }
  function setText(v) { setShowText(v); saveTagSetting(user.id, { report_text: v ? 1 : 0 }) }
  function saveDraft() { saveTagSetting(user.id, { report_draft: { topics, when } }) }
  function toggleHide(id) {
    setHidden(h => { const n2 = new Set(h); if (n2.has(id)) n2.delete(id); else n2.add(id); saveHidden(n2); return n2 })
  }
  async function onMonth(a, b) { const s = await loadActionDays(user.id, a, b); setMarks(old => new Set([...old, ...s])) }
  // 每週目標的一行：見到 2/2 位，達成；定下邀約 4/5 位，差 1 位
  const goalPart = (label, got, target) => `${label} ${got}/${target} 位，${got >= target ? '達成' : `差 ${target - got} 位`}`
  const weekLabel = w => (w.we >= today ? `這週（${md(w.ws)} 起）到今天` : `${md(w.ws)} 那週`)

  function dayStatus(d) {
    const p = cur.perDay[d]
    if (dayFull(p, mode)) return { t: '完成', c: ACCENT_GREEN_TEXT }
    if (d === today) return { t: '今天還沒結束', c: TEXT_MUTED }
    const miss = p.plan < mode.meet ? '邀約' : p.talk.size < mode.talk ? '互動' : '新名單'
    return { t: '缺' + miss, c: ACCENT_YELLOW_TEXT }
  }
  // 分組裡那個人最後一次邀約的內容：「11/24 邀逛網站，還在等回覆」
  function invText(p) {
    if (!p.inv) return ''
    const l = p.lines.find(x => x.kind === p.inv.kind && x.date === p.inv.date)
    return l ? `${md(l.date)} ${lineBody(l)}` : ''
  }

  function personRow(p, i, isCare) {
    return (
      <div key={p.id} style={{ padding: '10px 0', borderTop: i ? `1px solid ${BORDER}` : 'none', fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: TEXT_MAIN }}>{p.name}</span>
          {!isCare && tagsOf(p).map(t => (
            <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: PRIMARY_SOFT, color: PRIMARY }}>{t}</span>
          ))}
          {showText && p.lines.length > 0 && (
            <button onClick={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))}
              style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 12, cursor: 'pointer', padding: 0 }}>
              {open[p.id] ? '收合 ▴' : '展開 ▾'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 3 }}>
          {isCare ? `上次關心 ${p.ago}` : `下一次約會：${p.next}　上次聯絡 ${p.ago}`}{showText && !open[p.id] && p.lines.length > 0 ? `　共 ${p.lines.length} 筆互動${p.lines.some(l => hidden.has(l.id)) ? `（${p.lines.filter(l => hidden.has(l.id)).length} 筆不放）` : ''}` : ''}
        </div>
        {showText && open[p.id] && (
          <div style={{ background: SUBCARD_BG, borderRadius: 10, padding: '8px 10px', marginTop: 6 }}>
            {p.lines.map((l, k) => {
              const off = hidden.has(l.id)
              return (
              <div key={l.id || k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: k ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.6, color: off ? TEXT_MUTED : TEXT_MAIN }}>
                  <b style={{ color: off ? TEXT_MUTED : TEXT_SECONDARY }}>{lineHead(l)}</b>
                  {lineBody(l) ? <><br /><span style={{ textDecoration: off ? 'line-through' : 'none' }}>{lineBody(l)}</span></> : null}
                </div>
                {l.id && (
                  <button onClick={() => toggleHide(l.id)}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap',
                      border: off ? `1px solid ${BORDER}` : 'none', background: off ? 'var(--card)' : PRIMARY_SOFT, color: off ? TEXT_SECONDARY : PRIMARY }}>
                    {off ? '不放' : '放進報告'}
                  </button>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  function buildText() {
    const name = (profile && profile.name) || ''
    const L = []
    L.push(`${name ? name + ' 的' : ''}報告　${md(from)}–${md(to)}（${len} 天）`, '')

    // 想討論放最前面：帶領者一打開就看到
    if (topics.trim() || when.trim()) {
      L.push('【想討論】')
      if (topics.trim()) L.push(topics.trim())
      if (when.trim()) L.push(`希望${when.trim()}一起看`)
      L.push('')
    }

    // 成果：跟分享圖卡同樣的項目
    L.push('【成果】')
    if (!tiles.length) L.push(cur.asks + cur.fresh + cur.talk > 0 ? '這段時間在累積名單和互動' : '這段時間還沒有行動紀錄')
    tiles.forEach(t => {
      const who = resultPeople(cur.results, t.key)
      L.push(`・${t.label} ${t.v}${t.unit ? ' ' + t.unit : ''}${who.length ? '：' + who.join('、') : ''}`)
    })
    L.push('')

    // 行動和目標
    L.push('【行動】')
    const zero = []
    const item = (label, v, text) => { if (v > 0) L.push('・' + text); else zero.push(label) }
    if (cur.asks > 0) {
      L.push(`・開口邀約 ${cur.asks} 次：${askResultText(cur.askBreak)}`)
      const pt = askPlanText(cur.askBreak)
      if (pt) L.push(`　邀了：${pt}`)
    } else zero.push('開口邀約')
    item('新增名單', cur.fresh, `新增名單 ${cur.fresh} 位`)
    item('互動', cur.talk, `互動 ${cur.talk} 人次`)
    if (cur.bvShare > 0) L.push(`・BV 分享 ${cur.bvShare} 次`)
    if (cur.ibvShare > 0) L.push(`・IBV 分享 ${cur.ibvShare} 次`)
    if (zero.length) L.push(`・還沒有：${zero.join('、')}`)
    const st = cur.days.map(d => ({ d, s: dayStatus(d).t }))
    const full = st.filter(x => x.s === '完成')
    const pending = st.filter(x => x.s === '今天還沒結束')
    const miss = {}
    st.forEach(x => { if (x.s.startsWith('缺')) (miss[x.s] = miss[x.s] || []).push(md(x.d)) })
    const missText = Object.keys(miss).map(k => `${k}：${miss[k].join('、')}`).join('；')
    L.push(`・每天 ${mode.label}：${len} 天裡做滿 ${full.length} 天${missText ? '，' + missText : ''}${pending.length ? `（${md(pending[0].d)} 今天還沒結束）` : ''}`)
    if (metTarget > 0 || planTarget > 0) {
      ;(weeks || []).forEach(w => {
        const parts = [metTarget > 0 ? goalPart('已見面', w.met, metTarget) : '', planTarget > 0 ? goalPart('定下邀約', w.planned, planTarget) : ''].filter(Boolean)
        L.push(`・${weekLabel(w)}：${parts.join('；')}`)
      })
    }
    L.push('')

    // 潛在夥伴：分組；選了「不放」的互動不會出現
    const lineOf = l => { const b = lineBody(l); return `　${lineHead(l)}${b ? (l.tool ? '' : '　') + b : ''}` }
    const keep = lines => lines.filter(l => !hidden.has(l.id))
    const tagText = p => { const t = tagsOf(p); return t.length ? `（${t.join('，')}）` : '' }
    L.push(`【接觸的潛在夥伴，共 ${people.length} 位${shown.length < people.length ? `，列前 ${shown.length} 位` : ''}】`)
    if (people.length === 0) L.push('這段時間沒有互動紀錄。')
    ;['next', 'wait', 'no'].forEach(k => {
      const list = groups[k]
      if (!list.length) return
      L.push(`${GROUP_TITLES[k]}（${list.length} 位）`)
      list.forEach(p => {
        const inv = invText(p)
        L.push(`・${p.name}${tagText(p)}${k === 'next' ? `　下一次約會：${p.next}` : inv ? '　' + inv : ''}`)
        if (showText) keep(p.lines).filter(l => !(k !== 'next' && p.inv && l.kind === p.inv.kind && l.date === p.inv.date)).forEach(l => L.push(lineOf(l)))
      })
    })
    if (groups.warm.length) {
      L.push(`${GROUP_TITLES.warm}（${groups.warm.length} 位）`)
      if (showText) {
        groups.eggs.forEach(g => g.list.forEach(p => {
          const ls = keep(p.lines).map(l => { const b = lineBody(l); return `${lineHead(l)}${b ? ' ' + b : ''}` })
          L.push(`・${p.name}（${EGG_LABEL(p.egg)}）${ls.length ? '　' + ls.join('；') : ''}`)
        }))
      } else {
        groups.eggs.forEach(g => L.push(`・${EGG_LABEL(g.egg)} ${g.list.length} 位：${g.list.map(p => p.name).join('、')}`))
      }
    }
    L.push('')

    const pk = cur.pick10
    if (pk && pk.ok && pk.total > 0) {
      L.push(`【首選 10，目前 ${pk.total}/${TOP10_MAX} 位】`)
      L.push(`這段時間聯絡了 ${pk.touched.length} 位${pk.touched.length ? '：' + pk.touched.join('、') : ''}，定下邀約 ${pk.planned} 位。`)
      if (pk.untouched.length) L.push(`還沒聯絡：${pk.untouched.join('、')}`)
      if (pk.swap.length) L.push(`想換人：${pk.swap.map(x => `${x.name}（${x.reason}）`).join('、')}`)
      L.push('')
    }

    // 顧客：交易（開關打開才有金額、利潤）、關心過的、超過 30 天沒關心的
    const C = []
    if (showBiz) {
      if (!cur.newCust && !cur.bv && !cur.ibv && !cur.sale) C.push(`・這 ${len} 天沒有顧客交易`)
      else C.push(`・交易金額 ${nt(cur.sale)}，利潤 ${nt(cur.profit)}`)
    }
    if (cur.care.length) {
      C.push(`・關心了 ${cur.care.length} 位`)
      cur.care.forEach(p => {
        C.push(`　${p.name}　上次關心：${p.ago}`)
        if (showText) keep(p.lines).forEach(l => C.push('　' + lineOf(l)))
      })
    }
    if (cur.lapsed.length) C.push(`・超過 30 天沒關心 ${cur.lapsed.length} 位：${cur.lapsed.slice(0, 5).map(c => c.name).join('、')}${cur.lapsed.length > 5 ? `，另有 ${cur.lapsed.length - 5} 位` : ''}`)
    if (C.length) L.push('【顧客】', ...C, '')

    while (L.length && L[L.length - 1] === '') L.pop()
    return L.join('\n')
  }

  async function copyText() {
    const text = buildText()
    setShowPreview(true)
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* 手動複製預覽 */ }
      document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  if (!user || !profile) return <LoadingSpinner />

  const ready = !loading && cur && weeks
  const text = ready ? buildText() : ''
  const card = { background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: 18, padding: 16, marginTop: 12 }
  const h = { fontSize: 14, fontWeight: 600, color: TEXT_MAIN, margin: '0 0 10px' }
  const sub = { fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY, margin: '12px 0 2px' }
  const chip = on => ({ padding: '7px 13px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: `1.5px solid ${on ? PRIMARY : BORDER}`, background: on ? PRIMARY_SOFT : 'var(--card)', color: on ? PRIMARY : TEXT_SECONDARY })
  const seg = on => ({ padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: `1.5px solid ${on ? PRIMARY : BORDER}`, background: on ? PRIMARY_SOFT : 'var(--card)', color: on ? PRIMARY : TEXT_SECONDARY })
  const toggleRow = (label, on, set) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card)',
      border: `1px solid ${BORDER}`, borderRadius: 14, padding: '9px 12px', marginTop: 8, fontSize: 13, fontWeight: 600, color: TEXT_MAIN }}>
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => set(true)} style={seg(on)}>開</button>
        <button onClick={() => set(false)} style={seg(!on)}>關</button>
      </div>
    </div>
  )
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 16px', fontSize: 13, alignItems: 'center' }
  const val = { textAlign: 'right', fontWeight: 600, color: TEXT_MAIN }
  const row = (label, a) => (<><span style={{ color: TEXT_MAIN }}>{label}</span><span style={val}>{a}</span></>)
  const copyBtn = (
    <button onClick={copyText} disabled={!ready}
      style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: PRIMARY, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: ready ? 1 : 0.6 }}>
      {copied ? '已複製，去 LINE 貼上' : '複製給帶領者（貼到 LINE）'}
    </button>
  )
  const warn = <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginBottom: 8 }}>會貼出對方姓名和你寫的互動內容，貼之前請確認對話對象</div>
  const pre = <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.75, color: TEXT_MAIN, margin: 0 }}>{text}</pre>

  return (
    <div style={{ background: 'var(--page)', minHeight: '100vh', paddingBottom: 170 }}>
      <style>{`.rp{max-width:430px;margin:0 auto;padding:20px 16px 0}.rp-side{display:none}
.rp-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(64px + env(safe-area-inset-bottom));width:100%;max-width:430px;box-sizing:border-box;background:var(--card);border-top:1px solid var(--border);padding:10px 16px 12px;z-index:99}
@media(min-width:1024px){.rp{max-width:1180px;padding:24px 32px 0;display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:28px;align-items:start}.rp-side{display:block;position:sticky;top:20px}.rp-bar,.rp-mprev{display:none}}`}</style>
      <div className="rp">
        <div className="rp-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: 19, fontWeight: 600, color: TEXT_MAIN, margin: 0 }}>給帶領者的報告</h1>
            <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/daily'))} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>‹ 返回</button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {[3, 5, 7].map(v => <button key={v} onClick={() => pickRange(v)} style={chip(n === v)}>最近{v}天</button>)}
            <button onClick={() => setN(0)} style={chip(n === 0)}>自選日期</button>
          </div>
          <div style={{ fontSize: n === 0 ? 15 : 11, fontWeight: n === 0 ? 700 : 400, color: n === 0 ? TEXT_MAIN : TEXT_MUTED, margin: '10px 0 0', lineHeight: 1.5 }}>
            {md(from)}（{wday(from)}）到 {md(to)}（{wday(to)}）<span style={{ fontWeight: 400, color: TEXT_SECONDARY, fontSize: n === 0 ? 13 : 11, marginLeft: 6 }}>共 {len} 天</span>
          </div>
          {n === 0 && (
            <div style={{ marginTop: 10, maxWidth: 420 }}>
              <RangeCalendar from={from} to={to} today={today} onPick={(a, b) => { setD1(a); setD2(b) }} marks={marks} onMonth={onMonth} />
            </div>
          )}

          <div style={card}>
            <p style={h}>我想跟帶領者討論（選填）</p>
            <textarea value={topics} onChange={e => setTopics(e.target.value)} onBlur={saveDraft}
              placeholder="例如：我沒辦法每天持續，哪些做法不適合我？" rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 14, outline: 'none', resize: 'none', background: 'var(--card)', color: TEXT_MAIN, fontFamily: 'inherit' }} />
            <p style={{ ...h, marginTop: 12 }}>希望什麼時候一起看</p>
            <input value={when} onChange={e => setWhen(e.target.value)} onBlur={saveDraft} placeholder="例如：週日下午，約 30 分鐘"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 14, outline: 'none', background: 'var(--card)', color: TEXT_MAIN }} />
          </div>

          {toggleRow('包含顧客交易（金額、利潤）', showBiz, setBiz)}
          {toggleRow('包含互動內容', showText, setText)}

          {!ready ? <div style={{ padding: 40 }}><LoadingSpinner /></div> : (
            <>
              <div style={card}>
                <p style={h}>成果</p>
                {!tiles.length ? (
                  <div style={{ background: SUBCARD_BG, borderRadius: 10, padding: 12, textAlign: 'center', fontSize: 13, color: TEXT_SECONDARY }}>
                    {cur.asks + cur.fresh + cur.talk > 0 ? '這段時間在累積名單和互動' : '這段時間還沒有行動紀錄'}
                  </div>
                ) : tiles.map((t, i) => {
                  const who = resultPeople(cur.results, t.key)
                  return (
                    <div key={t.key} style={{ padding: '8px 0', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: TEXT_MAIN }}>{t.label}</span><span style={val}>{t.v}{t.unit ? ' ' + t.unit : ''}</span>
                      </div>
                      {who.length > 0 && <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 3, lineHeight: 1.6 }}>{who.join('、')}</div>}
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.6 }}>跟「分享成圖片，貼到群組」同樣的項目和算法</div>
              </div>

              <div style={card}>
                <p style={h}>行動</p>
                <div style={grid2}>
                  {row('開口邀約', `${cur.asks} 次`)}
                  {cur.asks > 0 && <><span style={{ color: TEXT_SECONDARY, fontSize: 12, paddingLeft: 12 }}>{askResultText(cur.askBreak, '')}</span><span /></>}
                  {row('新名單', `${cur.fresh} 位`)}
                  {row('互動', `${cur.talk} 人次`)}
                  {row('BV 分享', `${cur.bvShare} 次`)}
                  {row('IBV 分享', `${cur.ibvShare} 次`)}
                </div>
              </div>

              <div style={card}>
                <p style={h}>目標</p>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>
                  每天 {mode.label}：{len} 天裡做滿 {cur.days.filter(d => dayStatus(d).t === '完成').length} 天
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(len, 7)}, 1fr)`, gap: '10px 4px', textAlign: 'center' }}>
                  {cur.days.map(d => { const s = dayStatus(d); return (
                    <div key={d} style={{ fontSize: 11, color: TEXT_MUTED }}>
                      {wday(d)} {md(d)}
                      <div style={{ fontSize: 12, fontWeight: 600, color: s.c, marginTop: 2 }}>{s.t === '今天還沒結束' ? '今天' : s.t}</div>
                    </div>) })}
                </div>
                {(metTarget > 0 || planTarget > 0) && weeks.map(w => (
                  <div key={w.ws} style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6 }}>{weekLabel(w)}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '7px 12px', fontSize: 13, alignItems: 'center' }}>
                      {[metTarget > 0 && ['已見面', w.met, metTarget], planTarget > 0 && ['定下邀約', w.planned, planTarget]].filter(Boolean).map(([lb, got, tg]) => (
                        <span key={lb} style={{ display: 'contents' }}>
                          <span style={{ color: TEXT_MAIN }}>{lb}</span>
                          <span style={{ fontWeight: 600, color: TEXT_MAIN }}>{got} / {tg} 位</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: got >= tg ? ACCENT_GREEN_TEXT : TEXT_SECONDARY }}>{got >= tg ? '達成' : `差 ${tg - got} 位`}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10 }}>目標可在設定調整</div>
              </div>

              <div style={card}>
                <p style={h}>接觸的潛在夥伴（共 {people.length} 位）</p>
                {people.length === 0 && <div style={{ fontSize: 13, color: TEXT_MUTED }}>這段時間沒有互動紀錄</div>}
                {['next', 'wait', 'no'].map(k => groups[k].length > 0 && (
                  <div key={k}>
                    <p style={sub}>{GROUP_TITLES[k]}（{groups[k].length} 位）</p>
                    {groups[k].map((p, i) => personRow(p, i, false))}
                  </div>
                ))}
                {groups.warm.length > 0 && (
                  <div>
                    <p style={sub}>{GROUP_TITLES.warm}（{groups.warm.length} 位）</p>
                    {warmOpen ? groups.warm.map((p, i) => personRow(p, i, false)) : groups.eggs.map(g => (
                      <div key={g.egg} style={{ fontSize: 13, lineHeight: 1.75, color: TEXT_MAIN, marginTop: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: SUBCARD_BG, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, marginRight: 6 }}>
                          {EGG_LABEL(g.egg)} {g.list.length}
                        </span>
                        {g.list.map(p => p.name).join('、')}
                      </div>
                    ))}
                    <button onClick={() => setWarmOpen(v => !v)}
                      style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: PRIMARY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {warmOpen ? '收起來，只看名字' : '看每個人的互動內容 ›'}
                    </button>
                  </div>
                )}
                {people.length > 15 && (
                  <button onClick={() => setTop10(v => !v)}
                    style={{ marginTop: 8, background: 'none', border: 'none', color: PRIMARY, fontSize: 12, cursor: 'pointer', padding: 0 }}>
                    {top10 ? '改成全部列出' : '人數較多，只列前 10 位？'}
                  </button>
                )}
              </div>

              {cur.pick10 && cur.pick10.ok && cur.pick10.total > 0 && (
                <div style={card}>
                  <p style={h}>首選 10（目前 {cur.pick10.total}/{TOP10_MAX} 位）</p>
                  <div style={{ fontSize: 13, color: TEXT_MAIN }}>
                    這段時間聯絡了 {cur.pick10.touched.length} 位，定下邀約 {cur.pick10.planned} 位
                  </div>
                  {cur.pick10.untouched.length > 0 && (
                    <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 6 }}>還沒聯絡：{cur.pick10.untouched.join('、')}</div>
                  )}
                  {cur.pick10.swap.length > 0 && (
                    <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 6 }}>想換人：{cur.pick10.swap.map(x => `${x.name}（${x.reason}）`).join('、')}</div>
                  )}
                </div>
              )}

              <div style={card}>
                <p style={h}>顧客</p>
                {showBiz && (
                  <>
                    <div style={grid2}>
                      {row('交易金額', nt(cur.sale))}
                      {row('利潤', nt(cur.profit))}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, margin: '8px 0 10px' }}>利潤是金額減成本，贈送的產品不算。新顧客、BV、IBV 在上面的成果。</div>
                  </>
                )}
                <p style={sub}>關心過的顧客（共 {cur.care.length} 位）</p>
                {cur.care.length === 0 && <div style={{ fontSize: 13, color: TEXT_MUTED }}>這段時間沒有關心顧客的紀錄</div>}
                {cur.care.map((p, i) => personRow(p, i, true))}
                {cur.lapsed.length > 0 && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN }}>超過 30 天沒關心的顧客：{cur.lapsed.length} 位</div>
                    {cur.lapsed.slice(0, 5).map(c => (
                      <div key={c.id} style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
                        {c.name}　{c.days === null ? '還沒關心過' : `${c.days} 天沒關心`}　最近一次訂單 {md(c.order.date)}{c.order.name ? ' ' + c.order.name : ''}
                      </div>
                    ))}
                    {cur.lapsed.length > 5 && <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>還有 {cur.lapsed.length - 5} 位</div>}
                  </div>
                )}
              </div>

              <div className="rp-mprev" style={{ ...card, padding: showPreview ? 16 : 0 }}>
                <button onClick={() => setShowPreview(v => !v)}
                  style={{ width: '100%', background: 'none', border: 'none', color: PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: showPreview ? '0 0 10px' : 14 }}>
                  {showPreview ? '收起要貼出去的文字' : '看要貼出去的文字 ›'}
                </button>
                {showPreview && pre}
              </div>
            </>
          )}
        </div>

        <div className="rp-side">
          <div style={{ ...card, marginTop: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <p style={{ ...h, margin: 0 }}>要貼出去的文字</p>
              <span style={{ fontSize: 11, color: TEXT_MUTED }}>左邊改了，這裡馬上跟著變</span>
            </div>
            <div style={{ background: SUBCARD_BG, borderRadius: 12, padding: '12px 14px', maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}>
              {ready ? pre : <div style={{ fontSize: 13, color: TEXT_MUTED }}>整理中…</div>}
            </div>
            <div style={{ marginTop: 12 }}>{warn}{copyBtn}</div>
          </div>
        </div>
      </div>
      <div className="rp-bar">{warn}{copyBtn}</div>
    </div>
  )
}
