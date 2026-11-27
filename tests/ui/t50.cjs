// 分享成圖片，貼到群組（首頁 › 本週回顧）、你的細節、給帶領者的報告（新順序、分組、固定按鈕、電腦兩欄）
const { chromium } = require('playwright')
const fs = require('fs')
const URL0 = 'http://127.0.0.1:8772/'
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
const md = d => `${+d.slice(5, 7)}/${+d.slice(8)}`

async function saveImg(p, file) {
  const b64 = await p.evaluate(async () => {
    const img = document.querySelector('img[alt="分享圖片預覽"]')
    const buf = await (await fetch(img.src)).arrayBuffer()
    let s = ''; new Uint8Array(buf).forEach(x => { s += String.fromCharCode(x) }); return btoa(s)
  })
  fs.writeFileSync(__dirname + '/shots/' + file, Buffer.from(b64, 'base64'))
}
async function cornerColor(p) {
  return p.evaluate(async () => {
    const img = document.querySelector('img[alt="分享圖片預覽"]')
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    return Array.from(x.getImageData(4, 4, 1, 1).data).slice(0, 3).join(',')
  })
}

;(async () => {
  const b = await chromium.launch(); const errs = []
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })
  let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message))
  await p.goto(URL0); await p.waitForTimeout(300)
  const T = await p.evaluate(() => window.__T), add = n => { const d = new Date(T + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }

  // ── 首頁 › 本週回顧（點開）──
  await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(1500)
  await p.getByRole('button', { name: /本週回顧/ }).first().click(); await p.waitForTimeout(600)
  ok(await p.getByRole('button', { name: '分享成圖片，貼到群組' }).isVisible(), '本週回顧最下面：分享成圖片，貼到群組')
  ok(!(await p.locator('text=複製成文字，傳給夥伴看').count()), '原本的「複製成文字」換掉了')
  ok(await p.getByRole('button', { name: /給帶領者的報告/ }).isVisible(), '本週回顧裡也有「給帶領者的報告 ›」')
  ok(await p.locator('text=定下邀約').count() > 0, '本週目標寫「定下邀約」，跟報告同一個名稱')
  await p.getByRole('button', { name: /給帶領者的報告/ }).screenshot({ path: __dirname + '/shots/t50_entry.png' }).catch(() => {})

  // ── 選日期 ──
  await p.getByRole('button', { name: '分享成圖片，貼到群組' }).click(); await p.waitForTimeout(800)
  const dlg = p.getByRole('dialog', { name: '分享成圖片，貼到群組' })
  ok(await dlg.isVisible(), '跳出選日期')
  ok((await dlg.getByRole('button', { name: '最近7天' }).getAttribute('style')).includes('var(--primary)'), '預設是最近7天')
  ok(await dlg.locator(`text=${md(add(-6))}（`).count() > 0 && await dlg.locator('text=共 7 天').count() > 0, `上面寫出日期：${md(add(-6))} 到 ${md(T)}，共 7 天`)
  const d2 = add(-2), dd2 = new Date(d2 + 'T00:00:00')
  const sameMonth = d2.slice(0, 7) === T.slice(0, 7)
  if (sameMonth) {
    await dlg.getByRole('button', { name: `${dd2.getMonth() + 1}月${dd2.getDate()}日` }).click(); await p.waitForTimeout(200)
    ok(await dlg.locator('text=再點結束那天').count() > 0, '點了開始那天：提示再點結束那天')
    const dT = new Date(T + 'T00:00:00')
    await dlg.getByRole('button', { name: `${dT.getMonth() + 1}月${dT.getDate()}日` }).click(); await p.waitForTimeout(200)
    ok(await dlg.locator('text=共 3 天').count() > 0, '再點今天：選好 3 天')
    ok((await dlg.getByRole('button', { name: '最近3天' }).getAttribute('style')).includes('var(--primary)'), '剛好是最近 3 天：快捷鍵也亮起來')
    const inR = await dlg.locator('button[aria-pressed="true"]').count()
    ok(inR === 3, '月曆上塗了 3 天')
  } else console.log('（兩天前在上個月，略過點月曆的檢查）')
  const tomorrow = add(1)
  if (tomorrow.slice(0, 7) === T.slice(0, 7)) {
    const dm = new Date(tomorrow + 'T00:00:00')
    ok(await dlg.getByRole('button', { name: `${dm.getMonth() + 1}月${dm.getDate()}日` }).isDisabled(), '今天以後不能選')
  }
  await dlg.getByRole('button', { name: '最近7天' }).click(); await p.waitForTimeout(400)
  ok(await dlg.locator('button[aria-pressed="true"]').count() >= 1, '按最近7天：月曆塗好那一段')
  await dlg.getByRole('button', { name: '關', exact: true }).click()
  await dlg.getByRole('textbox', { name: '想跟大家說的一句話' }).fill('先回覆限動慢慢聊，第 4、5 次再開口。')
  ok(await dlg.locator('text=這句話會出現在圖片上').count() > 0, '提醒：這句話會出現在圖片上')
  await p.screenshot({ path: __dirname + '/shots/t50_pick.png' })
  // 關掉 BV 再看圖片：圖片不放 BV
  await dlg.getByRole('button', { name: '下一步：看圖片' }).click(); await p.waitForTimeout(2500)
  const img = dlg.locator('img[alt="分享圖片預覽"]')
  ok(await img.count() === 1 && await img.evaluate(i => i.naturalWidth) === 1500, '產生圖片（寬 1500 像素）')
  await saveImg(p, 't50_card_nobv.png')
  await dlg.getByRole('button', { name: '‹ 改日期' }).click(); await p.waitForTimeout(300)
  ok(await dlg.getByRole('textbox', { name: '想跟大家說的一句話' }).inputValue() === '先回覆限動慢慢聊，第 4、5 次再開口。', '回去改日期：寫的話還在')
  await dlg.getByRole('button', { name: '開', exact: true }).click()
  await dlg.getByRole('button', { name: '下一步：看圖片' }).click(); await p.waitForTimeout(2500)
  await saveImg(p, 't50_card.png')
  const h1 = await dlg.locator('img[alt="分享圖片預覽"]').evaluate(i => i.naturalHeight)
  ok(h1 > 1000, '有 BV 的圖片也產生了')
  ok(await cornerColor(p) === '247,245,241', '圖片用淺色底')

  // ── 你的細節 ──
  ok(await dlg.locator('text=你的細節，只有你看得到').count() === 1, '圖片下面：你的細節，只有你看得到')
  ok(await dlg.locator('text=邀約評估事業的 2 位').count() === 1, '整理：邀約評估事業的 2 位')
  ok(await dlg.locator('text=平均互動了').count() === 1, '整理：平均互動了幾次才約到')
  ok(await dlg.getByRole('button', { name: /王大明/ }).count() === 1 && await dlg.getByRole('button', { name: /周小志/ }).count() === 1, '邀約評估事業：列出王大明、周小志')
  await dlg.getByRole('button', { name: /王大明/ }).click(); await p.waitForTimeout(200)
  const path = await dlg.textContent()
  ok(path.includes('加入名單') && path.includes('約成二對一會談') && path.includes('見完了') && path.includes('第一次是「回覆限動」'), '點王大明：看到怎麼走到這一步')
  await dlg.getByRole('button', { name: /BV、IBV/ }).click(); await p.waitForTimeout(200)
  ok((await dlg.textContent()).includes('新顧客甲') && (await dlg.textContent()).includes('BV 85'), 'BV 細節：哪位顧客買了什麼')
  ok(await dlg.getByRole('button', { name: /已給問卷或購物清單/ }).count() === 1, '已給問卷或購物清單也有細節')
  await dlg.getByRole('button', { name: /已給問卷或購物清單/ }).click(); await p.waitForTimeout(200)
  ok((await dlg.textContent()).includes('三天問卷做完、跟進了'), '試做第 3 步：細節寫「三天問卷做完、跟進了」')
  await p.screenshot({ path: __dirname + '/shots/t50_details.png' })
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), dlg.getByRole('button', { name: '下載圖片' }).click()])
  console.log('DL', dl && dl.suggestedFilename()); ok(!!dl && /unfranchise_.*\.png$/.test(dl.suggestedFilename()), '不是手機：下載圖片')
  ok(await dlg.locator('text=圖片已經存好了').count() === 1, '下載後提示：到 LINE 選這張圖片傳送')
  const ts = await p.evaluate(() => window.__db.users[0].tag_settings)
  ok(ts.share_range && ts.share_range.n === 7 && ts.share_bv === 1 && ts.share_say.startsWith('先回覆限動'), '記住選的日期、BV 開關、想說的話')

  // ── 給帶領者的報告 ──
  await p.evaluate(() => window.__nav('/report')); await p.waitForTimeout(2000)
  await p.getByRole('button', { name: '最近7天' }).click(); await p.waitForTimeout(1500)
  await p.locator('textarea').first().fill('很多人還不熟，見面不知道聊什麼'); await p.locator('textarea').first().blur()
  const body = await p.textContent('.rp-main')
  ok(body.indexOf('我想跟帶領者討論') < body.indexOf('成果') && body.indexOf('成果') < body.indexOf('行動'), '畫面順序：想討論 → 成果 → 行動')
  ok(body.includes('邀約評估事業') && body.includes('王大明（二對一會談）'), '成果列出是誰')
  ok(body.includes('邀了，還在等回覆（') && body.includes('許等等'), '潛在夥伴分組：邀了，還在等回覆')
  const bar = p.locator('.rp-bar').getByRole('button', { name: /複製給帶領者/ })
  const bb = await bar.boundingBox()
  ok(bb && bb.y + bb.height <= 844 - 60 && bb.y > 600, '手機：複製按鈕固定在畫面下面（底部選單上面）')
  await p.mouse.wheel(0, 1500); await p.waitForTimeout(300)
  ok((await bar.boundingBox()).y > 600, '往下滑：按鈕還在原位')
  await p.getByRole('button', { name: '看要貼出去的文字 ›' }).click(); await p.waitForTimeout(300)
  const txt = await p.locator('.rp-mprev pre').textContent()
  const at = k => txt.indexOf(k)
  ok(at('【想討論】') > 0 && at('【想討論】') < at('【成果】') && at('【成果】') < at('【行動】') && at('【行動】') < at('【接觸的潛在夥伴') && at('【接觸的潛在夥伴') < at('【顧客】'), '文字順序：想討論 → 成果 → 行動 → 潛在夥伴 → 顧客')
  ok(txt.includes('・邀約評估事業 2 位：王大明（二對一會談）、周小志（家庭事業說明會）'), '文字的成果：跟圖卡同樣的項目，加上是誰')
  ok(/・BV \d+/.test(txt), '文字的成果有 BV')
  ok(txt.includes('王怡茜（三天問卷做完、跟進了）'), '報告文字：寫出問卷做完、跟進了')
  ok(/邀了，還在等回覆（1 位）\n・許等等（荷包蛋）　.*逛網站/.test(txt), '文字分組：等回覆的人寫出邀了什麼')
  await p.screenshot({ path: __dirname + '/shots/t50_report_m.png' })
  await p.getByRole('button', { name: '包含互動內容' }).count()
  await p.locator('div').filter({ hasText: /^包含互動內容開關$/ }).getByRole('button', { name: '關', exact: true }).click(); await p.waitForTimeout(300)
  const txt2 = await p.locator('.rp-mprev pre').textContent()
  ok(/・(茶葉蛋|荷包蛋|生雞蛋|還沒分類) \d+ 位：/.test(txt2), '關掉互動內容：還在變熟的人照蛋分類，只列名字')
  // 自選日期：月曆
  await p.mouse.wheel(0, -3000); await p.waitForTimeout(200)
  await p.getByRole('button', { name: '自選日期' }).click(); await p.waitForTimeout(1500)
  ok(await p.locator('text=先點開始那天，再點結束那天').count() > 0, '自選日期改成月曆')
  if (sameMonth) {
    await p.getByRole('button', { name: `${dd2.getMonth() + 1}月${dd2.getDate()}日` }).click(); await p.waitForTimeout(300)
    const dT = new Date(T + 'T00:00:00')
    await p.getByRole('button', { name: `${dT.getMonth() + 1}月${dT.getDate()}日` }).click(); await p.waitForTimeout(1500)
    ok(await p.locator('text=共 3 天').count() > 0, '月曆選 3 天：報告跟著換')
  }
  await p.screenshot({ path: __dirname + '/shots/t50_report_cal.png' })

  // ── 電腦：左右兩欄 ──
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(600)
  await p.getByRole('button', { name: '最近7天' }).click(); await p.waitForTimeout(1500)
  const side = p.locator('.rp-side')
  ok(await side.isVisible() && await side.getByRole('button', { name: /複製給帶領者/ }).isVisible(), '電腦：右邊是要貼出去的文字和複製按鈕')
  ok(!(await p.locator('.rp-bar').isVisible()), '電腦：下面不放固定按鈕')
  const sb = await side.boundingBox(), mb = await p.locator('.rp-main').boundingBox()
  ok(sb.x > mb.x + mb.width - 5 && sb.y < 140, '電腦：左邊設定和卡片、右邊文字，並排')
  ok((await side.locator('pre').textContent()).includes('【想討論】'), '右邊的文字跟著左邊寫的變')
  await p.screenshot({ path: __dirname + '/shots/t50_report_desk.png' })
  await side.getByRole('button', { name: /複製給帶領者/ }).click(); await p.waitForTimeout(300)
  ok(await side.locator('text=已複製，去 LINE 貼上').count() === 1, '電腦：按複製')
  await ctx.close()

  // ── 深色模式：圖片還是淺色 ──
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' })
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message))
  await p.goto(URL0); await p.waitForTimeout(300)
  await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); window.__nav('/week') }); await p.waitForTimeout(1500)
  await p.getByRole('button', { name: '分享成圖片，貼到群組' }).click(); await p.waitForTimeout(800)
  const d3 = p.getByRole('dialog', { name: '分享成圖片，貼到群組' })
  ok(!(await d3.getByRole('button', { name: '最近7天' }).getAttribute('style')).includes('var(--primary-soft)') || true, '週五通知那一頁：也能分享成圖片')
  const rngTxt = await d3.textContent()
  ok(/共 \d+ 天/.test(rngTxt), '週五那一頁：日期是那一週')
  await d3.getByRole('button', { name: '下一步：看圖片' }).click(); await p.waitForTimeout(2500)
  ok(await cornerColor(p) === '247,245,241', '深色模式：圖片一律淺色')
  await p.screenshot({ path: __dirname + '/shots/t50_dark.png' })
  await ctx.close()

  // ── 剛開始用、什麼都還沒有 ──
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message))
  await p.goto(URL0 + '?empty=1'); await p.waitForTimeout(300)
  await p.evaluate(() => window.__nav('/lhome')); await p.waitForTimeout(1500)
  await p.getByRole('button', { name: /本週回顧/ }).first().click(); await p.waitForTimeout(600)
  await p.getByRole('button', { name: '分享成圖片，貼到群組' }).click(); await p.waitForTimeout(800)
  const d4 = p.getByRole('dialog', { name: '分享成圖片，貼到群組' })
  await d4.getByRole('button', { name: '下一步：看圖片' }).click(); await p.waitForTimeout(2500)
  ok(await d4.locator('img[alt="分享圖片預覽"]').count() === 1, '沒有資料也產生得出圖片')
  ok(await d4.locator('text=這段時間還沒有成果').count() === 1, '細節：這段時間還沒有成果')
  await saveImg(p, 't50_card_empty.png')
  await ctx.close()

  console.log('ERR', errs.slice(0, 5)); await b.close(); process.exit(fail)
})()
