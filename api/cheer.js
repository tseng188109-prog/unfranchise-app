// 隊友打氣的手機通知：App 把打氣存好之後（send_cheer），叫這裡把通知送給對方。
// 先用登入憑證確認是送的人本人、這則還沒送過通知，才用後台權限送。
// 不送的情況：晚上 10 點到早上 7 點、對方開了安靜模式、對方關掉「隊友給我打氣」、對方沒開通知。
// 不送的打氣一樣存著，對方下次打開 App 會跳小卡、鈴鐺裡也看得到。
// 搭檔也走這裡（body 帶 buddy: 'invite' 或 'accept'）：邀請送出時通知被邀的人、答應時通知邀請的人。
// 搭檔通知不看「隊友給我打氣」那個開關（那個是管打氣按鈕），晚上和安靜模式一樣不送。
/* global process */
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { notifyPrefs, isQuiet, twToday } from '../src/lib/rhythm.js'

export const QUIET_FROM = 22
export const QUIET_TO = 7

export function taipeiHour(now = new Date()) {
  return Number(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }))
}
export function nightTime(hour) { return hour >= QUIET_FROM || hour < QUIET_TO }

// 要不要送：回 null 表示要送，不然回不送的原因
export function skipReason({ cheer, tagSettings, now = new Date() }) {
  if (!cheer) return 'not-found'
  if (cheer.pushed_at) return 'already'
  if (now - new Date(cheer.created_at) > 10 * 60000) return 'too-old'
  const p = notifyPrefs(tagSettings)
  if (!p.cheer) return 'off'
  if (isQuiet(p, twToday(now))) return 'quiet'
  if (nightTime(taipeiHour(now))) return 'night'
  return null
}

// 搭檔通知要不要送：回 null 表示要送
export function buddySkipReason({ row, kind, tagSettings, now = new Date() }) {
  if (!row) return 'not-found'
  const pushed = kind === 'invite' ? row.invite_pushed_at : row.accept_pushed_at
  if (pushed) return 'already'
  const at = kind === 'invite' ? row.created_at : row.accepted_at
  if (!at || now - new Date(at) > 10 * 60000) return 'too-old'
  const p = notifyPrefs(tagSettings)
  if (isQuiet(p, twToday(now))) return 'quiet'
  if (nightTime(taipeiHour(now))) return 'night'
  return null
}

async function pushTo(db, userId, payload) {
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', userId)
  if (!subs || !subs.length) return { pushed: false, reason: 'no-device' }
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_CONTACT || 'tseng188109@gmail.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload))
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
    }
  }
  return { pushed: sent > 0, sent }
}

async function buddyPush(db, me, id, kind, res) {
  const { data: row } = await db.from('buddies')
    .select('id,from_id,to_id,status,created_at,accepted_at,invite_pushed_at,accept_pushed_at').eq('id', id).maybeSingle()
  // 邀請：只有送出邀請的本人、還在等回覆；答應：只有答應的本人、已經是搭檔
  const mine = row && (kind === 'invite'
    ? row.from_id === me && row.status === 'pending'
    : row.to_id === me && row.status === 'active')
  if (!mine) return res.status(404).json({ error: '找不到這個搭檔邀請' })
  const target = kind === 'invite' ? row.to_id : row.from_id
  const { data: to } = await db.from('users').select('tag_settings').eq('id', target).maybeSingle()
  const why = buddySkipReason({ row, kind, tagSettings: to && to.tag_settings })
  if (why) return res.status(200).json({ pushed: false, reason: why })
  const col = kind === 'invite' ? 'invite_pushed_at' : 'accept_pushed_at'
  const { data: claimed } = await db.from('buddies').update({ [col]: new Date().toISOString() })
    .eq('id', id).is(col, null).select('id')
  if (!claimed || !claimed.length) return res.status(200).json({ pushed: false, reason: 'already' })
  const { data: from } = await db.from('users').select('name').eq('id', me).maybeSingle()
  const name = (from && from.name) || '隊友'
  const payload = kind === 'invite'
    ? { title: `${name}邀你當搭檔`, body: '打開 App 點右上角的鈴鐺，就能答應他。', url: '/' }
    : { title: `${name}答應當你的搭檔了`, body: '從今天開始一起連續行動，看你們能連勝幾天。', url: '/' }
  return res.status(200).json(await pushTo(db, target, payload))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: '請先登入' })
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  try {
    const { data: who, error: we } = await db.auth.getUser(token)
    if (we || !who || !who.user) return res.status(401).json({ error: '請重新登入' })
    const me = who.user.id
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const id = Number(body.id)
    if (body.buddy === 'invite' || body.buddy === 'accept') {
      if (!id) return res.status(400).json({ error: '少了搭檔邀請編號' })
      return await buddyPush(db, me, id, body.buddy, res)
    }
    if (!id) return res.status(400).json({ error: '少了打氣編號' })

    const { data: cheer } = await db.from('cheers').select('id,from_id,to_id,text,created_at,pushed_at').eq('id', id).maybeSingle()
    if (!cheer || cheer.from_id !== me) return res.status(404).json({ error: '找不到這則打氣' })
    const { data: to } = await db.from('users').select('tag_settings').eq('id', cheer.to_id).maybeSingle()
    const why = skipReason({ cheer, tagSettings: to && to.tag_settings })
    if (why) return res.status(200).json({ pushed: false, reason: why })

    // 先標記「送過了」，同一則就算被叫兩次也只送一次
    const { data: claimed } = await db.from('cheers').update({ pushed_at: new Date().toISOString() })
      .eq('id', id).is('pushed_at', null).select('id')
    if (!claimed || !claimed.length) return res.status(200).json({ pushed: false, reason: 'already' })

    const { data: from } = await db.from('users').select('name').eq('id', me).maybeSingle()
    return res.status(200).json(await pushTo(db, cheer.to_id, { title: `${(from && from.name) || '隊友'}給你打氣`, body: cheer.text, url: '/' }))
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) })
  }
}
