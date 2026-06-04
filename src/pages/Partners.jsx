import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < (name||'').length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}`
}

function formatDateFull(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getMonth()+1}/${dt.getDate()}`
}

function todayTW() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

const MY_ID = '2a59a0ae-9877-45dd-b26b-66f8ed6dff74'

export default function Partners() {
  const [user, setUser] = useState(null)
  const [partners, setPartners] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  // 公告
  const [announcements, setAnnouncements] = useState([])
  const [showAnnForm, setShowAnnForm] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annPinned, setAnnPinned] = useState(false)
  const [annSaving, setAnnSaving] = useState(false)

  // 側邊面板
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [panelDetail, setPanelDetail] = useState(null)
  const [panelLoading, setPanelLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    if (user) {
      fetchPartners()
      fetchAnnouncements()
    }
  }, [user])

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)
    setAnnouncements(data || [])
  }

  async function postAnnouncement() {
    if (!annTitle.trim() || !annContent.trim()) return
    setAnnSaving(true)
    await supabase.from('announcements').insert({
      author_id: user.id,
      title: annTitle.trim(),
      content: annContent.trim(),
      is_pinned: annPinned,
    })
    setAnnTitle(''); setAnnContent(''); setAnnPinned(false)
    setShowAnnForm(false)
    setAnnSaving(false)
    fetchAnnouncements()
  }

  async function deleteAnnouncement(id) {
    await supabase.from('announcements').delete().eq('id', id)
    fetchAnnouncements()
  }

  async function fetchPartners() {
    setLoading(true)
    const { data: partnerUsers } = await supabase
      .from('users')
      .select('id,name,created_at')
      .eq('referrer_id', user.id)

    if (partnerUsers && partnerUsers.length > 0) {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
      const todayDay = parseInt(todayTW().split('-')[2])

      const enriched = await Promise.all(partnerUsers.map(async p => {
        const { data: bvData } = await supabase.rpc('get_partner_monthly_bv', {
          partner_id: p.id, month_start: monthStart,
        })
        const bv = bvData?.[0]?.bv || 0
        const ibv = bvData?.[0]?.ibv || 0

        const { data: checkinData } = await supabase.rpc('get_partner_checkin_rate', {
          partner_id: p.id, month_start: monthStart, today_day: todayDay,
        })
        const checkinRate = Number(checkinData) || 0

        const { count } = await supabase.from('users')
          .select('id', { count:'exact', head:true }).eq('referrer_id', p.id)

        const bvRate = Math.min(100, Math.round((bv / 1500) * 100))
        const ibvRate = Math.min(100, Math.round((ibv / 300) * 100))
        const isActive = bvRate >= 30 || checkinRate >= 50

        return { ...p, bv, ibv, bvRate, ibvRate, checkinRate, directCount: count||0, isActive }
      }))

      setPartners(enriched)
    } else {
      setPartners([])
    }

    const { data: pendingData } = await supabase
      .from('users')
      .select('id,name,created_at')
      .ilike('referrer_email_pending', user.email)
    setPending(pendingData || [])
    setLoading(false)
  }

  async function confirmPartner(partnerId) {
    await supabase.from('users').update({
      referrer_id: user.id,
      referrer_email_pending: null,
    }).eq('id', partnerId)
    fetchPartners()
  }

  async function openPanel(p) {
    setSelectedPartner(p)
    setPanelDetail(null)
    setPanelLoading(true)

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`

    // 最近10筆打卡
    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('checkin_date, note')
      .eq('user_id', p.id)
      .gte('checkin_date', monthStart)
      .order('checkin_date', { ascending: false })
      .limit(10)

    // 互動名單數
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('id', { count:'exact', head:true })
      .eq('user_id', p.id)

    // 本月業績筆數
    const { data: txData } = await supabase.rpc('get_partner_monthly_bv', {
      partner_id: p.id, month_start: monthStart,
    })

    setPanelDetail({
      checkins: checkins || [],
      contactCount: contactCount || 0,
      bv: txData?.[0]?.bv || 0,
      ibv: txData?.[0]?.ibv || 0,
    })
    setPanelLoading(false)
  }

  const isAdmin = user?.id === MY_ID

  return (
    <div style={{ background:'#F8FAFC', minHeight:'100vh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2563EB)',
        padding:'52px 20px 20px' }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:'#fff', margin:0 }}>我的夥伴</h1>
        <p style={{ fontSize:13, color:'#93C5FD', margin:'4px 0 0' }}>
          直屬 {partners.length} 人
        </p>
      </div>

      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* 公告板 */}
        <div style={{ background:'#fff', borderRadius:14, padding:14,
          boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center',
            justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:16 }}>📢</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#111827' }}>團隊公告</span>
            </div>
            {isAdmin && (
              <button onClick={() => setShowAnnForm(!showAnnForm)}
                style={{ padding:'5px 12px', borderRadius:8, border:'none',
                  background:'#2563EB', color:'#fff', fontWeight:700,
                  fontSize:12, cursor:'pointer' }}>
                {showAnnForm ? '取消' : '+ 發公告'}
              </button>
            )}
          </div>

          {/* 發公告表單 */}
          {isAdmin && showAnnForm && (
            <div style={{ background:'#F0F7FF', borderRadius:10, padding:12,
              marginBottom:10, display:'flex', flexDirection:'column', gap:8 }}>
              <input value={annTitle} onChange={e => setAnnTitle(e.target.value)}
                placeholder="公告標題"
                style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #BFDBFE',
                  fontSize:14, outline:'none', width:'100%', boxSizing:'border-box' }} />
              <textarea value={annContent} onChange={e => setAnnContent(e.target.value)}
                placeholder="公告內容…"
                rows={3}
                style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #BFDBFE',
                  fontSize:14, outline:'none', width:'100%', boxSizing:'border-box',
                  resize:'none', fontFamily:'inherit' }} />
              <label style={{ display:'flex', alignItems:'center', gap:6,
                fontSize:13, color:'#374151', cursor:'pointer' }}>
                <input type="checkbox" checked={annPinned}
                  onChange={e => setAnnPinned(e.target.checked)} />
                置頂
              </label>
              <button onClick={postAnnouncement} disabled={annSaving}
                style={{ padding:'8px', borderRadius:8, border:'none',
                  background:'#2563EB', color:'#fff', fontWeight:700,
                  fontSize:13, cursor:'pointer' }}>
                {annSaving ? '發布中…' : '發布'}
              </button>
            </div>
          )}

          {/* 公告列表 */}
          {announcements.length === 0 ? (
            <p style={{ fontSize:13, color:'#9CA3AF', textAlign:'center',
              padding:'12px 0', margin:0 }}>尚無公告</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {announcements.map(a => (
                <div key={a.id} style={{ background: a.is_pinned ? '#FFF7ED' : '#F8FAFC',
                  borderRadius:10, padding:'10px 12px',
                  border: a.is_pinned ? '1px solid #FED7AA' : '1px solid #F1F5F9' }}>
                  <div style={{ display:'flex', alignItems:'flex-start',
                    justifyContent:'space-between', gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4,
                        marginBottom:3 }}>
                        {a.is_pinned && (
                          <span style={{ fontSize:10, background:'#F97316',
                            color:'#fff', padding:'1px 5px', borderRadius:99,
                            fontWeight:700 }}>置頂</span>
                        )}
                        <span style={{ fontSize:13, fontWeight:700,
                          color:'#111827' }}>{a.title}</span>
                      </div>
                      <p style={{ fontSize:12, color:'#6B7280', margin:'0 0 3px',
                        lineHeight:1.5 }}>{a.content}</p>
                      <p style={{ fontSize:11, color:'#9CA3AF', margin:0 }}>
                        {new Date(a.created_at).toLocaleDateString('zh-TW',
                          { timeZone:'Asia/Taipei', month:'numeric', day:'numeric' })}
                      </p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteAnnouncement(a.id)}
                        style={{ background:'none', border:'none', color:'#9CA3AF',
                          cursor:'pointer', fontSize:16, padding:'0 2px',
                          lineHeight:1, flexShrink:0 }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 夥伴列表 */}
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>載入中…</div>
        ) : partners.length === 0 && pending.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
            <p style={{ fontSize:36, margin:'0 0 12px' }}>👥</p>
            <p style={{ fontSize:15 }}>還沒有直屬夥伴，邀請夥伴加入並填寫你的 Email</p>
          </div>
        ) : (
          <>
            {partners.map(p => (
              <div key={p.id}
                onClick={() => openPanel(p)}
                style={{ background:'#fff', borderRadius:14, padding:14,
                  boxShadow:'0 1px 3px rgba(0,0,0,0.07)', cursor:'pointer',
                  transition:'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.07)'}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                  <div style={{ width:44, height:44, borderRadius:'50%',
                    background:avatarBg(p.name||'?'),
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:700, fontSize:17, flexShrink:0 }}>
                    {(p.name||'?')[0]}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>
                        {p.name||'未命名'}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px',
                        borderRadius:99,
                        background:p.isActive?'#DCFCE7':'#FEF9C3',
                        color:p.isActive?'#16A34A':'#CA8A04' }}>
                        {p.isActive?'活躍':'待關注'}
                      </span>
                    </div>
                    <p style={{ fontSize:12, color:'#9CA3AF', margin:'2px 0 0' }}>
                      加入 {formatDate(p.created_at)} · 直屬 {p.directCount} 人
                    </p>
                  </div>
                  <span style={{ fontSize:18, color:'#D1D5DB' }}>›</span>
                </div>

                <div style={{ display:'flex', gap:8 }}>
                  {[
                    { label:'BV達成', value:p.bvRate, color:'#F97316' },
                    { label:'IBV達成', value:p.ibvRate, color:'#3B82F6' },
                    { label:'打卡率', value:p.checkinRate, color:'#22C55E' },
                  ].map(m => (
                    <div key={m.label} style={{ flex:1, background:'#F8FAFC',
                      borderRadius:10, padding:'8px', textAlign:'center' }}>
                      <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 4px',
                        fontWeight:600 }}>{m.label}</p>
                      <p style={{ fontSize:16, fontWeight:800, color:m.color,
                        margin:0 }}>{m.value}%</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {pending.length > 0 && (
              <div style={{ background:'#FFF7ED', borderRadius:14, padding:14,
                border:'1px solid #FED7AA' }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#F97316',
                  margin:'0 0 10px' }}>待確認串聯</p>
                {pending.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center',
                    justifyContent:'space-between', padding:'8px 0',
                    borderBottom:'1px solid #FED7AA' }}>
                    <div>
                      <p style={{ fontSize:14, color:'#374151', margin:0,
                        fontWeight:600 }}>{p.name || '未命名'}</p>
                      <p style={{ fontSize:12, color:'#9CA3AF', margin:'2px 0 0' }}>
                        填了你的 email 申請加入
                      </p>
                    </div>
                    <button onClick={() => confirmPartner(p.id)}
                      style={{ padding:'7px 14px', borderRadius:9, border:'none',
                        background:'#F97316', color:'#fff', fontWeight:700,
                        fontSize:13, cursor:'pointer' }}>確認</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 側邊面板 Overlay */}
      {selectedPartner && (
        <>
          <div onClick={() => setSelectedPartner(null)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
              zIndex:100 }} />
          <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'88%',
            maxWidth:380, background:'#fff', zIndex:101,
            display:'flex', flexDirection:'column',
            boxShadow:'-4px 0 20px rgba(0,0,0,0.15)',
            animation:'slideIn 0.25s ease' }}>

            {/* 面板 Header */}
            <div style={{ background:`linear-gradient(135deg,${avatarBg(selectedPartner.name)},${avatarBg(selectedPartner.name)}cc)`,
              padding:'48px 16px 20px' }}>
              <button onClick={() => setSelectedPartner(null)}
                style={{ position:'absolute', top:52, left:16, background:'rgba(255,255,255,0.25)',
                  border:'none', color:'#fff', borderRadius:99, width:32, height:32,
                  cursor:'pointer', fontSize:16, display:'flex', alignItems:'center',
                  justifyContent:'center' }}>‹</button>
              <div style={{ display:'flex', alignItems:'center', gap:12,
                paddingLeft:40 }}>
                <div style={{ width:52, height:52, borderRadius:'50%',
                  background:'rgba(255,255,255,0.3)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontWeight:700, fontSize:22 }}>
                  {(selectedPartner.name||'?')[0]}
                </div>
                <div>
                  <p style={{ fontSize:17, fontWeight:800, color:'#fff', margin:0 }}>
                    {selectedPartner.name||'未命名'}
                  </p>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)', margin:'2px 0 0' }}>
                    加入 {formatDate(selectedPartner.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* 面板內容 */}
            <div style={{ flex:1, overflowY:'auto', padding:16,
              display:'flex', flexDirection:'column', gap:12 }}>
              {panelLoading ? (
                <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>
                  載入中…
                </div>
              ) : panelDetail && (
                <>
                  {/* 本月數據 */}
                  <div style={{ background:'#F8FAFC', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#374151',
                      margin:'0 0 10px' }}>📊 本月數據</p>
                    <div style={{ display:'flex', gap:8 }}>
                      {[
                        { label:'BV', value:panelDetail.bv, color:'#F97316', unit:'' },
                        { label:'IBV', value:panelDetail.ibv, color:'#3B82F6', unit:'' },
                        { label:'互動名單', value:panelDetail.contactCount, color:'#22C55E', unit:'人' },
                      ].map(m => (
                        <div key={m.label} style={{ flex:1, background:'#fff',
                          borderRadius:10, padding:'10px 8px', textAlign:'center',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                          <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 4px',
                            fontWeight:600 }}>{m.label}</p>
                          <p style={{ fontSize:17, fontWeight:800, color:m.color,
                            margin:0 }}>{m.value}{m.unit}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 達成率 */}
                  <div style={{ background:'#F8FAFC', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#374151',
                      margin:'0 0 10px' }}>🎯 本月達成率</p>
                    {[
                      { label:'BV（目標1500）', value:selectedPartner.bvRate, color:'#F97316' },
                      { label:'IBV（目標300）', value:selectedPartner.ibvRate, color:'#3B82F6' },
                      { label:'打卡率', value:selectedPartner.checkinRate, color:'#22C55E' },
                    ].map(m => (
                      <div key={m.label} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between',
                          marginBottom:4 }}>
                          <span style={{ fontSize:12, color:'#6B7280' }}>{m.label}</span>
                          <span style={{ fontSize:12, fontWeight:700,
                            color:m.color }}>{m.value}%</span>
                        </div>
                        <div style={{ height:6, background:'#E5E7EB', borderRadius:99 }}>
                          <div style={{ height:'100%', width:`${m.value}%`,
                            background:m.color, borderRadius:99,
                            transition:'width 0.5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 本月打卡紀錄 */}
                  <div style={{ background:'#F8FAFC', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#374151',
                      margin:'0 0 10px' }}>📅 本月打卡（最近10筆）</p>
                    {panelDetail.checkins.length === 0 ? (
                      <p style={{ fontSize:13, color:'#9CA3AF', margin:0,
                        textAlign:'center', padding:'8px 0' }}>本月尚無打卡</p>
                    ) : (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {panelDetail.checkins.map(c => (
                          <div key={c.checkin_date}
                            style={{ background:'#DCFCE7', borderRadius:8,
                              padding:'4px 10px', fontSize:12,
                              color:'#16A34A', fontWeight:600 }}>
                            {formatDateFull(c.checkin_date)}
                            {c.note ? ' 📝' : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}