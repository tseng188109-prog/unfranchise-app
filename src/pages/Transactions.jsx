import { useState, useEffect, useRef } from 'react'
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

// ── CSV 工具 ──────────────────────────────────────────
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '')
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))

  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    vals.push(cur.trim())
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').replace(/^"|"$/g,'').replace(/\r$/, '')
    })
    return row
  }).filter(r => r.date && r.product_name && r.type && r.points)
}

function parseDate(val) {
  if (!val) return ''
  val = val.trim()
  if (!val) return ''
  if (/\/00|-00|^1900/.test(val)) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const m1 = val.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (m1) {
    const [, y, mo, d] = m1
    if (mo==='0'||d==='0'||mo==='00'||d==='00') return ''
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  const m2 = val.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/)
  if (m2) {
    const [, ry, mo, d] = m2
    if (mo==='0'||d==='0'||mo==='00'||d==='00') return ''
    return `${parseInt(ry)+1911}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  const m3 = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m3) {
    const [, y, mo, d] = m3
    if (mo==='0'||d==='0'||mo==='00'||d==='00') return ''
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return ''
}

// 電話標準化：去除符號，補回 Excel 吃掉的開頭 0
function normalizePhone(val) {
  if (!val) return ''
  let p = String(val).trim().replace(/[-\s()]/g, '')
  if (!p) return ''
  if (/^\d{9}$/.test(p)) p = '0' + p
  return p
}

const TRANSACTIONS_TEMPLATE = `date,customer_name,customer_phone,product_name,type,points,amount,cost,is_gift
2025-06-01,王小明,0912345678,ISOTONIX OPC-3,BV,100,3200,2800,false
2025-06-02,李美玲,0923456789,TLS 代餐,IBV,50,1500,1200,false
2025-06-03,張大偉,,試用組合,BV,0,0,500,true`
// ─────────────────────────────────────────────────────

export default function Transactions() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [bvTotal, setBvTotal] = useState(0)
  const [ibvTotal, setIbvTotal] = useState(0)
  const [profit, setProfit] = useState(0)
  const [giftCost, setGiftCost] = useState(0)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuId, setMenuId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(null)
  const fileInputRef = useRef(null)

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
    const { data } = await supabase.from('transactions')
      .select('*,customers(name)').eq('user_id', user.id)
      .gte('date', start).lte('date', end).order('date', { ascending: false })
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
    buildChartData(data, year, month)
    setLoading(false)
  }

  function buildChartData(data, y, m) {
    const daysInMonth = new Date(y, m, 0).getDate()
    const days = []
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`
      const dayTx = data.filter(t => t.date === dateStr)
      days.push({
        day: i,
        bv: dayTx.filter(t => t.type==='BV').reduce((s,t) => s + Number(t.points), 0),
        ibv: dayTx.filter(t => t.type==='IBV').reduce((s,t) => s + Number(t.points), 0),
      })
    }
    setChartData(days)
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y-1); setMonth(12) }
    else setMonth(m => m-1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y+1); setMonth(1) }
    else setMonth(m => m+1)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('transactions').delete().eq('id', deleteTarget)
    setDeleteTarget(null); fetchData()
  }

  function openEdit(t) {
    setMenuId(null); setEditTarget(t)
    setEditForm({
      date: t.date || '', product_name: t.product_name || '',
      type: t.type || 'BV', points: t.points || '',
      amount: t.amount || '', cost: t.cost || '', is_gift: t.is_gift || false,
    })
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('transactions').update({
      date: editForm.date, product_name: editForm.product_name,
      type: editForm.type, points: Number(editForm.points),
      amount: Number(editForm.amount), cost: Number(editForm.cost),
      is_gift: editForm.is_gift,
    }).eq('id', editTarget.id)
    setSaving(false); setEditTarget(null); fetchData()
  }

  // ── CSV 匯入邏輯 ──────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rawRows = parseCSV(ev.target.result)
      const errors = []

      const rows = rawRows.map((r, i) => {
        const parsed = { ...r }

        const rawDate = r.date || ''
        if (rawDate) {
          const converted = parseDate(rawDate)
          if (!converted) {
            errors.push(`第${i+2}行「${r.product_name}」：無法識別日期「${rawDate}」`)
          } else {
            parsed.date = converted
          }
        }

        if (!r.product_name) errors.push(`第${i+2}行：缺少品名`)
        if (!['BV','IBV'].includes(r.type))
          errors.push(`第${i+2}行「${r.product_name}」：類型應為 BV 或 IBV`)
        if (!r.points || isNaN(Number(r.points)))
          errors.push(`第${i+2}行「${r.product_name}」：點數應為數字`)

        return parsed
      })

      setImportRows(rows)
      setImportErrors(errors)
      setImportDone(null)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  async function handleImport() {
    if (!importRows.length || importErrors.length) return
    setImporting(true)

    const { data: custList } = await supabase
      .from('customers').select('id,name,phone').eq('user_id', user.id)

    const phoneMap = {}
    const nameMap = {}
    ;(custList||[]).forEach(c => {
      if (c.phone) phoneMap[normalizePhone(c.phone)] = c.id
      nameMap[c.name] = c.id
    })

    const toCreateCusts = []
    importRows.forEach(r => {
      if (!r.customer_name) return
      const phone = normalizePhone(r.customer_phone)
      const foundByPhone = phone ? phoneMap[phone] : null
      const foundByName = nameMap[r.customer_name]
      if (!foundByPhone && !foundByName) {
        if (!toCreateCusts.find(c => c.name === r.customer_name)) {
          toCreateCusts.push({
            user_id: user.id,
            name: r.customer_name,
            phone: normalizePhone(r.customer_phone) || null,
            is_pinned: false,
          })
        }
      }
    })

    if (toCreateCusts.length > 0) {
      const { data: newCusts } = await supabase.from('customers')
        .insert(toCreateCusts).select('id,name,phone')
      ;(newCusts||[]).forEach(c => {
        if (c.phone) phoneMap[normalizePhone(c.phone)] = c.id
        nameMap[c.name] = c.id
      })
    }

    const toInsert = importRows.map(r => {
      const phone = normalizePhone(r.customer_phone)
      const customerId = (phone && phoneMap[phone])
        || (r.customer_name && nameMap[r.customer_name])
        || null
      return {
        user_id: user.id,
        customer_id: customerId,
        date: r.date,
        product_name: r.product_name,
        type: r.type,
        points: Number(r.points),
        amount: r.amount ? Number(r.amount) : 0,
        cost: r.cost ? Number(r.cost) : 0,
        is_gift: r.is_gift === 'true' || r.is_gift === '1',
      }
    })

    await supabase.from('transactions').insert(toInsert)

    setImporting(false)
    setImportDone({ success: toInsert.length, skip: 0 })
    fetchData()
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + TRANSACTIONS_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = '業績紀錄範本.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function resetImport() {
    setImportRows([]); setImportErrors([]); setImportDone(null)
  }
  // ─────────────────────────────────────────────────

  const maxBv = Math.max(...chartData.map(d => d.bv), 1)
  const maxIbv = Math.max(...chartData.map(d => d.ibv), 1)
  const maxVal = Math.max(maxBv, maxIbv, 1)
  const chartHeight = 80

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}
      onClick={() => setMenuId(null)}>

      <div style={{ background:'#fff',padding:'52px 16px 16px',borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>業績紀錄</h1>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={e => { e.stopPropagation(); setShowImport(true); resetImport() }}
              style={{ width:36,height:36,borderRadius:'50%',background:'#F0FDF4',
                border:'1px solid #22C55E',color:'#16A34A',fontSize:18,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}
              title="CSV 批量匯入">📥</button>
            <button onClick={() => navigate('/transactions/new')}
              style={{ width:36,height:36,borderRadius:'50%',background:'#2563EB',
                border:'none',color:'#fff',fontSize:22,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
          </div>
        </div>

        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginBottom:16 }}>
          <button onClick={prevMonth}
            style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#374151' }}>‹</button>
          <span style={{ fontSize:16,fontWeight:700,color:'#111827' }}>{year} 年 {month} 月</span>
          <button onClick={nextMonth}
            style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#374151' }}>›</button>
        </div>

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
          <p style={{ fontSize:12,color:'#F97316',textAlign:'right',margin:'0 0 8px' }}>
            贈品成本：-NT${giftCost.toLocaleString()}
          </p>
        )}

        {chartData.length > 0 && chartData.some(d => d.bv > 0 || d.ibv > 0) && (
          <div style={{ background:'#F8FAFC',borderRadius:12,padding:'12px 8px 8px',marginTop:4 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <span style={{ fontSize:12,fontWeight:700,color:'#6B7280' }}>每日點數趨勢</span>
              <div style={{ display:'flex',gap:10 }}>
                <span style={{ fontSize:11,color:'#F97316',display:'flex',alignItems:'center',gap:3 }}>
                  <span style={{ width:8,height:8,borderRadius:2,background:'#F97316',display:'inline-block' }}/>BV
                </span>
                <span style={{ fontSize:11,color:'#3B82F6',display:'flex',alignItems:'center',gap:3 }}>
                  <span style={{ width:8,height:8,borderRadius:2,background:'#3B82F6',display:'inline-block' }}/>IBV
                </span>
              </div>
            </div>
            <div style={{ display:'flex',alignItems:'flex-end',gap:1,height:chartHeight,overflowX:'auto' }}>
              {chartData.map(d => (
                <div key={d.day} style={{ display:'flex',flexDirection:'column',alignItems:'center',
                  gap:1,minWidth:9,flex:1 }}>
                  <div style={{ width:'100%',display:'flex',flexDirection:'column',
                    alignItems:'center',justifyContent:'flex-end',height:chartHeight-16 }}>
                    {d.bv > 0 && (
                      <div style={{ width:'100%',background:'#F97316',borderRadius:'2px 2px 0 0',
                        height:`${Math.max(2,(d.bv/maxVal)*(chartHeight-16))}px`,opacity:0.85 }} />
                    )}
                    {d.ibv > 0 && (
                      <div style={{ width:'100%',background:'#3B82F6',borderRadius:'2px 2px 0 0',
                        height:`${Math.max(2,(d.ibv/maxVal)*(chartHeight-16))}px`,opacity:0.85,marginTop:1 }} />
                    )}
                    {d.bv === 0 && d.ibv === 0 && (
                      <div style={{ width:'100%',height:2,background:'#F3F4F6',borderRadius:2 }} />
                    )}
                  </div>
                  <span style={{ fontSize:9,color:'#D1D5DB',lineHeight:1 }}>
                    {d.day % 5 === 1 ? d.day : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
                <button onClick={e => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id) }}
                  style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',
                    color:'#9CA3AF',padding:'4px 6px',marginLeft:4,flexShrink:0 }}>⋯</button>
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

      {showImport && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:400 }}
          onClick={() => { setShowImport(false); resetImport() }}>
          <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',
            padding:'24px 20px 40px',width:'100%',maxWidth:480,
            maxHeight:'85vh',overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:800,color:'#111827',margin:0 }}>📥 批量匯入業績</h2>
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#9CA3AF' }}>×</button>
            </div>

            <button onClick={downloadTemplate}
              style={{ display:'flex',alignItems:'center',gap:8,width:'100%',
                padding:'12px 16px',borderRadius:12,border:'1px dashed #22C55E',
                background:'#F0FDF4',marginBottom:16,cursor:'pointer' }}>
              <span style={{ fontSize:18 }}>📄</span>
              <div style={{ textAlign:'left' }}>
                <p style={{ fontSize:13,fontWeight:700,color:'#16A34A',margin:0 }}>下載 CSV 範本</p>
                <p style={{ fontSize:11,color:'#6B7280',margin:0 }}>date, customer_name, customer_phone, product_name, type, points, amount, cost, is_gift</p>
              </div>
            </button>

            <div style={{ background:'#FFF7ED',borderRadius:10,padding:'10px 14px',marginBottom:16 }}>
              <p style={{ fontSize:12,color:'#92400E',margin:0,lineHeight:1.6 }}>
                💡 <strong>日期</strong> 支援 YYYY-MM-DD、YYYY/MM/DD、民國年<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<strong>customer_phone</strong> 填手機號碼，優先用電話配對顧客<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<strong>customer_name</strong> 電話找不到時用名字配對，都沒有就新建<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<strong>is_gift</strong> 填 true/false<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;電話開頭的 0 被 Excel 吃掉沒關係，系統會自動補回
              </p>
            </div>

            <input ref={fileInputRef} type="file" accept=".csv"
              onChange={handleFileChange} style={{ display:'none' }} />
            <button onClick={() => fileInputRef.current.click()}
              style={{ width:'100%',padding:'13px 0',borderRadius:12,
                border:'1px solid #E5E7EB',background:'#F8FAFC',
                fontSize:14,fontWeight:600,color:'#374151',cursor:'pointer',marginBottom:16 }}>
              📂 選擇 CSV 檔案
            </button>

            {importRows.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 8px' }}>
                  📋 偵測到 {importRows.length} 筆資料
                </p>
                {importErrors.length > 0 && (
                  <div style={{ background:'#FEF2F2',borderRadius:10,padding:'10px 14px',marginBottom:10 }}>
                    <p style={{ fontSize:12,fontWeight:700,color:'#DC2626',margin:'0 0 4px' }}>
                      ⚠️ 發現 {importErrors.length} 個問題：
                    </p>
                    {importErrors.map((e,i) => (
                      <p key={i} style={{ fontSize:12,color:'#DC2626',margin:'2px 0' }}>• {e}</p>
                    ))}
                  </div>
                )}
                {importErrors.length === 0 && (
                  <div style={{ border:'1px solid #E5E7EB',borderRadius:10,overflow:'hidden',marginBottom:12 }}>
                    {importRows.slice(0,5).map((r,i) => (
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:10,
                        padding:'9px 14px',borderBottom:i<Math.min(importRows.length,5)-1?'1px solid #F3F4F6':'none',
                        background:i%2===0?'#fff':'#F8FAFC' }}>
                        <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:6,
                          background:r.type==='BV'?'#FFF7ED':'#EFF6FF',
                          color:r.type==='BV'?'#F97316':'#3B82F6',flexShrink:0 }}>{r.type}</span>
                        <div style={{ flex:1,minWidth:0 }}>
                          <span style={{ fontSize:13,fontWeight:700,color:'#111827' }}>{r.product_name}</span>
                          {r.customer_name && <span style={{ fontSize:12,color:'#9CA3AF' }}> · {r.customer_name}</span>}
                        </div>
                        <div style={{ textAlign:'right',flexShrink:0 }}>
                          <span style={{ fontSize:13,fontWeight:700,color:'#374151' }}>{r.points}點</span>
                          <span style={{ fontSize:11,color:'#9CA3AF',display:'block' }}>{r.date}</span>
                        </div>
                      </div>
                    ))}
                    {importRows.length > 5 && (
                      <div style={{ padding:'8px 14px',background:'#F8FAFC',
                        fontSize:12,color:'#9CA3AF',textAlign:'center' }}>
                        …還有 {importRows.length - 5} 筆
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {importDone && (
              <div style={{ background:'#F0FDF4',borderRadius:10,padding:'12px 16px',marginBottom:16 }}>
                <p style={{ fontSize:14,fontWeight:700,color:'#16A34A',margin:0 }}>
                  ✅ 匯入完成！成功 {importDone.success} 筆
                </p>
              </div>
            )}

            {importRows.length > 0 && importErrors.length === 0 && !importDone && (
              <button onClick={handleImport} disabled={importing}
                style={{ width:'100%',padding:'13px 0',borderRadius:12,border:'none',
                  background:importing?'#93C5FD':'#2563EB',
                  color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                {importing ? '匯入中…' : `確認匯入 ${importRows.length} 筆`}
              </button>
            )}
            {importDone && (
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ width:'100%',padding:'13px 0',borderRadius:12,border:'none',
                  background:'#2563EB',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                完成
              </button>
            )}
          </div>
        </div>
      )}

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
            <label style={labelStyle}>日期</label>
            <input type="date" value={editForm.date}
              onChange={e => setEditForm(f => ({...f, date: e.target.value}))} style={inputStyle} />
            <label style={labelStyle}>品名</label>
            <input type="text" value={editForm.product_name}
              onChange={e => setEditForm(f => ({...f, product_name: e.target.value}))}
              placeholder="商品名稱" style={inputStyle} />
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
            <label style={labelStyle}>點數</label>
            <input type="number" value={editForm.points}
              onChange={e => setEditForm(f => ({...f, points: e.target.value}))}
              placeholder="0" style={inputStyle} />
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
  fontSize:14, color:'#111827', marginBottom:14, boxSizing:'border-box', outline:'none'
}
