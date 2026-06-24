import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

const DAYS_ZH = ['日','一','二','三','四','五','六']
const DAILY_TASKS_COUNT = 7 // 對應每日任務數量

function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const diff = (dow + 1) % 7 // 六=0, 日=1, ..., 五=6（跟其他頁面統一：六日一二三四五）
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

function avatarBg(name) {
  const colors=['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n=0; for(let i=0;i<(name||'').length;i++) n+=name.charCodeAt(i)
  return colors[n%colors.length]
}

export default function Team() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState(null) // { id, name, invite_code, creator_id }
  const [members, setMembers] = useState([]) // [{ user_id, name, joined_at, weekCheckins, bv, ibv }]
  const [isCreator, setIsCreator] = useState(false)

  // 建立 / 加入 表單狀態
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [teamNameInput, setTeamNameInput] = useState('')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // 管理彈窗
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false)
  const [kickTarget, setKickTarget] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchTeam() }, [user])

  async function fetchTeam() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('team_members').select('team_id').eq('user_id', user.id).maybeSingle()

    if (!membership) {
      setTeam(null); setMembers([]); setLoading(false); return
    }

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

    // 本週打卡天數
    const weekDays = getWeekDays(today())
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

    const result = memberRows.map(m => {
      const myCheckins = (checkins||[]).filter(c => c.user_id === m.user_id)
      const daySet = new Set()
      weekDays.forEach(d => {
        const dc = myCheckins.filter(c => c.date === d)
        if (dc.length > 0 && dc.filter(c=>c.is_done).length >= DAILY_TASKS_COUNT) daySet.add(d)
      })
      const myTxs = (txs||[]).filter(t => t.user_id === m.user_id)
      const bv = myTxs.filter(t=>t.type==='BV').reduce((s,t)=>s+Number(t.points),0)
      const ibv = myTxs.filter(t=>t.type==='IBV').reduce((s,t)=>s+Number(t.points),0)
      return {
        user_id: m.user_id,
        name: nameMap[m.user_id] || '未命名',
        joined_at: m.joined_at,
        weekCheckinDays: daySet.size,
        bv, ibv,
      }
    })
    // 預設排序：本週打卡天數多的在前
    result.sort((a,b) => b.weekCheckinDays - a.weekCheckinDays)
    setMembers(result)
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

    const { error: joinError } = await supabase.from('team_members')
      .insert({ team_id: newTeam.id, user_id: user.id })
    if (joinError) { setActionMsg('加入失敗：' + joinError.message); setActionLoading(false); return }

    setActionLoading(false)
    setMode(null)
    setTeamNameInput('')
    fetchTeam()
  }

  async function handleJoin() {
    setActionMsg('')
    const code = joinCodeInput.trim().toUpperCase()
    if (!code) { setActionMsg('請輸入邀請碼'); return }
    setActionLoading(true)

    const { data: foundTeams, error: findError } = await supabase
      .rpc('get_team_by_invite_code', { p_code: code })
    if (findError || !foundTeams || foundTeams.length === 0) {
      setActionMsg('邀請碼不存在，請確認後再試')
      setActionLoading(false); return
    }
    const targetTeam = foundTeams[0]

    const { error: joinError } = await supabase.from('team_members')
      .insert({ team_id: targetTeam.id, user_id: user.id })
    if (joinError) {
      if (joinError.code === '23505') setActionMsg('你已經在一個戰隊裡了，請先退出才能加入新戰隊')
      else setActionMsg('加入失敗：' + joinError.message)
      setActionLoading(false); return
    }

    setActionLoading(false)
    setMode(null)
    setJoinCodeInput('')
    fetchTeam()
  }

  async function handleLeave() {
    if (!team) return
    setActionLoading(true)

    if (isCreator) {
      // 找接班人
      const { data: nextCreatorId } = await supabase
        .rpc('get_next_team_creator', { p_team_id: team.id, p_exclude_user_id: user.id })
      if (nextCreatorId) {
        await supabase.from('teams').update({ creator_id: nextCreatorId }).eq('id', team.id)
      }
    }
    await supabase.from('team_members').delete().eq('user_id', user.id)

    setActionLoading(false)
    setShowLeaveConfirm(false)
    setTeam(null); setMembers([])
  }

  async function handleDisband() {
    if (!team) return
    setActionLoading(true)
    await supabase.from('teams').delete().eq('id', team.id) // cascade 會清掉 team_members
    setActionLoading(false)
    setShowDisbandConfirm(false)
    setTeam(null); setMembers([])
  }

  async function handleKick(targetUserId) {
    setActionLoading(true)
    await supabase.from('team_members').delete().eq('user_id', targetUserId).eq('team_id', team.id)
    setActionLoading(false)
    setKickTarget(null)
    fetchMembers(team.id)
  }

  async function handleRegenCode() {
    if (!team) return
    setActionLoading(true)
    const newCode = genInviteCode()
    await supabase.from('teams').update({ invite_code: newCode }).eq('id', team.id)
    setTeam(p => ({ ...p, invite_code: newCode }))
    setActionLoading(false)
  }

  function copyInviteCode() {
    if (!team) return
    navigator.clipboard.writeText(team.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:'#9CA3AF' }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2563EB)',
        padding:'52px 20px 24px',display:'flex',alignItems:'center',gap:12 }}>
        <button onClick={() => navigate('/settings')}
          style={{ background:'none',border:'none',fontSize:22,color:'#fff',cursor:'pointer' }}>←</button>
        <h1 style={{ fontSize:20,fontWeight:800,color:'#fff',margin:0 }}>🚀 戰隊</h1>
      </div>

      <div style={{ padding:'16px',display:'flex',flexDirection:'column',gap:12 }}>

        {!team ? (
          // ── 沒有戰隊：顯示建立/加入入口 ──
          <>
            {!mode && (
              <>
                <div style={card}>
                  <p style={{ fontSize:14,color:'#6B7280',margin:'0 0 16px',lineHeight:1.6 }}>
                    跟夥伴組成戰隊，互相看到彼此的每日打卡和本季業績進度，一起互相激勵、互相督促！
                  </p>
                  <button onClick={() => { setMode('create'); setActionMsg('') }}
                    style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
                      background:'#2563EB',color:'#fff',fontSize:15,fontWeight:700,
                      cursor:'pointer',marginBottom:10 }}>
                    🚀 建立新戰隊
                  </button>
                  <button onClick={() => { setMode('join'); setActionMsg('') }}
                    style={{ width:'100%',padding:'14px',borderRadius:12,
                      border:'1.5px solid #2563EB',background:'#fff',color:'#2563EB',
                      fontSize:15,fontWeight:700,cursor:'pointer' }}>
                    🔑 輸入邀請碼加入
                  </button>
                </div>
              </>
            )}

            {mode === 'create' && (
              <div style={card}>
                <p style={{ fontSize:15,fontWeight:700,color:'#111827',margin:'0 0 12px' }}>建立新戰隊</p>
                <label style={lb}>戰隊名稱</label>
                <input value={teamNameInput} onChange={e => setTeamNameInput(e.target.value)}
                  placeholder="例：火箭推進小組" style={inputStyle} />
                {actionMsg && <p style={{ fontSize:12,color:'#EF4444',margin:'8px 0 0' }}>{actionMsg}</p>}
                <div style={{ display:'flex',gap:10,marginTop:16 }}>
                  <button onClick={() => setMode(null)}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                      background:'#fff',color:'#6B7280',fontSize:14,cursor:'pointer' }}>取消</button>
                  <button onClick={handleCreate} disabled={actionLoading}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                      background:'#2563EB',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                    {actionLoading ? '建立中…' : '確認建立'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'join' && (
              <div style={card}>
                <p style={{ fontSize:15,fontWeight:700,color:'#111827',margin:'0 0 12px' }}>輸入邀請碼</p>
                <label style={lb}>邀請碼</label>
                <input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="例：A7B2C9" style={{...inputStyle, letterSpacing:2, fontWeight:700}} />
                {actionMsg && <p style={{ fontSize:12,color:'#EF4444',margin:'8px 0 0' }}>{actionMsg}</p>}
                <div style={{ display:'flex',gap:10,marginTop:16 }}>
                  <button onClick={() => setMode(null)}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                      background:'#fff',color:'#6B7280',fontSize:14,cursor:'pointer' }}>取消</button>
                  <button onClick={handleJoin} disabled={actionLoading}
                    style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                      background:'#2563EB',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                    {actionLoading ? '加入中…' : '確認加入'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          // ── 已有戰隊：顯示隊伍資訊 + 排行榜 ──
          <>
            <div style={card}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                <p style={{ fontSize:17,fontWeight:800,color:'#111827',margin:0 }}>{team.name}</p>
                {isCreator && <span style={{ fontSize:11,fontWeight:700,color:'#2563EB',
                  background:'#EFF6FF',padding:'3px 8px',borderRadius:8 }}>管理者</span>}
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:8,background:'#F8FAFC',
                borderRadius:10,padding:'10px 12px' }}>
                <span style={{ fontSize:12,color:'#9CA3AF' }}>邀請碼</span>
                <span style={{ fontSize:16,fontWeight:800,color:'#111827',letterSpacing:2,flex:1 }}>
                  {team.invite_code}
                </span>
                <button onClick={copyInviteCode}
                  style={{ padding:'5px 12px',borderRadius:8,border:'none',
                    background: copied?'#22C55E':'#2563EB',color:'#fff',
                    fontSize:12,fontWeight:700,cursor:'pointer' }}>
                  {copied ? '✓ 已複製' : '複製'}
                </button>
              </div>
              {isCreator && (
                <button onClick={handleRegenCode} disabled={actionLoading}
                  style={{ marginTop:8,fontSize:12,color:'#9CA3AF',background:'none',
                    border:'none',cursor:'pointer' }}>
                  🔄 重新產生邀請碼（舊碼將失效）
                </button>
              )}
            </div>

            {/* 排行榜 */}
            <div style={card}>
              <p style={{ fontSize:14,fontWeight:700,color:'#374151',margin:'0 0 12px' }}>
                成員進度（{members.length} 人）
              </p>
              {members.map((m, idx) => (
                <div key={m.user_id} style={{ display:'flex',alignItems:'center',gap:10,
                  padding:'10px 0',borderBottom: idx<members.length-1 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ fontSize:13,fontWeight:800,color:'#9CA3AF',width:18 }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}
                  </span>
                  <div style={{ width:36,height:36,borderRadius:'50%',background:avatarBg(m.name),
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#fff',fontWeight:700,fontSize:14,flexShrink:0 }}>
                    {m.name[0]}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <span style={{ fontSize:14,fontWeight:700,color:'#111827' }}>{m.name}</span>
                      {m.user_id === user.id && (
                        <span style={{ fontSize:10,color:'#2563EB',background:'#EFF6FF',
                          padding:'1px 6px',borderRadius:6 }}>我</span>
                      )}
                    </div>
                    <div style={{ fontSize:12,color:'#9CA3AF',marginTop:2 }}>
                      本週打卡 {m.weekCheckinDays}/7 天
                    </div>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    <div style={{ fontSize:12,color:'#F97316',fontWeight:700 }}>BV {m.bv.toFixed(0)}</div>
                    <div style={{ fontSize:12,color:'#3B82F6',fontWeight:700 }}>IBV {m.ibv.toFixed(0)}</div>
                  </div>
                  {isCreator && m.user_id !== user.id && (
                    <button onClick={() => setKickTarget(m)}
                      style={{ fontSize:11,color:'#EF4444',background:'none',
                        border:'none',cursor:'pointer',marginLeft:4 }}>踢出</button>
                  )}
                </div>
              ))}
            </div>

            {/* 管理操作 */}
            <button onClick={() => setShowLeaveConfirm(true)}
              style={{ width:'100%',padding:'13px',borderRadius:12,
                border:'1px solid #E5E7EB',background:'#fff',color:'#6B7280',
                fontSize:14,fontWeight:600,cursor:'pointer' }}>
              退出戰隊
            </button>
            {isCreator && (
              <button onClick={() => setShowDisbandConfirm(true)}
                style={{ width:'100%',padding:'13px',borderRadius:12,border:'none',
                  background:'#FEF2F2',color:'#DC2626',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                解散戰隊
              </button>
            )}
          </>
        )}
      </div>

      {/* 退出確認 */}
      {showLeaveConfirm && (
        <div style={overlayStyle} onClick={() => setShowLeaveConfirm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 8px',textAlign:'center' }}>
              確定要退出「{team?.name}」？
            </p>
            <p style={{ fontSize:13,color:'#6B7280',margin:'0 0 20px',textAlign:'center' }}>
              {isCreator ? '你是管理者，退出後管理權限將自動轉移給加入時間第二早的成員' : '退出後可再用邀請碼重新加入'}
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowLeaveConfirm(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',color:'#374151' }}>取消</button>
              <button onClick={handleLeave} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#EF4444',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
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
            <p style={{ fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 8px',textAlign:'center' }}>
              確定要解散「{team?.name}」？
            </p>
            <p style={{ fontSize:13,color:'#6B7280',margin:'0 0 20px',textAlign:'center' }}>
              所有成員都會被移出戰隊，這個動作無法復原
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowDisbandConfirm(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',color:'#374151' }}>取消</button>
              <button onClick={handleDisband} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#EF4444',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
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
            <p style={{ fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 8px',textAlign:'center' }}>
              確定要將「{kickTarget.name}」踢出戰隊？
            </p>
            <div style={{ display:'flex',gap:10,marginTop:20 }}>
              <button onClick={() => setKickTarget(null)}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',color:'#374151' }}>取消</button>
              <button onClick={() => handleKick(kickTarget.user_id)} disabled={actionLoading}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#EF4444',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {actionLoading ? '處理中…' : '確認踢出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card = { background:'#fff',borderRadius:16,padding:16,boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }
const lb = { fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }
const inputStyle = {
  width:'100%',padding:'10px 12px',borderRadius:10,
  border:'1px solid #D1D5DB',fontSize:14,boxSizing:'border-box',
  outline:'none',color:'#111827',
}
const overlayStyle = {
  position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
  display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20,
}
const modalStyle = {
  background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:340,
}
