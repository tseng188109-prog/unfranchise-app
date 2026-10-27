// dailyMode.jsx — 每日節奏：起步（1-1-2）／標準（3-1-2）／加速（10-3-2）
// 來源：BASIC-5（新人每天聯絡 1–3 位、邀約 1 人、增加 2 名）、2025 領導者訓練大會簡報（3-1-2）、
// 10-3-2 模式投影片（10 人談話、訂下 3 個約會其中 1 個由你主持、增加 2 個名字）。
// 存在 users.tag_settings.daily_mode，不用另外建欄位。沒選過的人：加入 14 天內＝起步，其餘＝標準。
import { supabase } from '../supabase'

export const DAILY_MODES = {
  start: {
    key: 'start', label: '1-1-2', title: '1-1-2　起步', talk: 1, meet: 1, fresh: 2,
    desc: '每天至少 1 位互動、定下 1 個碰面、新增 2 位名單。剛開始的人先從這個開始。',
  },
  std: {
    key: 'std', label: '3-1-2', title: '3-1-2　標準', talk: 3, meet: 1, fresh: 2,
    desc: '每天 3 位互動、定下 1 個碰面、新增 2 位名單。',
  },
  fast: {
    key: 'fast', label: '10-3-2', title: '10-3-2　加速', talk: 10, meet: 3, fresh: 2,
    desc: '每天 10 位互動、定下 3 個約會（其中 1 個由你主持）、新增 2 位名單。全職、進階的人用。',
  },
}
export const DAILY_MODE_LIST = [DAILY_MODES.start, DAILY_MODES.std, DAILY_MODES.fast]

export function resolveMode(tagSettings, createdAt) {
  const k = tagSettings && tagSettings.daily_mode
  if (k && DAILY_MODES[k]) return DAILY_MODES[k]
  const days = createdAt ? (Date.now() - new Date(createdAt).getTime()) / 86400000 : 999
  return days < 14 ? DAILY_MODES.start : DAILY_MODES.std
}

export async function loadDailyMode(userId) {
  try {
    const { data } = await supabase.from('users').select('tag_settings,created_at').eq('id', userId).single()
    return resolveMode(data && data.tag_settings, data && data.created_at)
  } catch { return DAILY_MODES.std }
}

// 存的時候先讀現有的 tag_settings 再合併，不會蓋掉標籤清單
export async function saveDailyMode(userId, key) {
  const { data } = await supabase.from('users').select('tag_settings').eq('id', userId).single()
  const cur = (data && data.tag_settings) || {}
  return supabase.from('users').update({ tag_settings: { ...cur, daily_mode: key } }).eq('id', userId)
}

// 通用：把一組設定合併存進 tag_settings（先讀現有的，不會蓋掉別的設定）
export async function saveTagSetting(userId, patch) {
  const { data } = await supabase.from('users').select('tag_settings').eq('id', userId).single()
  const cur = (data && data.tag_settings) || {}
  return supabase.from('users').update({ tag_settings: { ...cur, ...patch } }).eq('id', userId)
}

// 我的首選產品：最多 2 款，每款 { name, note }
export function resolveFavProducts(tagSettings) {
  const list = tagSettings && Array.isArray(tagSettings.fav_products) ? tagSettings.fav_products : []
  return list.filter(p => p && p.name).slice(0, 2)
}
