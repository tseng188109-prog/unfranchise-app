// results.js — 一段日期的「行動」和「成果」（純計算，分享圖卡、你的細節、給帶領者的報告共用，數字一定對得上）
// 行動：互動（人次）、新名單、開口邀約；每天 3-1-2 有沒有做滿
// 成果：已見面、邀約評估事業、已評估事業、已給問卷或購物清單、新顧客、BV、IBV
// 「評估事業」跟互動名單「我的罐子」判斷核桃同一套：一對一會談、二對一會談、三方通話、家庭事業說明會、事業說明會
import { bizPlanLabel } from './jar.js'

export const INVITE_KINDS = ['meet_plan', 'invite_no', 'invite_wait']

// 每天的行動：同一個人同一天只算一位；沒先約、直接見面後補記的也算當天的「1」
export function computeActions({ days, logs = [], unplanned = [], added = [] }) {
  const perDay = {}
  days.forEach(d => { perDay[d] = { talk: new Set(), plan: 0, planIds: new Set(), fresh: 0 } })
  unplanned.forEach(u => { const p = perDay[u.date]; if (p) { p.planIds.add(u.contact_id); p.plan = p.planIds.size } })
  logs.forEach(l => {
    const p = perDay[l.date]; if (!p) return
    p.talk.add(l.contact_id)
    if (INVITE_KINDS.includes(l.kind)) { p.planIds.add(l.contact_id); p.plan = p.planIds.size }
  })
  added.forEach(c => { const p = perDay[c.day]; if (p) p.fresh += 1 })
  return {
    perDay,
    talk: days.reduce((s, d) => s + perDay[d].talk.size, 0),
    asks: logs.filter(l => INVITE_KINDS.includes(l.kind)).length + unplanned.length,
    fresh: added.filter(c => perDay[c.day]).length,
  }
}

export function dayFull(p, mode) {
  return !!p && p.talk.size >= mode.talk && p.plan >= mode.meet && p.fresh >= mode.fresh
}
// 圖卡上的圓點：full＝3-1-2 做滿、part＝有行動、rest＝休息
export function dayDots(days, perDay, mode, metDates = []) {
  const met = new Set(metDates)
  return days.map(d => {
    const p = perDay[d]
    if (dayFull(p, mode)) return { d, s: 'full' }
    if ((p && (p.talk.size || p.plan || p.fresh)) || met.has(d)) return { d, s: 'part' }
    return { d, s: 'rest' }
  })
}

const nameOf = r => (r && r.contacts && r.contacts.name) || r.name || ''
// 同一個人只留一筆（留最後一次）
function lastPerPerson(rows, key) {
  const m = new Map()
  rows.forEach(r => { const k = key(r); const old = m.get(k); if (!old || r.date >= old.date) m.set(k, r) })
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

// 成果
//   planLogs：這段日期的約成紀錄（contact_logs kind=meet_plan，帶 contacts(name)）
//   meets：這段日期按了「見完了」的約定（counter_logs meetup is_done，帶 contacts(name)）
//   trials：試做（trial_runs：contact_id, steps {"1": 日期, "4": 日期}），names：contact_id → 名字
//   homeLists：這段日期給了居家購物清單的顧客（customers：id, name, home_list_given_on）
//   newCusts：這段日期新增的顧客；tx：這段日期的交易；custNames：customer_id → 名字
export function computeResults({ from, to, planLogs = [], meets = [], trials = [], names = {}, homeLists = [], newCusts = [], tx = [], custNames = {} }) {
  const inRange = d => d && d >= from && d <= to
  const met = meets.filter(m => inRange(m.date))
    .map(m => ({ id: m.contact_id, name: nameOf(m), date: m.date, label: m.note ? planText(m.note) : '' }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const bizPlanned = lastPerPerson(planLogs.filter(l => inRange(l.date) && bizPlanLabel(l.note)), l => l.contact_id)
    .map(l => ({ id: l.contact_id, name: nameOf(l), date: l.date, label: bizPlanLabel(l.note) }))
  const bizMet = lastPerPerson(meets.filter(m => inRange(m.date) && bizPlanLabel(m.note)), m => m.contact_id)
    .map(m => ({ id: m.contact_id, name: nameOf(m), date: m.date, label: bizPlanLabel(m.note) }))
  const surveyRows = []
  trials.forEach(t => {
    const s = t.steps || {}
    if (inRange(s['1'])) surveyRows.push({ key: 'c' + t.contact_id, id: t.contact_id, name: names[t.contact_id] || '', date: s['1'], what: '開始三天的試用品問卷' })
    if (inRange(s['3'])) surveyRows.push({ key: 'c' + t.contact_id, id: t.contact_id, name: names[t.contact_id] || '', date: s['3'], what: '三天問卷做完、跟進了' })
    if (inRange(s['4'])) surveyRows.push({ key: 'c' + t.contact_id, id: t.contact_id, name: names[t.contact_id] || '', date: s['4'], what: '完成居家購物清單' })
  })
  homeLists.forEach(c => { if (inRange(c.home_list_given_on)) surveyRows.push({ key: 'k' + c.id, cid: c.id, name: c.name, date: c.home_list_given_on, what: '給了居家購物清單' }) })
  surveyRows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let bv = 0, ibv = 0
  const bvLines = []
  tx.forEach(t => {
    if (!inRange(t.date)) return
    const pts = Number(t.points) || 0
    if (t.type === 'BV') bv += pts
    if (t.type === 'IBV') ibv += pts
    if ((t.type === 'BV' || t.type === 'IBV') && pts) bvLines.push({ name: t.customer_id ? custNames[t.customer_id] || '' : '', date: t.date, product: t.product_name || '', type: t.type, points: pts })
  })
  bvLines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return {
    met, bizPlanned, bizMet,
    survey: surveyRows, surveyPeople: new Set(surveyRows.map(r => r.key)).size,
    newCust: newCusts.map(c => ({ id: c.id, name: c.name || '', date: c.day || c.date || '' })),
    bv: Math.round(bv * 100) / 100, ibv: Math.round(ibv * 100) / 100, bvLines,
  }
}
// 「11/26 14:00 二對一會談」這種約定內容只留做什麼
function planText(note) { return String(note).replace(/^\d{1,2}\/\d{1,2}\s*/, '').replace(/^\d{1,2}:\d{2}\s*/, '').trim() }

// 成果的格子：只放有數字的（showBv 關掉時不放 BV、IBV）
export function resultTiles(r, { showBv = true } = {}) {
  const t = [
    { key: 'met', label: '已見面', v: r.met.length, unit: '位' },
    { key: 'bizPlanned', label: '邀約評估事業', v: r.bizPlanned.length, unit: '位' },
    { key: 'bizMet', label: '已評估事業', v: r.bizMet.length, unit: '位' },
    { key: 'survey', label: '已給問卷或購物清單', v: r.surveyPeople, unit: '位' },
    { key: 'newCust', label: '新顧客', v: r.newCust.length, unit: '位' },
  ]
  if (showBv) t.push({ key: 'bv', label: 'BV', v: r.bv, unit: '' }, { key: 'ibv', label: 'IBV', v: r.ibv, unit: '' })
  return t.filter(x => x.v > 0)
}

// 亮點：先找成果變多的，再看是不是每天都有行動，再找行動變多的；跟「前一段一樣長的日子」比
// cur / prev：{ met, bizPlanned, bizMet, survey, newCust, bv, ibv, fresh, asks, talk }；prev 是 null 代表沒有可以比的
const HL = [
  ['bizMet', '已評估事業', ' 位'], ['bizPlanned', '邀約評估事業', ' 位'], ['newCust', '新顧客', ' 位'], ['met', '已見面', ' 位'],
  ['survey', '已給問卷或購物清單', ' 位'], ['bv', 'BV ', ''], ['ibv', 'IBV ', ''],
]
const HL_ACT = [['fresh', '新名單', ' 位'], ['asks', '開口邀約', ' 次'], ['talk', '互動', ' 人次']]
const num = (label, v, unit) => (label.endsWith(' ') ? `${label}${v}` : `${label} ${v}${unit}`)
export function pickHighlight({ cur, prev, len, activeDays }) {
  const hasPrev = !!prev && Object.values(prev).some(v => v > 0)
  const more = list => list.find(([k]) => cur[k] > 0 && hasPrev && cur[k] > (prev[k] || 0))
  const r = more(HL)
  if (r) { const [k, label, unit] = r; return `${num(label, cur[k], unit)}，比前 ${len} 天多 ${fmt(cur[k] - (prev[k] || 0))}${unit.trim() ? unit : ''}。` }
  if (len >= 3 && activeDays === len) return `${len} 天每天都有行動${cur.fresh ? `，新名單 ${cur.fresh} 位` : ''}。`
  const a = more(HL_ACT)
  if (a) { const [k, label, unit] = a; return `${label} ${cur[k]}${unit}，比前 ${len} 天多 ${cur[k] - (prev[k] || 0)}${unit}。` }
  const first = HL.find(([k]) => cur[k] > 0)
  if (first) { const [k, label, unit] = first; return `這 ${len} 天${num(label, cur[k], unit)}。` }
  if (activeDays > 0) return `這 ${len} 天有 ${activeDays} 天有行動${cur.fresh ? `，新名單 ${cur.fresh} 位` : ''}。`
  return ''
}
const fmt = n => Math.round(n * 100) / 100

// 邀約評估事業的人「怎麼走到這一步」：加入名單 → 互動幾次 → 約成 → 見完了
//   person：{ id, date(約成那天), label }；logs：這個人的互動紀錄（到約成那天為止）；addedOn：加入名單那天；metOn：見完了那天
export function pathOf({ person, logs = [], addedOn = '', metOn = '' }) {
  const before = logs.filter(l => l.date <= person.date && !INVITE_KINDS.includes(l.kind))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const steps = []
  if (addedOn && addedOn <= person.date) steps.push({ date: addedOn, text: '加入名單' })
  if (before.length) {
    const f = before[0], l = before[before.length - 1]
    const first = String(f.note || f.tool || '').split('\n')[0].slice(0, 24)
    steps.push({ date: f.date, to: l.date !== f.date ? l.date : '', text: `互動 ${before.length} 次${first ? `，第一次是「${first}」` : ''}` })
  }
  const asks = logs.filter(l => l.date <= person.date && (l.kind === 'invite_no' || l.kind === 'invite_wait'))
  if (asks.length) steps.push({ date: asks[0].date, text: `之前邀過 ${asks.length} 次` })
  steps.push({ date: person.date, text: `約成${person.label}` })
  if (metOn) steps.push({ date: metOn, text: '見完了' })
  steps.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return { steps, talks: before.length, days: addedOn && addedOn <= person.date ? daysBetween(addedOn, person.date) : null }
}
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) }

// 細節最上面的整理：只寫事實
export function pathSummary(paths) {
  if (!paths.length) return []
  const out = []
  const avg = list => Math.round(list.reduce((s, x) => s + x, 0) / list.length * 10) / 10
  out.push(`平均互動了 ${avg(paths.map(p => p.talks))} 次才約到`)
  const d = paths.map(p => p.days).filter(x => x !== null)
  if (d.length) out.push(`從加入名單到約到，平均 ${avg(d)} 天`)
  return out
}

// 給帶領者的報告：潛在夥伴分組
//   people：[{ id, name, egg, hasNext, inv: { kind } | null, ... }]（順序照原本的排序）
export const EGG_ORDER = ['茶葉蛋', '荷包蛋', '生雞蛋', '']
export function groupPeople(people) {
  const g = { next: [], wait: [], no: [], warm: [] }
  people.forEach(p => {
    if (p.hasNext) g.next.push(p)
    else if (p.inv && p.inv.kind === 'invite_wait') g.wait.push(p)
    else if (p.inv && p.inv.kind === 'invite_no') g.no.push(p)
    else g.warm.push(p)
  })
  const eggs = EGG_ORDER.map(e => ({ egg: e, list: g.warm.filter(p => (EGG_ORDER.includes(p.egg) ? p.egg : '') === e) })).filter(x => x.list.length)
  return { ...g, eggs }
}
export const GROUP_TITLES = { next: '約好了下一次見面', wait: '邀了，還在等回覆', no: '邀了，這次沒約成', warm: '還在互動、變熟' }
