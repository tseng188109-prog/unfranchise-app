// 試用品追蹤共用工具：Samples.jsx 跟 ContactPanel.jsx 都從這裡 import
// 避免「三步驟是哪三步、結果選項有哪些、對應什麼顏色」兩邊定義不一致
import { ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, TEXT_SECONDARY, BORDER } from './designTokens'

export const SAMPLE_STEPS = [
  { field:'followup_1_done', label:'確認使用' },
  { field:'followup_2_done', label:'傳送資料' },
  { field:'followup_3_done', label:'詢問感受' },
]

export const SAMPLE_RESULTS = ['成交','考慮中','轉介/其他需求']

// 結果標籤色：只有「成交」用綠色標示正向結果，「考慮中」「轉介/其他需求」都用灰階
export function sampleResultBadgeColor(result) {
  if (result === '成交') return { bg: ACCENT_GREEN_SOFT, text: ACCENT_GREEN_TEXT }
  return { bg: BORDER, text: TEXT_SECONDARY }
}

// 下次追蹤日期的顯示文字（今天追蹤／逾期N天／N天後）
export function formatSampleDue(dateStr, todayStr) {
  if (!dateStr) return ''
  const diff = Math.floor((new Date(todayStr) - new Date(dateStr)) / 86400000)
  if (diff === 0) return '今天追蹤'
  if (diff > 0) return `逾期${diff}天`
  return `${Math.abs(diff)}天後`
}
