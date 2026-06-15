import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'

function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}
function formatBirthday(mmdd) {
  if (!mmdd) return ''
  const parts = mmdd.split('-')
  if (parts.length !== 2) return mmdd
  return `${Number(parts[0])} 月 ${Number(parts[1])} 日`
}
function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

const EMPTY_FORM = {
  date: today(),
  product_name: '',
  type: 'BV',
  points: '',
  amount: '',
  cost: '',
  is_gift: false,
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editReminder, setEditReminder] = useState(false)
  const [reminderDate, setReminderDate] = useState('')

  // 交易 Modal
  const [txModal, setTxModal] = useState(null) // null | { editId: null|string }
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // null | id

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const { data: c } = await supabase.from('customers')
      .select('*').eq('id', id).single()
    if (c) { setCustomer(c); setReminderDate(c.repurchase_reminder||'') }

    const { data: tx } = await supabase.from('transactions')
      .select('*').eq('customer_id', id)
      .order('date', { ascending: false })
    if (tx) setTransactions(tx)
    setLoading(false)
  }

  async function saveReminder() {
    await supabase.from('customers').update({
      repurchase_reminder: reminderDate || null
    }).eq('id', id)
    setCustomer(p => ({ ...p, repurchase_reminder: reminderDate }))
    setEditReminder(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setTxModal({ editId: null })
  }

  function openEdit(tx) {
    setForm({
      date: tx.date || today(),
      product_name: tx.product_name || '',
      type: tx.type || 'BV',
      points: tx.points != null ? String(tx.points) : '',
      amount: tx.amount != null ? String(tx.amount) : '',
      cost: tx.cost != null ? String(tx.cost) : '',
      is_gift: !!tx.is_gift,
    })
    setTxModal({ editId: tx.id })
  }

  async function saveTx() {
    if (!form.product_name.trim() || !form.points) return
    setSaving(true)
    const payload = {
      user_id: user.id,
      customer_id: id,
      customer_name: customer.name,
      customer_phone: customer.phone || null,
      date: form.date,
      product_name: form.product_name.trim(),
      type: form.type,
      points: parseFloat(form.points) || 0,
      amount: parseFloat(form.amount) || 0,
      cost: parseFloat(form.cost) || 0,
      is_gift: form.is_gift,
    }
    if (txModal.editId) {
      await supabase.from('transactions').update(payload).eq('id', txModal.editId)
    } else {
      await supabase.from('transactions').insert(payload)
    }
    setSaving(false)
    setTxModal(null)
    fetchData()
  }

  async function deleteTx(txId) {
    await supabase.from('transactions').delete().eq('id', txId)
    setDeleteConfirm(null)
    fetchData()
  }

  function setF(key, val) {
    setForm(p => ({ ...p, [key]: val }))
  }

  const canSave = form.product_name.trim() && form.points !== ''

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:'#9CA3AF' }}>載入中…</p>
    </div>
  )
  if (!customer) return null

  const totalBV = transactions.filter(t=>t.type==='BV').reduce((s,t) => s + Number(t.points), 0)
  const totalIBV = transactions.filter(t=>t.type==='IBV').reduce((s,t) => s + Number(t.points), 0)
  const totalProfit = transactions.reduce((s,t) => s + ((t.amount||0)-(t.cost||0)), 0)

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 16px 16px',borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%' }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151' }}>←</button>
          <button onClick={() => navigate(`/customers/${id}/edit`)}
            style={{ background:'none',border:'1px solid #E5E7EB',borderRadius:8,
              padding:'6px 12px',fontSize:13,cursor:'pointer',color:'#374151' }}>✎ 編輯</button>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:14,marginTop:16 }}>
          <div style={{ width:56,height:56,borderRadius:'50%',background:avatarBg(customer.name),
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'#fff',fontWeight:800,fontSize:22 }}>
            {customer.name[0]}
          </div>
          <div>
            <h1 style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{customer.name}</h1>
            <p style={{ fontSize:13,color:'#9CA3AF',margin:'4px 0 0' }}>
              {customer.occupation||''}{customer.occupation&&customer.phone?' · ':''}{customer.phone||''}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding:'12px 16px',display:'flex',flexDirection:'column',gap:12 }}>

        {/* 統計 */}
        <div style={{ display:'flex',gap:10 }}>
          <div style={{ flex:1,background:'#fff',borderRadius:14,padding:'14px',
            boxShadow:'0 1px 3px rgba(0,0,0,0.07)',textAlign:'center' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#F97316',margin:'0 0 2px' }}>BV</p>
            <p style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{totalBV.toFixed(0)}</p>
          </div>
          <div style={{ flex:1,background:'#fff',borderRadius:14,padding:'14px',
            boxShadow:'0 1px 3px rgba(0,0,0,0.07)',textAlign:'center' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#3B82F6',margin:'0 0 2px' }}>IBV</p>
            <p style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{totalIBV.toFixed(0)}</p>
          </div>
          <div style={{ flex:1,background:'#fff',borderRadius:14,padding:'14px',
            boxShadow:'0 1px 3px rgba(0,0,0,0.07)',textAlign:'center' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#16A34A',margin:'0 0 2px' }}>獲利</p>
            <p style={{ fontSize:16,fontWeight:800,color:'#16A34A',margin:0 }}>NT${totalProfit.toLocaleString()}</p>
          </div>
        </div>

        {/* 基本資料 */}
        <div style={{ background:'#fff',borderRadius:14,padding:'14px 16px',
          boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 10px' }}>基本資料</p>
          {[
            { label:'電話', value: customer.phone },
            { label:'生日', value: formatBirthday(customer.birthday) },
            { label:'地址', value: customer.address },
            { label:'Email', value: customer.email },
            { label:'載具', value: customer.carrier },
          ].filter(r => r.value).map(r => (
            <div key={r.label} style={{ display:'flex',gap:12,padding:'6px 0',
              borderBottom:'1px solid #F9FAFB' }}>
              <span style={{ fontSize:13,color:'#9CA3AF',width:48,flexShrink:0 }}>{r.label}</span>
              <span style={{ fontSize:13,color:'#374151' }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* 回購提醒 */}
        <div style={{ background:'#fff',borderRadius:14,padding:'14px 16px',
          boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
            <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>🔔 回購提醒</p>
            <button onClick={() => setEditReminder(v=>!v)}
              style={{ fontSize:12,color:'#2563EB',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
              {editReminder?'取消':'設定'}
            </button>
          </div>
          {editReminder ? (
            <div style={{ display:'flex',gap:8 }}>
              <input type="date" value={reminderDate} onChange={e=>setReminderDate(e.target.value)}
                style={{ flex:1,padding:'9px 12px',borderRadius:10,border:'1px solid #E5E7EB',
                  fontSize:14,outline:'none',color:'#111827' }} />
              <button onClick={saveReminder}
                style={{ padding:'9px 16px',borderRadius:10,border:'none',
                  background:'#2563EB',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:13 }}>存</button>
            </div>
          ) : (
            <p style={{ fontSize:14,color: customer.repurchase_reminder?'#374151':'#9CA3AF',margin:0 }}>
              {customer.repurchase_reminder ? formatDate(customer.repurchase_reminder) : '尚未設定'}
            </p>
          )}
        </div>

        {/* 消費紀錄 */}
        <div style={{ background:'#fff',borderRadius:14,padding:'14px 16px',
          boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
            <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>
              消費紀錄 {transactions.length > 0 && <span style={{ color:'#9CA3AF',fontWeight:400 }}>({transactions.length})</span>}
            </p>
            <button onClick={openAdd}
              style={{ padding:'5px 12px',borderRadius:8,border:'none',
                background:'#2563EB',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
              + 新增
            </button>
          </div>

          {transactions.length === 0 ? (
            <p style={{ fontSize:13,color:'#9CA3AF',margin:0,padding:'8px 0' }}>
              還沒有消費紀錄，點「+ 新增」來新增
            </p>
          ) : transactions.map(t => (
            <div key={t.id} style={{ display:'flex',alignItems:'center',gap:10,
              padding:'10px 0',borderBottom:'1px solid #F9FAFB' }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                  <span style={{ fontSize:14,fontWeight:600,color:'#111827' }}>{t.product_name}</span>
                  <span style={{ fontSize:10,padding:'1px 6px',borderRadius:99,fontWeight:700,
                    background: t.type==='BV'?'#FFF7ED':'#EFF6FF',
                    color: t.type==='BV'?'#F97316':'#3B82F6' }}>{t.type}</span>
                  {t.is_gift && <span style={{ fontSize:10,color:'#F97316',fontWeight:600 }}>贈品</span>}
                </div>
                <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>{formatDate(t.date)}</p>
              </div>
              <div style={{ textAlign:'right',flexShrink:0 }}>
                <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>{Number(t.points).toFixed(0)} 點</p>
                <p style={{ fontSize:12,color: t.is_gift?'#F97316':'#16A34A',margin:'2px 0 0' }}>
                  {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${((t.amount||0)-(t.cost||0)).toLocaleString()}`}
                </p>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end',flexShrink:0 }}>
                <button onClick={() => openEdit(t)}
                  style={{ fontSize:11,color:'#2563EB',background:'none',border:'none',cursor:'pointer',padding:0 }}>編輯</button>
                <button onClick={() => setDeleteConfirm(t.id)}
                  style={{ fontSize:11,color:'#EF4444',background:'none',border:'none',cursor:'pointer',padding:0 }}>刪除</button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* 新增/編輯 Modal */}
      {txModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e => { if (e.target===e.currentTarget) setTxModal(null) }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'88vh',overflowY:'auto' }}>

            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:'#111827',margin:0 }}>
                {txModal.editId ? '編輯消費紀錄' : '新增消費紀錄'}
              </h3>
              <button onClick={() => setTxModal(null)}
                style={{ background:'none',border:'none',fontSize:20,color:'#9CA3AF',cursor:'pointer' }}>✕</button>
            </div>

            {/* 日期 */}
            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>日期</label>
              <input type="date" value={form.date} onChange={e => setF('date', e.target.value)}
                style={inputStyle} />
            </div>

            {/* 產品名稱 */}
            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>產品名稱 <span style={{ color:'#EF4444' }}>必填</span></label>
              <input placeholder="輸入產品名稱…" value={form.product_name}
                onChange={e => setF('product_name', e.target.value)} style={inputStyle} />
            </div>

            {/* 類型 */}
            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>類型</label>
              <div style={{ display:'flex',gap:8 }}>
                {['BV','IBV'].map(type => (
                  <button key={type} onClick={() => setF('type', type)}
                    style={{ flex:1,padding:'9px',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',
                      border:`1.5px solid ${form.type===type?(type==='BV'?'#F97316':'#3B82F6'):'#E5E7EB'}`,
                      background: form.type===type?(type==='BV'?'#FFF7ED':'#EFF6FF'):'#F9FAFB',
                      color: form.type===type?(type==='BV'?'#F97316':'#3B82F6'):'#6B7280' }}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 點數 */}
            <div style={{ marginBottom:14 }}>
              <label style={labelStyle}>點數 <span style={{ color:'#EF4444' }}>必填</span></label>
              <input type="number" placeholder="例：150" value={form.points}
                onChange={e => setF('points', e.target.value)} style={inputStyle} />
            </div>

            {/* 售價 / 成本 */}
            <div style={{ display:'flex',gap:10,marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <label style={labelStyle}>售價 NT$</label>
                <input type="number" placeholder="0" value={form.amount}
                  onChange={e => setF('amount', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex:1 }}>
                <label style={labelStyle}>成本 NT$</label>
                <input type="number" placeholder="0" value={form.cost}
                  onChange={e => setF('cost', e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* 獲利預覽 */}
            {(form.amount || form.cost) && (
              <div style={{ background:'#F0FDF4',borderRadius:10,padding:'8px 12px',
                marginBottom:14,fontSize:13,color:'#16A34A',fontWeight:600 }}>
                獲利預覽：NT${((parseFloat(form.amount)||0) - (parseFloat(form.cost)||0)).toLocaleString()}
              </div>
            )}

            {/* 贈品 */}
            <div style={{ marginBottom:20,display:'flex',alignItems:'center',gap:10 }}>
              <button onClick={() => setF('is_gift', !form.is_gift)}
                style={{ width:22,height:22,borderRadius:6,flexShrink:0,cursor:'pointer',
                  border: form.is_gift?'none':'2px solid #D1D5DB',
                  background: form.is_gift?'#F97316':'#fff',
                  display:'flex',alignItems:'center',justifyContent:'center' }}>
                {form.is_gift && <span style={{ fontSize:12,color:'#fff' }}>✓</span>}
              </button>
              <span style={{ fontSize:14,color:'#374151' }}>這是贈品（不計入獲利）</span>
            </div>

            <button onClick={saveTx} disabled={saving || !canSave}
              style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
                background: canSave?'#2563EB':'#D1D5DB',
                color:'#fff',fontSize:15,fontWeight:700,
                cursor: canSave?'pointer':'not-allowed' }}>
              {saving ? '儲存中…' : txModal.editId ? '儲存修改' : '確認新增'}
            </button>
          </div>
        </div>
      )}

      {/* 刪除確認 */}
      {deleteConfirm && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20 }}
          onClick={e => { if (e.target===e.currentTarget) setDeleteConfirm(null) }}>
          <div style={{ background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:320 }}>
            <p style={{ fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 8px',textAlign:'center' }}>
              確定要刪除？
            </p>
            <p style={{ fontSize:13,color:'#6B7280',margin:'0 0 20px',textAlign:'center' }}>
              這筆消費紀錄將永久刪除，無法復原
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',color:'#374151' }}>
                取消
              </button>
              <button onClick={() => deleteTx(deleteConfirm)}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#EF4444',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                刪除
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const labelStyle = { fontSize:13,color:'#374151',fontWeight:600,display:'block',marginBottom:6 }
const inputStyle = { width:'100%',padding:'10px 12px',borderRadius:10,
  border:'1px solid #D1D5DB',fontSize:15,boxSizing:'border-box',outline:'none' }
