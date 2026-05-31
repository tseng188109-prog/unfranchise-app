import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchContacts() }, [user])

  async function fetchContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('contacts')
      .select('id,name,occupation,egg_type,need_level,action_type,next_contact_date,last_contact_date')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('next_contact_date', { ascending: true, nullsFirst: false })
    if (data) setContacts(data)
    setLoading(false)
  }

  const filtered = contacts.filter(c => {
    const matchEgg = eggFilter === '全部' || c.egg_type === eggFilter
    const matchSearch = !search || c.name.includes(search) ||
      (c.occupation||'').includes(search)
    return matchEgg && matchSearch
  })

  // 分組
  const overdue = filtered.filter(c => c.next_contact_date && c.next_contact_date < today())
  const dueToday = filtered.filter(c => c.next_contact_date === today())
  const thisWeek = filtered.filter(c => {
    if (!c.next_contact_date || c.next_contact_date <= today()) return false
    const diff = Math.floor((new Date(c.next_contact_date) - new Date(today())) / 86400000)
    return diff <= 7
  })
  const others = filtered.filter(c => {
    if (!c.next_contact_date) return true
    const diff = Math.floor((new Date(c.next_contact_date) - new Date(today())) / 86400000)
    return diff > 7
  })

  function ContactCard({ c }) {
    const isOv = c.next_contact_date && c.next_contact_date < today()
    const isToday = c.next_contact_date === today()
    return (
      <button onClick={() => navigate(`/contacts/${c.id}`)}
        style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
          width:'100%',background:'#fff',border:'none',borderBottom:'1px solid #F3F4F6',
          cursor:'pointer',textAlign:'left' }}>
        <Avatar name={c.name} size={42} />
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}>
            <span style={{ fontSize:15,fontWeight:700,color:'#111827' }}>{c.name}</span>
            {c.egg_type && (
              <span style={{ fontSize:11,fontWeight:600,padding:'1px 7px',borderRadius:6,
                background:getEggBg(c.egg_type),color:getEggColor(c.egg_type) }}>
                {c.egg_type}
              </span>
            )}
          </div>
          <div style={{ fontSize:12,color:'#9CA3AF',display:'flex',gap:4 }}>
            {c.occupation&&<span>{c.occupation}</span>}
            {c.occupation&&c.action_type&&<span>·</span>}
            {c.action_type&&<span>{c.action_type}</span>}
          </div>
        </div>
        {c.next_contact_date && (
          <span style={{ fontSize:12,fontWeight:600,whiteSpace:'nowrap',
            color:isOv?'#DC2626':isToday?'#F97316':'#9CA3AF' }}>
            {formatDue(c.next_contact_date)}
          </span>
        )}
      </button>
    )
  }

  function Section({ title, count, items }) {
    if (items.length === 0) return null
    return (
      <div>
        <div style={{ padding:'8px 16px',background:'#F8FAFC',
          fontSize:12,fontWeight:700,color:'#6B7280',
          borderBottom:'1px solid #F3F4F6' }}>
          {title} · {count}人
        </div>
        {items.map(c => <ContactCard key={c.id} c={c} />)}
      </div>
    )
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 16px 0',borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>互動名單</h1>
          <button onClick={() => navigate('/contacts/new')}
            style={{ width:36,height:36,borderRadius:'50%',background:'#2563EB',
              border:'none',color:'#fff',fontSize:22,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
        </div>

        {/* 搜尋 */}
        <div style={{ position:'relative',marginBottom:12 }}>
          <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',
            fontSize:16,color:'#9CA3AF' }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="搜尋姓名、職業..."
            style={{ width:'100%',padding:'10px 12px 10px 36px',borderRadius:10,
              border:'1px solid #E5E7EB',fontSize:14,background:'#F8FAFC',
              boxSizing:'border-box',outline:'none' }} />
        </div>

        {/* 蛋型篩選 */}
        <div style={{ display:'flex',gap:8,paddingBottom:12,overflowX:'auto' }}>
          {EGG_FILTERS.map(f => (
            <button key={f} onClick={() => setEggFilter(f)}
              style={{ padding:'5px 14px',borderRadius:99,border:'none',
                background:eggFilter===f?'#2563EB':'#F3F4F6',
                color:eggFilter===f?'#fff':'#6B7280',
                fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div style={{ textAlign:'center',padding:40,color:'#9CA3AF' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center',padding:60,color:'#9CA3AF' }}>
          <p style={{ fontSize:40,margin:'0 0 12px' }}>👥</p>
          <p style={{ fontSize:15 }}>還沒有聯絡人，點 + 新增第一位吧！</p>
        </div>
      ) : (
        <div style={{ background:'#fff',marginTop:8,borderRadius:12,overflow:'hidden',
          margin:'8px 0' }}>
          <Section title="逾期" count={overdue.length} items={overdue} />
          <Section title="今天到期" count={dueToday.length} items={dueToday} />
          <Section title="本週到期" count={thisWeek.length} items={thisWeek} />
          <Section title="其他" count={others.length} items={others} />
        </div>
      )}
    </div>
  )
}