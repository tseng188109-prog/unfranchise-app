// social.js — 把「社群平台＋帳號」變成可以點的連結（純計算，方便測試）
// IG：@abc、abc、整串網址都能打開；FB 只有貼網址才能打開，其他時候點了是複製；LINE 只能複製；其他只顯示文字
export function socialOf(platform, account) {
  const raw = String(account || '').trim()
  if (!raw) return null // 只選了平台、沒填帳號：不顯示（免得只出現一個「IG」）
  const p = platform || ''
  const isUrl = /^(https?:\/\/)?([\w-]+\.)*(instagram\.com|instagr\.am|facebook\.com|fb\.com|fb\.me|m\.facebook\.com)\//i.test(raw)
  const withProto = u => (/^https?:\/\//i.test(u) ? u : 'https://' + u)
  if (p === 'IG' || /instagram\.com|instagr\.am/i.test(raw)) {
    let handle = raw
    if (isUrl) {
      const m = withProto(raw).match(/(?:instagram\.com|instagr\.am)\/([^/?#]+)/i)
      handle = m ? m[1] : raw
    }
    handle = handle.replace(/^@+/, '').replace(/\s+/g, '')
    if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return { text: `IG ${raw}`, url: null, copy: raw }
    return { text: `IG @${handle}`, url: `https://instagram.com/${handle}`, copy: null }
  }
  if (p === 'FB' || /facebook\.com|fb\.com|fb\.me/i.test(raw)) {
    if (isUrl) return { text: 'FB 個人頁', url: withProto(raw), copy: null }
    return { text: `FB ${raw}`, url: null, copy: raw }
  }
  if (p === 'LINE') return { text: `LINE ${raw}`, url: null, copy: raw }
  return { text: p && p !== '其他' ? `${p} ${raw}` : raw, url: null, copy: null }
}
