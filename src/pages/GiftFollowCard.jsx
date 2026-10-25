import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { IconGift } from '@tabler/icons-react'
import { toDateStr } from './teamStats'
import {
  TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, SUBCARD_BG,
  ACCENT_YELLOW_TEXT, ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, ACCENT_PINK_SOFT, ACCENT_PINK_TEXT,
} from './designTokens'
import { fmt, shortDate } from './orderUtils'

const DAY = 86400000

// 業績紀錄頁最上方：這個月送出的贈品，以及每位收到的人現在的狀況
// 只列事實，不算百分比、不設期限：「買了」「還沒聊過用後感」「聊過了還沒買」
export default function GiftFollowCard({ userId, year, month }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const end = toDateStr(new Date(year, month, 0))
      const { data: gifts } = await supabase.from('transactions')
        .select('id,customer_id,date,product_name,cost,is_gift,line_kind,customers(name)')
        .eq('user_id', userId).eq('is_gift', true)
        .gte('date', start).lte('date', end).not('customer_id', 'is', null)
        .order('date', { ascending: false })
      const giftRows = (gifts || []).filter(g => !g.line_kind)
      if (giftRows.length === 0) { if (!cancelled) setRows([]); return }

      const custIds = [...new Set(giftRows.map(g => g.customer_id))]
      const { data: paid } = await supabase.from('transactions')
        .select('customer_id,date,is_gift,line_kind')
        .eq('user_id', userId).in('customer_id', custIds).eq('is_gift', false).gte('date', start)
        .order('date', { ascending: true })
      const { data: custs } = await supabase.from('customers')
        .select('id,contact_id,last_cared_at').in('id', custIds)
      const contactIds = (custs || []).map(c => c.contact_id).filter(Boolean)
      let contactMap = {}
      if (contactIds.length) {
        const { data: cts } = await supabase.from('contacts')
          .select('id,last_interacted_at,last_contact_date').in('id', contactIds)
        ;(cts || []).forEach(c => { contactMap[c.id] = c })
      }
      const custMap = {}
      ;(custs || []).forEach(c => { custMap[c.id] = c })

      // 同一位同一天送的合成一筆
      const grouped = {}
      giftRows.forEach(g => {
        const k = g.customer_id + '|' + g.date
        if (!grouped[k]) grouped[k] = { customer_id: g.customer_id, name: g.customers?.name || '未知顧客', date: g.date, items: [], cost: 0 }
        grouped[k].items.push(g.product_name)
        grouped[k].cost += Number(g.cost) || 0
      })

      const nowMs = Date.now()
      const list = Object.values(grouped).map(g => {
        const boughtAfter = (paid || []).find(p => !p.line_kind && p.customer_id === g.customer_id && p.date > g.date)
        const c = custMap[g.customer_id]
        const ct = c?.contact_id ? contactMap[c.contact_id] : null
        const careMs = Math.max(
          c?.last_cared_at ? new Date(c.last_cared_at).getTime() : 0,
          ct?.last_interacted_at ? new Date(ct.last_interacted_at).getTime() : 0,
          ct?.last_contact_date ? new Date(ct.last_contact_date + 'T00:00:00+08:00').getTime() : 0,
        )
        const giftMs = new Date(g.date + 'T00:00:00+08:00').getTime()
        const days = Math.max(0, Math.floor((nowMs - giftMs) / DAY))
        let status, tone
        if (boughtAfter) { status = `後來 ${shortDate(boughtAfter.date)} 買了`; tone = 'green' }
        else if (careMs >= giftMs) { status = `送出 ${days} 天，聊過了，還沒買`; tone = 'gray' }
        else { status = `送出 ${days} 天，還沒聊過用後感`; tone = 'pink' }
        return { ...g, status, tone }
      })
      if (!cancelled) setRows(list)
    }
    load()
    return () => { cancelled = true }
  }, [userId, year, month])

  if (!rows || rows.length === 0) return null
  const totalCount = rows.reduce((s, r) => s + r.items.length, 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const tones = {
    green: { bg: ACCENT_GREEN_SOFT, fg: ACCENT_GREEN_TEXT },
    pink: { bg: ACCENT_PINK_SOFT, fg: ACCENT_PINK_TEXT },
    gray: { bg: SUBCARD_BG, fg: TEXT_SECONDARY },
  }

  return (
    <div className="dash-container" style={{ padding: '12px 16px 0' }}>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: TEXT_MAIN, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconGift size={16} stroke={1.9} color={ACCENT_YELLOW_TEXT} /> {month} 月送出的贈品
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: TEXT_SECONDARY }}>{totalCount} 份，成本 {fmt(totalCost)}</p>
        {rows.map(r => (
          <div key={r.customer_id + r.date} style={{ padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN, minWidth: 0, wordBreak: 'break-word' }}>{r.name}</span>
              <span style={{ fontSize: 12, color: TEXT_MUTED, flexShrink: 0 }}>{r.items.join('、')}　{shortDate(r.date)}</span>
            </div>
            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, padding: '2px 8px', borderRadius: 99, background: tones[r.tone].bg, color: tones[r.tone].fg }}>
              {r.status}
            </span>
          </div>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 12, color: TEXT_MUTED }}>只列事實，不算百分比，也不設期限</p>
      </div>
    </div>
  )
}
