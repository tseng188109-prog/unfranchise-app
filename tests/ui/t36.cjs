// deliver-76 戰隊頁：今天的一句話、這週的好消息（鼓掌）、我收到的打氣、打氣面板、搭檔邀請
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, q = '?nocheer=1') {
    const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8767/' + q); await p.waitForTimeout(300); await p.evaluate(x => window.__nav(x), path); await p.waitForTimeout(2200); return p
  }
  const text = p => p.evaluate(() => document.body.innerText)
  const rpc = (p, n) => p.evaluate(n => window.__rpcCalls.filter(c => c[0] === n), n)

  let p = await open('/team')
  let t = await text(p)
  ok(/今天的一句話\n(成功是一種習慣，失敗也是一種習慣|永遠不要停止相信)/.test(t), '旅程卡下面有今天的一句話（不署名）')
  ok(!t.includes('JR') && !t.includes('Ridinger'), '一句話沒有署名')
  ok(t.indexOf('頭像亮起來的人這週已經動了') < t.indexOf('今天的一句話') && t.indexOf('今天的一句話') < t.indexOf('這週的好消息') && t.indexOf('這週的好消息') < t.indexOf('我收到的打氣') && t.indexOf('我收到的打氣') < t.indexOf('邀請碼'), '順序：旅程 → 一句話 → 好消息 → 我收到的打氣 → 邀請碼')
  ok(t.includes('大家互相打氣 21 次'), '全隊打氣次數')
  ok(t.includes('致成交一筆零售') && t.includes('Yu約到一位朋友見面') && t.includes('致和沈成為王牌組合'), '好消息文字（最新的在上面）')
  ok(t.indexOf('致成交一筆零售') < t.indexOf('Yu約到一位朋友見面'), '照時間排，新的在上面')
  ok(!t.includes('沈第一次做滿') && t.includes('看全部 5 則'), '最多先顯示 3 則')
  await p.getByRole('button', { name: /看全部 5 則/ }).click(); await p.waitForTimeout(200)
  t = await text(p)
  ok(t.includes('沈第一次做滿一天的 1-1-2') && t.includes('于推薦了一位新夥伴') && t.includes('收起來'), '看全部：5 則都出來')
  ok(t.includes('已經一起連續行動 30 天'), '搭檔好消息有天數')
  // 鼓掌
  const clapBtns = p.getByRole('button', { name: '鼓掌' })
  const n0 = await clapBtns.count()
  ok(n0 >= 3, '別人的好消息有鼓掌按鈕 ' + n0)
  await clapBtns.first().click(); await p.waitForTimeout(300)
  let ops = await p.evaluate(() => window.__ops.filter(o => o[1] === 'news_claps'))
  ok(ops.some(o => o[0] === 'insert'), '按鼓掌 → 存進資料庫')
  ok(await p.getByRole('button', { name: '收回鼓掌' }).count() === 1, '按過變成「收回鼓掌」')
  await p.getByRole('button', { name: '收回鼓掌' }).click(); await p.waitForTimeout(300)
  ops = await p.evaluate(() => window.__ops.filter(o => o[1] === 'news_claps'))
  ok(ops.some(o => o[0] === 'delete') && await p.getByRole('button', { name: '收回鼓掌' }).count() === 0, '再按一次收回')
  await clapBtns.first().click(); await p.waitForTimeout(300)
  ok(await p.locator('.clap-bit').count() > 0, '按下去有彩帶噴出')
  // 自己的好消息：不能拍、看得到誰拍的
  t = await text(p)
  ok(t.includes('1 位替你鼓掌'), '自己的好消息顯示幾位替你鼓掌')
  await p.getByRole('button', { name: /位替你鼓掌/ }).click(); await p.waitForTimeout(200)
  ok((await text(p)).includes('致替你鼓掌'), '點了看得到是誰')
  // 我收到的打氣（nocheer=1：這週沒有）
  ok(t.includes('最近 7 天還沒有'), '沒有打氣時顯示最近 7 天還沒有')
  ok(t.includes('開啟通知，隊友打氣時你馬上就會知道'), '沒開通知提醒')
  // 成員卡：打氣按鈕
  const cheerBtns = p.getByRole('button', { name: '打氣', exact: true })
  ok(await cheerBtns.count() === 2, '致、沈有打氣按鈕；于關掉了、自己沒有 ' + await cheerBtns.count())
  ok(t.includes('跟你連勝 9 天') && t.includes('連勝新秀'), '搭檔：跟你連勝 9 天＋稱號')
  // 打開面板：致今天做滿 → 先停在「幫你鼓掌」
  await cheerBtns.first().click(); await p.waitForTimeout(500)
  t = await text(p)
  ok(t.includes('給致打氣'), '打氣面板打開')
  ok(t.includes('欸，你今天很猛欸') && t.includes('312完成了喔，讚啦'), '做滿的人先停在幫你鼓掌 ')
  ok(['一起開始', '給你勇氣', '幫你鼓掌', '想你了', '現在就去', '一句話'].every(x => t.includes(x)), '6 組都在')
  ok(!t.includes('自己寫') && (await p.locator('[role=dialog] input, [role=dialog] textarea').count()) === 0, '沒有自己打字的欄位')
  ok(t.includes('只有致看得到。致沒有開啟通知，下次打開 App 時才會看到'), '對方沒開通知的提醒')
  await p.getByRole('button', { name: '送出打氣' }).click(); await p.waitForTimeout(300)
  ok((await text(p)).includes('先選一句話'), '沒選句子不能送')
  await p.getByRole('button', { name: '一起開始' }).click(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: '來啦，今天一起衝一波' }).click()
  await p.getByRole('button', { name: '送出打氣' }).click(); await p.waitForTimeout(600)
  const sent = await rpc(p, 'send_cheer')
  ok(sent.length === 1 && sent[0][1].p_to === 'm1' && sent[0][1].p_text === '來啦，今天一起衝一波', '送出：給致、那一句')
  ok((await p.evaluate(() => window.__fetches.filter(f => f[0] === '/api/cheer').length)) === 1, '請後台送手機通知')
  t = await text(p)
  ok(t.includes('打氣送出了，致會看到'), '送出後的提示')
  ok(t.includes('已打氣') && (await p.getByRole('button', { name: '打氣', exact: true }).count()) === 1, '致變成已打氣')
  // 沈：沒做滿 → 先停在一起開始；有開通知
  await p.getByRole('button', { name: '打氣', exact: true }).click(); await p.waitForTimeout(400)
  t = await text(p)
  ok(t.includes('給沈打氣') && t.includes('欸，今天一起來做312啊') && !t.includes('欸，你今天很猛欸'), '沒做滿的人先停在一起開始')
  ok(t.includes('只有沈看得到') && !t.includes('沈沒有開啟通知'), '對方有開通知就不提醒')
  await p.screenshot({ path: __dirname + '/shots/t36_sheet.png' })
  await p.getByRole('button', { name: '關閉' }).first().click().catch(() => {}); await p.waitForTimeout(200)
  await p.keyboard.press('Escape')
  await p.mouse.click(200, 80); await p.waitForTimeout(300)
  // 展開沈：他邀我當搭檔 → 好啊
  await p.getByText('本週 1/7 天').click(); await p.waitForTimeout(400)
  t = await text(p)
  ok(t.includes('沈想跟你當搭檔'), '展開沈：看到他的邀請')
  await p.getByRole('button', { name: '好啊' }).click(); await p.waitForTimeout(600)
  ok((await rpc(p, 'buddy_accept')).length === 1, '按好啊 → 接受')
  ok((await text(p)).includes('你和沈成為搭檔了，從今天開始算'), '接受後的提示')
  // 展開于：還沒有搭檔 → 邀他
  await p.getByText('本週 0/7 天').click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: '邀于當搭檔' }).click(); await p.waitForTimeout(600)
  ok((await rpc(p, 'buddy_invite')).some(c => c[1].p_to === 'm3'), '邀于當搭檔')
  ok((await text(p)).includes('邀請送出了，等于回覆'), '邀請送出的提示')
  ok(await p.evaluate(() => !!localStorage.getItem('ufa_team_news_seen')), '看過戰隊頁：首頁小紅點清掉')
  await p.screenshot({ path: __dirname + '/shots/t36_team.png', fullPage: true })
  await p.context().close()

  // 我收到的打氣：有的時候可以展開
  p = await open('/team', '?x=1')
  await p.waitForTimeout(1500)
  // 打開 App 的打氣小卡先關掉
  if (await p.getByRole('button', { name: '好，去做' }).count()) { await p.getByRole('button', { name: '好，去做' }).click(); await p.waitForTimeout(300) }
  t = await text(p)
  ok(t.includes('最近 7 天 2 則'), '我收到的打氣：最近 7 天 2 則')
  await p.getByRole('button', { name: /我收到的打氣/ }).click(); await p.waitForTimeout(200)
  t = await text(p)
  ok(t.includes('就是現在，傳個訊息出去') && t.includes('沈 · 今天') && t.includes('致 · 昨天'), '展開看得到誰、哪一句、哪天')
  await p.context().close()

  // 沒加入戰隊：不出錯
  p = await open('/team', '?noteam=1&nocheer=1')
  t = await text(p)
  ok(t.includes('建立新戰隊') && !t.includes('這週的好消息'), '沒戰隊：照原本的建立／加入畫面')
  await p.context().close()

  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail)
})()
