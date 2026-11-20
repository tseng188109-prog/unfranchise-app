const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, q = '?seen=1', ctx = { ...devices['iPhone 14'] }) {
    const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8766/' + q); await p.waitForTimeout(300); await p.evaluate(x => window.__nav(x), path); await p.waitForTimeout(2500); return p
  }
  const toast = p => p.evaluate(() => { const e = document.querySelector('[role=status]'); return e ? e.innerText.replace(/\n/g, ' ') : '' })
  const anim = async p => { const l = p.locator('[role=status] [data-anim]'); return (await l.count()) ? l.first().getAttribute('data-anim') : null }
  const dlg = p => p.locator('body')
  const waitToast = async (p, ms = 1500) => { for (let i = 0; i < ms / 100; i++) { const t = await toast(p); if (t) return t; await p.waitForTimeout(100) } return '' }
  const gone = async p => { for (let i = 0; i < 40; i++) { if (!(await toast(p))) return; await p.waitForTimeout(100) } }
  async function quickLog(p, name, note) {
    await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(1200)
    await p.getByRole('button', { name: new RegExp(name) }).first().click(); await p.waitForTimeout(700)
    await p.getByPlaceholder('今天跟他發生了什麼事？（選填）').fill(note)
    await p.getByRole('button', { name: '新增', exact: true }).click()
  }

  // 0. 只打開「互動名單」頁（不經過首頁）也會先記下今天的數字
  let p = await open('/contacts')
  ok(await p.evaluate(() => !!sessionStorage.getItem('ufa_312_seen_' + window.__T)), '一打開 App 就記下今天的數字')
  await p.context().close()

  p = await open('/lhome')
  // 1. 從首頁 3-1-2 點王怡茜，記一筆互動
  await quickLog(p, '王怡茜', '聊了她最近的工作')
  let t = await waitToast(p)
  ok(t.includes('互動 +1') && t.includes('罐子搖了一下'), '首頁記互動：小鼓勵＋罐子搖了一下 → ' + t)
  ok(await anim(p) === 'wobble', '小罐子在搖')
  await p.screenshot({ path: __dirname + '/shots/k1_toast_talk.png' })
  const t0 = Date.now(); await gone(p); const lasted = Date.now() - t0
  ok(lasted > 2000 && lasted < 3600, '小鼓勵留 3 秒左右 (' + lasted + 'ms 之後消失)')

  // 2. 同一位今天再記一次：數字不變，還是有反應
  await quickLog(p, '王怡茜', '晚上又傳訊息')
  t = await waitToast(p)
  ok(t.includes('罐子搖了一下') && t.includes('今天已經算過他了'), '同一位再記一次 → ' + t)
  ok(await anim(p) === 'wobble', '同一位再記：小罐子也搖')
  await p.screenshot({ path: __dirname + '/shots/k2_toast_again.png' }); await gone(p)

  // 3. 顧客（陳美玲）：不說罐子
  await quickLog(p, '陳美玲', '問她用得怎樣')
  t = await waitToast(p)
  ok(t.includes('記好了') && !t.includes('罐子'), '顧客關懷不說罐子 → ' + t)
  ok(await anim(p) === null, '顧客：沒有小罐子')
  await gone(p)

  // 4. 首頁「記一次邀約」陳泓宇 → 約成了
  await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(1200)
  await p.getByRole('button', { name: '記一次邀約' }).first().click(); await p.waitForTimeout(500)
  await p.getByRole('button', { name: '約成了', exact: true }).last().click(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: '選日期', exact: true }).last().click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: '28', exact: true }).last().click()
  await p.waitForTimeout(200); await dlg(p).getByRole('button', { name: '記下來' }).click()
  t = await waitToast(p)
  ok(t.includes('開口了，就算數') && t.includes('罐子搖了一下'), '邀約約成 → ' + t)
  await gone(p)

  // 5. 沒約成也有反應（張雅婷）
  await p.evaluate(() => window.__nav('/contacts/w2')); await p.waitForTimeout(1200)
  await p.getByRole('button', { name: '記一次邀約' }).first().click(); await p.waitForTimeout(500)
  await p.getByRole('button', { name: '沒約成', exact: true }).last().click(); await p.waitForTimeout(200)
  await dlg(p).getByRole('button', { name: '記下來' }).click()
  t = await waitToast(p)
  ok(t.includes('開口了，就算數') && t.includes('罐子搖了一下'), '邀約沒約成 → ' + t)
  await gone(p)

  // 前面已經互動 3、邀約、新名單 1/2；再加一位就做滿 → 應該跳整頁「完成了」而不是小鼓勵
  await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(1200)
  await p.getByRole('button', { name: '+ 新增' }).click(); await p.waitForTimeout(800)
  await p.getByPlaceholder('輸入姓名...').fill('許做滿')
  await p.getByRole('button', { name: '儲存並返回' }).click(); await p.waitForTimeout(1200)
  ok((await p.textContent('body')).includes('今天的 3-1-2 完成了'), '做滿那一筆：整頁完成（不跟小鼓勵搶）')
  await p.context().close()

  // 6. 首頁「+ 新增」一位新名單 → 豆子掉進罐子（另開一次，還沒做滿）
  p = await open('/lhome')
  await p.getByRole('button', { name: '+ 新增' }).click(); await p.waitForTimeout(800)
  await p.getByPlaceholder('輸入姓名...').fill('周小志')
  await p.getByRole('button', { name: '儲存並返回' }).click()
  t = await waitToast(p, 2500)
  ok(t.includes('新名單 +1') && /罐子多一顆豆・(再 \d+ 位換果醬罐|本月 \d+\/60)/.test(t), '新名單 → ' + t)
  ok(await anim(p) === 'drop', '豆子掉進罐子')
  await p.screenshot({ path: __dirname + '/shots/k3_toast_fresh.png' })
  await gone(p)

  // 7. 見完記「很有興趣」（從名單點周小志 → 興趣）→ 核桃浮上來
  const nid = await p.evaluate(() => window.__db.contacts.find(c => c.name === '周小志').id)
  await p.evaluate(x => window.__nav('/contacts/' + x), nid); await p.waitForTimeout(1200)
  await p.getByRole('button', { name: /見完了，記一下/ }).click(); await p.waitForTimeout(600)
  await p.getByRole('button', { name: '很有興趣', exact: true }).last().click()
  await p.getByRole('button', { name: '存起來' }).click(); await p.waitForTimeout(1200)
  // 這一筆剛好做滿今天 → 先整頁完成、第 7 天連續，按掉之後核桃接著跳（排隊，一個一個來）
  ok((await p.textContent('body')).includes('今天的 3-1-2 完成了'), '見完記一下做滿：先跳完成')
  // deliver-76：完成、連續天數的按鈕改成隨機一句誇自己的話，用「畫面上最後一顆按鈕」來按
  await p.locator('[role=dialog] button').last().click(); await p.waitForTimeout(400)
  if ((await p.textContent('body')).includes('天連續行動')) { await p.locator('[role=dialog] button').last().click(); await p.waitForTimeout(300) }
  let up = false; for (let i = 0; i < 70 && !up; i++) { await p.waitForTimeout(100); up = (await p.textContent('body')).includes('核桃浮上來了') }
  t = await p.textContent('body')
  ok(up && t.includes('周小志'), '見完記很有興趣 → 核桃浮上來了')
  await p.screenshot({ path: __dirname + '/shots/k4_walnut_interest.png' })
  await p.getByRole('button', { name: '好', exact: true }).click(); await p.waitForTimeout(300)

  // 8. 編輯資料把需求度改成大四（林小美以外的一位：新加一位）→ 核桃浮上來
  await p.evaluate(() => window.__db.contacts.push({ id:'e1', user_id:'u', name:'吳大明', is_archived:false, source:null, created_at:'2026-02-01T00:00:00Z', last_contact_date: window.__T }))
  await p.evaluate(() => window.__nav('/contacts/e1/edit')); await p.waitForTimeout(1200)
  await p.getByRole('button', { name: /^大四/ }).click()
  await p.getByRole('button', { name: /儲存/ }).first().click()
  up = false; for (let i = 0; i < 70 && !up; i++) { await p.waitForTimeout(100); up = (await p.textContent('body')).includes('核桃浮上來了') }
  t = await p.textContent('body'); ok(up && t.includes('吳大明') && t.includes('大四・主動來問'), '編輯改大四 → 核桃浮上來了')
  await p.getByRole('button', { name: '好', exact: true }).click(); await p.waitForTimeout(300)

  // 8b. 補記昨天約成（今天數字不變）→ 核桃還是會浮上來
  await p.evaluate(() => window.__db.contacts.push({ id:'e2', user_id:'u', name:'鄭補記', is_archived:false, source:null, created_at:'2026-02-01T00:00:00Z', last_contact_date: window.__add(-1) }))
  await p.evaluate(() => window.__nav('/contacts/e2')); await p.waitForTimeout(1200)
  await p.getByRole('button', { name: '記一次邀約' }).first().click(); await p.waitForTimeout(500)
  await p.getByRole('button', { name: /^昨天/ }).last().click()
  await p.getByRole('button', { name: '一對一會談', exact: true }).last().click()
  await p.getByRole('button', { name: '約成了', exact: true }).last().click(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: '選日期', exact: true }).last().click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: '28', exact: true }).last().click()
  await p.waitForTimeout(200); await p.getByRole('button', { name: '記下來' }).click()
  up = false; for (let i = 0; i < 70 && !up; i++) { await p.waitForTimeout(100); up = (await p.textContent('body')).includes('核桃浮上來了') }
  t = await p.textContent('body'); ok(up && t.includes('鄭補記') && t.includes('答應聽一對一會談'), '補記昨天約成一對一會談 → 核桃浮上來了')
  await p.getByRole('button', { name: '好', exact: true }).click(); await p.waitForTimeout(300)

  // 9. 匯入名單 → 換罐子
  await p.evaluate(() => window.__nav('/contacts')); await p.waitForTimeout(1500)
  await p.getByTitle('CSV 批量匯入').click(); await p.waitForTimeout(400)
  const csv = 'name\n' + Array.from({ length: 12 }, (_, i) => '匯入' + i).join('\n')
  await p.locator('input[type=file]').setInputFiles({ name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await p.waitForTimeout(600)
  await p.getByRole('button', { name: /確認匯入/ }).click()
  up = false; for (let i = 0; i < 70 && !up; i++) { await p.waitForTimeout(100); up = (await p.textContent('body')).includes('換成果醬罐了') }
  ok(up, '匯入 12 位 → 換成果醬罐了')
  await p.screenshot({ path: __dirname + '/shots/k5_import_up.png' })
  await p.context().close()

  // 10. 減少動態效果：小罐子不搖
  p = await open('/lhome', '?seen=1', { ...devices['iPhone 14'], reducedMotion: 'reduce' })
  await quickLog(p, '王怡茜', '聊聊')
  await waitToast(p)
  const an = await p.evaluate(() => { const g = document.querySelector('[role=status] .jar-wobble'); return g ? getComputedStyle(g).animationName : 'none-el' })
  ok(an === 'none', '減少動態效果時不搖 (' + an + ')')
  await p.context().close()

  // 11. 連續記很多筆：罐子最多 5 秒重算一次
  p = await open('/lhome')
  await p.waitForTimeout(5200)
  await p.evaluate(() => { window.__jarRuns = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'ufa_walnuts_seen_u') window.__jarRuns++; return o.call(this, k, v) } })
  const before = await p.evaluate(() => window.__jarRuns)
  await p.evaluate(() => { for (let i = 0; i < 6; i++) window.dispatchEvent(new CustomEvent('ufa:jar-shake')) })
  await p.waitForTimeout(1500)
  const mid = await p.evaluate(() => window.__jarRuns)
  ok(mid - before === 1, '連搖 6 次只重算 1 次 (' + (mid - before) + ')')
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('ufa:jar-shake'))); await p.waitForTimeout(1000)
  const mid2 = await p.evaluate(() => window.__jarRuns)
  await p.waitForTimeout(4500)
  const after = await p.evaluate(() => window.__jarRuns)
  ok(mid2 === mid && after - mid === 1, '5 秒內再搖：排到 5 秒後補算一次')
  await p.context().close()
  ok(errs.length === 0, '沒有頁面錯誤 ' + errs.join(' | '))
  await b.close(); process.exit(fail)
})()
