import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

function today() { return new Date().toISOString().split('T')[0] }
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}
function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

const FILTERS = ['全部','進行中','成交','考慮中','轉介/其他需求']
const RESULTS = ['成交','考慮中','轉介/其他需求']

export default function Samples() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [samples, setSamples] = useState([])
  const [filter, setFilter] = useState('全部')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  // 新增表單
  const [contacts, setContacts] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [newForm, setNewForm] = useState({
    contact_id: '', contact_name: '',
    product_name: '', portions: '', share_date: today(),
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) { fetchSamples(); fetchContacts() } }, [user])

  async function fetchSamples() {
    setLoading(true)
    const { data } = await supabase
      .from('sample_tracking')
      .select('*,contacts(name)')
      .eq('user_id', user.id)
      .order('share_date', { ascending: false })
    if (data) setSamples(data)
    setLoading(false)
  }

  async function fetchContacts() {
    const { data } = await supabase.from('contacts')
      .select('id,name').eq('user_id', user.id).eq('is_archived', false).order('name')
    if (data) setContacts(data)
  }

  async function handleCreate() {
    if (!newForm.contact_id || !newForm.product_name || !newForm.portions) return
    setSaving(true)
    await supabase.from('sample_tracking').insert({
      user_id: user.id,
      contact_id: newForm.contact_id,
      product_name: newForm.product_name,
      portions: Number(newForm.portions),
      share_date: newForm.share_date,
    })
    setSaving(false)
    setShowNew(false)
    setNewForm({ contact_id:'',contact_name:'',product_name:'',portions:'',share_date:today() })
    setContactSearch('')
    fetchSamples()
  }

  async function toggleFollowup(id, field, current) {
    await supabase.from('sample_tracking').update({ [field]: !current }).eq('id', id)
    setSamples(p => p.map(s => s.id === id ? { ...s, [field]: !current } : s))
  }

  async function setResult(id, result) {
    await supabase.from('sample_tracking').update({ result }).eq('id', id)
    setSamples(p => p.map(s => s.id === id ? { ...s, result } : s))
  }

  const filtered = samples.filter(s => {
    if (filter === '全部') return true
    if (filter === '進行中') return !s.result
    return s.result === filter
  })

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name.includes(contactSearch)
  )

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 16px 0',borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>試用品追蹤</h1>
          <button onClick={() => setShowNew(true)}
            style={{ width:36,height:36,borderRadius:'50%',background:'#2563EB',
              border:'none',color:'#fff',fontSize:22,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
        </div>
        <div style={{ display:'flex',gap:8,paddingBottom:12,overflowX:'auto' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'5px 14px',borderRadius:99,border:'none',whiteSpace:'nowrap',
                background:filter===f?'#2563EB':'#F3F4F6',
                color:filter===f?'#fff':'#6B7280',
                fontSize:13,fontWeight:600,cursor:'pointer' }}>{f}</button>
          ))}
        </div>
      </div>

      {/* 新增表單 */}
      {showNew && (
        <div style={{ margin:'12px 16px',background:'#fff',borderRadius:16,
          padding:16,boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize:15,fontWeight:700,color:'#111827',margin:'0 0 12px' }}>新增試用品</p>

          {/* 選聯絡人 */}
          <div style={{ marginBottom:12,position:'relative' }}>
            <input value={contactSearch}
              onChange={e => { setContactSearch(e.target.value); setNewForm(p=>({...p,contact_id:'',contact_name:''})) }}
              placeholder="從互動名單搜尋聯絡人 *"
              style={inp} />
            {contactSearch && !newForm.contact_id && (
              <div style={{ position:'absolute',top:'100%',left:0,right:0,background:'#fff',
                border:'1px solid #E5E7EB',borderRadius:10,zIndex:50,maxHeight:160,overflowY:'auto',
                boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
                {filteredContacts.map(c => (
                  <button key={c.id} onClick={() => {
                    setNewForm(p=>({...p,contact_id:c.id,contact_name:c.name}))
                    setContactSearch(c.name)
                  }} style={{ width:'100%',padding:'10px 12px',background:'none',border:'none',
                    borderBottom:'1px solid #F3F4F6',textAlign:'left',cursor:'pointer',fontSize:14,color:'#111827' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input value={newForm.product_name}
            onChange={e => setNewForm(p=>({...p,product_name:e.target.value}))}
            placeholder="體驗產品 *" style={{ ...inp, marginBottom:8 }} />

          <div style={{ display:'flex',gap:8,marginBottom:8 }}>
            <input type="number" value={newForm.portions}
              onChange={e => setNewForm(p=>({...p,portions:e.target.value}))}
              placeholder="幾天份 *" style={{ ...inp, flex:1 }} />
            <input type="date" value={newForm.share_date}
              onChange={e => setNewForm(p=>({...p,share_date:e.target.value}))}
              style={{ ...inp, flex:1 }} />
          </div>

          <div style={{ display:'flex',gap:8 }}>
            <button onClick={handleCreate} disabled={saving}
              style={{ flex:1,padding:'11px',borderRadius:10,border:'none',
                background:'#2563EB',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:14 }}>
              {saving?'儲存中…':'儲存'}
            </button>
            <button onClick={() => { setShowNew(false); setContactSearch('') }}
              style={{ flex:1,padding:'11px',borderRadius:10,border:'1px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:14 }}>取消</button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div style={{ textAlign:'center',padding:40,color:'#9CA3AF' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center',padding:60,color:'#9CA3AF' }}>
          <p style={{ fontSize:36,margin:'0 0 12px' }}>🧪</p>
          <p style={{ fontSize:15 }}>還沒有試用品紀錄，點 + 開始追蹤！</p>
        </div>
      ) : (
        <div style={{ padding:'8px 16px',display:'flex',flexDirection:'column',gap:10 }}>
          {filtered.map(s => {
            const name = s.contacts?.name || '未知'
            const isActive = !s.result
            return (
              <div key={s.id} style={{ background:'#fff',borderRadius:14,padding:14,
                boxShadow:'0 1px 3px rgba(0,0,0,0.07)',
                border: isActive && (!s.followup_1_done||!s.followup_2_done||!s.followup_3_done)
                  ? '1.5px solid #FED7AA' : '1px solid transparent' }}>

                {/* 頂部 */}
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                  <div style={{ width:38,height:38,borderRadius:'50%',background:avatarBg(name),
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#fff',fontWeight:700,fontSize:14,flexShrink:0 }}>{name[0]}</div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14,fontWeight:700,color:'#111827',margin:0 }}>{name}</p>
                    <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>
                      {s.product_name} · {s.portions}天份 · {formatDate(s.share_date)}
                    </p>
                  </div>
                  {s.result && (
                    <span style={{ fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:99,
                      background:s.result==='成交'?'#DCFCE7':s.result==='考慮中'?'#FEF9C3':'#F3F4F6',
                      color:s.result==='成交'?'#16A34A':s.result==='考慮中'?'#CA8A04':'#6B7280' }}>
                      {s.result}
                    </span>
                  )}
                </div>

                {/* 三步驟進度 */}
                {isActive && (
                  <>
                    <div style={{ display:'flex',gap:6,marginBottom:10 }}>
                      {[
                        { field:'followup_1_done', label:'確認使用' },
                        { field:'followup_2_done', label:'傳送資料' },
                        { field:'followup_3_done', label:'詢問感受' },
                      ].map(step => (
                        <button key={step.field}
                          onClick={() => toggleFollowup(s.id, step.field, s[step.field])}
                          style={{ flex:1,padding:'6px 4px',borderRadius:8,border:'none',
                            fontSize:11,fontWeight:600,cursor:'pointer',
                            background:s[step.field]?'#DCFCE7':'#F3F4F6',
                            color:s[step.field]?'#16A34A':'#6B7280' }}>
                          {s[step.field]?'✓ ':''}{step.label}
                        </button>
                      ))}
                    </div>

                    {/* 結果選擇 */}
                    {s.followup_3_done && (
                      <div style={{ display:'flex',gap:6 }}>
                        {RESULTS.map(r => (
                          <button key={r} onClick={() => setResult(s.id, r)}
                            style={{ flex:1,padding:'6px 4px',borderRadius:8,border:'none',
                              fontSize:11,fontWeight:600,cursor:'pointer',
                              background:s.result===r?'#2563EB':'#F3F4F6',
                              color:s.result===r?'#fff':'#6B7280' }}>{r}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inp = { width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #E5E7EB',
  fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:'#111827' }