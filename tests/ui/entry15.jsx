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
import '../../src/index.css'
applyTheme()
import { coolUntil, fetchInviteCooldowns } from '../../src/pages/beanJar'
window.__cool = coolUntil; window.__coolMap = () => fetchInviteCooldowns('u').then(m => Object.fromEntries(m))
const db = window.__db, T = window.__T, add = window.__add
db.push_subscriptions = db.push_subscriptions || []
db.users[0].tag_settings = { daily_mode: location.search.includes('fast=1') ? 'fast' : 'std' }; db.users[0].onboarding_done = true
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
if (location.search.includes('evwait=1')) db.contact_logs.push({ id:'ew1', user_id:'u', contact_id:'c1', date:add(-3), kind:'invite_wait', note:'邀了，等回覆：邀請參加 家庭事業說明會' })
function Start(){ const n=useNavigate(); window.__nav=n; return <div><button id="goHome" onClick={()=>n('/home')}>H</button></div> }
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
  <Route path="/" element={<Start/>} /><Route path="/home" element={<Dashboard/>} /><Route path="/report" element={<Report/>} />
  <Route path="/daily" element={<Daily/>} /><Route path="/contacts/new" element={<ContactNew/>} /><Route path="/contacts/:id/edit" element={<ContactEdit/>} /><Route path="/contacts/:id" element={<ContactDetail/>} />
</Routes></BrowserRouter>)
