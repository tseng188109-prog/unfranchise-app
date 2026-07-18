import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconPencil, IconArchive, IconCheck, IconX, IconTrash,
  IconBriefcase, IconMapPin, IconMessageCircle, IconAlertCircle, IconShoppingBag,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'

const PRIMARY = '#1668E3'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const DANGER = '#E0454A'
const BORDER = '#F0F1F4'
const SUBCARD_BG = '#F5F8FC'

const ACTION_MAP = {
  '茶葉蛋':{'大一':'軟性活動','大二':'商機講座','大三':'直接法','大四':'直接法'},
  '荷包蛋':{'大一':'輕鬆互動','大二':'軟性活動','大三':'商機講座','大四':'直接法'},
  '生雞蛋':{'大一':'輕鬆互動','大二':'輕鬆互動','大三':'軟性活動','大四':'商機講座'},
}
const DAYS_MAP = {'輕鬆互動':30,'軟性活動':14,'商機講座':5,'直接法':5}

function getEggColor(t){return t==='茶葉蛋'?'#F97316':t==='荷包蛋'?'#3B82F6':t==='生雞蛋'?'#22C55E':'#9CA3AF'}
function getEggBg(t){return t==='茶葉蛋'?'#FFF7ED':t==='荷包蛋'?'#EFF6FF':t==='生雞蛋'?'#F0FDF4':'#F9FAFB'}
function avatarBg(name){
  const colors=['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n=0;for(let i=0;i<name.length;i++)n+=name.charCodeAt(i)
  return colors[n%colors.length]
}
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

  useEffect(() => { if (id) fetchContact() }, [id])

  async function fetchContact() {
    setLoading(true)
    setTab('logs')
    const { data } = await supabase.from('contacts').select('*').eq('id', id).single()
    if (data) setContact(data)
    const { data: logData } = await supabase.from('contact_logs')
      .select('*').eq('contact_id', id).order('date', { ascending: false })
    if (logData) setLogs(logData)
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
          <div style={{ width: embedded ? 48 : 56, height: embedded ? 48 : 56, borderRadius:'50%',
            background:avatarBg(contact.name), display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontWeight:700, fontSize: embedded ? 19 : 22, flexShrink:0 }}>
            {contact.name[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize: embedded ? 17 : 20, fontWeight:700, color:TEXT_MAIN }}>{contact.name}</span>
              {contact.egg_type && (
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:8,
                  background:getEggBg(contact.egg_type), color:getEggColor(contact.egg_type) }}>
                  {contact.egg_type}{contact.need_level ? ' · '+contact.need_level : ''}
                </span>
              )}
            </div>
            {contact.occupation && <p style={{ fontSize:13, color:TEXT_MUTED, margin:'2px 0 0' }}>{contact.occupation}</p>}
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={() => navigate(`/contacts/${id}/edit`)}
              style={{ width:32, height:32, borderRadius:9, border:`1px solid ${BORDER}`, background:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TEXT_SECONDARY }}>
              <IconPencil size={15} stroke={1.9} />
            </button>
            <button onClick={handleArchive}
              style={{ width:32, height:32, borderRadius:9, border:`1px solid ${BORDER}`, background:'#fff',
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
              <div style={{ background:'linear-gradient(135deg,#1668E3,#2E8FEA)', borderRadius:14, padding:'12px 16px', marginBottom:14 }}>
                <p style={{ margin:'0 0 3px', fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600 }}>建議行動</p>
                <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{suggestedAction}</p>
                {contact.next_contact_date && (
                  <p style={{ margin:'4px 0 0', fontSize:11, color:'rgba(255,255,255,0.75)' }}>
                    下次互動建議：{formatDateDisplay(contact.next_contact_date)}
                  </p>
                )}
              </div>
            )}

            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              <input type="date" value={quickDate} max={today()}
                onChange={e => setQuickDate(e.target.value)}
                style={{ width:130, padding:'9px 10px', borderRadius:10, border:`1px solid ${BORDER}`,
                  fontSize:13, background:SUBCARD_BG, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
              <input value={quickNote} onChange={e => setQuickNote(e.target.value)}
                placeholder="記錄一筆新互動…（選填備註）"
                style={{ flex:1, minWidth:160, padding:'9px 12px', borderRadius:10, border:`1px solid ${BORDER}`,
                  fontSize:13, background:SUBCARD_BG, boxSizing:'border-box', outline:'none', color:TEXT_MAIN }} />
              <button onClick={handleQuickAdd} disabled={quickSaving}
                style={{ padding:'9px 16px', borderRadius:10, border:'none',
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
                    <div style={{ position:'absolute', left:-20, top:2, width:10, height:10, borderRadius:'50%',
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
                          style={{ flex:1, padding:'7px 10px', borderRadius:8, border:`1px solid ${BORDER}`,
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
            {infoRows.length === 0 ? (
              <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'20px 0' }}>還沒有補充資料</p>
            ) : infoRows.map(r => (
              <div key={r.label} style={{ display:'flex', alignItems:'flex-start', gap:10,
                background:SUBCARD_BG, borderRadius:10, padding:'10px 12px' }}>
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
