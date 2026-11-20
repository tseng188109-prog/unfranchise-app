// deliver-76 首頁和慶祝：戰隊旗子、灰色火焰、搭檔提醒、我的夥伴、今天第一件事、打開 App 的打氣小卡、
// 搭檔到 7 天、點火焰看搭檔連勝、鈴鐺裡的打氣和邀請
const { chromium, devices } = require('playwright')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
const SELF = ['我真棒！！', '不愧是我！', '耶！我做到了']
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(path, q = '?nocheer=1', wait = 2200) {
    const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8767/' + q); await p.waitForTimeout(300); await p.evaluate(x => window.__nav(x), path); await p.waitForTimeout(wait); return p
  }
  const text = p => p.evaluate(() => document.body.innerText)
  const dialog = p => p.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText : '' })

  // ── 首頁上方、火焰、搭檔提醒 ──
  let p = await open('/lhome')
  const flag = p.getByRole('button', { name: /^戰隊/ })
  ok(await flag.count() === 1, '鈴鐺旁邊有戰隊按鈕')
  ok((await flag.getAttribute('aria-label')) === '戰隊，有新的好消息', '有新的好消息 → 小紅點')
  const order = await p.evaluate(() => [...document.querySelectorAll('button[aria-label]')].map(x => x.getAttribute('aria-label')).filter(x => /戰隊|提醒/.test(x)))
  ok(order[0].startsWith('戰隊') && order[1] === '提醒', '順序：戰隊、鈴鐺、齒輪 ' + order.join(','))
  const flame = p.getByRole('button', { name: /連續行動 \d+ 天/ })
  const flameColor = await flame.locator('span span').last().evaluate(e => getComputedStyle(e).color)
  ok(!/240, 138, 60/.test(flameColor), '今天還沒行動：火焰數字是灰的 ' + flameColor)
  let t = await text(p)
  ok(t.includes('致今天已經行動了，你也做一件事，連勝就到 10 天'), '搭檔提醒在 3-1-2 卡裡')
  ok(t.includes('我的夥伴'), '推薦過人：首頁有我的夥伴')
  ok(!/\n戰隊\n/.test(t), '原本那排的「戰隊」按鈕拿掉了')
  await p.screenshot({ path: __dirname + '/shots/t37_home.png' })

  // 點搭檔提醒 → 連續天數畫面，下面有搭檔連勝
  await p.getByRole('button', { name: /致今天已經行動了/ }).click(); await p.waitForTimeout(1500)
  t = await dialog(p)
  ok(t.includes('天連續行動') && t.includes('搭檔連勝') && t.includes('1 / 3 位'), '連續天數畫面有搭檔連勝 1/3')
  ok(t.includes('連勝新秀') && t.includes('致今天已經行動了，換你了'), '搭檔那一行：稱號、狀態')
  ok(t.includes('沈想跟你當搭檔'), '等我回覆的邀請')
  ok(t.includes('只有你們兩個看得到'), '說明只有兩個人看得到')
  await p.getByRole('button', { name: '+ 邀一位隊友當搭檔' }).click(); await p.waitForTimeout(400)
  t = await dialog(p)
  ok(t.includes('于') && t.includes('邀他') && !/\n致\n邀他/.test(t), '可以邀的隊友：不含已經是搭檔、等回覆的')
  await p.screenshot({ path: __dirname + '/shots/t37_streak_buddy.png' })
  await p.locator('[role=dialog]').getByRole('button', { name: /于/ }).last().click(); await p.waitForTimeout(800)
  ok((await p.evaluate(() => window.__rpcCalls.filter(c => c[0] === 'buddy_invite' && c[1].p_to === 'm3').length)) === 1, '從連續天數畫面邀于')
  await p.waitForTimeout(300)
  ok(await p.evaluate(() => window.__fetches.some(f => f[0] === '/api/cheer' && f[1] === JSON.stringify({ buddy: 'invite', id: 50 }))), '邀請送出 → 叫後台通知于')
  t = await dialog(p)
  ok(t.includes('已經邀請于，等他回覆') && t.includes('收回'), '邀了之後顯示等回覆，可以收回')
  // 結束搭檔要先確認
  await p.locator('[role=dialog]').getByRole('button', { name: /^致/ }).first().click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: '結束搭檔' }).click(); await p.waitForTimeout(400)
  ok((await text(p)).includes('結束和致的搭檔？') && (await text(p)).includes('對方不會收到通知'), '結束搭檔先問一次')
  await p.getByRole('button', { name: '取消' }).last().click(); await p.waitForTimeout(300)
  ok((await p.evaluate(() => window.__rpcCalls.filter(c => c[0] === 'buddy_end').length)) === 0, '按取消就不結束')
  await p.getByRole('button', { name: '好', exact: true }).click(); await p.waitForTimeout(300)
  await p.context().close()

  // ── 今天第一件事：火焰燒起來、數字往上滾、誇自己的按鈕 ──
  p = await open('/lhome')
  await p.evaluate(() => window.__logToday('c1')); await p.waitForTimeout(2200)
  t = await dialog(p)
  ok(t.includes('天連續行動') && t.includes('連續 10 天，明天見。'), '第一件事 → 跳連續天數（第 10 天）')
  ok(await p.locator('[role=dialog] .num-roll').count() === 1, '數字從 9 滾到 10')
  ok(await p.locator('[role=dialog] .flame-ignite').count() >= 1, '火焰燒起來的動畫')
  const btn = (await p.locator('[role=dialog] button').last().innerText()).trim()
  ok(SELF.includes(btn), '按鈕是誇自己的話：' + btn)
  ok(!t.includes('搭檔連勝'), '慶祝時不放搭檔清單')
  await p.screenshot({ path: __dirname + '/shots/t37_first.png' })
  await p.locator('[role=dialog] button').last().click(); await p.waitForTimeout(400)
  ok(await p.evaluate(() => localStorage.getItem('ufa_flame_lit') === window.__T), '今天點過火焰了')
  // 再記一筆：不會再跳
  await p.evaluate(() => window.__logToday('c2')); await p.waitForTimeout(2200)
  ok(!(await dialog(p)).includes('天連續行動'), '同一天第二件事不會再跳')
  const flameColor2 = await p.getByRole('button', { name: /連續行動 \d+ 天/ }).locator('span span').last().evaluate(e => getComputedStyle(e).color)
  ok(/240, 138, 60/.test(flameColor2), '做了之後首頁火焰變橘 ' + flameColor2)
  ok(!(await text(p)).includes('致今天已經行動了'), '我也行動了 → 搭檔提醒消失')
  await p.context().close()

  // ── 打開 App 的打氣小卡 ──
  p = await open('/lhome', '?x=1', 3500)
  t = await dialog(p)
  ok(t.includes('沈給你打氣') && t.includes('就是現在，傳個訊息出去'), '打開 App 跳打氣小卡')
  ok(!t.includes('也給你打氣'), '昨天看過的不算進來')
  ok(t.includes('開啟通知，隊友打氣時你馬上就會知道'), '沒開通知的人有提醒')
  await p.screenshot({ path: __dirname + '/shots/t37_cheer_card.png' })
  await p.getByRole('button', { name: '好，去做' }).click(); await p.waitForTimeout(400)
  ok((await p.evaluate(() => window.__rpcCalls.filter(c => c[0] === 'mark_cheers_seen').length)) === 1, '關掉就記成看過')
  // 鈴鐺：隊友那一區
  await p.getByRole('button', { name: '提醒' }).click(); await p.waitForTimeout(800)
  t = await text(p)
  ok(t.includes('隊友') && t.includes('沈想跟你當搭檔') && t.includes('沈給你打氣') && t.includes('致給你打氣'), '鈴鐺：搭檔邀請、最近 3 天的打氣')
  await p.screenshot({ path: __dirname + '/shots/t37_bell.png' })
  await p.getByRole('button', { name: '好啊' }).click(); await p.waitForTimeout(700)
  ok((await p.evaluate(() => window.__rpcCalls.filter(c => c[0] === 'buddy_accept').length)) === 1, '鈴鐺裡按好啊')
  ok(await p.evaluate(() => window.__fetches.some(f => f[0] === '/api/cheer' && f[1] === JSON.stringify({ buddy: 'accept', id: 2 }))), '答應 → 叫後台通知邀請的沈')
  ok((await text(p)).includes('你和沈成為搭檔了，從今天開始算') && !(await text(p)).includes('沈想跟你當搭檔'), '接受後邀請消失')
  await p.context().close()

  // ── 沒推薦過人、看過好消息 ──
  p = await open('/lhome', '?nopartner=1&nocheer=1&seennews=1')
  t = await text(p)
  ok(!t.includes('我的夥伴'), '沒推薦過人：首頁不放我的夥伴')
  ok((await p.getByRole('button', { name: /^戰隊/ }).getAttribute('aria-label')) === '戰隊', '看過了：沒有小紅點')
  await p.getByRole('button', { name: /^戰隊/ }).click(); await p.waitForTimeout(800)
  ok((await text(p)).includes('七月新努力'), '點旗子到戰隊頁')
  await p.context().close()

  // ── 搭檔剛好到 7 天 ──
  p = await open('/lhome', '?nocheer=1&buddy7=1', 4200)
  t = await dialog(p)
  ok(t.includes('你和致已經一起連續行動 7 天') && t.includes('解鎖稱號：連勝新秀') && t.includes('再 7 天，就能成為黃金搭檔'), '搭檔 7 天：大慶祝＋稱號＋下一個')
  ok(await p.locator('.confetti-piece').count() > 10, '有彩帶')
  const news = await p.evaluate(() => window.__rpcCalls.filter(c => c[0] === 'add_team_news'))
  ok(news.some(c => c[1].p_kind === 'buddy' && c[1].p_n === 7 && c[1].p_other === 'm1'), '同時上戰隊好消息')
  ok((await p.evaluate(() => window.__ops.filter(o => o[1] === 'buddy_marks' && o[0] === 'insert').length)) === 1, '記下看過，下次不再跳')
  await p.screenshot({ path: __dirname + '/shots/t37_buddy7.png' })
  await p.locator('[role=dialog] button').last().click(); await p.waitForTimeout(300)
  await p.context().close()

  // ── 搭檔昨天晚上才湊滿 7 天：我今天打開一樣看得到 ──
  p = await open('/lhome', '?nocheer=1&buddy7y=1', 4200)
  ok((await dialog(p)).includes('你和致已經一起連續行動 7 天'), '昨天才到 7 天：今天打開補跳一次')
  await p.context().close()

  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail)
})()
