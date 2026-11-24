// 業績：換月份不整頁轉圈（內容先變淡，讀好再換）
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Transactions from '../../src/pages/Transactions'
import Layout from '../../src/pages/Layout'
import { applyTheme } from '../../src/pages/theme'
import '../../src/index.css'
applyTheme()
const db = window.__db, add = window.__add
db.users[0].name = 'Yu'; db.users[0].onboarding_done = true
;[['k1', -2, 'OPC-3', 60, 2400], ['k2', -5, '益生菌', 30, 1200], ['k1', -12, 'TLS 纖維', 20, 800]].forEach(([c, d, n, p, a], i) =>
  db.transactions.push({ id: 'tx' + i, user_id: 'u', customer_id: c, date: add(d), type: 'BV', points: p, amount: a, cost: Math.round(a * 0.7), is_gift: false, product_name: n }))
function Start() { const n = useNavigate(); window.__nav = n; return <div /> }
createRoot(document.getElementById('root')).render(<BrowserRouter><Layout><Routes>
  <Route path="/" element={<Start />} /><Route path="/transactions" element={<Transactions />} />
</Routes></Layout></BrowserRouter>)
