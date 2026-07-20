import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconFlag, IconRefresh, IconFlame, IconCheck,
  IconFlag2, IconUsersGroup, IconMountain, IconSparkles,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'
import { DAILY_TASKS, WEEKLY_COUNTERS } from './taskDefinitions'

// 設計系統色碼（與全站一致）
const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_YELLOW = '#FFD166'
const ACCENT_YELLOW_SOFT = '#FFF7E6'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const DANGER = '#E0454A'
const DANGER_SOFT = '#FDE2E2'
const BORDER = '#F0F1F4'
const SUBCARD_BG = '#F5F8FC'

// 戰隊專屬漸層（跟 Partners 的純藍漸層做出區隔，帶一點紫調更有前進感）
const TEAM_GRADIENT = 'linear-gradient(135deg,#6C4CE0,#1668E3)'
const STREAK_COLOR = '#FF8C42'

const DAYS_ZH = ['日','一','二','三','四','五','六']

import { toDateStr, today, getWeekDays, fetchMyTeam, fetchTeamRanking } from './teamStats'

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function avatarColor(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < (name||'').length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

// 本週打卡進度條：天數多寡動態變色
function weekBarColor(days) {
  if (days >= 5) return ACCENT_GREEN_TEXT
  if (days >= 3) return ACCENT_YELLOW_TEXT
  return DANGER
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
    const teamData = await fetchMyTeam(user.id)
    if (!teamData) { setTeam(null); setMembers([]); setLoading(false); return }
    setTeam(teamData)
    setIsCreator(teamData.creator_id === user.id)
    await fetchMembers(teamData.id)
    setLoading(false)
  }

  async function fetchMembers(teamId) {
    const ranked = await fetchTeamRanking(teamId, weekDays)
    if (!ranked.length) { setMembers([]); return }

    const userIds = ranked.map(m => m.user_id)

    // 本週週行動總筆數（行為次數，不含業績金額）
    const { data: counterLogs } = await supabase
      .from('counter_logs').select('user_id,counter_key')
      .in('user_id', userIds).in('date', weekDays)
      .not('counter_key', 'in', '("new_product","gmtss")')

    // 依加入時間排序顯示，不依表現排序（表現排序只在 fetchTeamRanking 內部用來算連續天數，不用於呈現順序）
    const result = ranked
      .map(m => ({ ...m, weekActions: (counterLogs||[]).filter(l => l.user_id === m.user_id).length }))
      .sort((a,b) => (a.joined_at||'').localeCompare(b.joined_at||''))

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

  if (loading) return <LoadingSpinner />

  // 戰隊本週集體進度：全隊本週打卡天數總和 ÷ 全隊上限（人數×7）
  const totalPossible = members.length * 7
  const totalDone = members.reduce((s,m) => s + m.weekCheckinDays, 0)
  const teamPct = totalPossible > 0 ? Math.min(Math.round(totalDone / totalPossible * 100), 100) : 0
  const selfMember = members.find(m => m.user_id === user?.id)
  const myContribPct = selfMember && totalPossible > 0
    ? Math.round(selfMember.weekCheckinDays / totalPossible * 100) : 0
  const contribStart = Math.max(teamPct - myContribPct, 0)
  const reachedSummit = teamPct >= 100

  return (
    <div style={{ background:'#fff', minHeight:'100vh', paddingBottom:80 }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
        .team-body-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .team-body-container { max-width: 1200px; margin: 0; padding-left: 24px; padding-right: 24px; }
          .team-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            grid-template-areas: "main sidebar";
            gap: 20px;
            align-items: start;
          }
          .team-main { grid-area: main; }
          .team-sidebar { grid-area: sidebar; }
        }
      `}</style>

      {/* Header：跟 Partners 同一套漸層語言，但用不同色相做出「這是戰隊」的區隔 */}
      <div style={{ background:TEAM_GRADIENT, padding:'52px 0 20px' }}>
        <div className="dash-container" style={{ padding:'0 20px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:4 }}>
            <button onClick={() => navigate('/settings')}
              style={{ background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',cursor:'pointer',
                padding:6,borderRadius:9,display:'flex' }}>
              <IconArrowLeft size={20} stroke={1.9} />
            </button>
            <h1 style={{ fontSize:20,fontWeight:700,color:'#fff',margin:0,display:'flex',alignItems:'center',gap:8 }}>
              <IconFlag size={19} stroke={1.9} /> 戰隊
            </h1>
          </div>
          {team && <p style={{ fontSize:13,color:'rgba(255,255,255,0.8)',margin:'6px 0 0 0' }}>{team.name} · {members.length} 位成員</p>}
        </div>
      </div>

      <div className="team-body-container" style={{ padding:'16px',display:'flex',flexDirection:'column',gap:10 }}>

        {!team ? (
          <>
            {!mode && (
              <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:16, padding:20 }}>
                <p style={{ fontSize:14,color:TEXT_SECONDARY,margin:'0 0 20px',lineHeight:1.7 }}>
                  跟夥伴組成戰隊，一起看見彼此的行動，一起往你想要的生活前進。
                </p>
                <button onClick={() => { setMode('create'); setActionMsg('') }}
                  style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
                    background:PRIMARY,color:'#fff',fontSize:15,fontWeight:700,
                    cursor:'pointer',marginBottom:10 }}>
                  建立新戰隊
                </button>
                <button onClick={() => { setMode('join'); setActionMsg('') }}
                  style={{ width:'100%',padding:'14px',borderRadius:12,
                    border:`1.5px solid ${PRIMARY}`,background:'#fff',color:PRIMARY,
                    fontSize:15,fontWeight:700,cursor:'pointer' }}>
                  輸入邀請碼加入
                </button>
              </div>
            )}

            {mode === 'create' && (
              <div style={{ background:'#fff',border:`1px solid ${BORDER}`,borderRadius:16,padding:20 }}>
                <p style={{ fontSize:15,fontWeight:700,color:TEXT_MAIN,margin:'0 0 14px' }}>建立新戰隊</p>
                <label style={{ fontSize:12,color:TEXT_MUTED,display:'block',marginBottom:6 }}>戰隊名稱</label>
                <input value={teamNameInput} onChange={e => setTeamNameInput(e.target.value)}
                  placeholder="例：火箭推進小組"
                  style={{ width:'100%',padding:'10px 12px',borderRadius:10,
                    border:`1px solid ${BORDER}`,background:SUBCARD_BG,
                    color:TEXT_MAIN,fontSize:14,boxSizing:'border-box',outline:'none' }} />
                {actionMsg && <p style={{ fontSize:12,color:DANGER,margin:'8px 0 0' }}>{actionMsg}</p>}
                <div style={{ display:'flex',gap:10,marginTop:16 }}>
                  <button onClick={() => setMode(null)}
                    style={{ flex:1,padding:'12px',borderRadius:10,
                      border:`1px solid ${BORDER}`,background:'#fff',
                      color:TEXT_SECONDARY,fontSize:14,cursor:'pointer' }}>取消</button>
                  <button onClick={handleCreate} disabled={actionLoading}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                      background:PRIMARY,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                    {actionLoading ? '建立中…' : '確認建立'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'join' && (
              <div style={{ background:'#fff',border:`1px solid ${BORDER}`,borderRadius:16,padding:20 }}>
                <p style={{ fontSize:15,fontWeight:700,color:TEXT_MAIN,margin:'0 0 14px' }}>輸入邀請碼</p>
                <label style={{ fontSize:12,color:TEXT_MUTED,display:'block',marginBottom:6 }}>邀請碼</label>
                <input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="例：A7B2C9"
                  style={{ width:'100%',padding:'10px 12px',borderRadius:10,
                    border:`1px solid ${BORDER}`,background:SUBCARD_BG,
                    color:TEXT_MAIN,fontSize:16,fontWeight:700,letterSpacing:3,
                    boxSizing:'border-box',outline:'none' }} />
                {actionMsg && <p style={{ fontSize:12,color:DANGER,margin:'8px 0 0' }}>{actionMsg}</p>}
                <div style={{ display:'flex',gap:10,marginTop:16 }}>
                  <button onClick={() => setMode(null)}
                    style={{ flex:1,padding:'12px',borderRadius:10,
                      border:`1px solid ${BORDER}`,background:'#fff',
                      color:TEXT_SECONDARY,fontSize:14,cursor:'pointer' }}>取消</button>
                  <button onClick={handleJoin} disabled={actionLoading}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                      background:PRIMARY,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                    {actionLoading ? '加入中…' : '確認加入'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 戰隊旅程：集體進度視覺化，取代原本的排行榜。不顯示任何個人名次或排序。 */}
            <div style={{ background:SUBCARD_BG, borderRadius:18, padding:'20px', marginBottom:4 }}>
              <p style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN, margin:'0 0 4px' }}>戰隊本週旅程</p>
              <p style={{ fontSize:12, color:TEXT_SECONDARY, margin:'0 0 14px' }}>全隊一起邁向夢想的頂點</p>

              {selfMember && myContribPct > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:6, background:ACCENT_GREEN_SOFT,
                  borderRadius:10, padding:'8px 12px', marginBottom:16 }}>
                  <IconSparkles size={14} stroke={1.9} color={ACCENT_GREEN_TEXT} />
                  <span style={{ fontSize:12, color:ACCENT_GREEN_TEXT, fontWeight:600 }}>
                    你這週的行動，把這條路推進了 {myContribPct}%
                  </span>
                </div>
              )}

              <div style={{ position:'relative', height:56, margin:'0 10px 8px' }}>
                <div style={{ position:'absolute', top:24, left:0, right:0, height:8,
                  background:'#F0F1F4', borderRadius:4 }} />
                <div style={{ position:'absolute', top:24, left:0, width:`${teamPct}%`, height:8,
                  background:ACCENT_YELLOW, borderRadius:4, transition:'width 0.5s ease' }} />
                {myContribPct > 0 && (
                  <div style={{ position:'absolute', top:24, left:`${contribStart}%`,
                    width:`${teamPct-contribStart}%`, height:8, background:ACCENT_GREEN, borderRadius:4,
                    transition:'width 0.5s ease' }} />
                )}

                <div style={{ position:'absolute', top:8, left:'50%', transform:'translateX(-50%)',
                  width:28, height:28, borderRadius:'50%', background:'#fff', border:'3px solid #FFD166',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <IconFlag2 size={13} stroke={1.9} color={ACCENT_YELLOW_TEXT} />
                </div>

                <div style={{ position:'absolute', top:0, left:`${teamPct}%`, transform:'translateX(-50%)',
                  width:34, height:34, borderRadius:'50%', background:'#fff', border:'3px solid #F97316',
                  display:'flex', alignItems:'center', justifyContent:'center', transition:'left 0.5s ease' }}>
                  <IconUsersGroup size={15} stroke={1.9} color="#F97316" />
                </div>

                <div style={{ position:'absolute', top:6, left:'100%', transform:'translateX(-100%)',
                  width:36, height:36, borderRadius:'50%',
                  background: reachedSummit ? ACCENT_YELLOW_SOFT : '#F5F8FC',
                  border:`3px solid ${reachedSummit ? ACCENT_YELLOW : '#D8DCE8'}`,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <IconMountain size={17} stroke={1.9} color={reachedSummit ? ACCENT_YELLOW_TEXT : TEXT_MUTED} />
                </div>
              </div>

              <p style={{ textAlign:'center', fontSize:12, fontWeight:600, color:ACCENT_YELLOW_TEXT, margin:'8px 0 0' }}>
                {reachedSummit ? '這週登頂了，一起看見夢想的樣子' : `再走 ${100-teamPct}% 登頂，一起看見夢想的樣子`}
              </p>

              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginTop:16 }}>
                {members.map(m => {
                  const isSelf = m.user_id === user.id
                  const active = m.weekCheckinDays > 0
                  return (
                    <div key={m.user_id} title={m.name}
                      style={{ width:32, height:32, borderRadius:'50%',
                        background:avatarColor(m.name), opacity: active ? 1 : 0.35,
                        border: isSelf ? `2px solid ${ACCENT_GREEN}` : 'none',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'#fff', fontSize:12, fontWeight:700 }}>
                      {m.name[0]}
                    </div>
                  )
                })}
              </div>
              <p style={{ textAlign:'center', fontSize:11, color:TEXT_MUTED, margin:'8px 0 0' }}>頭像亮起來的人這週已經動了</p>
            </div>

          <div className="team-grid">
            <div className="team-sidebar" style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:10 }}>
              {/* 邀請碼卡片 */}
              <div style={{ background:SUBCARD_BG,border:`1px solid ${BORDER}`,borderRadius:14,padding:'12px 16px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ fontSize:12,color:TEXT_MUTED }}>邀請碼</span>
                  <span style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,letterSpacing:3,flex:1 }}>
                    {team.invite_code}
                  </span>
                  {isCreator && (
                    <button onClick={handleRegenCode} disabled={actionLoading}
                      style={{ color:TEXT_MUTED,background:'none',border:'none',cursor:'pointer',marginRight:4,display:'flex' }}>
                      <IconRefresh size={15} stroke={1.9} />
                    </button>
                  )}
                  <button onClick={copyInviteCode}
                    style={{ padding:'5px 12px',borderRadius:8,border:`1px solid ${PRIMARY}`,
                      background: copied?PRIMARY:'#fff',
                      color: copied?'#fff':PRIMARY,
                      fontSize:12,fontWeight:700,cursor:'pointer' }}>
                    {copied ? '已複製' : '複製'}
                  </button>
                </div>
              </div>
            </div>

            <div className="team-main">
            {/* 成員列表：依加入時間排序，不依表現排序，不顯示名次 */}
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {members.map((m) => {
                const isExpanded = expandedId === m.user_id
                const isSelf = m.user_id === user.id
                const cardBorder = isSelf ? `1.5px solid ${PRIMARY}` : `1px solid ${BORDER}`
                return (
                  <div key={m.user_id}
                    style={{ background:'#fff', border:cardBorder, borderRadius:14, overflow:'hidden' }}>

                    {/* 成員主列 */}
                    <div style={{ padding:'12px 14px',cursor:'pointer' }}
                      onClick={() => toggleExpand(m.user_id)}>
                      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                        <div style={{ width:32,height:32,borderRadius:'50%',background:avatarColor(m.name),
                          display:'flex',alignItems:'center',justifyContent:'center',
                          color:'#fff',fontWeight:700,fontSize:13,flexShrink:0 }}>
                          {m.name[0]}
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                            <span style={{ fontSize:14,fontWeight:700,color:TEXT_MAIN }}>{m.name}</span>
                            {isSelf && (
                              <span style={{ fontSize:10,color:'#fff',fontWeight:700,
                                background:PRIMARY,borderRadius:5,padding:'1px 6px' }}>我</span>
                            )}
                          </div>
                          <div style={{ fontSize:11,color:TEXT_SECONDARY,marginTop:1,display:'flex',alignItems:'center',gap:4 }}>
                            本週 {m.weekCheckinDays}/7 天
                            {m.streak >= 2 && (
                              <span style={{ color:'#fff',background:STREAK_COLOR,fontWeight:700,
                                borderRadius:99,padding:'1px 7px',display:'flex',alignItems:'center',gap:2 }}>
                                <IconFlame size={11} stroke={2} /> 連續 {m.streak} 天
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0 }}>
                          <span style={{ fontSize:11,padding:'3px 8px',borderRadius:6,fontWeight:700,
                            background: m.todayChecked ? ACCENT_GREEN_SOFT : SUBCARD_BG,
                            color: m.todayChecked ? ACCENT_GREEN_TEXT : TEXT_MUTED }}>
                            {m.todayChecked ? '今天打了' : '今天未打'}
                          </span>
                          {isCreator && m.user_id !== user.id && (
                            <button onClick={e => { e.stopPropagation(); setKickTarget(m) }}
                              style={{ fontSize:10,color:DANGER,background:'none',
                                border:'none',cursor:'pointer',padding:0 }}>踢出</button>
                          )}
                        </div>
                        <span style={{ fontSize:12,color:TEXT_MUTED,marginLeft:4 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {/* 週點狀圖 */}
                      <div style={{ display:'flex',gap:4,paddingLeft:34 }}>
                        {weekDays.map(d => {
                          const isT = d === today()
                          const done = m.dayMap[d]
                          const isFuture = d > today()
                          return (
                            <div key={d} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}
                              onClick={e => { e.stopPropagation(); if (!isFuture) handleDotClick(m.user_id, d) }}>
                              <span style={{ fontSize:9,color: isT?PRIMARY:TEXT_MUTED }}>
                                {DAYS_ZH[new Date(d+'T00:00:00').getDay()]}
                              </span>
                              <div style={{
                                width:10,height:10,borderRadius:'50%',
                                background: isFuture ? BORDER : done ? ACCENT_GREEN : '#E4E8EF',
                                border: isT && !done ? `1.5px solid ${PRIMARY}` : 'none',
                                boxSizing:'border-box',
                                cursor: isFuture ? 'default' : 'pointer',
                              }} />
                            </div>
                          )
                        })}
                      </div>

                      {/* 本週進度 + 週行動（行為次數，不顯示業績金額） */}
                      <div style={{ display:'flex',gap:8,marginTop:10,paddingLeft:34,alignItems:'flex-end' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex',justifyContent:'space-between',
                            fontSize:10,color:TEXT_MUTED,marginBottom:3 }}>
                            <span style={{ color:weekBarColor(m.weekCheckinDays), fontWeight:700 }}>本週進度</span>
                            <span>{m.weekCheckinDays}/7</span>
                          </div>
                          <div style={{ height:4,background:BORDER,borderRadius:2,overflow:'hidden' }}>
                            <div style={{ height:'100%',borderRadius:2,background:weekBarColor(m.weekCheckinDays),
                              width:`${Math.round((m.weekCheckinDays/7)*100)}%` }} />
                          </div>
                        </div>
                        <div style={{ flexShrink:0,textAlign:'right' }}>
                          <div style={{ fontSize:10,color:TEXT_MUTED }}>週行動</div>
                          <div style={{ fontSize:13,fontWeight:700,color:ACCENT_GREEN_TEXT }}>{m.weekActions}</div>
                        </div>
                      </div>
                    </div>

                    {/* 展開：點擊某天看詳情 */}
                    {isExpanded && (
                      <div style={{ borderTop:`1px solid ${BORDER}`,
                        padding:'12px 14px',background:SUBCARD_BG }}>
                        <p style={{ fontSize:11,color:TEXT_MUTED,margin:'0 0 10px' }}>
                          點任一天的點點看當天詳情
                        </p>

                        {expandedDay?.memberId === m.user_id && expandedDay?.date && (
                          <div style={{ background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px' }}>
                            <p style={{ fontSize:12,fontWeight:700,color:PRIMARY,margin:'0 0 8px' }}>
                              {DAYS_ZH[new Date(expandedDay.date+'T00:00:00').getDay()]}　{expandedDay.date.slice(5).replace('-','/')}
                            </p>

                            {dayDetailLoading ? (
                              <p style={{ fontSize:12,color:TEXT_MUTED }}>載入中…</p>
                            ) : dayDetail ? (
                              <>
                                {/* 每日任務 */}
                                <div style={{ marginBottom:10 }}>
                                  {DAILY_TASKS.map(t => {
                                    const done = dayDetail.taskMap[t.key]
                                    return (
                                      <div key={t.key} style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 0',
                                        borderBottom:`1px solid ${BORDER}` }}>
                                        {done
                                          ? <IconCheck size={13} stroke={2.4} color={ACCENT_GREEN_TEXT} />
                                          : <span style={{ width:13,height:13,borderRadius:'50%',border:'1.5px solid #D8DCE8',display:'inline-block' }} />}
                                        <span style={{ fontSize:12,
                                          color: done ? TEXT_MAIN : TEXT_MUTED }}>
                                          {t.label}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>

                                {/* 週行動 */}
                                {Object.keys(dayDetail.counterSummary).length > 0 && (
                                  <div style={{ borderTop:`1px solid ${BORDER}`,paddingTop:8 }}>
                                    <p style={{ fontSize:11,color:TEXT_MUTED,margin:'0 0 6px' }}>當天業務行動</p>
                                    <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                                      {WEEKLY_COUNTERS.filter(c => dayDetail.counterSummary[c.key]).map(c => (
                                        <span key={c.key} style={{ fontSize:11,padding:'3px 8px',borderRadius:6,
                                          background:PRIMARY_SOFT,color:PRIMARY }}>
                                          {c.label} ×{dayDetail.counterSummary[c.key]}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {Object.keys(dayDetail.counterSummary).length === 0 &&
                                 Object.values(dayDetail.taskMap).every(v => !v) && (
                                  <p style={{ fontSize:12,color:TEXT_MUTED,margin:0 }}>這天沒有任何紀錄</p>
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
            <div style={{ display:'flex',gap:10,marginTop:14 }}>
              <button onClick={() => setShowLeaveConfirm(true)}
                style={{ flex:1,padding:'12px',borderRadius:12,
                  border:`1px solid ${BORDER}`,background:'#fff',
                  color:TEXT_SECONDARY,fontSize:13,fontWeight:600,cursor:'pointer' }}>
                退出戰隊
              </button>
              {isCreator && (
                <button onClick={() => setShowDisbandConfirm(true)}
                  style={{ flex:1,padding:'12px',borderRadius:12,border:'none',
                    background:DANGER_SOFT,color:DANGER,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                  解散戰隊
                </button>
              )}
            </div>
            </div>
          </div>
          </>
        )}
      </div>

      {/* 退出確認 */}
      {showLeaveConfirm && (
        <div style={overlayStyle} onClick={() => setShowLeaveConfirm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:'0 0 8px',textAlign:'center' }}>
              確定要退出「{team?.name}」？
            </p>
            <p style={{ fontSize:13,color:TEXT_MUTED,margin:'0 0 20px',textAlign:'center',lineHeight:1.6 }}>
              {isCreator ? '你是管理者，退出後管理權限將自動轉移給加入時間第二早的成員' : '退出後可再用邀請碼重新加入'}
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowLeaveConfirm(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,
                  border:`1px solid ${BORDER}`,background:'#fff',
                  fontSize:14,cursor:'pointer',color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleLeave} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:DANGER,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {actionLoading ? '處理中…' : '確認退出'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 解散確認 */}
      {showDisbandConfirm && (
        <div style={overlayStyle} onClick={() => setShowDisbandConfirm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:'0 0 8px',textAlign:'center' }}>
              確定要解散「{team?.name}」？
            </p>
            <p style={{ fontSize:13,color:TEXT_MUTED,margin:'0 0 20px',textAlign:'center',lineHeight:1.6 }}>
              所有成員都會被移出，無法復原
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowDisbandConfirm(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,
                  border:`1px solid ${BORDER}`,background:'#fff',
                  fontSize:14,cursor:'pointer',color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleDisband} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:DANGER,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {actionLoading ? '處理中…' : '確認解散'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 踢人確認 */}
      {kickTarget && (
        <div style={overlayStyle} onClick={() => setKickTarget(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:'0 0 8px',textAlign:'center' }}>
              確定要將「{kickTarget.name}」踢出戰隊？
            </p>
            <div style={{ display:'flex',gap:10,marginTop:20 }}>
              <button onClick={() => setKickTarget(null)}
                style={{ flex:1,padding:'12px',borderRadius:10,
                  border:`1px solid ${BORDER}`,background:'#fff',
                  fontSize:14,cursor:'pointer',color:TEXT_SECONDARY }}>取消</button>
              <button onClick={() => handleKick(kickTarget.user_id)} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:DANGER,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
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
  position:'fixed',inset:0,background:'rgba(19,42,77,0.4)',
  display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20,
}
const modalStyle = {
  background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:340,
}
