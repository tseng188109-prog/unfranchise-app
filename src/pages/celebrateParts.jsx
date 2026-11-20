// celebrateParts.jsx — 慶祝畫面用的小零件：彩帶、數字往上滾、誇自己的按鈕、
// 搭檔到重要天數、打開 App 的打氣小卡、連續天數畫面裡的「搭檔連勝」
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, AvatarStack } from './avatar'
import { Flame, BigFlame } from './bean'
import { askConfirm } from './confirmDialog'
import { selfPraise, loadBuddies, buddyRpc, myTeammates } from './teamData'
import { canReceivePush } from './pushCheck'
import { titleOf, nextTitleOf, unlockedAt, BUDDY_MAX } from '../lib/buddy'

const BTN = { width: '100%', padding: 14, border: 'none', borderRadius: 16, background: 'var(--primary)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 0 #1A42A8' }
const TITLE_CHIP = { fontSize: 11, padding: '1px 8px', borderRadius: 999, background: 'var(--yellow-soft)', color: 'var(--yellow-text)', fontWeight: 600, whiteSpace: 'nowrap' }

// 彩帶：從上面灑下來一次
export function Confetti({ count = 36 }) {
  const colors = ['#F08A3C', '#F5B841', '#2457D6', '#22C55E', '#A855F7', '#EC4899']
  // 用編號算出每片的位置（看起來亂，但每次畫面重畫都一樣）
  const r = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
  const pieces = Array.from({ length: count }, (_, i) => ({
    left: Math.round(r(i, 1) * 100),
    color: colors[i % colors.length],
    dx: Math.round((r(i, 2) - 0.5) * 120) + 'px',
    rot: Math.round(360 + r(i, 3) * 540) + 'deg',
    dur: (1.8 + r(i, 4) * 1.4).toFixed(2) + 's',
    delay: (r(i, 5) * 0.5).toFixed(2) + 's',
  }))
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2001 }}>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ left: p.left + '%', background: p.color, '--dx': p.dx, '--rot': p.rot, '--dur': p.dur, '--delay': p.delay }} />
      ))}
    </div>
  )
}

// 數字從 from 滾到 to（from 沒有就直接顯示 to）
export function RollNumber({ from, to, style }) {
  if (from === undefined || from === null || from === to) return <span style={style}>{to}</span>
  return (
    <span style={{ display: 'inline-block', height: '1.05em', overflow: 'hidden', verticalAlign: 'bottom', ...style }}>
      <span className="num-roll" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span>{from}</span><span>{to}</span>
      </span>
    </span>
  )
}

// 完成後的按鈕：每次隨機一句誇自己的話（句子包 self 那組）
export function SelfButton({ onClick }) {
  const [text] = useState(() => selfPraise())
  return <button onClick={onClick} style={BTN}>{text}</button>
}

// ───────── 搭檔到重要天數（兩個人打開 App 都會看到一次） ─────────
export function BuddyMilestoneView({ b, myName, onClose }) {
  const n = b.streak.count
  const unlocked = unlockedAt(n)
  const next = nextTitleOf(n)
  return (
    <div style={{ textAlign: 'center' }}>
      {unlocked && <Confetti />}
      <div style={{ display: 'flex', justifyContent: 'center' }}>{unlocked ? <BigFlame size={140} /> : <div className="bean-pop"><Flame size={78} animate /></div>}</div>
      <div style={{ fontSize: 52, fontWeight: 700, color: '#F08A3C', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
        <RollNumber from={n - 1} to={n} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, margin: '12px 0 8px' }}>
        <Avatar name={myName} size={32} /><span style={{ fontSize: 13, color: 'var(--muted)' }}>和</span><Avatar name={b.name} size={32} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5 }}>你和{b.name}已經一起連續行動 {n} 天</div>
      {unlocked && <div className="bean-pop" style={{ display: 'inline-block', marginTop: 10, padding: '5px 16px', borderRadius: 999, background: 'var(--yellow-soft)', color: 'var(--yellow-text)', fontSize: 15, fontWeight: 600 }}>解鎖稱號：{unlocked}</div>}
      {next && <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 10 }}>再 {next.n - n} 天，就能成為{next.title}</div>}
      <div style={{ marginTop: 22 }}><SelfButton onClick={onClose} /></div>
    </div>
  )
}

// ───────── 打開 App 的打氣小卡 ─────────
export function CheerView({ list, onClose }) {
  const navigate = useNavigate()
  const [needPush, setNeedPush] = useState(false)
  useEffect(() => { canReceivePush().then(ok => setNeedPush(!ok)) }, [])
  const first = list[0]
  const others = [...new Set(list.slice(1).map(c => c.name).filter(n => n !== first.name))]
  const stack = [first.name, ...others].slice(0, 3)
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="bean-pop" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><AvatarStack names={stack} size={52} /></div>
      <div style={{ fontSize: 15, color: 'var(--text2)' }}>{first.name}給你打氣</div>
      <div style={{ fontSize: 23, fontWeight: 700, color: 'var(--text)', margin: '8px 0 6px', lineHeight: 1.45 }}>{first.text}</div>
      {others.length > 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{others.join('、')}也給你打氣</div>}
      <div style={{ marginTop: 22 }}><button onClick={onClose} style={BTN}>好，去做</button></div>
      {needPush && (
        <button onClick={() => { onClose(); navigate('/settings?s=push') }}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14, cursor: 'pointer', padding: 6 }}>
          開啟通知，隊友打氣時你馬上就會知道 ›
        </button>
      )}
    </div>
  )
}

// ───────── 連續天數畫面裡的「搭檔連勝」 ─────────
function statusLine(b) {
  const s = b.streak
  if (!s.count && b.best) return `連勝中斷了，今天重新開始。最高紀錄是 ${b.best} 天。`
  if (s.meToday && s.otherToday) return '你們今天都行動了'
  if (s.otherToday) return `${b.name}今天已經行動了，換你了`
  if (s.meToday) return `你今天已經行動了，等${b.name}也做一件事`
  return '你們今天都還沒行動'
}

export function BuddySection({ userId, onGoTeam }) {
  const [data, setData] = useState(null)
  const [team, setTeam] = useState(null)
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState(null)
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)
  useEffect(() => {
    if (!userId) return
    let alive = true
    Promise.all([loadBuddies(userId), myTeammates(userId)]).then(([d, t]) => { if (alive) { setData(d); setTeam(t) } }).catch(() => {})
    return () => { alive = false }
  }, [userId, tick])
  if (!data || !team) return null

  const used = data.active.length + data.pending.filter(p => !p.incoming).length
  const taken = new Set([...data.active, ...data.pending].map(b => b.otherId))
  const candidates = team.mates.filter(m => !taken.has(m.user_id))
  const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', textAlign: 'left' }
  const linkBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '4px 2px' }

  async function act(fn, args, okMsg) {
    setMsg('')
    const r = await buddyRpc(fn, args)
    if (!r.ok) setMsg(r.error); else if (okMsg) setMsg(okMsg)
    setPicking(false); setOpen(null)
    reload()
  }

  return (
    <div style={{ textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>搭檔連勝</span>
        {team.teamId && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{data.active.length} / {BUDDY_MAX} 位</span>}
      </div>

      {data.active.map(b => {
        const t = titleOf(b.streak.count)
        return (
          <div key={b.id}>
            <button onClick={() => setOpen(open === b.id ? null : b.id)} style={{ ...row, width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Avatar name={b.name} size={32} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{b.name}{t && <span style={TITLE_CHIP}>{t}</span>}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{statusLine(b)}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 18, fontWeight: 700, color: b.streak.count ? '#F08A3C' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                <Flame size={18} dim={!(b.streak.meToday && b.streak.otherToday)} />{b.streak.count}
              </span>
            </button>
            {open === b.id && (
              <div style={{ padding: '0 0 8px 42px' }}>
                <button style={{ ...linkBtn, color: 'var(--danger-text)' }} onClick={async () => {
                  if (!(await askConfirm({ title: `結束和${b.name}的搭檔？`, message: '連勝會一起歸零。對方不會收到通知。', okText: '結束搭檔', danger: true }))) return
                  act('buddy_end', { p_id: b.id })
                }}>結束搭檔</button>
              </div>
            )}
          </div>
        )
      })}

      {data.pending.map(p => (
        <div key={p.id} style={row}>
          <Avatar name={p.name} size={32} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{p.incoming ? `${p.name}想跟你當搭檔` : `已經邀請${p.name}，等他回覆`}</span>
          </span>
          {p.incoming ? (
            <>
              <button style={{ ...linkBtn, color: 'var(--text2)' }} onClick={() => act('buddy_decline', { p_id: p.id })}>不用了</button>
              <button style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => act('buddy_accept', { p_id: p.id }, `你和${p.name}成為搭檔了，從今天開始算`)}>好啊</button>
            </>
          ) : (
            <button style={{ ...linkBtn, color: 'var(--text2)' }} onClick={() => act('buddy_end', { p_id: p.id })}>收回</button>
          )}
        </div>
      ))}

      {!team.teamId ? (
        <button onClick={onGoTeam} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 12, border: '1px dashed var(--border2)', background: 'none', color: 'var(--primary)', fontSize: 14, cursor: 'pointer' }}>
          加入戰隊後，就能邀隊友當搭檔 ›
        </button>
      ) : used < BUDDY_MAX && (
        picking ? (
          <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, padding: '4px 12px' }}>
            {candidates.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--text2)', padding: '10px 0' }}>戰隊裡的隊友都已經是你的搭檔，或還在等回覆。</div>
              : candidates.map(m => (
                <button key={m.user_id} onClick={() => act('buddy_invite', { p_to: m.user_id }, `邀請送出了，等${m.name}回覆`)}
                  style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <Avatar name={m.name} size={28} />
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{m.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--primary)' }}>邀他</span>
                </button>
              ))}
            <button style={{ ...linkBtn, color: 'var(--text2)', width: '100%' }} onClick={() => setPicking(false)}>取消</button>
          </div>
        ) : (
          <button onClick={() => { setMsg(''); setPicking(true) }} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 12, border: '1px dashed var(--border2)', background: 'none', color: 'var(--primary)', fontSize: 14, cursor: 'pointer' }}>
            + 邀一位隊友當搭檔
          </button>
        )
      )}
      {msg && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>{msg}</div>}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
        兩個人同一天都有互動、邀約或新名單，就加 1 天；休息日一樣算。只有你們兩個看得到。
      </div>
    </div>
  )
}
