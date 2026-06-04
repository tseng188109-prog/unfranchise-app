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
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}

// ── CSV 工具 ──────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || []
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').trim().replace(/^"|"$/g,'')
    })
    return row
  }).filter(r => r.name && r.name.trim())
}

const CUSTOMERS_TEMPLATE = `name,phone,occupation,repurchase_reminder
王小明,0912-345678,上班族,2025-08-01
李美玲,0923-456789,老師,
張大偉,,自營業,`
// ─────────────────────────────────────────────────────

export default function Customers() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuTarget, setMenuTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // CSV 匯入狀態
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchCustomers() }, [user])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('id,name,phone,occupation,repurchase_reminder,is_pinned')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('name')

    const { data: txData } = await supabase
      .from('transactions')
      .select('customer_id,points,date')
      .eq('user_id', user.id)

    if (data) {
      const enriched = data.map(c => {
        const txs = txData ? txData.filter(t => t.customer_id === c.id) : []
        const totalBV = txs.reduce((sum, t) => sum + Number(t.points), 0)
        const lastDate = txs.length > 0 ? txs.sort((a,b) => b.date.localeCompare(a.date))[0].date : null
        return { ...c, totalBV, lastDate }
      })
      setCustomers(enriched)
    }
    setLoading(false)
  }

  async function handlePin(c) {
    await supabase.from('customers').update({ is_pinned: !c.is_pinned }).eq('id', c.id)
    setMenuTarget(null); fetchCustomers()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('customers').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null); setMenuTarget(null); fetchCustomers()
  }

  // ── CSV 匯入邏輯 ──────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result)
      const errors = []
      rows.forEach((r, i) => {
        if (!r.name) errors.push(`第${i+2}行：缺少姓名`)
        if (r.repurchase_reminder && !/^\d{4}-\d{2}-\d{2}$/.test(r.repurchase_reminder))
          errors.push(`第${i+2}行「${r.name}」：回購日期格式應為 YYYY-MM-DD`)
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

    const { data: existing } = await supabase
      .from('customers').select('name').eq('user_id', user.id)
    const existingNames = new Set((existing||[]).map(c => c.name))

    const toInsert = []
    let skip = 0
    importRows.forEach(r => {
      if (existingNames.has(r.name)) { skip++; return }
      toInsert.push({
        user_id: user.id,
        name: r.name,
        phone: r.phone || null,
        occupation: r.occupation || null,
        repurchase_reminder: r.repurchase_reminder || null,
        is_pinned: false,
      })
    })

    if (toInsert.length > 0) {
      await supabase.from('customers').insert(toInsert)
    }

    setImporting(false)
    setImportDone({ success: toInsert.length, skip })
    fetchCustomers()
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + CUSTOMERS_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = '顧客檔案範本.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function resetImport() {
    setImportRows([]); setImportErrors([]); setImportDone(null)
  }
  // ─────────────────────────────────────────────────

  const filtered = customers.filter(c =>
    !search || c.name.includes(search) || (c.phone||'').includes(search)
  )
  const today = new Date().toISOString().split('T')[0]

  function CustomerCard({ c }) {
    const longPressTimer = useRef(null)
    function onPressStart() { longPressTimer.current = setTimeout(() => setMenuTarget(c), 500) }
    function onPressEnd() { clearTimeout(longPressTimer.current) }

    return (
      <div
        onMouseDown={onPressStart} onMouseUp={onPressEnd} onMouseLeave={onPressEnd}
        onTouchStart={onPressStart} onTouchEnd={onPressEnd} onTouchMove={onPressEnd}
        onClick={() => navigate(`/customers/${c.id}`)}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
          background: menuTarget?.id === c.id ? '#F8FAFC' : '#fff',
          borderBottom:'1px solid #F3F4F6', cursor:'pointer', userSelect:'none' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:avatarBg(c.name),
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff', fontWeight:700, fontSize:17, flexShrink:0 }}>
          {c.name[0]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {c.is_pinned && <span style={{ fontSize:12 }}>📌</span>}
            <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{c.name}</span>
            {c.repurchase_reminder && c.repurchase_reminder >= today && (
              <span style={{ fontSize:16 }} title="回購提醒">🔔</span>
            )}
          </div>
          <p style={{ fontSize:12, color:'#9CA3AF', margin:'2px 0 0' }}>
            {c.occupation||''}
            {c.occupation && c.phone ? ' · ' : ''}{c.phone||''}
          </p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:0 }}>
            {c.totalBV.toFixed(0)} BV
          </p>
          {c.lastDate && (
            <p style={{ fontSize:11, color:'#9CA3AF', margin:'2px 0 0' }}>
              {formatDate(c.lastDate)}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background:'#F8FAFC', minHeight:'100vh' }}
      onClick={() => setMenuTarget(null)}>

      {/* Header */}
      <div style={{ background:'#fff', padding:'52px 16px 0', borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#111827', margin:0 }}>顧客檔案</h1>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={e => { e.stopPropagation(); setShowImport(true); resetImport() }}
              style={{ width:36, height:36, borderRadius:'50%', background:'#F0FDF4',
                border:'1px solid #22C55E', color:'#16A34A', fontSize:18, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center' }}
              title="CSV 批量匯入">📥</button>
            <button onClick={e => { e.stopPropagation(); navigate('/customers/new') }}
              style={{ width:36, height:36, borderRadius:'50%', background:'#2563EB',
                border:'none', color:'#fff', fontSize:22, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        </div>
        <div style={{ position:'relative', marginBottom:12 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
            fontSize:16, color:'#9CA3AF' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名、電話..."
            style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:10,
              border:'1px solid #E5E7EB', fontSize:14, background:'#F8FAFC',
              boxSizing:'border-box', outline:'none', color:'#111827' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
          <p style={{ fontSize:36, margin:'0 0 12px' }}>✉️</p>
          <p style={{ fontSize:15 }}>還沒有顧客，從業績新增或點 + 建立顧客檔案</p>
        </div>
      ) : (
        <div style={{ background:'#fff', marginTop:8 }}>
          {filtered.map(c => <CustomerCard key={c.id} c={c} />)}
        </div>
      )}

      {/* ── CSV 匯入 Modal ───────────────────────────── */}
      {showImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:400 }}
          onClick={() => { setShowImport(false); resetImport() }}>
          <div style={{ background:'#fff', borderRadius:'20px 20px 0 0',
            padding:'24px 20px 40px', width:'100%', maxWidth:480,
            maxHeight:'85vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#111827', margin:0 }}>📥 批量匯入顧客</h2>
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9CA3AF' }}>×</button>
            </div>

            <button onClick={downloadTemplate}
              style={{ display:'flex', alignItems:'center', gap:8, width:'100%',
                padding:'12px 16px', borderRadius:12, border:'1px dashed #22C55E',
                background:'#F0FDF4', marginBottom:16, cursor:'pointer' }}>
              <span style={{ fontSize:18 }}>📄</span>
              <div style={{ textAlign:'left' }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#16A34A', margin:0 }}>下載 CSV 範本</p>
                <p style={{ fontSize:11, color:'#6B7280', margin:0 }}>name, phone, occupation, repurchase_reminder</p>
              </div>
            </button>

            <input ref={fileInputRef} type="file" accept=".csv"
              onChange={handleFileChange} style={{ display:'none' }} />
            <button onClick={() => fileInputRef.current.click()}
              style={{ width:'100%', padding:'13px 0', borderRadius:12,
                border:'1px solid #E5E7EB', background:'#F8FAFC',
                fontSize:14, fontWeight:600, color:'#374151', cursor:'pointer', marginBottom:16 }}>
              📂 選擇 CSV 檔案
            </button>

            {importRows.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:'0 0 8px' }}>
                  📋 偵測到 {importRows.length} 筆資料
                </p>
                {importErrors.length > 0 && (
                  <div style={{ background:'#FEF2F2', borderRadius:10, padding:'10px 14px', marginBottom:10 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'#DC2626', margin:'0 0 4px' }}>
                      ⚠️ 發現 {importErrors.length} 個問題：
                    </p>
                    {importErrors.map((e,i) => (
                      <p key={i} style={{ fontSize:12, color:'#DC2626', margin:'2px 0' }}>• {e}</p>
                    ))}
                  </div>
                )}
                {importErrors.length === 0 && (
                  <div style={{ border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
                    {importRows.slice(0,5).map((r,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                        padding:'9px 14px', borderBottom: i<Math.min(importRows.length,5)-1 ? '1px solid #F3F4F6' : 'none',
                        background: i%2===0 ? '#fff' : '#F8FAFC' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%',
                          background:avatarBg(r.name), display:'flex', alignItems:'center',
                          justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700 }}>
                          {r.name[0]}
                        </div>
                        <div style={{ flex:1 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{r.name}</span>
                          {r.phone && <span style={{ fontSize:12, color:'#9CA3AF' }}> · {r.phone}</span>}
                        </div>
                        {r.occupation && <span style={{ fontSize:12, color:'#6B7280' }}>{r.occupation}</span>}
                      </div>
                    ))}
                    {importRows.length > 5 && (
                      <div style={{ padding:'8px 14px', background:'#F8FAFC',
                        fontSize:12, color:'#9CA3AF', textAlign:'center' }}>
                        …還有 {importRows.length - 5} 筆
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {importDone && (
              <div style={{ background:'#F0FDF4', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'#16A34A', margin:0 }}>
                  ✅ 匯入完成！成功 {importDone.success} 筆
                  {importDone.skip > 0 && `，跳過重複 ${importDone.skip} 筆`}
                </p>
              </div>
            )}

            {importRows.length > 0 && importErrors.length === 0 && !importDone && (
              <button onClick={handleImport} disabled={importing}
                style={{ width:'100%', padding:'13px 0', borderRadius:12, border:'none',
                  background: importing ? '#93C5FD' : '#2563EB',
                  color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                {importing ? '匯入中…' : `確認匯入 ${importRows.length} 筆`}
              </button>
            )}
            {importDone && (
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ width:'100%', padding:'13px 0', borderRadius:12, border:'none',
                  background:'#2563EB', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                完成
              </button>
            )}
          </div>
        </div>
      )}
      {/* ───────────────────────────────────────────── */}

      {/* 長按選單 Modal */}
      {menuTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200 }}
          onClick={() => setMenuTarget(null)}>
          <div style={{ background:'#fff', borderRadius:'20px 20px 0 0',
            padding:'20px 16px 36px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16, fontWeight:800, color:'#111827',
              margin:'0 0 16px', textAlign:'center' }}>{menuTarget.name}</p>
            <button onClick={() => handlePin(menuTarget)}
              style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                padding:'14px 16px', borderRadius:12, border:'none',
                background:'#FFF7ED', marginBottom:10, cursor:'pointer' }}>
              <span style={{ fontSize:20 }}>📌</span>
              <span style={{ fontSize:15, fontWeight:600, color:'#374151' }}>
                {menuTarget.is_pinned ? '取消釘選' : '釘選到最上面'}
              </span>
            </button>
            <button onClick={() => setDeleteTarget(menuTarget)}
              style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                padding:'14px 16px', borderRadius:12, border:'none',
                background:'#FEF2F2', marginBottom:10, cursor:'pointer' }}>
              <span style={{ fontSize:20 }}>🗑️</span>
              <span style={{ fontSize:15, fontWeight:600, color:'#DC2626' }}>刪除顧客</span>
            </button>
            <button onClick={() => setMenuTarget(null)}
              style={{ width:'100%', padding:'13px 0', borderRadius:12,
                border:'1px solid #E5E7EB', background:'#fff',
                fontSize:15, color:'#6B7280', cursor:'pointer' }}>取消</button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, width:280, textAlign:'center' }}>
            <p style={{ fontSize:32, margin:'0 0 8px' }}>🗑️</p>
            <p style={{ fontSize:16, fontWeight:700, color:'#111827', margin:'0 0 8px' }}>
              確定刪除「{deleteTarget.name}」？
            </p>
            <p style={{ fontSize:13, color:'#9CA3AF', margin:'0 0 20px' }}>刪除後無法復原</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1px solid #E5E7EB',
                  background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}>取消</button>
              <button onClick={handleDelete}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none',
                  background:'#DC2626', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}