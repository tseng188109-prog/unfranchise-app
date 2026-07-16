import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconSearch, IconPlus, IconDownload, IconFileTypeCsv, IconFolder,
  IconPin, IconTrash, IconX, IconMail, IconBell,
} from '@tabler/icons-react'

// 設計系統色碼
const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const ACCENT_PINK = '#F45DA8'
const DANGER = '#E0454A'
const DANGER_SOFT = '#FDE2E2'
const BORDER = '#F0F1F4'
const SUBCARD_BG = '#F5F8FC'

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
  text = text.replace(/^\uFEFF/, '')
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').trim().replace(/^"|"$/g,'').replace(/\r$/, '')
    })
    return row
  }).filter(r => r.name && r.name.trim())
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

function parseBirthday(val) {
  if (!val) return ''
  val = val.trim()
  if (!val) return ''
  if (/^\d{2}-\d{2}$/.test(val)) return val
  const match = val.match(/^(\d{1,2})[-\/](\d{1,2})$/)
  if (match) {
    const [, m, d] = match
    return `${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  const fullDate = parseDate(val)
  if (fullDate) return fullDate.slice(5)
  return ''
}

const CUSTOMERS_TEMPLATE = `name,phone,occupation,birthday,repurchase_reminder
王小明,0912-345678,上班族,06-15,2025-08-01
李美玲,0923-456789,老師,03-22,
張大偉,,自營業,,`
// ─────────────────────────────────────────────────────

export default function Customers() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuTarget, setMenuTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

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
      const rawRows = parseCSV(ev.target.result)
      const errors = []

      const rows = rawRows.map((r, i) => {
        const parsed = { ...r }

        if (r.repurchase_reminder) {
          parsed.repurchase_reminder = parseDate(r.repurchase_reminder) || null
          if (r.repurchase_reminder && !parsed.repurchase_reminder) {
            errors.push(`第${i+2}行「${r.name}」：無法識別回購日期「${r.repurchase_reminder}」`)
          }
        }

        if (r.birthday) {
          parsed.birthday = parseBirthday(r.birthday) || null
          if (r.birthday && !parsed.birthday) {
            errors.push(`第${i+2}行「${r.name}」：無法識別生日「${r.birthday}」`)
          }
        }

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
        birthday: r.birthday || null,
        repurchase_reminder: r.repurchase_reminder || null,
        is_pinned: false,
      })
    })

 if (toInsert.length > 0) {
  const { data, error } = await supabase.from('customers').insert(toInsert)
  console.log('customers insert error:', JSON.stringify(error))
  console.log('customers insert data:', data)
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
          background: menuTarget?.id === c.id ? SUBCARD_BG : '#fff',
          borderBottom:`1px solid ${BORDER}`, cursor:'pointer', userSelect:'none' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:avatarBg(c.name),
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff', fontWeight:700, fontSize:17, flexShrink:0 }}>
          {c.name[0]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {c.is_pinned && <IconPin size={12} stroke={2} color={TEXT_MUTED} />}
            <span style={{ fontSize:15, fontWeight:700, color:TEXT_MAIN }}>{c.name}</span>
            {c.repurchase_reminder && c.repurchase_reminder >= today && (
              <IconBell size={14} stroke={1.9} color={ACCENT_PINK} />
            )}
          </div>
          <p style={{ fontSize:12, color:TEXT_MUTED, margin:'2px 0 0' }}>
            {c.occupation||''}
            {c.occupation && c.phone ? ' · ' : ''}{c.phone||''}
          </p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN, margin:0 }}>
            {c.totalBV.toFixed(0)} BV
          </p>
          {c.lastDate && (
            <p style={{ fontSize:11, color:TEXT_MUTED, margin:'2px 0 0' }}>
              {formatDate(c.lastDate)}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}
      onClick={() => setMenuTarget(null)}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div style={{ background:'#fff', padding:'52px 0 0', borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:TEXT_MAIN, margin:0 }}>顧客檔案</h1>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={e => { e.stopPropagation(); setShowImport(true); resetImport() }}
              style={{ width:36, height:36, borderRadius:12, background:ACCENT_GREEN_SOFT,
                border:'none', color:ACCENT_GREEN_TEXT, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center' }}
              title="CSV 批量匯入"><IconDownload size={17} stroke={1.9} /></button>
            <button onClick={e => { e.stopPropagation(); navigate('/customers/new') }}
              style={{ width:36, height:36, borderRadius:12, background:PRIMARY,
                border:'none', color:'#fff', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center' }}><IconPlus size={19} stroke={2} /></button>
          </div>
        </div>
        <div style={{ position:'relative', marginBottom:12 }}>
          <IconSearch size={16} stroke={1.9} color={TEXT_MUTED}
            style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名、電話..."
            style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:12,
              border:`1px solid ${BORDER}`, fontSize:14, background:SUBCARD_BG,
              boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
        </div>
      </div>
      </div>

      <div className="dash-container">
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:TEXT_MUTED }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:TEXT_MUTED }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:12 }}><IconMail size={36} stroke={1.5} /></div>
          <p style={{ fontSize:15 }}>還沒有顧客，從業績新增或點 + 建立顧客檔案</p>
        </div>
      ) : (
        <div style={{ background:'#fff', marginTop:8 }}>
          {filtered.map(c => <CustomerCard key={c.id} c={c} />)}
        </div>
      )}
      </div>

      {showImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.5)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:400 }}
          onClick={() => { setShowImport(false); resetImport() }}>
          <div style={{ background:'#fff', borderRadius:'22px 22px 0 0',
            padding:'24px 20px 40px', width:'100%', maxWidth:480,
            maxHeight:'85vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:TEXT_MAIN, margin:0 }}>批量匯入顧客</h2>
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED }}><IconX size={22} /></button>
            </div>

            <button onClick={downloadTemplate}
              style={{ display:'flex', alignItems:'center', gap:10, width:'100%',
                padding:'12px 16px', borderRadius:14, border:`1px dashed ${ACCENT_GREEN}`,
                background:ACCENT_GREEN_SOFT, marginBottom:16, cursor:'pointer' }}>
              <IconFileTypeCsv size={20} stroke={1.8} color={ACCENT_GREEN_TEXT} />
              <div style={{ textAlign:'left' }}>
                <p style={{ fontSize:13, fontWeight:700, color:ACCENT_GREEN_TEXT, margin:0 }}>下載 CSV 範本</p>
                <p style={{ fontSize:11, color:TEXT_SECONDARY, margin:0 }}>日期支援 YYYY/MM/DD、民國年、Excel 格式</p>
              </div>
            </button>

            <div style={{ background:PRIMARY_SOFT, borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
              <p style={{ fontSize:12, fontWeight:700, color:PRIMARY, margin:'0 0 4px' }}>日期格式說明</p>
              <p style={{ fontSize:11, color:'#4A7BC8', margin:'2px 0' }}>• 回購日期：2025-08-01 或 2025/8/1 都可以</p>
              <p style={{ fontSize:11, color:'#4A7BC8', margin:'2px 0' }}>• 生日：06-15 或 6/15 都可以</p>
              <p style={{ fontSize:11, color:'#4A7BC8', margin:'2px 0' }}>• Excel 空白日期會自動忽略</p>
            </div>

            <input ref={fileInputRef} type="file" accept=".csv"
              onChange={handleFileChange} style={{ display:'none' }} />
            <button onClick={() => fileInputRef.current.click()}
              style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                width:'100%', padding:'13px 0', borderRadius:14,
                border:`1px solid ${BORDER}`, background:SUBCARD_BG,
                fontSize:14, fontWeight:600, color:TEXT_MAIN, cursor:'pointer', marginBottom:16 }}>
              <IconFolder size={17} stroke={1.9} /> 選擇 CSV 檔案
            </button>

            {importRows.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN, margin:'0 0 8px' }}>
                  偵測到 {importRows.length} 筆資料
                </p>
                {importErrors.length > 0 && (
                  <div style={{ background:DANGER_SOFT, borderRadius:12, padding:'10px 14px', marginBottom:10 }}>
                    <p style={{ fontSize:12, fontWeight:700, color:DANGER, margin:'0 0 4px' }}>
                      發現 {importErrors.length} 個問題：
                    </p>
                    {importErrors.map((e,i) => (
                      <p key={i} style={{ fontSize:12, color:DANGER, margin:'2px 0' }}>• {e}</p>
                    ))}
                  </div>
                )}
                {importErrors.length === 0 && (
                  <div style={{ border:`1px solid ${BORDER}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
                    {importRows.slice(0,5).map((r,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                        padding:'9px 14px', borderBottom: i<Math.min(importRows.length,5)-1 ? `1px solid ${BORDER}` : 'none',
                        background: i%2===0 ? '#fff' : SUBCARD_BG }}>
                        <div style={{ width:28, height:28, borderRadius:'50%',
                          background:avatarBg(r.name), display:'flex', alignItems:'center',
                          justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700 }}>
                          {r.name[0]}
                        </div>
                        <div style={{ flex:1 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN }}>{r.name}</span>
                          {r.phone && <span style={{ fontSize:12, color:TEXT_MUTED }}> · {r.phone}</span>}
                        </div>
                        <div style={{ textAlign:'right' }}>
                          {r.birthday && <span style={{ fontSize:11, color:'#A855F7' }}>{r.birthday}</span>}
                          {r.occupation && <span style={{ fontSize:12, color:TEXT_SECONDARY, marginLeft:6 }}>{r.occupation}</span>}
                        </div>
                      </div>
                    ))}
                    {importRows.length > 5 && (
                      <div style={{ padding:'8px 14px', background:SUBCARD_BG,
                        fontSize:12, color:TEXT_MUTED, textAlign:'center' }}>
                        …還有 {importRows.length - 5} 筆
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {importDone && (
              <div style={{ background:ACCENT_GREEN_SOFT, borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
                <p style={{ fontSize:14, fontWeight:700, color:ACCENT_GREEN_TEXT, margin:0 }}>
                  匯入完成！成功 {importDone.success} 筆
                  {importDone.skip > 0 && `，跳過重複 ${importDone.skip} 筆`}
                </p>
              </div>
            )}

            {importRows.length > 0 && importErrors.length === 0 && !importDone && (
              <button onClick={handleImport} disabled={importing}
                style={{ width:'100%', padding:'13px 0', borderRadius:14, border:'none',
                  background: importing ? '#9BBBF2' : PRIMARY,
                  color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                {importing ? '匯入中…' : `確認匯入 ${importRows.length} 筆`}
              </button>
            )}
            {importDone && (
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ width:'100%', padding:'13px 0', borderRadius:14, border:'none',
                  background:PRIMARY, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                完成
              </button>
            )}
          </div>
        </div>
      )}

      {menuTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200 }}
          onClick={() => setMenuTarget(null)}>
          <div style={{ background:'#fff', borderRadius:'22px 22px 0 0',
            padding:'20px 16px 36px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN,
              margin:'0 0 16px', textAlign:'center' }}>{menuTarget.name}</p>
            <button onClick={() => handlePin(menuTarget)}
              style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                padding:'14px 16px', borderRadius:14, border:'none',
                background:SUBCARD_BG, marginBottom:10, cursor:'pointer' }}>
              <IconPin size={19} stroke={1.9} color={TEXT_MAIN} />
              <span style={{ fontSize:15, fontWeight:600, color:TEXT_MAIN }}>
                {menuTarget.is_pinned ? '取消釘選' : '釘選到最上面'}
              </span>
            </button>
            <button onClick={() => setDeleteTarget(menuTarget)}
              style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                padding:'14px 16px', borderRadius:14, border:'none',
                background:DANGER_SOFT, marginBottom:10, cursor:'pointer' }}>
              <IconTrash size={19} stroke={1.9} color={DANGER} />
              <span style={{ fontSize:15, fontWeight:600, color:DANGER }}>刪除顧客</span>
            </button>
            <button onClick={() => setMenuTarget(null)}
              style={{ width:'100%', padding:'13px 0', borderRadius:14,
                border:`1px solid ${BORDER}`, background:'#fff',
                fontSize:15, color:TEXT_SECONDARY, cursor:'pointer' }}>取消</button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:24, width:280, textAlign:'center' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:8 }}>
              <IconTrash size={30} stroke={1.6} color={DANGER} />
            </div>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:'0 0 8px' }}>
              確定刪除「{deleteTarget.name}」？
            </p>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'0 0 20px' }}>刪除後無法復原</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:`1px solid ${BORDER}`,
                  background:'#fff', fontSize:14, cursor:'pointer', color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleDelete}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none',
                  background:DANGER, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
