// 搜尋找得更多（IG、地區、備註、痛點、問過的產品、顧客地址）＋ 手機記完電腦自動更新
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, ctx = { ...devices['iPhone 14'] }) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.addInitScript(() => { window.__autoRefreshGap = 0; window.__archivedCacheMs = 0 })
    await p.goto('http://127.0.0.1:8771/'); await p.waitForTimeout(300)
    await p.evaluate(x => window.__nav(x), path); await p.waitForTimeout(2000); return p
  }
  const list = p => p.evaluate(() => document.body.innerText)
  // ── 互動名單搜尋 ──
  let p = await open('/contacts')
  const box = p.getByPlaceholder('搜尋姓名、職業、IG、地區、備註...')
  ok(await box.count() === 1, '搜尋框的提示字改了')
  const cases = [['@WANG_YQ', '王怡茜', 'IG：wang_yq'], ['大安', '王怡茜', '地區：臺北市大安區'], ['台北大安', '王怡茜', '地區：臺北市大安區'],
    ['睡不好', '王怡茜', '痛點：最近睡不好'], ['社團', '林小美', '備註：社團認識'], ['愛尚它', '林小美', '問過：愛尚它®綜合維生素粉末']]
  for (const [q, who, why] of cases) {
    await box.fill(q); await p.waitForTimeout(300)
    const t = await list(p)
    ok(t.includes(who) && t.includes(why), `打「${q}」找到${who}，下面寫「${why}」`)
  }
  await box.fill('王'); await p.waitForTimeout(300)
  ok(!(await list(p)).includes('IG：'), '靠名字找到的：不多一行說明')
  await box.fill('護理'); await p.waitForTimeout(300)
  ok((await list(p)).includes('王怡茜') && !(await list(p)).includes('職業：'), '職業照舊找得到（畫面上本來就有職業）')
  await p.screenshot({ path: __dirname + '/shots/t47_search.png' })
  // 封存名單裡也有符合的
  await p.evaluate(() => window.__db.contacts.push({ id: 'cA1', user_id: 'u', name: '封存的老同學', region: '台北市信義區', is_archived: true, created_at: '2025-01-01T00:00:00Z' }))
  await box.fill('信義'); await p.waitForTimeout(800)
  let tt = await list(p)
  ok(tt.includes('沒有符合「信義」的人。') && tt.includes('封存名單裡還有 1 位符合「信義」的人。'), '名單裡沒有、封存裡有：說沒有符合，並提醒封存名單裡有 1 位')
  await p.getByRole('button', { name: '看封存名單 ›' }).click(); await p.waitForTimeout(1000)
  tt = await list(p)
  ok(tt.includes('封存的老同學') && tt.includes('封存名單'), '點「看封存名單」：切到封存名單，找到那個人')
  await p.screenshot({ path: __dirname + '/shots/t47_archived.png' })
  await p.context().close()
  p = await open('/contacts')
  // ── 顧客搜尋 ──
  p = await open('/customers')
  const cbox = p.getByPlaceholder('搜尋姓名、電話、職業、地址...')
  await cbox.fill('板橋'); await p.waitForTimeout(300)
  ok((await list(p)).includes('黃先生') && (await list(p)).includes('地址：新北市板橋區文化路一段'), '顧客：打「板橋」找到黃先生，寫地址')
  await cbox.fill('0912345678'); await p.waitForTimeout(300)
  ok((await list(p)).includes('黃先生'), '顧客：電話不打 - 也找得到')
  await p.evaluate(() => window.__db.customers.push({ id: 'kA1', user_id: 'u', name: '封存的林太太', address: '高雄市左營區', is_archived: true, created_at: '2025-01-01T00:00:00Z' }))
  await cbox.fill('左營'); await p.waitForTimeout(800)
  ok((await list(p)).includes('封存名單裡還有 1 位符合「左營」的人。'), '顧客：封存名單裡有也提醒')
  await p.context().close()

  // ── 手機記完，電腦自動更新 ──
  p = await open('/contacts', { viewport: { width: 1440, height: 900 } })
  await p.evaluate(() => { window.__spin = false; new MutationObserver(() => { if (document.body.innerText.includes('載入中…')) window.__spin = true }).observe(document.body, { childList: true, subtree: true }) })
  await p.evaluate(() => window.__db.contacts.push({ id: 'cN1', user_id: 'u', name: '手機新加的阿德', is_archived: false, created_at: new Date().toISOString() }))
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1000)
  ok((await list(p)).includes('手機新加的阿德'), '回到電腦畫面：手機新加的人自動出現')
  ok(!(await p.evaluate(() => window.__spin)), '自動更新時沒有整頁轉圈')
  // 正在打字時不更新
  await p.getByPlaceholder('搜尋姓名、職業、IG、地區、備註...').focus()
  await p.evaluate(() => window.__db.contacts.push({ id: 'cN2', user_id: 'u', name: '第二位小華', is_archived: false, created_at: new Date().toISOString() }))
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1000)
  ok(!(await list(p)).includes('第二位小華'), '正在打字（游標在搜尋框）時先不更新')
  await p.locator('body').click({ position: { x: 5, y: 5 } }); await p.waitForTimeout(1200)
  ok((await list(p)).includes('第二位小華'), '打完字離開搜尋框，馬上補更新')
  // 沒有切回畫面就不會自己一直讀（幾百人用時省流量）
  const n0 = await p.evaluate(() => window.__ops.length)
  await p.evaluate(() => window.__db.contacts.push({ id: 'cN3', user_id: 'u', name: '第三位阿強', is_archived: false, created_at: new Date().toISOString() }))
  await p.waitForTimeout(3000)
  ok(!(await list(p)).includes('第三位阿強'), '畫面放著不動：不會自己定時去讀')
  await p.context().close()
  // 業績：自動更新不會讓清單變淡
  p = await open('/transactions', { viewport: { width: 1440, height: 900 } })
  await p.evaluate(() => window.__db.transactions.push({ id: 'txN', user_id: 'u', customer_id: 'k2', date: window.__T, type: 'BV', points: 15, amount: 600, cost: 400, is_gift: false, product_name: '手機記的益生菌' }))
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(1200)
  ok((await list(p)).includes('手機記的益生菌'), '業績：手機記的那筆自動出現')
  const op = await p.evaluate(() => getComputedStyle(document.querySelector('.tx-desktop-table-wrap')).opacity)
  ok(op === '1', '業績：自動更新完不會一直是淡的')
  await p.context().close()
  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail || errs.length ? 1 : 0)
})()
