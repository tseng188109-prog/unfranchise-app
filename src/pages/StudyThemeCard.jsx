import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { IconBook, IconCheck } from '@tabler/icons-react'
import { fetchMyTeam, toDateStr, today } from './teamStats'
import { STUDY_THEMES, STUDY_THEME_COUNT, STUDY_LEVEL_COUNT } from './studyThemes'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER,
  ACCENT_GREEN_TEXT, RADIUS,
} from './designTokens'

// 共學主題卡（首頁）。
// 兩個「一週」刻意分開：
//   「本週」＝業績結算週（週六 00:00 到週五 24:00），給打卡、訪談、戰隊打卡率用；
//   共學主題＝週一到週日換一次，卡片上只叫「共學主題 N / 5」，不用「週」字，避免跟結算週混在一起。
// 循環規則：全隊同一個主題（週末的共學討論才討論得起來）。起點預設是戰隊建立那一週的週一，
// 戰隊長可以按「這週暫停」或「從這週重來」；沒加入戰隊的人用自己帳號建立那一週當起點。
// 新夥伴中途加入：看到全隊現在的主題，同時可以在「全部主題」裡補還沒走過的。

const DAY = 86400000

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toDateStr(d)
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
function md(dateStr) {
  const p = dateStr.split('-')
  return `${Number(p[1])}/${Number(p[2])}`
}
function weeksBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / (7 * DAY))
}
function readSeen() {
  try { return localStorage.getItem('studyExplainerSeen') === '1' } catch { return false }
}
function writeSeen() {
  try { localStorage.setItem('studyExplainerSeen', '1') } catch {}
}

const linkBtn = { background:'none', border:'none', padding:0, cursor:'pointer', fontSize:12 }

export default function StudyThemeCard({ user }) {
  const [team, setTeam] = useState(null)
  const [done, setDone] = useState(new Set())
  const [ready, setReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [explainerSeen, setExplainerSeen] = useState(readSeen())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user) load() }, [user?.id])

  async function load() {
    const t = await fetchMyTeam(user.id)
    setTeam(t)
    const { data: prog } = await supabase.from('study_theme_progress')
      .select('theme_no').eq('user_id', user.id)
    setDone(new Set((prog || []).map(r => r.theme_no)))
    setReady(true)
  }

  if (!ready) return null

  const thisMonday = mondayOf(today())
  const rawAnchor = team
    ? (team.study_cycle_anchor || toDateStr(new Date(team.created_at || Date.now())))
    : toDateStr(new Date(user.created_at || Date.now()))
  const anchor = mondayOf(rawAnchor)
  const weeksSince = weeksBetween(anchor, thisMonday)
  const isLeader = !!team && team.creator_id === user.id
  const pausedThisWeek = !!team && team.study_paused_week === thisMonday

  const rangeText = `${md(thisMonday)} 到 ${md(addDays(thisMonday, 6))}`
  const cardStyle = { background:PRIMARY_SOFT, border:'1px solid #DCE7F7', borderRadius:RADIUS.card, padding:14 }

  async function toggleDone(no) {
    if (busy) return
    setBusy(true)
    const next = new Set(done)
    if (next.has(no)) {
      next.delete(no)
      await supabase.from('study_theme_progress').delete().eq('user_id', user.id).eq('theme_no', no)
    } else {
      next.add(no)
      await supabase.from('study_theme_progress')
        .upsert({ user_id: user.id, theme_no: no }, { onConflict: 'user_id,theme_no' })
    }
    setDone(next)
    setBusy(false)
  }

  async function updateTeam(patch, okMsg) {
    if (busy || !team) return
    setBusy(true)
    const { error } = await supabase.from('teams').update(patch).eq('id', team.id)
    setBusy(false)
    if (error) { setMsg('這個動作需要先完成資料庫更新，請先執行這一包附的 SQL。'); return }
    setMsg(okMsg)
    await load()
  }
  function pauseThisWeek() {
    if (!confirm('這個主題暫停一次，下週一接著繼續，確定嗎？')) return
    updateTeam({ study_cycle_anchor: addDays(anchor, 7), study_paused_week: thisMonday }, '已暫停這一次，下週一接著繼續。')
  }
  function resumeThisWeek() {
    updateTeam({ study_cycle_anchor: addDays(anchor, -7), study_paused_week: null }, '已取消暫停。')
  }
  function restartFromNow() {
    if (!confirm('從這週一重新開始第 1 個主題，確定嗎？')) return
    updateTeam({ study_cycle_anchor: thisMonday, study_paused_week: null }, '已從這週一重新開始。')
  }

  function leaderControls() {
    if (!isLeader) return null
    return (
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:10 }}>
        {pausedThisWeek
          ? <button onClick={resumeThisWeek} style={{ ...linkBtn, color:TEXT_SECONDARY }}>取消暫停</button>
          : <button onClick={pauseThisWeek} style={{ ...linkBtn, color:TEXT_SECONDARY }}>這次暫停</button>}
        <button onClick={restartFromNow} style={{ ...linkBtn, color:TEXT_SECONDARY }}>從這週重來第 1 個主題</button>
      </div>
    )
  }

  // 還沒到起點（戰隊長把起點往後調的情況）
  if (weeksSince < 0 && !pausedThisWeek) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize:12, fontWeight:700, color:PRIMARY, marginBottom:4 }}>共學主題</div>
        <div style={{ fontSize:13, color:TEXT_MAIN }}>{md(anchor)} 開始第一個主題。</div>
        {leaderControls()}
        {msg && <div style={{ fontSize:11, color:TEXT_MUTED, marginTop:8 }}>{msg}</div>}
      </div>
    )
  }

  const idx = (((weeksSince % STUDY_THEME_COUNT) + STUDY_THEME_COUNT) % STUDY_THEME_COUNT)
  const lap = Math.max(0, Math.floor(weeksSince / STUDY_THEME_COUNT)) + 1
  const level = (lap - 1) % STUDY_LEVEL_COUNT
  const theme = STUDY_THEMES[idx]
  const nextTheme = STUDY_THEMES[(idx + 1) % STUDY_THEME_COUNT]

  if (pausedThisWeek) {
    return (
      <div style={cardStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6, gap:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:PRIMARY }}>
            <IconBook size={13} stroke={2} style={{ verticalAlign:'-2px', marginRight:4 }} />共學主題
          </span>
          <span style={{ fontSize:11, color:TEXT_SECONDARY }}>{rangeText}</span>
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:TEXT_MAIN, marginBottom:4 }}>這次先休息</div>
        <div style={{ fontSize:12, color:TEXT_SECONDARY, lineHeight:1.6 }}>
          下週一接著第 {nextTheme.no} 個主題：{nextTheme.title}
        </div>
        {leaderControls()}
        {msg && <div style={{ fontSize:11, color:TEXT_MUTED, marginTop:8 }}>{msg}</div>}
      </div>
    )
  }

  const iDone = done.has(theme.no)
  const allDone = done.size >= STUDY_THEME_COUNT

  return (
    <div style={cardStyle}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6, gap:8 }}>
        <span style={{ fontSize:12, fontWeight:700, color:PRIMARY, minWidth:0 }}>
          <IconBook size={13} stroke={2} style={{ verticalAlign:'-2px', marginRight:4 }} />
          共學主題 {theme.no} / {STUDY_THEME_COUNT}
          {lap > 1 && <span style={{ fontWeight:400, color:TEXT_SECONDARY }}>　第 {lap} 輪・進階</span>}
        </span>
        <span style={{ fontSize:11, color:TEXT_SECONDARY, whiteSpace:'nowrap', flexShrink:0 }}>{rangeText}</span>
      </div>

      <div style={{ fontSize:15, fontWeight:700, color:TEXT_MAIN, marginBottom:4, wordBreak:'break-word', overflowWrap:'anywhere' }}>{theme.title}</div>
      <div style={{ fontSize:12, color:TEXT_SECONDARY, lineHeight:1.6, marginBottom:10 }}>{theme.idea}</div>

      <div style={{ background:'#fff', borderRadius:RADIUS.sm, padding:'10px 12px' }}>
        <div style={{ fontSize:11, color:TEXT_MUTED, marginBottom:2 }}>這次試試看</div>
        <div style={{ fontSize:13, color:TEXT_MAIN, lineHeight:1.6, wordBreak:'break-word', overflowWrap:'anywhere' }}>{theme.levels[level]}</div>
      </div>

      <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap', marginTop:10 }}>
        <button onClick={() => toggleDone(theme.no)} disabled={busy}
          style={{ ...linkBtn, fontWeight:700, color: iDone ? ACCENT_GREEN_TEXT : PRIMARY }}>
          {iDone ? <><IconCheck size={13} stroke={2.4} style={{ verticalAlign:'-2px' }} /> 我試過了</> : '我試過了'}
        </button>
        <button onClick={() => setExpanded(v => !v)}
          style={{ ...linkBtn, fontWeight:700, color:PRIMARY }}>
          {expanded ? '收起 ‹' : '看全部五個主題 ›'}
        </button>
      </div>

      {!explainerSeen && (
        <div style={{ fontSize:11, color:TEXT_SECONDARY, lineHeight:1.6, marginTop:10 }}>
          「本週」是業績結算週（週六到週五）。共學主題每週一換，跟結算週分開算。
          <button onClick={() => { writeSeen(); setExplainerSeen(true) }}
            style={{ ...linkBtn, fontSize:11, color:PRIMARY, marginLeft:8, fontWeight:700 }}>知道了</button>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:11, color:TEXT_MUTED, marginBottom:6 }}>
            {allDone ? '五個主題都走過一輪了。' : `已走過 ${done.size} / ${STUDY_THEME_COUNT}，沒走過的可以自己補。`}
          </div>
          <div style={{ border:`1px solid ${BORDER}`, borderRadius:RADIUS.md, overflow:'hidden', background:'#fff' }}>
            {STUDY_THEMES.map((t, i) => {
              const isCurrent = t.no === theme.no
              const needsFirst = t.no === 1 && !done.has(1) && !isCurrent
              return (
                <div key={t.no} style={{ padding:'10px 12px', borderBottom: i < STUDY_THEMES.length - 1 ? `1px solid ${BORDER}` : 'none',
                  background: isCurrent ? '#F5F8FC' : '#fff' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color: isCurrent ? PRIMARY : TEXT_MAIN, wordBreak:'break-word', overflowWrap:'anywhere' }}>
                        {t.no}　{t.title}
                        {isCurrent && <span style={{ fontWeight:400, fontSize:11, color:TEXT_SECONDARY }}>（這次）</span>}
                      </div>
                      <div style={{ fontSize:12, color:TEXT_SECONDARY, lineHeight:1.5 }}>{t.levels[level]}</div>
                      {needsFirst && <div style={{ fontSize:11, color:PRIMARY, marginTop:2 }}>新夥伴先從這個開始</div>}
                    </div>
                    <button onClick={() => toggleDone(t.no)} disabled={busy}
                      style={{ ...linkBtn, flexShrink:0, color: done.has(t.no) ? ACCENT_GREEN_TEXT : TEXT_MUTED }}>
                      {done.has(t.no) ? '✓ 試過了' : '標記試過'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize:11, color:TEXT_MUTED, marginTop:8 }}>
            {nextTheme && `下週一換成：${nextTheme.title}`}
          </div>
          {leaderControls()}
        </div>
      )}

      {msg && <div style={{ fontSize:11, color:TEXT_MUTED, marginTop:8 }}>{msg}</div>}
    </div>
  )
}
