// errorReport.js — App 畫面出錯時自動記一筆給系統管理看（哪一頁、什麼錯誤、哪種裝置）
// 只記錯誤訊息，不記畫面上的名單、顧客。網路不穩、App 剛更新造成的不算。
// 同一個錯誤這次打開 App 只送一次；資料庫那邊再擋「同一個人同一天只算一次」。
import { supabase } from '../supabase'
import { deviceOf, pageName } from '../lib/device.js'

const IGNORE = /Failed to fetch|NetworkError|Load failed|network error|ResizeObserver loop|Importing a module script failed|dynamically imported module|ChunkLoadError|AbortError|operation was aborted|The user aborted|cancell?ed|Script error\.?$/i
const sent = new Set()

export function shouldReport(message, filename) {
  const msg = String(message || '').trim()
  if (!msg || IGNORE.test(msg)) return false
  // 瀏覽器外掛的錯誤（不是我們的檔案）不算
  if (filename && typeof location !== 'undefined' && /^(chrome|moz|safari)(-web)?-extension:/i.test(filename)) return false
  return true
}

export async function reportError(err, filename) {
  try {
    const message = String((err && (err.message || err.reason)) || err || '').slice(0, 300)
    if (!shouldReport(message, filename)) return
    const page = pageName(location.pathname)
    const key = page + '|' + message
    if (sent.has(key)) return
    sent.add(key)
    await supabase.rpc('report_app_error', { p_page: page, p_message: message, p_device: deviceOf(navigator.userAgent) })
  } catch { /* 記錯誤失敗不要再出錯 */ }
}

if (typeof window !== 'undefined' && !window.__ufaErrorReport) {
  window.__ufaErrorReport = true
  window.addEventListener('error', e => reportError(e.error || e.message, e.filename))
  window.addEventListener('unhandledrejection', e => reportError(e.reason))
}
