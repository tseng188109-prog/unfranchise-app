// jar.jsx — 豆子罐（入口：底部「互動名單」最上面）
// 罐子＝整份名單。空心豆＝還沒聊過、實心豆＝聊過、核桃＝對方自己表示想了解（約成過、大四、有興趣）。
// 罐子分四段：小玻璃罐 10、果醬罐 30、泡菜罐 100、豆子大罐 300；超過 300 每 300 位一個滿罐擺上架。
import { useEffect, useState, useId, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconStar, IconChevronRight, IconX } from '@tabler/icons-react'
import { loadJar, saveJarPrefs, sinkWalnut } from './jarData'
import { setTop10, fetchTop10, TOP10_MAX } from './top10'
import { InviteSheet } from './invite'
import { MemoryJogSheet } from './beanJar'
import { JAR_STAGES, WALNUT_GOAL, walnutNext, missingInfo, DEFAULT_MONTH_GOAL } from '../lib/jar'
import { RADIUS } from './designTokens'

const JAR_CSS = `
@keyframes jar-wobble { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-5deg) } 45% { transform: rotate(4deg) } 70% { transform: rotate(-2deg) } }
@keyframes jar-rise { 0% { transform: translateY(10px); opacity: .2 } 100% { transform: translateY(0); opacity: 1 } }
.jar-wobble { animation: jar-wobble .8s ease-in-out; transform-origin: 50% 95% }
.jar-rise { animation: jar-rise .7s ease-out both }
@media (prefers-reduced-motion: reduce) { .jar-wobble, .jar-rise { animation: none } }
`

// ── 罐子的樣子（四段各有各的樣子；viewBox 120×140） ──
const SHAPES = [
  { // 小玻璃罐：圓瓶＋軟木塞
    body: 'M48,52 C26,54 18,74 18,96 C18,120 34,134 60,134 C86,134 102,120 102,96 C102,74 94,54 72,52 Z',
    top: 62, bottom: 132, left: 20, right: 100,
    deco: <>
      <path d="M48,52 L48,42 L72,42 L72,52" fill="#EEF5F7" stroke="#BFD3D9" strokeWidth="2" />
      <path d="M45,26 Q45,22 49,22 L71,22 Q75,22 75,26 L74,44 L46,44 Z" fill="#C9A27A" />
      <path d="M49,30 L71,30 M48,37 L72,37" stroke="#B48A5F" strokeWidth="1.3" />
    </>,
  },
  { // 果醬罐：格子布蓋＋緞帶
    body: 'M24,50 L24,120 Q24,134 38,134 L82,134 Q96,134 96,120 L96,50 Z',
    top: 52, bottom: 132, left: 26, right: 94,
    deco: <>
      <rect x="27" y="40" width="66" height="12" rx="3" fill="#D9DEE1" stroke="#BCC4C9" strokeWidth="1.4" />
      <path d="M17,40 Q12,22 27,16 L93,16 Q108,22 103,40 Q88,49 79,38 Q69,49 60,38 Q51,49 41,38 Q31,49 17,40 Z" fill="url(#GING)" stroke="#E2A2A6" strokeWidth="1.2" />
      <path d="M24,40 L96,40" stroke="#C9586A" strokeWidth="3" strokeLinecap="round" />
      <path d="M88,40 q10,-4 9,7 M88,40 q4,9 -5,11" stroke="#C9586A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>,
  },
  { // 泡菜罐：金屬扣環蓋＋名單標籤
    body: 'M30,38 Q20,43 20,57 L20,118 Q20,134 36,134 L84,134 Q100,134 100,118 L100,57 Q100,43 90,38 Z',
    top: 44, bottom: 132, left: 22, right: 98,
    deco: <>
      <path d="M25,26 Q25,19 33,19 L87,19 Q95,19 95,26 L95,34 L25,34 Z" fill="#EEF5F7" stroke="#BFD3D9" strokeWidth="2" />
      <rect x="22" y="32" width="76" height="7" rx="3" fill="#E9A15A" />
      <path d="M22,35 L13,52 L21,62 M98,35 L107,52 L99,62" stroke="#9AA5AD" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </>,
    label: true,
  },
  { // 豆子大罐：透明大罐子
    body: 'M24,34 Q14,40 14,54 L14,116 Q14,134 34,134 L86,134 Q106,134 106,116 L106,54 Q106,40 96,34 Z',
    top: 40, bottom: 132, left: 16, right: 104,
    deco: <>
      <rect x="22" y="12" width="76" height="14" rx="6" fill="#C9B79C" />
      <rect x="27" y="24" width="66" height="9" rx="3" fill="#E5DCCB" />
    </>,
  },
]

function Walnut({ x, y, s = 1, cls }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}><g className={cls}>
      <path d="M0,-9 C6.5,-9 10,-4 10,1 C10,6.5 6,10 0,10 C-6,10 -10,6.5 -10,1 C-10,-4 -6.5,-9 0,-9Z" fill="#9A6A3F" />
      <path d="M0,-8 C-1,-3 1,3 0,9" stroke="#6F4825" strokeWidth="1.4" fill="none" />
      <path d="M-6,-4 q2.5,2.5 0,6 M6,-4 q-2.5,2.5 0,6" stroke="#7B532E" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <ellipse cx="-4" cy="-4" rx="2" ry="1.3" fill="#B98A5C" />
    </g></g>
  )
}

export function WalnutIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}><Walnut x={0} y={0} /></svg>
}

// stage：0..3；fill：0..1；walnuts：要畫幾顆核桃；talkedShare：實心豆比例
export function JarArt({ stage = 0, fill = 0, walnuts = 0, size = 96, wobble = false, rise = false, label }) {
  const raw = useId()
  const id = 'j' + raw.replace(/[^a-zA-Z0-9]/g, '')
  const sh = SHAPES[Math.max(0, Math.min(3, stage))]
  const h = sh.bottom - sh.top
  const level = fill > 0 ? Math.max(8, h * Math.min(1, fill)) : 0
  const surface = sh.bottom - level
  const nW = Math.min(walnuts, WALNUT_GOAL)
  const span = sh.right - sh.left - 24
  const wx = i => sh.left + 12 + (nW === 1 ? span / 2 : (span * i) / Math.max(1, nW - 1))
  return (
    <svg width={size} height={size * 140 / 120} viewBox="0 0 120 140" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <pattern id={id + 'b'} width="22" height="16" patternUnits="userSpaceOnUse">
          <rect width="22" height="16" fill="#F7EBDA" />
          <ellipse cx="6" cy="5" rx="5.2" ry="3.7" fill="#E2B57A" /><path d="M3,4 q3,-2 6,0" stroke="#F3D3A6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <ellipse cx="17" cy="6" rx="5.2" ry="3.7" fill="#FFF8EE" stroke="#E6CFAE" strokeWidth="1" />
          <ellipse cx="11" cy="12.5" rx="5.2" ry="3.7" fill="#D9A766" /><path d="M8,11.5 q3,-2 6,0" stroke="#EFC994" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <ellipse cx="0" cy="13" rx="5.2" ry="3.7" fill="#FFF8EE" stroke="#E6CFAE" strokeWidth="1" />
          <ellipse cx="22" cy="13" rx="5.2" ry="3.7" fill="#FFF8EE" stroke="#E6CFAE" strokeWidth="1" />
        </pattern>
        <pattern id="GING" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#FFF" /><rect width="4" height="8" fill="#E8858A" opacity=".55" /><rect width="8" height="4" fill="#E8858A" opacity=".55" />
        </pattern>
        <clipPath id={id + 'c'}><path d={sh.body} /></clipPath>
      </defs>
      <style>{JAR_CSS}</style>
      <g className={wobble ? 'jar-wobble' : undefined}>
        <ellipse cx="60" cy="137" rx="44" ry="3.5" fill="#000" opacity=".06" />
        <path d={sh.body} fill="#EEF5F7" fillOpacity=".55" stroke="#BFD3D9" strokeWidth="2" />
        {level > 0 && <rect x="0" y={surface} width="120" height={level + 4} fill={`url(#${id}b)`} clipPath={`url(#${id}c)`} />}
        {Array.from({ length: nW }, (_, i) => (
          <Walnut key={i} x={wx(i)} y={Math.max(sh.top + 8, surface - 6 - (i % 2) * 4)} s={0.9} cls={rise ? 'jar-rise' : undefined} />
        ))}
        <path d={`M${sh.left + 7},${sh.top + 10} L${sh.left + 7},${sh.bottom - 14}`} stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".8" />
        {sh.deco}
        {sh.label && label && (
          <g><rect x="42" y="86" width="36" height="20" rx="4" fill="#FFF8EE" stroke="#E6CFAE" strokeWidth="1.2" />
            <text x="60" y="100" textAnchor="middle" fontSize="10" fontWeight="600" fill="#9A6A3F">{label}</text></g>
        )}
      </g>
    </svg>
  )
}

function stageLine(j) {
  if (j.next) return `${j.stage.name}\u3000${j.count}/${j.stage.cap}，再 ${j.toNext} 位換${j.next.name}`
  return j.fullBig > 0
    ? `豆子大罐\u3000架上 ${j.fullBig} 罐滿了，這一罐 ${j.inCurrent}/300`
    : `豆子大罐\u3000${j.inCurrent}/300`
}

// ── 互動名單最上面的小卡 ──
export function JarCard({ userId, autoOpen = false, onChanged }) {
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(autoOpen)
  const [wob, setWob] = useState(0)
  const reload = useCallback(() => loadJar(userId).then(setD).catch(() => setD(null)), [userId])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    const on = () => { setWob(w => w + 1); setTimeout(reload, 900) }
    window.addEventListener('ufa:312', on)
    window.addEventListener('ufa:jar-shake', on)
    return () => { window.removeEventListener('ufa:312', on); window.removeEventListener('ufa:jar-shake', on) }
  }, [reload])
  if (!d) return null
  const j = d.jar
  const goal = d.prefs.monthGoal
  const few = d.beans < 10
  return (
    <>
      <style>{JAR_CSS}</style>
      <button onClick={() => setOpen(true)} aria-label="打開我的罐子"
        style={{ width: '100%', display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: RADIUS.xl, padding: '10px 14px' }}>
        <span key={wob} className={wob ? 'jar-wobble' : undefined} style={{ flexShrink: 0 }}>
          <JarArt stage={j.idx} fill={j.fill} walnuts={d.walnuts.length} size={72} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{`我的罐子\u3000${d.beans} 位`}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', margin: '2px 0 6px' }}>
            {j.stage.name}・聊過的 {d.talked} 顆是實心・本月新豆 {d.monthNew}/{goal}
          </span>
          {few ? (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--yellow-text)', lineHeight: 1.5 }}>只放幾顆豆子，怎麼搖都搖不出核桃。先放滿 10 顆吧。</span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <WalnutIcon size={16} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow-text)' }}>核桃 {d.walnuts.length} / {WALNUT_GOAL}</span>
              {d.walnuts.some(w => w.cooling) && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: 'var(--yellow-soft)', color: 'var(--yellow-text)', marginLeft: 4 }}>{d.walnuts.filter(w => w.cooling).length} 顆熱度在退</span>}
            </span>
          )}
        </span>
        <IconChevronRight size={18} stroke={1.8} color="var(--muted)" />
      </button>
      {open && <JarSheet userId={userId} data={d} onClose={() => setOpen(false)} onChanged={() => { reload(); onChanged && onChanged() }} />}
    </>
  )
}

// ── 核桃一列：點開有四個動作 ──
function WalnutRow({ w, top10Full, onChanged, onInvite }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const miss = missingInfo(w)
  const act = { flex: 1, padding: '9px 6px', borderRadius: RADIUS.md, border: '1px solid var(--border2)', background: 'var(--card)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
        <WalnutIcon size={18} />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{w.name || '未命名'}</span>
        {w.is_top10 && <IconStar size={14} stroke={2} color="var(--primary)" />}
        <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.reason}</span>
        {w.cooling && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: 'var(--yellow-soft)', color: 'var(--yellow-text)', whiteSpace: 'nowrap' }}>
          熱度在退{w.days != null ? `・${w.days} 天沒聯絡` : ''}</span>}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.6 }}>
            建議：{walnutNext(w)}
            {miss.length > 0 && <span style={{ color: 'var(--muted)' }}>{`\u3000還沒填${miss.join('、')}，點「打開」補一下`}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!w.is_top10 && (
              <button style={{ ...act, color: 'var(--primary)' }} onClick={async () => {
                if (top10Full) { setMsg(`首選 10 已經滿 ${TOP10_MAX} 位，先換掉一位再放`); return }
                await setTop10(w.id, true); setMsg('放進首選 10 了'); onChanged()
              }}>放進首選 10</button>
            )}
            <button style={{ ...act, color: 'var(--primary)' }} onClick={() => onInvite(w)}>記一次邀約</button>
            <button style={{ ...act, color: 'var(--text2)' }} onClick={async () => { await sinkWalnut(w.id); onChanged() }}>先沉下去</button>
            <button style={{ ...act, color: 'var(--text)' }} onClick={() => navigate(`/contacts/${w.id}`)}>打開</button>
          </div>
          {msg && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{msg}</div>}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>「先沉下去」：之後又約成一次，才會再浮上來。</div>
        </div>
      )}
    </div>
  )
}

// ── 罐子大畫面 ──
export function JarSheet({ userId, data, onClose, onChanged }) {
  const [d, setD] = useState(data)
  const [top10Count, setTop10Count] = useState(0)
  const [invite, setInvite] = useState(null)
  const [jog, setJog] = useState(false)
  const reload = useCallback(async () => {
    const [nd, t] = await Promise.all([loadJar(userId), fetchTop10(userId)])
    setD(nd); setTop10Count((t.rows || []).length)
    onChanged && onChanged()
  }, [userId, onChanged])
  useEffect(() => { fetchTop10(userId).then(t => setTop10Count((t.rows || []).length)) }, [userId])
  const j = d.jar
  const goal = d.prefs.monthGoal
  const maxBar = Math.max(goal, ...d.bars.map(b => b.n), 1)

  async function setGoal(g) {
    const ng = Math.max(10, Math.min(300, g))
    await saveJarPrefs(userId, { monthGoal: ng })
    setD({ ...d, prefs: { ...d.prefs, monthGoal: ng } })
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: RADIUS.lg, padding: '12px 14px', marginBottom: 10 }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-label="我的罐子" style={{ background: 'var(--page)', borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', padding: '14px 16px calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>我的罐子</div>
          <button onClick={onClose} aria-label="關閉" style={{ marginLeft: 'auto', background: 'var(--sub)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconX size={18} stroke={2} color="var(--text2)" />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 2px' }}>
          <JarArt stage={j.idx} fill={j.fill} walnuts={d.walnuts.length} size={170} rise label="名單" />
        </div>
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{stageLine(j)}</div>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', margin: '2px 0 12px' }}>{'空心豆＝還沒聊過\u3000實心豆＝聊過了\u3000核桃＝對方自己表示想了解'}</div>

        {j.fullBig > 0 && (
          <div style={{ ...card, paddingBottom: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>架上的滿罐</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {Array.from({ length: Math.min(j.fullBig, 10) }, (_, i) => <JarArt key={i} stage={3} fill={1} walnuts={0} size={42} />)}
              <JarArt stage={3} fill={j.fill} walnuts={0} size={42} />
              {j.fullBig > 10 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>還有 {j.fullBig - 10} 罐</span>}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#C99A66', marginTop: 2 }} />
          </div>
        )}

        {d.beans < 10 && (
          <div style={{ ...card, background: 'var(--yellow-soft)', border: 'none' }}>
            <div style={{ fontSize: 14, color: 'var(--yellow-text)', lineHeight: 1.6, marginBottom: 8 }}>只放 2、3 顆豆子，怎麼搖都搖不出核桃。先放滿 10 顆，罐子就會換成果醬罐。</div>
            <button onClick={() => setJog(true)} style={{ width: '100%', padding: 11, border: 'none', borderRadius: RADIUS.md, background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>想想還有誰（記憶喚醒）</button>
          </div>
        )}

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WalnutIcon size={18} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--yellow-text)' }}>核桃 {d.walnuts.length} / {WALNUT_GOAL}</span>
          </div>
          {d.walnuts.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>
              還沒有核桃浮上來。多搖罐子（多互動、多開口），感興趣的人就會自己浮上來：約成過、需求度大四、或見完面有興趣的人。
            </div>
          ) : d.walnuts.map(w => (
            <WalnutRow key={w.id} w={w} top10Full={top10Count >= TOP10_MAX} onChanged={reload} onInvite={setInvite} />
          ))}
        </div>

        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>你自己的核桃比例</div>
          {d.ratio ? (
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
              你每聊 <b style={{ color: 'var(--text)' }}>{d.ratio.per} 位</b>，大約有 1 位變核桃。
              {d.ratio.need > 0
                ? <>目前 {d.walnuts.length} 顆，要到 {WALNUT_GOAL} 顆，大概還要再聊 <b style={{ color: 'var(--text)' }}>{d.ratio.need} 位</b>。</>
                : <>核桃已經到 {WALNUT_GOAL} 顆了，好好跟進他們。</>}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>聊過 30 位以上、而且有核桃浮上來，就算得出你自己的比例（現在聊過 {d.talked} 位）。</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>只跟自己比，每個人的比例本來就不一樣。</div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>每個月放了幾顆新豆</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text2)' }}>
              目標
              <button aria-label="目標少一點" onClick={() => setGoal(goal - 10)} disabled={goal <= 10} style={{ background: 'none', border: 'none', color: goal <= 10 ? 'var(--border2)' : 'var(--primary)', fontSize: 18, cursor: 'pointer', padding: '0 6px' }}>‹</button>
              <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{goal}</b>
              <button aria-label="目標多一點" onClick={() => setGoal(goal + 10)} disabled={goal >= 300} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 18, cursor: 'pointer', padding: '0 6px' }}>›</button>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 74 }}>
            {d.bars.map(b => (
              <div key={b.month} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{b.n}</div>
                <div style={{ height: Math.max(3, Math.round(50 * b.n / maxBar)), background: b.n >= goal ? '#D9A766' : '#F3D3A6', borderRadius: 4 }} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>預設 {DEFAULT_MONTH_GOAL}（每天 2 位），可以照自己的時間調。</div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, padding: '0 4px' }}>
          罐子四段：{JAR_STAGES.map(s => `${s.name} ${s.cap}`).join('、')}。裝滿就換大罐子，只會變大、不會變小；超過 300 位，每 300 位一個滿罐擺上架。
        </div>
      </div>
      {invite && (
        <InviteSheet userId={userId} contact={invite} onClose={() => setInvite(null)} onSaved={() => { setInvite(null); reload() }} />
      )}
      {jog && <MemoryJogSheet onClose={() => setJog(false)} />}
    </div>
  )
}
