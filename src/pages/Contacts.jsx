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
    setArchiveTarget(null)
    setMenuTarget(null)
    fetchContacts()
  }

  async function handleRestore() {
    if (!restoreTarget) return
    await supabase.from('contacts').update({ is_archived: false }).eq('id', restoreTarget.id)
    setRestoreTarget(null)
    setMenuTarget(null)
    fetchContacts()
  }

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
            <button onClick={e => { e.stopPropagation(); navigate('/contacts/new') }}
              style={{ width:36, height:36, borderRadius:'50%', background:'#2563EB',
                border:'none', color:'#fff', fontSize:22, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          )}
        </div>

        {/* 搜尋 */}
        <div style={{ position:'relative', marginBottom:12 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
            fontSize:16, color:'#9CA3AF' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名、職業..."
            style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:10,
              border:'1px solid #E5E7EB', fontSize:14, background:'#F8FAFC',
              boxSizing:'border-box', outline:'none' }} />
        </div>

        {/* 篩選列：蛋型 + 封存切換 */}
        <div style={{ display:'flex', gap:8, paddingBottom:12, overflowX:'auto' }}>
          {/* 封存切換按鈕 */}
          <button onClick={() => { setShowArchived(!showArchived); setEggFilter('全部'); setSearch('') }}
            style={{ padding:'5px 14px', borderRadius:99, border:'none',
              background: showArchived ? '#6B7280' : '#F3F4F6',
              color: showArchived ? '#fff' : '#6B7280',
              fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            📦 {showArchived ? '查看一般' : '封存名單'}
          </button>

          {/* 蛋型篩選（封存模式也可用） */}
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

      {/* 封存模式提示banner */}
      {showArchived && (
        <div style={{ background:'#FEF9C3', padding:'10px 16px',
          fontSize:13, color:'#92400E', display:'flex', alignItems:'center', gap:6 }}>
          <span>📦</span>
          <span>封存名單 · 長按可復原聯絡人</span>
        </div>
      )}

      {/* 列表 */}
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
              /* 封存模式：只顯示復原 */
              <button onClick={() => setRestoreTarget(menuTarget)}
                style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                  padding:'14px 16px', borderRadius:12, border:'none',
                  background:'#F0FDF4', marginBottom:10, cursor:'pointer' }}>
                <span style={{ fontSize:20 }}>♻️</span>
                <span style={{ fontSize:15, fontWeight:600, color:'#16A34A' }}>復原到一般名單</span>
              </button>
            ) : (
              /* 一般模式：釘選 + 封存 */
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

      {/* 封存確認 Modal */}
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

      {/* 復原確認 Modal */}
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