import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconFlask, IconCalendarEvent } from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'

const PRIMARY = '#1668E3'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const DANGER = '#E0454A'
const BORDER = '#F0F1F4'
const SUBCARD_BG = '#F5F8FC'

function today() { return new Date().toISOString().split('T')[0] }
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}
function formatDue(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((new Date(today()) - new Date(dateStr)) / 86400000)
  if (diff === 0) return '今天追蹤'
  if (diff > 0) return `逾期${diff}天`
  return `${Math.abs(diff)}天後`
}
function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

const FILTERS = ['全部','進行中','成交','考慮中','轉介/其他需求']
const RESULTS = ['成交','考慮中','轉介/其他需求']

// 結果標籤色：只有「成交」用綠色標示正向結果，「考慮中」「轉介/其他需求」都用灰階，不用黃色
function resultBadgeColor(result) {
  if (result === '成交') return { bg: ACCENT_GREEN_SOFT, text: ACCENT_GREEN_TEXT }
  return { bg: '#F0F1F4', text: TEXT_SECONDARY }
}

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

  // 考慮中的追蹤紀錄時間軸（點開才載入，同時只展開一筆）
  const [expandedId, setExpandedId] = useState(null)
  const [followupLogsMap, setFollowupLogsMap] = useState({})
  const [logDate, setLogDate] = useState(today())
  const [logNote, setLogNote] = useState('')
  const [logSaving, setLogSaving] = useState(false)

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

  async function updateNextFollowup(id, date) {
    await supabase.from('sample_tracking').update({ next_followup_date: date || null }).eq('id', id)
    setSamples(p => p.map(s => s.id === id ? { ...s, next_followup_date: date || null } : s))
  }

  async function fetchFollowupLogs(sampleId) {
    const { data } = await supabase.from('sample_followup_logs')
      .select('*').eq('sample_id', sampleId).order('date', { ascending: false })
    setFollowupLogsMap(p => ({ ...p, [sampleId]: data || [] }))
  }

  function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setLogDate(today()); setLogNote('')
    if (!followupLogsMap[id]) fetchFollowupLogs(id)
  }

  async function addFollowupLog(sampleId) {
    setLogSaving(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    await supabase.from('sample_followup_logs').insert({
      sample_id: sampleId, user_id: authUser.id, date: logDate, note: logNote.trim() || null,
    })
    setLogSaving(false)
    setLogNote('')
    setLogDate(today())
    fetchFollowupLogs(sampleId)
  }

  // 「進行中」涵蓋：還沒設結果的（3步驟階段）、以及「考慮中」（還在追蹤，不是終點）
  const filtered = samples.filter(s => {
    if (filter === '全部') return true
    if (filter === '進行中') return !s.result || s.result === '考慮中'
    return s.result === filter
  })

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name.includes(contactSearch)
  )

  return (
    <div style={{ background:'#fff',minHeight:'100vh',paddingBottom:80 }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
        /* 桌面版：卡片內容不拆，改成多欄網格排列，方便一次掃過多筆快速點擊操作 */
        .samples-list {
          padding: 8px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .samples-new-form-wrap {
          margin: 12px 16px;
        }
        @media (min-width: 1024px) {
          .dash-container.samples-wide { max-width: 1200px; }
          .samples-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            align-items: start;
            gap: 14px;
          }
          .samples-new-form-wrap {
            max-width: 480px;
            margin: 12px auto;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 0 0',borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container samples-wide" style={{ padding:'0 16px' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <h1 style={{ fontSize:20,fontWeight:700,color:TEXT_MAIN,margin:0 }}>試用品追蹤</h1>
          <button onClick={() => setShowNew(true)}
            style={{ width:36,height:36,borderRadius:12,background:PRIMARY,
              border:'none',color:'#fff',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}><IconPlus size={19} stroke={2} /></button>
        </div>
        <div style={{ display:'flex',gap:8,paddingBottom:12,overflowX:'auto' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'5px 14px',borderRadius:99,border:'none',whiteSpace:'nowrap',
                background:filter===f?PRIMARY:'#F5F8FC',
                color:filter===f?'#fff':TEXT_SECONDARY,
                fontSize:13,fontWeight:600,cursor:'pointer' }}>{f}</button>
          ))}
        </div>
      </div>
      </div>

      <div className="dash-container samples-wide">
      {/* 新增表單 */}
      {showNew && (
        <div className="samples-new-form-wrap" style={{ background:'#fff',borderRadius:18,
          padding:16,border:`1px solid ${BORDER}` }}>
          <p style={{ fontSize:15,fontWeight:700,color:TEXT_MAIN,margin:'0 0 12px' }}>新增試用品</p>

          {/* 選聯絡人 */}
          <div style={{ marginBottom:12,position:'relative' }}>
            <input value={contactSearch}
              onChange={e => { setContactSearch(e.target.value); setNewForm(p=>({...p,contact_id:'',contact_name:''})) }}
              placeholder="從互動名單搜尋聯絡人 *"
              style={inp} />
            {contactSearch && !newForm.contact_id && (
              <div style={{ position:'absolute',top:'100%',left:0,right:0,background:'#fff',
                border:`1px solid ${BORDER}`,borderRadius:12,zIndex:50,maxHeight:160,overflowY:'auto',
                boxShadow:'0 4px 12px rgba(19,42,77,0.1)' }}>
                {filteredContacts.map(c => (
                  <button key={c.id} onClick={() => {
                    setNewForm(p=>({...p,contact_id:c.id,contact_name:c.name}))
                    setContactSearch(c.name)
                  }} style={{ width:'100%',padding:'10px 12px',background:'none',border:'none',
                    borderBottom:`1px solid ${BORDER}`,textAlign:'left',cursor:'pointer',fontSize:14,color:TEXT_MAIN }}>
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
              style={{ flex:1,padding:'11px',borderRadius:12,border:'none',
                background:PRIMARY,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:14 }}>
              {saving?'儲存中…':'儲存'}
            </button>
            <button onClick={() => { setShowNew(false); setContactSearch('') }}
              style={{ flex:1,padding:'11px',borderRadius:12,border:`1px solid ${BORDER}`,
                background:'#fff',cursor:'pointer',fontSize:14,color:TEXT_SECONDARY }}>取消</button>
          </div>
        </div>
      )}

      {/* 列表：手機版單欄卡片；桌面版改用 CSS Grid 多欄排列（見上方 <style>），卡片內容完全不拆 */}
      {loading ? (
        <LoadingSpinner fullPage={false} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center',padding:60,color:TEXT_MUTED }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:12 }}><IconFlask size={36} stroke={1.5} /></div>
          <p style={{ fontSize:15 }}>還沒有試用品紀錄，點 + 開始追蹤！</p>
        </div>
      ) : (
        <div className="samples-list">
          {filtered.map(s => {
            const name = s.contacts?.name || '未知'
            const isActive = !s.result
            const isConsidering = s.result === '考慮中'
            const isOverdueFollowup = isConsidering && s.next_followup_date && s.next_followup_date < today()
            const badgeColor = resultBadgeColor(s.result)
            const needsAttention =
              (isActive && (!s.followup_1_done||!s.followup_2_done||!s.followup_3_done)) || isOverdueFollowup
            return (
              <div key={s.id} style={{ background:'#fff',borderRadius:16,padding:14,
                border: needsAttention ? `1.5px solid #FFDF9E` : `1px solid ${BORDER}` }}>

                {/* 頂部 */}
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                  <div style={{ width:38,height:38,borderRadius:'50%',background:avatarBg(name),
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#fff',fontWeight:700,fontSize:14,flexShrink:0 }}>{name[0]}</div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN,margin:0 }}>{name}</p>
                    <p style={{ fontSize:12,color:TEXT_MUTED,margin:'2px 0 0' }}>
                      {s.product_name} · {s.portions}天份 · {formatDate(s.share_date)}
                    </p>
                  </div>
                  {s.result && (
                    <span style={{ fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:99,
                      background:badgeColor.bg, color:badgeColor.text }}>
                      {s.result}
                    </span>
                  )}
                </div>

                {/* 三步驟進度（還沒設結果前） */}
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
                          style={{ flex:1,padding:'6px 4px',borderRadius:10,border:'none',
                            fontSize:11,fontWeight:600,cursor:'pointer',
                            background:s[step.field]?ACCENT_GREEN_SOFT:'#F5F8FC',
                            color:s[step.field]?ACCENT_GREEN_TEXT:TEXT_SECONDARY }}>
                          {s[step.field]?'✓ ':''}{step.label}
                        </button>
                      ))}
                    </div>

                    {s.followup_3_done && (
                      <div style={{ display:'flex',gap:6 }}>
                        {RESULTS.map(r => (
                          <button key={r} onClick={() => setResult(s.id, r)}
                            style={{ flex:1,padding:'6px 4px',borderRadius:10,border:'none',
                              fontSize:11,fontWeight:600,cursor:'pointer',
                              background:s.result===r?PRIMARY:'#F5F8FC',
                              color:s.result===r?'#fff':TEXT_SECONDARY }}>{r}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* 考慮中：持續追蹤區塊，不再是死路 */}
                {isConsidering && (
                  <div style={{ marginTop:2, borderTop:`1px solid ${BORDER}`, paddingTop:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                      <IconCalendarEvent size={14} stroke={1.9} color={TEXT_MUTED} />
                      <span style={{ fontSize:12, color:TEXT_MUTED }}>下次追蹤</span>
                      <input type="date" value={s.next_followup_date || ''}
                        onChange={e => updateNextFollowup(s.id, e.target.value)}
                        style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${BORDER}`,
                          fontSize:12, outline:'none', color:TEXT_MAIN }} />
                      {s.next_followup_date && (
                        <span style={{ fontSize:11, fontWeight:700,
                          color: isOverdueFollowup ? DANGER : ACCENT_YELLOW_TEXT }}>
                          {formatDue(s.next_followup_date)}
                        </span>
                      )}
                    </div>

                    <button onClick={() => toggleExpand(s.id)}
                      style={{ width:'100%', padding:'7px', background:'none', border:`1px dashed ${BORDER}`,
                        borderRadius:10, color:TEXT_SECONDARY, fontSize:12, cursor:'pointer', marginBottom:8 }}>
                      {expandedId === s.id ? '收起追蹤紀錄 ▲' : `追蹤紀錄${followupLogsMap[s.id] ? ` (${followupLogsMap[s.id].length})` : ''} ▼`}
                    </button>

                    {expandedId === s.id && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                          <input type="date" value={logDate} max={today()}
                            onChange={e => setLogDate(e.target.value)}
                            style={{ padding:'7px 8px', borderRadius:8, border:`1px solid ${BORDER}`,
                              fontSize:12, outline:'none', color:TEXT_MAIN, width:120 }} />
                          <input value={logNote} onChange={e => setLogNote(e.target.value)}
                            placeholder="記錄這次追蹤說了什麼…"
                            style={{ flex:1, minWidth:120, padding:'7px 10px', borderRadius:8,
                              border:`1px solid ${BORDER}`, fontSize:12, outline:'none', color:TEXT_MAIN }} />
                          <button onClick={() => addFollowupLog(s.id)} disabled={logSaving}
                            style={{ padding:'7px 14px', borderRadius:8, border:'none',
                              background:PRIMARY, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                            {logSaving ? '新增中…' : '新增'}
                          </button>
                        </div>
                        {(followupLogsMap[s.id]||[]).length === 0 ? (
                          <p style={{ fontSize:12, color:TEXT_MUTED, textAlign:'center', padding:'8px 0', margin:0 }}>
                            還沒有追蹤紀錄
                          </p>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {followupLogsMap[s.id].map(log => (
                              <div key={log.id} style={{ background:SUBCARD_BG, borderRadius:8, padding:'7px 10px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:TEXT_SECONDARY }}>{formatDate(log.date)}</span>
                                </div>
                                {log.note && <p style={{ fontSize:12, color:TEXT_MAIN, margin:'2px 0 0' }}>{log.note}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display:'flex',gap:6 }}>
                      {RESULTS.map(r => (
                        <button key={r} onClick={() => setResult(s.id, r)}
                          style={{ flex:1,padding:'6px 4px',borderRadius:10,border:'none',
                            fontSize:11,fontWeight:600,cursor:'pointer',
                            background:s.result===r?PRIMARY:'#F5F8FC',
                            color:s.result===r?'#fff':TEXT_SECONDARY }}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

const inp = { width:'100%',padding:'10px 12px',borderRadius:12,border:`1px solid ${BORDER}`,
  fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:TEXT_MAIN }
