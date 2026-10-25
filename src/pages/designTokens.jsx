// 顏色都是 CSS 變數（真正的數值在 theme.jsx，白天／夜晚各一套）。
// 設計系統共用 tokens：顏色 + 圓角 + 共用小工具函式
// 原本 Contacts/Customers/Dashboard/ContactPanel/ContactEdit/ContactNew 六個檔案
// 各自重複宣告同一批顏色常數，蛋型顏色/頭像顏色也各自重複定義了 3-4 次。
// 統一從這裡 import，之後要調色只改這一個檔案。

// ── 顏色 ─────────────────────────────────────
export const PRIMARY = 'var(--primary)'
export const PRIMARY_SOFT = 'var(--primary-soft)'
export const TEXT_MAIN = 'var(--text)'
export const TEXT_MUTED = 'var(--muted)'
export const TEXT_SECONDARY = 'var(--text2)'
export const ACCENT_GREEN = '#3ECF8E'
export const ACCENT_GREEN_SOFT = 'var(--green-soft)'
export const ACCENT_GREEN_TEXT = 'var(--green-text)'
export const ACCENT_YELLOW = '#FFD166'
export const ACCENT_YELLOW_SOFT = 'var(--yellow-soft)'
export const ACCENT_YELLOW_TEXT = 'var(--yellow-text)'
export const ACCENT_PINK = '#F45DA8'
export const ACCENT_PINK_SOFT = 'var(--pink-soft)'
export const ACCENT_PINK_TEXT = 'var(--pink-text)'
export const DANGER = '#E0454A'
export const DANGER_SOFT = 'var(--danger-soft)'
export const BORDER = 'var(--border)'
export const SUBCARD_BG = 'var(--sub)'
export const CARD_BG = 'var(--card)'
// 頁面底色：淡灰藍，白色卡片放上去才有層次（首頁、列表頁、詳情頁統一）
export const PAGE_BG = 'var(--page)'
// 橘色：「1 個會議」專用，其他地方不用
export const ORANGE = '#F97316'
export const ORANGE_SOFT = 'var(--orange-soft)'
export const ORANGE_TEXT = 'var(--orange-text)'

// ── 圓角 ─────────────────────────────────────
// 盤點時發現的實際用法：
//   xs   (8)   小徽章／小圖示按鈕（原本部分頁面誤用 6，這裡統一成 8）
//   sm   (10)  次要輸入框／緊湊面板按鈕（ContactPanel 原本 9/10 混用，統一成 10）
//   md   (12)  標準輸入框／按鈕（全站最常用）
//   lg   (14)  卡片／主要按鈕
//   xl   (18)  大卡片、彈窗
//   pill (999) 膠囊形（原本 Dashboard.jsx 同時有 99 跟 999 兩種寫法，是筆誤不是刻意設計，統一成 999）
//   circle ('50%') 頭像圓形
export const RADIUS = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  card: 16, // 卡片統一圓角
  pill: 999,
  circle: '50%',
}

// ── 蛋型顏色（原本在 Dashboard.jsx / ContactPanel.jsx / Contacts.jsx / ContactNew.jsx 四處各自重複定義）──
export function getEggColor(t) {
  return t === '茶葉蛋' ? '#F97316' : t === '荷包蛋' ? '#3B82F6' : t === '生雞蛋' ? '#22C55E' : '#9CA3AF'
}
export function getEggBg(t) {
  return t === '茶葉蛋' ? 'var(--orange-soft)' : t === '荷包蛋' ? 'var(--primary-soft)' : t === '生雞蛋' ? 'var(--green-soft)' : 'var(--sub)'
}

// ── 頭像底色（原本在 Customers.jsx / Dashboard.jsx / ContactPanel.jsx / Contacts.jsx 四處各自重複定義）──
// 統一補上防呆：name 是 null/undefined 時不會報錯（原本只有 Dashboard.jsx 有這個防呆，其他三處沒有）
export function avatarBg(name) {
  const colors = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EC4899', '#14B8A6']
  const safeName = name || ''
  let n = 0
  for (let i = 0; i < safeName.length; i++) n += safeName.charCodeAt(i)
  return colors[n % colors.length]
}
