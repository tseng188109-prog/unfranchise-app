// 業績換月份：不整頁轉圈、頁面不跳，月份換過去，換回來資料還在
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  for (const [tag, ctx, wrap] of [['電腦', { viewport: { width: 1440, height: 800 } }, '.tx-desktop-wrap'], ['手機', { ...devices['iPhone 14'] }, '.tx-mobile-header']]) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8771/'); await p.waitForTimeout(300)
    await p.evaluate(() => window.__nav('/transactions')); await p.waitForTimeout(2000)
    const text = () => p.evaluate(() => document.body.innerText)
    ok((await text()).includes('OPC-3'), tag + '：這個月的業績有出來')
    await p.evaluate(() => { window.__spin = false; new MutationObserver(() => { if (document.body.innerText.includes('載入中…')) window.__spin = true }).observe(document.body, { childList: true, subtree: true, characterData: true }) })
    const prev = p.locator(wrap).getByRole('button', { name: '‹' }).first()
    await prev.click(); await p.waitForTimeout(1200)
    ok(!(await p.evaluate(() => window.__spin)), tag + '：換到上個月，沒有出現「載入中」整塊轉圈')
    ok(!(await text()).includes('OPC-3'), tag + '：上個月的清單換好了（沒有這個月的 OPC-3）')
    await p.locator(wrap).getByRole('button', { name: '›' }).first().click(); await p.waitForTimeout(1200)
    ok((await text()).includes('OPC-3') && !(await p.evaluate(() => window.__spin)), tag + '：換回這個月，資料回來，一樣沒有轉圈')
    const op = await p.evaluate(() => getComputedStyle(document.querySelector('.tx-mobile-list')).opacity)
    ok(op === '1', tag + '：讀完之後不會一直是淡的')
    await c.close()
  }
  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail || errs.length ? 1 : 0)
})()
