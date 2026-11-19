// device.js — 從瀏覽器資訊看出是哪種裝置（App 和後台共用）
export function deviceOf(ua) {
  const s = String(ua || '')
  if (/iPad/i.test(s)) return 'iPad'
  if (/iPhone|iPod/i.test(s)) return 'iPhone'
  if (/Android/i.test(s)) return 'Android'
  if (/Macintosh|Mac OS X/i.test(s)) return 'Mac 電腦'
  if (/Windows/i.test(s)) return 'Windows 電腦'
  if (/Linux|CrOS/i.test(s)) return '電腦'
  return '其他裝置'
}

// 起步卡在哪：只看三個基本步驟（登入過、加名單、記過互動），都做到了就回 null
export function stuckOf(o) {
  if (!o) return null
  if (!o.signed_in) return '註冊完還沒登入過'
  if (!o.has_contacts) return '登入過，還沒加名單'
  if (!o.has_logs) return '加了名單，還沒記過互動'
  return null
}

// 網址 → 頁面名字（出錯紀錄用）
const PAGES = [
  [/^\/$/, '首頁'],
  [/^\/contacts\/new$/, '新增名單'],
  [/^\/contacts\/[^/]+\/edit$/, '互動名單 → 編輯資料'],
  [/^\/contacts\/[^/]+$/, '互動名單 → 一個人的頁面'],
  [/^\/contacts/, '互動名單'],
  [/^\/customers\/new$/, '新增顧客'],
  [/^\/customers\/[^/]+\/edit$/, '顧客 → 編輯資料'],
  [/^\/customers\/[^/]+$/, '顧客 → 一位顧客'],
  [/^\/customers/, '顧客'],
  [/^\/transactions\/new$/, '業績 → 新增'],
  [/^\/transactions/, '業績'],
  [/^\/report/, '業績報告'],
  [/^\/daily-practice/, '每日練習'],
  [/^\/daily/, '每日行動'],
  [/^\/samples/, '試用品'],
  [/^\/partners/, '夥伴'],
  [/^\/team/, '戰隊'],
  [/^\/activities/, '活動'],
  [/^\/week/, '一週總結'],
  [/^\/admin/, '系統管理'],
  [/^\/settings/, '設定'],
  [/^\/help/, '使用說明'],
  [/^\/recording/, '錄音'],
]
export function pageName(path) {
  const p = String(path || '/').split('?')[0]
  const hit = PAGES.find(([re]) => re.test(p))
  return hit ? hit[1] : p.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
}
