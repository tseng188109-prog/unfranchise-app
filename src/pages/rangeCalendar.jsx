// 選一段日期的月曆（像訂房網站）：先點開始那天、再點結束那天，中間整段塗色
// 分享圖卡、給帶領者的報告「自選日期」都用這一個；今天以後不能選、最多 31 天
import { useState, useEffect } from 'react'
import { spanDays } from './periodData'
import { PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER } from './designTokens'

const WD = ['日', '一', '二', '三', '四', '五', '六']
const pad = n => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
function shift(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const navBtn = on => ({ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 10, width: 36, height: 36, cursor: on ? 'pointer' : 'default',
  fontSize: 16, color: TEXT_SECONDARY, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.35 })

export function RangeCalendar({ from, to, today, onPick, marks, onMonth, maxDays = 31 }) {
  // 換了日期（例如按「最近7天」）就跳回結束那天的月份；自己按 ‹ › 換的月份，日期沒變就留著
  const [nav, setNav] = useState({ forTo: to, view: to.slice(0, 7) })
  const view = nav.forTo === to ? nav.view : to.slice(0, 7)
  const [anchor, setAnchor] = useState(null)
  const [note, setNote] = useState('')
  const [y, m] = view.split('-').map(Number)
  const first = ymd(y, m, 1)
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const last = ymd(y, m, daysIn)
  const lead = new Date(first + 'T12:00:00Z').getUTCDay()
  useEffect(() => { if (onMonth) onMonth(first, last) }, [first]) // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = ymd(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) <= today
  const go = n => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setNav({ forTo: to, view: d.toISOString().slice(0, 7) }) }

  function tap(d) {
    if (d > today) return
    setNote('')
    if (!anchor || d < anchor) { setAnchor(d); setNav({ forTo: d, view }); onPick(d, d); return }
    let end = d
    if (spanDays(anchor, end) > maxDays) { end = shift(anchor, maxDays - 1); setNote(`一次最多選 ${maxDays} 天，已經選到 ${+end.slice(5, 7)}/${+end.slice(8)}。`) }
    setNav({ forTo: end, view }); onPick(anchor, end); setAnchor(null)
  }

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(<div key={'b' + i} />)
  for (let d = 1; d <= daysIn; d++) {
    const ds = ymd(y, m, d)
    const fut = ds > today
    const inR = ds >= from && ds <= to
    const isS = ds === from, isE = ds === to
    const single = isS && isE
    cells.push(
      <button key={ds} onClick={() => tap(ds)} disabled={fut} aria-label={`${m}月${d}日`} aria-pressed={inR}
        style={{ position: 'relative', height: 42, border: 'none', background: 'none', padding: 0, cursor: fut ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {inR && !single && (
          <span style={{ position: 'absolute', top: 4, bottom: 4, left: isS ? '50%' : 0, right: isE ? '50%' : 0, background: PRIMARY_SOFT }} />
        )}
        <span style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: isS || isE ? 700 : 400,
          background: isS || isE ? PRIMARY : 'none', color: isS || isE ? '#fff' : fut ? 'var(--border2)' : TEXT_MAIN }}>{d}</span>
        {marks && marks.has(ds) && !fut && (
          <span style={{ position: 'absolute', bottom: 1, width: 5, height: 5, borderRadius: '50%', background: 'var(--green-text)' }} />
        )}
      </button>
    )
  }

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: '10px 10px 8px', background: 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 6 }}>
        <button onClick={() => go(-1)} style={navBtn(true)} aria-label="上個月">‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN, minWidth: 96, textAlign: 'center' }}>{y} 年 {m} 月</span>
        <button onClick={() => canNext && go(1)} disabled={!canNext} style={navBtn(canNext)} aria-label="下個月">›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {WD.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 11, color: TEXT_MUTED, padding: '4px 0' }}>{w}</div>)}
        {cells}
      </div>
      <div style={{ fontSize: 11, color: note ? 'var(--yellow-text)' : TEXT_MUTED, textAlign: 'center', marginTop: 4, lineHeight: 1.6 }}>
        {note || (anchor ? '再點結束那天' : '先點開始那天，再點結束那天')}
        {!note && marks && <span>{'\u3000'}<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--green-text)', verticalAlign: 'middle', marginRight: 4 }} />那天有記錄行動</span>}
      </div>
    </div>
  )
}
