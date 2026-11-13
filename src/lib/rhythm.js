// rhythm.js — 每日節奏、連續天數、提醒文字的「純計算」。
// App 畫面（src/pages）和後台提醒（api/send-reminders.js）共用這一份，兩邊算出來才會一樣。
// 這個檔案不連資料庫、不畫畫面，只吃資料、吐結果，方便測試。

// ── 日期（全部用台北日期字串 YYYY-MM-DD） ──
export function twToday(now = new Date()) { return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
export function twDayOf(iso) { return iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) : '' }
export function addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
export function dowOf(d) { return new Date(d + 'T00:00:00Z').getUTCDay() } // 0=日 … 6=六
// 一週＝週六到週五（業績結算週）
export function weekStartOf(d) { return addDays(d, -((dowOf(d) + 1) % 7)) }
export function weekDaysOf(d) { const s = weekStartOf(d); return Array.from({ length: 7 }, (_, i) => addDays(s, i)) }
export function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) }
export function md(d) { return d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '' }
export const WEEK_LABELS = ['六', '日', '一', '二', '三', '四', '五']

// ── 每日節奏（跟 dailyMode.jsx 的三種模式同一組數字） ──
export const MODE_COUNTS = {
  start: { key: 'start', label: '1-1-2', talk: 1, meet: 1, fresh: 2 },
  std: { key: 'std', label: '3-1-2', talk: 3, meet: 1, fresh: 2 },
  fast: { key: 'fast', label: '10-3-2', talk: 10, meet: 3, fresh: 2 },
}
export function modeOf(tagSettings, createdAt, now = Date.now()) {
  const k = tagSettings && tagSettings.daily_mode
  if (k && MODE_COUNTS[k]) return MODE_COUNTS[k]
  const days = createdAt ? (now - new Date(createdAt).getTime()) / 86400000 : 999
  return days < 14 ? MODE_COUNTS.start : MODE_COUNTS.std
}

// 一天的三個數字（跟 followUp.jsx 的 syncDaily3 同一套算法）
//   logs：那天的 contact_logs（contact_id, kind）
//   added：那天加進名單的人（只要筆數）
//   met：那天沒先約、直接見面後補記的 counter_logs（contact_id, date, planned_date, note）
export const INVITE_KINDS = ['meet_plan', 'invite_no', 'invite_wait']
export function count312({ logs = [], added = [], met = [] }) {
  const talk = new Set(logs.map(r => r.contact_id)).size
  const plan = new Set([
    ...logs.filter(l => INVITE_KINDS.includes(l.kind)),
    ...met.filter(r => r.contact_id && !r.note && r.planned_date === r.date),
  ].map(l => l.contact_id)).size
  return { talk, plan, fresh: added.length }
}
export function isFull(c, mode) { return c.talk >= mode.talk && c.plan >= mode.meet && c.fresh >= mode.fresh }
// 還差什麼：[{ key, label, left }]
export function missingOf(c, mode) {
  const out = []
  if (c.talk < mode.talk) out.push({ key: 'talk', label: '互動', left: mode.talk - c.talk, unit: '位' })
  if (c.plan < mode.meet) out.push({ key: 'plan', label: '邀約', left: mode.meet - c.plan, unit: '個' })
  if (c.fresh < mode.fresh) out.push({ key: 'fresh', label: '新名單', left: mode.fresh - c.fresh, unit: '位' })
  return out
}

// ── 連續天數 ──
// 有行動的日子：互動、邀約、新名單任一項做了（daily_312），或當天 3-1-2 做滿（daily_3_contacts）。
// 規則：每一週（六到五）有一天「休息日」，沒做也不會斷；同一週第二天沒做才會斷。
// 今天還沒做不算斷（今天還沒過完）。
export const STREAK_KEYS = ['daily_312', 'daily_3_contacts']
export function activeDaysFrom(rows) {
  return new Set((rows || []).filter(r => r.is_done !== false && STREAK_KEYS.includes(r.task_key)).map(r => r.date))
}
export function computeStreak(active, today, maxBack = 400) {
  const has = d => active.has(d)
  const todayActive = has(today)
  const restUsed = new Set() // 用掉休息日的週（週六日期）
  const restDays = []
  let count = 0
  let d = todayActive ? today : addDays(today, -1)
  let lastActive = null
  for (let i = 0; i < maxBack; i++) {
    if (has(d)) { count++; lastActive = d }
    else {
      const w = weekStartOf(d)
      if (restUsed.has(w)) break
      restUsed.add(w); restDays.push(d)
    }
    d = addDays(d, -1)
  }
  // 最後面（最早）那些休息日如果後面沒有任何行動，不算（只是還沒開始）
  const realRest = lastActive ? restDays.filter(r => r > lastActive) : []
  return {
    count, todayActive,
    restDays: realRest,
    restUsedYesterday: count > 0 && realRest.includes(addDays(today, -1)),
    restUsedThisWeek: realRest.some(r => weekStartOf(r) === weekStartOf(today)),
  }
}
// 這一週七格的狀態：on 有做、rest 休息日、no 沒做、today 今天還沒做、future 還沒到
export function weekStrip(active, today, streak) {
  const rest = new Set(streak ? streak.restDays : [])
  return weekDaysOf(today).map((d, i) => ({
    date: d, label: WEEK_LABELS[i],
    state: active.has(d) ? 'on' : d === today ? 'today' : d > today ? 'future' : rest.has(d) ? 'rest' : 'no',
  }))
}
export const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500]
export function isMilestone(n) { return MILESTONES.includes(n) }

// ── 提醒設定（存在 users.tag_settings.notify） ──
export const EVENING_HOURS = [19, 20, 21, 22, 23]
export function notifyPrefs(tagSettings) {
  const n = (tagSettings && tagSettings.notify) || {}
  return {
    morning: n.morning !== false,
    evening: n.evening !== false,
    eveningHour: EVENING_HOURS.includes(n.eveningHour) ? n.eveningHour : 21,
    weekly: n.weekly !== false,
    partnerNews: n.partnerNews !== false,
    team: n.team === true,
    quietUntil: n.quietUntil || null,
  }
}
export function isQuiet(prefs, today) { return !!prefs.quietUntil && prefs.quietUntil >= today }

// ── 晚上提醒的一句話（今天已經做滿就不提醒 → 回 null） ──
export function eveningMessage(counts, mode, streak) {
  if (isFull(counts, mode)) return null
  const miss = missingOf(counts, mode)
  const any = counts.talk + counts.plan + counts.fresh > 0
  if (any && miss.length === 1) {
    const m = miss[0]
    return { title: `今天只差 ${m.left} ${m.unit}${m.label}`, body: `做完，今天的 ${mode.label} 就完成了` }
  }
  if (!streak.todayActive && streak.count >= 2) {
    return { title: `連續 ${streak.count} 天了`, body: '今天做一件事就能守住，互動、邀約、新名單任一項都算' }
  }
  if (any) {
    return { title: `今天還差：${miss.map(m => `${m.label} ${m.left} ${m.unit}`).join('、')}`, body: '睡前再推一步就好' }
  }
  return { title: '今天還沒開始也沒關係', body: '先找一位朋友聊聊近況，就是往前一步' }
}

// ── 推薦人看夥伴：依數字給一句「可以怎麼陪他」 ──
//   s: { contacts_total, contacts_new, top10_filled, talk, invites, invite_yes, invite_no, invite_wait, met }
export function partnerAdvice(s, jar) {
  if (!s) return ''
  const acted = (s.talk || 0) + (s.invites || 0) + (s.contacts_new || 0)
  if (acted === 0) return '這週還沒動，打個電話關心一下就好，不用催。'
  if (jar && jar.cooling > 0) return `他有 ${jar.cooling} 顆核桃熱度在退，提醒他趁熱跟進，需要的話陪他三方通話。`
  if ((s.contacts_total || 0) < 20) return '名單還少，可以陪他做一次記憶喚醒，一起想想還有誰。'
  if ((s.top10_filled || 0) < 10) return `首選 10 只選了 ${s.top10_filled || 0} 位，可以約他一起挑。`
  if ((s.invites || 0) >= 3 && (s.invite_yes || 0) <= Math.floor((s.invites || 0) / 3)) return '開口了但大多沒約成，可以一起練邀約的說法。'
  if ((s.talk || 0) >= 3 && (s.invites || 0) === 0) return '互動很多但還沒開口邀約，可以陪他挑一位先約。'
  if ((s.invite_yes || 0) > 0 && (s.met || 0) === 0) return '有約成的人，見面前可以跟他一起準備要聊什麼。'
  return '節奏不錯，記得稱讚他做到的地方。'
}

// ── 一週總結 ──
export function weekSummaryText(w) {
  return `這週（${md(w.start)}–${md(w.end)}）我見到 ${w.met} 位、開口邀約 ${w.invites} 次、新增名單 ${w.fresh} 位，` +
    `每天 ${w.modeLabel} 做滿 ${w.fullDays} 天` + (w.streak > 1 ? `，連續行動 ${w.streak} 天` : '') + '。'
}

// 小鼓勵的文字：哪一項變多了
export function toastFor(prev, cur) {
  const m = cur.mode
  if (cur.plan > prev.plan) return { color: '#2457D6', title: '開口了，就算數', sub: cur.plan >= m.meet ? '今天的邀約達成' : `再 ${m.meet - cur.plan} 個邀約就達成` }
  if (cur.talk > prev.talk) return { color: '#2F7A52', title: `互動 +${cur.talk - prev.talk}`, sub: cur.talk >= m.talk ? '今天的互動達成了' : `再 ${m.talk - cur.talk} 位，今天的互動就達成了` }
  if (cur.fresh > prev.fresh) return { color: '#C9822B', title: `新名單 +${cur.fresh - prev.fresh}`, sub: cur.fresh >= m.fresh ? '今天的新名單達成了' : `再 ${m.fresh - cur.fresh} 位就達成` }
  return null
}

// 一週的數字（跟「給帶領者的報告」同一套算法）
//   meets：按了「見完了」的 counter_logs（meetup，is_done）
//   logs：contact_logs（kind）
//   added：加進名單的人
//   checkins：daily_checkins（task_key, date, is_done）
export function weekStats({ meets = [], logs = [], added = [], checkins = [] }) {
  const unplanned = meets.filter(r => r.contact_id && !r.note && r.planned_date === r.date)
  return {
    talk: new Set(logs.map(l => l.contact_id + '|' + l.date)).size,
    met: meets.length,
    invites: logs.filter(l => INVITE_KINDS.includes(l.kind)).length + unplanned.length,
    fresh: added.length,
    fullDays: new Set(checkins.filter(c => c.task_key === 'daily_3_contacts' && c.is_done !== false).map(c => c.date)).size,
  }
}
export function weeklyMessage(w) {
  if (!w.met && !w.invites && !w.fresh) return { title: '這週先休息了也沒關係', body: '下週從一位朋友開始就好' }
  return { title: '這一週，你做到了這些', body: `見到 ${w.met} 位、開口邀約 ${w.invites} 次、新名單 ${w.fresh} 位，來看看你的一週` }
}

// 一週總結看哪一週：週五看這一週（到今天），其他天看上一週
export function summaryRange(today) {
  const ws = weekStartOf(today)
  return dowOf(today) === 5 ? { start: ws, end: today } : { start: addDays(ws, -7), end: addDays(ws, -1) }
}
