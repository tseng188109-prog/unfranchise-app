// buddy.js — 搭檔連勝（純計算，不連資料庫，方便測試）
// 規則跟自己的連續天數同一套（rhythm.js 的 computeStreak）：
//   兩個人同一天都有互動、邀約或新名單，就加 1 天；
//   每週有一天休息日（其中一人或兩人沒做），不會斷，但那天不加；同一週第二天沒做才斷。
//   從兩人成為搭檔那天開始算。
import { computeStreak, addDays, daysBetween } from './rhythm.js'

// 稱號：連續到幾天就升級（男女都適用、不曖昧）
export const BUDDY_TITLES = [
  { n: 7, title: '連勝新秀' },
  { n: 14, title: '黃金搭檔' },
  { n: 30, title: '王牌組合' },
  { n: 50, title: '巔峰雙星' },
  { n: 100, title: '百日傳奇' },
]
export const BUDDY_MAX = 3
// 自己的連續天數到這幾天：大火焰＋彩帶，也上戰隊「這週的好消息」
export const BIG_DAYS = [7, 30, 100, 365]
export const INVITE_DAYS = 7

export function titleOf(n) {
  let t = null
  BUDDY_TITLES.forEach(x => { if (n >= x.n) t = x.title })
  return t
}
export function nextTitleOf(n) {
  return BUDDY_TITLES.find(x => x.n > n) || null
}
// 剛好到這一天會解鎖的稱號
export function unlockedAt(n) {
  const x = BUDDY_TITLES.find(t => t.n === n)
  return x ? x.title : null
}

// 兩人都有做的日子（從 start 那天開始）
export function pairActive(a, b, start) {
  const out = new Set()
  a.forEach(d => { if (b.has(d) && (!start || d >= start)) out.add(d) })
  return out
}

// 目前的搭檔連勝：{ count, todayActive, meToday, otherToday }
export function pairStreak(mine, other, start, today) {
  const both = pairActive(mine, other, start)
  const maxBack = start ? Math.max(1, daysBetween(start, today) + 1) : 400
  const s = computeStreak(both, today, maxBack)
  return { ...s, meToday: mine.has(today), otherToday: other.has(today) }
}

// 這段連勝是從哪天開始的（好消息用來分辨「同一段」連勝，不重複上）
export function runStart(active, today, count) {
  if (!count) return null
  let left = count, d = active.has(today) ? today : addDays(today, -1)
  for (let i = 0; i < 800 && left > 0; i++) {
    if (active.has(d)) { left--; if (!left) return d }
    d = addDays(d, -1)
  }
  return d
}

// 最高紀錄：從開始到今天，每一天當作「今天」算一次，取最大
export function pairBest(mine, other, start, today) {
  const both = pairActive(mine, other, start)
  if (!both.size || !start) return 0
  let best = 0
  const span = daysBetween(start, today)
  for (let i = 0; i <= span; i++) {
    const d = addDays(start, i)
    if (!both.has(d)) continue
    const upTo = new Set([...both].filter(x => x <= d))
    const c = computeStreak(upTo, d, i + 1).count
    if (c > best) best = c
  }
  return best
}

// 邀請過期了沒（7 天沒回覆）
export function inviteExpired(createdAt, now = Date.now()) {
  return now - new Date(createdAt).getTime() > INVITE_DAYS * 86400000
}
