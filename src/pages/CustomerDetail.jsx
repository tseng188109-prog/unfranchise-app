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

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editReminder, setEditReminder] = useState(false)
  const [reminderDate, setReminderDate] = useState('')

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

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:'#9CA3AF' }}>載入中…</p>
    </div>
  )
  if (!customer) return null

  const totalBV = transactions.reduce((s,t) => s + Number(t.points), 0)
  const totalProfit = transactions.reduce((s,t) => s + ((t.amount||0)-(t.cost||0)), 0)

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 16px 16px',borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151' }}>←</button>
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
            <p style={{ fontSize:11,fontWeight:700,color:'#F97316',margin:'0 0 4px' }}>累積 BV</p>
            <p style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{totalBV.toFixed(0)}</p>
          </div>
          <div style={{ flex:1,background:'#fff',borderRadius:14,padding:'14px',
            boxShadow:'0 1px 3px rgba(0,0,0,0.07)',textAlign:'center' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#16A34A',margin:'0 0 4px' }}>累積獲利</p>
            <p style={{ fontSize:18,fontWeight:800,color:'#16A34A',margin:0 }}>NT${totalProfit.toLocaleString()}</p>
          </div>
        </div>

        {/* 基本資料 */}
        <div style={{ background:'#fff',borderRadius:14,padding:'14px 16px',
          boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 10px' }}>基本資料</p>
          {[
            { label:'電話', value: customer.phone },
            { label:'生日', value: formatDate(customer.birthday) },
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
          <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 10px' }}>消費紀錄</p>
          {transactions.length === 0 ? (
            <p style={{ fontSize:13,color:'#9CA3AF',margin:0 }}>還沒有消費紀錄</p>
          ) : transactions.map(t => (
            <div key={t.id} style={{ display:'flex',alignItems:'center',gap:10,
              padding:'10px 0',borderBottom:'1px solid #F9FAFB' }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14,fontWeight:600,color:'#111827',margin:0 }}>
                  {t.product_name}
                  {t.is_gift && <span style={{ fontSize:11,color:'#F97316',marginLeft:6 }}>贈品</span>}
                </p>
                <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>{formatDate(t.date)}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>{Number(t.points).toFixed(0)} 點</p>
                <p style={{ fontSize:12,color: t.is_gift?'#F97316':'#16A34A',margin:'2px 0 0' }}>
                  {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${((t.amount||0)-(t.cost||0)).toLocaleString()}`}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}