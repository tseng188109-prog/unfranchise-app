// 全站共用的小元件，首頁、列表頁、詳情頁都用這裡的長相，避免各頁各寫一套。
// 規則：
//   1. 區塊標題放在卡片外面（SectionHeader），卡片裡面不再套卡片
//   2. 左邊的小方塊（Tile）用顏色表達意義：藍＝互動、橘＝會議、綠＝新名單／業績、粉＝顧客關心、黃＝提醒／贈品
//   3. 一張卡最多一顆實心按鈕，其餘用淡色膠囊（SoftBtn）或文字連結
import {
  TEXT_MAIN, TEXT_SECONDARY, BORDER, RADIUS,
} from './designTokens'

export const cardStyle = {
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS.card,
}

export function SectionHeader({ title, hint, hintColor, onHint }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, margin: '16px 4px 8px' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_MAIN }}>{title}</span>
      {hint && (
        <span onClick={onHint}
          style={{ fontSize: 12, color: hintColor || TEXT_SECONDARY, cursor: onHint ? 'pointer' : 'default', textAlign: 'right' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

// 左邊的小方塊：數字或圖示
export function Tile({ children, bg, color, size = 38 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: RADIUS.md, background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
      {children}
    </div>
  )
}

// 淡色小膠囊按鈕
export function SoftBtn({ children, onClick, bg, color, solid = false, style }) {
  return (
    <button onClick={onClick}
      style={{ border: 'none', borderRadius: RADIUS.sm, padding: '8px 12px', fontSize: 12, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        background: solid ? color : bg, color: solid ? '#fff' : color, ...style }}>
      {children}
    </button>
  )
}

export function Tag({ children, bg, color }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: RADIUS.pill,
      background: bg, color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

