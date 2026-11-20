// deliver-77：邀請連結。/auth 是還沒登入的畫面（註冊帶推薦人），/settings 是設定 → 邀請朋友一起用
// 假資料：我（Yu）的代碼 AB2CD3；用代碼查得到 Yu，亂打的查不到
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Auth from '../../src/pages/Auth'
import Settings from '../../src/pages/Settings'
import { applyTheme } from '../../src/pages/theme'
import { supabase } from '../../src/supabase'
import '../../src/index.css'
applyTheme()
const db = window.__db
db.users[0].name = 'Yu'
window.__rpcCalls = []
window.__signUps = []
const Q = location.search
supabase.rpc = (name, a = {}) => {
  window.__rpcCalls.push([name, a])
  const ok = data => Promise.resolve({ data, error: null })
  if (name === 'my_ref_code') return Q.includes('nocode=1') ? Promise.resolve({ data: null, error: { message: 'x' } }) : ok('AB2CD3')
  if (name === 'ref_lookup') return ok(String(a.p_code).trim().toUpperCase() === 'AB2CD3' ? [{ id: 'u', name: 'Yu' }] : [])
  if (name === 'get_user_id_by_email') return ok(a.p_email === 'mei@example.com' ? 'u-mei' : null)
  return ok(null)
}
supabase.auth.signUp = args => { window.__signUps.push(args); return Promise.resolve({ data: { user: { id: 'new1' } }, error: null }) }
supabase.auth.getSession = () => Promise.resolve({ data: { session: null } })
const path = location.pathname
createRoot(document.getElementById('root')).render(path.startsWith('/settings')
  ? <BrowserRouter><Routes><Route path="/settings" element={<Settings />} /></Routes></BrowserRouter>
  : <Auth />)
