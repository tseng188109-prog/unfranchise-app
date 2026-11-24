import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Dashboard from '../../src/pages/Dashboard'
import Report from '../../src/pages/Report'
import Daily from '../../src/pages/Daily'
import ContactDetail from '../../src/pages/ContactDetail'
import ContactNew from '../../src/pages/ContactNew'
import ContactEdit from '../../src/pages/ContactEdit'
import { applyTheme } from '../../src/pages/theme'
import Layout from '../../src/pages/Layout'
import Partners from '../../src/pages/Partners'
import WeekSummary from '../../src/pages/WeekSummary'
import { NotifyPrefs } from '../../src/pages/pushNotify'
import { syncDaily3, markDaily312 } from '../../src/pages/followUp'
import { supabase } from '../../src/supabase'
import '../../src/index.css'
applyTheme()
import { coolUntil, fetchInviteCooldowns } from '../../src/pages/beanJar'
window.__cool = coolUntil; window.__coolMap = () => fetchInviteCooldowns('u').then(m => Object.fromEntries(m))
const db = window.__db, T = window.__T, add = window.__add
db.push_subscriptions = db.push_subscriptions || []
db.users[0].created_at = '2026-01-01T00:00:00Z'; db.users[0].tag_settings = { daily_mode: location.search.includes('fast=1') ? 'fast' : 'std' }; db.users[0].onboarding_done = true
const now = new Date().toISOString()
db.contacts.push({ id:'w1', user_id:'u', name:'陳泓宇', egg_type:'茶葉蛋', need_level:'大四', interest_level:'很有興趣', relationship_stage:'了解需求中', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_interacted_at:now, last_contact_date:T, last_quote:'跟沐恩一起開的店，目前有新的店址，下個月要搬過去，到時候再說說看吧' })
db.contacts.push({ id:'w2', user_id:'u', name:'張雅婷', egg_type:'茶葉蛋', need_level:'大三', interest_level:'有點興趣', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_interacted_at:now, last_contact_date:add(-1) })
db.contacts.push({ id:'w3', user_id:'u', name:'李封存', interest_level:'有點興趣', is_archived:true, source:null, created_at:'2026-01-01T00:00:00Z' })
db.contact_logs.push({ id:'wt1', user_id:'u', contact_id:'c2', date:add(-4), kind:'invite_wait', note:'邀了，等回覆：約聚餐' })
db.contact_logs.push({ id:'wt0', user_id:'u', contact_id:'c2', date:add(-6), kind:'invite_wait', note:'邀了，等回覆：見面聊聊' })
db.contact_logs.push({ id:'wt2', user_id:'u', contact_id:'w2', date:add(-1), kind:'invite_wait', note:'邀了，等回覆：一對一會談' })
db.contact_logs.push({ id:'wt3', user_id:'u', contact_id:'w3', date:add(-5), kind:'invite_wait', note:'邀了，等回覆' })
db.contact_logs.push({ id:'old1', user_id:'u', contact_id:'c1', date:add(-10), kind:'invite_no', note:'邀了沒約成：還沒興趣　她說再看看' })
db.events.push({ id:'ev1', owner_id:'u', title:'家庭事業說明會', event_date:add(10), event_time:'19:30', place:'台北' })
if (location.search.includes('y312=1')) {
  const Y = add(-1)
  ;['c1','c2','w2'].forEach((c,i) => db.contact_logs.push({ id:'yy'+i, user_id:'u', contact_id:c, date:Y, kind:null, note:'聊聊' }))
  db.contacts.push({ id:'n1', user_id:'u', name:'新甲', is_archived:false, source:null, added_date:Y, created_at:Y+'T03:00:00Z' })
  db.contacts.push({ id:'n2', user_id:'u', name:'新乙', is_archived:false, source:null, added_date:Y, created_at:Y+'T03:00:00Z' })
}
// 這個月已經見完好幾位（看「這個月的安排」收起來的樣子）
if (location.search.includes('manymeets=1')) {
  [[-21, 'c1', '新店址看現場'], [-18, 'w1', '約聚餐'], [-11, 'w2', '約聚餐'], [-11, 'c1', '見面聊聊'], [-8, 'w1', '約聚餐 吃拉麵'], [-5, 'w2', '一起看店面']].forEach(([d, c, n], i) =>
    db.counter_logs.push({ id: 'mm' + i, user_id: 'u', counter_key: 'meetup', date: add(d), planned_date: add(d), is_done: true, note: '19:30 ' + n, contact_id: c }))
}
// 這個月的見面全部都見完了（接下來沒有約）
if (location.search.includes('alldone=1')) {
  db.counter_logs = db.counter_logs.filter(l => !(l.counter_key === 'meetup' && !l.is_done))
  db.contact_logs = db.contact_logs.filter(l => l.kind !== 'meet_plan')
}
if (location.search.includes('evwait=1')) db.contact_logs.push({ id:'ew1', user_id:'u', contact_id:'c1', date:add(-3), kind:'invite_wait', note:'邀了，等回覆：邀請參加 家庭事業說明會' })
// 連續天數：前 6 天都有做 → 今天做滿就是第 7 天（里程碑）
const SK = location.search.match(/streak=(\d+)/); const sk = SK ? Number(SK[1]) : 6
for (let i = 1; i <= sk; i++) db.daily_checkins.push({ user_id:'u', date:add(-i), task_key:'daily_312', is_done:true })
window.__sync = async () => { await syncDaily3(supabase, 'u', T); await markDaily312(supabase, 'u', T) }
window.__rpcCalls = []
supabase.rpc = (name, args) => { window.__rpcCalls.push([name, args]); const r = {
  get_partner_tree: [{ id:'M', name:'小美', created_at:'2026-05-10T00:00:00Z', referrer_id:'u', depth:1, referred_count:0 }],
  get_pending_partners: [], is_admin: false, get_partner_monthly_bv: [{ bv: 300, ibv: 30 }], get_partner_daily_checkins: [],
  get_partner_week_stats: [{ contacts_total:34, contacts_new:5, top10_filled:6, top10_touched:2, talk:9, invites:4, invite_yes:1, invite_no:3, invite_wait:0, met:1, upcoming:1 }],
}[name]; return Promise.resolve({ data: r === undefined ? null : r, error: null }) }
function Start(){ const n=useNavigate(); window.__nav=n; return <div><button id="goHome" onClick={()=>n('/home')}>H</button></div> }
const L = el => <Layout>{el}</Layout>
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
  <Route path="/lhome" element={L(<Dashboard/>)} /><Route path="/partners" element={L(<Partners/>)} /><Route path="/week" element={<WeekSummary/>} />
  <Route path="/np" element={<div style={{padding:16,maxWidth:420}}><NotifyPrefs userId="u"/></div>} />
  <Route path="/" element={<Start/>} /><Route path="/home" element={<Dashboard/>} /><Route path="/report" element={<Report/>} />
  <Route path="/daily" element={<Daily/>} /><Route path="/contacts/new" element={<ContactNew/>} /><Route path="/contacts/:id/edit" element={<ContactEdit/>} /><Route path="/contacts/:id" element={<ContactDetail/>} />
</Routes></BrowserRouter>)
