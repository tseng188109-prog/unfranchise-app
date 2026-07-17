import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconSearch, IconPlus, IconDownload, IconFileTypeCsv, IconFolder,
  IconPin, IconArchive, IconRefresh, IconUsers, IconX, IconTrash,
} from '@tabler/icons-react'
import ContactPanel from './ContactPanel'

// 設計系統色碼
const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const DANGER = '#E0454A'
const DANGER_SOFT = '#FDE2E2'
const BORDER = '#F0F1F4'
const SUBCARD_BG = '#F5F8FC'

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

// ── 排序/篩選狀態持久化（同分頁內：離開聯絡人詳情頁再回來，排序方式/方向/蛋型篩選會保留）──
function getStoredSortBy() {
  try { return sessionStorage.getItem('contacts_sortBy') || 'default' } catch { return 'default' }
}
function getStoredSortDir() {
  try { return sessionStorage.getItem('contacts_sortDir') || 'desc' } catch { return 'desc' }
}
function getStoredEggFilter() {
  try { return sessionStorage.getItem('contacts_eggFilter') || '全部' } catch { return '全部' }
}

// 判斷目前是否為桌面寬度（≥1024px）：桌面點列表 → 右側面板顯示；手機點列表 → 照舊跳轉整頁
function isDesktopViewport() {
  try { return window.matchMedia('(min-width: 1024px)').matches } catch { return false }
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

  // 任何含 /00 或 -00 或 1900 開頭的都直接丟棄
  if (/\/00|-00|^1900/.test(val)) return ''

  // 已經是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val

  // YYYY/M/D 或 YYYY/MM/DD
  const m1 = val.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (m1) {
    const [, y, mo, d] = m1
    if (mo === '0' || d === '0' || mo === '00' || d === '00') return ''
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // 民國 YYY/M/D
  const m2 = val.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/)
  if (m2) {
    const [, ry, mo, d] = m2
    if (mo === '0' || d === '0' || mo === '00' || d === '00') return ''
    return `${parseInt(ry)+1911}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // YYYY-M-D
  const m3 = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m3) {
    const [, y, mo, d] = m3
    if (mo === '0' || d === '0' || mo === '00' || d === '00') return ''
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
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
  const [eggFilter, setEggFilter] = useState(getStoredEggFilter)
  const [sortBy, setSortBy] = useState(getStoredSortBy) // default | name | last_contact | due
  const [sortDir, setSortDir] = useState(getStoredSortDir) // desc | asc
  const [realLastContact, setRealLastContact] = useState({}) // { contact_id: 'YYYY-MM-DD' }
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuTarget, setMenuTarget] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // 桌面版右側面板：選中的聯絡人 id（手機版不使用，點擊會直接跳轉整頁）
  const [selectedId, setSelectedId] = useState(null)

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
  useEffect(() => { if (user && sortBy === 'last_contact') fetchRealLastContact() }, [user, sortBy])

  // 排序/篩選變動時寫回 sessionStorage，離開頁面再回來會維持原設定
  useEffect(() => { try { sessionStorage.setItem('contacts_sortBy', sortBy) } catch {} }, [sortBy])
  useEffect(() => { try { sessionStorage.setItem('contacts_sortDir', sortDir) } catch {} }, [sortDir])
  useEffect(() => { try { sessionStorage.setItem('contacts_eggFilter', eggFilter) } catch {} }, [eggFilter])

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

  // 「最近互動」排序：直接查 contact_logs 表，取每位聯絡人最新一筆互動紀錄的日期
  async function fetchRealLastContact() {
    const { data } = await supabase
      .from('contact_logs')
      .select('contact_id,date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (!data) return
    const map = {}
    data.forEach(l => {
      if (l.contact_id && !map[l.contact_id]) map[l.contact_id] = l.date
    })
    setRealLastContact(map)
  }

  async function handlePin(c) {
    await supabase.from('contacts').update({ is_pinned: !c.is_pinned }).eq('id', c.id)
    setMenuTarget(null)
    fetchContacts()
  }

  async function handleArchive() {
    if (!archiveTarget) return
    await supabase.from('contacts').update({ is_archived: true }).eq('id', archiveTarget.id)
    if (selectedId === archiveTarget.id) setSelectedId(null)
    setArchiveTarget(null); setMenuTarget(null); fetchContacts()
  }

  async function handleRestore() {
    if (!restoreTarget) return
    await supabase.from('contacts').update({ is_archived: false }).eq('id', restoreTarget.id)
    setRestoreTarget(null); setMenuTarget(null); fetchContacts()
  }

  // 永久刪除：連同底下的互動紀錄、試用品追蹤紀錄一起清掉，避免留下孤兒資料或觸發外鍵限制
  async function handleDeletePermanent() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('contact_logs').delete().eq('contact_id', deleteTarget.id)
    await supabase.from('sample_tracking').delete().eq('contact_id', deleteTarget.id)
    const { error } = await supabase.from('contacts').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) { alert('刪除失敗：' + error.message); return }
    if (selectedId === deleteTarget.id) setSelectedId(null)
    setDeleteTarget(null); setMenuTarget(null); fetchContacts()
  }

  function openContact(c) {
    if (showArchived) return
    if (isDesktopViewport()) {
      setSelectedId(c.id)
    } else {
      navigate(`/contacts/${c.id}`)
    }
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
  // 無法解析就當空值，不報錯
  parsed.next_contact_date = converted || null
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

    console.log('準備插入筆數:', toInsert.length)
    console.log('第一筆資料:', JSON.stringify(toInsert[0]))

    if (toInsert.length > 0) {
      const { data, error } = await supabase.from('contacts').insert(toInsert)
      console.log('insert result:', data)
      console.log('insert error:', JSON.stringify(error))
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

  // 搜尋不分大小寫：兩邊都轉小寫再比對
  const searchLower = search.trim().toLowerCase()
  const filtered = contacts.filter(c => {
    const matchEgg = eggFilter === '全部' || c.egg_type === eggFilter
    const matchSearch = !searchLower
      || (c.name || '').toLowerCase().includes(searchLower)
      || (c.occupation || '').toLowerCase().includes(searchLower)
    return matchEgg && matchSearch
  })

  // 排序函數（依目前選擇 + 方向套用到任一分組陣列）
  function applySort(arr) {
    const dirMul = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'name') {
      // 姓名：asc=A→Z／一→囧, desc=反過來
      return [...arr].sort((a,b) => dirMul * -1 * (a.name||'').localeCompare(b.name||'', 'zh-Hant'))
    }
    if (sortBy === 'last_contact') {
      // 真實最近互動日期（來自 contact_logs），asc=最久遠優先, desc=最近優先
      return [...arr].sort((a,b) => {
        const da = realLastContact[a.id] || ''
        const db = realLastContact[b.id] || ''
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return dirMul * -1 * da.localeCompare(db)
      })
    }
    if (sortBy === 'due') {
      // 建議互動（next_contact_date），asc=最快到期優先, desc=最晚到期優先
      return [...arr].sort((a,b) => {
        if (!a.next_contact_date && !b.next_contact_date) return 0
        if (!a.next_contact_date) return 1
        if (!b.next_contact_date) return -1
        return dirMul * -1 * a.next_contact_date.localeCompare(b.next_contact_date)
      })
    }
    return arr // default：保留原始查詢排序
  }

  const isFlatSort = sortBy === 'last_contact' || sortBy === 'due'

  const pinned = applySort(filtered.filter(c => c.is_pinned))
  const unpinned = filtered.filter(c => !c.is_pinned)

  // 「最近互動」「建議互動」：取消逾期/今天/本週分組，整份通盤排序
  const flatUnpinned = isFlatSort ? applySort(unpinned) : []

  const overdueRaw = unpinned.filter(c => c.next_contact_date && c.next_contact_date < today())
  const dueTodayRaw = unpinned.filter(c => c.next_contact_date === today())
  const thisWeekRaw = unpinned.filter(c => {
    if (!c.next_contact_date || c.next_contact_date <= today()) return false
    const diff = Math.floor((new Date(c.next_contact_date) - new Date(today())) / 86400000)
    return diff <= 7
  })
  const othersRaw = unpinned.filter(c => {
    if (!c.next_contact_date) return true
    const diff = Math.floor((new Date(c.next_contact_date) - new Date(today())) / 86400000)
    return diff > 7
  })
  const overdue = applySort(overdueRaw)
  const dueToday = applySort(dueTodayRaw)
  const thisWeek = applySort(thisWeekRaw)
  const others = applySort(othersRaw)

  function ContactCard({ c }) {
    const isOv = c.next_contact_date && c.next_contact_date < today()
    const isToday = c.next_contact_date === today()
    const isSelected = selectedId === c.id
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
        onClick={() => openContact(c)}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
          background: menuTarget?.id === c.id ? SUBCARD_BG : isSelected ? PRIMARY_SOFT : '#fff',
          borderBottom:`1px solid ${BORDER}`,
          cursor: showArchived ? 'default' : 'pointer', userSelect:'none' }}>
        <Avatar name={c.name} size={42} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            {c.is_pinned && <IconPin size={12} stroke={2} color={TEXT_MUTED} />}
            <span style={{ fontSize:15, fontWeight:700, color: showArchived ? TEXT_MUTED : TEXT_MAIN }}>{c.name}</span>
            {c.egg_type && (
              <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:6,
                background:getEggBg(c.egg_type), color:getEggColor(c.egg_type) }}>
                {c.egg_type}
              </span>
            )}
          </div>
          <div style={{ fontSize:12, color:TEXT_SECONDARY, display:'flex', gap:4 }}>
            {c.occupation && <span>{c.occupation}</span>}
            {c.occupation && c.action_type && <span>·</span>}
            {c.action_type && <span>{c.action_type}</span>}
          </div>
        </div>
        {!showArchived && sortBy === 'last_contact' && (
          <span style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap', color:ACCENT_GREEN_TEXT }}>
            {realLastContact[c.id] ? `互動於 ${realLastContact[c.id].slice(5).replace('-','/')}` : '尚無互動'}
          </span>
        )}
        {!showArchived && sortBy !== 'last_contact' && c.next_contact_date && (
          <span style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap',
            color:isOv?DANGER:isToday?'#9A6A16':TEXT_MUTED }}>
            {formatDue(c.next_contact_date)}
          </span>
        )}
        {showArchived && (
          <span style={{ fontSize:12, color:TEXT_MUTED, whiteSpace:'nowrap' }}>封存中</span>
        )}
      </div>
    )
  }

  function Section({ title, count, items }) {
    if (items.length === 0) return null
    return (
      <div>
        <div style={{ padding:'8px 16px', background:SUBCARD_BG,
          fontSize:12, fontWeight:700, color:TEXT_SECONDARY,
          borderBottom:`1px solid ${BORDER}` }}>
          {title} · {count}人
        </div>
        {items.map(c => <ContactCard key={c.id} c={c} />)}
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
        .contacts-panel-col { display: none; }
        @media (min-width: 1024px) {
          .contacts-body {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            max-width: 1600px;
            margin: 0;
            padding: 16px;
            box-sizing: border-box;
          }
          .contacts-list-col {
            width: 360px;
            flex-shrink: 0;
            border: 1px solid ${BORDER};
            border-radius: 14px;
            overflow-y: auto;
            max-height: calc(100vh - 230px);
          }
          .contacts-panel-col {
            display: block;
            flex: 1;
            min-width: 0;
            border: 1px solid ${BORDER};
            border-radius: 14px;
            overflow-y: auto;
            max-height: calc(100vh - 230px);
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:'#fff', padding:'52px 0 0', borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:TEXT_MAIN, margin:0 }}>互動名單</h1>
          {!showArchived && (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={e => { e.stopPropagation(); setShowImport(true); resetImport() }}
                style={{ width:36, height:36, borderRadius:12, background:ACCENT_GREEN_SOFT,
                  border:'none', color:ACCENT_GREEN_TEXT, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center' }}
                title="CSV 批量匯入"><IconDownload size={17} stroke={1.9} /></button>
              <button onClick={e => { e.stopPropagation(); navigate('/contacts/new') }}
                style={{ width:36, height:36, borderRadius:12, background:PRIMARY,
                  border:'none', color:'#fff', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center' }}><IconPlus size={19} stroke={2} /></button>
            </div>
          )}
        </div>

        <div style={{ position:'relative', marginBottom:12 }}>
          <IconSearch size={16} stroke={1.9} color={TEXT_MUTED}
            style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名、職業..."
            style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:12,
              border:`1px solid ${BORDER}`, fontSize:14, background:SUBCARD_BG, color:TEXT_MAIN,
              boxSizing:'border-box', outline:'none' }} />
        </div>

        <div style={{ display:'flex', gap:8, paddingBottom:12, overflowX:'auto' }}>
          <button onClick={() => { setShowArchived(!showArchived); setEggFilter('全部'); setSearch(''); setSelectedId(null) }}
            style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 14px', borderRadius:99, border:'none',
              background: showArchived ? TEXT_SECONDARY : SUBCARD_BG,
              color: showArchived ? '#fff' : TEXT_SECONDARY,
              fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            <IconArchive size={13} stroke={2} /> {showArchived ? '查看一般' : '封存名單'}
          </button>
          {EGG_FILTERS.map(f => (
            <button key={f} onClick={() => setEggFilter(f)}
              style={{ padding:'5px 14px', borderRadius:99, border:'none',
                background: eggFilter===f ? (showArchived ? TEXT_SECONDARY : PRIMARY) : SUBCARD_BG,
                color: eggFilter===f ? '#fff' : TEXT_SECONDARY,
                fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              {f}
            </button>
          ))}
        </div>

        {!showArchived && (
          <div style={{ display:'flex', gap:8, paddingBottom:12, overflowX:'auto', alignItems:'center' }}>
            <span style={{ fontSize:12, color:TEXT_MUTED, flexShrink:0 }}>排序：</span>
            {[
              { key:'default', label:'預設' },
              { key:'name', label:'姓名' },
              { key:'last_contact', label:'最近互動' },
              { key:'due', label:'建議互動' },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)}
                style={{ padding:'4px 12px', borderRadius:99, border:'none',
                  background: sortBy===s.key ? PRIMARY_SOFT : SUBCARD_BG,
                  color: sortBy===s.key ? PRIMARY : TEXT_MUTED,
                  fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                {s.label}
              </button>
            ))}
            {sortBy !== 'default' && (
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                title={sortDir === 'asc' ? '升冪（點擊切換為降冪）' : '降冪（點擊切換為升冪）'}
                style={{ width:26, height:26, borderRadius:'50%', border:`1px solid ${BORDER}`,
                  background:'#fff', color:TEXT_SECONDARY, fontSize:14, fontWeight:700,
                  cursor:'pointer', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            )}
          </div>
        )}
      </div>
      </div>

      <div className="contacts-body">
        <div className="contacts-list-col">
          {showArchived && (
            <div style={{ background:'#FFF9E9', padding:'10px 16px',
              fontSize:13, color:'#9A6A16', display:'flex', alignItems:'center', gap:6 }}>
              <IconArchive size={15} stroke={1.9} />
              <span>封存名單 · 長按可復原聯絡人</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign:'center', padding:40, color:TEXT_MUTED }}>載入中…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:TEXT_MUTED }}>
              <div style={{ display:'flex',justifyContent:'center',marginBottom:12 }}>
                {showArchived ? <IconArchive size={36} stroke={1.5} /> : <IconUsers size={36} stroke={1.5} />}
              </div>
              <p style={{ fontSize:15 }}>
                {showArchived ? '沒有封存的聯絡人' : '還沒有聯絡人，點 + 新增第一位吧！'}
              </p>
            </div>
          ) : showArchived ? (
            <div style={{ background:'#fff' }}>
              <Section title="封存中" count={filtered.length} items={filtered} />
            </div>
          ) : isFlatSort ? (
            <div style={{ background:'#fff' }}>
              <Section title="釘選" count={pinned.length} items={pinned} />
              <Section
                title={sortBy === 'last_contact' ? '依最近互動排序' : '依建議互動排序'}
                count={flatUnpinned.length}
                items={flatUnpinned}
              />
            </div>
          ) : (
            <div style={{ background:'#fff' }}>
              <Section title="釘選" count={pinned.length} items={pinned} />
              <Section title="逾期" count={overdue.length} items={overdue} />
              <Section title="今天到期" count={dueToday.length} items={dueToday} />
              <Section title="本週到期" count={thisWeek.length} items={thisWeek} />
              <Section title="其他" count={others.length} items={others} />
            </div>
          )}
        </div>

        {/* 桌面版右側面板（CSS 控制只在 ≥1024px 顯示） */}
        <div className="contacts-panel-col">
          {selectedId ? (
            <ContactPanel
              id={selectedId}
              embedded
              onChanged={fetchContacts}
              onArchived={() => { setSelectedId(null); fetchContacts() }}
            />
          ) : (
            <div style={{ height:400, display:'flex', alignItems:'center', justifyContent:'center',
              color:TEXT_MUTED, fontSize:13 }}>
              選擇左側聯絡人查看詳情
            </div>
          )}
        </div>
      </div>

      {/* ── CSV 匯入 Modal ───────────────────────────── */}
      {showImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.5)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:400 }}
          onClick={() => { setShowImport(false); resetImport() }}>
          <div style={{ background:'#fff', borderRadius:'22px 22px 0 0',
            padding:'24px 20px 40px', width:'100%', maxWidth:480,
            maxHeight:'85vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:TEXT_MAIN, margin:0 }}>批量匯入名單</h2>
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
                <p style={{ fontSize:11, color:TEXT_SECONDARY, margin:0 }}>
                  日期格式支援：YYYY-MM-DD、YYYY/MM/DD、民國年（如 114/7/1）
                </p>
              </div>
            </button>

            {/* 格式說明 */}
            <div style={{ background:PRIMARY_SOFT, borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
              <p style={{ fontSize:12, fontWeight:700, color:PRIMARY, margin:'0 0 4px' }}>日期格式說明</p>
              <p style={{ fontSize:11, color:'#4A7BC8', margin:'2px 0' }}>• 跟進日期：2025-07-01 或 2025/7/1 或 114/7/1 都可以</p>
              <p style={{ fontSize:11, color:'#4A7BC8', margin:'2px 0' }}>• 生日：06-15 或 6/15 或 06/15 都可以</p>
              <p style={{ fontSize:11, color:'#4A7BC8', margin:'2px 0' }}>• Excel 存出的格式會自動轉換，不用特別處理</p>
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
                      發現 {importErrors.length} 個問題，請修正後重新上傳：
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
                          {r.occupation && <span style={{ fontSize:12, color:TEXT_MUTED }}> · {r.occupation}</span>}
                          {r.next_contact_date && <span style={{ fontSize:11, color:TEXT_SECONDARY, marginLeft:6 }}>{r.next_contact_date}</span>}
                          {r.birthday && <span style={{ fontSize:11, color:'#A855F7', marginLeft:6 }}>{r.birthday}</span>}
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

      {/* 長按選單 Modal */}
      {menuTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200 }}
          onClick={() => setMenuTarget(null)}>
          <div style={{ background:'#fff', borderRadius:'22px 22px 0 0',
            padding:'20px 16px 36px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN,
              margin:'0 0 16px', textAlign:'center' }}>{menuTarget.name}</p>
            {showArchived ? (
              <>
                <button onClick={() => setRestoreTarget(menuTarget)}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                    padding:'14px 16px', borderRadius:14, border:'none',
                    background:ACCENT_GREEN_SOFT, marginBottom:10, cursor:'pointer' }}>
                  <IconRefresh size={19} stroke={1.9} color={ACCENT_GREEN_TEXT} />
                  <span style={{ fontSize:15, fontWeight:600, color:ACCENT_GREEN_TEXT }}>復原到一般名單</span>
                </button>
                <button onClick={() => setDeleteTarget(menuTarget)}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                    padding:'14px 16px', borderRadius:14, border:'none',
                    background:DANGER_SOFT, marginBottom:10, cursor:'pointer' }}>
                  <IconTrash size={19} stroke={1.9} color={DANGER} />
                  <span style={{ fontSize:15, fontWeight:600, color:DANGER }}>永久刪除</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => handlePin(menuTarget)}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                    padding:'14px 16px', borderRadius:14, border:'none',
                    background:SUBCARD_BG, marginBottom:10, cursor:'pointer' }}>
                  <IconPin size={19} stroke={1.9} color={TEXT_MAIN} />
                  <span style={{ fontSize:15, fontWeight:600, color:TEXT_MAIN }}>
                    {menuTarget.is_pinned ? '取消釘選' : '釘選到最上面'}
                  </span>
                </button>
                <button onClick={() => setArchiveTarget(menuTarget)}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                    padding:'14px 16px', borderRadius:14, border:'none',
                    background:DANGER_SOFT, marginBottom:10, cursor:'pointer' }}>
                  <IconArchive size={19} stroke={1.9} color={DANGER} />
                  <span style={{ fontSize:15, fontWeight:600, color:DANGER }}>封存</span>
                </button>
              </>
            )}
            <button onClick={() => setMenuTarget(null)}
              style={{ width:'100%', padding:'13px 0', borderRadius:14,
                border:`1px solid ${BORDER}`, background:'#fff',
                fontSize:15, color:TEXT_SECONDARY, cursor:'pointer' }}>取消</button>
          </div>
        </div>
      )}

      {archiveTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:24, width:280, textAlign:'center' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:8 }}>
              <IconArchive size={30} stroke={1.6} color={DANGER} />
            </div>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:'0 0 8px' }}>
              確定封存「{archiveTarget.name}」？
            </p>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'0 0 20px' }}>封存後可點「封存名單」查看與復原</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setArchiveTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:`1px solid ${BORDER}`,
                  background:'#fff', fontSize:14, cursor:'pointer', color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleArchive}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none',
                  background:DANGER, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>封存</button>
            </div>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:24, width:280, textAlign:'center' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:8 }}>
              <IconRefresh size={30} stroke={1.6} color={ACCENT_GREEN_TEXT} />
            </div>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:'0 0 8px' }}>
              復原「{restoreTarget.name}」？
            </p>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'0 0 20px' }}>將移回一般互動名單</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setRestoreTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:`1px solid ${BORDER}`,
                  background:'#fff', fontSize:14, cursor:'pointer', color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleRestore}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none',
                  background:ACCENT_GREEN, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>復原</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:24, width:300, textAlign:'center' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:8 }}>
              <IconTrash size={30} stroke={1.6} color={DANGER} />
            </div>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:'0 0 8px' }}>
              確定永久刪除「{deleteTarget.name}」？
            </p>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'0 0 20px' }}>
              會一併刪除他的互動紀錄與試用品追蹤紀錄，此動作無法復原
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:`1px solid ${BORDER}`,
                  background:'#fff', fontSize:14, cursor:'pointer', color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleDeletePermanent} disabled={deleting}
                style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none',
                  background:DANGER, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                {deleting ? '刪除中…' : '永久刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
