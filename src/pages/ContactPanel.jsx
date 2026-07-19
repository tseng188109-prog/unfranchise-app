import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconPencil, IconArchive, IconCheck, IconX, IconTrash,
  IconBriefcase, IconMapPin, IconMessageCircle, IconAlertCircle, IconShoppingBag, IconFlask,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'
import { SAMPLE_STEPS, SAMPLE_RESULTS, sampleResultBadgeColor, formatSampleDue } from './sampleTracking'

import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_GREEN, ACCENT_GREEN_TEXT, DANGER, BORDER, SUBCARD_BG, RADIUS,
  getEggColor, getEggBg, avatarBg,
} from './designTokens'

const ACTION_MAP = {
  '茶葉蛋':{'大一':'軟性活動','大二':'商機講座','大三':'直接法','大四':'直接法'},
  '荷包蛋':{'大一':'輕鬆互動','大二':'軟性活動','大三':'商機講座','大四':'直接法'},
  '生雞蛋':{'大一':'輕鬆互動','大二':'輕鬆互動','大三':'軟性活動','大四':'商機講座'},
}
const DAYS_MAP = {'輕鬆互動':30,'軟性活動':14,'商機講座':5,'直接法':5}
function toDateStr(d){ return d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}) }
function today(){ return toDateStr(new Date()) }
function formatDateDisplay(d){
  if(!d)return''
  const dt=new Date(d+'T00:00:00')
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}
function formatMD(d){
  if(!d)return''
  const dt=new Date(d+'T00:00:00')
  return `${String(dt.getMonth()+1).padStart(2,'0')}月${String(dt.getDate()).padStart(2,'0')}日`
}

// props:
// id        — contact id (required)
// embedded  — true when rendered inside the desktop right-side panel (compact header, no back button, no page min-height)
// onBack    — called when back arrow pressed (mobile/full-page mode only); defaults to navigate(-1)
// onArchived— called after archiving; if omitted, defaults to navigate('/contacts')
// onChanged — called after any data change (log added/edited/deleted, archived) so a parent list can refetch
export default function ContactPanel({ id, embedded=false, onBack, onArchived, onChanged }) {
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('logs') // logs | info

  const [quickDate, setQuickDate] = useState(today())
  const [quickNote, setQuickNote] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)

  const [editingLogId, setEditingLogId] = useState(null)
  const [editNote, setEditNote] = useState('')
  const [linkedCustomer, setLinkedCustomer] = useState(null)

  // 試用品追蹤：這位聯絡人目前進行中/已有結果的試用品，跟快速新增表單
  const [samples, setSamples] = useState([])
  const [showSampleForm, setShowSampleForm] = useState(false)
  const [sampleForm, setSampleForm] = useState({ product_name:'', portions:'', share_date: today() })
  const [sampleSaving, setSampleSaving] = useState(false)
  const [editSampleTarget, setEditSampleTarget] = useState(null)
  const [editSampleForm, setEditSampleForm] = useState({ product_name:'', portions:'', share_date:'' })
  const [editSampleSaving, setEditSampleSaving] = useState(false)
  const [deleteSampleTarget, setDeleteSampleTarget] = useState(null)
  const [deleteSampleLoading, setDeleteSampleLoading] = useState(false)

  useEffect(() => { if (id) fetchContact() }, [id])

  async function fetchContact() {
    setLoading(true)
    setTab('logs')
    setLinkedCustomer(null)
    setShowSampleForm(false)
    setSampleForm({ product_name:'', portions:'', share_date: today() })
    const { data } = await supabase.from('contacts').select('*').eq('id', id).single()
    if (data) setContact(data)
    const { data: logData } = await supabase.from('contact_logs')
      .select('*').eq('contact_id', id).order('date', { ascending: false })
    if (logData) setLogs(logData)

    // 反查：這位聯絡人有沒有對應的顧客檔案（有消費紀錄）
    const { data: custData } = await supabase.from('customers')
      .select('id').eq('contact_id', id).maybeSingle()
    if (custData) {
      const { data: txData } = await supabase.from('transactions')
        .select('type,points,amount,cost').eq('customer_id', custData.id)
      const totalBV = (txData||[]).filter(t=>t.type==='BV').reduce((s,t)=>s+Number(t.points),0)
      const totalProfit = (txData||[]).reduce((s,t)=>s+((t.amount||0)-(t.cost||0)),0)
      setLinkedCustomer({ id: custData.id, totalBV, totalProfit })
    }

    // 這位聯絡人的試用品紀錄
    const { data: sampleData } = await supabase.from('sample_tracking')
      .select('*').eq('contact_id', id).order('share_date', { ascending: false })
    setSamples(sampleData || [])

    setLoading(false)
  }

  // 快速新增：日期留今天＝原本的「今天互動了」，改日期＝原本的「新增互動紀錄」，行為統一
  async function handleQuickAdd() {
    if (quickSaving) return
    setQuickSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('contact_logs').insert({
      contact_id: id, user_id: user.id,
      date: quickDate, note: quickNote.trim() || null,
    })
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: quickDate,
      task_key: 'daily_3_contacts', is_done: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
    const isNewer = !contact.last_contact_date || quickDate >= contact.last_contact_date
    if (isNewer) {
      const days = DAYS_MAP[contact.action_type] || 30
      const next = new Date(quickDate + 'T00:00:00')
      next.setDate(next.getDate() + days)
      await supabase.from('contacts').update({
        last_contact_date: quickDate,
        next_contact_date: toDateStr(next),
      }).eq('id', id)
    }
    setQuickNote('')
    setQuickDate(today())
    setQuickSaving(false)
    fetchContact()
    onChanged?.()
  }

  function startEditLog(log) {
    setEditingLogId(log.id)
    setEditNote(log.note || '')
  }
  async function saveEditLog(logId) {
    await supabase.from('contact_logs').update({ note: editNote.trim() || null }).eq('id', logId)
    setEditingLogId(null)
    fetchContact()
  }
  async function deleteLog(logId) {
    if (!confirm('確定刪除這筆互動紀錄？')) return
    await supabase.from('contact_logs').delete().eq('id', logId)
    fetchContact()
    onChanged?.()
  }

  // 發送試用品：帶著這位聯絡人的 id，不用像 Samples.jsx 那樣再搜尋一次
  async function handleAddSample() {
    if (!sampleForm.product_name.trim() || !sampleForm.portions) return
    setSampleSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('sample_tracking').insert({
      user_id: user.id,
      contact_id: id,
      product_name: sampleForm.product_name.trim(),
      portions: Number(sampleForm.portions),
      share_date: sampleForm.share_date,
    })
    setSampleSaving(false)
    setShowSampleForm(false)
    setSampleForm({ product_name:'', portions:'', share_date: today() })
    fetchContact()
  }

  async function toggleSampleFollowup(sampleId, field, current) {
    await supabase.from('sample_tracking').update({ [field]: !current }).eq('id', sampleId)
    setSamples(p => p.map(s => s.id === sampleId ? { ...s, [field]: !current } : s))
  }

  async function setSampleResult(sampleId, result) {
    await supabase.from('sample_tracking').update({ result }).eq('id', sampleId)
    setSamples(p => p.map(s => s.id === sampleId ? { ...s, result } : s))
  }

  function openEditSample(s) {
    setEditSampleTarget(s)
    setEditSampleForm({ product_name: s.product_name || '', portions: s.portions || '', share_date: s.share_date || today() })
  }

  async function saveEditSample() {
    if (!editSampleForm.product_name.trim() || !editSampleForm.portions) return
    setEditSampleSaving(true)
    await supabase.from('sample_tracking').update({
      product_name: editSampleForm.product_name.trim(),
      portions: Number(editSampleForm.portions),
      share_date: editSampleForm.share_date,
    }).eq('id', editSampleTarget.id)
    setEditSampleSaving(false)
    setEditSampleTarget(null)
    fetchContact()
  }

  async function handleDeleteSample() {
    if (!deleteSampleTarget) return
    setDeleteSampleLoading(true)
    await supabase.from('sample_tracking').delete().eq('id', deleteSampleTarget)
    setDeleteSampleLoading(false)
    setDeleteSampleTarget(null)
    fetchContact()
  }

  async function handleArchive() {
    if (!confirm(`確定要封存「${contact.name}」嗎？`)) return
    await supabase.from('contacts').update({ is_archived: true }).eq('id', id)
    onChanged?.()
    if (onArchived) onArchived()
    else navigate('/contacts')
  }

  if (loading) {
    return <LoadingSpinner fullPage={false} />
  }
  if (!contact) return null

  const suggestedAction = ACTION_MAP[contact.egg_type]?.[contact.need_level] || contact.action_type

  const infoRows = [
    { icon: IconBriefcase, label:'職業', value: contact.occupation },
    { icon: IconMapPin, label:'地區', value: contact.region },
    { icon: IconMessageCircle, label:'認識管道',
      value: contact.platform ? `${contact.platform}${contact.platform_account ? '：'+contact.platform_account : ''}` : contact.note },
    { icon: IconAlertCircle, label:'痛點', value: contact.pain_point },
    { icon: IconShoppingBag, label:'詢問產品', value: contact.asked_products },
  ].filter(r => r.value)

  return (
    <div style={{ background:'#fff', minHeight: embedded ? 'auto' : '100vh', paddingBottom: embedded ? 0 : 40 }}>

      {/* Header */}
      <div style={{ padding: embedded ? '18px 20px 0' : '52px 16px 0', borderBottom:`1px solid ${BORDER}` }}>
        {!embedded && (
          <div style={{ marginBottom:12 }}>
            <button onClick={onBack || (() => navigate(-1))}
              style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_SECONDARY, display:'flex' }}>
              <IconArrowLeft size={22} stroke={1.9} />
            </button>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:16, flexWrap:'wrap' }}>
          <div style={{ width: embedded ? 48 : 56, height: embedded ? 48 : 56, borderRadius:RADIUS.circle,
            background:avatarBg(contact.name), display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontWeight:700, fontSize: embedded ? 19 : 22, flexShrink:0 }}>
            {contact.name[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize: embedded ? 17 : 20, fontWeight:700, color:TEXT_MAIN }}>{contact.name}</span>
              {contact.egg_type && (
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:RADIUS.xs,
                  background:getEggBg(contact.egg_type), color:getEggColor(contact.egg_type) }}>
                  {contact.egg_type}{contact.need_level ? ' · '+contact.need_level : ''}
                </span>
              )}
            </div>
            {contact.occupation && <p style={{ fontSize:13, color:TEXT_MUTED, margin:'2px 0 0' }}>{contact.occupation}</p>}
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={() => navigate(`/contacts/${id}/edit`)}
              style={{ width:32, height:32, borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`, background:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TEXT_SECONDARY }}>
              <IconPencil size={15} stroke={1.9} />
            </button>
            <button onClick={handleArchive}
              style={{ width:32, height:32, borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`, background:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TEXT_MUTED }}>
              <IconArchive size={15} stroke={1.9} />
            </button>
          </div>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          {[{ key:'logs', label:'互動紀錄' }, { key:'info', label:'資料' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background:'none', border:'none', cursor:'pointer', padding:'0 0 10px',
                fontSize:13, fontWeight:600, color: tab===t.key ? PRIMARY : TEXT_MUTED,
                borderBottom: tab===t.key ? `2px solid ${PRIMARY}` : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: embedded ? '16px 20px 24px' : '16px' }}>

        {tab === 'logs' && (
          <>
            {suggestedAction && (
              <div style={{ background:'linear-gradient(135deg,#1668E3,#2E8FEA)', borderRadius:RADIUS.lg, padding:'12px 16px', marginBottom:14 }}>
                <p style={{ margin:'0 0 3px', fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600 }}>建議行動</p>
                <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{suggestedAction}</p>
                {contact.next_contact_date && (
                  <p style={{ margin:'4px 0 0', fontSize:11, color:'rgba(255,255,255,0.75)' }}>
                    下次互動建議：{formatDateDisplay(contact.next_contact_date)}
                  </p>
                )}
              </div>
            )}

            {/* 試用品：發送＋這位聯絡人目前進行中/已有結果的試用品，不用切去 Samples.jsx 就能看到 */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN, display:'flex', alignItems:'center', gap:6 }}>
                  <IconFlask size={14} stroke={1.9} color={TEXT_SECONDARY} /> 試用品
                </span>
                <button onClick={() => setShowSampleForm(v => !v)}
                  style={{ fontSize:12, color:PRIMARY, background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>
                  {showSampleForm ? '取消' : '+ 發送試用品'}
                </button>
              </div>

              {showSampleForm && (
                <div style={{ background:SUBCARD_BG, borderRadius:RADIUS.sm, padding:12, marginBottom:10 }}>
                  <input value={sampleForm.product_name}
                    onChange={e => setSampleForm(p => ({ ...p, product_name: e.target.value }))}
                    placeholder="體驗產品 *"
                    style={{ width:'100%', padding:'8px 10px', borderRadius:RADIUS.xs, border:`1px solid ${BORDER}`,
                      fontSize:13, background:'#fff', boxSizing:'border-box', outline:'none', color:TEXT_MAIN, marginBottom:8 }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="number" value={sampleForm.portions}
                      onChange={e => setSampleForm(p => ({ ...p, portions: e.target.value }))}
                      placeholder="幾天份 *"
                      style={{ flex:1, padding:'8px 10px', borderRadius:RADIUS.xs, border:`1px solid ${BORDER}`,
                        fontSize:13, background:'#fff', boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
                    <input type="date" value={sampleForm.share_date} max={today()}
                      onChange={e => setSampleForm(p => ({ ...p, share_date: e.target.value }))}
                      style={{ flex:1, padding:'8px 10px', borderRadius:RADIUS.xs, border:`1px solid ${BORDER}`,
                        fontSize:13, background:'#fff', boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
                  </div>
                  <button onClick={handleAddSample} disabled={sampleSaving}
                    style={{ width:'100%', padding:'9px', borderRadius:RADIUS.xs, border:'none', marginTop:8,
                      background: sampleSaving ? '#9BBBF2' : PRIMARY, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    {sampleSaving ? '儲存中…' : '儲存'}
                  </button>
                </div>
              )}

              {samples.length === 0 ? (
                !showSampleForm && (
                  <p style={{ fontSize:12, color:TEXT_MUTED, margin:0 }}>目前沒有試用品紀錄</p>
                )
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {samples.map(s => {
                    const isActive = !s.result
                    const isConsidering = s.result === '考慮中'
                    const badgeColor = sampleResultBadgeColor(s.result)
                    return (
                      <div key={s.id} style={{ background:SUBCARD_BG, borderRadius:RADIUS.sm, padding:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isActive || isConsidering ? 8 : 0 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:TEXT_MAIN }}>
                            {s.product_name} · {s.portions}天份
                          </span>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                            {s.result && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:RADIUS.pill,
                                background:badgeColor.bg, color:badgeColor.text }}>
                                {s.result}
                              </span>
                            )}
                            <button onClick={() => openEditSample(s)}
                              style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED, padding:2, display:'flex' }}>
                              <IconPencil size={13} stroke={1.9} />
                            </button>
                            <button onClick={() => setDeleteSampleTarget(s.id)}
                              style={{ background:'none', border:'none', cursor:'pointer', color:DANGER, padding:2, display:'flex' }}>
                              <IconTrash size={13} stroke={1.9} />
                            </button>
                          </div>
                        </div>

                        {isActive && (
                          <>
                            <div style={{ display:'flex', gap:6 }}>
                              {SAMPLE_STEPS.map(step => (
                                <button key={step.field}
                                  onClick={() => toggleSampleFollowup(s.id, step.field, s[step.field])}
                                  style={{ flex:1, padding:'5px 4px', borderRadius:RADIUS.xs, border:'none',
                                    fontSize:10, fontWeight:600, cursor:'pointer',
                                    background: s[step.field] ? ACCENT_GREEN : '#fff',
                                    color: s[step.field] ? '#fff' : TEXT_SECONDARY }}>
                                  {s[step.field] ? '✓ ' : ''}{step.label}
                                </button>
                              ))}
                            </div>
                            {s.followup_3_done && (
                              <div style={{ display:'flex', gap:6, marginTop:6 }}>
                                {SAMPLE_RESULTS.map(r => (
                                  <button key={r} onClick={() => setSampleResult(s.id, r)}
                                    style={{ flex:1, padding:'5px 4px', borderRadius:RADIUS.xs, border:'none',
                                      fontSize:10, fontWeight:600, cursor:'pointer',
                                      background:'#fff', color:TEXT_SECONDARY }}>{r}</button>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {isConsidering && s.next_followup_date && (
                          <p style={{ fontSize:11, color:TEXT_MUTED, margin:0 }}>
                            下次追蹤：{formatSampleDue(s.next_followup_date, today())}
                            <span style={{ color:PRIMARY, marginLeft:6, cursor:'pointer' }}
                              onClick={() => navigate('/samples')}>去試用品頁追蹤 →</span>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              <input type="date" value={quickDate} max={today()}
                onChange={e => setQuickDate(e.target.value)}
                style={{ width:130, padding:'9px 10px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                  fontSize:13, background:SUBCARD_BG, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
              <input value={quickNote} onChange={e => setQuickNote(e.target.value)}
                placeholder="記錄一筆新互動…（選填備註）"
                style={{ flex:1, minWidth:160, padding:'9px 12px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                  fontSize:13, background:SUBCARD_BG, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
              <button onClick={handleQuickAdd} disabled={quickSaving}
                style={{ padding:'9px 16px', borderRadius:RADIUS.sm, border:'none',
                  background: quickSaving ? '#9BBBF2' : PRIMARY, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {quickSaving ? '新增中…' : '新增'}
              </button>
            </div>

            {logs.length === 0 ? (
              <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'20px 0' }}>還沒有互動紀錄</p>
            ) : (
              <div style={{ position:'relative', paddingLeft:20 }}>
                <div style={{ position:'absolute', left:5, top:6, bottom:6, width:1, background:BORDER }} />
                {logs.map((log, i) => (
                  <div key={log.id} style={{ position:'relative', marginBottom: i < logs.length-1 ? 16 : 0 }}>
                    <div style={{ position:'absolute', left:-20, top:2, width:10, height:10, borderRadius:RADIUS.circle,
                      background: i===0 ? ACCENT_GREEN : '#D8DCE8', border:'2px solid #fff' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:TEXT_MUTED, fontWeight:600 }}>
                        {formatMD(log.date)}
                        {i===0 && <span style={{ color:ACCENT_GREEN_TEXT, marginLeft:6 }}>最近</span>}
                      </span>
                      {editingLogId !== log.id && (
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => startEditLog(log)}
                            style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED, display:'flex' }}>
                            <IconPencil size={13} stroke={1.9} />
                          </button>
                          <button onClick={() => deleteLog(log.id)}
                            style={{ background:'none', border:'none', cursor:'pointer', color:DANGER, display:'flex' }}>
                            <IconTrash size={13} stroke={1.9} />
                          </button>
                        </div>
                      )}
                    </div>
                    {editingLogId === log.id ? (
                      <div style={{ display:'flex', gap:6 }}>
                        <input value={editNote} onChange={e => setEditNote(e.target.value)}
                          style={{ flex:1, padding:'7px 10px', borderRadius:RADIUS.xs, border:`1px solid ${BORDER}`,
                            fontSize:13, outline:'none', color:TEXT_MAIN }} />
                        <button onClick={() => saveEditLog(log.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:ACCENT_GREEN_TEXT, display:'flex' }}>
                          <IconCheck size={17} stroke={2} />
                        </button>
                        <button onClick={() => setEditingLogId(null)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED, display:'flex' }}>
                          <IconX size={17} stroke={1.9} />
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize:13, color: log.note ? TEXT_MAIN : TEXT_MUTED, margin:0 }}>
                        {log.note || '無備註'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {linkedCustomer && (
              <div style={{ display:'flex', alignItems:'center', gap:10,
                background:PRIMARY_SOFT, borderRadius:RADIUS.sm, padding:'10px 12px' }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:11, color:TEXT_SECONDARY, margin:'0 0 4px', fontWeight:600 }}>顧客消費紀錄</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:13, color:TEXT_MAIN, fontWeight:700 }}>{linkedCustomer.totalBV.toFixed(0)} BV</span>
                    <span style={{ fontSize:12, color:ACCENT_GREEN_TEXT }}>NT${linkedCustomer.totalProfit.toLocaleString()} 獲利</span>
                  </div>
                </div>
                <button onClick={() => navigate(`/customers/${linkedCustomer.id}`)}
                  style={{ fontSize:12, color:PRIMARY, background:'#fff', border:`1px solid ${BORDER}`,
                    borderRadius:RADIUS.xs, padding:'6px 12px', cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                  查看顧客檔案
                </button>
              </div>
            )}
            {infoRows.length === 0 ? (
              <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'20px 0' }}>還沒有補充資料</p>
            ) : infoRows.map(r => (
              <div key={r.label} style={{ display:'flex', alignItems:'flex-start', gap:10,
                background:SUBCARD_BG, borderRadius:RADIUS.sm, padding:'10px 12px' }}>
                <r.icon size={16} stroke={1.8} color={TEXT_SECONDARY} style={{ marginTop:1, flexShrink:0 }} />
                <div>
                  <p style={{ fontSize:11, color:TEXT_MUTED, margin:'0 0 2px' }}>{r.label}</p>
                  <p style={{ fontSize:13, color:TEXT_MAIN, margin:0 }}>{r.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編輯試用品紀錄 */}
      {editSampleTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:300 }}
          onClick={() => setEditSampleTarget(null)}>
          <div style={{ background:'#fff', borderRadius:'22px 22px 0 0',
            padding:'24px 20px 36px', width:'100%', maxWidth:480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:TEXT_MAIN, margin:0 }}>編輯試用品紀錄</h2>
              <button onClick={() => setEditSampleTarget(null)}
                style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED }}><IconX size={22} /></button>
            </div>
            <input value={editSampleForm.product_name}
              onChange={e => setEditSampleForm(p => ({ ...p, product_name: e.target.value }))}
              placeholder="體驗產品 *"
              style={{ width:'100%', padding:'10px 12px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                fontSize:14, boxSizing:'border-box', outline:'none', color:TEXT_MAIN, marginBottom:8 }} />
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <input type="number" value={editSampleForm.portions}
                onChange={e => setEditSampleForm(p => ({ ...p, portions: e.target.value }))}
                placeholder="幾天份 *"
                style={{ flex:1, padding:'10px 12px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                  fontSize:14, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
              <input type="date" value={editSampleForm.share_date}
                onChange={e => setEditSampleForm(p => ({ ...p, share_date: e.target.value }))}
                style={{ flex:1, padding:'10px 12px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                  fontSize:14, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
            </div>
            <button onClick={saveEditSample} disabled={editSampleSaving}
              style={{ width:'100%', padding:'13px 0', borderRadius:RADIUS.lg, border:'none',
                background: editSampleSaving ? '#9BBBF2' : PRIMARY, color:'#fff',
                fontSize:15, fontWeight:700, cursor:'pointer' }}>
              {editSampleSaving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}

      {/* 刪除試用品紀錄確認 */}
      {deleteSampleTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <div style={{ background:'#fff', borderRadius:RADIUS.xl, padding:24, width:280, textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
              <IconTrash size={30} stroke={1.6} color={DANGER} />
            </div>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:'0 0 8px' }}>確定刪除這筆試用品紀錄？</p>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'0 0 20px' }}>連同追蹤紀錄一併刪除，無法復原</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteSampleTarget(null)}
                style={{ flex:1, padding:'10px 0', borderRadius:RADIUS.md, border:`1px solid ${BORDER}`,
                  background:'#fff', fontSize:14, cursor:'pointer', color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleDeleteSample} disabled={deleteSampleLoading}
                style={{ flex:1, padding:'10px 0', borderRadius:RADIUS.md, border:'none',
                  background:DANGER, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                {deleteSampleLoading ? '刪除中…' : '刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
