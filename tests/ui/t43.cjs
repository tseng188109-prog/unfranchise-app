// 每日行動：電腦版兩欄（左：每天、每週；右：每月目標），「這個月的安排」已經完成的先收起來，手機照舊一欄
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(ctx, q = '?manymeets=1') {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8765/' + q); await p.waitForTimeout(300)
    await p.evaluate(() => window.__nav('/daily')); await p.waitForTimeout(2500); return p
  }
  const box = (p, s) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, b: r.bottom + scrollY } }, s)
  const monthText = p => p.evaluate(() => document.querySelector('.daily-month').innerText)
  for (const w of [1024, 1440, 1920]) {
    const p = await open({ viewport: { width: w, height: 1000 } })
    const today = await box(p, '.daily-today'), week = await box(p, '.daily-week'), month = await box(p, '.daily-month'), meets = await box(p, '.daily-meets'), bar = await box(p, '.daily-datebar')
    ok(month.x > today.x + today.w - 1, w + '：每月目標在右欄')
    ok(week.x === today.x && week.y > today.b - 1, w + '：每週行動在每日行動下面（左欄）')
    ok(Math.abs(month.y - meets.y) < 2, w + '：每月目標從最上面開始')
    ok(Math.abs(bar.w - today.w) < 2, w + '：日期切換跟左欄一樣寬')
    await p.context().close()
  }
  // 收起已經完成的
  let p = await open({ viewport: { width: 1440, height: 1000 } })
  let t = await monthText(p)
  ok(t.includes('已經完成的 7 筆'), '這個月已經見完 7 位：收成一行')
  ok(t.includes('王怡茜') && t.includes('一對一聊聊'), '接下來的安排照樣看得到')
  ok(!t.includes('新店址看現場') && !t.includes('吃拉麵'), '已經完成的先不顯示')
  await p.getByRole('button', { name: /已經完成的 7 筆/ }).click(); await p.waitForTimeout(400)
  t = await monthText(p)
  ok(t.includes('新店址看現場') && t.includes('吃拉麵') && t.includes('收起已經完成的 7 筆'), '點開：全部出現，可以再收起來')
  const order = await p.evaluate(() => { const s = document.querySelector('.daily-month').innerText; return [s.indexOf('一起看店面'), s.indexOf('體驗產品')] })
  ok(order[0] < order[1], '點開後照日期排（完成的在前面）')
  await p.getByRole('button', { name: /收起已經完成的/ }).click(); await p.waitForTimeout(300)
  ok(!(await monthText(p)).includes('新店址看現場'), '再點一下收起來')
  // 點月曆上的某一天：只看那天，不收
  await p.locator('.daily-month').getByText('3', { exact: true }).first().click(); await p.waitForTimeout(400)
  t = await monthText(p)
  ok(t.includes('新店址看現場') && !t.includes('已經完成的'), '點月曆某一天：只看那天，不收起來')
  await p.context().close()
  // 沒有已經完成的：沒有那一行
  p = await open({ viewport: { width: 1440, height: 1000 } }, '?x=1')
  ok(!(await monthText(p)).includes('已經完成的 7 筆'), '測試資料少的時候照樣顯示')
  await p.context().close()
  // 這個月全部都見完了：一樣收起來，說接下來還沒有安排
  p = await open({ viewport: { width: 1440, height: 1000 } }, '?manymeets=1&alldone=1')
  t = await monthText(p)
  ok(/已經完成的 \d+ 筆/.test(t) && t.includes('這個月接下來還沒有安排。') && !t.includes('新店址看現場'), '這個月全部做完：一樣收起來，說接下來還沒有安排')
  await p.getByRole('button', { name: /已經完成的/ }).click(); await p.waitForTimeout(400)
  t = await monthText(p)
  ok(t.includes('新店址看現場') && !t.includes('這個月接下來還沒有安排'), '點開看得到全部')
  // 看上個月：全部做完就照常全部顯示
  await p.locator('.daily-month').getByRole('button', { name: '‹' }).first().click(); await p.waitForTimeout(1200)
  t = await monthText(p)
  ok(!/已經完成的 \d+ 筆/.test(t), '看上個月：不收')
  await p.context().close()
  // 點每日行動上面的星期幾：只換上面那一塊，整頁不轉圈、不跳回最上面
  for (const ctx of [{ viewport: { width: 1440, height: 700 } }, { ...devices['iPhone 14'] }]) {
    const p2 = await open(ctx)
    await p2.evaluate(() => window.scrollTo(0, 300)); await p2.waitForTimeout(300)
    const y0 = await p2.evaluate(() => document.querySelector('.daily-today').getBoundingClientRect().top)
    const label0 = await p2.evaluate(() => document.querySelector('.daily-datebar').innerText)
    const cells = p2.locator('.daily-today').getByText('一', { exact: true })
    await cells.first().click()
    let gone = false
    for (let i = 0; i < 15; i++) { await p2.waitForTimeout(60); if (!(await p2.evaluate(() => !!document.querySelector('.daily-month')))) gone = true }
    const y1 = await p2.evaluate(() => document.querySelector('.daily-today').getBoundingClientRect().top)
    const label1 = await p2.evaluate(() => document.querySelector('.daily-datebar').innerText)
    const tag = ctx.isMobile ? '手機' : '電腦'
    ok(!gone, tag + '：點星期幾，整頁沒有消失重來')
    ok(Math.abs(y1 - y0) < 5, tag + '：每日行動那一塊停在畫面上同一個位置，沒有跳（' + Math.round(y0) + ' → ' + Math.round(y1) + '）')
    ok(label1 !== label0 && label1.includes('補打模式'), tag + '：日期換成那一天（' + label1.replace(/\n/g, ' ') + '）')
    await p2.context().close()
  }
  // 手機：一欄，順序照舊，一樣收起來
  p = await open({ ...devices['iPhone 14'] })
  const ys = await p.evaluate(() => ['.daily-meets', '.daily-today', '.daily-week', '.daily-month'].map(s => document.querySelector(s).getBoundingClientRect().y))
  ok(ys[0] < ys[1] && ys[1] < ys[2] && ys[2] < ys[3], '手機：今天的約會、每日、每週、每月由上往下，跟原本一樣')
  ok((await monthText(p)).includes('已經完成的 7 筆'), '手機也一樣收起來')
  await p.context().close()
  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail || errs.length ? 1 : 0)
})()
