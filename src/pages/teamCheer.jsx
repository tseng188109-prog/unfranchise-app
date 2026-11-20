// teamCheer.jsx — 戰隊頁新增的三塊：送打氣的面板、這週的好消息（可以鼓掌）、我收到的打氣
import { useEffect, useState } from 'react'
import { IconConfetti, IconCheck, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { Avatar, AvatarStack } from './avatar'
import { CloseBtn } from './ui'
import { CHEER_GROUPS, loadPhrases, sendCheer, loadNews, setClap, myCheers, teamCheerCount } from './teamData'
import { canReceivePush } from './pushCheck'
import { titleOf } from '../lib/buddy'
import { twToday, addDays, weekStartOf, md } from '../lib/rhythm'
import { play } from '../lib/sfx'
import { PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS } from './designTokens'

const card = { background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: '12px 14px' }

function whenText(r) {
  const today = twToday()
  if (r.day === today) {
    const t = new Date(r.created_at).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })
    return `今天 ${t}`
  }
  if (r.day === addDays(today, -1)) return '昨天'
  return md(r.day)
}
function cheerWhen(iso) {
  const day = new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  return whenText({ day, created_at: iso })
}

// ───────── 送打氣的面板 ─────────
// defaultGroup：他今天做滿了就先停在「幫你鼓掌」，其他時候停在「一起開始」
export function CheerSheet({ mate, hasPush, defaultGroup = 'start', onClose, onSent }) {
  const [byGrp, setByGrp] = useState(null)
  const [grp, setGrp] = useState(defaultGroup)
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { loadPhrases().then(setByGrp) }, [])
  const list = (byGrp && byGrp[grp]) || []
  async function send() {
    if (!pick) { setErr('先選一句話'); return }
    setBusy(true); setErr('')
    const r = await sendCheer(mate.user_id, pick)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    play('send')
    onSent(mate)
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-modal="true" aria-label={`給${mate.name}打氣`} onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', width: '100%', maxWidth: 430, borderRadius: '20px 20px 0 0', padding: '16px 16px calc(18px + env(safe-area-inset-bottom))', boxSizing: 'border-box', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={mate.name} size={32} />
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>給{mate.name}打氣</span>
          <CloseBtn onClick={onClose} size={36} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 10px' }}>
          {CHEER_GROUPS.map(g => (
            <button key={g.key} onClick={() => { setGrp(g.key); setPick(null); setErr('') }}
              style={{ fontSize: 13, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: grp === g.key ? 600 : 400,
                border: grp === g.key ? 'none' : '1px solid var(--border2)', background: grp === g.key ? PRIMARY : 'var(--card)', color: grp === g.key ? '#fff' : TEXT_MAIN }}>
              {g.label}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {!byGrp ? <div style={{ fontSize: 13, color: TEXT_MUTED, padding: 12 }}>載入中…</div>
            : list.length === 0 ? <div style={{ fontSize: 13, color: TEXT_MUTED, padding: 12 }}>這一組還沒有句子。</div>
            : list.map(t => (
              <button key={t} onClick={() => { setPick(t); setErr('') }}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, lineHeight: 1.5, padding: '10px 12px', marginBottom: 6, borderRadius: 12, cursor: 'pointer', color: TEXT_MAIN,
                  border: pick === t ? `1.5px solid ${PRIMARY}` : `1px solid ${BORDER}`, background: pick === t ? PRIMARY_SOFT : 'var(--card)' }}>
                <span style={{ flex: 1 }}>{t}</span>
                {pick === t && <IconCheck size={18} stroke={2.2} color={PRIMARY} />}
              </button>
            ))}
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--danger-text)', margin: '6px 2px 0' }}>{err}</div>}
        <button onClick={send} disabled={busy}
          style={{ marginTop: 10, width: '100%', padding: 14, border: 'none', borderRadius: 16, background: PRIMARY, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? '送出中…' : '送出打氣'}
        </button>
        <div style={{ fontSize: 12, color: TEXT_MUTED, textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
          只有{mate.name}看得到{hasPush ? '' : `。${mate.name}沒有開啟通知，下次打開 App 時才會看到`}
        </div>
      </div>
    </div>
  )
}

// ───────── 這週的好消息 ─────────
function newsText(r) {
  switch (r.kind) {
    case 'meet': return `${r.name}約到一位朋友見面`
    case 'retail': return `${r.name}成交一筆零售`
    case 'partner': return `${r.name}推薦了一位新夥伴`
    case 'first312': return `${r.name}第一次做滿一天的 ${r.label || '3-1-2'}`
    case 'streak': return `${r.name}連續行動 ${r.n} 天`
    case 'buddy': return `${r.name}和${r.otherName}成為${titleOf(r.n) || '搭檔'}`
    default: return r.name
  }
}

export function GoodNewsCard({ userId }) {
  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [all, setAll] = useState(false)
  const [who, setWho] = useState(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadNews(userId), teamCheerCount(weekStartOf(twToday()))])
      .then(([r, c]) => { if (alive) { setRows(r); setCount(c) } })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [userId])
  if (!rows) return null
  async function toggle(r) {
    const on = !r.clapped
    if (on) play('pop')
    setRows(rs => rs.map(x => x.id === r.id ? { ...x, clapped: on, claps: x.claps + (on ? 1 : -1), burst: on ? Date.now() : x.burst } : x))
    const ok = await setClap(r.id, userId, on)
    if (!ok) setRows(rs => rs.map(x => x.id === r.id ? { ...x, clapped: !on, claps: x.claps + (on ? -1 : 1) } : x))
  }
  const shown = all ? rows : rows.slice(0, 3)
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN }}>這週的好消息</span>
        {count > 0 && <span style={{ fontSize: 11, color: TEXT_MUTED }}>大家互相打氣 {count} 次</span>}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, padding: '8px 0 2px' }}>
          這週還沒有好消息。約到朋友見面、成交零售、推薦新夥伴，都會出現在這裡。
        </div>
      ) : shown.map((r, i) => (
        <div key={r.id} style={{ borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
            {r.otherName ? <AvatarStack names={[r.name, r.otherName]} size={28} /> : <Avatar name={r.name} size={30} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: TEXT_MAIN, overflowWrap: 'anywhere' }}>{newsText(r)}</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 1 }}>
                {r.kind === 'buddy' && `已經一起連續行動 ${r.n} 天 · `}{whenText(r)}
                {r.own && r.claps > 0 && (
                  <button onClick={() => setWho(who === r.id ? null : r.id)}
                    style={{ background: 'none', border: 'none', padding: 0, marginLeft: 6, color: PRIMARY, fontSize: 11, cursor: 'pointer' }}>
                    {r.claps} 位替你鼓掌 ›
                  </button>
                )}
              </div>
            </div>
            {r.own ? (
              r.claps > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 999, background: 'var(--yellow-soft)', color: 'var(--yellow-text)', fontSize: 12, fontWeight: 600 }}>
                  <IconConfetti size={15} stroke={1.8} />{r.claps}
                </span>
              )
            ) : (
              <button onClick={() => toggle(r)} aria-pressed={r.clapped} aria-label={r.clapped ? '收回鼓掌' : '鼓掌'}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: r.clapped ? 600 : 400,
                  border: r.clapped ? '1px solid transparent' : `1px solid ${BORDER}`, background: r.clapped ? 'var(--yellow-soft)' : 'var(--card)', color: r.clapped ? 'var(--yellow-text)' : TEXT_SECONDARY }}>
                <span key={r.burst || 0} className={r.burst ? 'clap-burst' : undefined} style={{ display: 'flex', position: 'relative' }}>
                  <IconConfetti size={15} stroke={1.8} />
                  {r.burst && ['#F08A3C', '#2457D6', '#22C55E', '#A855F7', '#EC4899', '#F5B841'].map((c, k) => (
                    <span key={k} aria-hidden="true" className="clap-bit" style={{ background: c, '--a': `${k * 60}deg` }} />
                  ))}
                </span>
                {r.clapped ? r.claps : r.claps > 0 ? `鼓掌 ${r.claps}` : '鼓掌'}
              </button>
            )}
          </div>
          {who === r.id && (
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, padding: '0 0 10px 40px' }}>{r.clappers.join('、')}替你鼓掌</div>
          )}
        </div>
      ))}
      {rows.length > 3 && (
        <button onClick={() => setAll(!all)}
          style={{ width: '100%', background: 'none', border: 'none', color: TEXT_SECONDARY, fontSize: 12, padding: '6px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {all ? <>收起來 <IconChevronUp size={14} /></> : <>看全部 {rows.length} 則 <IconChevronDown size={14} /></>}
        </button>
      )}
      <style>{`@keyframes clap-burst { 0% { transform: scale(1) rotate(0) } 35% { transform: scale(1.5) rotate(-18deg) } 70% { transform: scale(.9) rotate(8deg) } 100% { transform: scale(1) rotate(0) } }
.clap-burst { animation: clap-burst .5s ease-out }
@keyframes clap-bit { 0% { transform: rotate(var(--a)) translateY(0) scale(1); opacity: 1 } 100% { transform: rotate(var(--a)) translateY(-18px) scale(.4); opacity: 0 } }
.clap-bit { position: absolute; left: 6px; top: 6px; width: 4px; height: 4px; border-radius: 1px; pointer-events: none; animation: clap-bit .6s ease-out forwards }
@media (prefers-reduced-motion: reduce) { .clap-burst, .clap-bit { animation: none } .clap-bit { display: none } }`}</style>
    </div>
  )
}

// ───────── 我收到的打氣（只有自己看得到） ─────────
export function MyCheersCard({ userId, onEnablePush }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)
  const [needPush, setNeedPush] = useState(false)
  useEffect(() => {
    let alive = true
    myCheers(userId, 7).then(r => { if (alive) setRows(r) }).catch(() => { if (alive) setRows([]) })
    canReceivePush().then(ok => { if (alive) setNeedPush(!ok) })
    return () => { alive = false }
  }, [userId])
  if (!rows) return null
  return (
    <div style={card}>
      <button onClick={() => rows.length && setOpen(!open)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: rows.length ? 'pointer' : 'default', textAlign: 'left' }}>
        <span style={{ flex: 1, fontSize: 14, color: TEXT_MAIN }}>我收到的打氣</span>
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{rows.length ? `最近 7 天 ${rows.length} 則 ${open ? '' : '›'}` : '最近 7 天還沒有'}</span>
      </button>
      {open && rows.map(r => (
        <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0 0' }}>
          <Avatar name={r.name} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, color: TEXT_MAIN, overflowWrap: 'anywhere' }}>{r.text}</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>{r.name} · {cheerWhen(r.created_at)}</div>
          </div>
        </div>
      ))}
      {needPush && (
        <button onClick={onEnablePush}
          style={{ marginTop: 10, width: '100%', textAlign: 'left', fontSize: 12, color: PRIMARY, background: PRIMARY_SOFT, border: 'none', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>
          開啟通知，隊友打氣時你馬上就會知道 ›
        </button>
      )}
    </div>
  )
}
