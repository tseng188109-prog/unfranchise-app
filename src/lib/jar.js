// jar.js — 豆子罐和核桃的「純計算」（不連資料庫、不畫畫面，方便測試）
// 來源：成功五要訣（BASIC-5）CD5 的豆罐子理論——
//   罐子裡每顆豆子是一個認識的人；搖罐子＝保持接觸、培養關係；
//   感興趣、願意了解的人會自己浮上來，就是核桃（說幹就幹的候選人）。
import { twDayOf, daysBetween } from './rhythm.js'

// 罐子分四段，裝滿就換大罐子（只會變大，不會變小）
export const JAR_STAGES = [
  { key: 'small', name: '小玻璃罐', cap: 10 },
  { key: 'jam', name: '果醬罐', cap: 30 },
  { key: 'pickle', name: '泡菜罐', cap: 100 },
  { key: 'big', name: '豆子大罐', cap: 300 },
]
export const BIG_CAP = 300
export const WALNUT_GOAL = 8 // 原文：每一邊 4 位說幹就幹的人
export const COOL_DAYS = 14 // 核桃超過 14 天沒聯絡：熱度在退
export const SINK_DAYS = 90 // 超過 90 天沒聯絡：沉回去
export const DEFAULT_MONTH_GOAL = 60 // 每天 2 位
export const PARTNER_STAGES = ['已簽約', '起步中', '穩定經營中']

// 算不算罐子裡的豆子：封存、顧客自動建立的、已成為夥伴的都不算
export function isBean(c) {
  return !c.is_archived && c.source !== 'customer' && !PARTNER_STAGES.includes(c.referral_stage)
}
// 聊過了沒（實心豆／空心豆）
export function isTalked(c) { return !!(c.last_contact_date || c.last_interacted_at) }

// 是不是核桃：對方自己給過想了解的訊號
//   meetPlanDate：這個人最近一次「約成了」的日期（沒有就 null）
// 回傳 null（不是）或 { reason, cooling, days }
export function walnutOf(c, meetPlanDate, today) {
  if (!isBean(c)) return null
  if (c.interest_level === '沒興趣') return null
  const last = c.last_contact_date || (c.last_interacted_at ? twDayOf(c.last_interacted_at) : null)
  if (last && daysBetween(last, today) > SINK_DAYS) return null
  let reason = ''
  if (meetPlanDate) reason = '約成過'
  else if (c.need_level === '大四') reason = '大四・主動來問'
  else if (c.interest_level === '很有興趣') reason = '很有興趣'
  else if (c.interest_level === '有點興趣') reason = '有點興趣'
  if (!reason) return null
  // 按過「先沉下去」：之後又約成一次才會再浮上來
  if (c.walnut_sunk_at) {
    const sunk = twDayOf(c.walnut_sunk_at)
    if (!meetPlanDate || meetPlanDate <= sunk) return null
    reason = '約成過'
  }
  const days = last ? daysBetween(last, today) : null
  return { reason, cooling: days === null || days > COOL_DAYS, days }
}

// 建議的下一步（跟名單頁的建議同一套說法，簡短版）
export function walnutNext(c) {
  if (c.need_level === '大四' || c.interest_level === '很有興趣') return '直接約一對一或說明會'
  if (c.interest_level === '有點興趣') return '約體驗產品，或聊他在意的事'
  return '趁熱約下一次見面'
}
// 還沒填的資料：補了才知道怎麼聊
export function missingInfo(c) {
  const m = []
  if (!c.egg_type) m.push('熟悉度')
  if (!c.need_level) m.push('需求度')
  return m
}

// 罐子現在是哪一段（只升不降）
//   count：豆子數；reached：以前到過的最高段（0..3）
export function jarState(count, reached = 0) {
  // 裝滿幾段就往上換幾段；以前換過的大罐子不會因為封存人而變回小罐子
  let idx = 0
  for (let i = 0; i < JAR_STAGES.length - 1; i++) if (count >= JAR_STAGES[i].cap) idx = i + 1
  idx = Math.max(idx, Math.min(reached || 0, JAR_STAGES.length - 1))
  const stage = JAR_STAGES[idx]
  const fullBig = idx === JAR_STAGES.length - 1 ? Math.floor(count / BIG_CAP) : 0
  const inCurrent = idx === JAR_STAGES.length - 1 ? count - fullBig * BIG_CAP : count
  const next = JAR_STAGES[idx + 1] || null
  return {
    idx, stage, next, count,
    fullBig,                         // 架上已經裝滿的大罐子數
    inCurrent,                       // 現在這一罐裝了幾顆
    fill: Math.min(1, inCurrent / stage.cap),
    toNext: next ? Math.max(0, stage.cap - count) : BIG_CAP - inCurrent,
  }
}

// 自己的核桃比例：聊過 30 位以上才算
export function walnutRatio(talked, walnuts) {
  if (talked < 30 || walnuts < 1) return null
  const per = Math.max(1, Math.round(talked / walnuts))
  return { per, need: Math.max(0, (WALNUT_GOAL - walnuts) * per) }
}

// 每個月放了幾顆新豆（最近 n 個月，由舊到新）
export function monthBars(contacts, today, n = 4) {
  const months = []
  let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7))
  for (let i = 0; i < n; i++) {
    months.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m--; if (m === 0) { m = 12; y-- }
  }
  const count = Object.fromEntries(months.map(k => [k, 0]))
  contacts.forEach(c => {
    const d = c.added_date || twDayOf(c.created_at)
    const k = d ? d.slice(0, 7) : ''
    if (k in count) count[k]++
  })
  return months.map(k => ({ month: k, label: `${Number(k.slice(5, 7))}月`, n: count[k] }))
}

// 整理一次：給罐子卡片和罐子大畫面用
export function summarizeJar(contacts, meetPlanByContact, today, reached = 0) {
  const beans = (contacts || []).filter(isBean)
  const walnuts = []
  beans.forEach(c => {
    const w = walnutOf(c, meetPlanByContact[c.id] || null, today)
    if (w) walnuts.push({ ...c, ...w })
  })
  // 熱的排前面；同樣熱度，最近約成的、需求高的先
  walnuts.sort((a, b) => (a.cooling - b.cooling) || ((a.days ?? 999) - (b.days ?? 999)))
  const talked = beans.filter(isTalked).length
  const monthStart = today.slice(0, 8) + '01'
  const monthNew = beans.filter(c => (c.added_date || twDayOf(c.created_at)) >= monthStart).length
  return {
    beans: beans.length, talked, walnuts, monthNew,
    beanIds: beans.map(c => c.id),
    jar: jarState(beans.length, reached),
    ratio: walnutRatio(talked, walnuts.length),
    bars: monthBars(beans, today),
  }
}

export function jarPrefs(tagSettings) {
  const j = (tagSettings && tagSettings.jar) || {}
  return {
    reached: Number.isInteger(j.reached) ? j.reached : 0,
    monthGoal: Number.isInteger(j.monthGoal) && j.monthGoal >= 10 && j.monthGoal <= 300 ? j.monthGoal : DEFAULT_MONTH_GOAL,
  }
}
