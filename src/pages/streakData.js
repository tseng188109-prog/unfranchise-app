// 連續天數：從每日打卡讀出「哪幾天有行動」，交給 rhythm.js 算
import { supabase } from '../supabase'
import { activeDaysFrom, computeStreak, weekStrip, twToday, addDays, STREAK_KEYS } from '../lib/rhythm'

export async function loadStreak(userId, today = twToday(), extraActive = []) {
  let rows = []
  try {
    const { data } = await supabase.from('daily_checkins').select('date,task_key,is_done')
      .eq('user_id', userId).in('task_key', STREAK_KEYS).eq('is_done', true).gte('date', addDays(today, -400))
    rows = data || []
  } catch { /* 讀不到就當沒有 */ }
  const active = activeDaysFrom(rows)
  extraActive.forEach(d => active.add(d))
  const streak = computeStreak(active, today)
  return { today, active, streak, strip: weekStrip(active, today, streak) }
}

// 每次記錄後（syncDaily3）通知畫面：今天的三個數字變了
export function emit312(detail) {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ufa:312', { detail })) } catch { /* ignore */ }
}
