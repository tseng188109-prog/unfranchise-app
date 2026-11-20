// homeTeam.jsx — 首頁跟戰隊有關的兩個小東西：
//   最上面鈴鐺旁邊的「戰隊」按鈕（有新的好消息時有小紅點）
//   「今天的 3-1-2」卡裡的搭檔提醒（搭檔今天已經行動、我還沒）
import { useEffect, useState } from 'react'
import { IconFlag, IconChevronRight } from '@tabler/icons-react'
import { Avatar } from './avatar'
import { hasNewNews, loadBuddies } from './teamData'
import { TEXT_MAIN } from './designTokens'

export function TeamButton({ userId, onClick }) {
  const [dot, setDot] = useState(false)
  useEffect(() => {
    if (!userId) return
    let alive = true
    hasNewNews(userId).then(v => { if (alive) setDot(v) }).catch(() => {})
    return () => { alive = false }
  }, [userId])
  return (
    <button onClick={onClick} aria-label={dot ? '戰隊，有新的好消息' : '戰隊'}
      style={{ position: 'relative', background: 'var(--sub2)', border: 'none', borderRadius: '50%',
        width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <IconFlag size={18} stroke={1.9} color={TEXT_MAIN} />
      {dot && <span style={{ position: 'absolute', top: 1, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#EF4444', border: '2px solid var(--page)', boxSizing: 'border-box' }} />}
    </button>
  )
}

export function BuddyNudge({ userId }) {
  const [b, setB] = useState(null)
  useEffect(() => {
    let alive = true
    const refresh = () => loadBuddies(userId).then(d => {
      if (!alive) return
      // 搭檔今天已經行動、我還沒：挑「我做了之後連勝最長」的那位
      const list = d.active.filter(x => x.streak.otherToday && !x.streak.meToday).sort((p, q) => q.ifIAct - p.ifIAct)
      setB(list[0] || null)
    }).catch(() => {})
    refresh()
    const on312 = () => setTimeout(refresh, 1500)
    window.addEventListener('ufa:312', on312)
    return () => { alive = false; window.removeEventListener('ufa:312', on312) }
  }, [userId])
  if (!b) return null
  return (
    <button onClick={() => window.dispatchEvent(new CustomEvent('ufa:show-streak'))}
      style={{ width: 'calc(100% - 24px)', margin: '10px 12px', padding: '9px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: 'var(--orange-soft)', color: 'var(--orange-text)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', lineHeight: 1.5 }}>
      <Avatar name={b.name} size={24} />
      <span style={{ flex: 1 }}>{b.name}今天已經行動了，你也做一件事，連勝就到 {b.ifIAct} 天</span>
      <IconChevronRight size={16} stroke={1.9} />
    </button>
  )
}
