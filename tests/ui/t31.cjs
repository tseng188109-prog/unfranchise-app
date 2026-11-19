const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, prep, ctx = { ...devices['iPhone 14'] }) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message + ' @ ' + path + ' ' + (e.stack||'').split('\n')[1]))
    await p.goto('http://127.0.0.1:8766/?seen=1'); await p.waitForTimeout(300)
    if (prep) await p.evaluate(prep)
    await p.evaluate(x => window.__nav(x), path); await p.waitForTimeout(2200); return p
  }
  const card = async p => { const t = await p.evaluate(() => document.body.innerText); const i = t.indexOf('個邀約'); return t.slice(i).split('\n').slice(0, 4).join('\n') }
  const rest = p => p.evaluate(() => JSON.stringify(window.__db.users[0].tag_settings.meet_rest || {}))

  // A. 核桃（陳泓宇 大四）在最前；記住今天推薦了他
  const extra = () => { const d = window.__db; d.contacts.push({ id:'q1', user_id:'u', name:'周小志', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }, { id:'q2', user_id:'u', name:'吳大明', egg_type:'茶葉蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-40) }, { id:'q3', user_id:'u', name:'鄭小芬', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); }
  let p = await open('/lhome', extra)
  let t = await card(p)
  ok(t.includes('陳泓宇') && t.includes('他自己說想了解（大四・主動來問）'), '核桃排前面：' + t.split('\n').slice(0, 3).join('/'))
  ok(t.includes('可以這樣問：「') && /週.下午還是週.晚上/.test(t), '卡片有 CD 說法（兩個時間選一個）')
  ok((await rest(p)).includes('"w1"'), '記住今天推薦了陳泓宇 ' + await rest(p))
  ok(await p.evaluate(() => window.__db.users[0].tag_settings.daily_mode === 'std'), '沒蓋掉其他設定')
  await p.screenshot({ path: __dirname + '/shots/m1_home.png', fullPage: false })
  // 換一位 → 換到不同來源
  await p.getByRole('button', { name: '換一位' }).click(); await p.waitForTimeout(800)
  t = await card(p)
  ok(!t.includes('陳泓宇') && !t.includes('他自己說想了解'), '換一位換到別類：' + t.split('\n').slice(0, 3).join('/'))
  const r2 = await rest(p); ok(r2.includes('"w1"') && (r2.match(/2026/g) || []).length === 2, '兩位都記住了 ' + r2)
  await p.context().close()

  // B. 昨天推薦過陳泓宇、沒去約 → 今天休息
  p = await open('/lhome', () => { const d = window.__db; d.contacts.push({ id:'q1', user_id:'u', name:'周小志', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }, { id:'q2', user_id:'u', name:'吳大明', egg_type:'茶葉蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-40) }, { id:'q3', user_id:'u', name:'鄭小芬', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); window.__db.users[0].tag_settings.meet_rest = { w1: window.__add(-1) } })
  t = await card(p); ok(!t.includes('陳泓宇'), '昨天推薦過的今天休息：' + t.split('\n').slice(0, 3).join('/'))
  ok((await rest(p)).includes('"w1":"' + (await p.evaluate(() => window.__add(-1))) + '"'), '休息紀錄沒被改掉 ' + await rest(p))
  await p.context().close()
  // 4 天前推薦過 → 回來
  p = await open('/lhome', () => { const d = window.__db; d.contacts.push({ id:'q1', user_id:'u', name:'周小志', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }, { id:'q2', user_id:'u', name:'吳大明', egg_type:'茶葉蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-40) }, { id:'q3', user_id:'u', name:'鄭小芬', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); window.__db.users[0].tag_settings.meet_rest = { w1: window.__add(-4) } })
  t = await card(p); ok(t.includes('陳泓宇'), '休息完 3 天會再出現')
  await p.context().close()

  // C. 見過面還沒約下一次排最前
  p = await open('/lhome', () => { const d = window.__db; d.contacts.push({ id:'q1', user_id:'u', name:'周小志', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }, { id:'q2', user_id:'u', name:'吳大明', egg_type:'茶葉蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-40) }, { id:'q3', user_id:'u', name:'鄭小芬', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); window.__db.contact_logs.push({ id: 'mx', user_id: 'u', contact_id: 'q3', date: window.__add(-3), kind: 'meet', note: '喝咖啡' }) })
  t = await card(p); ok(t.includes('鄭小芬') && /\d+\/\d+ 見過，還沒約下一次/.test(t) && t.includes('你最喜歡的是哪部分'), '見過面還沒約下次 → 最前：' + t.split('\n').slice(0, 3).join('/'))
  await p.context().close()
  // 試用品
  p = await open('/lhome', () => { const d = window.__db; d.contacts.push({ id:'q1', user_id:'u', name:'周小志', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-2) }, { id:'q2', user_id:'u', name:'吳大明', egg_type:'茶葉蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-40) }, { id:'q3', user_id:'u', name:'鄭小芬', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); const w1 = window.__db.contacts.find(c => c.id === 'w1'); w1.need_level = null; w1.interest_level = null; window.__db.sample_tracking.push({ id: 's1', user_id: 'u', contact_id: 'q2', product_name: '纖體奶昔', share_date: window.__add(-5), result: null, followup_3_done: false }) })
  t = await card(p); ok(t.includes('吳大明') && t.includes('試用品給了 5 天，問問用得怎樣'), '試用品待跟進 → 推薦：' + t.split('\n').slice(0, 3).join('/'))
  await p.context().close()
  // 記互動時選了一對一會談 → 算聽過說明；邀約紀錄就算有工具也不算
  p = await open('/lhome', () => { const d = window.__db; d.contacts.push({ id:'q2', user_id:'u', name:'吳大明', egg_type:'茶葉蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-40) }, { id:'q3', user_id:'u', name:'鄭小芬', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); window.__db.contact_logs.push({ id: 'tx', user_id: 'u', contact_id: 'q2', date: window.__add(-3), kind: null, tool: '一對一會談', note: '講了計劃' }, { id: 'ty', user_id: 'u', contact_id: 'q3', date: window.__add(-1), kind: 'invite_wait', tool: '一對一會談', note: '邀了' }) })
  t = await card(p); ok(t.includes('吳大明') && /\d+\/\d+ 一對一會談後，還沒約下一次/.test(t), '一對一會談後還沒約 → 最前：' + t.split('\n').slice(0, 3).join('/'))
  await p.getByRole('button', { name: '換一位' }).click(); await p.waitForTimeout(800)
  t = await card(p); ok(t.includes('陳泓宇') && t.includes('他自己說想了解'), '換一位 → 核桃（第二類）：' + t.split('\n').slice(0, 3).join('/'))
  await p.context().close()
  p = await open('/lhome', () => { const d = window.__db; d.contacts.push({ id:'q3', user_id:'u', name:'鄭小芬', egg_type:'荷包蛋', is_archived:false, source:null, created_at:'2026-01-01T00:00:00Z', last_contact_date: window.__add(-20) }); d.contact_logs.push({ id: 'ty', user_id: 'u', contact_id: 'q3', date: window.__add(-1), kind: 'invite_wait', tool: '一對一會談', note: '邀了' }) })
  t = await card(p); ok(!t.includes('鄭小芬') && t.includes('陳泓宇'), '邀約紀錄帶工具不算見過面：' + t.split('\n').slice(0, 3).join('/'))
  await p.context().close()
  // 名單超過 200 位：最近聊過的人也讀得到（以前只讀最久沒聯絡的 200 位）
  p = await open('/lhome', () => { const d = window.__db; for (let i = 0; i < 260; i++) d.contacts.push({ id: 'zz' + i, user_id: 'u', name: '老朋友' + i, egg_type: '生雞蛋', is_archived: false, source: null, created_at: '2025-02-01T00:00:00Z', last_interacted_at: '2025-03-01T00:00:00Z' }); d.contacts.find(c => c.id === 'w1').need_level = null; d.contacts.find(c => c.id === 'w1').interest_level = null; d.contacts.find(c => c.id === 'w2').interest_level = null; d.contacts.find(c => c.id === 'w2').last_interacted_at = new Date().toISOString() })
  t = await card(p); ok(/陳泓宇|張雅婷/.test(t) && /才聊過，趁熱約/.test(t), '名單 260+ 位：最近聊過的人照樣推薦：' + t.split('\n').slice(0, 3).join('/'))
  await p.context().close()

  // D. 人的頁面：記一筆在最上面；工具點了才展開；三個分頁
  p = await open('/contacts/c1', () => { window.__db.contact_stage_history = [] })
  const order = await p.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder^="今天跟他發生了什麼事"]')
    const next = [...document.querySelectorAll('div')].find(d => d.textContent.trim().startsWith('下一次'))
    const logsHead = [...document.querySelectorAll('span')].find(s => s.textContent.includes('最近'))
    const y = e => e ? e.getBoundingClientRect().top + window.scrollY : -1
    return { ta: y(ta), next: y(next), log: y(logsHead), vh: window.innerHeight }
  })
  ok(order.ta > 0 && order.ta < order.vh && order.ta < order.next && order.next < order.log, '記一筆在第一個畫面、比下一次和紀錄都上面 ' + JSON.stringify(order))
  t = await p.evaluate(() => document.body.innerText)
  ok(!t.includes('用了什麼工具') && !t.includes('消費狀況') && !t.includes('合作意願'), '沒點之前：工具收起來，進度不在這頁')
  ok(t.includes('建議：') && t.includes('依據：荷包蛋'), '建議縮成一行，依據還在')
  await p.screenshot({ path: __dirname + '/shots/m2_person_top.png' })
  await p.getByPlaceholder('今天跟他發生了什麼事？（選填）').click(); await p.waitForTimeout(300)
  t = await p.evaluate(() => document.body.innerText)
  ok(t.includes('用了什麼工具') && t.includes('記成重點'), '點輸入框 → 展開工具和記成重點')
  await p.getByPlaceholder('今天跟他發生了什麼事？（選填）').fill('聊了換工作的事')
  await p.getByRole('button', { name: '一對一會談' }).first().click()
  await p.getByRole('button', { name: '新增', exact: true }).click(); await p.waitForTimeout(800)
  ok(await p.evaluate(() => window.__db.contact_logs.some(l => l.contact_id === 'c1' && l.note === '聊了換工作的事' && l.tool === '一對一會談')), '記一筆存好（含工具）')
  t = await p.evaluate(() => document.body.innerText)
  ok(!t.includes('用了什麼工具'), '存完自動收起來')
  // 進度分頁
  await p.getByRole('button', { name: '進度', exact: true }).click(); await p.waitForTimeout(400)
  t = await p.evaluate(() => document.body.innerText)
  ok(t.includes('消費狀況') && t.includes('合作意願') && t.includes('試用品') && t.includes('試做'), '進度分頁：試做、試用品、消費狀況、合作意願都在')
  ok(await p.getByPlaceholder('今天跟他發生了什麼事？（選填）').count() === 0, '進度分頁沒有記一筆')
  await p.screenshot({ path: __dirname + '/shots/m3_progress.png' })
  await p.getByRole('button', { name: '調整 ›' }).click(); await p.getByRole('button', { name: '考慮中' }).click(); await p.waitForTimeout(500)
  ok(await p.evaluate(() => window.__db.contacts.find(c => c.id === 'c1').referral_stage === '考慮中'), '進度分頁裡改合作意願照常')
  await p.getByRole('button', { name: '資料', exact: true }).click(); await p.waitForTimeout(300)
  ok(await p.getByRole('button', { name: '進度', exact: true }).count() === 1 && !(await p.evaluate(() => document.body.innerText)).includes('消費狀況'), '資料分頁照舊（沒有進度內容）')
  await p.context().close()

  // E. 試用品給了 5 天還沒問感受 →「進度」亮小點
  p = await open('/contacts/c1', () => { window.__db.sample_tracking.push({ id: 's2', user_id: 'u', contact_id: 'c1', product_name: '纖體奶昔', share_date: window.__add(-5), result: null, followup_3_done: false }) })
  ok(await p.locator('[aria-label="有試用品可以問問了"]').count() === 1, '進度分頁亮小點')
  await p.context().close()
  p = await open('/contacts/c1', () => { window.__db.sample_tracking.push({ id: 's3', user_id: 'u', contact_id: 'c1', product_name: '纖體奶昔', share_date: window.__add(-1), result: null, followup_3_done: false }) })
  ok(await p.locator('[aria-label="有試用品可以問問了"]').count() === 0, '才給 1 天不亮')
  await p.context().close()

  // F. 時機未到
  p = await open('/contacts/c1')
  await p.getByRole('button', { name: '時機未到，先不排進今天' }).click(); await p.waitForTimeout(500)
  t = await p.evaluate(() => document.body.innerText)
  ok(t.includes('恢復排進今天') && await p.evaluate(() => window.__db.contacts.find(c => c.id === 'c1').is_muted === true), '時機未到按鈕照常（移到紀錄下面）')
  await p.context().close()

  // G. 顧客頁裡的互動（沒有分頁）：記一筆和進度都在
  p = await open('/customers/k1')
  const tabs = await p.getByRole('button', { name: /互動/ }).all()
  for (const x of tabs) { const tx = (await x.textContent()).trim(); if (tx === '互動' || tx === '互動紀錄') { await x.click(); break } }
  await p.waitForTimeout(1000)
  t = await p.evaluate(() => document.body.innerText)
  ok(await p.getByPlaceholder('今天跟他發生了什麼事？（選填）').count() === 1 && t.includes('消費狀況') && t.includes('合作意願'), '顧客頁的互動：記一筆和進度都在')
  await p.screenshot({ path: __dirname + '/shots/m4_customer.png', fullPage: true })
  await p.context().close()

  ok(errs.length === 0, '沒有頁面錯誤 ' + errs.join(' | '))
  await b.close(); process.exit(fail)
})()
