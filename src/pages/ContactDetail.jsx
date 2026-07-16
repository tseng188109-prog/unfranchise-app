import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'

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
function toDateStr(d){
  return d.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})
}
function today(){ return toDateStr(new Date()) }
function formatDateDisplay(d){
  if(!d)return''
  const dt=new Date(d+'T00:00:00')
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteInput, setNoteInput] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [addDate, setAddDate] = useState(today())
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const [editingLog, setEditingLog] = useState(null)
  const [editNote, setEditNote] = useState('')

  useEffect(() => { fetchContact() }, [id])

  async function fetchContact() {
    setLoading(true)
    const { data } = await supabase.from('contacts')
      .select('*').eq('id', id).single()
    if (data) setContact(data)
    const { data: logData } = await supabase.from('contact_logs')
      .select('*').eq('contact_id', id).order('date', { ascending: false })
    if (logData) setLogs(logData)
    setLoading(false)
  }

  async function handleTodayContact() {
    setNoteInput('')
    setShowNoteModal(true)
  }

  async function confirmContact() {
    setMarking(true)
    const todayStr = today()
    const days = DAYS_MAP[contact.action_type] || 30
    const next = new Date()
    next.setDate(next.getDate() + days)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('contacts').update({
      last_contact_date: todayStr,
      next_contact_date: toDateStr(next),
    }).eq('id', id)
    await supabase.from('contact_logs').insert({
      contact_id: id, user_id: user.id,
      date: todayStr, note: noteInput.trim() || null,
    })
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: todayStr,
      task_key: 'daily_3_contacts', is_done: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
    setShowNoteModal(false)
    setMarking(false)
    fetchContact()
  }

  function openAddModal() {
    setAddDate(today())
    setAddNote('')
    setShowAddModal(true)
  }

  async function confirmAddLog() {
    setAddSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('contact_logs').insert({
      contact_id: id, user_id: user.id,
      date: addDate, note: addNote.trim() || null,
    })
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: addDate,
      task_key: 'daily_3_contacts', is_done: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })
    const isNewer = !contact.last_contact_date || addDate >= contact.last_contact_date
    if (isNewer) {
      const days = DAYS_MAP[contact.action_type] || 30
      const next = new Date(addDate + 'T00:00:00')
      next.setDate(next.getDate() + days)
      await supabase.from('contacts').update({
        last_contact_date: addDate,
        next_contact_date: toDateStr(next),
      }).eq('id', id)
    }
    setAddSaving(false)
    setShowAddModal(false)
    fetchContact()
  }

  async function handleEditLog(log) {
    setEditingLog(log)
    setEditNote(log.note || '')
  }

  async function confirmEditLog() {
    await supabase.from('contact_logs')
      .update({ note: editNote.trim() || null }).eq('id', editingLog.id)
    setEditingLog(null)
    fetchContact()
  }

  async function handleDeleteLog(logId) {
    if (!confirm('確定刪除這筆互動紀錄？')) return
    await supabase.from('contact_logs').delete().eq('id', logId)
    fetchContact()
  }

  async function handleArchive() {
    if (!confirm(`確定要封存「${contact.name}」嗎？`)) return
    await supabase.from('contacts').update({ is_archived: true }).eq('id', id)
    navigate('/contacts')
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>
      <p style={{color:'#9CA3AF'}}>載入中…</p>
    </div>
  )
  if (!contact) return null

  const suggestedAction = ACTION_MAP[contact.egg_type]?.[contact.need_level] || contact.action_type

  return (
    <div style={{background:'#F8FAFC',minHeight:'100vh',paddingBottom:100}}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>


      {/* 今天互動了 Modal */}
      {showNoteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,
          display:'flex',alignItems:'center',justifyContent:'center',padding:'0 24px'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
            <p style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 6px'}}>今天互動了 ✓</p>
            <p style={{fontSize:13,color:'#6B7280',margin:'0 0 14px'}}>可以加一點備註（選填）</p>
            <textarea value={noteInput} onChange={e=>setNoteInput(e.target.value)}
              placeholder="例：聊了工作壓力，對產品有興趣…" rows={3}
              style={{width:'100%',borderRadius:10,border:'1px solid #E5E7EB',
                padding:'10px 12px',fontSize:14,resize:'none',boxSizing:'border-box',outline:'none'}} />
            <div style={{display:'flex',gap:10,marginTop:14}}>
              <button onClick={()=>setShowNoteModal(false)}
                style={{flex:1,padding:'11px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,cursor:'pointer',color:'#6B7280'}}>取消</button>
              <button onClick={confirmContact} disabled={marking}
                style={{flex:2,padding:'11px',borderRadius:10,border:'none',
                  background:'#22C55E',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                {marking?'儲存中…':'確認儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增互動紀錄 Modal — 上下分成可捲動區 + 固定按鈕區 */}
      {showAddModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,
          display:'flex',alignItems:'center',justifyContent:'center',padding:'0 24px'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowAddModal(false)}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:400,
            display:'flex',flexDirection:'column',maxHeight:'85vh'}}>

            {/* 可捲動內容區 */}
            <div style={{overflowY:'auto',padding:24,flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <p style={{fontSize:16,fontWeight:700,color:'#111827',margin:0}}>📝 新增互動紀錄</p>
                <button onClick={()=>setShowAddModal(false)}
                  style={{background:'none',border:'none',fontSize:20,color:'#9CA3AF',cursor:'pointer'}}>✕</button>
              </div>

              <div style={{marginBottom:16}}>
                <label style={labelStyle}>日期</label>
                <input type="date" value={addDate} max={today()}
                  onChange={e=>setAddDate(e.target.value)}
                  style={{width:'100%',padding:'10px 12px',borderRadius:10,
                    border:'1px solid #D1D5DB',fontSize:15,boxSizing:'border-box',
                    outline:'none',color:'#374151',background:'#fff'}} />
                {addDate===today()&&(
                  <p style={{fontSize:12,color:'#22C55E',margin:'6px 0 0',fontWeight:600}}>今天</p>
                )}
              </div>

              <div style={{marginBottom:8}}>
                <label style={labelStyle}>備註 <span style={{color:'#9CA3AF',fontSize:12}}>選填</span></label>
                <textarea value={addNote} onChange={e=>setAddNote(e.target.value)}
                  placeholder="例：聊了工作近況、對健康產品感興趣…" rows={3}
                  style={{width:'100%',borderRadius:10,border:'1px solid #E5E7EB',
                    padding:'10px 12px',fontSize:14,resize:'none',
                    boxSizing:'border-box',outline:'none'}} />
              </div>
            </div>

            {/* 固定在底部的按鈕區，不會被捲走 */}
            <div style={{padding:'12px 24px 20px',borderTop:'1px solid #F3F4F6',
              display:'flex',gap:10,flexShrink:0}}>
              <button onClick={()=>setShowAddModal(false)}
                style={{flex:1,padding:'11px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,cursor:'pointer',color:'#6B7280'}}>取消</button>
              <button onClick={confirmAddLog} disabled={addSaving}
                style={{flex:2,padding:'11px',borderRadius:10,border:'none',
                  background:'#2563EB',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                {addSaving?'儲存中…':'確認新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯備註 Modal */}
      {editingLog && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,
          display:'flex',alignItems:'center',justifyContent:'center',padding:'0 24px'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
            <p style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 6px'}}>編輯備註</p>
            <p style={{fontSize:13,color:'#6B7280',margin:'0 0 14px'}}>{formatDateDisplay(editingLog.date)}</p>
            <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} rows={3}
              style={{width:'100%',borderRadius:10,border:'1px solid #E5E7EB',
                padding:'10px 12px',fontSize:14,resize:'none',boxSizing:'border-box',outline:'none'}} />
            <div style={{display:'flex',gap:10,marginTop:14}}>
              <button onClick={()=>setEditingLog(null)}
                style={{flex:1,padding:'11px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,cursor:'pointer',color:'#6B7280'}}>取消</button>
              <button onClick={confirmEditLog}
                style={{flex:2,padding:'11px',borderRadius:10,border:'none',
                  background:'#2563EB',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>儲存</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:'#fff',padding:'52px 0 16px',borderBottom:'1px solid #F3F4F6'}}>
      <div className="dash-container" style={{padding:'0 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <button onClick={()=>navigate(-1)}
            style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151'}}>←</button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>navigate(`/contacts/${id}/edit`)}
              style={{background:'none',border:'1px solid #E5E7EB',borderRadius:8,
                padding:'6px 12px',fontSize:13,cursor:'pointer',color:'#374151'}}>✎ 編輯</button>
            <button onClick={handleArchive}
              style={{background:'none',border:'1px solid #E5E7EB',borderRadius:8,
                padding:'6px 12px',fontSize:13,cursor:'pointer',color:'#9CA3AF'}}>封存</button>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14,marginTop:16}}>
          <div style={{width:56,height:56,borderRadius:'50%',background:avatarBg(contact.name),
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'#fff',fontWeight:800,fontSize:22}}>
            {contact.name[0]}
          </div>
          <div>
            <h1 style={{fontSize:20,fontWeight:800,color:'#111827',margin:0}}>{contact.name}</h1>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
              {contact.occupation&&<span style={{fontSize:13,color:'#6B7280'}}>{contact.occupation}</span>}
              {contact.region&&<span style={{fontSize:13,color:'#9CA3AF'}}>· {contact.region}</span>}
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="dash-container" style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>

        {suggestedAction && (
          <div style={{background:'#2563EB',borderRadius:14,padding:'14px 16px'}}>
            <p style={{margin:'0 0 4px',fontSize:12,color:'#93C5FD',fontWeight:600}}>建議行動</p>
            <p style={{margin:0,fontSize:18,fontWeight:800,color:'#fff'}}>{suggestedAction}</p>
            {contact.next_contact_date && (
              <p style={{margin:'6px 0 0',fontSize:12,color:'#BFDBFE'}}>
                下次互動建議：{formatDateDisplay(contact.next_contact_date)}
              </p>
            )}
          </div>
        )}

        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px'}}>
          <p style={{fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 10px'}}>關係資訊</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {contact.egg_type&&(
              <span style={{fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:8,
                background:getEggBg(contact.egg_type),color:getEggColor(contact.egg_type)}}>
                {contact.egg_type}
              </span>
            )}
            {contact.need_level&&(
              <span style={{fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:8,
                background:'#F3F4F6',color:'#374151'}}>{contact.need_level}</span>
            )}
            {contact.action_type&&(
              <span style={{fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:8,
                background:'#F3F4F6',color:'#374151'}}>{contact.action_type}</span>
            )}
          </div>
          {contact.platform&&(
            <p style={{fontSize:13,color:'#6B7280',margin:'10px 0 0'}}>
              {contact.platform}：{contact.platform_account||'—'}
            </p>
          )}
          {contact.note&&(
            <p style={{fontSize:13,color:'#6B7280',margin:'6px 0 0'}}>認識管道：{contact.note}</p>
          )}
        </div>

        {(contact.pain_point||contact.asked_products)&&(
          <div style={{background:'#fff',borderRadius:14,padding:'14px 16px'}}>
            {contact.pain_point&&(
              <p style={{fontSize:13,color:'#374151',margin:'0 0 6px'}}>
                <span style={{fontWeight:700}}>痛點：</span>{contact.pain_point}
              </p>
            )}
            {contact.asked_products&&(
              <p style={{fontSize:13,color:'#374151',margin:0}}>
                <span style={{fontWeight:700}}>詢問產品：</span>{contact.asked_products}
              </p>
            )}
          </div>
        )}

        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px'}}>
          <p style={{fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 10px'}}>互動紀錄</p>
          {logs.length===0&&(
            <p style={{fontSize:13,color:'#9CA3AF',margin:0}}>還沒有互動紀錄</p>
          )}
          {logs.map((log,i)=>(
            <div key={log.id} style={{display:'flex',gap:10,alignItems:'flex-start',
              marginBottom:i<logs.length-1?12:0,paddingBottom:i<logs.length-1?12:0,
              borderBottom:i<logs.length-1?'1px solid #F3F4F6':'none'}}>
              <div style={{width:8,height:8,borderRadius:'50%',
                background:i===0?'#22C55E':'#D1D5DB',marginTop:5,flexShrink:0}}/>
              <div style={{flex:1}}>
                <p style={{fontSize:13,color:'#374151',margin:0,fontWeight:600}}>
                  {formatDateDisplay(log.date)}
                  {i===0&&<span style={{fontSize:12,color:'#22C55E',marginLeft:6}}>最近</span>}
                </p>
                {log.note
                  ? <p style={{fontSize:13,color:'#6B7280',margin:'3px 0 0'}}>{log.note}</p>
                  : <p style={{fontSize:12,color:'#D1D5DB',margin:'3px 0 0'}}>無備註</p>
                }
              </div>
              <div style={{display:'flex',gap:8,flexShrink:0}}>
                <button onClick={()=>handleEditLog(log)}
                  style={{background:'none',border:'none',fontSize:13,
                    color:'#9CA3AF',cursor:'pointer',padding:'2px 4px'}}>編輯</button>
                <button onClick={()=>handleDeleteLog(log.id)}
                  style={{background:'none',border:'none',fontSize:13,
                    color:'#EF4444',cursor:'pointer',padding:'2px 4px'}}>刪除</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部按鈕 */}
      <div className="dash-container" style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',
        width:'100%',padding:'12px 16px',background:'#fff',
        borderTop:'1px solid #F3F4F6',display:'flex',gap:10,boxSizing:'border-box'}}>
        <button onClick={openAddModal}
          style={{flex:1,padding:'13px',borderRadius:12,border:'1px solid #E5E7EB',
            background:'#F9FAFB',color:'#374151',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          📝 新增互動紀錄
        </button>
        <button onClick={handleTodayContact}
          style={{flex:1,padding:'13px',borderRadius:12,border:'none',
            background:'#22C55E',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          ✓ 今天互動了
        </button>
      </div>
    </div>
  )
}

const labelStyle = {fontSize:13,color:'#374151',fontWeight:600,display:'block',marginBottom:6}
