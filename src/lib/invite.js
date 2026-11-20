// 邀請連結的共用工具：連結、LINE 分享網址、畫 QR Code、做成可以存的圖片（設定 → 邀請朋友一起用 在用）
// 連結只帶一組 6 碼的代碼（?r=），不帶 Email 或任何個人資料
import qrcode from 'qrcode-generator'

export const APP_URL = 'https://unfranchise-app.vercel.app/'
const NAVY = '#1E2A44'
const FONT = '"PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei",sans-serif'

export const inviteLink = code => `${APP_URL}?r=${code}`
export const inviteText = link => `我在用 unfranchise 記每天的行動，你也一起來用：\n${link}`
export const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
// 手機直接開 LINE 選好友；電腦開 LINE 的分享頁
export function lineShareUrl(link, phone = isPhone()) {
  return phone
    ? 'https://line.me/R/share?text=' + encodeURIComponent(inviteText(link))
    : 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(link)
}

export function loadImg(src) {
  return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src })
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

// 畫 QR：三個定位角畫成圓角方塊、其他點畫成小圓角方塊，中間放 App 圖示（用最高容錯，遮住中間也掃得到）
export function drawQR(ctx, text, x, y, size, icon) {
  const qr = qrcode(0, 'H'); qr.addData(text); qr.make()
  const n = qr.getModuleCount(), cell = size / n
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
  const hole = icon ? Math.ceil(n * 0.24) : 0, h0 = Math.floor((n - hole) / 2)
  ctx.fillStyle = NAVY
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c) || inFinder(r, c)) continue
    if (hole && r >= h0 && r < h0 + hole && c >= h0 && c < h0 + hole) continue
    rr(ctx, x + c * cell + cell * 0.06, y + r * cell + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.28); ctx.fill()
  }
  for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const fx = x + fc * cell, fy = y + fr * cell
    ctx.fillStyle = NAVY; rr(ctx, fx, fy, cell * 7, cell * 7, cell * 1.8); ctx.fill()
    ctx.fillStyle = '#fff'; rr(ctx, fx + cell, fy + cell, cell * 5, cell * 5, cell * 1.2); ctx.fill()
    ctx.fillStyle = NAVY; rr(ctx, fx + cell * 2, fy + cell * 2, cell * 3, cell * 3, cell * 0.9); ctx.fill()
  }
  if (icon) {
    const s = hole * cell, ix = x + h0 * cell, iy = y + h0 * cell
    ctx.fillStyle = '#fff'; rr(ctx, ix, iy, s, s, s * 0.24); ctx.fill()
    ctx.save(); rr(ctx, ix + s * 0.08, iy + s * 0.08, s * 0.84, s * 0.84, s * 0.2); ctx.clip()
    ctx.drawImage(icon, ix + s * 0.08, iy + s * 0.08, s * 0.84, s * 0.84); ctx.restore()
  }
  return n
}

// 存成圖片用：1080×1350（手機直式、IG 也剛好），上面是 App 名字，中間 QR，下面是誰邀請
export async function inviteImage(link, name) {
  const W = 1080, H = 1350
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B2A6B'); g.addColorStop(1, '#061638')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(80,140,255,0.10)'; ctx.beginPath(); ctx.moveTo(0, H * 0.82)
  ctx.bezierCurveTo(W * 0.3, H * 0.74, W * 0.7, H * 0.9, W, H * 0.8); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill()
  const icon = await loadImg('/pwa-512x512.png')
  if (icon) ctx.drawImage(icon, W / 2 - 80, 90, 160, 160)
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'
  ctx.font = `700 76px ${FONT}`; ctx.fillText('unfranchise', W / 2, 340)
  ctx.fillStyle = '#9CC2FF'; ctx.font = `600 40px ${FONT}`; ctx.fillText('超連鎖的每日行動夥伴', W / 2, 402)
  const card = 600, cx = (W - card) / 2, cy = 470
  ctx.fillStyle = '#fff'; rr(ctx, cx, cy, card, card, 44); ctx.fill()
  drawQR(ctx, link, cx + 52, cy + 52, card - 104, icon)
  ctx.fillStyle = '#fff'; ctx.font = `600 40px ${FONT}`
  ctx.fillText(name ? `${name}邀請你一起用` : '邀請你一起用', W / 2, 1150)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = `400 32px ${FONT}`
  ctx.fillText('用手機相機掃描，就能註冊', W / 2, 1210)
  return new Promise(res => cv.toBlob(b => res(b), 'image/png'))
}

