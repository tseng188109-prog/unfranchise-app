import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

function today() { return new Date().toISOString().split('T')[0] }
function getEggColor(t) { return t==='茶葉蛋'?'#F97316':t==='荷包蛋'?'#3B82F6':t==='生雞蛋'?'#22C55E':'#9CA3AF' }
function getEggBg(t) { return t==='茶葉蛋'?'#FFF7ED':t==='荷包蛋'?'#EFF6FF':t==='生雞蛋'?'#F0FDF4':'#F9FAFB' }
function avatarBg(name) {
  const colors=['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n=0; for(let i=0;i<name.length;i++) n+=name.charCodeAt(i)
  return colors[n%colors.length]
}
function formatDue(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((new Date(today()) - new Date(dateStr)) / 86400000)
  if (diff === 0) return '今天到期'
  if (diff > 0) return `逾期${diff}天`
  return `${Math.abs(diff)}天後`
}

function Avatar({ name, size=40 }) {
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',background:avatarBg(name||''),
      display:'flex',alignItems:'center',justifyContent:'center',
      color:'#fff',fontWeight:700,fontSize:size*0.4,flexShrink:0 }}>
      {name?name[0]:'?'}
    </div>
  )
}

// ── CSV 工具 ──────────────────────────────────────────
function parseCSV(text) {
  // 移除 BOM
  text = text.replace(/^\uFEFF/, '')
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
  return lines.slice(1).map(line => {
    // 用 split(',') 正確處理空欄位（原本的 regex 會跳過空欄位導致錯位）
    const vals = line.split(',')
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').trim().replace(/^"|"$/g,'').replace(/\r$/, '')
    })
    return row
  }).filter(r => r.name && r.name.trim())
}

// 解析各種日期格式 → YYYY-MM-DD
// 支援：2025-07-01 / 2025/7/1 / 2025/07/01 / 114/7/1（民國）
function parseDate(val) {
  if (!val) return ''
  val = val.trim()
  if (!val) return ''

  // 已經是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val

  // YYYY/M/D 或 YYYY/MM/DD（西元）
  const slashFull = val.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashFull) {
    const [, y, m, d] = slashFull
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // 民國 YYY/M/D（3位年份，如 114/7/1）
  const rocSlash = val.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/)
  if (rocSlash) {
    const [, ry, m, d] = rocSlash
    const y = parseInt(ry) + 1911
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // YYYY-M-D（年份4位但月日沒補零）
  const dashFull = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (dashFull) {
    const [, y, m, d] = dashFull
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  return '' // 無法解析
}

// 解析生日 → MM-DD
// 支援：06-15 / 6-15 / 06/15 / 6/15
function parseBirthday(val) {
  if (!val) return ''
  val = val.trim()
  if (!val) return ''

  // 已經是 MM-DD
  if (/^\d{2}-\d{2}$/.test(val)) return val

  // M-D 或 M/D 或 MM/DD
  const match = val.match(/^(\d{1,2})[-\/](\d{1,2})$/)
  if (match) {
    const [, m, d] = match
    return `${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // 如果是完整日期格式（Excel 存了年月日），只取月日
  const fullDate = parseDate(val)
  if (fullDate) {
    return fullDate.slice(5) // 取 MM-DD
  }

  return ''
}

const CONTACTS_TEMPLATE = `name,occupation,egg_type,need_level,action_type,birthday,next_contact_date
王小明,上班族,茶葉蛋,大三,直接法,06-15,2025-07-01
李美玲,老師,荷包蛋,大二,軟性活動,03-22,
張大偉,自營業,生雞蛋,大一,輕鬆互動,,`

const EGG_VALID = ['茶葉蛋','荷包蛋','生雞蛋','']
const NEED_VALID = ['大一','大二','大三','大四','']
// ─────────────────────────────────────────────────────

const EGG_FILTERS = ['全部','茶葉蛋','荷包蛋','生雞蛋']

export default function Contacts() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [eggFilter, setEggFilter] = useState('全部')
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuTarget, setMenuTarget] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null)

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

  useEffect(() => { if (user) fetchContacts() }, [user, showArchived])

  async function fetchContacts() {
    setLoading(true)
    let query = supabase
      .from('contacts')
      .select('id,name,occupation,egg_type,need_level,action_type,next_contact_date,last_contact_date,is_pinned')
      .eq('user_id', user.id)
      .eq('is_archived', showArchived)

    if (!showArchived) {
      query = query
        .order('is_pinned', { ascending: false })
        .order('next_contact_date', { ascending: true, nullsFirst: false })
    } else {
      query = query.order('name', { ascending: true })
    }

    const { data } = await query
    if (data) setContacts(data)
    setLoading(false)
  }

  async function handlePin(c) {
    await supabase.from('contacts').update({ is_pinned: !c.is_pinned }).eq('id', c.id)
    setMenuTarget(null)
    fetchContacts()
  }

  async function handleArchive() {
    if (!archiveTarget) return
    await supabase.from('contacts').update({ is_archived: true }).eq('id', archiveTarget.id)
    setArchiveTarget(null); setMenuTarget(null); fetchContacts()
  }

  async function handleRestore() {
    if (!restoreTarget) return
    await supabase.from('contacts').update({ is_archived: false }).eq('id', restoreTarget.id)
    setRestoreTarget(null); setMenuTarget(null); fetchContacts()
  }

  // ── CSV 匯入邏輯 ──────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rawRows = parseCSV(ev.target.result)
      const errors = []

      // 解析並轉換每一行的日期欄位
      const rows = rawRows.map((r, i) => {
        const parsed = { ...r }

        // 解析 next_contact_date
        const rawDate = r.next_contact_date || ''
        if (rawDate) {
          const converted = parseDate(rawDate)
          if (!converted) {
            errors.push(`第${i+2}行「${r.name}」：無法識別日期「${rawDate}」，請改用 YYYY/MM/DD 或 YYYY-MM-DD`)
          } else {
            parsed.next_contact_date = converted
          }
        }

        // 解析 birthday
        const rawBday = r.birthday || ''
        if (rawBday) {
          const converted = parseBirthday(rawBday)
          if (!converted) {
            errors.push(`第${i+2}行「${r.name}」：無法識別生日「${rawBday}」，請改用 MM/DD 或 MM-DD`)
          } else {
            parsed.birthday = converted
          }
        }

        // 驗證蛋型
        if (r.egg_type && !EGG_VALID.includes(r.egg_type))
          errors.push(`第${i+2}行「${r.name}」：蛋型「${r.egg_type}」不正確（茶葉蛋/荷包蛋/生雞蛋）`)

        // 驗證需求度
        if (r.need_level && !NEED_VALID.includes(r.need_level))
          errors.push(`第${i+2}行「${r.name}」：需求度「${r.need_level}」不正確（大一/大二/大三/大四）`)

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
      .from('contacts').select('name').eq('user_id', user.id)
    const existingNames = new Set((existing||[]).map(c => c.name))

    const toInsert = []
    let skip = 0
    importRows.forEach(r => {
      if (existingNames.has(r.name)) { skip++; return }
      toInsert.push({
        user_id: user.id,
        name: r.name,
        occupation: r.occupation || null,
        egg_type: r.egg_type || null,
        need_level: r.need_level || null,
        action_type: r.action_type || null,
        birthday: r.birthday || null,
        next_contact_date: r.next_contact_date || null,
        is_pinned: false,
        is_archived: false,
      })
    })

    if (toInsert.length > 0) {
      await supabase.from('contacts').insert(toInsert)
    }

    setImporting(false)
    setImportDone({ success: toInsert.length, skip })
    fetchContacts()
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + CONTACTS_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = '互動名單範本.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function resetImport() {
    setImportRows([]); setImportErrors([]); setImportDone(null)
  }
  // ─────────────────────────────────────────────────

  const filtered = contacts.filter(c => {
    const matchEgg = eggFilter === '全部' || c.egg_type === eggFilter
    const matchSearch = !search || c.name.includes(search) || (c.occupation||'').includes(search)
    return matchEgg && matchSearch
  })

  const pinned = filtered.filter(c => c.is_pinned)
  const unpinned = filtered.filter(c => !c.is_pinned)
  const overdue = unpinned.filter(c => c.next_contact_date && c.next_contact_date < today())
  const dueToday = unpinned.filter(c => c.next_contact_date === today())
  const thisWeek = unpinned.filter(c => {
    if (!c.next_contact_date || c.next_contact_date <= today()) return false
    const diff = Math.floor((new Date(c.next_contact_date) - new Date(today())) / 86400000)
    return diff <= 7
  })
  const others = unpinned.filter(c => {
    if (!c.next_contact_date) return true
    const diff = Math.floor((new Date(c.next_contact_date) - new Date(today())) / 86400000)
    return diff > 7
  })

  function ContactCard({ c }) {
    const isOv = c.next_contact_date && c.next_contact_date < today()
    const isToday = c.next_contact_date === today()
    const longPressTimer = useRef(null)

    function onPressStart() {
      longPressTimer.current = setTimeout(() => setMenuTarget(c), 500)
    }
    function onPressEnd() { clearTimeout(longPressTimer.current) }

    return (
      <div
        onMouseDown={onPressStart} onMouseUp={onPressEnd}
        onMouseLeave={onPressEnd} onTouchStart={onPressStart}
        onTouchEnd={onPressEnd} onTouchMove={onPressEnd}
        onClick={() => !showArchived && navigate(`/contacts/${c.id}`)}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
          background: menuTarget?.id === c.id ? '#F8FAFC' : '#fff',
          borderBottom:'1px solid #F3F4F6',
          cursor: showArchived ? 'default' : 'pointer', userSelect:'none' }}>
        <Avatar name={c.name} size={42} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            {c.is_pinned && <span style={{ fontSize:12 }}>📌</span>}
            <span style={{ fontSize:15, fontWeight:700, color: showArchived ? '#9CA3AF' : '#111827' }}>{c.name}</span>
            {c.egg_type && (
              <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:6,
                background:getEggBg(c.egg_type), color:getEggColor(c.egg_type) }}>
                {c.egg_type}
              </span>
            )}
          </div>
          <div style={{ fontSize:12, color:'#9CA3AF', display:'flex', gap:4 }}>
            {c.occupation && <span>{c.occupation}</span>}
            {c.occupation && c.action_type && <span>·</span>}
            {c.action_type && <span>{c.action_type}</span>}
          </div>
        </div>
        {!showArchived && c.next_contact_date && (
          <span style={{ fontSize:12, fontWeight:600, whiteSpace:'nowrap',
            color:isOv?'#DC2626':isToday?'#F97316':'#9CA3AF' }}>
            {formatDue(c.next_contact_date)}
          </span>
        )}
        {showArchived && (
          <span style={{ fontSize:12, color:'#D1D5DB', whiteSpace:'nowrap' }}>📦 封存中</span>
        )}
      </div>
    )
  }

  function Section({ title, count, items }) {
    if (items.length === 0) return null
    return (
      <div>
        <div style={{ padding:'8px 16px', background:'#F8FAFC',
          fontSize:12, fontWeight:700, color:'#6B7280',
          borderBottom:'1px solid #F3F4F6' }}>
          {title} · {count}人
        </div>
        {items.map(c => <ContactCard key={c.id} c={c} />)}
      </div>
    )
  }

  return (
    <div style={{ background:'#F8FAFC', minHeight:'100vh' }}
      onClick={() => setMenuTarget(null)}>

      {/* Header */}
      <div style={{ background:'#fff', padding:'52px 16px 0', borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#111827', margin:0 }}>互動名單</h1>
          {!showArchived && (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={e => { e.stopPropagation(); setShowImport(true); resetImport() }}
                style={{ width:36, height:36, borderRadius:'50%', background:'#F0FDF4',
                  border:'1px solid #22C55E', color:'#16A34A', fontSize:18, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center' }}
                title="CSV 批量匯入">📥</button>
              <button onClick={e => { e.stopPropagation(); navigate('/contacts/new') }}
                style={{ width:36, height:36, borderRadius:'50%', background:'#2563EB',
                  border:'none', color:'#fff', fontSize:22, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
            </div>
          )}
        </div>

        <div style={{ position:'relative', marginBottom:12 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
            fontSize:16, color:'#9CA3AF' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名、職業..."
            style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:10,
              border:'1px solid #E5E7EB', fontSize:14, background:'#F8FAFC',
              boxSizing:'border-box', outline:'none' }} />
        </div>

        <div style={{ display:'flex', gap:8, paddingBottom:12, overflowX:'auto' }}>
          <button onClick={() => { setShowArchived(!showArchived); setEggFilter('全部'); setSearch('') }}
            style={{ padding:'5px 14px', borderRadius:99, border:'none',
              background: showArchived ? '#6B7280' : '#F3F4F6',
              color: showArchived ? '#fff' : '#6B7280',
              fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            📦 {showArchived ? '查看一般' : '封存名單'}
          </button>
          {EGG_FILTERS.map(f => (
            <button key={f} onClick={() => setEggFilter(f)}
              style={{ padding:'5px 14px', borderRadius:99, border:'none',
                background: eggFilter===f ? (showArchived ? '#6B7280' : '#2563EB') : '#F3F4F6',
                color: eggFilter===f ? '#fff' : '#6B7280',
                fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {showArchived && (
        <div style={{ background:'#FEF9C3', padding:'10px 16px',
          fontSize:13, color:'#92400E', display:'flex', alignItems:'center', gap:6 }}>
          <span>📦</span>
          <span>封存名單 · 長按可復原聯絡人</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
          <p style={{ fontSize:40, margin:'0 0 12px' }}>{showArchived ? '📦' : '👥'}</p>
          <p style={{ fontSize:15 }}>
            {showArchived ? '沒有封存的聯絡人' : '還沒有聯絡人，點 + 新增第一位吧！'}
          </p>
        </div>
      ) : showArchived ? (
        <div style={{ background:'#fff', margin:'8px 0' }}>
          <Section title="📦 封存中" count={filtered.length} items={filtered} />
        </div>
      ) : (
        <div style={{ background:'#fff', margin:'8px 0' }}>
          <Section title="📌 釘選" count={pinned.length} items={pinned} />
          <Section title="逾期" count={overdue.length} items={overdue} />
          <Section title="今天到期" count={dueToday.length} items={dueToday} />
          <Section title="本週到期" count={thisWeek.length} items={thisWeek} />
          <Section title="其他" count={others.length} items={others} />
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
              <h2 style={{ fontSize:17, fontWeight:800, color:'#111827', margin:0 }}>📥 批量匯入名單</h2>
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
                <p style={{ fontSize:11, color:'#6B7280', margin:0 }}>
                  日期格式支援：YYYY-MM-DD、YYYY/MM/DD、民國年（如 114/7/1）
                </p>
              </div>
            </button>

            {/* 格式說明 */}
            <div style={{ background:'#EFF6FF', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'#1D4ED8', margin:'0 0 4px' }}>💡 日期格式說明</p>
              <p style={{ fontSize:11, color:'#3B82F6', margin:'2px 0' }}>• 跟進日期：2025-07-01 或 2025/7/1 或 114/7/1 都可以</p>
              <p style={{ fontSize:11, color:'#3B82F6', margin:'2px 0' }}>• 生日：06-15 或 6/15 或 06/15 都可以</p>
              <p style={{ fontSize:11, color:'#3B82F6', margin:'2px 0' }}>• Excel 存出的格式會自動轉換，不用特別處理</p>
            </div>

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
                      ⚠️ 發現 {importErrors.length} 個問題，請修正後重新上傳：
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
                          {r.occupation && <span style={{ fontSize:12, color:'#9CA3AF' }}> · {r.occupation}</span>}
                          {r.next_contact_date && <span style={{ fontSize:11, color:'#6B7280', marginLeft:6 }}>📅 {r.next_contact_date}</span>}
                          {r.birthday && <span style={{ fontSize:11, color:'#A855F7', marginLeft:6 }}>🎂 {r.birthday}</span>}
                        </div>
                        {r.egg_type && (
                          <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:6,
                            background:getEggBg(r.egg_type), color:getEggColor(r.egg_type) }}>
                            {r.egg_type}
                          </span>
                        )}
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
            {showArchived ? (
              <button onClick={() => setRestoreTarget(menuTarget)}
                style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                  padding:'14px 16px', borderRadius:12, border:'none',
                  background:'#F0FDF4', marginBottom:10, cursor:'pointer' }}>
                <span style={{ fontSize:20 }}>♻️</span>
                <span style={{ fontSize:15, fontWeight:600, color:'#16A34A' }}>復原到一般名單</span>
              </button>
            ) : (
              <>
                <button onClick={() => handlePin(menuTarget)}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                    padding:'14px 16px', borderRadius:12, border:'none',
                    background:'#FFF7ED', marginBottom:10, cursor:'pointer' }}>
                  <span style={{ fontSize:20 }}>📌</span>
                  <span style={{ fontSize:15, fontWeight:600, color:'#374151' }}>
                    {menuTarget.is_pinned ? '取消釘選' : '釘選到最上面'}
                  </span>
                </button>
                <button onClick={() => setArchiveTarget(menuTarget)}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                    padding:'14px 16px', borderRadius:12, border:'none',
                    background:'#FEF2F2', marginBottom:10, cursor:'pointer' }}>
                  <span style={{ fontSize:20 }}>📦</span>
                  <span style={{ fontSize:15, fontWeight:600, color:'#DC2626' }}>封存</span>
                </button>
              </>
            )}
            <button onClick={() => setMenuTarget(null)}
              style={{ width:'100%', padding:'13px 0', borderRadius:12,
                border:'1px solid #E5E7EB', background:'#fff',
                fontSize:15, color:'#6B7280', cursor:'pointer' }}>取消</button>
          </div>
        </div>
      )}

      {archiveTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, width:280, textAlign:'center' }}>
            <p style={{ fontSize:32, margin:'0 0 8px' }}>📦</p>
            <p style={{ fontSize:16, fontWeight:700, color:'#111827', margin:'0 0 8px' }}>
              確定封存「{archiveTarget.name}」？
            </p>
            <p style={{ fontSize:13, color:'#9CA3AF', margin:'0 0 20px' }}>封存後可點「封存名單」查看與復原</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setArchiveTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1px solid #E5E7EB',
                  background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}>取消</button>
              <button onClick={handleArchive}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none',
                  background:'#DC2626', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>封存</button>
            </div>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, width:280, textAlign:'center' }}>
            <p style={{ fontSize:32, margin:'0 0 8px' }}>♻️</p>
            <p style={{ fontSize:16, fontWeight:700, color:'#111827', margin:'0 0 8px' }}>
              復原「{restoreTarget.name}」？
            </p>
            <p style={{ fontSize:13, color:'#9CA3AF', margin:'0 0 20px' }}>將移回一般互動名單</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setRestoreTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1px solid #E5E7EB',
                  background:'#fff', fontSize:14, cursor:'pointer', color:'#374151' }}>取消</button>
              <button onClick={handleRestore}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none',
                  background:'#16A34A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>復原</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
