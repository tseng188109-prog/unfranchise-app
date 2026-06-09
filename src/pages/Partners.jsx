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

function todayTW() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

// 取得本週一（台灣時區）
function getWeekMonday() {
  const today = new Date(todayTW())
  const dow = today.getDay() // 0=日,1=一,...,6=六
  const diff = dow === 0 ? -6 : 1 - dow // 週一為起點
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  return monday.toLocaleDateString('sv-SE')
}

const DAILY_TASKS = [
  { key: 'goal_declaration',     label: '目標宣言' },
  { key: 'backend_announcement', label: '後台公告' },
  { key: 'respond_social',       label: '回應社群' },
  { key: 'daily_practice',       label: '每日練習' },
  { key: 'listen_recording',     label: '聽錄音' },
  { key: 'ig_story',             label: 'IG 限動' },
  { key: 'daily_3_contacts',     label: '每日3互動' },
]

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

  // 打卡明細 popup
  const [dayDetail, setDayDetail] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    if (user) { fetchPartners(); fetchAnnouncements() }
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
    setShowAnnForm(false); setAnnSaving(false)
    fetchAnnouncements()
  }

  async function deleteAnnouncement(id) {
    await supabase.from('announcements').delete().eq('id', id)
    fetchAnnouncements()
  }

  async function fetchPartners() {
    setLoading(true)
    const { data: partnerUsers } = await supabase
      .from('users').select('id,name,created_at').eq('referrer_id', user.id)

    if (partnerUsers && partnerUsers.length > 0) {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
      const todayDay = parseInt(todayTW().split('-')[2])
      const weekMonday = getWeekMonday()
      const todayStr = todayTW()

      const enriched = await Promise.all(partnerUsers.map(async p => {
        // BV / IBV
        const { data: bvData } = await supabase.rpc('get_partner_monthly_bv', {
          partner_id: p.id, month_start: monthStart,
        })
        const bv = bvData?.[0]?.bv || 0
        const ibv = bvData?.[0]?.ibv || 0

        // 本週打卡天數（直接查 daily_checkins，不用 RPC）
        const { data: weekRows } = await supabase
          .from('daily_checkins')
          .select('checkin_date, is_done')
          .eq('user_id', p.id)
          .gte('checkin_date', weekMonday)
          .lte('checkin_date', todayStr)

        // 每天統計有幾項 is_done=true，>=1 就算那天有打卡
        const dayMap = {}
        ;(weekRows || []).forEach(r => {
          if (!dayMap[r.checkin_date]) dayMap[r.checkin_date] = 0
          if (r.is_done) dayMap[r.checkin_date]++
        })
        const weekDays = Object.values(dayMap).filter(count => count >= 1).length

        // 直屬人數
        const { count } = await supabase.from('users')
          .select('id', { count:'exact', head:true }).eq('referrer_id', p.id)

        const bvRate = Math.min(100, Math.round((bv / 1500) * 100))
        const ibvRate = Math.min(100, Math.round((ibv / 300) * 100))
        // 活躍判定：BV 達 30% 或本週打卡 >= 3 天
        const isActive = bvRate >= 30 || weekDays >= 3

        return { ...p, bv, ibv, bvRate, ibvRate, weekDays, directCount: count||0, isActive }
      }))
      setPartners(enriched)
    } else {
      setPartners([])
    }

    const { data: pendingData } = await supabase
      .from('users').select('id,name,created_at')
      .ilike('referrer_email_pending', user.email)
    setPending(pendingData || [])
    setLoading(false)
  }

  async function confirmPartner(partnerId) {
    await supabase.from('users').update({
      referrer_id: user.id, referrer_email_pending: null,
    }).eq('id', partnerId)
    fetchPartners()
  }

  async function openPanel(p) {
    setSelectedPartner(p)
    setPanelDetail(null)
    setDayDetail(null)
    setPanelLoading(true)

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const todayStr = todayTW()

    // 本月所有打卡明細
    const { data: checkinRows } = await supabase.rpc('get_partner_daily_checkins', {
      partner_id: p.id,
      month_start: monthStart,
    })

    // 今日打卡明細（從 checkinRows 裡取今天的）
    const todayTasks = DAILY_TASKS.map(t => {
      const row = (checkinRows || []).find(r => r.checkin_date === todayStr && r.task_key === t.key)
      return { ...t, is_done: row?.is_done === true }
    })
    const todayDoneCount = todayTasks.filter(t => t.is_done).length

    // 互動名單數
    const { count: contactCount } = await supabase
      .from('contacts').select('id', { count:'exact', head:true }).eq('user_id', p.id)

    // BV/IBV
    const { data: txData } = await supabase.rpc('get_partner_monthly_bv', {
      partner_id: p.id, month_start: monthStart,
    })

    // 打卡資料整理成 map
    const checkinMap = {}
    ;(checkinRows || []).forEach(r => {
      if (!checkinMap[r.checkin_date]) checkinMap[r.checkin_date] = {}
      checkinMap[r.checkin_date][r.task_key] = r.is_done
    })

    // 產生本月日曆格子
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const calDays = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dayTasks = checkinMap[dateStr] || {}
      const doneCount = Object.values(dayTasks).filter(Boolean).length
      let status = 'none'
      if (dateStr > todayStr) status = 'future'
      else if (doneCount === 0) status = 'none'
      else if (doneCount >= DAILY_TASKS.length) status = 'full'
      else status = 'partial'
      calDays.push({ dateStr, d, doneCount, status, dayTasks })
    }

    const firstDow = new Date(year, month, 1).getDay()

    setPanelDetail({
      checkinMap, calDays, firstDow,
      contactCount: contactCount || 0,
      bv: txData?.[0]?.bv || 0,
      ibv: txData?.[0]?.ibv || 0,
      todayTasks,
      todayDoneCount,
    })
    setPanelLoading(false)
  }

  function handleDayClick(day) {
    if (day.status === 'future' || day.status === 'none') return
    const tasks = DAILY_TASKS.map(t => ({
      ...t,
      is_done: day.dayTasks[t.key] === true,
    }))
    setDayDetail({ date: day.dateStr, d: day.d, tasks })
  }

  const isAdmin = user?.id === MY_ID
  const DAYS_ZH = ['日','一','二','三','四','五','六']

  // 本週進度條顏色
  function weekBarColor(days) {
    if (days >= 5) return '#22C55E'
    if (days >= 3) return '#F59E0B'
    return '#EF4444'
  }

  return (
    <div style={{ background:'#F8FAFC', minHeight:'100vh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2563EB)',
        padding:'52px 20px 20px' }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:'#fff', margin:0 }}>我的夥伴</h1>
        <p style={{ fontSize:13, color:'#93C5FD', margin:'4px 0 0' }}>直屬 {partners.length} 人</p>
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

          {isAdmin && showAnnForm && (
            <div style={{ background:'#F0F7FF', borderRadius:10, padding:12,
              marginBottom:10, display:'flex', flexDirection:'column', gap:8 }}>
              <input value={annTitle} onChange={e => setAnnTitle(e.target.value)}
                placeholder="公告標題"
                style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #BFDBFE',
                  fontSize:14, outline:'none', width:'100%', boxSizing:'border-box' }} />
              <textarea value={annContent} onChange={e => setAnnContent(e.target.value)}
                placeholder="公告內容…" rows={3}
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
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                        {a.is_pinned && (
                          <span style={{ fontSize:10, background:'#F97316', color:'#fff',
                            padding:'1px 5px', borderRadius:99, fontWeight:700 }}>置頂</span>
                        )}
                        <span style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{a.title}</span>
                      </div>
                      <p style={{ fontSize:12, color:'#6B7280', margin:'0 0 3px', lineHeight:1.5 }}>
                        {a.content}
                      </p>
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
              <div key={p.id} onClick={() => openPanel(p)}
                style={{ background:'#fff', borderRadius:14, padding:14,
                  boxShadow:'0 1px 3px rgba(0,0,0,0.07)', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.07)'}>

                {/* 名字列 */}
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

                {/* BV / IBV */}
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  {[
                    { label:'BV達成', value:p.bvRate, color:'#F97316' },
                    { label:'IBV達成', value:p.ibvRate, color:'#3B82F6' },
                  ].map(m => (
                    <div key={m.label} style={{ flex:1, background:'#F8FAFC',
                      borderRadius:10, padding:'8px', textAlign:'center' }}>
                      <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 4px', fontWeight:600 }}>
                        {m.label}
                      </p>
                      <p style={{ fontSize:16, fontWeight:800, color:m.color, margin:0 }}>
                        {m.value}%
                      </p>
                    </div>
                  ))}
                </div>

                {/* 本週打卡進度條 */}
                <div style={{ background:'#F8FAFC', borderRadius:10, padding:'8px 10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', marginBottom:5 }}>
                    <span style={{ fontSize:11, color:'#9CA3AF', fontWeight:600 }}>本週打卡</span>
                    <span style={{ fontSize:12, fontWeight:800,
                      color: weekBarColor(p.weekDays) }}>
                      {p.weekDays} / 7 天
                    </span>
                  </div>
                  <div style={{ height:5, background:'#E5E7EB', borderRadius:99 }}>
                    <div style={{
                      height:'100%',
                      width:`${Math.round((p.weekDays / 7) * 100)}%`,
                      background: weekBarColor(p.weekDays),
                      borderRadius:99,
                      transition:'width 0.5s ease',
                    }} />
                  </div>
                </div>
              </div>
            ))}

            {pending.length > 0 && (
              <div style={{ background:'#FFF7ED', borderRadius:14, padding:14,
                border:'1px solid #FED7AA' }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#F97316', margin:'0 0 10px' }}>
                  待確認串聯
                </p>
                {pending.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center',
                    justifyContent:'space-between', padding:'8px 0',
                    borderBottom:'1px solid #FED7AA' }}>
                    <div>
                      <p style={{ fontSize:14, color:'#374151', margin:0, fontWeight:600 }}>
                        {p.name || '未命名'}
                      </p>
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

      {/* 側邊面板 */}
      {selectedPartner && (
        <>
          <div onClick={() => { setSelectedPartner(null); setDayDetail(null) }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100 }} />
          <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'90%',
            maxWidth:400, background:'#fff', zIndex:101,
            display:'flex', flexDirection:'column',
            boxShadow:'-4px 0 20px rgba(0,0,0,0.15)',
            animation:'slideIn 0.25s ease' }}>

            {/* 面板 Header */}
            <div style={{ background:`linear-gradient(135deg,${avatarBg(selectedPartner.name)},${avatarBg(selectedPartner.name)}bb)`,
              padding:'48px 16px 20px', flexShrink:0 }}>
              <button onClick={() => { setSelectedPartner(null); setDayDetail(null) }}
                style={{ position:'absolute', top:52, left:16,
                  background:'rgba(255,255,255,0.25)', border:'none', color:'#fff',
                  borderRadius:99, width:32, height:32, cursor:'pointer', fontSize:16,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
              <div style={{ display:'flex', alignItems:'center', gap:12, paddingLeft:40 }}>
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
                <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>載入中…</div>
              ) : panelDetail && (
                <>
                  {/* 今日任務快照 */}
                  <div style={{ background:'#F0FDF4', borderRadius:12, padding:14,
                    border:'1px solid #BBF7D0' }}>
                    <div style={{ display:'flex', alignItems:'center',
                      justifyContent:'space-between', marginBottom:8 }}>
                      <p style={{ fontSize:13, fontWeight:700, color:'#15803D', margin:0 }}>
                        ✅ 今日任務
                      </p>
                      <span style={{ fontSize:13, fontWeight:800, color:'#15803D' }}>
                        {panelDetail.todayDoneCount} / {DAILY_TASKS.length}
                      </span>
                    </div>
                    {/* 小圓點顯示每項任務 */}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {panelDetail.todayTasks.map(t => (
                        <div key={t.key}
                          title={t.label}
                          style={{
                            padding:'3px 8px', borderRadius:99, fontSize:11, fontWeight:600,
                            background: t.is_done ? '#22C55E' : '#E5E7EB',
                            color: t.is_done ? '#fff' : '#9CA3AF',
                          }}>
                          {t.label}
                        </div>
                      ))}
                    </div>
                    {panelDetail.todayDoneCount === 0 && (
                      <p style={{ fontSize:12, color:'#6B7280', margin:'8px 0 0' }}>
                        今天還沒有任何打卡記錄
                      </p>
                    )}
                  </div>

                  {/* 本月數據 */}
                  <div style={{ background:'#F8FAFC', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:'0 0 10px' }}>
                      📊 本月數據
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      {[
                        { label:'BV', value:panelDetail.bv, color:'#F97316' },
                        { label:'IBV', value:panelDetail.ibv, color:'#3B82F6' },
                        { label:'互動名單', value:panelDetail.contactCount, color:'#22C55E', unit:'人' },
                      ].map(m => (
                        <div key={m.label} style={{ flex:1, background:'#fff',
                          borderRadius:10, padding:'10px 8px', textAlign:'center',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                          <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 4px', fontWeight:600 }}>
                            {m.label}
                          </p>
                          <p style={{ fontSize:17, fontWeight:800, color:m.color, margin:0 }}>
                            {m.value}{m.unit||''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 達成率進度條 */}
                  <div style={{ background:'#F8FAFC', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:'0 0 10px' }}>
                      🎯 本月達成率
                    </p>
                    {[
                      { label:'BV（目標1500）', value:selectedPartner.bvRate, color:'#F97316' },
                      { label:'IBV（目標300）', value:selectedPartner.ibvRate, color:'#3B82F6' },
                      { label:`本週打卡（${selectedPartner.weekDays}/7天）`,
                        value: Math.round((selectedPartner.weekDays / 7) * 100),
                        color: weekBarColor(selectedPartner.weekDays) },
                    ].map(m => (
                      <div key={m.label} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:12, color:'#6B7280' }}>{m.label}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:m.color }}>{m.value}%</span>
                        </div>
                        <div style={{ height:6, background:'#E5E7EB', borderRadius:99 }}>
                          <div style={{ height:'100%', width:`${m.value}%`,
                            background:m.color, borderRadius:99, transition:'width 0.5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 每日打卡月曆 */}
                  <div style={{ background:'#F8FAFC', borderRadius:12, padding:14 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:'0 0 2px' }}>
                      📅 本月每日打卡
                    </p>
                    <p style={{ fontSize:11, color:'#9CA3AF', margin:'0 0 10px' }}>
                      點格子可查看當天完成項目
                    </p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)',
                      gap:3, marginBottom:4 }}>
                      {DAYS_ZH.map(d => (
                        <div key={d} style={{ textAlign:'center', fontSize:10,
                          color:'#9CA3AF', fontWeight:600, padding:'2px 0' }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
                      {Array.from({ length: panelDetail.firstDow }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {panelDetail.calDays.map(day => {
                        const bg =
                          day.status === 'full'    ? '#22C55E' :
                          day.status === 'partial' ? '#F59E0B' :
                          day.status === 'future'  ? 'transparent' : '#E5E7EB'
                        const color =
                          day.status === 'full' || day.status === 'partial' ? '#fff' : '#9CA3AF'
                        const isToday = day.dateStr === todayTW()
                        const clickable = day.status === 'full' || day.status === 'partial'
                        return (
                          <div key={day.dateStr}
                            onClick={() => clickable && handleDayClick(day)}
                            style={{ aspectRatio:'1', borderRadius:6, background:bg,
                              border: isToday ? '2px solid #2563EB' : '2px solid transparent',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              cursor: clickable ? 'pointer' : 'default',
                              transition:'transform 0.1s',
                              fontSize:11, fontWeight:600, color,
                            }}
                            onMouseEnter={e => { if (clickable) e.currentTarget.style.transform='scale(1.15)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)' }}>
                            {day.d}
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap' }}>
                      {[
                        { color:'#22C55E', label:'全部完成' },
                        { color:'#F59E0B', label:'部分完成' },
                        { color:'#E5E7EB', label:'未打卡' },
                      ].map(l => (
                        <div key={l.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <div style={{ width:10, height:10, borderRadius:3, background:l.color }} />
                          <span style={{ fontSize:11, color:'#6B7280' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 當天任務明細 popup */}
          {dayDetail && (
            <div style={{ position:'fixed', inset:0, zIndex:200,
              display:'flex', alignItems:'flex-end', justifyContent:'center' }}
              onClick={e => { if (e.target === e.currentTarget) setDayDetail(null) }}>
              <div style={{ background:'#fff', borderRadius:'20px 20px 0 0',
                padding:20, width:'100%', maxWidth:400,
                boxShadow:'0 -4px 20px rgba(0,0,0,0.15)',
                animation:'slideUp 0.2s ease' }}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', marginBottom:14 }}>
                  <p style={{ fontSize:15, fontWeight:700, color:'#111827', margin:0 }}>
                    {dayDetail.d} 日打卡明細
                  </p>
                  <button onClick={() => setDayDetail(null)}
                    style={{ background:'none', border:'none', fontSize:20,
                      color:'#9CA3AF', cursor:'pointer' }}>✕</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {dayDetail.tasks.map(t => (
                    <div key={t.key} style={{ display:'flex', alignItems:'center', gap:10,
                      padding:'8px 10px', borderRadius:8,
                      background: t.is_done ? '#F0FDF4' : '#F9FAFB' }}>
                      <span style={{ fontSize:16 }}>{t.is_done ? '✅' : '⬜'}</span>
                      <span style={{ fontSize:14,
                        color: t.is_done ? '#15803D' : '#9CA3AF',
                        fontWeight: t.is_done ? 600 : 400 }}>
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:12, padding:'8px 10px', borderRadius:8,
                  background:'#F8FAFC', textAlign:'center' }}>
                  <span style={{ fontSize:13, color:'#6B7280', fontWeight:600 }}>
                    完成 {dayDetail.tasks.filter(t => t.is_done).length} / {dayDetail.tasks.length} 項
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
