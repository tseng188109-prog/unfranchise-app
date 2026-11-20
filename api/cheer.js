// 隊友打氣的手機通知：App 把打氣存好之後（send_cheer），叫這裡把通知送給對方。
// 先用登入憑證確認是送的人本人、這則還沒送過通知，才用後台權限送。
// 不送的情況：晚上 10 點到早上 7 點、對方開了安靜模式、對方關掉「隊友給我打氣」、對方沒開通知。
// 不送的打氣一樣存著，對方下次打開 App 會跳小卡、鈴鐺裡也看得到。
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
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', cheer.to_id)
    if (!subs || !subs.length) return res.status(200).json({ pushed: false, reason: 'no-device' })
    webpush.setVapidDetails(
      'mailto:' + (process.env.VAPID_CONTACT || 'tseng188109@gmail.com'),
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    let sent = 0
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: `${(from && from.name) || '隊友'}給你打氣`, body: cheer.text, url: '/' })
        )
        sent++
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
    return res.status(200).json({ pushed: sent > 0, sent })
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) })
  }
}
