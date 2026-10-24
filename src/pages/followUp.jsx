// followUp.jsx — 跟進系統共用邏輯
// 「標注不自動推導」：這個檔案裡的任何函式都只負責「建議」或「挑選」，
// 真正寫入 relationship_stage / referral_stage 的動作，永遠只能來自使用者自己在畫面上點的那一下。

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
  '已登記',
  '已加入經營',
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

// 挑出今天的「1個會議」人選：milestone 類別（b/c）優先於單純 action_type 判斷（a），
// 同層再用最久沒互動的人排序（最老的優先），用建立時間做穩定排序。
//
// 對應 3-1-2 原意「3→1：跟互動的朋友約碰面」——milestone 資格裡，優先挑「最近真的有
// 跟你互動過」的人，這樣「1」才是從「3」自然長出來的結果，不是另一條只看標注、
// 脫鉤於實際互動狀況的規則。如果 milestone 裡沒有熱的人，還是會退回挑最久沒互動
// 的那位（通常就是階段標注已經很久沒更新的重要名單），不會整個藏起來不顯示——
// 只是 getSuggestion() 這時候會改成提醒「先暖身再約」，不會逼你對一個冷掉的人
// 直接喊「約時間碰面」。
export function pickMeetingContact(contacts, todayStr) {
  const eligible = (contacts || []).filter(isMeetingEligible)
  if (eligible.length === 0) return null
  const milestoneOnes = eligible.filter(c => c.relationship_stage === '已登記但尚未消費' || c.referral_stage === '考慮中')
  const pool = milestoneOnes.length > 0 ? milestoneOnes : eligible
  const sorted = [...pool].sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    // 同一批 CSV 匯入的聯絡人 created_at 常常完全一樣，這裡再用一次 created_at 比較沒有意義
    // （比較自己永遠不相等地互相判定對方比較大，排序結果會跟著查詢回來的原始順序亂跳）。
    // 改用 id 當最後一層比較，id 一定不重複，才能保證「沒換資料就不換人選」。
    return (a.id || '') < (b.id || '') ? -1 : 1
  })
  if (milestoneOnes.length > 0) {
    const warmOnes = sorted.filter(c => isContactWarm(c, todayStr))
    if (warmOnes.length > 0) return warmOnes[0]
  }
  return sorted[0]
}

// 挑出今天的「3位互動」：排除靜音與今天已經當選「1個會議」的那位，
// 依最久沒互動排序，確保「不要老是同樣那幾位」。
export function pickInteractionContacts(contacts, excludeId, count = 3) {
  const pool = (contacts || []).filter(c => !c.is_muted && c.id !== excludeId)
  return [...pool].sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    // 同理：created_at 同批匯入常常完全相同，用 id 收尾才穩定
    return (a.id || '') < (b.id || '') ? -1 : 1
  }).slice(0, count)
}
