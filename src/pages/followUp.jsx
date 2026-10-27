// followUp.jsx — 跟進系統共用邏輯
// 「標注不自動推導」：這個檔案裡的任何函式都只負責「建議」或「挑選」，
// 真正寫入 relationship_stage / referral_stage 的動作，永遠只能來自使用者自己在畫面上點的那一下。

import { loadDailyMode } from './dailyMode'

// ---- 階段清單（消費狀況 / 合作意願）----
// 消費狀況：這個人離「成交賺價差」走到哪一步了
export const RELATIONSHIP_STAGES = [
  '剛認識',
  '了解需求中',
  '已登記但尚未消費',
  '優惠顧客（已有消費）',
  '穩定回購顧客',
]

// 合作意願：這個人離「加入事業夥伴」走到哪一步了（null = 還沒進到這個話題）
export const REFERRAL_STAGES = [
  '聽過介紹',
  '考慮中',
  '已簽約',
  '起步中',
  '穩定經營中',
  '暫時婉拒',
]

// ---- 建議接觸方式：固定模板，不是即時生成的對話稿 ----
// 「學怎麼聊天」不是這個系統的工作，這裡只負責提醒「用哪種強度接觸」
const ACTION_SUGGESTION = {
  '輕鬆互動': '找個輕鬆話題聊近況就好，不用談生意',
  '軟性活動': '約一個輕鬆的活動，像聚餐或逛街，自然增加熟悉度',
  '商機講座': '邀請參加一場商機講座或分享會',
  '直接法': '已經準備好了，可以直接約時間深聊',
}

// 「熱/冷」判定：是不是最近真的互動過，對應 3-1-2 原意「3→1：跟互動的朋友約碰面」。
// 超過這個天數沒互動，就不該直接建議約會議，要先暖身。
const WARM_DAYS = 14
function daysSince(dateStr, todayStr) {
  if (!dateStr) return Infinity
  return (new Date(todayStr) - new Date(dateStr)) / 86400000
}
export function isContactWarm(contact, todayStr) {
  const today = todayStr || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  return daysSince(contact.last_interacted_at, today) <= WARM_DAYS
}

export function getSuggestion(contact, todayStr) {
  const warm = isContactWarm(contact, todayStr)
  if (contact.relationship_stage === '已登記但尚未消費') {
    return warm
      ? '已經登記了，可以直接約時間協助完成第一次消費'
      : '已經登記但好一段時間沒聯絡了，先關心一下再約時間完成消費'
  }
  if (contact.referral_stage === '考慮中') {
    return warm
      ? '正在考慮加入事業，適合約時間深入說明'
      : '正在考慮加入事業，但好一段時間沒聯絡了，先互動暖身再約時間深聊'
  }
  return ACTION_SUGGESTION[contact.action_type] || '找時間互動一下，保持關係溫度'
}

// ---- 靜音（時機未到）----
export async function muteContact(supabase, contactId) {
  return supabase.from('contacts')
    .update({ is_muted: true, muted_at: new Date().toISOString() })
    .eq('id', contactId)
}
export async function unmuteContact(supabase, contactId) {
  return supabase.from('contacts')
    .update({ is_muted: false, muted_at: null })
    .eq('id', contactId)
}

// ---- 一句話日記（contact_notes）----
// touchInteraction=true 時會一併更新 last_interacted_at，
// 「這次沒特別聊到什麼」也算一次互動，所以同樣會更新。
export async function addContactNote(supabase, { contactId, userId, note, resolvesNoteId = null, touchInteraction = true }) {
  const { error } = await supabase.from('contact_notes').insert({
    contact_id: contactId,
    user_id: userId,
    note,
    resolves_note_id: resolvesNoteId,
  })
  if (!error && touchInteraction) {
    await supabase.from('contacts').update({ last_interacted_at: new Date().toISOString() }).eq('id', contactId)
  }
  return { error }
}

// 一則舊紀錄多久後算「可能過期」，要跳出「還是這樣嗎？」的確認
const STALE_DAYS = 60
export function isStale(createdAt) {
  if (!createdAt) return false
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return days >= STALE_DAYS
}
// 時間軸上的視覺淡出：越舊越淡，但不是用來判斷邏輯，只給畫面用
export function noteAgeOpacity(createdAt) {
  if (!createdAt) return 1
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000
  if (days < 14) return 1
  if (days < 60) return 0.75
  if (days < 120) return 0.55
  return 0.4
}

// ---- 階段標注（contact_stage_history）----
// track: 'relationship' | 'referral'
export async function setStage(supabase, { contactId, userId, track, stage }) {
  const field = track === 'relationship' ? 'relationship_stage' : 'referral_stage'
  const { error } = await supabase.from('contacts').update({ [field]: stage }).eq('id', contactId)
  if (!error) {
    await supabase.from('contact_stage_history').insert({
      contact_id: contactId, user_id: userId, track, stage,
    })
  }
  return { error }
}

// ---- 今天的 3-1-2 完成記號 ----
// 跟戰隊旅程（Team.jsx）共用同一個 task_key，團隊進度才會跟著 3-1-2 走，
// 不是另外算一套「有沒有打卡」。只要當天在 3-1-2 面板上做了任何一件事
// （記一下互動／約到會議／新增聯絡人），就算有推進，不要求精確湊滿 3/1/2 三個數字，
// 跟現有的每日任務系統同一個精神：簡單的 is_done 旗標，不做到微觀計數。
export const DAILY_312_TASK_KEY = 'daily_312'

export async function markDaily312(supabase, userId, dateStr) {
  const date = dateStr || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  return supabase.from('daily_checkins').upsert({
    user_id: userId, date, task_key: DAILY_312_TASK_KEY, is_done: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date,task_key' })
}

// ---- 今天的 3-1-2 ----
// 排序用的時間戳：沒有 last_interacted_at 就用建立時間，確保一定有東西可排
function sortKey(c) {
  return c.last_interacted_at || c.created_at || ''
}

// 「1個會議」資格：
//   (a) action_type 本來就判斷為「直接法」，或
//   (b) 消費狀況已經「已登記但尚未消費」，或
//   (c) 合作意願「考慮中」
// 但排除「剛認識」（避免 action_type 誤判和真實關係熟度矛盾）與靜音的人
export function isMeetingEligible(c) {
  if (!c || c.is_muted) return false
  if (c.relationship_stage === '剛認識') return false
  const isMilestone = c.relationship_stage === '已登記但尚未消費' || c.referral_stage === '考慮中'
  const isDirect = c.action_type === '直接法'
  return isMilestone || isDirect
}

// 挑出今天的「1個會議」人選。
// 依據：2025 領導者訓練大會簡報——3-1-2 的「1」＝定下一個碰面（約下午茶、跟朋友聊聊），
// 是從「互動的朋友」（3）長出來的（3→1），忌「漫無目的的 1」。
// 所以這裡不再只看「準備好簽約」的標籤，而是：
//   先排除：靜音、暫時婉拒、已經約好下一次的人（他們已經在「下一次」卡裡了）、
//           記為「沒興趣」且 30 天內才碰過的人（不打擾）
//   再排序：興趣高優先（很有興趣 > 有點興趣 > 觀望中 > 看不出來／未記錄）→ 需求大四/大三優先
//           → 階段（已登記未消費、考慮中）→ 最近有互動、還熱著的
// skipIds：使用者按「換一位」跳過的人。
const INTEREST_RANK = { '很有興趣': 4, '有點興趣': 3, '觀望中': 2, '看不出來': 1, '沒興趣': 0 }
function interestRank(c) {
  if (!c.interest_level) return 1
  return INTEREST_RANK[c.interest_level] ?? 1
}
const NEED_RANK = { '大四': 3, '大三': 2, '大二': 1, '大一': 0 }
export function pickMeetingContact(contacts, todayStr, skipIds = []) {
  const today = todayStr || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const pool = (contacts || []).filter(c => {
    if (!c || c.is_muted) return false
    if (skipIds.includes(c.id)) return false
    if (c.referral_stage === '暫時婉拒') return false
    if (c.next_plan) return false
    if (interestRank(c) === 0 && daysSince(c.last_contact_date || c.last_interacted_at, today) < 30) return false
    return true
  })
  if (pool.length === 0) return null
  const score = c => [
    interestRank(c),
    NEED_RANK[c.need_level] ?? 0,
    (c.relationship_stage === '已登記但尚未消費' || c.referral_stage === '考慮中') ? 1 : 0,
    isContactWarm(c, today) ? 1 : 0,
  ]
  const sorted = [...pool].sort((a, b) => {
    const sa = score(a), sb = score(b)
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i]
    const ka = sortKey(a), kb = sortKey(b)
    if (ka !== kb) return ka > kb ? -1 : 1
    return (a.id || '') < (b.id || '') ? -1 : 1
  })
  return sorted[0]
}

// 卡片上的「為什麼是他」一行，給這個「1」一個理由（簡報：不要漫無目的）
export function meetingReason(c, todayStr) {
  if (!c) return ''
  const warm = isContactWarm(c, todayStr)
  const lv = c.interest_level
  if (lv === '很有興趣') return warm ? '很有興趣，還沒約下一次，約一個一對一聊聊' : '很有興趣，但有一陣子沒聯絡了，先關心再約'
  if (lv === '有點興趣') return warm ? '有點興趣，約一個輕鬆的碰面，體驗產品或聊聊她在意的事' : '有點興趣，先關心一下，再約個輕鬆的碰面'
  if (lv === '觀望中') return warm ? '觀望中，約個輕鬆的聚餐聊聊，不急著介紹' : '觀望中，先保持聯絡，再約個輕鬆的聚餐'
  if (c.relationship_stage === '已登記但尚未消費') return warm ? '已經登記了，約時間協助完成第一次消費' : '已經登記但好一陣子沒聯絡，先關心再約'
  if (c.referral_stage === '考慮中') return warm ? '正在考慮，約時間深入聊聊' : '正在考慮，但一陣子沒聯絡，先暖身再約'
  return warm ? '最近有聊到，約個下午茶聊近況，不談生意' : '好一陣子沒碰面了，先互動暖身，再約下午茶'
}

// 「新朋友」：加進來不到 14 天，而且還沒有記過任何一次互動（簡報：2→3，跟新加的朋友保持互動）
export function isFreshFriend(c, todayStr) {
  const today = todayStr || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  return !!c.created_at && !c.last_contact_date && daysSince(c.created_at.slice(0, 10), today) <= 14
}

// 挑出今天的「3位互動」：排除靜音與 excludeId（單一 id 或 id 陣列），
// 新朋友優先（2→3），其餘依最久沒互動排序，確保「不要老是同樣那幾位」。
export function pickInteractionContacts(contacts, excludeId, count = 3, todayStr) {
  const excl = Array.isArray(excludeId) ? excludeId : [excludeId]
  const pool = (contacts || []).filter(c => !c.is_muted && !excl.includes(c.id))
  return [...pool].sort((a, b) => {
    const fa = isFreshFriend(a, todayStr) ? 1 : 0, fb = isFreshFriend(b, todayStr) ? 1 : 0
    if (fa !== fb) return fb - fa
    const ka = sortKey(a), kb = sortKey(b)
    if (ka !== kb) return fa ? (ka > kb ? -1 : 1) : (ka < kb ? -1 : 1)
    // 同理：created_at 同批匯入常常完全相同，用 id 收尾才穩定
    return (a.id || '') < (b.id || '') ? -1 : 1
  }).slice(0, count)
}

// 「每日3互動」打勾：當天記過互動的人（不重複）達到自己選的每日節奏（起步 1／標準 3／加速 10）才自動打勾
export async function syncDaily3(supabase, userId, dateStr) {
  const date = dateStr || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const { data } = await supabase.from('contact_logs').select('contact_id').eq('user_id', userId).eq('date', date)
  const n = new Set((data || []).map(r => r.contact_id)).size
  const mode = await loadDailyMode(userId)
  if (n >= mode.talk) {
    await supabase.from('daily_checkins').upsert({
      user_id: userId, date, task_key: 'daily_3_contacts', is_done: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
  }
  return n
}
