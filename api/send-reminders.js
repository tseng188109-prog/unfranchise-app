// 手機提醒：由 Vercel Schedules 每小時呼叫一次（vercel.json 的 schedules.reminders）。
//   早上 9 點（台北）：把「今天約好的人」推播給對應的店主。
//   其他時段：目前沒有要送的，只留一筆執行紀錄（之後的晚上提醒會接在這裡）。
// 每次執行都寫一筆 push_runs（送了幾則、失敗幾則），系統管理頁看得到。
// 同一次執行如果被送來兩次（Vercel 可能重送），用執行編號擋掉，不會重複推播。
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const TZ = 'Asia/Taipei'
const MORNING_HOUR = 9

// 這次執行「應該是」幾點那一輪：用排程原本的時間（不含延遲），沒有就用現在
export function slotOf(req, now = new Date()) {
  const raw = req.headers['ce-vssscheduledat']
  const t = raw ? new Date(raw) : now
  const at = isNaN(t.getTime()) ? now : t
  const date = at.toLocaleDateString('sv-SE', { timeZone: TZ })
  const hour = Number(at.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }))
  return { date, hour }
}

// 今天約了誰：同一位店主的約會合成一則
export function buildMorning(plans) {
  const byUser = {}
  ;(plans || []).filter(p => !p.is_muted).forEach(p => {
    (byUser[p.user_id] = byUser[p.user_id] || []).push(p)
  })
  return Object.keys(byUser).map(userId => {
    const list = byUser[userId]
    const first = list[0]
    return {
      userId,
      title: list.length === 1 ? `今天約了 ${first.name}` : `今天約了 ${list.length} 位`,
      body: list.length === 1
        ? (first.next_plan || '記得去見面')
        : list.map(p => p.name + (p.next_plan ? '　' + p.next_plan : '')).join('\n'),
    }
  })
}

async function sendAll(db, messages) {
  let sent = 0, failed = 0
  for (const m of messages) {
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', m.userId)
    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: '/' })
        )
        sent++
      } catch (e) {
        // 手機那邊已經取消（換手機、刪掉 App）：把這筆登記清掉，不算失敗
        if (e.statusCode === 404 || e.statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          failed++
        }
      }
    }
  }
  return { sent, failed }
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { date, hour } = slotOf(req)
  const kind = hour === MORNING_HOUR ? 'morning' : 'idle'
  const executionId = req.headers['ce-id'] || `manual-${Date.now()}`

  // 先登記這次執行；同一個執行編號已經有了＝重送，直接結束
  const { data: run, error: runErr } = await db.from('push_runs')
    .insert({ execution_id: executionId, slot_date: date, slot_hour: hour, kind })
    .select('id').single()
  if (runErr) {
    if (runErr.code === '23505') return res.status(200).json({ ok: true, duplicate: true })
    // 紀錄表還沒建好也照常送，只是沒有紀錄
  }

  try {
    let users = 0, sent = 0, failed = 0
    if (kind === 'morning') {
      webpush.setVapidDetails(
        'mailto:' + (process.env.VAPID_CONTACT || 'tseng188109@gmail.com'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )
      const { data: plans, error } = await db.from('contacts')
        .select('user_id,name,next_plan,is_muted')
        .eq('next_plan_date', date)
      if (error) throw error
      const messages = buildMorning(plans)
      users = messages.length
      ;({ sent, failed } = await sendAll(db, messages))
    }
    if (run) await db.from('push_runs').update({ users, sent, failed, finished_at: new Date().toISOString() }).eq('id', run.id)
    return res.status(200).json({ ok: true, date, hour, kind, users, sent, failed })
  } catch (e) {
    const msg = String((e && e.message) || e)
    if (run) await db.from('push_runs').update({ note: msg.slice(0, 300), finished_at: new Date().toISOString() }).eq('id', run.id)
    return res.status(500).json({ error: msg })
  }
}
