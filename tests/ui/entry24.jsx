// 業績：換月份不整頁轉圈（內容先變淡，讀好再換）；互動名單、顧客：每一列右邊的 ⋮ 選單
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Transactions from '../../src/pages/Transactions'
import Contacts from '../../src/pages/Contacts'
import Customers from '../../src/pages/Customers'
import Layout from '../../src/pages/Layout'
import { applyTheme } from '../../src/pages/theme'
import '../../src/index.css'
applyTheme()
const db = window.__db, add = window.__add
db.users[0].name = 'Yu'; db.users[0].onboarding_done = true
;[['k1', -2, 'OPC-3', 60, 2400], ['k2', -5, '益生菌', 30, 1200], ['k1', -12, 'TLS 纖維', 20, 800]].forEach(([c, d, n, p, a], i) =>
  db.transactions.push({ id: 'tx' + i, user_id: 'u', customer_id: c, date: add(d), type: 'BV', points: p, amount: a, cost: Math.round(a * 0.7), is_gift: false, product_name: n }))
// 搜尋用的資料：IG、地區、痛點、地址
Object.assign(db.contacts.find(c => c.id === 'c1'), { platform: 'IG', platform_account: 'wang_yq', region: '臺北市大安區', pain_point: '最近睡不好', occupation: '護理師' })
Object.assign(db.contacts.find(c => c.id === 'c2'), { region: '台中市西屯區', note: '社團認識', asked_products: '愛尚它®綜合維生素粉末' })
Object.assign(db.customers.find(c => c.id === 'k2'), { phone: '0912-345-678', address: '新北市板橋區文化路一段' })
function Start() { const n = useNavigate(); window.__nav = n; return <div /> }
createRoot(document.getElementById('root')).render(<BrowserRouter><Layout><Routes>
  <Route path="/" element={<Start />} /><Route path="/transactions" element={<Transactions />} />
  <Route path="/contacts" element={<Contacts />} /><Route path="/customers" element={<Customers />} />
</Routes></Layout></BrowserRouter>)
