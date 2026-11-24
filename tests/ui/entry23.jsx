// 新增顧客、編輯顧客、記業績的快速建檔：連結互動名單、同名提醒、已是顧客提醒、補回上次沒存的內容
// 假資料：顧客 陳美玲（連到互動名單的陳美玲）、黃先生；互動名單 陳美玲、王怡茜、林小美
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import CustomerNew from '../../src/pages/CustomerNew'
import CustomerEdit from '../../src/pages/CustomerEdit'
import TransactionNew from '../../src/pages/TransactionNew'
import { applyTheme } from '../../src/pages/theme'
import '../../src/index.css'
applyTheme()
const db = window.__db
const k2 = db.customers.find(c => c.id === 'k2'); k2.phone = '0912000111'
function Start() { const n = useNavigate(); window.__nav = n; return <div>首頁</div> }
function Detail() { const { id } = useParams(); const n = useNavigate(); window.__nav = n; return <div id="detail">顧客頁 {id}</div> }
function Nav({ children }) { const n = useNavigate(); window.__nav = n; return children }
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
  <Route path="/" element={<Start />} />
  <Route path="/customers/new" element={<Nav><CustomerNew /></Nav>} />
  <Route path="/customers/:id" element={<Detail />} />
  <Route path="/customers/:id/edit" element={<Nav><CustomerEdit /></Nav>} />
  <Route path="/transactions/new" element={<Nav><TransactionNew /></Nav>} />
</Routes></BrowserRouter>)
