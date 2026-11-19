const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch()
  const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage()
  await p.goto('http://127.0.0.1:8765/#/auth'); await p.waitForTimeout(300); await p.click('#go'); await p.waitForTimeout(800)
  // 登入成功 → 記一筆（時間、裝置）
  await p.evaluate(() => { window.__db.login_events = [] })
  const before = 0
  await p.locator('input[type=email]').fill('yu@example.com'); await p.locator('input[type=password]').fill('right')
  await p.getByRole('button', { name: /^登入/ }).last().click(); await p.waitForTimeout(600)
  const ev = await p.evaluate(() => window.__db.login_events || [])
  ok(ev.length === before + 1 && ev[ev.length - 1].user_id === 'u' && ev[ev.length - 1].device === 'iPhone', '登入成功記一筆：' + JSON.stringify(ev[ev.length - 1]))
  // 密碼錯 → 不記
  await p.locator('input[type=password]').fill('wrong'); await p.getByRole('button', { name: /^登入/ }).last().click(); await p.waitForTimeout(600)
  ok((await p.evaluate(() => (window.__db.login_events || []).length)) === before + 1, '密碼錯不記')
  // 出錯紀錄：畫面出錯 → 送一筆
  await p.evaluate(() => { window.__rpcCalls = []; window.__nav('/contacts/12345678-1234-1234-1234-123456789012') }); await p.waitForTimeout(300)
  await p.evaluate(() => window.__boom("Cannot read properties of null (reading 'name')")); await p.waitForTimeout(300)
  await p.evaluate(() => window.__boom("Cannot read properties of null (reading 'name')")); await p.waitForTimeout(300)
  await p.evaluate(() => { window.__reject('x is not a function') }); await p.waitForTimeout(300)
  await p.evaluate(() => window.__boom('Failed to fetch')); await p.evaluate(() => { window.__reject('Load failed') }); await p.evaluate(() => window.__boom('ResizeObserver loop completed with undelivered notifications.')); await p.waitForTimeout(300)
  const calls = await p.evaluate(() => window.__rpcCalls.filter(c => c[0] === 'report_app_error'))
  ok(calls.length === 2, '同一個錯誤只送一次、網路不穩不送：' + calls.length)
  ok(calls[0] && calls[0][1].p_page === '互動名單 → 一個人的頁面' && calls[0][1].p_device === 'iPhone' && calls[0][1].p_message.includes("reading 'name'"), '送出頁面名字、裝置、錯誤：' + JSON.stringify(calls[0] && calls[0][1]))
  ok(calls[1] && calls[1][1].p_message === 'x is not a function', '沒接住的 Promise 錯誤也記')
  ok(!JSON.stringify(calls).includes('12345678-1234'), '網址裡的編號不會送出去')
  await b.close(); process.exit(fail)
})()
