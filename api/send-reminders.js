// 手機提醒：由 Vercel Schedules 每小時呼叫一次（vercel.json 的 schedules.reminders）。
//   早上 9 點（台北）：今天約好的人
//   晚上 19–23 點：每個人自己選的那個整點，提醒「今天還差什麼」（今天已經做滿就不送）
//   晚上 8 點：你推薦的夥伴連續天數到里程碑（每天）／一週總結（週五）／戰隊進度（週三）
// 每個人可以在 設定 → 手機提醒 關掉任何一種，或開「安靜模式」暫停全部。
// 每次執行都寫一筆 push_runs（送了幾則、失敗幾則），系統管理頁看得到。
// 同一次執行如果被送來兩次（Vercel 可能重送），用執行編號擋掉，不會重複推播。
/* global process */
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import {
  modeOf, count312, computeStreak, activeDaysFrom, eveningMessage, notifyPrefs, isQuiet,
  addDays, weekStartOf, dowOf, isMilestone, weekStats, weeklyMessage, STREAK_KEYS,
} from '../src/lib/rhythm.js'

const TZ = 'Asia/Taipei'
const MORNING_HOUR = 9
const NEWS_HOUR = 20

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

// 一次最多拿 1000 筆，超過就一頁一頁拿
async function all(make) {
  const out = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await make().range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}
const group = (rows, key = 'user_id') => rows.reduce((m, r) => { (m[r[key]] = m[r[key]] || []).push(r); return m }, {})

// 一段日期內加進名單的人（跟 App 的 fetchAddedContacts 同一個規則）
async function addedBetween(db, userIds, from, to) {
  const fi = from + 'T00:00:00+08:00', ti = addDays(to, 1) + 'T00:00:00+08:00'
  const a = await all(() => db.from('contacts').select('id,user_id').is('source', null).in('user_id', userIds).gte('added_date', from).lte('added_date', to))
  const b = await all(() => db.from('contacts').select('id,user_id').is('source', null).in('user_id', userIds).is('added_date', null).gte('created_at', fi).lt('created_at', ti))
  return [...a, ...b]
}

async function streaksOf(db, userIds, today) {
  if (!userIds.length) return {}
  const rows = await all(() => db.from('daily_checkins').select('user_id,date,task_key,is_done')
    .in('user_id', userIds).in('task_key', STREAK_KEYS).eq('is_done', true).gte('date', addDays(today, -400)))
  const by = group(rows)
  const out = {}
  userIds.forEach(id => { out[id] = computeStreak(activeDaysFrom(by[id] || []), today) })
  return out
}

export async function planMessages(db, { date, hour }) {
  const subs = await all(() => db.from('push_subscriptions').select('user_id'))
  const subUsers = [...new Set(subs.map(s => s.user_id))]
  if (!subUsers.length) return { parts: [], messages: [] }
  const users = await all(() => db.from('users').select('id,name,referrer_id,tag_settings,created_at').in('id', subUsers))
  const prefsOf = {}
  users.forEach(u => { prefsOf[u.id] = notifyPrefs(u.tag_settings) })
  const canGet = (id, key) => prefsOf[id] && prefsOf[id][key] && !isQuiet(prefsOf[id], date)
  const parts = []
  const messages = []

  if (hour === MORNING_HOUR) {
    parts.push('morning')
    const plans = await all(() => db.from('contacts').select('user_id,name,next_plan,is_muted').eq('next_plan_date', date))
    buildMorning(plans).filter(m => canGet(m.userId, 'morning')).forEach(m => messages.push({ ...m, url: '/' }))
  }

  const eveningUsers = users.filter(u => canGet(u.id, 'evening') && prefsOf[u.id].eveningHour === hour)
  if (eveningUsers.length) {
    parts.push('evening')
    const ids = eveningUsers.map(u => u.id)
    const [logs, added, met, streaks] = await Promise.all([
      all(() => db.from('contact_logs').select('user_id,contact_id,kind').in('user_id', ids).eq('date', date)),
      addedBetween(db, ids, date, date),
      all(() => db.from('counter_logs').select('user_id,contact_id,date,planned_date,note').in('user_id', ids)
        .eq('counter_key', 'meetup').eq('is_done', true).eq('date', date)),
      streaksOf(db, ids, date),
    ])
    const L = group(logs), A = group(added), M = group(met)
    eveningUsers.forEach(u => {
      const counts = count312({ logs: L[u.id] || [], added: A[u.id] || [], met: M[u.id] || [] })
      const msg = eveningMessage(counts, modeOf(u.tag_settings, u.created_at), streaks[u.id])
      if (msg) messages.push({ userId: u.id, ...msg, url: '/' })
    })
  }

  if (hour === NEWS_HOUR) {
    // 你推薦的夥伴：連續天數剛好到里程碑（7 天以上）
    const recommenders = users.filter(u => canGet(u.id, 'partnerNews')).map(u => u.id)
    if (recommenders.length) {
      parts.push('news')
      const kids = await all(() => db.from('users').select('id,name,referrer_id').in('referrer_id', recommenders))
      const st = await streaksOf(db, kids.map(k => k.id), date)
      kids.forEach(k => {
        const s = st[k.id]
        if (s && s.todayActive && s.count >= 7 && isMilestone(s.count)) {
          messages.push({ userId: k.referrer_id, title: `${k.name || '你推薦的夥伴'}連續 ${s.count} 天了`, body: '傳個訊息替他加油吧', url: '/partners' })
        }
      })
    }

    // 週五：一週總結
    if (dowOf(date) === 5) {
      const ids = users.filter(u => canGet(u.id, 'weekly')).map(u => u.id)
      if (ids.length) {
        parts.push('weekly')
        const ws = weekStartOf(date)
        const [meets, logs, added, checkins] = await Promise.all([
          all(() => db.from('counter_logs').select('user_id,contact_id,date,planned_date,note').in('user_id', ids)
            .eq('counter_key', 'meetup').eq('is_done', true).gte('date', ws).lte('date', date)),
          all(() => db.from('contact_logs').select('user_id,contact_id,date,kind').in('user_id', ids).gte('date', ws).lte('date', date)),
          addedBetween(db, ids, ws, date),
          all(() => db.from('daily_checkins').select('user_id,date,task_key,is_done').in('user_id', ids)
            .eq('task_key', 'daily_3_contacts').eq('is_done', true).gte('date', ws).lte('date', date)),
        ])
        const Me = group(meets), L = group(logs), A = group(added), C = group(checkins)
        ids.forEach(id => {
          const w = weekStats({ meets: Me[id] || [], logs: L[id] || [], added: A[id] || [], checkins: C[id] || [] })
          messages.push({ userId: id, ...weeklyMessage(w), url: '/week' })
        })
      }
    }

    // 週三：戰隊進度（這週有幾位隊友做滿過一天）
    if (dowOf(date) === 3) {
      const ids = users.filter(u => canGet(u.id, 'team')).map(u => u.id)
      if (ids.length) {
        parts.push('team')
        const mine = await all(() => db.from('team_members').select('team_id,user_id').in('user_id', ids))
        const teamIds = [...new Set(mine.map(m => m.team_id))]
        const members = teamIds.length ? await all(() => db.from('team_members').select('team_id,user_id').in('team_id', teamIds)) : []
        const memberIds = [...new Set(members.map(m => m.user_id))]
        const full = memberIds.length ? await all(() => db.from('daily_checkins').select('user_id').in('user_id', memberIds)
          .eq('task_key', 'daily_3_contacts').eq('is_done', true).gte('date', weekStartOf(date)).lte('date', date)) : []
        const fullSet = new Set(full.map(f => f.user_id))
        mine.forEach(m => {
          const n = members.filter(x => x.team_id === m.team_id && fullSet.has(x.user_id)).length
          if (n > 0) messages.push({ userId: m.user_id, title: `你的戰隊這週已經有 ${n} 人做滿過每日節奏`, body: '一起往前，週五前再推一把', url: '/team' })
        })
      }
    }
  }

  // 同一個人同一輪最多 2 則（例如週五晚上 8 點：一週總結＋晚上提醒），多的不送
  const count = {}
  const capped = messages.filter(m => { count[m.userId] = (count[m.userId] || 0) + 1; return count[m.userId] <= 2 })
  return { parts, messages: capped }
}

async function sendAll(db, messages) {
  let sent = 0, failed = 0
  const users = new Set()
  for (const m of messages) {
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', m.userId)
    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: m.url || '/' })
        )
        sent++; users.add(m.userId)
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
  return { sent, failed, users: users.size }
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { date, hour } = slotOf(req)
  const executionId = req.headers['ce-id'] || `manual-${Date.now()}`

  // 先登記這次執行；同一個執行編號已經有了＝重送，直接結束
  const { data: run, error: runErr } = await db.from('push_runs')
    .insert({ execution_id: executionId, slot_date: date, slot_hour: hour, kind: 'running' })
    .select('id').single()
  if (runErr && runErr.code === '23505') return res.status(200).json({ ok: true, duplicate: true })
  // 紀錄表還沒建好也照常送，只是沒有紀錄

  try {
    const { parts, messages } = await planMessages(db, { date, hour })
    const kind = parts.length ? parts.join('+') : 'idle'
    let users = 0, sent = 0, failed = 0
    if (messages.length) {
      webpush.setVapidDetails(
        'mailto:' + (process.env.VAPID_CONTACT || 'tseng188109@gmail.com'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )
      ;({ sent, failed, users } = await sendAll(db, messages))
    }
    if (run) await db.from('push_runs').update({ kind, users, sent, failed, finished_at: new Date().toISOString() }).eq('id', run.id)
    return res.status(200).json({ ok: true, date, hour, kind, users, sent, failed })
  } catch (e) {
    const msg = String((e && e.message) || e)
    if (run) await db.from('push_runs').update({ kind: 'error', note: msg.slice(0, 300), finished_at: new Date().toISOString() }).eq('id', run.id)
    return res.status(500).json({ error: msg })
  }
}
