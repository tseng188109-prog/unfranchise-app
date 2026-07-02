import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

const DAYS_ZH = ['日','一','二','三','四','五','六']

const DAILY_TASKS = [
  { key: 'goal_declaration',    label: '目標宣言' },
  { key: 'backend_announcement',label: '後台公告/管理報告' },
  { key: 'respond_social',      label: '回應臉書IDEA/LINE' },
  { key: 'daily_practice',      label: '每日練習' },
  { key: 'listen_recording',    label: '聽錄音' },
  { key: 'ig_story',            label: 'IG 限動' },
  { key: 'daily_3_contacts',    label: '每日3互動' },
]

const WEEKLY_COUNTERS = [
  { key: 'bv_share',      label: 'BV 分享' },
  { key: 'ibv_share',     label: 'IBV 分享' },
  { key: 'meetup',        label: '見面' },
  { key: 'show_business', label: '展示生意' },
  { key: 'sell_ticket',   label: '賣票' },
  { key: 'stranger',      label: '與陌生人互動' },
]

function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

function getWeekDays() {
  const d = new Date()
  const dow = d.getDay()
  const diff = (dow + 1) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - diff)
  const days = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(toDateStr(day))
  }
  return days
}

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function avatarColor(name) {
  const colors = ['#185FA5','#639922','#993556','#534AB7','#854F0B','#0F6E56']
  let n = 0; for (let i = 0; i < (name||'').length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth()+1}/${d.getDate()}`
}

export default function Team() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [isCreator, setIsCreator] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedDay, setExpandedDay] = useState(null) // { memberId, date }
  const [dayDetail, setDayDetail] = useState(null) // { tasks: [], counters: [] }
  const [dayDetailLoading, setDayDetailLoading] = useState(false)

  const [mode, setMode] = useState(null)
  const [teamNameInput, setTeamNameInput] = useState('')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false)
  const [kickTarget, setKickTarget] = useState(null)
  const [copied, setCopied] = useState(false)

  const weekDays = getWeekDays()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])
  useEffect(() => { if (user) fetchTeam() }, [user])

  async function fetchTeam() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('team_members').select('team_id').eq('user_id', user.id).maybeSingle()
    if (!membership) { setTeam(null); setMembers([]); setLoading(false); return }

    const { data: teamData } = await supabase
      .from('teams').select('*').eq('id', membership.team_id).single()
    if (!teamData) { setTeam(null); setLoading(false); return }
    setTeam(teamData)
    setIsCreator(teamData.creator_id === user.id)
    await fetchMembers(teamData.id)
    setLoading(false)
  }

  async function fetchMembers(teamId) {
    const { data: memberRows } = await supabase
      .from('team_members').select('user_id,joined_at').eq('team_id', teamId)
      .order('joined_at', { ascending: true })
    if (!memberRows) return

    const userIds = memberRows.map(m => m.user_id)

    const { data: userProfiles } = await supabase
      .from('users').select('id,name').in('id', userIds)
    const nameMap = {}
    ;(userProfiles||[]).forEach(u => { nameMap[u.id] = u.name })

    // 本週每天有沒有打卡（有任何任務 is_done=true 就算）
    const { data: checkins } = await supabase
      .from('daily_checkins').select('user_id,date,is_done')
      .in('user_id', userIds).in('date', weekDays)

    // 本季 BV/IBV
    const now = new Date()
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    const quarterStart = `${now.getFullYear()}-${String(quarterStartMonth+1).padStart(2,'0')}-01`
    const { data: txs } = await supabase
      .from('transactions').select('user_id,type,points')
      .in('user_id', userIds).gte('date', quarterStart)

    // 本週週行動總筆數
    const { data: counterLogs } = await supabase
      .from('counter_logs').select('user_id,counter_key')
      .in('user_id', userIds).in('date', weekDays)
      .not('counter_key', 'in', '("new_product","gmtss")')

    const result = memberRows.map(m => {
      const myCheckins = (checkins||[]).filter(c => c.user_id === m.user_id)

      // 每天有沒有打卡（有任何 is_done=true 就算）
      const dayMap = {}
      weekDays.forEach(d => {
        const dc = myCheckins.filter(c => c.date === d && c.is_done)
        dayMap[d] = dc.length > 0
      })

      // 今天有沒有打卡
      const todayChecked = dayMap[today()] || false

      // 本週打卡天數
      const weekCheckinDays = Object.values(dayMap).filter(Boolean).length

      // 連續打卡天數（從今天往回算）
      let streak = 0
      const todayIdx = weekDays.indexOf(today())
      for (let i = todayIdx; i >= 0; i--) {
        if (dayMap[weekDays[i]]) streak++
        else break
      }

      const myTxs = (txs||[]).filter(t => t.user_id === m.user_id)
      const bv = myTxs.filter(t=>t.type==='BV').reduce((s,t)=>s+Number(t.points),0)
      const ibv = myTxs.filter(t=>t.type==='IBV').reduce((s,t)=>s+Number(t.points),0)

      const weekActions = (counterLogs||[]).filter(l => l.user_id === m.user_id).length

      return {
        user_id: m.user_id,
        name: nameMap[m.user_id] || '未命名',
        joined_at: m.joined_at,
        dayMap, todayChecked,
        weekCheckinDays, streak,
        bv, ibv, weekActions,
      }
    })

    result.sort((a,b) => {
      if (b.weekCheckinDays !== a.weekCheckinDays) return b.weekCheckinDays - a.weekCheckinDays
      return b.streak - a.streak
    })
    setMembers(result)
  }

  async function fetchDayDetail(memberId, date) {
    setDayDetailLoading(true)
    setExpandedDay({ memberId, date })
    setDayDetail(null)

    const { data: checkins } = await supabase
      .from('daily_checkins').select('task_key,is_done')
      .eq('user_id', memberId).eq('date', date)

    const { data: counters } = await supabase
      .from('counter_logs').select('counter_key')
      .eq('user_id', memberId).eq('date', date)
      .not('counter_key', 'in', '("new_product","gmtss")')

    const taskMap = {}
    ;(checkins||[]).forEach(c => { taskMap[c.task_key] = c.is_done })

    const counterSummary = {}
    ;(counters||[]).forEach(l => {
      counterSummary[l.counter_key] = (counterSummary[l.counter_key] || 0) + 1
    })

    setDayDetail({ taskMap, counterSummary })
    setDayDetailLoading(false)
  }

  function toggleExpand(memberId) {
    if (expandedId === memberId) {
      setExpandedId(null)
      setExpandedDay(null)
      setDayDetail(null)
    } else {
      setExpandedId(memberId)
      setExpandedDay(null)
      setDayDetail(null)
    }
  }

  function handleDotClick(memberId, date) {
    if (expandedDay?.memberId === memberId && expandedDay?.date === date) {
      setExpandedDay(null); setDayDetail(null)
    } else {
      fetchDayDetail(memberId, date)
    }
  }

  async function handleCreate() {
    setActionMsg('')
    if (!teamNameInput.trim()) { setActionMsg('請輸入戰隊名稱'); return }
    setActionLoading(true)
    const code = genInviteCode()
    const { data: newTeam, error } = await supabase.from('teams')
      .insert({ name: teamNameInput.trim(), invite_code: code, creator_id: user.id })
      .select().single()
    if (error) { setActionMsg('建立失敗：' + error.message); setActionLoading(false); return }
    await supabase.from('team_members').insert({ team_id: newTeam.id, user_id: user.id })
    setActionLoading(false); setMode(null); setTeamNameInput(''); fetchTeam()
  }

  async function handleJoin() {
    setActionMsg('')
    const code = joinCodeInput.trim().toUpperCase()
    if (!code) { setActionMsg('請輸入邀請碼'); return }
    setActionLoading(true)
    const { data: foundTeams } = await supabase.rpc('get_team_by_invite_code', { p_code: code })
    if (!foundTeams || foundTeams.length === 0) {
      setActionMsg('邀請碼不存在，請確認後再試'); setActionLoading(false); return
    }
    const { error: joinError } = await supabase.from('team_members')
      .insert({ team_id: foundTeams[0].id, user_id: user.id })
    if (joinError) {
      setActionMsg(joinError.code === '23505' ? '你已經在一個戰隊裡了，請先退出才能加入新戰隊' : '加入失敗：' + joinError.message)
      setActionLoading(false); return
    }
    setActionLoading(false); setMode(null); setJoinCodeInput(''); fetchTeam()
  }

  async function handleLeave() {
    setActionLoading(true)
    if (isCreator) {
      const { data: nextCreatorId } = await supabase
        .rpc('get_next_team_creator', { p_team_id: team.id, p_exclude_user_id: user.id })
      if (nextCreatorId) await supabase.from('teams').update({ creator_id: nextCreatorId }).eq('id', team.id)
    }
    await supabase.from('team_members').delete().eq('user_id', user.id)
    setActionLoading(false); setShowLeaveConfirm(false); setTeam(null); setMembers([])
  }

  async function handleDisband() {
    setActionLoading(true)
    await supabase.from('teams').delete().eq('id', team.id)
    setActionLoading(false); setShowDisbandConfirm(false); setTeam(null); setMembers([])
  }

  async function handleKick(targetUserId) {
    setActionLoading(true)
    await supabase.from('team_members').delete().eq('user_id', targetUserId).eq('team_id', team.id)
    setActionLoading(false); setKickTarget(null); fetchMembers(team.id)
  }

  async function handleRegenCode() {
    setActionLoading(true)
    const newCode = genInviteCode()
    await supabase.from('teams').update({ invite_code: newCode }).eq('id', team.id)
    setTeam(p => ({ ...p, invite_code: newCode })); setActionLoading(false)
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(team.invite_code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const rankEmoji = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i+1)

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0A0F1E' }}>
      <p style={{ color:'rgba(255,255,255,0.4)',fontSize:14 }}>載入中…</p>
    </div>
  )

  // ── 深色主題樣式常數 ──
  const darkBg = '#0A0F1E'
  const cardBg = 'rgba(255,255,255,0.04)'
  const cardBorder = '0.5px solid rgba(255,255,255,0.08)'
  const accentBlue = '#00C4FF'
  const accentGreen = '#00E598'
  const textPrimary = '#E8F4FF'
  const textMuted = 'rgba(255,255,255,0.35)'

  return (
    <div style={{ background:darkBg, minHeight:'100vh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(180deg,#0D1829 0%,#0A0F1E 100%)',
        padding:'52px 20px 20px', borderBottom:'0.5px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:4 }}>
          <button onClick={() => navigate('/settings')}
            style={{ background:'none',border:'none',fontSize:22,color:textPrimary,cursor:'pointer',padding:0 }}>←</button>
          <h1 style={{ fontSize:20,fontWeight:700,color:textPrimary,margin:0 }}>🚀 戰隊</h1>
        </div>
        {team && <p style={{ fontSize:12,color:textMuted,margin:'0 0 0 34px' }}>{team.name} · {members.length} 位成員</p>}
      </div>

      <div style={{ padding:'16px',display:'flex',flexDirection:'column',gap:10 }}>

        {!team ? (
          <>
            {!mode && (
              <div style={{ background:cardBg, border:cardBorder, borderRadius:16, padding:20 }}>
                <p style={{ fontSize:14,color:textMuted,margin:'0 0 20px',lineHeight:1.7 }}>
                  跟夥伴組成戰隊，互相看到彼此的每日打卡和本季業績，互相激勵督促！
                </p>
                <button onClick={() => { setMode('create'); setActionMsg('') }}
                  style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
                    background:accentBlue,color:'#001824',fontSize:15,fontWeight:700,
                    cursor:'pointer',marginBottom:10 }}>
                  🚀 建立新戰隊
                </button>
                <button onClick={() => { setMode('join'); setActionMsg('') }}
                  style={{ width:'100%',padding:'14px',borderRadius:12,
                    border:`1.5px solid ${accentBlue}`,background:'transparent',color:accentBlue,
                    fontSize:15,fontWeight:700,cursor:'pointer' }}>
                  🔑 輸入邀請碼加入
                </button>
              </div>
            )}

            {mode === 'create' && (
              <div style={{ background:cardBg,border:cardBorder,borderRadius:16,padding:20 }}>
                <p style={{ fontSize:15,fontWeight:700,color:textPrimary,margin:'0 0 14px' }}>建立新戰隊</p>
                <label style={{ fontSize:12,color:textMuted,display:'block',marginBottom:6 }}>戰隊名稱</label>
                <input value={teamNameInput} onChange={e => setTeamNameInput(e.target.value)}
                  placeholder="例：火箭推進小組"
                  style={{ width:'100%',padding:'10px 12px',borderRadius:10,
                    border:'0.5px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',
                    color:textPrimary,fontSize:14,boxSizing:'border-box',outline:'none' }} />
                {actionMsg && <p style={{ fontSize:12,color:'#FF6B6B',margin:'8px 0 0' }}>{actionMsg}</p>}
                <div style={{ display:'flex',gap:10,marginTop:16 }}>
                  <button onClick={() => setMode(null)}
                    style={{ flex:1,padding:'12px',borderRadius:10,
                      border:'0.5px solid rgba(255,255,255,0.15)',background:'transparent',
                      color:textMuted,fontSize:14,cursor:'pointer' }}>取消</button>
                  <button onClick={handleCreate} disabled={actionLoading}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                      background:accentBlue,color:'#001824',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                    {actionLoading ? '建立中…' : '確認建立'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'join' && (
              <div style={{ background:cardBg,border:cardBorder,borderRadius:16,padding:20 }}>
                <p style={{ fontSize:15,fontWeight:700,color:textPrimary,margin:'0 0 14px' }}>輸入邀請碼</p>
                <label style={{ fontSize:12,color:textMuted,display:'block',marginBottom:6 }}>邀請碼</label>
                <input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="例：A7B2C9"
                  style={{ width:'100%',padding:'10px 12px',borderRadius:10,
                    border:'0.5px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',
                    color:textPrimary,fontSize:16,fontWeight:700,letterSpacing:3,
                    boxSizing:'border-box',outline:'none' }} />
                {actionMsg && <p style={{ fontSize:12,color:'#FF6B6B',margin:'8px 0 0' }}>{actionMsg}</p>}
                <div style={{ display:'flex',gap:10,marginTop:16 }}>
                  <button onClick={() => setMode(null)}
                    style={{ flex:1,padding:'12px',borderRadius:10,
                      border:'0.5px solid rgba(255,255,255,0.15)',background:'transparent',
                      color:textMuted,fontSize:14,cursor:'pointer' }}>取消</button>
                  <button onClick={handleJoin} disabled={actionLoading}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                      background:accentBlue,color:'#001824',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                    {actionLoading ? '加入中…' : '確認加入'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 邀請碼卡片 */}
            <div style={{ background:cardBg,border:cardBorder,borderRadius:14,padding:'12px 16px' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ fontSize:12,color:textMuted }}>邀請碼</span>
                <span style={{ fontSize:16,fontWeight:700,color:textPrimary,letterSpacing:3,flex:1 }}>
                  {team.invite_code}
                </span>
                {isCreator && (
                  <button onClick={handleRegenCode} disabled={actionLoading}
                    style={{ fontSize:11,color:textMuted,background:'none',border:'none',cursor:'pointer',marginRight:4 }}>
                    🔄
                  </button>
                )}
                <button onClick={copyInviteCode}
                  style={{ padding:'5px 12px',borderRadius:8,border:`0.5px solid ${accentBlue}`,
                    background: copied?accentBlue:'transparent',
                    color: copied?'#001824':accentBlue,
                    fontSize:12,fontWeight:700,cursor:'pointer' }}>
                  {copied ? '✓ 已複製' : '複製'}
                </button>
              </div>
            </div>

            {/* 排行榜 */}
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {members.map((m, idx) => {
                const isExpanded = expandedId === m.user_id
                const isTopCard = idx === 0
                return (
                  <div key={m.user_id}
                    style={{ background: isTopCard ? 'rgba(0,196,255,0.06)' : cardBg,
                      border: isTopCard ? `0.5px solid rgba(0,196,255,0.25)` : cardBorder,
                      borderRadius:14, overflow:'hidden' }}>

                    {/* 成員主列 */}
                    <div style={{ padding:'12px 14px',cursor:'pointer' }}
                      onClick={() => toggleExpand(m.user_id)}>
                      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                        <span style={{ fontSize:15,width:22,flexShrink:0,textAlign:'center' }}>{rankEmoji(idx)}</span>
                        <div style={{ width:32,height:32,borderRadius:'50%',background:avatarColor(m.name),
                          display:'flex',alignItems:'center',justifyContent:'center',
                          color:'#fff',fontWeight:700,fontSize:13,flexShrink:0 }}>
                          {m.name[0]}
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                            <span style={{ fontSize:14,fontWeight:600,color:textPrimary }}>{m.name}</span>
                            {m.user_id === user.id && (
                              <span style={{ fontSize:10,color:accentBlue,
                                border:`0.5px solid ${accentBlue}`,borderRadius:4,padding:'1px 5px' }}>我</span>
                            )}
                          </div>
                          <div style={{ fontSize:11,color:textMuted,marginTop:1 }}>
                            本週 {m.weekCheckinDays}/7 天
                            {m.streak >= 2 && <span style={{ color:'#FF8C42',marginLeft:6 }}>🔥 連續 {m.streak} 天</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0 }}>
                          <span style={{ fontSize:11,padding:'3px 8px',borderRadius:6,fontWeight:600,
                            background: m.todayChecked ? 'rgba(0,229,152,0.12)' : 'rgba(255,255,255,0.05)',
                            color: m.todayChecked ? accentGreen : textMuted }}>
                            {m.todayChecked ? '✓ 今天打了' : '今天未打'}
                          </span>
                          {isCreator && m.user_id !== user.id && (
                            <button onClick={e => { e.stopPropagation(); setKickTarget(m) }}
                              style={{ fontSize:10,color:'rgba(255,100,100,0.6)',background:'none',
                                border:'none',cursor:'pointer',padding:0 }}>踢出</button>
                          )}
                        </div>
                        <span style={{ fontSize:12,color:textMuted,marginLeft:4 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {/* 週點狀圖 */}
                      <div style={{ display:'flex',gap:4,paddingLeft:32 }}>
                        {weekDays.map(d => {
                          const isT = d === today()
                          const done = m.dayMap[d]
                          const isFuture = d > today()
                          return (
                            <div key={d} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}
                              onClick={e => { e.stopPropagation(); if (!isFuture) handleDotClick(m.user_id, d) }}>
                              <span style={{ fontSize:9,color: isT?accentBlue:textMuted }}>
                                {DAYS_ZH[new Date(d+'T00:00:00').getDay()]}
                              </span>
                              <div style={{
                                width:10,height:10,borderRadius:'50%',
                                background: isFuture ? 'rgba(255,255,255,0.05)' : done ? accentGreen : 'rgba(255,255,255,0.1)',
                                border: isT && !done ? `1.5px solid ${accentBlue}` : 'none',
                                boxSizing:'border-box',
                                cursor: isFuture ? 'default' : 'pointer',
                              }} />
                            </div>
                          )
                        })}
                      </div>

                      {/* BV/IBV 進度條 */}
                      <div style={{ display:'flex',gap:8,marginTop:10,paddingLeft:32 }}>
                        {[
                          { label:'BV', val:m.bv, max:1500, color:'#FF8C42' },
                          { label:'IBV', val:m.ibv, max:300, color:accentBlue },
                        ].map(({ label, val, max, color }) => (
                          <div key={label} style={{ flex:1 }}>
                            <div style={{ display:'flex',justifyContent:'space-between',
                              fontSize:10,color:textMuted,marginBottom:3 }}>
                              <span style={{ color }}>{label}</span>
                              <span>{val.toFixed(0)} / {max}</span>
                            </div>
                            <div style={{ height:3,background:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden' }}>
                              <div style={{ height:'100%',borderRadius:2,background:color,
                                width:`${Math.min((val/max)*100,100)}%` }} />
                            </div>
                          </div>
                        ))}
                        <div style={{ flexShrink:0,textAlign:'right' }}>
                          <div style={{ fontSize:10,color:textMuted }}>週行動</div>
                          <div style={{ fontSize:13,fontWeight:700,color:accentGreen }}>{m.weekActions}</div>
                        </div>
                      </div>
                    </div>

                    {/* 展開：點擊某天看詳情 */}
                    {isExpanded && (
                      <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.06)',
                        padding:'12px 14px',background:'rgba(0,0,0,0.2)' }}>
                        <p style={{ fontSize:11,color:textMuted,margin:'0 0 10px' }}>
                          點任一天的點點看當天詳情
                        </p>

                        {expandedDay?.memberId === m.user_id && expandedDay?.date && (
                          <div style={{ background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'10px 12px' }}>
                            <p style={{ fontSize:12,fontWeight:600,color:accentBlue,margin:'0 0 8px' }}>
                              {DAYS_ZH[new Date(expandedDay.date+'T00:00:00').getDay()]}　{expandedDay.date.slice(5).replace('-','/')}
                            </p>

                            {dayDetailLoading ? (
                              <p style={{ fontSize:12,color:textMuted }}>載入中…</p>
                            ) : dayDetail ? (
                              <>
                                {/* 每日任務 */}
                                <div style={{ marginBottom:10 }}>
                                  {DAILY_TASKS.map(t => {
                                    const done = dayDetail.taskMap[t.key]
                                    return (
                                      <div key={t.key} style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 0',
                                        borderBottom:'0.5px solid rgba(255,255,255,0.04)' }}>
                                        <span style={{ fontSize:12,
                                          color: done ? accentGreen : 'rgba(255,255,255,0.2)' }}>
                                          {done ? '✓' : '○'}
                                        </span>
                                        <span style={{ fontSize:12,
                                          color: done ? textPrimary : 'rgba(255,255,255,0.25)',
                                          textDecoration: done ? 'none' : 'none' }}>
                                          {t.label}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>

                                {/* 週行動 */}
                                {Object.keys(dayDetail.counterSummary).length > 0 && (
                                  <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.06)',paddingTop:8 }}>
                                    <p style={{ fontSize:11,color:textMuted,margin:'0 0 6px' }}>當天業務行動</p>
                                    <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                                      {WEEKLY_COUNTERS.filter(c => dayDetail.counterSummary[c.key]).map(c => (
                                        <span key={c.key} style={{ fontSize:11,padding:'3px 8px',borderRadius:6,
                                          background:'rgba(0,196,255,0.1)',color:accentBlue }}>
                                          {c.label} ×{dayDetail.counterSummary[c.key]}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {Object.keys(dayDetail.counterSummary).length === 0 &&
                                 Object.values(dayDetail.taskMap).every(v => !v) && (
                                  <p style={{ fontSize:12,color:'rgba(255,255,255,0.2)',margin:0 }}>這天沒有任何紀錄</p>
                                )}
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 管理操作 */}
            <div style={{ display:'flex',gap:10,marginTop:4 }}>
              <button onClick={() => setShowLeaveConfirm(true)}
                style={{ flex:1,padding:'12px',borderRadius:12,
                  border:'0.5px solid rgba(255,255,255,0.15)',background:'transparent',
                  color:textMuted,fontSize:13,fontWeight:600,cursor:'pointer' }}>
                退出戰隊
              </button>
              {isCreator && (
                <button onClick={() => setShowDisbandConfirm(true)}
                  style={{ flex:1,padding:'12px',borderRadius:12,border:'none',
                    background:'rgba(255,100,100,0.1)',color:'#FF6B6B',fontSize:13,fontWeight:700,cursor:'pointer' }}>
                  解散戰隊
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 退出確認 */}
      {showLeaveConfirm && (
        <div style={overlayStyle} onClick={() => setShowLeaveConfirm(false)}>
          <div style={darkModalStyle} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:15,fontWeight:700,color:textPrimary,margin:'0 0 8px',textAlign:'center' }}>
              確定要退出「{team?.name}」？
            </p>
            <p style={{ fontSize:12,color:textMuted,margin:'0 0 20px',textAlign:'center',lineHeight:1.6 }}>
              {isCreator ? '你是管理者，退出後管理權限將自動轉移給加入時間第二早的成員' : '退出後可再用邀請碼重新加入'}
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowLeaveConfirm(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,
                  border:'0.5px solid rgba(255,255,255,0.15)',background:'transparent',
                  fontSize:14,cursor:'pointer',color:textMuted }}>取消</button>
              <button onClick={handleLeave} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#FF6B6B',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {actionLoading ? '處理中…' : '確認退出'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 解散確認 */}
      {showDisbandConfirm && (
        <div style={overlayStyle} onClick={() => setShowDisbandConfirm(false)}>
          <div style={darkModalStyle} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:15,fontWeight:700,color:textPrimary,margin:'0 0 8px',textAlign:'center' }}>
              確定要解散「{team?.name}」？
            </p>
            <p style={{ fontSize:12,color:textMuted,margin:'0 0 20px',textAlign:'center',lineHeight:1.6 }}>
              所有成員都會被移出，無法復原
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowDisbandConfirm(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,
                  border:'0.5px solid rgba(255,255,255,0.15)',background:'transparent',
                  fontSize:14,cursor:'pointer',color:textMuted }}>取消</button>
              <button onClick={handleDisband} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#FF6B6B',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {actionLoading ? '處理中…' : '確認解散'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 踢人確認 */}
      {kickTarget && (
        <div style={overlayStyle} onClick={() => setKickTarget(null)}>
          <div style={darkModalStyle} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:15,fontWeight:700,color:textPrimary,margin:'0 0 8px',textAlign:'center' }}>
              確定要將「{kickTarget.name}」踢出戰隊？
            </p>
            <div style={{ display:'flex',gap:10,marginTop:20 }}>
              <button onClick={() => setKickTarget(null)}
                style={{ flex:1,padding:'12px',borderRadius:10,
                  border:'0.5px solid rgba(255,255,255,0.15)',background:'transparent',
                  fontSize:14,cursor:'pointer',color:textMuted }}>取消</button>
              <button onClick={() => handleKick(kickTarget.user_id)} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#FF6B6B',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {actionLoading ? '處理中…' : '確認踢出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const overlayStyle = {
  position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',
  display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20,
}
const darkModalStyle = {
  background:'#0D1829',border:'0.5px solid rgba(255,255,255,0.1)',
  borderRadius:16,padding:24,width:'100%',maxWidth:340,
}
