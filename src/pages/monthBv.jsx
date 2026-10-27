// 本月顧客 BV：官方「基本 10 顧客」其實是 500 BV 的概念（10 人 × 50 BV），
// 所以這裡只看總量，不限人數、不要求每個人買滿 50；一位顧客帶家人一起買也一樣算。
// 只讀 transactions 和 customers，不會改任何顧客或訂單資料。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { cardStyle } from './ui'
import {
  PRIMARY, PRIMARY_SOFT, ORANGE, ORANGE_TEXT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS,
} from './designTokens'

export const DEFAULT_BV_TARGET = 500

export function resolveBvTarget(tagSettings) {
  const n = Number(tagSettings && tagSettings.bv_target)
  return n > 0 ? n : DEFAULT_BV_TARGET
}

function taipeiToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }

function monthRange() {
  const t = taipeiToday()
  const [y, m] = t.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}`, month: m }
}

export default function MonthBvCard({ userId, target, onEditTarget }) {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)
  const range = monthRange()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: tx } = await supabase.from('transactions')
          .select('customer_id,points,type,is_gift')
          .eq('user_id', userId).not('customer_id', 'is', null)
          .gte('date', range.start).lte('date', range.end).limit(3000)
        const sums = {}
        ;(tx || []).forEach(t => {
          if (t.is_gift || t.type === 'IBV') return
          sums[t.customer_id] = (sums[t.customer_id] || 0) + (Number(t.points) || 0)
        })
        const ids = Object.keys(sums).filter(id => sums[id] > 0)
        let names = {}
        if (ids.length) {
          const { data: cs } = await supabase.from('customers').select('id,name').in('id', ids)
          ;(cs || []).forEach(c => { names[c.id] = c.name })
        }
        const list = ids.map(id => ({ id, name: names[id] || '（已封存的顧客）', bv: sums[id] }))
          .sort((a, b) => b.bv - a.bv)
        if (alive) setRows(list)
      } catch { if (alive) setRows([]) }
    })()
    return () => { alive = false }
  }, [userId, range.start])

  const total = (rows || []).reduce((s, r) => s + r.bv, 0)
  const pct = target > 0 ? Math.min(100, Math.round(total / target * 100)) : 0
  const left = Math.max(0, target - total)
  const reached = rows !== null && total >= target

  return (
    <div style={{ ...cardStyle, padding: '18px 18px 16px', color: TEXT_MAIN }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: ORANGE_TEXT }}>{range.month} 月顧客 BV</span>
        <span style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>
          {rows === null ? '–' : Math.round(total)}
          <button onClick={onEditTarget}
            style={{ background: 'none', border: 'none', padding: '0 0 0 4px', cursor: 'pointer', color: TEXT_MUTED, fontSize: 12, fontWeight: 400 }}>
            / {target} ✎
          </button>
        </span>
      </div>
      <div style={{ background: 'var(--sub2)', borderRadius: RADIUS.pill, height: 6, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: RADIUS.pill, background: reached ? 'var(--green-text)' : ORANGE, transition: 'width 0.6s' }} />
      </div>
      <div style={{ fontSize: 12, color: reached ? 'var(--green-text)' : TEXT_SECONDARY, lineHeight: 1.6, marginTop: 8, fontWeight: reached ? 600 : 400 }}>
        {rows === null ? '計算中…'
          : reached ? '本月達標了'
          : total === 0 ? `這個月還沒有顧客訂單，目標 ${target} BV，約等於 ${Math.ceil(target / 50)} 位顧客的量。`
          : `還差 ${Math.round(left)} BV，約等於 ${Math.max(1, Math.ceil(left / 50))} 位顧客的量。一位帶家人一起買也算。`}
      </div>
      {rows && rows.length > 0 && (
        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 12 }}>
          <button onClick={() => setOpen(o => !o)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '10px 0 0', cursor: 'pointer', fontSize: 13 }}>
            <span style={{ color: TEXT_SECONDARY }}>看是誰買的（{rows.length} 位）</span>
            <span style={{ color: PRIMARY }}>{open ? '收起 ›' : '展開 ›'}</span>
          </button>
          {open && rows.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, borderBottom: `1px solid ${BORDER}` }}>
              <span>{r.name}</span>
              <span style={{ color: TEXT_SECONDARY }}>{Math.round(r.bv)} BV</span>
            </div>
          ))}
          {open && <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>贈品不算。</div>}
        </div>
      )}
    </div>
  )
}

// 改目標的小視窗
export function BvTargetSheet({ current, onSave, onClose }) {
  const [val, setVal] = useState(String(current))
  const n = Number(val)
  const ok = n > 0 && n <= 100000
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', width: '100%', maxWidth: 480, borderRadius: `${RADIUS.xl}px ${RADIUS.xl}px 0 0`, padding: '18px 18px 24px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>每月顧客 BV 目標</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[200, 500, 1000].map(v => (
            <button key={v} onClick={() => setVal(String(v))}
              style={{ flex: 1, padding: '10px 0', borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                border: Number(val) === v ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                background: Number(val) === v ? PRIMARY_SOFT : 'transparent', color: Number(val) === v ? PRIMARY : TEXT_MAIN }}>
              {v}
            </button>
          ))}
        </div>
        <input type="number" inputMode="numeric" value={val} onChange={e => setVal(e.target.value)} placeholder="自己填"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '12px 14px', borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, fontSize: 16, outline: 'none', background: 'transparent', color: TEXT_MAIN }} />
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '10px 0 0', lineHeight: 1.6 }}>
          500 BV 是官方「基本 10 顧客」的量（10 人 × 50 BV）。剛開始可以先設小一點。
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px 0', borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_MAIN, fontSize: 14, cursor: 'pointer' }}>取消</button>
          <button onClick={() => ok && onSave(Math.round(n))} disabled={!ok}
            style={{ flex: 1, padding: '12px 0', borderRadius: RADIUS.md, border: 'none', background: PRIMARY, color: '#fff', fontSize: 14, fontWeight: 600, cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.5 }}>存起來</button>
        </div>
      </div>
    </div>
  )
}
