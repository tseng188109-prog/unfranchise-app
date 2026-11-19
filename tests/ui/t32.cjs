const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, prep, ctx = { ...devices['iPhone 14'] }) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message + ' @ ' + path))
    await p.goto('http://127.0.0.1:8766/?seen=1'); await p.waitForTimeout(300)
    if (prep) await p.evaluate(prep)
    await p.evaluate(x => window.__nav(x), path); await p.waitForTimeout(2200); return p
  }
  const body = p => p.evaluate(() => document.body.innerText)

  // A. 名字下面「他是誰」
  const who = () => { const c = window.__db.contacts.find(x => x.id === 'c1'); Object.assign(c, { occupation: '工程師', region: '新竹', platform: 'IG', platform_account: 'https://www.instagram.com/yuming.hu/?hl=zh-tw', note: '大學社團學弟，去年婚禮又遇到，那天聊了很多換工作的事情還有他太太懷孕的近況' }); window.__opened = []; window.open = u => { window.__opened.push(u); return null } }
  let p = await open('/contacts/c1', who)
  let t = await body(p)
  ok(t.includes('工程師') && t.includes('新竹') && t.includes('IG @yuming.hu'), '職業 · 地區 · IG 都在名字下面')
  ok(await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('IG @yuming.hu')); return !b.parentElement.textContent.includes('·') }), 'IG 帳號自己一行，不會斷在「·」後面')
  ok(t.includes('認識：大學社團學弟'), '怎麼認識的')
  const oneLine = await p.evaluate(() => { const e = [...document.querySelectorAll('div')].find(d => d.textContent.startsWith('認識：') && d.children.length === 0); return e ? e.getBoundingClientRect().height < 26 && getComputedStyle(e).textOverflow === 'ellipsis' : null })
  ok(oneLine === true, '認識太長 → 只顯示一行，後面用「…」')
  await p.screenshot({ path: __dirname + '/shots/w1_who.png' })
  await p.getByRole('button', { name: /打開 IG @yuming\.hu/ }).click()
  ok(JSON.stringify(await p.evaluate(() => window.__opened)) === '["https://instagram.com/yuming.hu"]', '點 IG → 打開他的 IG（貼整串網址也行）')
  for (const tab of ['進度', '資料']) {
    await p.getByRole('button', { name: tab, exact: true }).click(); await p.waitForTimeout(300)
    t = await body(p); ok(t.includes('IG @yuming.hu') && t.includes('工程師'), tab + ' 分頁也看得到他是誰')
  }
  await p.context().close()
  // LINE：複製
  p = await open('/contacts/c1', () => { const c = window.__db.contacts.find(x => x.id === 'c1'); Object.assign(c, { platform: 'LINE', platform_account: 'yu123', occupation: null, region: null, note: null }) },
    { ...devices['iPhone 14'], permissions: ['clipboard-read', 'clipboard-write'] })
  t = await body(p); ok(t.includes('LINE yu123') && !t.split('LINE yu123')[0].trim().endsWith('·'), '只有 LINE：不會多出「·」')
  await p.getByRole('button', { name: '複製 LINE yu123' }).click(); await p.waitForTimeout(200)
  ok((await body(p)).includes('已複製'), 'LINE 點了複製，跳「已複製」')
  ok(await p.evaluate(() => navigator.clipboard.readText()) === 'yu123', '剪貼簿裡是 yu123')
  await p.context().close()
  // 只選了平台沒填帳號、什麼都沒填 → 補資料
  p = await open('/contacts/c1', () => { const c = window.__db.contacts.find(x => x.id === 'c1'); Object.assign(c, { platform: 'IG', platform_account: null, occupation: null, region: null, note: null }) })
  t = await body(p); ok(t.includes('+ 補職業、IG，下次一眼認出他') && !/\bIG\b(?! ，)/.test(t.split('補職業')[0].slice(-20)), '什麼都沒填 → 顯示補資料（只選 IG 沒帳號不算）')
  await p.screenshot({ path: __dirname + '/shots/w2_empty.png' })
  await p.getByRole('button', { name: '+ 補職業、IG，下次一眼認出他' }).click(); await p.waitForTimeout(800)
  ok(/\/contacts\/c1\/edit$/.test(await p.evaluate(() => location.pathname)), '點了到編輯頁')
  await p.context().close()
  // 其他平台、帳號不是 IG 格式
  p = await open('/contacts/c1', () => { const c = window.__db.contacts.find(x => x.id === 'c1'); Object.assign(c, { platform: '其他', platform_account: '小紅書 yuming', occupation: '老師', region: null, note: null }) })
  t = await body(p); ok(t.includes('老師') && t.includes('小紅書 yuming') && await p.getByRole('button', { name: /小紅書/ }).count() === 0, '「其他」只顯示文字，不是連結')
  await p.context().close()

  // B. 首選 10：核桃提示改字、放第二行、不會被切掉
  p = await open('/lhome')
  t = await body(p)
  ok(/\d+ 顆核桃還沒放進首選/.test(t) && !t.includes('可以補'), '改成「N 顆核桃還沒放進首選」')
  const fit = await p.evaluate(() => { const s = [...document.querySelectorAll('span')].find(e => e.textContent.startsWith('首選 10') && e.children.length === 0); return s ? { full: s.scrollWidth <= s.clientWidth + 1, text: s.textContent } : null })
  ok(fit && fit.full, '「首選 10」那行沒被切掉：' + (fit && fit.text))
  { const el = p.getByText(/顆核桃還沒放進首選/); const bx = await el.boundingBox(); await p.screenshot({ path: __dirname + '/shots/w3_top10.png', clip: { x: 0, y: Math.max(0, bx.y - 60), width: 390, height: 110 } }) }
  await p.getByText(/顆核桃還沒放進首選/).click(); await p.waitForTimeout(1200)
  ok((await p.evaluate(() => location.pathname + location.search)) === '/contacts?jar=1', '點核桃提示 → 打開罐子')
  await p.context().close()

  // C. 核桃規則：只約吃飯不算，答應聽一對一才算
  const plans = () => { const d = window.__db; d.contacts.push({ id: 'r1', user_id: 'u', name: '吃飯朋友', egg_type: '荷包蛋', is_archived: false, source: null, created_at: '2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }, { id: 'r2', user_id: 'u', name: '想聽的人', egg_type: '荷包蛋', is_archived: false, source: null, created_at: '2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }, { id: 'r3', user_id: 'u', name: '說明會朋友', egg_type: '荷包蛋', is_archived: false, source: null, created_at: '2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }); d.contact_logs.push({ id: 'p1', user_id: 'u', contact_id: 'r1', date: window.__add(-5), kind: 'meet_plan', note: '19:30 約聚餐 吃拉麵' }, { id: 'p2', user_id: 'u', contact_id: 'r2', date: window.__add(-5), kind: 'meet_plan', note: '一對一會談' }, { id: 'p3', user_id: 'u', contact_id: 'r3', date: window.__add(-5), kind: 'meet_plan', note: '邀請參加 11/23 家庭事業說明會' }, { id: 'p4', user_id: 'u', contact_id: 'r2', date: window.__add(-1), kind: 'meet_plan', note: '約聚餐' }) }
  p = await open('/contacts?jar=1', plans)
  t = await body(p)
  ok(t.includes('想聽的人') && t.includes('答應聽一對一會談'), '答應聽一對一會談 → 核桃（後來又約吃飯也不影響）')
  ok(t.includes('說明會朋友') && t.includes('答應聽家庭事業說明會'), '答應去說明會 → 核桃')
  ok(t.split('吃飯朋友').length - 1 === 1, '只約吃飯 → 不是核桃（只在名單出現，罐子的核桃裡沒有）')
  ok(t.split('想聽的人').length - 1 >= 2, '想聽的人：名單和核桃都有')
  ok(!t.includes('約成過'), '不再出現「約成過」')
  await p.screenshot({ path: __dirname + '/shots/w4_jar.png', fullPage: true })
  await p.context().close()
  // 首頁 1 個邀約：吃飯朋友不會因為約過飯被當核桃
  p = await open('/lhome', () => { const d = window.__db; d.contacts.forEach(c => { if (c.id === 'w1' || c.id === 'w2') { c.need_level = null; c.interest_level = null } }); d.contacts.push({ id: 'r1', user_id: 'u', name: '吃飯朋友', egg_type: '荷包蛋', is_archived: false, source: null, created_at: '2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); d.contact_logs.push({ id: 'p1', user_id: 'u', contact_id: 'r1', date: window.__add(-15), kind: 'meet_plan', note: '約聚餐' }) })
  t = await body(p); const i = t.indexOf('個邀約'); const cardT = t.slice(i).split('\n').slice(0, 4).join('/')
  ok(!/他答應聽|約成過/.test(cardT), '首頁推薦不會把只約吃飯的人當核桃：' + cardT)
  await p.context().close()

  ok(errs.length === 0, '沒有頁面錯誤 ' + errs.join(' | '))
  await b.close(); process.exit(fail)
})()
