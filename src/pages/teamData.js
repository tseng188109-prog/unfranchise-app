// teamData.js — 戰隊的打氣、好消息、搭檔連勝：讀寫資料庫都在這裡
// 權限都在資料庫把關（deliver-76）：打氣只有收到的人和送的人看得到、好消息只有同隊看得到、
// 搭檔只有兩個人看得到。這裡讀不到別人的名單、顧客、業績內容。
import { supabase } from '../supabase'
import { twToday, addDays, activeDaysFrom, STREAK_KEYS } from '../lib/rhythm'
import { pairStreak, pairBest, inviteExpired, runStart } from '../lib/buddy'

export const CHEER_GROUPS = [
  { key: 'start', label: '一起開始' },
  { key: 'courage', label: '給你勇氣' },
  { key: 'clap', label: '幫你鼓掌' },
  { key: 'miss', label: '想你了' },
  { key: 'now', label: '現在就去' },
  { key: 'quote', label: '一句話' },
]

// 資料庫還沒裝好、或離線時，今天的一句話和完成後的按鈕先用這組（跟句子包裡的原文一樣）
const FALLBACK = {
  quote: ['成功是一種習慣，失敗也是一種習慣'],
  self: ['我真棒！！', '我好棒喔！', '耶！我做到了', '今天也很棒！', '給自己拍拍手', '我真的可以耶', '嘿嘿，完成了',
    '不愧是我！', '我也太讚了吧', '今天表現不錯', '好耶！完成啦', '我有進步耶！', '值得鼓勵一下', '越來越上手了', '今天也有做到'],
}

let phraseCache = null // { date, byGrp }
export async function loadPhrases() {
  const today = twToday()
  if (phraseCache && phraseCache.date === today) return phraseCache.byGrp
  const byGrp = {}
  try {
    const { data, error } = await supabase.rpc('active_phrases')
    if (!error) (data || []).forEach(p => { (byGrp[p.grp] = byGrp[p.grp] || []).push(p.text) })
  } catch { /* 用預設的 */ }
  Object.keys(FALLBACK).forEach(k => { if (!byGrp[k] || !byGrp[k].length) byGrp[k] = FALLBACK[k] })
  phraseCache = { date: today, byGrp }
  return byGrp
}
export function phrasesNow() { return phraseCache ? phraseCache.byGrp : FALLBACK }

// 今天的一句話：同一天大家看到同一句，每天換
export function quoteOfDay(byGrp, date = twToday()) {
  const list = (byGrp && byGrp.quote && byGrp.quote.length) ? byGrp.quote : FALLBACK.quote
  const n = Math.round(new Date(date + 'T00:00:00Z').getTime() / 86400000)
  return list[((n % list.length) + list.length) % list.length]
}
// 完成後的按鈕：每次隨機一句誇自己的話
export function selfPraise(byGrp = phrasesNow()) {
  const list = (byGrp && byGrp.self && byGrp.self.length) ? byGrp.self : FALLBACK.self
  return list[Math.floor(Math.random() * list.length)]
}

// 名字（只拿得到隊友、推薦關係裡的人的名字）
export async function namesOf(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))]
  if (!uniq.length) return {}
  const { data } = await supabase.rpc('get_people_names', { p_ids: uniq })
  const out = {}
  ;(data || []).forEach(u => { out[u.id] = u.name || '隊友' })
  return out
}

// 我的戰隊和隊友（不含自己）
export async function myTeammates(userId) {
  const { data: me } = await supabase.from('team_members').select('team_id').eq('user_id', userId).maybeSingle()
  if (!me) return { teamId: null, mates: [] }
  const { data: rows } = await supabase.from('team_members').select('user_id,joined_at').eq('team_id', me.team_id).order('joined_at', { ascending: true })
  const ids = (rows || []).map(r => r.user_id).filter(id => id !== userId)
  const names = await namesOf(ids)
  return { teamId: me.team_id, mates: ids.map(id => ({ user_id: id, name: names[id] || '隊友' })) }
}

// ───────── 打氣 ─────────
export async function cheerStatus() {
  const { data, error } = await supabase.rpc('team_cheer_status')
  if (error) return {}
  const out = {}
  ;(data || []).forEach(r => { out[r.user_id] = r })
  return out
}

export async function sendCheer(toId, text) {
  const { data: id, error } = await supabase.rpc('send_cheer', { p_to: toId, p_text: text })
  if (error) return { ok: false, error: error.message || '送不出去，請稍後再試' }
  // 手機通知交給後台送（晚上 10 點到早上 7 點、對方開安靜模式時不送）；送不出去也不影響
  try {
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  } catch { /* ignore */ }
  return { ok: true, id }
}

// 我收到的打氣（最近 days 天），帶送的人的名字
export async function myCheers(userId, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data } = await supabase.from('cheers').select('id,from_id,text,created_at,seen_at')
    .eq('to_id', userId).gte('created_at', since).order('created_at', { ascending: false })
  const rows = (data || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const names = await namesOf(rows.map(r => r.from_id))
  return rows.map(r => ({ ...r, name: names[r.from_id] || '隊友' }))
}
export async function unseenCheers(userId) {
  const rows = await myCheers(userId, 3)
  return rows.filter(r => !r.seen_at)
}
export async function markCheersSeen() {
  try { await supabase.rpc('mark_cheers_seen') } catch { /* ignore */ }
}
export async function teamCheerCount(since) {
  const { data, error } = await supabase.rpc('team_cheer_count', { p_since: since })
  return error ? 0 : (data || 0)
}

// ───────── 這週的好消息 ─────────
export async function loadNews(userId) {
  const since = addDays(twToday(), -6)
  const { data: rows } = await supabase.from('team_news').select('id,user_id,other_id,kind,n,label,day,created_at')
    .gte('day', since).order('created_at', { ascending: false }).limit(60)
  const list = (rows || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const ids = list.map(r => r.id)
  let claps = []
  if (ids.length) {
    const { data } = await supabase.from('news_claps').select('news_id,user_id').in('news_id', ids)
    claps = data || []
  }
  const names = await namesOf([...list.map(r => r.user_id), ...list.map(r => r.other_id), ...claps.map(c => c.user_id)])
  return list.map(r => {
    const mine = claps.filter(c => c.news_id === r.id)
    return {
      ...r,
      name: names[r.user_id] || '隊友',
      otherName: r.other_id ? (names[r.other_id] || '隊友') : null,
      claps: mine.length,
      clapped: mine.some(c => c.user_id === userId),
      own: r.user_id === userId || r.other_id === userId,
      clappers: mine.map(c => names[c.user_id] || '隊友'),
    }
  })
}
export async function setClap(newsId, userId, on) {
  if (on) {
    const { error } = await supabase.from('news_claps').insert({ news_id: newsId, user_id: userId })
    return !error || error.code === '23505'
  }
  const { error } = await supabase.from('news_claps').delete().eq('news_id', newsId).eq('user_id', userId)
  return !error
}
export async function addNews(kind, n, otherId = null, since = null) {
  try { await supabase.rpc('add_team_news', { p_kind: kind, p_n: n, p_other: otherId, p_since: since }) } catch { /* ignore */ }
}
// 首頁旗子的小紅點：上次看戰隊頁之後，有沒有別人的新好消息
const NEWS_SEEN_KEY = 'ufa_team_news_seen'
export function markNewsSeen() { try { localStorage.setItem(NEWS_SEEN_KEY, new Date().toISOString()) } catch { /* ignore */ } }
export async function hasNewNews(userId) {
  let since
  try { since = localStorage.getItem(NEWS_SEEN_KEY) } catch { since = null }
  if (!since) since = new Date(Date.now() - 2 * 86400000).toISOString()
  const { data } = await supabase.from('team_news').select('id,user_id,other_id').gt('created_at', since).limit(20)
  return (data || []).some(r => r.user_id !== userId && r.other_id !== userId)
}

// ───────── 搭檔連勝 ─────────
export async function loadBuddyRows(userId) {
  const { data } = await supabase.from('buddies').select('id,from_id,to_id,status,created_at,start_day')
    .in('status', ['pending', 'active']).or(`from_id.eq.${userId},to_id.eq.${userId}`)
  const rows = (data || []).filter(b => b.status === 'active' || !inviteExpired(b.created_at))
  return rows.map(b => ({ ...b, otherId: b.from_id === userId ? b.to_id : b.from_id, incoming: b.to_id === userId }))
}

// 搭檔清單＋每一對的連勝（extraMine：今天剛記的，資料庫可能還沒寫好）
export async function loadBuddies(userId, { extraMine = [] } = {}) {
  const rows = await loadBuddyRows(userId)
  const active = rows.filter(b => b.status === 'active')
  const today = twToday()
  const ids = [userId, ...active.map(b => b.otherId)]
  let checks = []
  if (active.length) {
    const earliest = active.reduce((m, b) => (b.start_day && b.start_day < m ? b.start_day : m), today)
    const { data } = await supabase.from('daily_checkins').select('user_id,date,task_key,is_done')
      .in('user_id', ids).in('task_key', STREAK_KEYS).eq('is_done', true).gte('date', addDays(earliest, -7))
    checks = data || []
  }
  const names = await namesOf(rows.map(b => b.otherId))
  const mine = activeDaysFrom(checks.filter(c => c.user_id === userId))
  extraMine.forEach(d => mine.add(d))
  return {
    rows,
    mine,
    pending: rows.filter(b => b.status === 'pending').map(b => ({ ...b, name: names[b.otherId] || '隊友' })),
    active: active.map(b => {
      const other = activeDaysFrom(checks.filter(c => c.user_id === b.otherId))
      const s = pairStreak(mine, other, b.start_day, today)
      const both = new Set([...mine].filter(d => other.has(d) && d >= b.start_day))
      return {
        ...b, name: names[b.otherId] || '隊友', streak: s,
        best: s.count ? 0 : pairBest(mine, other, b.start_day, today),
        since: runStart(both, today, s.count),
        // 兩個人最近一次「同一天都有做」是哪天（搭檔晚上才做，我隔天打開也看得到慶祝）
        lastBoth: [...both].filter(d => d <= today).sort().pop() || null,
        // 我今天做一件事，連勝會變幾天
        ifIAct: pairStreak(new Set([...mine, today]), other, b.start_day, today).count,
      }
    }),
  }
}

export async function buddyRpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  return error ? { ok: false, error: error.message } : { ok: true, data }
}

// 慶祝過了沒（同一次不重複跳）
export async function marked(key) {
  const { data } = await supabase.from('buddy_marks').select('key').eq('key', key).maybeSingle()
  return !!data
}
export async function mark(key, userId) {
  try { await supabase.from('buddy_marks').insert({ key, user_id: userId }) } catch { /* ignore */ }
}
