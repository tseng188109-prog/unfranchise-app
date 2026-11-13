// 豆子罐：讀名單、算核桃、存設定
import { supabase } from '../supabase'
import { summarizeJar, jarPrefs } from '../lib/jar'
import { twToday } from '../lib/rhythm'

const FIELDS = 'id,name,egg_type,need_level,interest_level,is_archived,is_top10,referral_stage,source,last_contact_date,last_interacted_at,added_date,created_at,walnut_sunk_at'

async function all(make) {
  const out = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await make().range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function loadJar(userId, today = twToday()) {
  let contacts
  try {
    contacts = await all(() => supabase.from('contacts').select(FIELDS).eq('user_id', userId).order('created_at', { ascending: true }))
  } catch {
    // 資料庫還沒加「先沉下去」欄位時也照常顯示
    contacts = await all(() => supabase.from('contacts').select(FIELDS.replace(',walnut_sunk_at', '')).eq('user_id', userId).order('created_at', { ascending: true }))
  }
  const plans = await all(() => supabase.from('contact_logs').select('contact_id,date').eq('user_id', userId).eq('kind', 'meet_plan'))
  const lastPlan = {}
  plans.forEach(p => { if (!lastPlan[p.contact_id] || p.date > lastPlan[p.contact_id]) lastPlan[p.contact_id] = p.date })
  const { data: prof } = await supabase.from('users').select('tag_settings').eq('id', userId).single()
  const prefs = jarPrefs(prof && prof.tag_settings)
  return { today, prefs, ...summarizeJar(contacts, lastPlan, today, prefs.reached) }
}

// 存罐子設定（只動 tag_settings.jar，不蓋掉別的設定）
export async function saveJarPrefs(userId, patch) {
  const { data } = await supabase.from('users').select('tag_settings').eq('id', userId).single()
  const cur = (data && data.tag_settings) || {}
  const next = { ...cur, jar: { ...(cur.jar || {}), ...patch } }
  await supabase.from('users').update({ tag_settings: next }).eq('id', userId)
  return next
}

export async function sinkWalnut(contactId) {
  return supabase.from('contacts').update({ walnut_sunk_at: new Date().toISOString() }).eq('id', contactId)
}

// 哪些核桃已經跳過「浮上來了」（每台裝置各自記）
export function seenWalnuts(userId) {
  try { const v = localStorage.getItem('ufa_walnuts_seen_' + userId); return v ? JSON.parse(v) : null } catch { return null }
}
export function markWalnutsSeen(userId, ids) {
  try { localStorage.setItem('ufa_walnuts_seen_' + userId, JSON.stringify(ids)) } catch { /* ignore */ }
}

// 記了互動、改了名單後，讓罐子搖一下、重新算
export function shakeJar() {
  try { window.dispatchEvent(new CustomEvent('ufa:jar-shake')) } catch { /* ignore */ }
}
