// 互動名單、顧客：每一列右邊有 ⋮，點了跳出選單（釘選、封存）；原本的「按住」也還在
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  for (const [page, table, who] of [['/contacts', 'contacts', '王怡茜'], ['/customers', 'customers', '黃先生']]) {
    for (const [tag, ctx] of [['手機', { ...devices['iPhone 14'] }], ['電腦', { viewport: { width: 1440, height: 900 } }]]) {
      const c = await b.newContext(ctx); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
      await p.goto('http://127.0.0.1:8771/'); await p.waitForTimeout(300)
      await p.evaluate(x => window.__nav(x), page); await p.waitForTimeout(2000)
      const name = page === '/contacts' ? '互動名單' : '顧客'
      const dots = p.getByRole('button', { name: `${who} 的更多選項` })
      ok(await dots.count() === 1 && await dots.isVisible(), `${name}${tag}：${who} 那一列右邊有 ⋮`)
      const n = await p.getByRole('button', { name: / 的更多選項$/ }).count()
      ok(n >= 2, `${name}${tag}：每一列都有（${n} 個）`)
      await dots.click(); await p.waitForTimeout(400)
      const t = await p.evaluate(() => document.body.innerText)
      ok(t.includes('釘選到最上面') && t.includes('封存'), `${name}${tag}：點 ⋮ 跳出選單`)
      ok(!(await p.evaluate(() => location.pathname)).match(/\/(contacts|customers)\/./), `${name}${tag}：點 ⋮ 不會跑進他的頁面`)
      await p.getByRole('button', { name: '釘選到最上面' }).click(); await p.waitForTimeout(600)
      const up = await p.evaluate(t => window.__ops.filter(o => o[0] === 'update' && o[1] === t).map(o => JSON.stringify(o[2])), table)
      ok(up.some(x => x.includes('"is_pinned":true')), `${name}${tag}：按「釘選到最上面」有存起來`)
      await c.close()
    }
  }
  // 原本的按住也還在（手機用手指、電腦用滑鼠）
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage()
  await p.goto('http://127.0.0.1:8771/'); await p.waitForTimeout(300)
  await p.evaluate(() => window.__nav('/contacts')); await p.waitForTimeout(2000)
  const row = p.getByText('王怡茜', { exact: true }).first(); const bx = await row.boundingBox()
  await p.mouse.move(bx.x + 5, bx.y + 5); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(300)
  ok((await p.evaluate(() => document.body.innerText)).includes('釘選到最上面'), '按住 0.5 秒一樣跳出選單')
  await c.close()
  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail || errs.length ? 1 : 0)
})()
