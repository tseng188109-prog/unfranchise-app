import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconPencil, IconArchive, IconCheck, IconX, IconTrash,
  IconBriefcase, IconMapPin, IconMessageCircle, IconAlertCircle, IconShoppingBag, IconFlask,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'
import SampleSection from './SampleSection'
import {
  RELATIONSHIP_STAGES, REFERRAL_STAGES, getSuggestion,
  muteContact, unmuteContact, addContactNote, setStage, isStale, noteAgeOpacity,
  markDaily312,
} from './followUp'

import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_GREEN, ACCENT_GREEN_TEXT, DANGER, BORDER, SUBCARD_BG, RADIUS,
  getEggColor, getEggBg, avatarBg, PAGE_BG } from './designTokens'

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
  const [showReferralOptions, setShowReferralOptions] = useState(false) // 合作意願調整清單是否展開

  const [quickDate, setQuickDate] = useState(today())
  const [quickNote, setQuickNote] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [addToStory, setAddToStory] = useState(false) // 這筆互動要不要順便存進認識故事時間軸

  const [editingLogId, setEditingLogId] = useState(null)
  const [editNote, setEditNote] = useState('')
  const [linkedCustomer, setLinkedCustomer] = useState(null)

  // 一句話日記（contact_notes）+ 階段標注（annotation only，使用者自己點才會改）
  const [contactNotes, setContactNotes] = useState([])
  const [noteSaving, setNoteSaving] = useState(false)
  const [muteSaving, setMuteSaving] = useState(false)


  useEffect(() => { if (id) fetchContact() }, [id])

  async function fetchContact() {
    setLoading(true)
    setTab('logs')
    setLinkedCustomer(null)
    const { data } = await supabase.from('contacts').select('*').eq('id', id).single()
    if (data) setContact(data)
    const { data: logData } = await supabase.from('contact_logs')
      .select('*').eq('contact_id', id).order('date', { ascending: false })
    if (logData) setLogs(logData)

    const { data: noteData } = await supabase.from('contact_notes')
      .select('*').eq('contact_id', id).order('created_at', { ascending: false })
    setContactNotes(noteData || [])

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

    setLoading(false)
  }

  // 快速新增：日期留今天＝原本的「今天互動了」，改日期＝原本的「新增互動紀錄」，行為統一。
  // 這是整頁唯一的互動輸入口：送出一定算一次真的互動（更新最近互動時間，熱/冷判斷才會跟著真實節奏走），
  // 有勾選「順便記進認識故事」才會額外多存一筆到 contact_notes，避免日常互動內容稀釋故事時間軸。
  async function handleQuickAdd() {
    if (quickSaving) return
    setQuickSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const trimmedNote = quickNote.trim()
    await supabase.from('contact_logs').insert({
      contact_id: id, user_id: user.id,
      date: quickDate, note: trimmedNote || null,
    })
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: quickDate,
      task_key: 'daily_3_contacts', is_done: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
    if (quickDate === today()) await markDaily312(supabase, user.id, quickDate)

    const contactUpdate = { last_interacted_at: new Date().toISOString() }
    const isNewer = !contact.last_contact_date || quickDate >= contact.last_contact_date
    if (isNewer) {
      const days = DAYS_MAP[contact.action_type] || 30
      const next = new Date(quickDate + 'T00:00:00')
      next.setDate(next.getDate() + days)
      contactUpdate.last_contact_date = quickDate
      contactUpdate.next_contact_date = toDateStr(next)
    }
    await supabase.from('contacts').update(contactUpdate).eq('id', id)

    if (addToStory && trimmedNote) {
      await addContactNote(supabase, { contactId: id, userId: user.id, note: trimmedNote, touchInteraction: false })
    }

    setQuickNote('')
    setQuickDate(today())
    setAddToStory(false)
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

  // 故事時間軸的「還是這樣嗎？」確認：對舊的一句話按「還是這樣」，等於重新用同樣內容再記一筆，
  // 並標記 resolvesNoteId 讓它接續舊紀錄；按「已經不是了」則記一筆說明已經過期，同樣接續舊紀錄。
  // 這兩個動作都不算「真的互動過」，所以不更新最近互動時間（那是互動紀錄在負責的事）。
  async function handleConfirmNoteStillTrue(text, resolvesNoteId) {
    if (noteSaving) return
    setNoteSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await addContactNote(supabase, { contactId: id, userId: user.id, note: text, resolvesNoteId, touchInteraction: false })
    setNoteSaving(false)
    fetchContact()
    onChanged?.()
  }
  async function handleNoteNoLongerTrue(resolvesNoteId) {
    if (noteSaving) return
    setNoteSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await addContactNote(supabase, { contactId: id, userId: user.id, note: '已經不是了', resolvesNoteId, touchInteraction: false })
    setNoteSaving(false)
    fetchContact()
    onChanged?.()
  }

  async function handleToggleMute() {
    setMuteSaving(true)
    if (contact.is_muted) await unmuteContact(supabase, id)
    else await muteContact(supabase, id)
    setMuteSaving(false)
    fetchContact()
    onChanged?.()
  }

  // 階段永遠由使用者自己點才會改，這裡只負責寫入使用者的選擇
  async function handleSetStage(track, stage) {
    const { data: { user } } = await supabase.auth.getUser()
    const field = track === 'relationship' ? 'relationship_stage' : 'referral_stage'
    const next = contact[field] === stage ? null : stage // 再點一次＝取消標注
    await setStage(supabase, { contactId: id, userId: user.id, track, stage: next })
    fetchContact()
    onChanged?.()
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
    <div style={{ background:PAGE_BG, minHeight: embedded ? 'auto' : '100vh', paddingBottom: embedded ? 0 : 40,
      overflowX:'hidden', maxWidth:'100vw', boxSizing:'border-box' }}>

      {/* Header */}
      <div style={{ background:'#fff', padding: embedded ? '18px 20px 0' : '52px 16px 0', borderBottom:`1px solid ${BORDER}` }}>
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
            {/* 靜音狀態：時機未到，從今天的 3-1-2 挑選中完全退出，不重複解釋為什麼 */}
            {contact.is_muted ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                background:SUBCARD_BG, borderRadius:RADIUS.lg, padding:'10px 14px', marginBottom:14 }}>
                <span style={{ fontSize:13, color:TEXT_MUTED, fontWeight:600 }}>時機未到</span>
                <button onClick={handleToggleMute} disabled={muteSaving}
                  style={{ fontSize:12, color:PRIMARY, background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>
                  恢復排進今天
                </button>
              </div>
            ) : (
              <>
                {suggestedAction && (
                  <div style={{ background:'linear-gradient(135deg,#1668E3,#2E8FEA)', borderRadius:RADIUS.lg, padding:'12px 16px', marginBottom:14 }}>
                    <p style={{ margin:'0 0 3px', fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600 }}>現在最適合這樣接觸</p>
                    <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{getSuggestion(contact)}</p>
                    <p style={{ margin:'4px 0 0', fontSize:11, color:'rgba(255,255,255,0.75)' }}>
                      依據：{contact.egg_type}{contact.need_level ? ' · 需求度'+contact.need_level : ''}
                    </p>
                  </div>
                )}
                <div style={{ textAlign:'right', marginTop:-10, marginBottom:14 }}>
                  <button onClick={handleToggleMute} disabled={muteSaving}
                    style={{ fontSize:12, color:TEXT_MUTED, background:'none', border:'none', cursor:'pointer' }}>
                    時機未到，先不排進今天
                  </button>
                </div>
              </>
            )}

            {/* 消費狀況：路徑視覺，標注永遠由使用者自己點 */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:TEXT_MUTED, marginBottom:10 }}>消費狀況</div>
              <div style={{ display:'flex', alignItems:'center' }}>
                {RELATIONSHIP_STAGES.map((s, i) => {
                  const curIdx = RELATIONSHIP_STAGES.indexOf(contact.relationship_stage)
                  const reached = curIdx >= 0 && i <= curIdx
                  const isCurrent = i === curIdx
                  return (
                    <div key={s} style={{ display:'flex', alignItems:'center', flex: i < RELATIONSHIP_STAGES.length-1 ? 1 : '0 0 auto' }}>
                      <button onClick={() => handleSetStage('relationship', s)} title={s}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:4,
                          display:'flex', flexDirection:'column', alignItems:'center', gap:6, flexShrink:0 }}>
                        <span style={{ width: isCurrent?16:11, height: isCurrent?16:11, borderRadius:RADIUS.circle,
                          background: reached ? PRIMARY : '#D7DEE7',
                          border: isCurrent ? `3px solid ${PRIMARY_SOFT}` : 'none',
                          boxShadow: isCurrent ? `0 0 0 2px ${PRIMARY}` : 'none' }} />
                        <span style={{ fontSize:9, color: reached ? (isCurrent?PRIMARY:TEXT_MUTED) : '#C3CCDA',
                          fontWeight: isCurrent?700:400, whiteSpace:'nowrap' }}>{s}</span>
                      </button>
                      {i < RELATIONSHIP_STAGES.length-1 && (
                        <div style={{ height:2, flex:1, background: i < curIdx ? PRIMARY : '#D7DEE7' }} />
                      )}
                    </div>
                  )
                })}
              </div>
              <p style={{ fontSize:11, color:TEXT_MUTED, margin:'8px 0 0' }}>想往前走一步嗎？點一下上面的點就能標注，系統不會自己幫你改</p>
            </div>

            {/* 合作意願：非線性（「暫時婉拒」不是進度的一部分），用目前狀態＋收合清單呈現 */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                background:SUBCARD_BG, borderRadius:RADIUS.md, padding:'10px 14px' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontSize:11, color:TEXT_MUTED, fontWeight:700 }}>合作意願</span>
                  <span style={{ fontSize:14, color:TEXT_MAIN, fontWeight:700 }}>{contact.referral_stage || '尚未聊過'}</span>
                </div>
                <button onClick={() => setShowReferralOptions(v => !v)}
                  style={{ background:'none', border:'none', color:PRIMARY, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {showReferralOptions ? '收起' : '調整 ›'}
                </button>
              </div>
              {showReferralOptions && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
                  {REFERRAL_STAGES.map(s => (
                    <button key={s} onClick={() => { handleSetStage('referral', s); setShowReferralOptions(false) }}
                      style={{ background: contact.referral_stage===s ? ACCENT_GREEN : '#fff',
                        color: contact.referral_stage===s ? '#fff' : TEXT_SECONDARY,
                        border: contact.referral_stage===s ? 'none' : `1px solid ${BORDER}`,
                        borderRadius:RADIUS.pill, padding:'6px 12px', fontSize:12,
                        fontWeight: contact.referral_stage===s ? 700 : 600, cursor:'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 認識故事時間軸：舊的自然變淡，過期的可以一鍵確認還是這樣嗎。
                新的故事只會從下面「記錄一筆新互動」順便勾選加入，這裡不再有獨立的輸入框。 */}
            {contactNotes.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN, marginBottom:10 }}>
                  認識{contact.name}的故事 <span style={{ fontSize:12, color:TEXT_MUTED, fontWeight:400 }}>已經累積 {contactNotes.length} 件事</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column' }}>
                  {contactNotes.map((n, i) => (
                    <div key={n.id} style={{ display:'flex', gap:10, padding:'12px 0',
                      borderBottom: i < contactNotes.length-1 ? `1px solid ${BORDER}` : 'none', opacity: noteAgeOpacity(n.created_at) }}>
                      <span style={{ width:8, height:8, borderRadius:RADIUS.circle, background:PRIMARY, marginTop:6, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:TEXT_MUTED }}>{formatDateDisplay(n.created_at?.slice(0,10))}</div>
                        <div style={{ fontSize:14, color:TEXT_MAIN, lineHeight:1.5, margin:'2px 0', wordBreak:'break-word', overflowWrap:'anywhere' }}>{n.note}</div>
                        {isStale(n.created_at) && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                            <span style={{ fontSize:12, color:TEXT_MUTED }}>還是這樣嗎？</span>
                            <button onClick={() => handleConfirmNoteStillTrue(n.note, n.id)}
                              style={{ background:'#fff', color:TEXT_SECONDARY, border:`1px solid ${BORDER}`, borderRadius:RADIUS.xs,
                                padding:'4px 10px', fontSize:12, cursor:'pointer' }}>還是這樣</button>
                            <button onClick={() => handleNoteNoLongerTrue(n.id)}
                              style={{ background:'#fff', color:ACCENT_GREEN_TEXT, border:`1px solid ${BORDER}`, borderRadius:RADIUS.xs,
                                padding:'4px 10px', fontSize:12, cursor:'pointer' }}>已經不是了</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <SampleSection key={id} contactId={id} customerId={linkedCustomer?.id || null} onChanged={onChanged} />

            <div style={{ border:`1px solid ${BORDER}`, borderRadius:RADIUS.lg, padding:12, marginBottom:16 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                <input type="date" value={quickDate} max={today()}
                  onChange={e => setQuickDate(e.target.value)}
                  style={{ width:130, padding:'9px 10px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                    fontSize:13, background:SUBCARD_BG, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
                <input value={quickNote} onChange={e => setQuickNote(e.target.value)}
                  placeholder="今天跟他發生了什麼事？（選填）"
                  style={{ flex:1, minWidth:160, padding:'9px 12px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                    fontSize:13, background:SUBCARD_BG, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:TEXT_SECONDARY, cursor:'pointer' }}>
                  <input type="checkbox" checked={addToStory} onChange={e => setAddToStory(e.target.checked)}
                    style={{ width:15, height:15, cursor:'pointer' }} />
                  順便記進認識故事
                </label>
                <button onClick={handleQuickAdd} disabled={quickSaving}
                  style={{ padding:'9px 16px', borderRadius:RADIUS.sm, border:'none',
                    background: quickSaving ? '#9BBBF2' : PRIMARY, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {quickSaving ? '新增中…' : '新增'}
                </button>
              </div>
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
                <div style={{ flex:1, minWidth:0 }}>
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
                background:'#fff', border:`1px solid ${BORDER}`, borderRadius:RADIUS.card, padding:'12px 14px' }}>
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
    </div>
  )
}
