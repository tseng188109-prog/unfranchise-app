// 系統管理：所有「管理員才能做」的事都經過這裡。
// 先用對方登入的憑證確認他是誰，再查 admins 表確認他是管理員，才用後台權限執行。
// 前端把按鈕藏起來擋不住人，所以真正的把關在這裡。
// 這裡只碰帳號層級的資料（名字、Email、推薦人、最近哪天打開、回報），
// 不讀任何人的名單、顧客、業績、互動內容。
/* global process */
import { createClient } from '@supabase/supabase-js'

const DAY = 86400000
export const DELETE_AFTER_DAYS = 30

function taipeiToday(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

// 最近打開 → 狀態（跟畫面上的說明一致）
export function statusOf({ lastDay, deactivatedAt }, today) {
  if (deactivatedAt) return 'off'
  if (!lastDay) return 'new'
  const gap = Math.round((new Date(today + 'T00:00:00Z') - new Date(lastDay + 'T00:00:00Z')) / DAY)
  if (gap <= 7) return 'active'
  if (gap <= 30) return 'less'
  return 'idle'
}

// 臨時密碼：避開容易看錯的字（0 O 1 l I）
export function makeTempPassword(rand = Math.random) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = n => Array.from({ length: n }, () => chars[Math.floor(rand() * chars.length)]).join('')
  return `${pick(3)}-${pick(3)}-${pick(2)}`
}

// 某人底下所有夥伴（他推薦的、再往下推薦的…），用來防止把推薦人設成自己底下的人
export function downlineOf(id, users) {
  const out = new Set()
  let frontier = [id]
  while (frontier.length) {
    const next = []
    users.forEach(u => { if (frontier.includes(u.referrer_id) && !out.has(u.id) && u.id !== id) { out.add(u.id); next.push(u.id) } })
    frontier = next
  }
  return out
}

async function allAuthUsers(db) {
  const all = []
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    all.push(...(data.users || []))
    if (!data.users || data.users.length < 1000) break
  }
  return all
}

async function log(db, actorId, action, target, detail) {
  await db.from('admin_logs').insert({
    actor_id: actorId, action,
    target_id: target ? target.id : null,
    target_name: target ? (target.name || '') : null,
    detail: detail || null,
  })
}

async function loadAccounts(db) {
  const [{ data: users, error: e1 }, authUsers, { data: status }, { data: seen, error: e2 }, { data: subs }, { data: admins }] = await Promise.all([
    db.from('users').select('id,name,referrer_id,referrer_email_pending,created_at'),
    allAuthUsers(db),
    db.from('account_status').select('user_id,deactivated_at,must_change_password'),
    db.rpc('admin_last_seen'),
    db.from('push_subscriptions').select('user_id'),
    db.from('admins').select('user_id'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const emailOf = {}; authUsers.forEach(a => { emailOf[a.id] = a.email || '' })
  const statusOf_ = {}; (status || []).forEach(s => { statusOf_[s.user_id] = s })
  const seenOf = {}; (seen || []).forEach(s => { seenOf[s.user_id] = s.last_day })
  const pushSet = new Set((subs || []).map(s => s.user_id))
  const adminSet = new Set((admins || []).map(a => a.user_id))
  const today = taipeiToday()
  return (users || []).map(u => {
    const st = statusOf_[u.id] || {}
    const lastDay = seenOf[u.id] || null
    return {
      id: u.id, name: u.name || '', email: emailOf[u.id] || '',
      referrer_id: u.referrer_id, referrer_email_pending: u.referrer_email_pending,
      created_at: u.created_at, last_day: lastDay,
      deactivated_at: st.deactivated_at || null,
      push: pushSet.has(u.id), is_admin: adminSet.has(u.id),
      status: statusOf({ lastDay, deactivatedAt: st.deactivated_at }, today),
    }
  })
}

export async function handle(db, actor, body) {
  const action = body && body.action
  const find = async (id) => {
    const { data } = await db.from('users').select('id,name,referrer_id').eq('id', id).single()
    return data
  }

  if (action === 'whoami') return { ok: true, id: actor.id }

  if (action === 'accounts') {
    return { ok: true, today: taipeiToday(), accounts: await loadAccounts(db) }
  }

  if (action === 'overview') {
    const accounts = await loadAccounts(db)
    const now = Date.now()
    // 有送東西的那幾輪（早上、晚上、一週總結…），只在整點跑但沒有要送的不列
    const { data: runs } = await db.from('push_runs').select('slot_date,slot_hour,kind,users,sent,failed,note')
      .not('kind', 'in', '(idle,running)').order('id', { ascending: false }).limit(6)
    const { data: fb } = await db.from('feedback').select('id').is('handled_at', null)
    return {
      ok: true,
      total: accounts.filter(a => !a.deactivated_at).length,
      active: accounts.filter(a => a.status === 'active').length,
      newbies: accounts.filter(a => !a.deactivated_at && now - new Date(a.created_at).getTime() < 14 * DAY).length,
      notStarted: accounts.filter(a => a.status === 'new').length,
      pushUsers: accounts.filter(a => a.push && !a.deactivated_at).length,
      runs: runs || [],
      openFeedback: (fb || []).length,
      mismatched: accounts.filter(a => !a.referrer_id && a.referrer_email_pending && !a.deactivated_at).length,
      deletable: accounts.filter(a => a.deactivated_at && now - new Date(a.deactivated_at).getTime() >= DELETE_AFTER_DAYS * DAY).length,
    }
  }

  if (action === 'feedback') {
    const { data, error } = await db.from('feedback').select('id,user_id,kind,message,page,created_at,handled_at')
      .order('created_at', { ascending: false }).limit(200)
    if (error) throw error
    const { data: users } = await db.from('users').select('id,name')
    const nameOf = {}; (users || []).forEach(u => { nameOf[u.id] = u.name })
    return { ok: true, items: (data || []).map(f => ({ ...f, name: nameOf[f.user_id] || '' })) }
  }

  if (action === 'feedback_handled') {
    const handled = body.handled !== false
    const { error } = await db.from('feedback')
      .update({ handled_at: handled ? new Date().toISOString() : null, handled_by: handled ? actor.id : null })
      .eq('id', body.id)
    if (error) throw error
    return { ok: true }
  }

  if (action === 'logs') {
    const { data } = await db.from('admin_logs').select('id,actor_id,action,target_name,detail,created_at')
      .order('id', { ascending: false }).limit(50)
    const { data: users } = await db.from('users').select('id,name')
    const nameOf = {}; (users || []).forEach(u => { nameOf[u.id] = u.name })
    return { ok: true, items: (data || []).map(l => ({ ...l, actor_name: nameOf[l.actor_id] || '' })) }
  }

  // 以下都是針對某一個帳號
  const target = body.id ? await find(body.id) : null
  if (!target) return { ok: false, status: 404, error: '找不到這個帳號' }

  if (action === 'temp_password') {
    const password = makeTempPassword()
    const { error } = await db.auth.admin.updateUserById(target.id, { password })
    if (error) throw error
    await db.from('account_status').upsert({ user_id: target.id, must_change_password: true }, { onConflict: 'user_id' })
    await log(db, actor.id, 'temp_password', target)
    return { ok: true, password }
  }

  if (action === 'deactivate') {
    if (target.id === actor.id) return { ok: false, status: 400, error: '不能停用自己' }
    const { data: isAdm } = await db.from('admins').select('user_id').eq('user_id', target.id)
    if (isAdm && isAdm.length) return { ok: false, status: 400, error: '他是管理員，請先到「管理員」移除他的管理員身分' }
    const { error } = await db.auth.admin.updateUserById(target.id, { ban_duration: '876000h' })
    if (error) throw error
    await db.from('account_status').upsert({ user_id: target.id, deactivated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    await db.from('push_subscriptions').delete().eq('user_id', target.id)
    await log(db, actor.id, 'deactivate', target)
    return { ok: true }
  }

  if (action === 'restore') {
    const { error } = await db.auth.admin.updateUserById(target.id, { ban_duration: 'none' })
    if (error) throw error
    await db.from('account_status').upsert({ user_id: target.id, deactivated_at: null }, { onConflict: 'user_id' })
    await log(db, actor.id, 'restore', target)
    return { ok: true }
  }

  if (action === 'set_referrer') {
    const refId = body.referrerId || null
    if (refId === target.id) return { ok: false, status: 400, error: '推薦人不能是他自己' }
    if (refId) {
      const { data: users } = await db.from('users').select('id,referrer_id')
      if (downlineOf(target.id, users || []).has(refId)) return { ok: false, status: 400, error: '這位是他推薦的（或再往下的）夥伴，不能當他的推薦人' }
      const ref = await find(refId)
      if (!ref) return { ok: false, status: 404, error: '找不到這位推薦人' }
    }
    const { error } = await db.from('users').update({ referrer_id: refId, referrer_email_pending: null }).eq('id', target.id)
    if (error) throw error
    const ref = refId ? await find(refId) : null
    await log(db, actor.id, 'set_referrer', target, ref ? ref.name : '（沒有推薦人）')
    return { ok: true }
  }

  if (action === 'add_admin') {
    const { data: st } = await db.from('account_status').select('deactivated_at').eq('user_id', target.id)
    if (st && st[0] && st[0].deactivated_at) return { ok: false, status: 400, error: '這個帳號已停用，不能設成管理員' }
    const { error } = await db.from('admins').upsert({ user_id: target.id, added_by: actor.id }, { onConflict: 'user_id' })
    if (error) throw error
    await log(db, actor.id, 'add_admin', target)
    return { ok: true }
  }

  if (action === 'remove_admin') {
    const { data: admins } = await db.from('admins').select('user_id')
    if ((admins || []).length <= 1) return { ok: false, status: 400, error: '至少要留一位管理員' }
    const { error } = await db.from('admins').delete().eq('user_id', target.id)
    if (error) throw error
    await log(db, actor.id, 'remove_admin', target)
    return { ok: true }
  }

  if (action === 'delete') {
    const { data: st } = await db.from('account_status').select('deactivated_at').eq('user_id', target.id)
    const off = st && st[0] && st[0].deactivated_at
    if (!off) return { ok: false, status: 400, error: '要先停用滿 30 天才能刪除' }
    if (Date.now() - new Date(off).getTime() < DELETE_AFTER_DAYS * DAY) return { ok: false, status: 400, error: '停用還沒滿 30 天' }
    let expect = (target.name || '').trim()
    if (!expect) {
      const { data: au } = await db.auth.admin.getUserById(target.id)
      expect = ((au && au.user && au.user.email) || '').trim()
    }
    if (!expect || (body.confirmName || '').trim() !== expect) return { ok: false, status: 400, error: '名字打得不一樣' }
    // 1. 他推薦的人，改接到他的推薦人（他沒有推薦人就變成沒有推薦人）
    const { data: kids } = await db.from('users').select('id').eq('referrer_id', target.id)
    await db.from('users').update({ referrer_id: target.referrer_id || null }).eq('referrer_id', target.id)
    // 2. 他建的戰隊：交給隊上最早加入的人；沒有別人就解散
    const { data: teams } = await db.from('teams').select('id').eq('creator_id', target.id)
    for (const t of teams || []) {
      const { data: mem } = await db.from('team_members').select('user_id,joined_at').eq('team_id', t.id)
        .order('joined_at', { ascending: true })
      const next = (mem || []).find(m => m.user_id !== target.id)
      if (next) await db.from('teams').update({ creator_id: next.user_id }).eq('id', t.id)
      else await db.from('teams').delete().eq('id', t.id)
    }
    // 3. 他個人的資料：用資料庫的 admin_purge_user 一次刪乾淨，再刪登入帳號
    const { error: pe } = await db.rpc('admin_purge_user', { p_user_id: target.id })
    if (pe) throw pe
    const { error: de } = await db.auth.admin.deleteUser(target.id)
    if (de) throw de
    await log(db, actor.id, 'delete', target, `他推薦的 ${(kids || []).length} 位改接到上一位推薦人`)
    return { ok: true }
  }

  return { ok: false, status: 400, error: '不認得的動作' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: '請先登入' })
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    const { data: who, error: we } = await db.auth.getUser(token)
    if (we || !who || !who.user) return res.status(401).json({ error: '請重新登入' })
    const actor = who.user
    const { data: adm } = await db.from('admins').select('user_id').eq('user_id', actor.id)
    if (!adm || !adm.length) return res.status(403).json({ error: '你不是管理員' })
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const out = await handle(db, actor, body)
    return res.status(out.ok ? 200 : (out.status || 400)).json(out)
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e).slice(0, 300) })
  }
}
