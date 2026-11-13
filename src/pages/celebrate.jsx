// celebrate.jsx — 做完一件事的小鼓勵、做滿今天的慶祝、連續天數
// Celebrations 放在 Layout 裡，聽 syncDaily3 發出的「今天數字變了」（ufa:312）：
//   數字變多 → 底部跳 3 秒小鼓勵（旁邊的小罐子搖一下／掉進一顆豆）
//   同一位今天又記一次 → 數字不變，但還是跳「罐子搖了一下」
//   今天第一次做滿 → 整頁「今天完成了」（一天只跳一次）
//   接著如果是里程碑（3、7、14、30… 天）或昨天用休息日守住 → 整頁連續天數
// 首頁的小火焰按下去也會打開連續天數（ufa:show-streak）。
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Bean, Flame, BeanStyle } from './bean'
import { loadStreak } from './streakData'
import { loadJar, saveJarPrefs, seenWalnuts, markWalnutsSeen } from './jarData'
import { syncDaily3 } from './followUp'
import { JarArt, WalnutIcon } from './jar'
import { setTop10, fetchTop10, TOP10_MAX } from './top10'
import { InviteSheet } from './invite'
import { JAR_STAGES, walnutNext } from '../lib/jar'
import { twToday, isMilestone, daysBetween, twDayOf, toastFor } from '../lib/rhythm'

const TILE = [
  { key: 'talk', label: '互動', unit: '位', color: '#2F7A52' },
  { key: 'plan', label: '邀約', unit: '個', color: '#2457D6' },
  { key: 'fresh', label: '新名單', unit: '位', color: '#C9822B' },
]
const TOAST_MS = 3000
const JAR_CHECK_GAP = 5000 // 罐子最多 5 秒重算一次（連續記好幾筆時不要一直讀資料庫）
const TOAST_CSS = `
@keyframes jar-drop { 0% { transform: translateY(-16px); opacity: 0 } 40% { opacity: 1 } 75% { transform: translateY(5px) } 100% { transform: translateY(3px); opacity: 1 } }
.jar-drop { animation: jar-drop .7s ease-in both }
@media (prefers-reduced-motion: reduce) { .jar-drop { animation: none } }
`
// 今天新記的是誰：cur 比 prev 多出來的那幾筆（同一位記兩次，第二次也算「新記的」）
function newlyLogged(prev, cur) {
  const left = {}
  ;(prev.logContacts || []).forEach(id => { left[id] = (left[id] || 0) + 1 })
  const out = []
  ;(cur.logContacts || []).forEach(id => { if (left[id]) left[id]--; else out.push(id) })
  return out
}
// 新名單那一行：快換罐子了就說還差幾位，不然說這個月放了幾位
function jarLineForFresh(jd, added) {
  if (!jd) return ''
  const count = jd.beans + added
  const st = jd.jar
  if (st.next && st.stage.cap - count > 0 && st.stage.cap - count <= 20) return `罐子多一顆豆・再 ${st.stage.cap - count} 位換${st.next.name}`
  return `罐子多一顆豆・本月 ${jd.monthNew + added}/${jd.prefs.monthGoal}`
}

const DAY_BG = { on: '#F08A3C', rest: 'var(--primary-soft)', no: 'var(--sub2)', today: 'var(--card)', future: 'var(--sub)' }
const DAY_FG = { on: '#fff', rest: 'var(--primary)', no: 'var(--muted)', today: '#F08A3C', future: 'var(--muted)' }

function readSeen(date) {
  try { const v = sessionStorage.getItem('ufa_312_seen_' + date); return v ? JSON.parse(v) : null } catch { return null }
}
function writeSeen(date, v) { try { sessionStorage.setItem('ufa_312_seen_' + date, JSON.stringify(v)) } catch { /* ignore */ } }
function celebratedToday(date) { try { return localStorage.getItem('ufa_celebrated') === date } catch { return false } }
function markCelebrated(date) { try { localStorage.setItem('ufa_celebrated', date) } catch { /* ignore */ } }

export function StreakView({ data, onClose, celebrate }) {
  const { streak, strip } = data
  const n = streak.count
  let msg
  if (celebrate && streak.restUsedYesterday) msg = '昨天的休息日幫你守住了，今天又接上了！'
  else if (streak.todayActive) msg = n >= 2 ? `連續 ${n} 天，明天見。` : '第一天！明天再來，火就會燒起來。'
  else if (n > 0) msg = '今天做一件事就能接下去。'
  else msg = '今天做一件事，就是第 1 天。'
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="bean-pop" style={{ display: 'flex', justifyContent: 'center' }}><Flame size={78} animate /></div>
      <div style={{ fontSize: 56, fontWeight: 700, color: '#F08A3C', lineHeight: 1.05, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#F08A3C', marginBottom: 18 }}>天連續行動</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
        {strip.map(d => <div key={d.date} style={{ flex: 1, fontSize: 12, color: d.state === 'today' ? '#F08A3C' : 'var(--muted)', fontWeight: d.state === 'today' ? 700 : 400 }}>{d.label}</div>)}
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
        {strip.map(d => (
          <div key={d.date} style={{ flex: 1, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
            background: DAY_BG[d.state], color: DAY_FG[d.state], border: d.state === 'today' ? '2px dashed #F08A3C' : 'none', boxSizing: 'border-box' }}>
            {d.state === 'on' ? '✓' : d.state === 'rest' ? '休' : d.state === 'today' ? '今' : ''}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 6 }}>{msg}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 22 }}>互動、邀約、新名單，任一項都算。每週有一天休息日，沒做也不會斷。</div>
      <button onClick={onClose} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 16, background: 'var(--primary)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 0 #1A42A8' }}>
        {celebrate ? '我堅持，不放棄' : '好'}
      </button>
    </div>
  )
}

function DoneView({ counts, onNext }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Bean mood="happy" size={150} />
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '6px 0 4px' }}>今天的 {counts.mode.label} 完成了</div>
      <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 20 }}>每天往前一步，你又做到了。</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: 24 }}>
        {TILE.map(t => (
          <div key={t.key} className="bean-pop" style={{ borderRadius: 14, border: `2px solid ${t.color}`, overflow: 'hidden', background: 'var(--card)' }}>
            <div style={{ background: t.color, color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 0' }}>{t.label}</div>
            <div style={{ color: t.color, fontSize: 20, fontWeight: 700, padding: '8px 0' }}>{counts[t.key]} {t.unit}</div>
          </div>
        ))}
      </div>
      <button onClick={onNext} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 16, background: 'var(--primary)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 0 #1A42A8' }}>明天繼續</button>
    </div>
  )
}

// 換大罐子了
function JarUpView({ idx, onClose }) {
  const st = JAR_STAGES[idx], prev = JAR_STAGES[idx - 1], next = JAR_STAGES[idx + 1]
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 4 }}>
        <Bean mood="happy" size={110} />
        <span className="bean-pop"><JarArt stage={idx} fill={0.55} walnuts={0} size={120} label="名單" /></span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '10px 0 4px' }}>換成{st.name}了！</div>
      <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 22 }}>
        {prev ? `名單滿 ${prev.cap} 位，${prev.name}裝滿了。` : ''}<br />
        {next ? `下一個是${next.name}（${next.cap} 位）。` : '再往 300 位前進，滿了就擺上架。'}
      </div>
      <button onClick={onClose} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 16, background: 'var(--primary)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 0 #1A42A8' }}>繼續放豆子</button>
    </div>
  )
}

// 核桃浮上來了
function WalnutUpView({ list, userId, onClose, onInvite }) {
  const navigate = useNavigate()
  const w = list[0]
  const [msg, setMsg] = useState('')
  const [inTop, setInTop] = useState(!!w.is_top10)
  const btn2 = { padding: 12, borderRadius: 14, border: '1px solid var(--border2)', background: 'var(--card)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="bean-pop" style={{ width: 92, height: 92, borderRadius: '50%', background: '#F3E7D8', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <WalnutIcon size={58} />
        <svg width="22" height="22" viewBox="-11 -11 22 22" style={{ position: 'absolute', left: 2, top: 4 }} aria-hidden="true"><path className="bean-twinkle" d="M0,-9 l2.5,6 6,2.5 -6,2.5 -2.5,6 -2.5,-6 -6,-2.5 6,-2.5z" fill="#F5B841" /></svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '12px 0 4px' }}>{list.length > 1 ? `浮上來 ${list.length} 顆核桃` : '核桃浮上來了'}</div>
      <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>{w.name}</div>
      <div style={{ fontSize: 14, color: 'var(--text2)', margin: '2px 0 4px' }}>{w.reason}・建議{walnutNext(w)}</div>
      {list.length > 1 && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>還有 {list.slice(1).map(x => x.name).join('、')}</div>}
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 18px', lineHeight: 1.6 }}>對方自己表示想了解，這就是你的說幹就幹候選人。</div>
      {!inTop && (
        <button onClick={async () => {
          const t = await fetchTop10(userId)
          if ((t.rows || []).length >= TOP10_MAX) { setMsg(`首選 10 已經滿 ${TOP10_MAX} 位，先換掉一位再放`); return }
          await setTop10(w.id, true); setInTop(true); setMsg('放進首選 10 了')
        }} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 16, background: 'var(--primary)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 0 #1A42A8', marginBottom: 8 }}>放進首選 10</button>
      )}
      {msg && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button style={{ ...btn2, color: 'var(--primary)' }} onClick={() => onInvite(w)}>記一次邀約</button>
        <button style={{ ...btn2, color: 'var(--text2)' }} onClick={() => { onClose(); navigate('/contacts?jar=1') }}>看我的罐子</button>
      </div>
      <button onClick={onClose} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--text2)', fontSize: 14, cursor: 'pointer', padding: 8 }}>好</button>
    </div>
  )
}

export default function Celebrations() {
  const [userId, setUserId] = useState(null)
  const [joinedDays, setJoinedDays] = useState(999)
  const [toast, setToast] = useState(null)
  const [screen, setScreen] = useState(null) // { kind:'done', counts } | { kind:'streak', data, celebrate }
  const timer = useRef(null)
  const streakAfter = useRef(null)
  const [invite, setInvite] = useState(null)
  // 好幾個畫面同時要跳時排隊，一個一個來（例如：完成今天 → 核桃浮上來 → 換大罐子）
  const screenRef = useRef(null)
  const queue = useRef([])
  useEffect(() => { screenRef.current = screen }, [screen])
  const show = useCallback((sc) => {
    if (screenRef.current) queue.current.push(sc)
    else { screenRef.current = sc; setScreen(sc) }
  }, [])
  const closeScreen = useCallback(() => {
    const next = queue.current.shift() || null
    screenRef.current = next
    setScreen(next)
  }, [])

  // 罐子：有新核桃浮上來、或罐子該換大的了，就跳出來
  const jarRef = useRef(null) // 最近一次算好的罐子（小鼓勵要用：是不是豆子、還差幾位換罐子）
  const checkJar = useCallback(async (uid) => {
    let d
    try { d = await loadJar(uid) } catch { return }
    jarRef.current = { ...d, beanSet: new Set(d.beanIds || []) }
    const ids = d.walnuts.map(w => w.id)
    const seen = seenWalnuts(uid)
    if (seen) {
      const fresh = d.walnuts.filter(w => !seen.includes(w.id))
      if (fresh.length) show({ kind: 'walnut', list: fresh })
    }
    markWalnutsSeen(uid, ids)
    if (d.jar.idx > d.prefs.reached) {
      await saveJarPrefs(uid, { reached: d.jar.idx })
      show({ kind: 'jar', idx: d.jar.idx })
    }
  }, [show])
  // 排一次罐子重算：等 delay 毫秒；5 秒內已經算過就排到 5 秒後；已經排了就不重複排（到時候讀到的是最新的）
  const jarTimer = useRef(null)
  const jarLast = useRef(0)
  const requestJar = useCallback((uid, delay) => {
    if (jarTimer.current) return
    const wait = Math.max(delay, jarLast.current + JAR_CHECK_GAP - Date.now())
    jarTimer.current = setTimeout(() => {
      jarTimer.current = null
      jarLast.current = Date.now()
      checkJar(uid)
    }, wait)
  }, [checkJar])
  useEffect(() => () => clearTimeout(jarTimer.current), [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      requestJar(user.id, 1500)
      try {
        const { data } = await supabase.from('users').select('created_at').eq('id', user.id).single()
        if (data && data.created_at) setJoinedDays(daysBetween(twDayOf(data.created_at), twToday()))
      } catch { /* ignore */ }
    })
  }, [requestJar])

  useEffect(() => {
    if (!userId) return
    const on312 = async (e) => {
      const cur = e.detail
      const prev = readSeen(cur.date)
      writeSeen(cur.date, cur)
      // 記完一筆，等資料寫好，再看罐子有沒有新核桃
      requestJar(userId, 1500)
      if (cur.full && !celebratedToday(cur.date)) {
        markCelebrated(cur.date)
        setToast(null)
        show({ kind: 'done', counts: cur })
        // 先在背景把連續天數算好，按「明天繼續」時決定要不要接著跳
        streakAfter.current = null
        loadStreak(userId, cur.date, [cur.date]).then(d => { streakAfter.current = d })
        return
      }
      if (!prev) return
      const jd = jarRef.current
      const logged = newlyLogged(prev, cur)
      const added = (cur.addedIds || []).filter(id => !(prev.addedIds || []).includes(id))
      // 剛剛記的人裡有沒有罐子裡的豆子（顧客、已經是夥伴的不算）
      const beanLogged = !!jd && logged.some(id => jd.beanSet.has(id))
      let t = toastFor(prev, cur)
      let anim = null, jarLine = ''
      if (t && added.length) {
        // 有新名單（就算同時也記了互動）：罐子掉進一顆豆
        jarLine = jarLineForFresh(jd, added.filter(id => !(jd && jd.beanSet.has(id))).length)
        anim = jd ? 'drop' : null
      } else if (t) {
        if (beanLogged) { jarLine = '罐子搖了一下'; anim = 'wobble' }
      } else if (logged.length) {
        // 數字沒變：今天已經記過這一位了
        t = beanLogged
          ? { color: '#2F7A52', title: '罐子搖了一下', sub: '今天已經算過他了，再聊還是好事' }
          : { color: '#2F7A52', title: '記好了', sub: '今天已經算過他了' }
        if (beanLogged) anim = 'wobble'
      }
      if (t) {
        setToast({ ...t, jarLine, anim, jar: anim && jd ? jd.jar : null, id: Date.now() })
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setToast(null), TOAST_MS)
      }
    }
    const onShow = async () => {
      const d = await loadStreak(userId)
      show({ kind: 'streak', data: d, celebrate: false })
    }
    const onShake = () => requestJar(userId, 800)
    window.addEventListener('ufa:312', on312)
    window.addEventListener('ufa:show-streak', onShow)
    window.addEventListener('ufa:jar-shake', onShake)
    // 一打開 App 就先記下今天的數字，第一筆記錄才比得出「變多了」
    if (!readSeen(twToday())) syncDaily3(supabase, userId).catch(() => { /* 離線時略過 */ })
    return () => { window.removeEventListener('ufa:312', on312); window.removeEventListener('ufa:show-streak', onShow); window.removeEventListener('ufa:jar-shake', onShake) }
  }, [userId, show, requestJar])

  function afterDone() {
    const d = streakAfter.current
    // 新人前兩天先不跳連續天數；其他人只在里程碑或休息日救回來那天跳
    if (d && joinedDays >= 2 && (isMilestone(d.streak.count) || d.streak.restUsedYesterday)) {
      const sc = { kind: 'streak', data: d, celebrate: true }
      screenRef.current = sc
      setScreen(sc)
    } else closeScreen()
  }

  return (
    <>
      <BeanStyle />
      <style>{TOAST_CSS}</style>
      {toast && (
        // 外層負責置中（不用 transform，免得被彈出動畫蓋掉而歪到右邊）
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 1900, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div role="status" style={{ pointerEvents: 'auto',
          width: '100%', maxWidth: 400, background: '#1E2A44', color: '#fff', borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', boxSizing: 'border-box' }}
          className="bean-pop" onClick={() => setToast(null)} key={toast.id}>
          {toast.jar ? (
            <span style={{ position: 'relative', width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center' }} data-anim={toast.anim}>
              <JarArt stage={toast.jar.idx} fill={Math.max(0.25, toast.jar.fill)} walnuts={0} size={30} wobble={toast.anim === 'wobble'} />
              {toast.anim === 'drop' && (
                <svg className="jar-drop" width="12" height="9" viewBox="-6 -4.5 12 9" style={{ position: 'absolute', top: 2, left: 11 }} aria-hidden="true">
                  <ellipse rx="5.2" ry="3.7" fill="#E2B57A" /><path d="M-3,-1 q3,-2 6,0" stroke="#F3D3A6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </span>
          ) : (
            <span style={{ background: toast.color, borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>✓</span>
          )}
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{toast.title}</span>
            <span style={{ display: 'block', fontSize: 13, opacity: 0.8 }}>{toast.sub}</span>
            {toast.jarLine && <span style={{ display: 'block', fontSize: 12, color: '#F3D3A6', marginTop: 1 }}>{toast.jarLine}</span>}
          </span>
        </div>
        </div>
      )}
      {screen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--page)', overflowY: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px calc(24px + env(safe-area-inset-bottom))' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            {screen.kind === 'done' ? <DoneView counts={screen.counts} onNext={afterDone} />
              : screen.kind === 'streak' ? <StreakView data={screen.data} celebrate={screen.celebrate} onClose={closeScreen} />
              : screen.kind === 'jar' ? <JarUpView idx={screen.idx} onClose={closeScreen} />
              : <WalnutUpView list={screen.list} userId={userId} onClose={closeScreen} onInvite={w => { closeScreen(); setInvite(w) }} />}
          </div>
        </div>
      )}
      {invite && <InviteSheet userId={userId} contact={invite} onClose={() => setInvite(null)} onSaved={() => setInvite(null)} />}
    </>
  )
}

// 首頁「今天的 3-1-2」卡片最上面：三個進度圈＋連續天數小火焰
function Ring({ value, goal, color, soft, label }) {
  const r = 22, c = 2 * Math.PI * r
  const done = value >= goal
  const pct = Math.min(1, goal ? value / goal : 0)
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-label={`${label} ${value}/${goal}`} role="img">
        {done ? (
          <>
            <circle cx="28" cy="28" r={r + 3.5} fill={color} />
            <path d="M19 28.5l6 6 12-13" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="28" cy="28" r={r} fill="none" stroke={soft} strokeWidth="7" />
            {pct > 0 && <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray .5s ease' }} />}
            <text x="28" y="33" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{Math.min(value, goal)}/{goal}</text>
          </>
        )}
      </svg>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export function TodayRings({ talk, plan, fresh, mode, streakCount, showFlame }) {
  return (
    <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
      <BeanStyle />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Ring value={talk} goal={mode.talk} color="#2F7A52" soft="var(--green-soft)" label="互動" />
        <Ring value={plan} goal={mode.meet} color="#2457D6" soft="var(--primary-soft)" label="邀約" />
        <Ring value={fresh} goal={mode.fresh} color="#C9822B" soft="var(--yellow-soft)" label="新名單" />
        {showFlame && (
          <button onClick={() => window.dispatchEvent(new CustomEvent('ufa:show-streak'))} aria-label={`連續行動 ${streakCount} 天`}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ height: 56, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Flame size={26} animate={streakCount > 0} />
              <span style={{ fontSize: 20, fontWeight: 700, color: streakCount > 0 ? '#F08A3C' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{streakCount}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>連續天數</span>
          </button>
        )}
      </div>
    </div>
  )
}
