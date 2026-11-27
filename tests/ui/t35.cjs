const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
  await p.goto('http://127.0.0.1:8765/#/settings'); await p.waitForTimeout(300); await p.click('#go'); await p.waitForTimeout(1200)
  const body = () => p.evaluate(() => document.body.innerText)
  let t = await body()
  const pages = await p.evaluate(() => document.documentElement.scrollHeight / window.innerHeight)
  ok(pages < 1.75, '第一頁差不多一個畫面看完（' + pages.toFixed(2) + ' 個畫面高）')
  ok(t.includes('我為什麼留在這裡') && t.includes('我的節奏') && t.includes('3-1-2') && t.includes('手機提醒') && t.includes('記錄用的標籤和產品') && t.includes('外觀') && t.includes('跟隨手機'), '第一頁分類和目前的設定')
  ok(t.includes('我的夥伴') && t.includes('戰隊') && t.includes('我的活動') && t.includes('試用品追蹤') && t.includes('使用說明') && t.includes('系統管理') && t.includes('名字、密碼、推薦人') && t.includes('登出'), '其他入口都在')
  ok(!t.includes('互動名單') || (await p.locator('button', { hasText: /^互動名單$/ }).count()) === 0, '不重複放互動名單、業績、顧客')
  ok(!/業績紀錄|顧客檔案/.test(t), '業績紀錄、顧客檔案入口拿掉')
  ok(!t.includes('約人的節奏') && !t.includes('對方在意什麼') && !t.includes('修改密碼'), '細節收進去了')
  ok(await p.getByRole('button', { name: '帳號', exact: true }).first().textContent().then(x => x.includes('Yu')), '最上面有名字（點了到帳號）')
  await p.screenshot({ path: __dirname + '/shots/s1_main.png', fullPage: true })
  await p.getByRole('button', { name: '帳號', exact: true }).first().click(); await p.waitForTimeout(400)
  ok((await body()).includes('顯示名稱'), '點名字 → 帳號頁')
  await p.goBack(); await p.waitForTimeout(400)
  const open = async (label) => { await p.getByRole('button', { name: new RegExp(label) }).first().click(); await p.waitForTimeout(500); return body() }
  const back = async () => { await p.getByRole('button', { name: '回到設定' }).click(); await p.waitForTimeout(400) }
  // 我的節奏
  t = await open('我的節奏')
  ok(t.includes('每日節奏') && t.includes('1-1-2') && t.includes('10-3-2') && t.includes('約人的節奏') && t.includes('一週想見幾位') && t.includes('活動前幾週') && t.includes('每日打卡項目'), '我的節奏：每日節奏、約人節奏、打卡項目都在')
  ok(!t.includes('我為什麼留在這裡'), '子頁不顯示第一頁的東西')
  await p.getByRole('button', { name: /10-3-2/ }).click(); await p.waitForTimeout(400)
  ok(await p.evaluate(() => window.__db.users[0].tag_settings.daily_mode === 'fast'), '在子頁改節奏照常存')
  await p.screenshot({ path: __dirname + '/shots/s2_rhythm.png', fullPage: true })
  // 手機返回手勢 → 回第一頁
  await p.goBack(); await p.waitForTimeout(500)
  t = await body(); ok(t.includes('我為什麼留在這裡') && t.includes('10-3-2'), '手機返回 → 回到設定第一頁，右邊顯示新的節奏')
  ok(await p.evaluate(() => location.pathname === '/settings' && !location.search), '網址回到 /settings')
  // 標籤和產品
  t = await open('記錄用的標籤和產品')
  ok(t.includes('見完了的標籤') && t.includes('見完了時顯示「多記一點」') && /對方在意什麼\s*\d+ 個/.test(t) && /對方主動做了什麼\s*\d+ 個/.test(t), '標籤先收成兩行，有幾個')
  ok(!t.includes('改名'), '還沒展開時看不到改名')
  ok(t.includes('我的首選產品') && t.includes('居家購物清單') && t.includes('3 個月'), '首選產品、居家購物清單')
  await p.getByRole('button', { name: /對方在意什麼/ }).click(); await p.waitForTimeout(300)
  t = await body(); ok(t.includes('改名') && t.includes('隱藏') && t.includes('收起'), '點開 → 改名、隱藏')
  await p.screenshot({ path: __dirname + '/shots/s3_tags.png', fullPage: true })
  await back()
  t = await body(); ok(t.includes('我為什麼留在這裡'), '左上「‹」回到第一頁')
  // 外觀
  await open('外觀')
  await p.getByRole('button', { name: '夜晚', exact: true }).click(); await p.waitForTimeout(300)
  await back(); t = await body(); ok(/外觀\s*夜晚/.test(t), '換成夜晚，第一頁顯示「夜晚」')
  await open('外觀'); await p.getByRole('button', { name: '跟隨手機', exact: true }).click(); await back()
  // 帳號
  t = await open('帳號')
  ok(t.includes('顯示名稱') && t.includes('帳號安全') && t.includes('修改密碼') && t.includes('推薦關係') && t.includes('我的推薦人'), '帳號：名字、密碼、推薦人')
  await p.locator('input[placeholder="輸入名稱..."]').fill('Yu2'); await p.getByRole('button', { name: /儲存/ }).first().click(); await p.waitForTimeout(400)
  ok(await p.evaluate(() => window.__db.users[0].name === 'Yu2'), '改顯示名稱照常存')
  await back()
  // 手機提醒
  t = await open('手機提醒'); ok(t.includes('手機提醒'), '手機提醒頁')
  await back()
  // 直接打開不存在的子頁
  await p.evaluate(() => window.__nav('/settings?s=xyz')); await p.waitForTimeout(400)
  t = await body(); ok(t.includes('回到設定'), '奇怪的網址 → 有「回到設定」')
  // 直接打開子頁網址（不是從第一頁點進來）→ ‹ 回到第一頁而不是跳離設定
  await p.evaluate(() => window.__nav('/settings?s=rhythm', { replace: true })); await p.waitForTimeout(400)
  await back(); ok(await p.evaluate(() => location.pathname === '/settings' && !location.search), '直接開子頁，按 ‹ 也回到設定第一頁')
  // 功能入口
  await p.getByRole('button', { name: /我的夥伴/ }).click(); await p.waitForTimeout(500)
  ok(await p.evaluate(() => location.pathname === '/partners'), '我的夥伴 → 夥伴頁')
  ok(errs.length === 0, '沒有頁面錯誤 ' + errs.join(' | '))
  await b.close(); process.exit(fail)
})()
