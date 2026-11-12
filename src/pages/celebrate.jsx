// celebrate.jsx — 做完一件事的小鼓勵、做滿今天的慶祝、連續天數
// Celebrations 放在 Layout 裡，聽 syncDaily3 發出的「今天數字變了」（ufa:312）：
//   數字變多 → 底部跳 2 秒小鼓勵
//   今天第一次做滿 → 整頁「今天完成了」（一天只跳一次）
//   接著如果是里程碑（3、7、14、30… 天）或昨天用休息日守住 → 整頁連續天數
// 首頁的小火焰按下去也會打開連續天數（ufa:show-streak）。
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import { Bean, Flame, BeanStyle } from './bean'
import { loadStreak } from './streakData'
import { twToday, isMilestone, daysBetween, twDayOf, toastFor } from '../lib/rhythm'

const TILE = [
  { key: 'talk', label: '互動', unit: '位', color: '#2F7A52' },
  { key: 'plan', label: '邀約', unit: '個', color: '#2457D6' },
  { key: 'fresh', label: '新名單', unit: '位', color: '#C9822B' },
]
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

export default function Celebrations() {
  const [userId, setUserId] = useState(null)
  const [joinedDays, setJoinedDays] = useState(999)
  const [toast, setToast] = useState(null)
  const [screen, setScreen] = useState(null) // { kind:'done', counts } | { kind:'streak', data, celebrate }
  const timer = useRef(null)
  const streakAfter = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      try {
        const { data } = await supabase.from('users').select('created_at').eq('id', user.id).single()
        if (data && data.created_at) setJoinedDays(daysBetween(twDayOf(data.created_at), twToday()))
      } catch { /* ignore */ }
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    const on312 = async (e) => {
      const cur = e.detail
      const prev = readSeen(cur.date)
      writeSeen(cur.date, cur)
      if (cur.full && !celebratedToday(cur.date)) {
        markCelebrated(cur.date)
        setToast(null)
        setScreen({ kind: 'done', counts: cur })
        // 先在背景把連續天數算好，按「明天繼續」時決定要不要接著跳
        streakAfter.current = null
        loadStreak(userId, cur.date, [cur.date]).then(d => { streakAfter.current = d })
        return
      }
      if (!prev) return
      const t = toastFor(prev, cur)
      if (t) {
        setToast(t)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setToast(null), 2400)
      }
    }
    const onShow = async () => {
      const d = await loadStreak(userId)
      setScreen({ kind: 'streak', data: d, celebrate: false })
    }
    window.addEventListener('ufa:312', on312)
    window.addEventListener('ufa:show-streak', onShow)
    return () => { window.removeEventListener('ufa:312', on312); window.removeEventListener('ufa:show-streak', onShow) }
  }, [userId])

  function afterDone() {
    const d = streakAfter.current
    // 新人前兩天先不跳連續天數；其他人只在里程碑或休息日救回來那天跳
    if (d && joinedDays >= 2 && (isMilestone(d.streak.count) || d.streak.restUsedYesterday)) {
      setScreen({ kind: 'streak', data: d, celebrate: true })
    } else setScreen(null)
  }

  return (
    <>
      <BeanStyle />
      {toast && (
        <div role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 1900,
          width: 'calc(100% - 32px)', maxWidth: 400, background: '#1E2A44', color: '#fff', borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}
          className="bean-pop" onClick={() => setToast(null)}>
          <span style={{ background: toast.color, borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>✓</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{toast.title}</span>
            <span style={{ display: 'block', fontSize: 13, opacity: 0.8 }}>{toast.sub}</span>
          </span>
        </div>
      )}
      {screen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--page)', overflowY: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px calc(24px + env(safe-area-inset-bottom))' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            {screen.kind === 'done'
              ? <DoneView counts={screen.counts} onNext={afterDone} />
              : <StreakView data={screen.data} celebrate={screen.celebrate} onClose={() => setScreen(null)} />}
          </div>
        </div>
      )}
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
