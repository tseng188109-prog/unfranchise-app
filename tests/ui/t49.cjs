// 更新後的新功能小卡、設定 → 整理居住地區的寫法
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
  const text = () => p.evaluate(() => document.body.innerText)
  // ── 新功能小卡 ──
  await p.goto('http://127.0.0.1:8767/?nocheer=1&whatsnew=1'); await p.waitForTimeout(300)
  await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(4200)
  let t = await text()
  ok(t.includes('這次更新了什麼') && t.includes('分享成圖片，貼到群組') && t.includes('你的細節'), '更新後第一次打開首頁：跳出「這次更新了什麼」')
  await p.screenshot({ path: __dirname + '/shots/t49_whatsnew.png' })
  await p.getByRole('dialog', { name: '這次更新了什麼' }).getByRole('button', { name: '知道了' }).click(); await p.waitForTimeout(300)
  ok(!(await text()).includes('這次更新了什麼'), '按知道了就關掉')
  await p.goto('http://127.0.0.1:8767/?nocheer=1&whatsnew=1'); await p.waitForTimeout(300)
  await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(4200)
  ok(!(await text()).includes('這次更新了什麼'), '同一台裝置不會再跳第二次')
  // ── 整理居住地區的寫法 ──
  await p.evaluate(() => {
    const cs = window.__db.contacts
    const put = (i, r) => { if (cs[i]) cs[i].region = r }
    put(0, '台北大安'); put(1, '臺北市大安區')
    cs.push({ id: 'r1', user_id: 'u', name: '甲', region: '台北市大安區', is_archived: false }, { id: 'r2', user_id: 'u', name: '乙', region: '大安區', is_archived: false },
      { id: 'r3', user_id: 'u', name: '丙', region: '新加坡', is_archived: false }, { id: 'r4', user_id: 'u', name: '丁', region: '台中', is_archived: false })
  })
  await p.evaluate(() => window.__nav('/settings')); await p.waitForTimeout(1200)
  ok((await text()).includes('整理居住地區的寫法'), '設定裡有「整理居住地區的寫法」')
  await p.getByRole('button', { name: /整理居住地區的寫法/ }).click(); await p.waitForTimeout(1200)
  t = await text()
  ok(t.includes('台北大安 · 1 位') && t.includes('臺北市大安區 · 1 位') && t.includes('統一成「台北市大安區」'), '列出台北大安、臺北市大安區，可以統一成台北市大安區')
  ok(t.includes('統一成「台中市」'), '「台中」可以統一成台中市')
  ok(!t.split('\n').some(l => l.trim() === '大安區 · 1 位') && !t.includes('新加坡'), '只寫「大安區」（台北台中都有）和國外的不列出來')
  await p.screenshot({ path: __dirname + '/shots/t49_regions.png' })
  await p.getByRole('button', { name: '統一成「台北市大安區」' }).click(); await p.waitForTimeout(1000)
  const regs = await p.evaluate(() => window.__db.contacts.map(c => c.region).filter(Boolean))
  ok(regs.filter(r => r === '台北市大安區').length === 3 && !regs.includes('台北大安') && !regs.includes('臺北市大安區'), '按統一：三位都變成台北市大安區')
  ok(regs.includes('大安區') && regs.includes('新加坡'), '其他的沒被動到')
  t = await text()
  ok(t.includes('已經改好：台北大安、臺北市大安區 → 台北市大安區') && !t.includes('統一成「台北市大安區」'), '改好之後說一聲，那一組消失')
  await p.getByRole('button', { name: '統一成「台中市」' }).click(); await p.waitForTimeout(1000)
  ok((await text()).includes('名單裡的地區寫法都已經一致了。'), '都整理完：說已經一致了')
  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail || errs.length ? 1 : 0)
})()
