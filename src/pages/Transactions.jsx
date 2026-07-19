import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconSearch, IconPlus, IconDownload, IconFileTypeCsv, IconFolder,
  IconDotsVertical, IconPencil, IconTrash, IconX, IconGift, IconChartBar,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'

// 設計系統色碼
const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_YELLOW = '#FFD166'
const ACCENT_YELLOW_SOFT = '#FFF7E6'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
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
function formatShortDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}

import { parseCSV, parseDate, normalizePhone } from './csvUtils'

const TRANSACTIONS_TEMPLATE = `date,customer_name,customer_phone,product_name,type,points,amount,cost,is_gift
2025-06-01,王小明,0912345678,ISOTONIX OPC-3,BV,100,3200,2800,false
2025-06-02,李美玲,0923456789,TLS 代餐,IBV,50,1500,1200,false
2025-06-03,張大偉,,試用組合,BV,0,0,500,true`
// ─────────────────────────────────────────────────────

const TYPE_FILTERS = ['全部', 'BV', 'IBV']

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

  // 搜尋（手機版透過 searchMode 切換輸入框顯示；桌面版輸入框常駐，直接綁 searchQuery）
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef(null)

  // 類型篩選（桌面版常駐篩選列使用；手機版目前不顯示，不影響手機行為）
  const [typeFilter, setTypeFilter] = useState('全部')

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
  useEffect(() => {
    if (searchMode && searchInputRef.current) searchInputRef.current.focus()
  }, [searchMode])

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

  // 搜尋：打字後即時查詢（不再綁 searchMode，桌面版常駐輸入框可以直接觸發）
  useEffect(() => {
    if (!user) return
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(() => doSearch(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, user])

  async function doSearch(q) {
    setSearching(true)
    // 同時搜尋 customer_name 欄位和 product_name 欄位
    const { data: byProduct } = await supabase.from('transactions')
      .select('*,customers(name)')
      .eq('user_id', user.id)
      .ilike('product_name', `%${q}%`)
      .order('date', { ascending: false })
      .limit(50)

    const { data: byCustomerName } = await supabase.from('transactions')
      .select('*,customers(name)')
      .eq('user_id', user.id)
      .ilike('customer_name', `%${q}%`)
      .order('date', { ascending: false })
      .limit(50)

    // 合併去重
    const merged = [...(byProduct||[]), ...(byCustomerName||[])]
    const seen = new Set()
    const unique = merged.filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id); return true
    })
    // 按日期排序
    unique.sort((a,b) => b.date.localeCompare(a.date))
    setSearchResults(unique)
    setSearching(false)
  }

  function enterSearch() {
    setSearchMode(true)
    setSearchQuery('')
    setSearchResults([])
  }

  function exitSearch() {
    setSearchMode(false)
    setSearchQuery('')
    setSearchResults([])
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
    setDeleteTarget(null)
    fetchData()
    if (searchQuery.trim()) doSearch(searchQuery.trim())
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
    setSaving(false); setEditTarget(null)
    fetchData()
    if (searchQuery.trim()) doSearch(searchQuery.trim())
  }

  // ── CSV 匯入邏輯 ──────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rawRows = parseCSV(ev.target.result)
        .filter(r => r.date && r.product_name && r.type && r.points)
      const errors = []
      const rows = rawRows.map((r, i) => {
        const parsed = { ...r }
        const rawDate = r.date || ''
        if (rawDate) {
          const converted = parseDate(rawDate)
          if (!converted) errors.push(`第${i+2}行「${r.product_name}」：無法識別日期「${rawDate}」`)
          else parsed.date = converted
        }
        if (!r.product_name) errors.push(`第${i+2}行：缺少品名`)
        if (!['BV','IBV'].includes(r.type))
          errors.push(`第${i+2}行「${r.product_name}」：類型應為 BV 或 IBV`)
        if (!r.points || isNaN(Number(r.points)))
          errors.push(`第${i+2}行「${r.product_name}」：點數應為數字`)
        return parsed
      })
      setImportRows(rows); setImportErrors(errors); setImportDone(null)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  async function handleImport() {
    if (!importRows.length || importErrors.length) return
    setImporting(true)
    const { data: custList } = await supabase
      .from('customers').select('id,name,phone').eq('user_id', user.id)
    const phoneMap = {}, nameMap = {}
    ;(custList||[]).forEach(c => {
      if (c.phone) phoneMap[normalizePhone(c.phone)] = c.id
      nameMap[c.name] = c.id
    })
    const toCreateCusts = []
    importRows.forEach(r => {
      if (!r.customer_name) return
      const phone = normalizePhone(r.customer_phone)
      if (!phoneMap[phone] && !nameMap[r.customer_name]) {
        if (!toCreateCusts.find(c => c.name === r.customer_name)) {
          toCreateCusts.push({ user_id: user.id, name: r.customer_name,
            phone: normalizePhone(r.customer_phone) || null, is_pinned: false })
        }
      }
    })
    if (toCreateCusts.length > 0) {
      const { data: newCusts } = await supabase.from('customers').insert(toCreateCusts).select('id,name,phone')
      ;(newCusts||[]).forEach(c => {
        if (c.phone) phoneMap[normalizePhone(c.phone)] = c.id
        nameMap[c.name] = c.id
      })
    }
    const toInsert = importRows.map(r => {
      const phone = normalizePhone(r.customer_phone)
      const customerId = (phone && phoneMap[phone]) || (r.customer_name && nameMap[r.customer_name]) || null
      return {
        user_id: user.id, customer_id: customerId, date: r.date,
        product_name: r.product_name, type: r.type, points: Number(r.points),
        amount: r.amount ? Number(r.amount) : 0, cost: r.cost ? Number(r.cost) : 0,
        is_gift: r.is_gift === 'true' || r.is_gift === '1',
      }
    })
    await supabase.from('transactions').insert(toInsert)
    setImporting(false); setImportDone({ success: toInsert.length, skip: 0 }); fetchData()
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + TRANSACTIONS_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = '業績紀錄範本.csv'; a.click(); URL.revokeObjectURL(url)
  }
  function resetImport() { setImportRows([]); setImportErrors([]); setImportDone(null) }
  // ─────────────────────────────────────────────────

  const maxVal = Math.max(...chartData.map(d => Math.max(d.bv, d.ibv)), 1)
  const chartHeight = 80
  const desktopChartHeight = 130
  const isSearching = searchQuery.trim().length > 0
  const displayList = searchMode ? searchResults : transactions // 手機版沿用原本邏輯
  const desktopBaseList = isSearching ? searchResults : transactions
  const desktopList = desktopBaseList.filter(t => typeFilter === '全部' || t.type === typeFilter)

  function TxRow({ t, dense }) {
    const name = t.customers?.name || t.customer_name || '未知顧客'
    const margin = (t.amount||0) - (t.cost||0)
    return (
      <div key={t.id} style={{ display:'flex',alignItems:'center',gap:12,
        padding:'12px 16px',borderBottom:`1px solid ${BORDER}`,position:'relative' }}>
        <div style={{ width:40,height:40,borderRadius:'50%',
          background: t.is_gift ? '#F0F1F4' : avatarBg(name),
          display:'flex',alignItems:'center',justifyContent:'center',
          color: t.is_gift ? TEXT_SECONDARY : '#fff',fontWeight:700,fontSize:15,flexShrink:0 }}>
          {t.is_gift ? <IconGift size={17} stroke={1.9} /> : name[0]}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
            <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>{name}</span>
            <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:6,
              background:t.type==='BV'?ACCENT_YELLOW_SOFT:PRIMARY_SOFT,
              color:t.type==='BV'?ACCENT_YELLOW_TEXT:PRIMARY }}>{t.type}</span>
          </div>
          <p style={{ fontSize:12,color:TEXT_MUTED,margin:'2px 0 0' }}>
            {t.product_name} · {dense ? formatDate(t.date) : formatShortDate(t.date)}
          </p>
        </div>
        <div style={{ textAlign:'right',flexShrink:0 }}>
          <p style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN,margin:0 }}>
            {Number(t.points).toFixed(0)} 點
          </p>
          <p style={{ fontSize:12,margin:'2px 0 0',
            color: t.is_gift ? TEXT_SECONDARY : margin >= 0 ? ACCENT_GREEN_TEXT : DANGER }}>
            {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${margin.toLocaleString()}`}
          </p>
        </div>
        <button onClick={e => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id) }}
          style={{ background:'none',border:'none',cursor:'pointer',
            color:TEXT_MUTED,padding:'4px 6px',marginLeft:4,flexShrink:0 }}><IconDotsVertical size={17} stroke={1.9} /></button>
        {menuId === t.id && (
          <div onClick={e => e.stopPropagation()}
            style={{ position:'absolute',right:12,top:44,background:'#fff',
              borderRadius:12,boxShadow:'0 4px 20px rgba(19,42,77,0.13)',
              zIndex:100,overflow:'hidden',minWidth:110 }}>
            <button onClick={() => openEdit(t)}
              style={{ display:'flex',alignItems:'center',gap:8,width:'100%',padding:'11px 16px',
                background:'none',border:'none',textAlign:'left',
                fontSize:14,color:TEXT_MAIN,cursor:'pointer' }}><IconPencil size={15} stroke={1.9} /> 編輯</button>
            <button onClick={() => { setMenuId(null); setDeleteTarget(t.id) }}
              style={{ display:'flex',alignItems:'center',gap:8,width:'100%',padding:'11px 16px',
                background:'none',border:'none',textAlign:'left',
                fontSize:14,color:DANGER,cursor:'pointer' }}><IconTrash size={15} stroke={1.9} /> 刪除</button>
          </div>
        )}
      </div>
    )
  }

  function DesktopChart({ height }) {
    return (
      <div style={{ display:'flex',alignItems:'flex-end',gap:2,height,overflowX:'auto' }}>
        {chartData.map(d => (
          <div key={d.day} style={{ display:'flex',flexDirection:'column',alignItems:'center',
            gap:1,minWidth:10,flex:1 }}>
            <div style={{ width:'100%',display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'flex-end',height:height-18 }}>
              {d.bv > 0 && (
                <div style={{ width:'100%',background:ACCENT_YELLOW,borderRadius:'2px 2px 0 0',
                  height:`${Math.max(2,(d.bv/maxVal)*(height-18))}px` }} />
              )}
              {d.ibv > 0 && (
                <div style={{ width:'100%',background:PRIMARY,borderRadius:'2px 2px 0 0',
                  height:`${Math.max(2,(d.ibv/maxVal)*(height-18))}px`,marginTop:1 }} />
              )}
              {d.bv === 0 && d.ibv === 0 && (
                <div style={{ width:'100%',height:2,background:BORDER,borderRadius:2 }} />
              )}
            </div>
            <span style={{ fontSize:10,color:TEXT_MUTED,lineHeight:1 }}>
              {d.day % 5 === 1 ? d.day : ''}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background:'#fff',minHeight:'100vh',paddingBottom:80 }}
      onClick={() => setMenuId(null)}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
        .tx-desktop-wrap { display: none; }
        .tx-mobile-list { display: block; }
        .tx-desktop-table-wrap { display: none; }
        @media (min-width: 1024px) {
          .tx-mobile-header { display: none; }
          .tx-mobile-list { display: none; }
          .tx-desktop-wrap {
            display: block;
            max-width: 1600px;
            margin: 0;
            padding: 24px 24px 0;
            box-sizing: border-box;
          }
          .tx-desktop-table-wrap {
            display: block;
            max-width: 1600px;
            margin: 0;
            padding: 0 24px;
            box-sizing: border-box;
          }
        }
      `}</style>

      {/* ── 手機版 Header（維持原邏輯不變，桌面版隱藏） ── */}
      <div className="tx-mobile-header" style={{ background:'#fff',padding:'52px 0 16px',borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px' }}>

        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <h1 style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>業績紀錄</h1>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={searchMode ? exitSearch : enterSearch}
              style={{ width:36,height:36,borderRadius:12,
                background: searchMode ? PRIMARY : PRIMARY_SOFT,
                border: 'none',
                color: searchMode ? '#fff' : PRIMARY,
                cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}
              title="搜尋"><IconSearch size={16} stroke={1.9} /></button>
            <button onClick={e => { e.stopPropagation(); setShowImport(true); resetImport() }}
              style={{ width:36,height:36,borderRadius:12,background:ACCENT_GREEN_SOFT,
                border:'none',color:ACCENT_GREEN_TEXT,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}
              title="CSV 批量匯入"><IconDownload size={17} stroke={1.9} /></button>
            <button onClick={() => navigate('/transactions/new')}
              style={{ width:36,height:36,borderRadius:12,background:PRIMARY,
                border:'none',color:'#fff',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center' }}><IconPlus size={19} stroke={2} /></button>
          </div>
        </div>

        {searchMode && (
          <div style={{ display:'flex',gap:8,marginBottom:12 }}>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋顧客姓名或產品名稱…"
              style={{ flex:1,padding:'9px 14px',borderRadius:12,
                border:`1.5px solid ${PRIMARY}`,fontSize:14,outline:'none',
                color:TEXT_MAIN,background:PRIMARY_SOFT }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                style={{ padding:'0 12px',borderRadius:12,border:`1px solid ${BORDER}`,
                  background:'#fff',fontSize:13,color:TEXT_SECONDARY,cursor:'pointer' }}>
                清除
              </button>
            )}
          </div>
        )}

        {!searchMode && (
          <>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginBottom:12 }}>
              <button onClick={prevMonth}
                style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:TEXT_SECONDARY }}>‹</button>
              <span style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN }}>{year} 年 {month} 月</span>
              <button onClick={nextMonth}
                style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:TEXT_SECONDARY }}>›</button>
            </div>

            <div style={{ display:'flex',gap:10,marginBottom:8 }}>
              <div style={{ flex:1,background:ACCENT_YELLOW_SOFT,borderRadius:14,padding:'12px' }}>
                <p style={{ fontSize:11,fontWeight:700,color:ACCENT_YELLOW_TEXT,margin:'0 0 4px' }}>BV</p>
                <p style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>{bvTotal.toFixed(0)}</p>
              </div>
              <div style={{ flex:1,background:PRIMARY_SOFT,borderRadius:14,padding:'12px' }}>
                <p style={{ fontSize:11,fontWeight:700,color:PRIMARY,margin:'0 0 4px' }}>IBV</p>
                <p style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>{ibvTotal.toFixed(0)}</p>
              </div>
              <div style={{ flex:1,background:ACCENT_GREEN_SOFT,borderRadius:14,padding:'12px' }}>
                <p style={{ fontSize:11,fontWeight:700,color:ACCENT_GREEN_TEXT,margin:'0 0 4px' }}>獲利</p>
                <p style={{ fontSize:18,fontWeight:700,color:ACCENT_GREEN_TEXT,margin:0 }}>NT${profit.toLocaleString()}</p>
              </div>
            </div>
            {giftCost > 0 && (
              <p style={{ fontSize:12,color:ACCENT_YELLOW_TEXT,textAlign:'right',margin:'0 0 8px' }}>
                贈品成本：-NT${giftCost.toLocaleString()}
              </p>
            )}

            {chartData.length > 0 && chartData.some(d => d.bv > 0 || d.ibv > 0) && (
              <div style={{ background:SUBCARD_BG,borderRadius:14,padding:'12px 8px 8px',marginTop:4 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:TEXT_SECONDARY }}>每日點數趨勢</span>
                  <div style={{ display:'flex',gap:10 }}>
                    <span style={{ fontSize:11,color:ACCENT_YELLOW_TEXT,display:'flex',alignItems:'center',gap:3 }}>
                      <span style={{ width:8,height:8,borderRadius:2,background:ACCENT_YELLOW,display:'inline-block' }}/>BV
                    </span>
                    <span style={{ fontSize:11,color:PRIMARY,display:'flex',alignItems:'center',gap:3 }}>
                      <span style={{ width:8,height:8,borderRadius:2,background:PRIMARY,display:'inline-block' }}/>IBV
                    </span>
                  </div>
                </div>
                <DesktopChart height={chartHeight} />
              </div>
            )}
          </>
        )}

        {searchMode && (
          <div style={{ fontSize:13,color:TEXT_SECONDARY,padding:'4px 0' }}>
            {searching ? '搜尋中…' :
             !searchQuery.trim() ? '輸入關鍵字開始搜尋' :
             `找到 ${searchResults.length} 筆結果`}
          </div>
        )}
      </div>
      </div>

      {/* ── 桌面版常駐 Header：篩選列 + 4 張 KPI 卡 + 放大版圖表 ── */}
      <div className="tx-desktop-wrap">
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10 }}>
          <div style={{ display:'flex',alignItems:'center',gap:14 }}>
            <h1 style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>業績紀錄</h1>
            <div style={{ display:'flex',alignItems:'center',gap:8,background:SUBCARD_BG,borderRadius:10,padding:'4px 10px' }}>
              <button onClick={prevMonth}
                style={{ background:'none',border:'none',fontSize:16,cursor:'pointer',color:TEXT_SECONDARY }}>‹</button>
              <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>{year} 年 {month} 月</span>
              <button onClick={nextMonth}
                style={{ background:'none',border:'none',fontSize:16,cursor:'pointer',color:TEXT_SECONDARY }}>›</button>
            </div>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <IconSearch size={14} stroke={1.9} color={TEXT_MUTED}
                style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)' }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜尋顧客或品項"
                style={{ padding:'8px 12px 8px 30px',borderRadius:10,border:`1px solid ${BORDER}`,
                  fontSize:13,background:SUBCARD_BG,color:TEXT_MAIN,outline:'none',width:180,boxSizing:'border-box' }} />
            </div>
            {TYPE_FILTERS.map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                style={{ padding:'7px 14px',borderRadius:99,border:'none',fontSize:12,fontWeight:700,cursor:'pointer',
                  background: typeFilter===f ? (f==='BV'?ACCENT_YELLOW_SOFT:f==='IBV'?PRIMARY_SOFT:PRIMARY) : SUBCARD_BG,
                  color: typeFilter===f ? (f==='BV'?ACCENT_YELLOW_TEXT:f==='IBV'?PRIMARY:'#fff') : TEXT_SECONDARY }}>
                {f}
              </button>
            ))}
            <button onClick={() => { setShowImport(true); resetImport() }}
              style={{ padding:'8px 14px',borderRadius:10,border:'none',background:ACCENT_GREEN_SOFT,
                color:ACCENT_GREEN_TEXT,fontSize:12,fontWeight:700,cursor:'pointer',
                display:'flex',alignItems:'center',gap:6 }}>
              <IconDownload size={14} stroke={1.9} /> 匯入
            </button>
            <button onClick={() => navigate('/transactions/new')}
              style={{ padding:'8px 16px',borderRadius:10,border:'none',background:PRIMARY,
                color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
              + 新增
            </button>
          </div>
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16 }}>
          <div style={{ background:ACCENT_YELLOW_SOFT,borderRadius:12,padding:'12px 14px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:ACCENT_YELLOW_TEXT,margin:'0 0 4px' }}>BV</p>
            <p style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>{bvTotal.toFixed(0)}</p>
          </div>
          <div style={{ background:PRIMARY_SOFT,borderRadius:12,padding:'12px 14px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:PRIMARY,margin:'0 0 4px' }}>IBV</p>
            <p style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>{ibvTotal.toFixed(0)}</p>
          </div>
          <div style={{ background:ACCENT_GREEN_SOFT,borderRadius:12,padding:'12px 14px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:ACCENT_GREEN_TEXT,margin:'0 0 4px' }}>獲利</p>
            <p style={{ fontSize:20,fontWeight:700,color:ACCENT_GREEN_TEXT,margin:0 }}>NT${profit.toLocaleString()}</p>
          </div>
          <div style={{ background:SUBCARD_BG,borderRadius:12,padding:'12px 14px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:TEXT_SECONDARY,margin:'0 0 4px' }}>贈品成本</p>
            <p style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>-NT${giftCost.toLocaleString()}</p>
          </div>
        </div>

        {chartData.length > 0 && chartData.some(d => d.bv > 0 || d.ibv > 0) && (
          <div style={{ background:SUBCARD_BG,borderRadius:14,padding:'14px 14px 10px',marginBottom:16 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:700,color:TEXT_SECONDARY }}>每日點數趨勢</span>
              <div style={{ display:'flex',gap:12 }}>
                <span style={{ fontSize:12,color:ACCENT_YELLOW_TEXT,display:'flex',alignItems:'center',gap:4 }}>
                  <span style={{ width:9,height:9,borderRadius:2,background:ACCENT_YELLOW,display:'inline-block' }}/>BV
                </span>
                <span style={{ fontSize:12,color:PRIMARY,display:'flex',alignItems:'center',gap:4 }}>
                  <span style={{ width:9,height:9,borderRadius:2,background:PRIMARY,display:'inline-block' }}/>IBV
                </span>
              </div>
            </div>
            <DesktopChart height={desktopChartHeight} />
          </div>
        )}
      </div>

      {/* ── 手機版清單（維持原邏輯不變，桌面版隱藏） ── */}
      <div className="dash-container tx-mobile-list">
      {!searchMode && loading ? (
        <LoadingSpinner fullPage={false} />
      ) : !searchMode && transactions.length === 0 ? (
        <div style={{ textAlign:'center',padding:60,color:TEXT_MUTED }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:12 }}><IconChartBar size={36} stroke={1.5} /></div>
          <p style={{ fontSize:15 }}>這個月還沒有業績紀錄，點 + 開始新增！</p>
        </div>
      ) : searchMode && !searchQuery.trim() ? (
        <div style={{ textAlign:'center',padding:60,color:TEXT_MUTED }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:12 }}><IconSearch size={36} stroke={1.5} /></div>
          <p style={{ fontSize:15 }}>輸入顧客姓名或產品名稱</p>
        </div>
      ) : searchMode && searching ? (
        <div style={{ textAlign:'center',padding:40,color:TEXT_MUTED }}>搜尋中…</div>
      ) : searchMode && searchResults.length === 0 && searchQuery.trim() ? (
        <div style={{ textAlign:'center',padding:60,color:TEXT_MUTED }}>
          <p style={{ fontSize:15 }}>找不到「{searchQuery}」的紀錄</p>
        </div>
      ) : (
        <div style={{ margin:'8px 0',background:'#fff' }}>
          {displayList.map(t => <TxRow key={t.id} t={t} dense={searchMode} />)}
        </div>
      )}
      </div>

      {/* ── 桌面版表格 ── */}
      <div className="tx-desktop-table-wrap">
        {loading && !isSearching ? (
          <LoadingSpinner fullPage={false} />
        ) : desktopList.length === 0 ? (
          <div style={{ textAlign:'center',padding:60,color:TEXT_MUTED,border:`1px solid ${BORDER}`,borderRadius:14 }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:12 }}><IconChartBar size={36} stroke={1.5} /></div>
            <p style={{ fontSize:15 }}>{isSearching ? `找不到「${searchQuery}」的紀錄` : '這個月還沒有業績紀錄，點「+ 新增」開始記錄！'}</p>
          </div>
        ) : (
          <table style={{ width:'100%',borderCollapse:'collapse',border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${BORDER}`,background:SUBCARD_BG }}>
                <th style={thStyle}>日期</th>
                <th style={thStyle}>顧客</th>
                <th style={thStyle}>品項</th>
                <th style={thStyle}>類型</th>
                <th style={{ ...thStyle, textAlign:'right' }}>點數</th>
                <th style={{ ...thStyle, textAlign:'right' }}>獲利</th>
                <th style={{ ...thStyle, textAlign:'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {desktopList.map((t, i) => {
                const name = t.customers?.name || t.customer_name || '未知顧客'
                const margin = (t.amount||0) - (t.cost||0)
                return (
                  <tr key={t.id} style={{ borderBottom:`1px solid ${BORDER}`, background: i%2===1 ? '#FAFBFD' : '#fff' }}>
                    <td style={tdStyle}>{formatDate(t.date)}</td>
                    <td style={{ ...tdStyle, fontWeight:600, color:TEXT_MAIN }}>{name}</td>
                    <td style={tdStyle}>
                      {t.product_name}
                      {t.is_gift && <span style={{ marginLeft:6,fontSize:11,color:TEXT_MUTED }}>🎁贈品</span>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                        background:t.type==='BV'?ACCENT_YELLOW_SOFT:PRIMARY_SOFT,
                        color:t.type==='BV'?ACCENT_YELLOW_TEXT:PRIMARY }}>{t.type}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign:'right' }}>{Number(t.points).toFixed(0)}</td>
                    <td style={{ ...tdStyle, textAlign:'right',
                      color: t.is_gift ? TEXT_MUTED : margin >= 0 ? ACCENT_GREEN_TEXT : DANGER, fontWeight:600 }}>
                      {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${margin.toLocaleString()}`}
                    </td>
                    <td style={{ ...tdStyle, textAlign:'center' }}>
                      <button onClick={() => openEdit(t)}
                        style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED,marginRight:10,display:'inline-flex' }}>
                        <IconPencil size={15} stroke={1.9} />
                      </button>
                      <button onClick={() => setDeleteTarget(t.id)}
                        style={{ background:'none',border:'none',cursor:'pointer',color:DANGER,display:'inline-flex' }}>
                        <IconTrash size={15} stroke={1.9} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{ height:40 }} />
      </div>

      {/* CSV 匯入 Modal */}
      {showImport && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.5)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:400 }}
          onClick={() => { setShowImport(false); resetImport() }}>
          <div style={{ background:'#fff',borderRadius:'22px 22px 0 0',
            padding:'24px 20px 40px',width:'100%',maxWidth:480,
            maxHeight:'85vh',overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:700,color:TEXT_MAIN,margin:0 }}>批量匯入業績</h2>
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED }}><IconX size={22} /></button>
            </div>
            <button onClick={downloadTemplate}
              style={{ display:'flex',alignItems:'center',gap:10,width:'100%',
                padding:'12px 16px',borderRadius:14,border:`1px dashed ${ACCENT_GREEN}`,
                background:ACCENT_GREEN_SOFT,marginBottom:16,cursor:'pointer' }}>
              <IconFileTypeCsv size={20} stroke={1.8} color={ACCENT_GREEN_TEXT} />
              <div style={{ textAlign:'left' }}>
                <p style={{ fontSize:13,fontWeight:700,color:ACCENT_GREEN_TEXT,margin:0 }}>下載 CSV 範本</p>
                <p style={{ fontSize:11,color:TEXT_SECONDARY,margin:0 }}>date, customer_name, customer_phone, product_name, type, points, amount, cost, is_gift</p>
              </div>
            </button>
            <div style={{ background:ACCENT_YELLOW_SOFT,borderRadius:12,padding:'10px 14px',marginBottom:16 }}>
              <p style={{ fontSize:12,color:'#8A5A16',margin:0,lineHeight:1.6 }}>
                <strong>日期</strong> 支援 YYYY-MM-DD、YYYY/MM/DD、民國年<br/>
                <strong>customer_phone</strong> 填手機號碼，優先用電話配對顧客<br/>
                <strong>is_gift</strong> 填 true/false<br/>
                電話開頭的 0 被 Excel 吃掉沒關係，系統會自動補回
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv"
              onChange={handleFileChange} style={{ display:'none' }} />
            <button onClick={() => fileInputRef.current.click()}
              style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                width:'100%',padding:'13px 0',borderRadius:14,
                border:`1px solid ${BORDER}`,background:SUBCARD_BG,
                fontSize:14,fontWeight:600,color:TEXT_MAIN,cursor:'pointer',marginBottom:16 }}>
              <IconFolder size={17} stroke={1.9} /> 選擇 CSV 檔案
            </button>
            {importRows.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN,margin:'0 0 8px' }}>
                  偵測到 {importRows.length} 筆資料
                </p>
                {importErrors.length > 0 && (
                  <div style={{ background:DANGER_SOFT,borderRadius:12,padding:'10px 14px',marginBottom:10 }}>
                    <p style={{ fontSize:12,fontWeight:700,color:DANGER,margin:'0 0 4px' }}>
                      發現 {importErrors.length} 個問題：
                    </p>
                    {importErrors.map((e,i) => (
                      <p key={i} style={{ fontSize:12,color:DANGER,margin:'2px 0' }}>• {e}</p>
                    ))}
                  </div>
                )}
                {importErrors.length === 0 && (
                  <div style={{ border:`1px solid ${BORDER}`,borderRadius:12,overflow:'hidden',marginBottom:12 }}>
                    {importRows.slice(0,5).map((r,i) => (
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:10,
                        padding:'9px 14px',borderBottom:i<Math.min(importRows.length,5)-1?`1px solid ${BORDER}`:'none',
                        background:i%2===0?'#fff':SUBCARD_BG }}>
                        <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:6,
                          background:r.type==='BV'?ACCENT_YELLOW_SOFT:PRIMARY_SOFT,
                          color:r.type==='BV'?ACCENT_YELLOW_TEXT:PRIMARY,flexShrink:0 }}>{r.type}</span>
                        <div style={{ flex:1,minWidth:0 }}>
                          <span style={{ fontSize:13,fontWeight:700,color:TEXT_MAIN }}>{r.product_name}</span>
                          {r.customer_name && <span style={{ fontSize:12,color:TEXT_MUTED }}> · {r.customer_name}</span>}
                        </div>
                        <div style={{ textAlign:'right',flexShrink:0 }}>
                          <span style={{ fontSize:13,fontWeight:700,color:TEXT_SECONDARY }}>{r.points}點</span>
                          <span style={{ fontSize:11,color:TEXT_MUTED,display:'block' }}>{r.date}</span>
                        </div>
                      </div>
                    ))}
                    {importRows.length > 5 && (
                      <div style={{ padding:'8px 14px',background:SUBCARD_BG,
                        fontSize:12,color:TEXT_MUTED,textAlign:'center' }}>
                        …還有 {importRows.length - 5} 筆
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {importDone && (
              <div style={{ background:ACCENT_GREEN_SOFT,borderRadius:12,padding:'12px 16px',marginBottom:16 }}>
                <p style={{ fontSize:14,fontWeight:700,color:ACCENT_GREEN_TEXT,margin:0 }}>
                  匯入完成！成功 {importDone.success} 筆
                </p>
              </div>
            )}
            {importRows.length > 0 && importErrors.length === 0 && !importDone && (
              <button onClick={handleImport} disabled={importing}
                style={{ width:'100%',padding:'13px 0',borderRadius:14,border:'none',
                  background:importing?'#9BBBF2':PRIMARY,
                  color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                {importing ? '匯入中…' : `確認匯入 ${importRows.length} 筆`}
              </button>
            )}
            {importDone && (
              <button onClick={() => { setShowImport(false); resetImport() }}
                style={{ width:'100%',padding:'13px 0',borderRadius:14,border:'none',
                  background:PRIMARY,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
                完成
              </button>
            )}
          </div>
        </div>
      )}

      {/* 刪除確認 */}
      {deleteTarget && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.4)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:200 }}>
          <div style={{ background:'#fff',borderRadius:18,padding:24,width:280,textAlign:'center' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:8 }}>
              <IconTrash size={30} stroke={1.6} color={DANGER} />
            </div>
            <p style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:'0 0 8px' }}>確定刪除？</p>
            <p style={{ fontSize:13,color:TEXT_MUTED,margin:'0 0 20px' }}>刪除後無法復原</p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex:1,padding:'10px 0',borderRadius:12,border:`1px solid ${BORDER}`,
                  background:'#fff',fontSize:14,cursor:'pointer',color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleDelete}
                style={{ flex:1,padding:'10px 0',borderRadius:12,border:'none',
                  background:DANGER,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯 Modal */}
      {editTarget && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.4)',
          display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200 }}>
          <div style={{ background:'#fff',borderRadius:'22px 22px 0 0',
            padding:'24px 20px 36px',width:'100%',maxWidth:480 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h2 style={{ fontSize:17,fontWeight:700,color:TEXT_MAIN,margin:0 }}>編輯業績紀錄</h2>
              <button onClick={() => setEditTarget(null)}
                style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED }}><IconX size={22} /></button>
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
                  style={{ flex:1,padding:'9px 0',borderRadius:12,fontWeight:700,fontSize:14,cursor:'pointer',
                    border: 'none',
                    background: editForm.type===type ? (type==='BV'?ACCENT_YELLOW:PRIMARY) : SUBCARD_BG,
                    color: editForm.type===type ? (type==='BV'?'#5B3200':'#fff') : TEXT_SECONDARY }}>{type}</button>
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
              fontSize:14,color:TEXT_MAIN,marginBottom:20,cursor:'pointer' }}>
              <input type="checkbox" checked={editForm.is_gift}
                onChange={e => setEditForm(f => ({...f, is_gift: e.target.checked}))}
                style={{ width:16,height:16 }} />
              這是贈品（成本計入費用，不計算獲利）
            </label>
            <button onClick={handleSave} disabled={saving}
              style={{ width:'100%',padding:'13px 0',borderRadius:14,border:'none',
                background: saving ? '#9BBBF2' : PRIMARY,color:'#fff',
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
  display:'block', fontSize:12, fontWeight:700, color:TEXT_SECONDARY, marginBottom:4
}
const inputStyle = {
  width:'100%', padding:'10px 12px', borderRadius:12, border:`1px solid ${BORDER}`,
  fontSize:14, color:TEXT_MAIN, marginBottom:14, boxSizing:'border-box', outline:'none'
}
const thStyle = {
  textAlign:'left', padding:'10px 12px', fontSize:11, fontWeight:700, color:TEXT_SECONDARY,
}
const tdStyle = {
  padding:'10px 12px', fontSize:13, color:TEXT_MAIN,
}
