// 分享成圖片，貼到群組；給帶領者的報告（新順序、分組、固定按鈕、電腦兩欄）；本週回顧的入口
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Dashboard from '../../src/pages/Dashboard'
import Report from '../../src/pages/Report'
import WeekSummary from '../../src/pages/WeekSummary'
import Layout from '../../src/pages/Layout'
import { applyTheme } from '../../src/pages/theme'
import '../../src/index.css'
const db = window.__db, add = window.__add, T = window.__T
const q = location.search
db.users[0].name = 'Yu'; db.users[0].onboarding_done = true
db.users[0].created_at = '2026-01-01T00:00:00Z'; db.users[0].tag_settings = { daily_mode: 'std', ...(q.includes('dark=1') ? { theme: 'dark' } : {}) }
if (q.includes('empty=1')) {
  db.contact_logs.length = 0; db.counter_logs.length = 0; db.transactions.length = 0
} else {
  db.contacts.push({ id: 'b1', user_id: 'u', name: '王大明', egg_type: '荷包蛋', need_level: '大三', interest_level: '很有興趣', is_archived: false, source: null, added_date: add(-20), created_at: '2026-01-01T00:00:00Z' })
  db.contacts.push({ id: 'b2', user_id: 'u', name: '周小志', egg_type: '茶葉蛋', is_archived: false, source: null, created_at: '2026-01-01T00:00:00Z' })
  db.contacts.push({ id: 'b3', user_id: 'u', name: '許等等', egg_type: '荷包蛋', is_archived: false, source: null, created_at: '2026-01-01T00:00:00Z' })
  db.contact_logs.push({ id: 'p1', user_id: 'u', contact_id: 'b1', date: add(-15), kind: null, note: '回覆限動' })
  db.contact_logs.push({ id: 'p2', user_id: 'u', contact_id: 'b1', date: add(-5), kind: null, note: '私訊聊近況' })
  db.contact_logs.push({ id: 'p3', user_id: 'u', contact_id: 'b1', date: add(-3), kind: 'meet_plan', note: '二對一會談' })
  db.contact_logs.push({ id: 'p4', user_id: 'u', contact_id: 'b2', date: add(-2), kind: 'meet_plan', note: '家庭事業說明會' })
  db.contact_logs.push({ id: 'p5', user_id: 'u', contact_id: 'b3', date: add(-1), kind: 'invite_wait', note: '邀了，等回覆：逛網站' })
  db.counter_logs.push({ id: 'pm1', user_id: 'u', counter_key: 'meetup', date: add(-1), planned_date: add(-1), is_done: true, note: '14:00 二對一會談', contact_id: 'b1' })
  db.trial_runs = [{ id: 'tr1', user_id: 'u', contact_id: 'c1', started_on: add(-4), steps: { 1: add(-4), 3: add(-1) } }]
  db.customers.push({ id: 'k9', user_id: 'u', name: '新顧客甲', contact_id: null, is_archived: false, created_at: new Date().toISOString() })
  Object.assign(db.customers.find(c => c.id === 'k2'), { home_list_given_on: add(-2) })
  db.transactions.push({ id: 'tx9', user_id: 'u', customer_id: 'k9', date: add(-1), type: 'BV', points: 85, amount: 1800, cost: 1200, is_gift: false, product_name: '愛尚它®每日精選組合隨身包' })
}
applyTheme()
window.__T = T
function Start() { const n = useNavigate(); window.__nav = n; return <div /> }
createRoot(document.getElementById('root')).render(<BrowserRouter><Layout><Routes>
  <Route path="/" element={<Start />} /><Route path="/lhome" element={<Dashboard />} />
  <Route path="/report" element={<Report />} /><Route path="/week" element={<WeekSummary />} />
</Routes></Layout></BrowserRouter>)
