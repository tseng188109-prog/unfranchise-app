const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, ctx = { ...devices['iPhone 14'] }) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8765/#' + path); await p.waitForTimeout(300); await p.click('#go'); await p.waitForTimeout(1000); return p
  }
  const body = p => p.evaluate(() => document.body.innerText)
  let p = await open('/admin')
  let t = await body(p)
  ok(/1\s*種 App 出錯還沒修好/.test(t), '整體「要處理的事」：App 出錯')
  // 帳號：卡在哪
  await p.getByRole('button', { name: '帳號', exact: true }).click(); await p.waitForTimeout(400)
  t = await body(p)
  ok(t.includes('卡在：加了名單，還沒記過互動') && t.includes('卡在：登入過，還沒加名單') && t.includes('卡在：註冊完還沒登入過'), '帳號列表：卡在哪一步')
  const stuckCount = (t.match(/卡在：/g) || []).length
  ok(stuckCount === 3, '都做到的人、已停用的人不顯示（3 位）：' + stuckCount)
  ok(!/卡在：.*\d+ 位/.test(t), '卡在哪不顯示數字')
  await p.screenshot({ path: __dirname + '/shots/ad1_accounts.png', fullPage: true })
  // 點小美：起步全綠、裝置、登入紀錄
  await p.locator('.adm-cards button', { hasText: '小美' }).first().click(); await p.waitForTimeout(800)
  t = await body(p)
  ok(t.includes('起步進度') && t.includes('✓ 記第一次互動') && t.includes('✓ 開手機提醒'), '起步進度五步')
  ok(t.includes('登入中的裝置') && t.includes('iPhone') && t.includes('Windows 電腦') && /登入 · 最後/.test(t), '登入中的裝置（裝置種類、時間）')
  ok(t.includes('最近登入') && (t.match(/iPhone|Windows 電腦/g) || []).length >= 4, '最近登入兩筆')
  ok(t.includes('改名字') && t.includes('給他一組臨時密碼'), '改名字在操作清單')
  await p.screenshot({ path: __dirname + '/shots/ad2_sheet.png', fullPage: false })
  // 登出所有裝置
  await p.getByRole('button', { name: /把他所有裝置登出/ }).click(); await p.waitForTimeout(300)
  t = await body(p); ok(t.includes('最多一小時內'), '登出前先確認')
  await p.getByRole('button', { name: '全部登出' }).click(); await p.waitForTimeout(700)
  t = await body(p)
  ok(t.includes('目前沒有登入中的裝置') && await p.getByRole('button', { name: /把他所有裝置登出/ }).count() === 0, '登出後沒有裝置，按鈕收起來')
  ok(await p.evaluate(() => window.__adb.tables.admin_logs.some(l => l.action === 'signout_all' && l.target_name === '小美')), '記進管理員紀錄')
  // 改名字
  await p.getByRole('button', { name: /改名字/ }).click(); await p.waitForTimeout(300)
  const inp = p.locator('input[maxlength="30"]')
  ok(await inp.inputValue() === '小美', '改名字：先帶入原本名字')
  await inp.fill('   '); ok(await p.getByRole('button', { name: '儲存', exact: true }).isDisabled(), '空白不能存')
  await inp.fill('林小美'); await p.getByRole('button', { name: '儲存', exact: true }).click(); await p.waitForTimeout(800)
  t = await body(p)
  ok(await p.evaluate(() => window.__adb.tables.users.find(u => u.id === 'M').name === '林小美') && t.includes('林小美'), '名字改好，列表更新')
  // 管理員紀錄
  await p.getByRole('button', { name: '管理員', exact: true }).click(); await p.waitForTimeout(600)
  t = await body(p); ok(t.includes('改名字：林小美（小美 → 林小美）') && t.includes('登出所有裝置'), '管理員紀錄寫清楚')
  // 回報分頁：App 出錯
  await p.getByRole('button', { name: '回報', exact: true }).click(); await p.waitForTimeout(600)
  t = await body(p); ok(t.includes('大家回報 2') && t.includes('App 出錯 1'), '回報分頁兩個切換')
  await p.getByRole('button', { name: /App 出錯/ }).click(); await p.waitForTimeout(300)
  t = await body(p)
  ok(t.includes('互動名單 → 一個人的頁面') && t.includes('5 次') && t.includes('3 個人遇到') && t.includes("Cannot read properties of null (reading 'name')"), '出錯紀錄內容')
  ok(!t.includes('阿傑') || !t.split('App 出錯')[1].includes('阿傑'), '出錯紀錄不列名字')
  await p.screenshot({ path: __dirname + '/shots/ad3_errors.png', fullPage: true })
  await p.getByRole('button', { name: '修好了', exact: true }).click(); await p.waitForTimeout(700)
  t = await body(p); ok(t.includes('目前沒有出錯紀錄') && t.includes('App 出錯 0'), '修好了 → 收起來')
  await p.getByRole('button', { name: /修好了的 2 種/ }).click(); await p.waitForTimeout(300)
  t = await body(p); ok(t.includes('x is not a function') && t.includes('改回還沒修好'), '看修好了的')
  await p.getByRole('button', { name: '整體', exact: true }).click(); await p.waitForTimeout(500)
  t = await body(p); ok(!t.includes('App 出錯還沒修好'), '整體不再提醒')
  await p.context().close()
  // 從整體「看出錯」直接到出錯那一區
  p = await open('/admin')
  await p.getByText('種 App 出錯還沒修好').click(); await p.waitForTimeout(600)
  t = await body(p); ok(t.includes('互動名單 → 一個人的頁面') && t.includes('3 個人遇到'), '整體點「看出錯」→ 直接到 App 出錯')
  await p.context().close()
  // 電腦版表格也有卡在哪
  p = await open('/admin', { viewport: { width: 1280, height: 900 } })
  await p.getByRole('button', { name: '帳號', exact: true }).click(); await p.waitForTimeout(400)
  ok(await p.locator('table.adm-table td', { hasText: '卡在：加了名單，還沒記過互動' }).count() === 1, '電腦版表格也顯示卡在哪')
  await p.context().close()
  ok(errs.length === 0, '沒有頁面錯誤 ' + errs.join(' | '))
  await b.close(); process.exit(fail)
})()
