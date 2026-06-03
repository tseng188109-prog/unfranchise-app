import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}

export default function Transactions() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [bvTotal, setBvTotal] = useState(0)
  const [ibvTotal, setIbvTotal] = useState(0)
  const [profit, setProfit] = useState(0)
  const [giftCost, setGiftCost] = useState(0)
  const [loading, setLoading] = useState(true)

  // 選單
  const [menuId, setMenuId] = useState(null)
  // 刪除確認
  const [deleteTarget, setDeleteTarget] = useState(null)
  // 編輯 Modal
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchData() }, [user, year, month])

  async function fetchData() {
    setLoading(true)
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('transactions')
      .select('*,customers(name)')
      .eq('user_id', user.id)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })

    if (!data) { setLoading(false); return }

    setTransactions(data)
    let bv=0, ibv=0, p=0, gc=0
    data.forEach(t => {
      if (t.type==='BV') bv += Number(t.points)
      if (t.type==='IBV') ibv += Number(t.points)
      if (t.is_gift) gc += (t.cost || 0)
      else p += (t.amount||0) - (t.cost||0)
    })
    setBvTotal(bv); setIbvTotal(ibv); setProfit(p); setGiftCost(gc)
    setLoading(false)
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y-1); setMonth(12) }
    else setMonth(m => m-1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y+1); setMonth(1) }
    else setMonth(m => m+1)
  }

  // 刪除
  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('transactions').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    fetchData()
  }

  // 開啟編輯
  function openEdit(t) {
    setMenuId(null)
    setEditTarget(t)
    setEditForm({
      date: t.date || '',
      product_name: t.product_name || '',
      type: t.type || 'BV',
      points: t.points || '',
      amount: t.amount || '',
      cost: t.cost || '',
      is_gift: t.is_gift || false,
    })
  }

  // 儲存編輯
  async function handleSave() {
    setSaving(true)
    await supabase.from('transactions').update({
      date: editForm.date,
      product_name: editForm.product_name,
      type: editForm.type,
      points: Number(editForm.points),
      amount: Number(editForm.amount),
      cost: Number(editForm.cost),
      is_gift: editForm.is_gift,
    }).eq('id', editTarget.id)
    setSaving(false)
    setEditTarget(null)
    fetchData()
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}
      onClick={() => setMenuId(null)}>

      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 16px 16px',borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>業績紀錄</h1>
          <button onClick={() => navigate('/transactions/new')}
            style={{ width:36,height:36,borderRadius:'50%',background:'#2563EB',
              border:'none',color:'#fff',fontSize:22,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
        </div>

        {/* 月份切換 */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginBottom:16 }}>
          <button onClick={prevMonth}
            style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#374151' }}>‹</button>
          <span style={{ fontSize:16,fontWeight:700,color:'#111827' }}>{year} 年 {month} 月</span>
          <button onClick={nextMonth}
            style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#374151' }}>›</button>
        </div>

        {/* 統計 */}
        <div style={{ display:'flex',gap:10,marginBottom:8 }}>
          <div style={{ flex:1,background:'#FFF7ED',borderRadius:12,padding:'12px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#F97316',margin:'0 0 4px' }}>BV</p>
            <p style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{bvTotal.toFixed(0)}</p>
          </div>
          <div style={{ flex:1,background:'#EFF6FF',borderRadius:12,padding:'12px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#3B82F6',margin:'0 0 4px' }}>IBV</p>
            <p style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{ibvTotal.toFixed(0)}</p>
          </div>
          <div style={{ flex:1,background:'#F0FDF4',borderRadius:12,padding:'12px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#16A34A',margin:'0 0 4px' }}>獲利</p>
            <p style={{ fontSize:18,fontWeight:800,color:'#16A34A',margin:0 }}>NT${profit.toLocaleString()}</p>
          </div>
        </div>
        {giftCost > 0 && (
          <p style={{ fontSize:12,color:'#F97316',textAlign:'right',margin:0 }}>
            贈品成本：-NT${giftCost.toLocaleString()}
          </p>
        )}
      </div>

      {/* 列表 */}
      {loading ? (
        <div style={{ textAlign:'center',padding:40,color:'#9CA3AF' }}>載入中…</div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign:'center',padding:60,color:'#9CA3AF' }}>
          <p style={{ fontSize:36,margin:'0 0 12px' }}>📊</p>
          <p style={{ fontSize:15 }}>這個月還沒有業績紀錄，點 + 開始新增！</p>
        </div>
      ) : (
        <div style={{ margin:'8px 0',background:'#fff' }}>
          {transactions.map(t => {
            const name = t.customers?.name || '未知顧客'
            const margin = (t.amount||0) - (t.cost||0)
            return (
              <div key={t.id} style={{ display:'flex',alignItems:'center',gap:12,
                padding:'12px 16px',borderBottom:'1px solid #F3F4F6',position:'relative' }}>
                <div style={{ width:40,height:40,borderRadius:'50%',
                  background: t.is_gift ? '#FED7AA' : avatarBg(name),
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color: t.is_gift ? '#F97316' : '#fff',fontWeight:700,fontSize:15,flexShrink:0 }}>
                  {t.is_gift ? '🎁' : name[0]}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <span style={{ fontSize:14,fontWeight:700,color:'#111827' }}>{name}</span>
                    <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:6,
                      background:t.type==='BV'?'#FFF7ED':'#EFF6FF',
                      color:t.type==='BV'?'#F97316':'#3B82F6' }}>{t.type}</span>
                  </div>
                  <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>
                    {t.product_name} · {formatDate(t.date)}
                  </p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:13,fontWeight:700,color:'#111827',margin:0 }}>
                    {Number(t.points).toFixed(0)} 點
                  </p>
                  <p style={{ fontSize:12,margin:'2px 0 0',
                    color: t.is_gift ? '#F97316' : margin >= 0 ? '#16A34A' : '#DC2626' }}>
                    {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${margin.toLocaleString()}`}
                  </p>
                </div>

                {/* ⋯ 選單按鈕 */}
                <button
                  onClick={e => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id) }}
                  style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',
                    color:'#9CA3AF',padding:'4px 6px',marginLeft:4,flexShrink:0 }}>⋯</button>

                {/* 下拉選單 */}
                {menuId === t.id && (
                  <div onClick={e => e.stopPropagation()}
                    style={{ position:'absolute',right:12,top:44,background:'#fff',
                      borderRadius:10,boxShadow:'0 4px 20px rgba(0,0,0,0.13)',
                      zIndex:100,overflow:'hidden',minWidth:100 }}>
                    <button onClick={() => openEdit(t)}
                      style={{ display:'block',width:'100%',padding:'11px 18px',
                        background:'none',border:'none',textAlign:'left',
                        fontSize:14,color:'#374151',cursor:'pointer' }}>✏️ 編輯</button>
                    <button onClick={() => { setMenuId(null); setDeleteTarget(t.id) }}
                      style={{ display:'block',width:'100%',padding:'11px 18px',
                        background:'none',border:'none',textAlign:'left',
                        fontSize:14,color:'#DC2626',cursor:'pointer' }}>🗑️ 刪除</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteTarget && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:200 }}>
          <div style={{ background:'#fff',borderRadius:16,padding:24,width:280,textAlign:'center' }}>
            <p style={{ fontSize:32,margin:'0 0 8px' }}>🗑️</p>
            <p style={{ fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 8px' }}>確定刪除？</p>
            <p style={{ fontSize:13,color:'#9CA3AF',margin:'0 0 20px' }}>刪除後無法復原</p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex:1,padding:'10px 0',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,cursor:'pointer',color:'#374151' }}>取消</button>
              <button onClick={handleDelete}
                style={{ flex:1,padding:'10px 0',borderRadius:10,border:'none',
                  background:'#DC2626',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯 Modal */}
      {editTarget && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200 }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',
            padding:'24px 20px 36px',width:'100%',maxWidth:480 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:800,color:'#111827',margin:0 }}>編輯業績紀錄</h2>
              <button onClick={() => setEditTarget(null)}
                style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#9CA3AF' }}>×</button>
            </div>

            {/* 日期 */}
            <label style={labelStyle}>日期</label>
            <input type="date" value={editForm.date}
              onChange={e => setEditForm(f => ({...f, date: e.target.value}))}
              style={inputStyle} />

            {/* 品名 */}
            <label style={labelStyle}>品名</label>
            <input type="text" value={editForm.product_name}
              onChange={e => setEditForm(f => ({...f, product_name: e.target.value}))}
              placeholder="商品名稱" style={inputStyle} />

            {/* 類型 */}
            <label style={labelStyle}>類型</label>
            <div style={{ display:'flex',gap:8,marginBottom:14 }}>
              {['BV','IBV'].map(type => (
                <button key={type} onClick={() => setEditForm(f => ({...f, type}))}
                  style={{ flex:1,padding:'9px 0',borderRadius:10,fontWeight:700,fontSize:14,cursor:'pointer',
                    border: editForm.type===type ? 'none' : '1px solid #E5E7EB',
                    background: editForm.type===type ? (type==='BV'?'#F97316':'#3B82F6') : '#fff',
                    color: editForm.type===type ? '#fff' : '#374151' }}>{type}</button>
              ))}
            </div>

            {/* 點數 */}
            <label style={labelStyle}>點數</label>
            <input type="number" value={editForm.points}
              onChange={e => setEditForm(f => ({...f, points: e.target.value}))}
              placeholder="0" style={inputStyle} />

            {/* 金額 & 成本 */}
            <div style={{ display:'flex',gap:10,marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <label style={labelStyle}>售價 (NT$)</label>
                <input type="number" value={editForm.amount}
                  onChange={e => setEditForm(f => ({...f, amount: e.target.value}))}
                  placeholder="0" style={{...inputStyle, marginBottom:0}} />
              </div>
              <div style={{ flex:1 }}>
                <label style={labelStyle}>成本 (NT$)</label>
                <input type="number" value={editForm.cost}
                  onChange={e => setEditForm(f => ({...f, cost: e.target.value}))}
                  placeholder="0" style={{...inputStyle, marginBottom:0}} />
              </div>
            </div>

            {/* 贈品 */}
            <label style={{ display:'flex',alignItems:'center',gap:8,
              fontSize:14,color:'#374151',marginBottom:20,cursor:'pointer' }}>
              <input type="checkbox" checked={editForm.is_gift}
                onChange={e => setEditForm(f => ({...f, is_gift: e.target.checked}))}
                style={{ width:16,height:16 }} />
              這是贈品（成本計入費用，不計算獲利）
            </label>

            <button onClick={handleSave} disabled={saving}
              style={{ width:'100%',padding:'13px 0',borderRadius:12,border:'none',
                background: saving ? '#93C5FD' : '#2563EB',color:'#fff',
                fontSize:15,fontWeight:700,cursor:'pointer' }}>
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = {
  display:'block', fontSize:12, fontWeight:700, color:'#6B7280', marginBottom:4
}
const inputStyle = {
  width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E5E7EB',
  fontSize:14, color:'#111827', marginBottom:14, boxSizing:'border-box',
  outline:'none'
}