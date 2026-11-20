// deliver-76 設定和更新：隊友給我打氣、音效和震動、「有新版本」「已更新到最新版」
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, q = '?nocheer=1') {
    const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8767/' + q); await p.waitForTimeout(300); await p.evaluate(x => window.__nav(x), path); await p.waitForTimeout(1800); return p
  }
  const text = p => p.evaluate(() => document.body.innerText)

  // 設定 → 手機提醒：「隊友給我打氣」沒開通知也看得到
  let p = await open('/settings?s=push')
  let t = await text(p)
  ok(t.includes('隊友給我打氣') && t.includes('同一個戰隊的隊友可以給你打氣，只有你看得到'), '手機提醒裡有「隊友給我打氣」')
  await p.getByRole('switch', { name: '隊友給我打氣' }).click(); await p.waitForTimeout(400)
  const ts = await p.evaluate(() => window.__db.users[0].tag_settings)
  ok(ts.notify && ts.notify.cheer === false && ts.daily_mode === 'std', '關掉 → 存成不收，其他設定不變')
  ok((await text(p)).includes('已關掉：隊友看不到給你打氣的按鈕'), '關掉後的說明')
  await p.context().close()

  // 設定 → 外觀：音效和震動
  p = await open('/settings?s=theme')
  t = await text(p)
  ok(t.includes('音效和震動') && t.includes('手機切成靜音時不會響'), '外觀裡有音效和震動')
  ok((await p.getByRole('switch', { name: '音效和震動' }).getAttribute('aria-checked')) === 'true', '預設開著')
  await p.getByRole('switch', { name: '音效和震動' }).click(); await p.waitForTimeout(200)
  ok(await p.evaluate(() => localStorage.getItem('ufa_sfx_off')) === '1', '關掉存在這支手機上')
  await p.context().close()

  // 設定頁第一頁：版本（測試打包沒有版本時間，就不顯示，也不會出錯）
  p = await open('/settings')
  ok((await text(p)).includes('登出'), '設定頁正常')
  await p.context().close()

  // 有新版本、正在打字 → 最上面跳「有新版本，點一下更新」
  p = await open('/lhome')
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('ufa:update-ready'))); await p.waitForTimeout(300)
  t = await text(p)
  ok(t.includes('有新版本') && t.includes('點一下更新'), '有新版本的提示')
  await p.screenshot({ path: __dirname + '/shots/t38_update.png' })
  await p.context().close()

  // 更新完重新整理 → 「已更新到最新版」，過一下就消失
  const c = await b.newContext({ ...devices['iPhone 14'] }); p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
  await p.goto('http://127.0.0.1:8767/?nocheer=1'); await p.evaluate(() => sessionStorage.setItem('ufa_just_updated', '1'))
  await p.reload(); await p.waitForTimeout(300); await p.evaluate(x => window.__nav(x), '/lhome'); await p.waitForTimeout(300)
  ok((await text(p)).includes('已更新到最新版'), '已更新到最新版')
  await p.waitForTimeout(2600)
  ok(!(await text(p)).includes('已更新到最新版'), '提示自己消失')
  ok(await p.evaluate(() => sessionStorage.getItem('ufa_just_updated')) === null, '只跳一次')
  await c.close()

  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail)
})()
