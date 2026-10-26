// usage.jsx — 只記「哪個功能今天有被打開」，不記姓名、不記內容。
// 同一個人、同一個功能、同一天只會有一筆（資料庫 unique 擋掉重複），失敗也不影響使用。
import { supabase } from '../supabase'

const seen = new Set()
export async function trackUsage(event) {
  try {
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const k = day + '|' + event
    if (seen.has(k)) return
    seen.add(k)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('usage_events').upsert(
      { user_id: user.id, event, day },
      { onConflict: 'user_id,event,day', ignoreDuplicates: true }
    )
  } catch { /* 記錄失敗不要影響任何功能 */ }
}
