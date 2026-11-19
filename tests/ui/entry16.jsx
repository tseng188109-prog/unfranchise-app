import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from '../../src/supabase'
import Admin from '../../src/pages/Admin'
import Partners from '../../src/pages/Partners'
import Settings from '../../src/pages/Settings'
import Help from '../../src/pages/Help'
import Auth from '../../src/pages/Auth'
import ForcePassword from '../../src/pages/forcePassword'
import { applyTheme } from '../../src/pages/theme'
import { handle } from '../../api/admin.js'
import { makeDb } from '../unit/fakedb2.js'
import '../../src/index.css'
import '../../src/pages/errorReport.js'
applyTheme()
const db = window.__db, T = window.__T
const isAdmin = !location.search.includes('notadmin=1')
db.users[0].name = 'Yu'; db.users[0].tag_settings = {}; db.users[0].referrer_id = 'R'
db.announcements = []; db.resource_links = []; db.feedback = []
db.daily_checkins.push({ user_id:'M', date:T, task_key:'a', is_done:true }, { user_id:'J', date:T, task_key:'a', is_done:true })
const tree = [
  { id:'M', name:'小美', created_at:'2026-05-10T00:00:00Z', referrer_id:'u', depth:1, referred_count:2 },
  { id:'A', name:'Amy', created_at:'2026-06-10T00:00:00Z', referrer_id:'u', depth:1, referred_count:0 },
  { id:'J', name:'阿傑', created_at:'2026-07-01T00:00:00Z', referrer_id:'M', depth:2, referred_count:1 },
  { id:'L', name:'Lisa', created_at:'2026-07-02T00:00:00Z', referrer_id:'M', depth:2, referred_count:0 },
  { id:'K', name:'小K', created_at:'2026-07-05T00:00:00Z', referrer_id:'J', depth:3, referred_count:0 },
]
window.__rpcCalls = []
supabase.rpc = (name, args) => {
  window.__rpcCalls.push([name, args])
  const r = {
    is_admin: isAdmin, get_partner_tree: tree, get_pending_partners: [{ id:'N', name:'志明', created_at:T }],
    confirm_partner: true, get_partner_monthly_bv: [{ bv: 300, ibv: 30 }], get_partner_daily_checkins: [],
    get_people_names: (args && args.p_ids || []).includes('R') ? [{ id:'R', name:'我的推薦人' }] : [], finish_password_change: null,
  }[name]
  return Promise.resolve({ data: r === undefined ? null : r, error: null })
}
supabase.auth.getSession = () => Promise.resolve({ data: { session: { access_token: 'tok' } } })
supabase.auth.signInWithPassword = ({ email, password }) => Promise.resolve(email === 'ban@x.com' ? { data: {}, error: { code: 'user_banned', message: 'User is banned' } } : password === 'right' ? { data: { user: { id: 'u' } }, error: null } : { data: {}, error: { message: 'Invalid login credentials' } })
supabase.auth.updateUser = (p) => { window.__pwSet = p.password; return Promise.resolve({ error: null }) }
supabase.auth.signOut = () => Promise.resolve({})
// 後台 /api/admin：用真的 handle() 加假資料庫
const today = T
const dAgo = n => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
window.__sessions = { M: [{ created_at: new Date(Date.now() - 3 * 86400000).toISOString(), last_at: new Date(Date.now() - 3600000).toISOString(), user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)' }, { created_at: new Date(Date.now() - 9 * 86400000).toISOString(), last_at: new Date(Date.now() - 8 * 86400000).toISOString(), user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }] }
const adb = makeDb({
  users: [
    { id:'u', name:'Yu', referrer_id:null, created_at:'2026-05-01T00:00:00Z' },
    { id:'M', name:'小美', referrer_id:'u', created_at:'2026-05-10T00:00:00Z' },
    { id:'J', name:'阿傑', referrer_id:'M', created_at:'2026-07-01T00:00:00Z' },
    { id:'C', name:'春嬌', referrer_id:'J', created_at:'2026-06-01T00:00:00Z' },
    { id:'A', name:'Amy', referrer_id:'u', created_at:'2026-06-01T00:00:00Z' },
    { id:'N', name:'志明', referrer_id:null, referrer_email_pending:'yu@gmial.com', created_at:new Date().toISOString() },
  ],
  account_status: [{ user_id:'C', deactivated_at: new Date(Date.now() - 31 * 86400000).toISOString() }],
  push_subscriptions: [{ id:1, user_id:'M' }], admins: [{ user_id:'u' }], admin_logs: [],
  push_runs: [{ id:1, kind:'morning', slot_date:today, users:3, sent:3, failed:0 }, { id:2, kind:'morning', slot_date:dAgo(1), users:2, sent:1, failed:1 }],
  feedback: [{ id:1, user_id:'M', kind:'出錯了', message:'按了存起來沒有反應', page:'/daily', created_at:new Date().toISOString(), handled_at:null }, { id:2, user_id:'A', kind:'我有建議', message:'希望可以匯出名單', created_at:new Date().toISOString(), handled_at:null }],
  teams: [{ id:'T1', creator_id:'C' }], team_members: [{ team_id:'T1', user_id:'C', joined_at:'2026-01-01' }, { team_id:'T1', user_id:'A', joined_at:'2026-01-02' }],
  login_events: [{ user_id:'M', at:new Date(Date.now() - 86400000).toISOString(), device:'iPhone' }, { user_id:'M', at:new Date(Date.now() - 7 * 86400000).toISOString(), device:'Windows 電腦' }],
  app_errors: [
    { id:1, page:'互動名單 → 一個人的頁面', message:"Cannot read properties of null (reading 'name')", device:'iPhone', count:5, first_at:new Date(Date.now() - 86400000).toISOString(), last_at:new Date().toISOString(), handled_at:null },
    { id:2, page:'首頁', message:'x is not a function', device:'Android', count:1, first_at:'2026-11-01T00:00:00Z', last_at:'2026-11-01T00:00:00Z', handled_at:'2026-11-02T00:00:00Z' },
  ],
  app_error_hits: [{ error_id:1, user_id:'M' }, { error_id:1, user_id:'J' }, { error_id:1, user_id:'A' }, { error_id:2, user_id:'M' }],
}, {
  admin_onboarding: () => ({ data: [
    { user_id:'u', signed_in:true, has_contacts:true, has_logs:true }, { user_id:'M', signed_in:true, has_contacts:true, has_logs:true },
    { user_id:'J', signed_in:true, has_contacts:true, has_logs:false }, { user_id:'A', signed_in:true, has_contacts:false, has_logs:false },
    { user_id:'N', signed_in:false, has_contacts:false, has_logs:false }, { user_id:'C', signed_in:false, has_contacts:false, has_logs:false }], error: null }),
  admin_sessions: ({ p_user_id }) => ({ data: (window.__sessions[p_user_id] || []), error: null }),
  admin_signout_all: ({ p_user_id }) => { const n = (window.__sessions[p_user_id] || []).length; window.__sessions[p_user_id] = []; return { data: n, error: null } },
  admin_last_seen: () => ({ data: [{ user_id:'u', last_day:today }, { user_id:'M', last_day:dAgo(2) }, { user_id:'J', last_day:dAgo(12) }, { user_id:'A', last_day:dAgo(45) }], error: null }),
  admin_purge_user: ({ p_user_id }, t) => { t.users.splice(t.users.findIndex(u => u.id === p_user_id), 1); return { data:null, error:null } },
}, ['u','M','J','C','A','N'].map(id => ({ id, email: (id === 'u' ? 'yu' : id.toLowerCase()) + '@example.com' })))
window.__adb = adb
const realFetch = window.fetch
window.fetch = async (url, opt) => {
  if (String(url).includes('/api/admin')) {
    if (!isAdmin) return new Response(JSON.stringify({ error: '你不是管理員' }), { status: 403 })
    const out = await handle(adb, { id:'u' }, JSON.parse(opt.body))
    return new Response(JSON.stringify(out), { status: out.ok ? 200 : (out.status || 400) })
  }
  return realFetch(url, opt)
}
window.__boom = (m) => setTimeout(() => { throw new Error(m) })
window.__reject = (m) => Promise.reject(new Error(m))
function Crash(){ const x = null; return <div>{x.name}</div> }
function Start(){ const n=useNavigate(); window.__nav=n; return <div><button id="go" onClick={()=>n(location.hash.slice(1) || '/admin')}>Go</button></div> }
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
  <Route path="/" element={<Start/>} /><Route path="/admin" element={<Admin/>} /><Route path="/partners" element={<Partners/>} />
  <Route path="/settings" element={<Settings/>} /><Route path="/help" element={<Help/>} /><Route path="/auth" element={<Auth/>} />
  <Route path="/crash" element={<Crash/>} />
  <Route path="/force" element={<ForcePassword onDone={() => { window.__forceDone = true }} />} />
</Routes></BrowserRouter>)
