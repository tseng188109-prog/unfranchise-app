import {
  IconTarget, IconSpeakerphone, IconMessageCircle, IconBook,
  IconHeadphones, IconCamera, IconUsers, IconTrendingUp,
} from '@tabler/icons-react'

// ── 全站任務/行動定義的唯一事實來源 ──────────────────────────
// 之前 DAILY_TASKS 在 Dashboard.jsx / Daily.jsx / Partners.jsx / Team.jsx 各寫一份，
// 結果 Partners.jsx 的標籤（"後台公告"、"回應社群"）悄悄跟別處（"後台公告/管理報告"、
// "回應臉書IDEA/LINE"）不一致——這就是分散定義會出的問題。
// 以後任何任務項目要新增/改名/調整，只改這個檔案，全站自動同步，不會再各自漂移。

// 每日任務。Dashboard.jsx／Daily.jsx 用到完整欄位（Icon、跳轉動作）；
// Partners.jsx／Team.jsx 只用 key/label 做顯示對照，忽略其餘欄位即可。
export const DAILY_TASKS = [
  { key: 'goal_declaration', label: '目標宣言', Icon: IconTarget },
  { key: 'backend_announcement', label: '後台公告/管理報告', Icon: IconSpeakerphone, url: 'https://tw.unfranchise.com' },
  { key: 'respond_social', label: '回應臉書IDEA/LINE', Icon: IconMessageCircle, social: true },
  { key: 'daily_practice', label: '每日練習', Icon: IconBook, internalPath: '/daily-practice' },
  { key: 'listen_recording', label: '聽錄音', Icon: IconHeadphones, internalPath: '/recording' },
  { key: 'ig_story', label: 'IG 限動', Icon: IconCamera, url: 'https://www.instagram.com' },
  { key: 'daily_3_contacts', label: '每日3互動', Icon: IconUsers, special: true, toContacts: true },
]

// 新手起步任務 —— 一次性成就，不是每日重置。
// 2026/07 修過「完成一次打卡」被誤寫成查「今天」導致卡片卡住的 bug，別再拆開維護。
export const STARTER_TASKS = [
  { id: 'has_contact',     label: '新增第一筆互動名單',  Icon: IconUsers },
  { id: 'has_checkin',     label: '完成一次打卡',        Icon: IconTarget },
  { id: 'week3_checkin',   label: '一週內累積打卡 3 天', Icon: IconTrendingUp },
  { id: 'has_log',         label: '新增第一筆互動紀錄',  Icon: IconMessageCircle },
  { id: 'has_declaration', label: '設定你的目標宣言',    Icon: IconTarget },
]

// 每週固定任務（單純打勾，不需要選對象/日期）
export const WEEKLY_TASKS = [
  { key: 'contact_referrer', label: '與推薦人聯絡' },
  { key: 'coring', label: 'Coring 培訓' },
]

// 每週行動計數器（需要選對象/產品，可記錄日期或預排）
export const WEEKLY_COUNTERS = [
  { key: 'bv_share',      label: 'BV 分享',     mode: 'product' },
  { key: 'ibv_share',     label: 'IBV 分享',    mode: 'product' },
  { key: 'meetup',        label: '見面',         mode: 'contact' },
  { key: 'show_business', label: '展示生意',     mode: 'contact' },
  { key: 'sell_ticket',   label: '賣票',         mode: 'contact' },
  { key: 'stranger',      label: '與陌生人互動', mode: 'stranger' },
]

// 每月目標項目
export const MONTH_ITEMS = [
  { key: 'new_product', label: '認識新產品', placeholder: '產品名稱' },
  { key: 'gmtss',       label: 'GMTSS 課程', placeholder: '課程名稱' },
]

// 每週行動計數器的顏色（月曆/標籤用）
export const COUNTER_COLORS = {
  bv_share:      '#1668E3', ibv_share: '#2C9C6A',
  meetup:        '#D23E8C', show_business: '#9A6A16',
  sell_ticket:   '#7C5CD6', stranger: '#17A2A2',
}
