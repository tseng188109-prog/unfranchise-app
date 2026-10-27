import { useState } from 'react'
import { IconPencil, IconTrash, IconCopy, IconGift } from '@tabler/icons-react'
import {
  PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT, ACCENT_GREEN_TEXT, ACCENT_PINK_TEXT,
  DANGER, BORDER, PRIMARY_SOFT, RADIUS } from './designTokens'
import { fmt, shortDate, computeOrder, buildCopyText, copyToClipboard, qtyOf, qtyLabel } from './orderUtils'

// 顧客頁「消費紀錄」裡，一張訂單合在一起的樣子
// group：orderUtils.groupPurchases 整理出來的訂單（有 order 與 lines、adjRows）
export default function OrderCard({ group, customerName, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false)
  const rows = [...group.lines, ...group.adjRows]
  const bv = group.lines.filter(t => t.type !== 'IBV').reduce((s, t) => s + Number(t.points || 0), 0)
  const ibv = group.lines.filter(t => t.type === 'IBV').reduce((s, t) => s + Number(t.points || 0), 0)
  const profit = rows.reduce((s, t) => s + ((Number(t.amount) || 0) - (Number(t.cost) || 0)), 0)
  const unpriced = group.lines.filter(t => !t.is_gift && !(Number(t.amount) > 0)).length

  async function copy() {
    const lines = group.lines.map(t => ({
      product_name: t.product_name || '', quantity: qtyOf(t), is_gift: !!t.is_gift, amount: t.amount, cost: t.cost,
      points: t.points, type: t.type,
    }))
    const calc = computeOrder(lines, group.order?.adjustments || [])
    const ok = await copyToClipboard(buildCopyText(customerName, lines, calc))
    setCopied(ok)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, padding: 12, marginBottom: 10, background: 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight:600, color: TEXT_MAIN }}>{shortDate(group.date)} 訂單</span>
        <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
          BV {fmt(bv)}{ibv > 0 ? `　IBV ${fmt(ibv)}` : ''}
        </span>
      </div>

      <div style={{ marginTop: 8 }}>
        {group.lines.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 13 }}>
            <span style={{ minWidth: 0, color: TEXT_MAIN, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {t.product_name}{qtyLabel(t)}
              {t.is_gift && (
                <span style={{ fontSize:11, padding: '1px 6px', borderRadius: RADIUS.pill, background: ACCENT_YELLOW_SOFT, color: ACCENT_YELLOW_TEXT, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <IconGift size={10} stroke={1.9} /> 贈品
                </span>
              )}
            </span>
            <span style={{ flexShrink: 0, color: TEXT_SECONDARY, textAlign: 'right' }}>
              成本 {t.cost != null ? fmt(t.cost) : <span style={{ color: TEXT_MUTED }}>未填</span>}
              {!t.is_gift && <> ／ 賣 {Number(t.amount) > 0 ? fmt(t.amount) : <span style={{ color: TEXT_MUTED }}>未填</span>}</>}
            </span>
          </div>
        ))}
        {group.adjRows.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 13, color: t.line_kind === 'discount' ? ACCENT_PINK_TEXT : ACCENT_YELLOW_TEXT }}>
            <span>{t.product_name}</span>
            <span>{t.line_kind === 'discount' ? `-${fmt(Math.abs(Number(t.amount)))}` : `成本 ${fmt(t.cost)}`}</span>
          </div>
        ))}
      </div>

      {group.order?.adjustments?.some(a => a.kind === 'shipping' && a.payer === 'customer') && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SECONDARY }}>運費由客人出（不影響獲利）</p>
      )}
      {group.order?.note && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: TEXT_SECONDARY, background: PRIMARY_SOFT, borderRadius: RADIUS.xs, padding: '6px 8px', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{group.order.note}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight:600, color: profit >= 0 ? ACCENT_GREEN_TEXT : DANGER }}>
          獲利 NT${fmt(profit)}
          {unpriced > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: TEXT_MUTED }}>　{unpriced} 項賣價未填</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={copy}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: 12, fontWeight:600, display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
            <IconCopy size={13} stroke={1.9} /> {copied ? '已複製' : '複製給顧客'}
          </button>
          <button onClick={() => onEdit(group.orderId)} aria-label="編輯訂單"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, display: 'flex', padding: 0 }}>
            <IconPencil size={14} stroke={1.9} />
          </button>
          <button onClick={() => onDelete(group.orderId)} aria-label="刪除訂單"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: DANGER, display: 'flex', padding: 0 }}>
            <IconTrash size={14} stroke={1.9} />
          </button>
        </div>
      </div>
    </div>
  )
}
