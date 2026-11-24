// 首頁電腦版排法：右欄今日打卡從上面開始，接著進度、共學主題；左欄寬右欄窄；兩欄差不多一樣長；手機順序照舊
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(ctx) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8767/?nocheer=1'); await p.waitForTimeout(300)
    await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(2500); return p
  }
  const box = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, b: r.bottom + scrollY } }, sel)
  let p
  for (const w of [1024, 1440, 1920]) {
    const p = await open({ viewport: { width: w, height: 1000 } })
    const todo = await box(p, '.area-todo'), ck = await box(p, '.area-checkin'), th = await box(p, '.area-theme'), rv = await box(p, '.area-review'), st = await box(p, '.area-stats')
    ok(ck.x > todo.x + todo.w - 1, w + '：今日打卡在右欄')
    ok(Math.abs(ck.y - rv.y) < 40, w + '：今日打卡跟左欄第一張卡同一個高度開始')
    ok(st.x === ck.x && st.y > ck.b - 1 && st.y - ck.b < 40, w + '：進度接在今日打卡下面')
    ok(th.x === ck.x && th.y > st.b - 1 && th.y - st.b < 90, w + '：共學主題接在進度下面')
    ok(todo.w > ck.w * 1.3, w + '：左欄比右欄寬')
    const care2 = await box(p, '.area-care')
    ok(Math.abs(th.b - care2.b) < 450, w + '：左右兩欄長度差不多（差 ' + Math.round(th.b - care2.b) + '）')
    const care = await p.evaluate(() => [...document.querySelectorAll('.care-card')].map(e => e.getBoundingClientRect().width))
    ok(care.length > 0 && care.every(x => x <= todo.w + 1), w + '：老顧客卡片不會超出左欄')
    await p.context().close()
  }
  // 老顧客 3 位：電腦版一次 2 張、露出第 3 張的邊，‹ › 換頁；手機照舊用滑的、沒有箭頭
  async function openQ(ctx, q) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8767/?nocheer=1' + q); await p.waitForTimeout(300)
    await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(2500); return p
  }
  for (const w of [1024, 1440]) {
    const p = await openQ({ viewport: { width: w, height: 1000 } }, '&care3=1')
    const cards = await p.evaluate(() => [...document.querySelectorAll('.care-card')].map(e => { const r = e.getBoundingClientRect(); return [r.x, r.width] }))
    const sc = await box(p, '.care-scroll')
    ok(cards.length === 3, w + '：老顧客 3 位')
    ok(cards[1][0] + cards[1][1] <= sc.x + sc.w + 1 && cards[2][0] < sc.x + sc.w && cards[2][0] + cards[2][1] > sc.x + sc.w, w + '：一次看到 2 張，第 3 張露出邊')
    const h1 = (await box(p, '.area-care')).h
    ok(h1 < 320, w + '：老顧客那一塊高度只有一排（' + Math.round(h1) + '）')
    const prev = p.getByRole('button', { name: '上一位' }), next = p.getByRole('button', { name: '下一位' })
    ok(await prev.isDisabled() && !(await next.isDisabled()), w + '：一開始只能按下一位')
    await next.click(); await p.waitForTimeout(800)
    const x3 = await p.evaluate(() => document.querySelectorAll('.care-card')[2].getBoundingClientRect())
    ok(x3.right <= sc.x + sc.w + 1, w + '：按下一位，第 3 張整張出現')
    ok(!(await prev.isDisabled()) && await next.isDisabled(), w + '：到最後，下一位變灰')
    await prev.click(); await p.waitForTimeout(800)
    ok(await prev.isDisabled(), w + '：按上一位回到第一張')
    await p.context().close()
  }
  p = await openQ({ viewport: { width: 1440, height: 1000 } }, '')
  ok(await p.getByRole('button', { name: '下一位' }).count() === 0, '電腦版只有 1 位：沒有箭頭')
  await p.context().close()
  p = await openQ({ ...devices['iPhone 14'] }, '&care3=1')
  ok(await p.getByRole('button', { name: '下一位' }).count() === 0, '手機 3 位：沒有箭頭，照舊用手指滑')
  const mw = await p.evaluate(() => { const s = document.querySelector('.care-scroll'); const c = s.querySelector('.care-card'); return [getComputedStyle(s).overflowX, c.getBoundingClientRect().width / s.getBoundingClientRect().width] })
  ok(mw[0] === 'auto' && Math.abs(mw[1] - 0.82) < 0.08, '手機：卡片一樣是 82% 寬、可以滑 ' + mw[1].toFixed(2))
  await p.context().close()

  // 1920：整頁置中，不貼著左邊
  p = await open({ viewport: { width: 1920, height: 1000 } })
  const wrap = await box(p, '.dashboard-wrap')
  ok(wrap.w <= 1280 + 1, '大螢幕：整頁最寬 1280')
  await p.context().close()
  // 手機：順序照舊（今日打卡在老顧客之後、進度之前；共學主題在最後）
  p = await open({ ...devices['iPhone 14'] })
  const order = await p.evaluate(() => [...document.querySelectorAll('.dash-grid section[class^="area-"]')].map(e => e.className.split(' ')[0]))
  ok(order.indexOf('area-checkin') > order.indexOf('area-todo') && order.indexOf('area-checkin') < order.indexOf('area-stats'), '手機：今日打卡位置照舊 ' + order.join(','))
  ok(order[order.length - 1] === 'area-theme', '手機：共學主題還在最下面')
  ok(!(await p.evaluate(() => !!document.querySelector('.area-side'))), '手機：沒有右欄外框')
  await p.context().close()
  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail || errs.length ? 1 : 0)
})()
