import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

const BV_GOAL = 1500
const IBV_GOAL = 300
const DAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']
const DAILY_TASKS = [
  { key: 'goal_declaration', label: '目標宣言' },
  { key: 'ig_story', label: 'IG 限動' },
  { key: 'daily_3_contacts', label: '每日3互動', special: true },
  { key: 'daily_practice', label: '每日練習' },
  { key: 'listen_recording', label: '聽錄音' },
  { key: 'backend_announcement', label: '後台公告' },
]

function today() { return new Date().toISOString().split('T')[0] }
function formatDate(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((new Date(today()) - new Date(dateStr)) / 86400000)
  if (diff === 0) return '今天到期'
  if (diff > 0) return `逾期${diff}天`
  return `${Math.abs(diff)}天後`
}
function isOverdue(d) { return d && d < today() }
function isDueToday(d) { return d === today() }
function getEggColor(t) { return t==='茶葉蛋'?'#F97316':t==='荷包蛋'?'#3B82F6':t==='生雞蛋'?'#22C55E':'#9CA3AF' }
function getEggBg(t) { return t==='茶葉蛋'?'#FFF7ED':t==='荷包蛋'?'#EFF6FF':t==='生雞蛋'?'#F0FDF4':'#F9FAFB' }
function avatarBg(name) {
  const colors=['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n=0; for(let i=0;i<name.length;i++) n+=name.charCodeAt(i)
  return colors[n%colors.length]
}

function Avatar({ name, size=36 }) {
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',background:avatarBg(name||''),
      display:'flex',alignItems:'center',justifyContent:'center',
      color:'#fff',fontWeight:700,fontSize:size*0.42,flexShrink:0 }}>
      {name?name[0]:'?'}
    </div>
  )
}
function ProgressBar({ value, max, color }) {
  const pct = max>0 ? Math.min((value/max)*100,100) : 0
  return (
    <div style={{ background:'#F3F4F6',borderRadius:999,height:8,overflow:'hidden' }}>
      <div style={{ width:`${pct}%`,height:'100%',borderRadius:999,background:color,
        transition:'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </div>
  )
}
function QuickBtn({ icon, label, onClick, color }) {
  return (
    <button onClick={onClick}
      onMouseDown={e=>e.currentTarget.style.transform='scale(0.96)'}
      onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
      style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,
        padding:'12px 8px',borderRadius:14,border:`1.5px solid ${color}22`,
        background:`${color}0D`,cursor:'pointer',transition:'all 0.15s' }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <span style={{ fontSize:12,fontWeight:600,color,whiteSpace:'nowrap' }}>{label}</span>
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [bvTotal, setBvTotal] = useState(0)
  const [ibvTotal, setIbvTotal] = useState(0)
  const [profit, setProfit] = useState(0)
  const [overdueContacts, setOverdueContacts] = useState([])
  const [todayDueContacts, setTodayDueContacts] = useState([])
  const [checkins, setCheckins] = useState({})
  const [todayContacted, setTodayContacted] = useState([])
  const [checkTotal, setCheckTotal] = useState(0)
  const [weekStatus, setWeekStatus] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchAll() }, [user])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchProfile(),fetchMonthlyStats(),fetchFollowUps(),
      fetchTodayCheckin(),fetchWeekStatus(),fetchTodayContacted()])
    setLoading(false)
  }

  async function fetchProfile() {
    const { data } = await supabase.from('users').select('name').eq('id',user.id).single()
    if (data) setProfile(data)
  }

  async function fetchMonthlyStats() {
  const now = new Date()
  const month = now.getMonth() // 0-11
  const quarterStartMonth = Math.floor(month / 3) * 3
  const quarterStart = `${now.getFullYear()}-${String(quarterStartMonth + 1).padStart(2,'0')}-01`

  const { data } = await supabase.from('transactions').select('type,points,amount,cost')
    .eq('user_id',user.id).gte('date',quarterStart)
  if (!data) return
  let bv=0,ibv=0,p=0
  data.forEach(t => {
    if(t.type==='BV') bv+=t.points
    if(t.type==='IBV') ibv+=t.points
    p += (t.amount||0)-(t.cost||0)
  })
  setBvTotal(bv); setIbvTotal(ibv); setProfit(p)
}

  async function fetchFollowUps() {
    const { data } = await supabase.from('contacts')
      .select('id,name,occupation,egg_type,action_type,next_contact_date')
      .eq('user_id',user.id).eq('is_archived',false)
      .lte('next_contact_date',today()).order('next_contact_date',{ascending:true}).limit(20)
    if (!data) return
    setTodayDueContacts(data.filter(c=>isDueToday(c.next_contact_date)))
    setOverdueContacts(data.filter(c=>isOverdue(c.next_contact_date)))
  }

  async function fetchTodayCheckin() {
    const { data } = await supabase.from('daily_checkins')
      .select('task_key,is_done').eq('user_id',user.id).eq('date',today())
    const map={}
    if(data) data.forEach(d=>{ map[d.task_key]=d.is_done })
    setCheckins(map)
    setCheckTotal(data ? data.filter(d=>d.is_done).length : 0)
  }

  async function fetchTodayContacted() {
    const { data } = await supabase.from('contacts').select('name')
      .eq('user_id',user.id).eq('last_contact_date',today()).limit(5)
    if(data) setTodayContacted(data.map(c=>c.name))
  }

  async function fetchWeekStatus() {
    const now = new Date()
    const dow = now.getDay()
    const days = []
    for(let i=0;i<7;i++){
      const d=new Date(now); d.setDate(now.getDate()-dow+i)
      days.push(d.toISOString().split('T')[0])
    }
    const { data } = await supabase.from('daily_checkins')
      .select('date,is_done').eq('user_id',user.id).in('date',days)
    const sm={}
    if(data) days.forEach(d=>{
      const dc=data.filter(c=>c.date===d)
      if(dc.length===0) sm[d]='none'
      else if(dc.filter(c=>c.is_done).length===DAILY_TASKS.length) sm[d]='full'
      else sm[d]='partial'
    })
    setWeekStatus(days.map(d=>({date:d,status:sm[d]||'none'})))
  }

  async function toggleCheckin(key) {
    const cur=checkins[key], nv=!cur
    setCheckins(p=>({...p,[key]:nv}))
    setCheckTotal(p=>nv?p+1:p-1)
    const { error } = await supabase.from('daily_checkins').upsert(
      { user_id:user.id,date:today(),task_key:key,is_done:nv,updated_at:new Date().toISOString() },
      { onConflict:'user_id,date,task_key' }
    )
    if(error){ setCheckins(p=>({...p,[key]:cur})); setCheckTotal(p=>nv?p-1:p+1) }
  }

  const displayName = profile?.name || user?.email?.split('@')[0] || 'Annie'
  const todayStr = (()=>{
    const d=new Date()
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} 星期${DAYS_ZH[d.getDay()]}`
  })()
  const allDue = [...overdueContacts,...todayDueContacts]

  if(loading) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <div style={{ width:36,height:36,borderRadius:'50%',border:'3px solid #E5E7EB',
        borderTopColor:'#3B82F6',animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:'#9CA3AF',marginTop:16,fontSize:14 }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ maxWidth:430,margin:'0 auto',background:'#F8FAFC',minHeight:'100vh' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',
        padding:'52px 20px 20px',background:'linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%)' }}>
        <div>
          <p style={{ fontSize:22,fontWeight:800,color:'#fff',margin:0 }}>嗨，{displayName} 👋</p>
          <p style={{ fontSize:13,color:'#93C5FD',margin:'4px 0 0' }}>{todayStr}</p>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button style={{ background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',
            width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>🔔</span>
          </button>
          <button onClick={()=>navigate('/settings')}
            style={{ background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',
            width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>⚙️</span>
          </button>
        </div>
      </div>

      {/* 業績 */}
      <section style={{ background:'#fff',borderRadius:16,margin:'12px 16px 0',padding:16,boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <span style={{ fontSize:15,fontWeight:700,color:'#111827' }}>本季業績進度</span>
          <button style={{ fontSize:12,color:'#3B82F6',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}
            onClick={()=>navigate('/transactions')}>查看詳情 →</button>
        </div>
        <div style={{ display:'flex',gap:16,marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
              <span style={{ fontSize:13,fontWeight:800,color:'#F97316' }}>BV</span>
              <span style={{ fontSize:16,fontWeight:700 }}>{bvTotal.toFixed(0)} <span style={{ color:'#9CA3AF',fontSize:13 }}>/ {BV_GOAL}</span></span>
            </div>
            <ProgressBar value={bvTotal} max={BV_GOAL} color="#F97316" />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
              <span style={{ fontSize:13,fontWeight:800,color:'#3B82F6' }}>IBV</span>
              <span style={{ fontSize:16,fontWeight:700 }}>{ibvTotal.toFixed(0)} <span style={{ color:'#9CA3AF',fontSize:13 }}>/ {IBV_GOAL}</span></span>
            </div>
            <ProgressBar value={ibvTotal} max={IBV_GOAL} color="#3B82F6" />
          </div>
        </div>
        <div style={{ display:'flex',justifyContent:'space-between',paddingTop:12,borderTop:'1px solid #F3F4F6' }}>
          <span style={{ color:'#6B7280',fontSize:13 }}>本月獲利</span>
          <span style={{ color:profit>=0?'#16A34A':'#DC2626',fontWeight:700,fontSize:17 }}>
            NT${profit.toLocaleString()}
          </span>
        </div>
      </section>

      {/* 待跟進 */}
      <section style={{ background:'#fff',borderRadius:16,margin:'12px 16px 0',padding:16,boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <span style={{ fontSize:15,fontWeight:700,color:'#111827',display:'flex',alignItems:'center',gap:8 }}>
            待跟進
            {allDue.length>0 && <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99,background:'#FEF2F2',color:'#DC2626' }}>{allDue.length} 人今天</span>}
          </span>
          <button style={{ fontSize:12,color:'#3B82F6',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}
            onClick={()=>navigate('/contacts?filter=due')}>全部 →</button>
        </div>
        {allDue.length===0
          ? <p style={{ fontSize:14,color:'#9CA3AF',textAlign:'center',padding:'16px 0',margin:0 }}>今天沒有待跟進的聯絡人 🎉</p>
          : <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {allDue.slice(0,5).map(c=>{
                const ov=isOverdue(c.next_contact_date)
                return (
                  <button key={c.id} onClick={()=>navigate(`/contacts/${c.id}`)}
                    style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,width:'100%',
                      background:ov?'#FFF5F5':'#F9FAFB',border:`1px solid ${ov?'#FECACA':'#F3F4F6'}`,
                      cursor:'pointer',textAlign:'left' }}>
                    <Avatar name={c.name} size={38} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ fontSize:15,fontWeight:700,color:'#111827' }}>{c.name}</span>
                        <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:6,
                          background:getEggBg(c.egg_type),color:getEggColor(c.egg_type) }}>{c.egg_type}</span>
                      </div>
                      <div style={{ fontSize:12,color:'#9CA3AF',marginTop:2,display:'flex',gap:4 }}>
                        {c.occupation&&<span>{c.occupation}</span>}{c.occupation&&<span>·</span>}
                        <span>{c.action_type}</span>
                      </div>
                    </div>
                    <span style={{ fontSize:12,fontWeight:600,whiteSpace:'nowrap',color:ov?'#DC2626':'#F97316' }}>
                      {formatDate(c.next_contact_date)}
                    </span>
                  </button>
                )
              })}
            </div>
        }
      </section>

      {/* 快捷 */}
      <section style={{ background:'#fff',borderRadius:16,margin:'12px 16px 0',padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex',gap:10 }}>
          <QuickBtn icon="👥" label="+互動" color="#3B82F6" onClick={()=>navigate('/contacts/new')} />
          <QuickBtn icon="📊" label="+業績" color="#F97316" onClick={()=>navigate('/transactions/new')} />
          <QuickBtn icon="🔍" label="查顧客" color="#22C55E" onClick={()=>navigate('/customers')} />
        </div>
      </section>

      {/* 打卡 */}
      <section style={{ background:'#fff',borderRadius:16,margin:'12px 16px 0',padding:16,boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
          <span style={{ fontSize:15,fontWeight:700,color:'#111827' }}>今日打卡</span>
          <span style={{ fontSize:13,color:'#6B7280' }}>{checkTotal}/{DAILY_TASKS.length}</span>
        </div>
        <div style={{ display:'flex',justifyContent:'space-between',padding:'8px 4px',background:'#F8FAFC',borderRadius:10,marginBottom:4 }}>
          {weekStatus.map((w,i)=>{
            const isT=w.date===today()
            const dc=w.status==='full'?'#22C55E':w.status==='partial'?'#F97316':'#E5E7EB'
            return (
              <div key={i} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                <span style={{ fontSize:11,color:isT?'#3B82F6':'#9CA3AF',fontWeight:isT?700:400 }}>
                  {DAYS_ZH[new Date(w.date+'T00:00:00').getDay()]}
                </span>
                <div style={{ width:10,height:10,borderRadius:'50%',background:dc,
                  outline:isT?'2px solid #3B82F6':'none',outlineOffset:2 }} />
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:2,marginTop:8 }}>
          {DAILY_TASKS.map(task=>{
            const done=!!checkins[task.key]
            return (
              <button key={task.key} onClick={()=>toggleCheckin(task.key)}
                style={{ display:'flex',alignItems:'center',gap:12,padding:'8px 0',
                  borderBottom:'1px solid #F9FAFB',background:'none',border:'none',
                  cursor:'pointer',width:'100%',textAlign:'left' }}>
                <div style={{ width:20,height:20,borderRadius:6,flexShrink:0,
                  border:done?'none':'2px solid #D1D5DB',background:done?'#22C55E':'#fff',
                  display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}>
                  {done&&<span style={{ fontSize:11,color:'#fff' }}>✓</span>}
                </div>
                <span style={{ fontSize:14,color:done?'#9CA3AF':'#374151',textDecoration:done?'line-through':'none',flex:1 }}>
                  {task.label}
                  {task.special&&todayContacted.length>0&&(
                    <span style={{ color:'#22C55E',fontWeight:600,marginLeft:6 }}>
                      {todayContacted.join('、')} ✓
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div style={{ height:80 }} />
    </div>
  )
}

if(typeof document!=='undefined'&&!document.getElementById('dash-anim')){
  const s=document.createElement('style'); s.id='dash-anim'
  s.textContent='@keyframes spin{to{transform:rotate(360deg)}}'
  document.head.appendChild(s)
}