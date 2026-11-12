// 「用臨時密碼登入，要先換密碼」的標記：查詢和清除
import { supabase } from '../supabase'

export async function needsPasswordChange(userId) {
  try {
    const { data } = await supabase.from('account_status')
      .select('must_change_password').eq('user_id', userId).maybeSingle()
    return data?.must_change_password === true
  } catch { return false }
}

export async function clearPasswordChangeFlag() {
  try { await supabase.rpc('finish_password_change') } catch { /* 標記清不掉也不影響換密碼本身 */ }
}
