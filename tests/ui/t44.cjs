// 戰隊電腦版：左欄成員、右欄旅程／好消息／打氣／工具／邀請碼；標題跟內容對齊；手機順序照舊
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(ctx) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8767/?nocheer=1'); await p.waitForTimeout(300)
    await p.evaluate(() => window.__nav('/team')); await p.waitForTimeout(2500); return p
  }
  const box = (p, s) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, b: r.bottom + scrollY } }, s)
  for (const w of [1024, 1440, 1920]) {
    const p = await open({ viewport: { width: w, height: 1000 } })
    const main = await box(p, '.team-main'), j = await box(p, '.team-journey'), n = await box(p, '.team-news'), ch = await box(p, '.team-cheers'), side = await box(p, '.team-sidebar'), head = await box(p, '.team-head button')
    ok(j.x > main.x + main.w - 1, w + '：旅程在右欄')
    ok(Math.abs(j.y - main.y) < 2, w + '：成員和旅程從同一個高度開始')
    ok(n.x === j.x && n.y > j.b - 1 && ch.y > n.b - 1 && side.y > ch.b - 1, w + '：右欄由上往下是旅程、好消息、打氣、（工具）、邀請碼')
    ok(main.w > j.w * 1.3, w + '：左欄比右欄寬')
    ok(Math.abs(head.x - main.x) < 2, w + '：標題跟內容左邊對齊')
    const t = await p.evaluate(() => document.querySelector('.team-main').innerText)
    ok(t.includes('退出戰隊') && t.includes('解散戰隊'), w + '：退出、解散在左欄成員下面')
    await p.context().close()
  }
  const p = await open({ ...devices['iPhone 14'] })
  const ys = await p.evaluate(() => ['.team-journey', '.team-news', '.team-cheers', '.team-sidebar', '.team-main'].map(s => document.querySelector(s).getBoundingClientRect().y))
  ok(ys.every((y, i) => i === 0 || y > ys[i - 1]), '手機：旅程、好消息、打氣、邀請碼、成員由上往下，跟原本一樣')
  await p.context().close()
  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail || errs.length ? 1 : 0)
})()
