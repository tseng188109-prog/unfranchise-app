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
function today(){return new Date().toISOString().split('T')[0]}
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

  useEffect(() => { fetchContact() }, [id])

  async function fetchContact() {
    setLoading(true)
    const { data } = await supabase.from('contacts')
      .select('*').eq('id', id).single()
    if (data) setContact(data)

    // 互動紀錄（從 counter_logs 撈）
    const { data: logData } = await supabase.from('counter_logs')
      .select('date,note,product_name')
      .eq('contact_id', id)
      .order('date', { ascending: false })
      .limit(10)
    if (logData) setLogs(logData)

    setLoading(false)
  }

  async function handleTodayContact() {
    setMarking(true)
    const todayStr = today()
    const actionType = contact.action_type
    const days = DAYS_MAP[actionType] || 30
    const next = new Date()
    next.setDate(next.getDate() + days)
    const nextStr = next.toISOString().split('T')[0]

    await supabase.from('contacts').update({
      last_contact_date: todayStr,
      next_contact_date: nextStr,
    }).eq('id', id)

    // 自動更新每日打卡的每日3互動
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('daily_checkins').upsert({
      user_id: user.id, date: todayStr,
      task_key: 'daily_3_contacts', is_done: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date,task_key' })

    setMarking(false)
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
      {/* Header */}
      <div style={{background:'#fff',padding:'52px 16px 16px',borderBottom:'1px solid #F3F4F6'}}>
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

        {/* 頭像 + 姓名 */}
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

      <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>

        {/* 建議行動（藍底） */}
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

        {/* 關係資訊 */}
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

        {/* 痛點 / 產品 */}
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

        {/* 互動紀錄 */}
        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px'}}>
          <p style={{fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 10px'}}>互動紀錄</p>
          {contact.last_contact_date&&(
            <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:8}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'#22C55E',marginTop:5,flexShrink:0}}/>
              <div>
                <p style={{fontSize:13,color:'#374151',margin:0,fontWeight:600}}>
                  {formatDateDisplay(contact.last_contact_date)} · 最近互動
                </p>
              </div>
            </div>
          )}
          {logs.length===0&&!contact.last_contact_date&&(
            <p style={{fontSize:13,color:'#9CA3AF',margin:0}}>還沒有互動紀錄</p>
          )}
          {logs.map((log,i)=>(
            <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:8}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'#D1D5DB',marginTop:5,flexShrink:0}}/>
              <div>
                <p style={{fontSize:13,color:'#374151',margin:0}}>
                  {formatDateDisplay(log.date)}
                  {log.product_name&&` · ${log.product_name}`}
                </p>
                {log.note&&<p style={{fontSize:12,color:'#9CA3AF',margin:'2px 0 0'}}>{log.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部按鈕 */}
      <div style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',
        width:'100%',maxWidth:430,padding:'12px 16px',background:'#fff',
        borderTop:'1px solid #F3F4F6',display:'flex',gap:10,boxSizing:'border-box'}}>
        <button onClick={handleTodayContact} disabled={marking}
          style={{flex:1,padding:'13px',borderRadius:12,border:'none',
            background:marking?'#86EFAC':'#22C55E',color:'#fff',
            fontSize:14,fontWeight:700,cursor:'pointer'}}>
          {marking?'記錄中…':'✓ 今天互動了'}
        </button>
        <button onClick={()=>navigate('/customers')}
          style={{flex:1,padding:'13px',borderRadius:12,
            border:'1px solid #E5E7EB',background:'#fff',
            fontSize:14,fontWeight:700,cursor:'pointer',color:'#374151'}}>
          顧客紀錄
        </button>
      </div>
    </div>
  )
}