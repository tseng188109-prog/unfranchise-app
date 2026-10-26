// 每天早上 9 點（台北）由 Vercel 自動呼叫：把「今天約好的人」推播給對應的店主。
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    webpush.setVapidDetails(
      'mailto:' + (process.env.VAPID_CONTACT || 'tseng188109@gmail.com'),
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

    const { data: plans, error } = await db.from('contacts')
      .select('user_id,name,next_plan,is_muted')
      .eq('next_plan_date', today)
    if (error) throw error

    const byUser = {}
    ;(plans || []).filter(p => !p.is_muted).forEach(p => {
      (byUser[p.user_id] = byUser[p.user_id] || []).push(p)
    })

    let sent = 0
    for (const userId of Object.keys(byUser)) {
      const list = byUser[userId]
      const first = list[0]
      const title = list.length === 1 ? `今天約了 ${first.name}` : `今天約了 ${list.length} 位`
      const body = list.length === 1
        ? (first.next_plan || '記得去見面')
        : list.map(p => p.name + (p.next_plan ? '　' + p.next_plan : '')).join('\n')
      const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', userId)
      for (const s of subs || []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title, body, url: '/' })
          )
          sent++
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            await db.from('push_subscriptions').delete().eq('id', s.id)
          }
        }
      }
    }
    return res.status(200).json({ ok: true, date: today, users: Object.keys(byUser).length, sent })
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) })
  }
}
