// deliver-76：戰隊打氣、好消息、搭檔連勝、首頁旗子、火焰、更新提示
// 假資料：我（Yu）、隊友 致（今天做滿）、沈、于（關掉打氣）；跟致是搭檔（第 9 天）；沈邀我當搭檔
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Dashboard from '../../src/pages/Dashboard'
import Team from '../../src/pages/Team'
import Settings from '../../src/pages/Settings'
import Partners from '../../src/pages/Partners'
import Layout from '../../src/pages/Layout'
import { applyTheme } from '../../src/pages/theme'
import { syncDaily3, markDaily312 } from '../../src/pages/followUp'
import { supabase } from '../../src/supabase'
import '../../src/index.css'
applyTheme()
const db = window.__db, T = window.__T, add = window.__add
const Q = location.search
// 我今天還沒有任何行動（才看得到「火焰亮起來」）
db.contact_logs = db.contact_logs.filter(l => l.date !== T)
db.counter_logs = []
db.contacts.forEach(c => { if (c.user_id === 'u') c.created_at = '2026-01-01T00:00:00Z' })
db.users[0].name = 'Yu'; db.users[0].created_at = '2026-01-01T00:00:00Z'; db.users[0].onboarding_done = true
db.users[0].tag_settings = { daily_mode: 'std' }
db.users.push({ id: 'm1', name: '致', tag_settings: {} }, { id: 'm2', name: '沈', tag_settings: {} }, { id: 'm3', name: '于', tag_settings: { notify: { cheer: false } } })
if (!Q.includes('nopartner=1')) db.users.push({ id: 'p1', name: '阿明', referrer_id: 'u', tag_settings: {} })
db.teams = [{ id: 't1', name: '七月新努力', invite_code: 'VU7Z8Q', creator_id: 'u' }]
db.team_members = Q.includes('noteam=1') ? [] : ['u', 'm1', 'm2', 'm3'].map((id, i) => ({ id: 'tm' + i, team_id: 't1', user_id: id, joined_at: '2026-07-0' + (i + 1) + 'T00:00:00Z' }))
db.push_subscriptions = [{ id: 1, user_id: 'm2', endpoint: 'x' }]
// 打卡：我和致前 9 天都有做；致今天也做了（還做滿）；沈只有今天
for (let i = 1; i <= 9; i++) { db.daily_checkins.push({ user_id: 'u', date: add(-i), task_key: 'daily_312', is_done: true }); db.daily_checkins.push({ user_id: 'm1', date: add(-i), task_key: 'daily_312', is_done: true }) }
db.daily_checkins.push({ user_id: 'm1', date: T, task_key: 'daily_312', is_done: true }, { user_id: 'm1', date: T, task_key: 'daily_3_contacts', is_done: true })
db.daily_checkins.push({ user_id: 'm2', date: T, task_key: 'daily_312', is_done: true })
const iso = d => new Date(d + 'T10:00:00+08:00').toISOString()
db.buddies = [
  { id: 1, from_id: 'u', to_id: 'm1', status: 'active', created_at: iso(add(-12)), start_day: add(-9) },
  { id: 2, from_id: 'm2', to_id: 'u', status: 'pending', created_at: new Date().toISOString(), start_day: null },
]
// 搭檔昨天晚上才湊滿第 7 天、我今天才打開
if (Q.includes('buddy7y=1')) { db.buddies[0].start_day = add(-7); db.daily_checkins = db.daily_checkins.filter(c => !(c.date === T && c.user_id === 'm1')) }
if (Q.includes('buddy7=1')) { db.buddies[0].start_day = add(-6); db.daily_checkins.push({ user_id: 'u', date: T, task_key: 'daily_312', is_done: true }) }
db.buddy_marks = []
db.cheers = [
  { id: 11, from_id: 'm2', to_id: 'u', text: '就是現在，傳個訊息出去', created_at: new Date(Date.now() - 3600000).toISOString(), seen_at: null, day: T },
  { id: 12, from_id: 'm1', to_id: 'u', text: '312完成了喔，讚啦', created_at: new Date(Date.now() - 26 * 3600000).toISOString(), seen_at: new Date().toISOString(), day: add(-1) },
]
if (Q.includes('nocheer=1')) db.cheers = []
db.team_news = [
  { id: 21, team_id: 't1', user_id: 'm1', other_id: null, kind: 'retail', n: null, label: null, day: T, created_at: new Date(Date.now() - 600000).toISOString() },
  { id: 22, team_id: 't1', user_id: 'u', other_id: null, kind: 'meet', n: null, label: null, day: add(-1), created_at: new Date(Date.now() - 25 * 3600000).toISOString() },
  { id: 23, team_id: 't1', user_id: 'm1', other_id: 'm2', kind: 'buddy', n: 30, label: null, day: add(-2), created_at: new Date(Date.now() - 50 * 3600000).toISOString() },
  { id: 24, team_id: 't1', user_id: 'm2', other_id: null, kind: 'first312', n: null, label: '1-1-2', day: add(-3), created_at: new Date(Date.now() - 74 * 3600000).toISOString() },
  { id: 25, team_id: 't1', user_id: 'm3', other_id: null, kind: 'partner', n: null, label: null, day: add(-4), created_at: new Date(Date.now() - 98 * 3600000).toISOString() },
]
db.news_claps = [{ news_id: 22, user_id: 'm1' }, { news_id: 21, user_id: 'm2' }]
if (Q.includes('seennews=1')) { try { localStorage.setItem('ufa_team_news_seen', new Date().toISOString()) } catch { /* */ } }
else { try { localStorage.setItem('ufa_team_news_seen', new Date(Date.now() - 3600000 * 2).toISOString()) } catch { /* */ } }

const PHRASES = {
  start: ['欸，今天一起來做312啊', '我準備開始了，你也一起吧', '來啦，今天一起衝一波'],
  courage: ['相信你可以，開口聊聊吧', '就像平常聊天，自然就好'],
  clap: ['欸，你今天很猛欸', '312完成了喔，讚啦', '這個執行力真的可以耶'],
  miss: ['欸，找天一起來做312啊'], now: ['就是現在，傳個訊息出去'],
  quote: ['成功是一種習慣，失敗也是一種習慣', '永遠不要停止相信'],
  self: ['我真棒！！', '不愧是我！', '耶！我做到了'],
}
const nameOf = id => (db.users.find(u => u.id === id) || {}).name
const mates = () => db.team_members.filter(m => m.user_id !== 'u').map(m => m.user_id)
const allowed = id => ((((db.users.find(u => u.id === id) || {}).tag_settings || {}).notify || {}).cheer) !== false
window.__rpcCalls = []
supabase.auth.getSession = () => Promise.resolve({ data: { session: { access_token: 'tok' } } })
window.__fetches = []
window.fetch = (url, opt) => { window.__fetches.push([url, opt && opt.body]); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) }
supabase.rpc = (name, a = {}) => {
  window.__rpcCalls.push([name, a])
  const ok = data => Promise.resolve({ data, error: null })
  const bad = message => Promise.resolve({ data: null, error: { message } })
  switch (name) {
    case 'get_people_names': return ok((a.p_ids || []).map(id => ({ id, name: nameOf(id) })).filter(x => x.name))
    case 'active_phrases': return ok(Object.entries(PHRASES).flatMap(([grp, list]) => list.map((text, i) => ({ grp, text, sort: i }))))
    case 'team_cheer_status': return ok(mates().map(id => ({ user_id: id, can_cheer: allowed(id), cheered_today: db.cheers.some(c => c.from_id === 'u' && c.to_id === id && c.day === T), has_push: db.push_subscriptions.some(p => p.user_id === id) })))
    case 'team_cheer_count': return ok(db.cheers.length + 21)
    case 'send_cheer': {
      if (db.cheers.some(c => c.from_id === 'u' && c.to_id === a.p_to && c.day === T)) return bad('今天已經給他打過氣了')
      db.cheers.push({ id: 99, from_id: 'u', to_id: a.p_to, text: a.p_text, day: T, created_at: new Date().toISOString() }); return ok(99)
    }
    case 'mark_cheers_seen': db.cheers.forEach(c => { if (c.to_id === 'u') c.seen_at = c.seen_at || new Date().toISOString() }); return ok(1)
    case 'buddy_invite': db.buddies.push({ id: 50 + db.buddies.length, from_id: 'u', to_id: a.p_to, status: 'pending', created_at: new Date().toISOString() }); return ok(50)
    case 'buddy_accept': { const b = db.buddies.find(x => x.id === a.p_id); b.status = 'active'; b.start_day = T; return ok(true) }
    case 'buddy_decline': { const b = db.buddies.find(x => x.id === a.p_id); b.status = 'declined'; return ok(true) }
    case 'buddy_end': { const b = db.buddies.find(x => x.id === a.p_id); b.status = 'ended'; return ok(true) }
    case 'add_team_news': return ok(true)
    case 'get_partner_tree': return ok([])
    default: return ok(null)
  }
}
window.__sync = async () => { await syncDaily3(supabase, 'u', T); await markDaily312(supabase, 'u', T) }
window.__logToday = async (cid) => { db.contact_logs.push({ id: 'n' + Date.now(), user_id: 'u', contact_id: cid, date: T, kind: null, note: '聊聊' }); await window.__sync() }
function Start() { const n = useNavigate(); window.__nav = n; return <div /> }
createRoot(document.getElementById('root')).render(<BrowserRouter><Layout><Routes>
  <Route path="/" element={<Start />} /><Route path="/lhome" element={<Dashboard />} /><Route path="/team" element={<Team />} />
  <Route path="/settings" element={<Settings />} /><Route path="/partners" element={<Partners />} />
</Routes></Layout></BrowserRouter>)
