// shareImage.js — 把分享圖卡畫成 PNG（在手機或電腦上畫，不上傳、不存到雲端）
// 一律用淺色，大家貼到群組看起來都一樣
const C = {
  page: '#F7F5F1', card: '#FFFFFF', sub: '#FAF8F4', border: '#ECE8E1', text: '#1F2430', text2: '#6D6F78', muted: '#A5A29A',
  green: '#2F7A52', greenSoft: '#DFEFE5', greenBorder: '#BFDCCB', rest: '#ECE8E1',
  hlBg: '#FFF5E6', hlText: '#8A5A12', star: '#C9822B', sayBg: '#E3EAF6', sayText: '#1E3F99',
}
export const TILE_COLORS = { met: '#2F7A52', bizPlanned: '#2457D6', bizMet: '#1E3F99', survey: '#7A5AC8', newCust: '#0F766E', bv: '#C9822B', ibv: '#B4457E' }
const FONT = '-apple-system, "PingFang TC", "Noto Sans TC", "Noto Sans CJK TC", "Microsoft JhengHei", system-ui, sans-serif'
const W = 750, PAD = 34, S = 2
const WD = ['日', '一', '二', '三', '四', '五', '六']

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
function font(ctx, size, weight = 400) { ctx.font = `${weight} ${size}px ${FONT}` }
// 中文一個字一個字換行
function wrap(ctx, text, maxW) {
  const lines = []
  String(text || '').split('\n').forEach(par => {
    let line = ''
    for (const ch of par) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch } else line += ch
    }
    lines.push(line)
  })
  return lines
}
function loadImg(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src })
}

// data：{ title, rangeText, actions:[{v,label}], tiles:[{key,label,v,unit}], emptyText, dots:[{d,s}], highlight, sayName, say }
function paint(ctx, data, icon, draw) {
  const inner = W - PAD * 2 - 24
  let y = 20
  const x0 = 20, cw = W - 40
  const top = y
  y += PAD - 6
  const X = x0 + 24
  if (draw) {
    if (icon) { ctx.save(); rr(ctx, X, y, 60, 60, 15); ctx.clip(); ctx.drawImage(icon, X, y, 60, 60); ctx.restore() }
    font(ctx, 32, 700); ctx.fillStyle = C.text; ctx.fillText(data.title, X + 76, y + 28)
    font(ctx, 20); ctx.fillStyle = C.text2; ctx.fillText(data.rangeText, X + 76, y + 56)
  }
  y += 82
  const label = t => { if (draw) { font(ctx, 18, 700); ctx.fillStyle = C.muted; ctx.fillText(t, X, y + 16) } y += 28 }

  label('行動')
  if (draw) {
    ctx.fillStyle = C.sub; rr(ctx, X, y, inner, 92, 16); ctx.fill()
    const cw3 = inner / data.actions.length
    data.actions.forEach((a, i) => {
      const cx = X + cw3 * i + cw3 / 2
      ctx.textAlign = 'center'
      font(ctx, 32, 700); ctx.fillStyle = C.text; ctx.fillText(String(a.v), cx, y + 44)
      font(ctx, 18); ctx.fillStyle = C.text2; ctx.fillText(a.label, cx, y + 74)
      ctx.textAlign = 'left'
    })
  }
  y += 92 + 18

  label('成果')
  if (data.tiles.length) {
    const cols = 3, gap = 12, tw = (inner - gap * (cols - 1)) / cols, th = 96
    data.tiles.forEach((t, i) => {
      const tx = X + (i % cols) * (tw + gap), ty = y + Math.floor(i / cols) * (th + gap)
      if (!draw) return
      const col = TILE_COLORS[t.key] || C.text
      ctx.fillStyle = '#fff'; rr(ctx, tx, ty, tw, th, 14); ctx.fill()
      ctx.save(); rr(ctx, tx, ty, tw, th, 14); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(tx, ty, tw, 32); ctx.restore()
      ctx.strokeStyle = col; ctx.lineWidth = 3; rr(ctx, tx + 1.5, ty + 1.5, tw - 3, th - 3, 13); ctx.stroke()
      ctx.textAlign = 'center'
      font(ctx, 17, 700); ctx.fillStyle = '#fff'; ctx.fillText(t.label, tx + tw / 2, ty + 23)
      font(ctx, 34, 700); const vs = String(t.v); const vw = ctx.measureText(vs).width
      font(ctx, 17, 600); const uw = t.unit ? ctx.measureText(t.unit).width + 3 : 0
      const sx = tx + tw / 2 - (vw + uw) / 2
      ctx.textAlign = 'left'
      font(ctx, 34, 700); ctx.fillStyle = col; ctx.fillText(vs, sx, ty + 76)
      if (t.unit) { font(ctx, 17, 600); ctx.fillText(t.unit, sx + vw + 3, ty + 76) }
    })
    y += Math.ceil(data.tiles.length / cols) * (th + gap) - gap
  } else {
    if (draw) {
      ctx.fillStyle = C.sub; rr(ctx, X, y, inner, 64, 14); ctx.fill()
      font(ctx, 21); ctx.fillStyle = C.text2; ctx.textAlign = 'center'; ctx.fillText(data.emptyText, X + inner / 2, y + 40); ctx.textAlign = 'left'
    }
    y += 64
  }
  y += 16

  // 每天的圓點：一排 7 天
  const rows = Math.ceil(data.dots.length / 7)
  const boxH = rows * 92 + 16
  if (draw) {
    ctx.fillStyle = C.sub; rr(ctx, X, y, inner, boxH, 16); ctx.fill()
    const cw7 = inner / 7
    data.dots.forEach((dt, i) => {
      const cx = X + cw7 * (i % 7) + cw7 / 2, cy = y + 12 + Math.floor(i / 7) * 92
      const dow = new Date(dt.d + 'T12:00:00Z').getUTCDay()
      ctx.textAlign = 'center'
      font(ctx, 16); ctx.fillStyle = C.muted; ctx.fillText(WD[dow], cx, cy + 14)
      ctx.beginPath(); ctx.arc(cx, cy + 40, 18, 0, Math.PI * 2)
      if (dt.s === 'full') { ctx.fillStyle = C.green; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 8, cy + 40); ctx.lineTo(cx - 2, cy + 46); ctx.lineTo(cx + 9, cy + 34); ctx.stroke() }
      else if (dt.s === 'part') { ctx.fillStyle = C.greenSoft; ctx.fill(); ctx.strokeStyle = C.greenBorder; ctx.lineWidth = 2; ctx.stroke() }
      else { ctx.fillStyle = C.rest; ctx.fill() }
      font(ctx, 16); ctx.fillStyle = C.muted; ctx.fillText(`${+dt.d.slice(5, 7)}/${+dt.d.slice(8)}`, cx, cy + 80)
      ctx.textAlign = 'left'
    })
  }
  y += boxH + 10
  if (draw) {
    // 圖例
    const items = [['full', data.fullLabel || '3-1-2 做滿'], ['part', '有行動'], ['rest', '休息']]
    font(ctx, 16)
    const widths = items.map(([, t]) => ctx.measureText(t).width + 22)
    let lx = X + inner / 2 - (widths.reduce((s, w) => s + w, 0) + 24) / 2
    items.forEach(([s, t], i) => {
      ctx.beginPath(); ctx.arc(lx + 6, y + 9, 6, 0, Math.PI * 2)
      ctx.fillStyle = s === 'full' ? C.green : s === 'part' ? C.greenSoft : C.rest; ctx.fill()
      if (s === 'part') { ctx.strokeStyle = C.greenBorder; ctx.lineWidth = 1.5; ctx.stroke() }
      ctx.fillStyle = C.muted; ctx.fillText(t, lx + 16, y + 15); lx += widths[i] + 12
    })
  }
  y += 30

  const box = (bg, head, headColor, text, color, star) => {
    font(ctx, 21)
    const lines = wrap(ctx, text, inner - 32 - (head && !star ? 0 : 0))
    const h = (head ? 30 : 0) + lines.length * 33 + 22
    if (draw) {
      ctx.fillStyle = bg; rr(ctx, X, y, inner, h, 14); ctx.fill()
      let ty = y + 14
      if (head) {
        let hx = X + 16
        if (star) { drawStar(ctx, hx + 9, ty + 11, 9, C.star); hx += 24 }
        font(ctx, 18, 700); ctx.fillStyle = headColor; ctx.fillText(head, hx, ty + 17); ty += 30
      }
      font(ctx, 21); ctx.fillStyle = color
      lines.forEach((ln, i) => ctx.fillText(ln, X + 16, ty + 22 + i * 33))
    }
    y += h + 10
  }
  if (data.highlight) box(C.hlBg, '亮點', C.hlText, data.highlight, C.hlText, true)
  if (data.say) box(C.sayBg, `${data.sayName} 想說`, C.sayText, data.say, C.sayText, false)

  y += 6
  if (draw) { font(ctx, 16); ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText('unfranchise 每日行動夥伴', X + inner, y + 10); ctx.textAlign = 'left' }
  y += 20 + PAD - 10
  const h = y - top
  return { cardH: h, total: h + 40, x0, cw, top }
}
function drawStar(ctx, cx, cy, r, color) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2; const rr2 = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2) }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill()
}

export async function renderShareCard(data) {
  const icon = await loadImg('/pwa-192x192.png')
  const m = document.createElement('canvas').getContext('2d')
  const L = paint(m, data, icon, false)
  const cv = document.createElement('canvas')
  cv.width = W * S; cv.height = L.total * S
  const ctx = cv.getContext('2d'); ctx.scale(S, S)
  ctx.fillStyle = C.page; ctx.fillRect(0, 0, W, L.total)
  ctx.fillStyle = C.card; rr(ctx, L.x0, L.top, L.cw, L.cardH, 26); ctx.fill()
  ctx.strokeStyle = C.border; ctx.lineWidth = 1.5; ctx.stroke()
  paint(ctx, data, icon, true)
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'))
  return { blob, url: blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png') }
}

// 手機：叫出分享選單（可以選 LINE）；電腦或不支援的瀏覽器：下載圖片
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: 'image/png' })
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared' } catch (e) { if (e && e.name === 'AbortError') return 'cancel' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  setTimeout(() => a.remove(), 1000)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
