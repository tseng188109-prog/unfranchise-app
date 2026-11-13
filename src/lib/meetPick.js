// meetPick.js — 首頁「1 個邀約」今天推薦誰（純計算，不連資料庫，方便測試）
// 依據：成功五要訣 CD7 跟進黃金律、CD8 ABC 跟進法、CD5 豆罐子、2025 簡報 3→1
//   1. 見過面、聽過說明（一對一、二對一、三方通話、說明會），還沒約下一次
//      （CD7 第一條：每次展示計劃、見面都要約定下一次，人要聽三遍才懂）
//   2. 核桃：自己表示想了解的人（CD5），約成的機會最高
//   3. 給過試用品、還沒問感受（CD7 第三條：每次送東西出去都要約下次聯絡，不要說「我再找你」）
//   4. 最近 7 天聊過、聊得熱的人（簡報：1 是從今天互動的 3 位長出來的）
//   5. 都沒有：比較熟的人（茶葉蛋、荷包蛋，熟悉度沒填的也算）輪流
// 推薦過、沒去約的人休息 3 天再出現，讓別人有機會被推薦。
import { walnutOf } from './jar.js'
import { daysBetween, md, twDayOf, addDays, dowOf } from './rhythm.js'

export const REST_DAYS = 3
export const MEET_WINDOW = 30
export const WARM_DAYS = 7
export const SAMPLE_MIN = 3
export const SAMPLE_MAX = 21
// 記互動時選了這幾種工具，就等於展示過計劃、見過面
export const SHOWN_TOOLS = ['一對一會談', '二對一會談', '三方通話', '家庭事業說明會']

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16
  return h >>> 0
}
export function lastTalkOf(c) {
  return c.last_contact_date || (c.last_interacted_at ? twDayOf(c.last_interacted_at) : null)
}

// 推薦過（shown 那天）的人，之後 3 天先休息；當天不算，同一天推薦不會一直換
export function isResting(rest, id, today) {
  const d = rest && rest[id]
  if (!d || d >= today) return false
  return daysBetween(d, today) <= REST_DAYS
}

// 能不能被推薦（不管哪一類）
export function canPick(c, ctx, today) {
  if (!c || c.is_muted) return false
  if (c.referral_stage === '暫時婉拒') return false
  if (c.next_plan && (!c.next_plan_date || c.next_plan_date >= today)) return false // 已經約好下一次
  if (c.invite_cool_until && c.invite_cool_until > today) return false // 剛邀過沒約成
  const lt = lastTalkOf(c)
  if (c.interest_level === '沒興趣' && (!lt || daysBetween(lt, today) < 30)) return false
  if (isResting(ctx.rest, c.id, today)) return false
  return true
}

// 為什麼今天是他：{ tier, text } 或 null（不適合約）
export function whyOf(c, ctx, today) {
  const lastPlan = (ctx.lastPlan || {})[c.id] || null
  // lastMeet[id]：'YYYY-MM-DD' 或 { date, tool }
  const mr = (ctx.lastMeet || {})[c.id]
  const met = mr && (typeof mr === 'string' ? mr : mr.date)
  const tool = mr && typeof mr === 'object' ? mr.tool : null
  if (met && daysBetween(met, today) <= MEET_WINDOW && !(lastPlan && lastPlan >= met)) {
    const text = met === today
      ? (tool ? `今天${tool}完，趁還記得約下一次` : '今天才見過，趁還記得約下一次')
      : (tool ? `${md(met)} ${tool}後，還沒約下一次` : `${md(met)} 見過，還沒約下一次`)
    return { tier: 1, text }
  }
  const w = walnutOf(c, lastPlan, today)
  if (w) return { tier: 2, text: w.reason === '約成過' ? '約成過，趁熱約下一次' : `他自己說想了解（${w.reason}）` }
  const sm = (ctx.sampleAt || {})[c.id]
  if (sm) {
    const n = daysBetween(sm, today)
    if (n >= SAMPLE_MIN && n <= SAMPLE_MAX) return { tier: 3, text: `試用品給了 ${n} 天，問問用得怎樣` }
  }
  if (c.egg_type === '生雞蛋') return null // 還不熟，先放在互動裡多聊幾次
  const lt = lastTalkOf(c)
  const n = lt ? daysBetween(lt, today) : null
  if (n !== null && n <= WARM_DAYS) {
    return { tier: 4, text: n <= 0 ? '今天才聊過，趁熱約' : n === 1 ? '昨天才聊過，趁熱約' : n === 2 ? '前天才聊過，趁熱約' : `${n} 天前聊過，趁熱約` }
  }
  if (n === null) return { tier: 5, text: '還沒記過互動，先關心近況，再約個下午茶' }
  if (n > 60) return { tier: 5, text: '好一陣子沒聯絡了，先關心一下，再約輕鬆的見面' }
  if (c.egg_type === '茶葉蛋') return { tier: 5, text: `${n} 天沒聯絡了，很熟了，約個下午茶聊近況` }
  return { tier: 5, text: `${n} 天沒聯絡了，約個輕鬆的聚餐` }
}

const WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
// CD7：問引導性的問題，再給兩個時間讓他選
export function sayFor(tier, today) {
  const d1 = WEEK[dowOf(addDays(today, 1))], d2 = WEEK[dowOf(addDays(today, 2))]
  const when = `${d1}下午還是${d2}晚上`
  if (tier === 1) return `「上次聊完，你最喜歡的是哪部分？還想多了解什麼？${when}，我們再聊一次？」`
  if (tier === 2) return `「你上次說想多了解，我們約個時間好好聊，${when}？」`
  if (tier === 3) return `「試用品用起來感覺怎樣？${when}，約個時間聽聽你的想法？」`
  return `「最近好嗎？好久沒好好聊了，${when}，一起喝個下午茶？」`
}

// 排好的候選名單（每人帶 pickWhy）
export function rankMeet(contacts, ctx, today) {
  const out = []
  ;(contacts || []).forEach(c => {
    if (!canPick(c, ctx, today)) return
    const why = whyOf(c, ctx, today)
    if (why) out.push({ ...c, pickWhy: why })
  })
  out.sort((a, b) => (a.pickWhy.tier - b.pickWhy.tier)
    || ((b.is_top10 ? 1 : 0) - (a.is_top10 ? 1 : 0))
    || (hash(a.id + today) - hash(b.id + today)))
  return out
}

// 今天推薦的那一位。skipIds：按了「換一位」的人；換的時候先換到不同來源的人。
export function pickMeet(contacts, ctx, today, skipIds = []) {
  let all = rankMeet(contacts, ctx, today)
  // 名單很少、大家都在休息：還是推薦一位，不要空著
  if (!all.some(c => !skipIds.includes(c.id))) all = rankMeet(contacts, { ...ctx, rest: {} }, today)
  const skippedTiers = new Set(all.filter(c => skipIds.includes(c.id)).map(c => c.pickWhy.tier))
  const left = all.filter(c => !skipIds.includes(c.id))
  if (!left.length) return null
  return left.find(c => !skippedTiers.has(c.pickWhy.tier)) || left[0]
}

// 記住今天推薦了誰（存 tag_settings.meet_rest），順便清掉超過休息期的舊紀錄
export function nextRest(rest, id, today) {
  const out = {}
  Object.entries(rest || {}).forEach(([k, d]) => { if (d && daysBetween(d, today) <= REST_DAYS) out[k] = d })
  out[id] = today
  return out
}
