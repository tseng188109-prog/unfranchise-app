// pickers.jsx — 全站統一的選擇器：日期（月曆）、生日（月份格→日期格）、選項清單
// 不用瀏覽器內建的下拉/月曆（電腦上常被擋住或長得跟 App 不一樣）。
// 用法跟原本的 <input type="date"> 一樣：<DateField value onChange min max style />，
// onChange 收到 { target: { value } }，所以原本的 e.target.value 寫法不用改。
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronLeft, IconChevronRight, IconChevronDown } from '@tabler/icons-react'
import { CloseBtn } from './ui'
import { PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS, SUBCARD_BG } from './designTokens'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function todayStr() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function pad(n) { return String(n).padStart(2, '0') }
function fmtDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  const w = WEEK[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]
  return `${y}/${m}/${d} 週${w}`
}

function Sheet({ title, onClose, children }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: '22px 22px 0 0', padding: '18px 18px 28px', width: '100%', maxWidth: 430, maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN, margin: 0 }}>{title}</h3>
          <CloseBtn onClick={onClose} />
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

const arrowBtn = { width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SECONDARY }
const gridBtn = (on, off) => ({
  padding: '12px 0', borderRadius: RADIUS.md, fontSize: 15, cursor: off ? 'default' : 'pointer', textAlign: 'center',
  border: `1px solid ${on ? PRIMARY : BORDER}`, background: on ? PRIMARY : 'transparent',
  color: on ? '#fff' : off ? TEXT_MUTED : TEXT_MAIN, opacity: off ? 0.35 : 1,
})

function fieldStyle(style, has) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, textAlign: 'left', cursor: 'pointer',
    background: 'var(--card)', fontFamily: 'inherit', boxSizing: 'border-box',
    color: has ? TEXT_MAIN : TEXT_MUTED,
    border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, padding: '10px 12px', fontSize: 14,
    ...style,
  }
}

// ── 日期 ──
export function DateField({ value, onChange, min, max, style, placeholder = '選日期', clearable = true }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={fieldStyle(style, !!value)}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value ? fmtDate(value) : placeholder}</span>
      </button>
      {open && (
        <DateSheet value={value} min={min} max={max} clearable={clearable}
          onPick={v => { onChange({ target: { value: v } }); setOpen(false) }}
          onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function DateSheet({ value, min, max, clearable, onPick, onClose }) {
  const t = todayStr()
  const base = value || t
  const [y, setY] = useState(Number(base.slice(0, 4)))
  const [m, setM] = useState(Number(base.slice(5, 7)))
  const [mode, setMode] = useState('day')

  function shift(n) {
    let nm = m + n, ny = y
    if (nm < 1) { nm = 12; ny-- } else if (nm > 12) { nm = 1; ny++ }
    setM(nm); setY(ny)
  }
  const first = new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay()
  const count = new Date(Date.UTC(y, m, 0, 12)).getUTCDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
  const key = d => `${y}-${pad(m)}-${pad(d)}`
  const disabled = d => (min && key(d) < min) || (max && key(d) > max)
  const todayOk = !(min && t < min) && !(max && t > max)

  return (
    <Sheet title="選日期" onClose={onClose}>
      {mode === 'day' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" aria-label="上個月" onClick={() => shift(-1)} style={arrowBtn}><IconChevronLeft size={20} stroke={1.9} /></button>
            <button type="button" onClick={() => setMode('month')}
              style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 600, color: TEXT_MAIN, cursor: 'pointer', padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {y} 年 {m} 月 <IconChevronDown size={14} stroke={1.9} color={TEXT_MUTED} />
            </button>
            <button type="button" aria-label="下個月" onClick={() => shift(1)} style={arrowBtn}><IconChevronRight size={20} stroke={1.9} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, textAlign: 'center', fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 }}>
            {WEEK.map(w => <div key={w}>{w}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
            {cells.map((d, i) => d === null ? <div key={'e' + i} /> : (
              <button type="button" key={d} disabled={!!disabled(d)} onClick={() => onPick(key(d))}
                style={{
                  padding: '11px 0', borderRadius: RADIUS.md, fontSize: 15, textAlign: 'center', fontFamily: 'inherit',
                  cursor: disabled(d) ? 'default' : 'pointer',
                  border: key(d) === t && key(d) !== value ? `1px solid ${PRIMARY}` : '1px solid transparent',
                  background: key(d) === value ? PRIMARY : 'transparent',
                  color: key(d) === value ? '#fff' : disabled(d) ? TEXT_MUTED : key(d) === t ? PRIMARY : TEXT_MAIN,
                  opacity: disabled(d) ? 0.35 : 1,
                }}>{d}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button type="button" disabled={!todayOk} onClick={() => onPick(t)}
              style={{ background: 'none', border: 'none', color: todayOk ? PRIMARY : TEXT_MUTED, fontSize: 14, padding: '10px 4px', cursor: todayOk ? 'pointer' : 'default' }}>回到今天</button>
            {clearable && value && (
              <button type="button" onClick={() => onPick('')}
                style={{ background: 'none', border: 'none', color: TEXT_SECONDARY, fontSize: 14, padding: '10px 4px', cursor: 'pointer' }}>清除日期</button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" aria-label="前一年" onClick={() => setY(y - 1)} style={arrowBtn}><IconChevronLeft size={20} stroke={1.9} /></button>
            <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_MAIN }}>{y} 年</span>
            <button type="button" aria-label="後一年" onClick={() => setY(y + 1)} style={arrowBtn}><IconChevronRight size={20} stroke={1.9} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(mm => (
              <button type="button" key={mm} onClick={() => { setM(mm); setMode('day') }} style={{ ...gridBtn(mm === m), fontFamily: 'inherit' }}>{mm} 月</button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

// ── 生日（只記月、日，值是 MM-DD）──
export function BirthdayPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const parts = value ? value.split('-') : ['', '']
  const label = value ? `${Number(parts[0])} 月 ${Number(parts[1])} 日` : '選生日'
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={fieldStyle({ width: '100%', padding: '12px 14px' }, !!value)}>
        <span>{label}</span>
        <IconChevronDown size={16} stroke={1.9} color={TEXT_MUTED} />
      </button>
      {open && <BirthdaySheet value={value} onPick={v => { onChange(v); setOpen(false) }} onClose={() => setOpen(false)} />}
    </>
  )
}

function BirthdaySheet({ value, onPick, onClose }) {
  const parts = value ? value.split('-') : ['', '']
  const [mm, setMm] = useState(parts[0] ? Number(parts[0]) : null)
  const dim = mm ? new Date(Date.UTC(2024, mm, 0, 12)).getUTCDate() : 31
  const curD = parts[1] ? Number(parts[1]) : null
  return (
    <Sheet title={mm ? `生日：${mm} 月，選日期` : '生日：選月份'} onClose={onClose}>
      {!mm ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
            <button type="button" key={n} onClick={() => setMm(n)} style={{ ...gridBtn(false), fontFamily: 'inherit' }}>{n} 月</button>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
            {Array.from({ length: dim }, (_, i) => i + 1).map(d => (
              <button type="button" key={d} onClick={() => onPick(`${pad(mm)}-${pad(d)}`)}
                style={{ ...gridBtn(value && Number(parts[0]) === mm && curD === d), padding: '11px 0', fontFamily: 'inherit' }}>{d}</button>
            ))}
          </div>
          <button type="button" onClick={() => setMm(null)}
            style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 14, padding: '14px 4px 0', cursor: 'pointer' }}>重選月份</button>
        </>
      )}
      {value && (
        <button type="button" onClick={() => onPick('')}
          style={{ background: 'none', border: 'none', color: TEXT_SECONDARY, fontSize: 14, padding: '14px 4px 0', cursor: 'pointer', display: 'block' }}>清除生日</button>
      )}
    </Sheet>
  )
}

// ── 選項清單（取代 <select>）──
export function SelectField({ value, onChange, options, style, title = '請選擇' }) {
  const [open, setOpen] = useState(false)
  const cur = options.find(o => o.value === value)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={fieldStyle(style, !!cur)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur ? cur.label : '請選擇'}</span>
        <IconChevronDown size={16} stroke={1.9} color={TEXT_MUTED} />
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            {options.map(o => (
              <button type="button" key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
                style={{ width: '100%', textAlign: 'left', padding: '14px 4px', background: o.value === value ? SUBCARD_BG : 'none', border: 'none',
                  borderBottom: `1px solid ${BORDER}`, fontSize: 15, color: o.value === value ? PRIMARY : TEXT_MAIN, cursor: 'pointer', fontFamily: 'inherit' }}>
                {o.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}
