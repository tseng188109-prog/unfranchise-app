// deliver-77：品牌名稱、邀請連結、QR Code、分享到 LINE、註冊自動帶推薦人
const { chromium, devices } = require('playwright')
const path = require('path')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
// 解 QR 用的工具（jsqr、pngjs）；沒裝就跳過「掃得出來」那幾項
let jsQR = null, PNG = null
try { const base = process.env.QRTOOLS || path.join(__dirname, '../../../qrtools/node_modules'); jsQR = require(path.join(base, 'jsqr')); PNG = require(path.join(base, 'pngjs')).PNG } catch { console.log('（沒有 jsqr/pngjs，跳過掃描檢查）') }
const LINK = 'https://unfranchise-app.vercel.app/?r=AB2CD3'
;(async () => {
  const b = await chromium.launch(); const errs = []
  async function open(url, dev = devices['iPhone 14'], extra = {}) {
    const c = await b.newContext({ ...dev, ...extra }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8769' + url); await p.waitForTimeout(1200); return p
  }
  const text = p => p.evaluate(() => document.body.innerText)

  // ── 一般打開：登入畫面換成新名字 ──
  let p = await open('/')
  let t = await text(p)
  ok(t.includes('unfranchise') && t.includes('超連鎖的每日行動夥伴') && !t.includes('超連鎖行動計畫') && !t.includes('Daily Work App'), '登入畫面：unfranchise＋超連鎖的每日行動夥伴')
  ok(await p.locator('img[src="/pwa-192x192.png"]').evaluate(i => i.naturalWidth > 0), '登入畫面有 App 圖示')
  ok(await p.getByRole('button', { name: '登入' }).last().isVisible() && !(await p.getByPlaceholder('輸入姓名').count()), '沒帶代碼：預設是登入')
  await p.screenshot({ path: __dirname + '/shots/t40_login.png' })
  await p.context().close()

  // ── 點朋友的邀請連結（小寫也可以）：直接到註冊、推薦人帶好 ──
  p = await open('/?r=ab2cd3')
  t = await text(p)
  ok(await p.getByPlaceholder('輸入姓名').count() === 1, '帶代碼：直接是註冊')
  ok(t.includes('Yu邀請你一起用 unfranchise，註冊後你們就會自動串在一起。'), '上方說明是誰邀請的')
  ok(t.includes('推薦人') && t.includes('不是這位') && !(await p.getByPlaceholder('輸入推薦人 Email').count()), '推薦人已經填好，不用再打 Email')
  ok(await p.evaluate(() => localStorage.getItem('ufa_ref')) === 'AB2CD3', '代碼先記在手機上')
  await p.screenshot({ path: __dirname + '/shots/t40_register_ref.png' })
  await p.getByPlaceholder('輸入姓名').fill('小美'); await p.getByPlaceholder('輸入 Email').fill('new@example.com'); await p.getByPlaceholder('輸入密碼').fill('secret123')
  await p.getByRole('button', { name: '註冊' }).last().click(); await p.waitForTimeout(800)
  const up = await p.evaluate(() => window.__ops.filter(o => o[0] === 'upsert' && o[1] === 'users').map(o => o[2]))
  ok(up.length === 1 && up[0].referrer_id === 'u' && up[0].referrer_email_pending === null && up[0].name === '小美', '註冊：推薦人直接串上 Yu')
  const su = await p.evaluate(() => window.__signUps[0])
  ok(su && su.options.data.ref === 'AB2CD3' && su.options.data.name === '小美', '註冊資料裡也留一份代碼')
  ok(await p.evaluate(() => localStorage.getItem('ufa_ref')) === null, '註冊完就把代碼清掉')
  ok((await text(p)).includes('註冊成功'), '註冊成功訊息')
  await p.context().close()

  // ── 先關掉、之後直接打開網址（沒有 ?r=）：推薦人還在；按「不是這位」改回手動 ──
  p = await open('/?r=AB2CD3'); await p.goto('http://127.0.0.1:8769/'); await p.waitForTimeout(1000)
  ok((await text(p)).includes('Yu邀請你一起用'), '換頁回來推薦人還在')
  await p.getByRole('button', { name: '不是這位' }).click(); await p.waitForTimeout(300)
  ok(await p.getByPlaceholder('輸入推薦人 Email').count() === 1 && !(await text(p)).includes('Yu邀請你一起用'), '按不是這位 → 改成自己填推薦人 Email')
  ok(await p.evaluate(() => localStorage.getItem('ufa_ref')) === null, '也把記下的代碼清掉')
  await p.getByPlaceholder('輸入姓名').fill('阿華'); await p.getByPlaceholder('輸入 Email').fill('h@example.com'); await p.getByPlaceholder('輸入密碼').fill('secret123')
  await p.getByPlaceholder('輸入推薦人 Email').fill('mei@example.com')
  await p.getByRole('button', { name: '註冊' }).last().click(); await p.waitForTimeout(800)
  const up2 = await p.evaluate(() => window.__ops.filter(o => o[0] === 'upsert' && o[1] === 'users').map(o => o[2]))
  ok(up2[0] && up2[0].referrer_id === 'u-mei', '改回手動之後，用 Email 串（原本的方式照舊）')
  await p.context().close()

  // ── 代碼打錯：照一般註冊，Email 欄位在 ──
  p = await open('/?r=ZZZZZZ')
  ok(await p.getByPlaceholder('輸入推薦人 Email').count() === 1 && !(await text(p)).includes('邀請你一起用'), '查不到的代碼：照一般註冊')
  await p.context().close()
  p = await open('/?r=<script>')
  ok(!(await p.evaluate(() => window.__rpcCalls.some(c => c[0] === 'ref_lookup'))) && await p.getByPlaceholder('輸入姓名').count() === 0, '亂七八糟的代碼不送去查、維持登入')
  await p.context().close()

  // ── 設定 → 邀請朋友一起用（手機） ──
  p = await open('/settings')
  ok((await text(p)).includes('邀請朋友一起用'), '設定第一頁有「邀請朋友一起用」')
  await p.getByRole('button', { name: /邀請朋友一起用/ }).click(); await p.waitForTimeout(1500)
  t = await text(p)
  ok(t.includes(LINK), '顯示我的邀請連結（只有代碼，沒有 Email）')
  ok(!/@/.test(t.split('邀請朋友一起用').pop().split('存下來')[0].replace(/Email/g, '')), '連結附近沒有任何 Email')
  ok(await p.locator('canvas[aria-label="我的邀請 QR Code"]').count() === 1, '有 QR Code')
  const href = await p.getByRole('link', { name: /分享到 LINE/ }).getAttribute('href')
  ok(href.startsWith('https://line.me/R/share?text=') && decodeURIComponent(href.split('text=')[1]) === '我在用 unfranchise 記每天的行動，你也一起來用：\n' + LINK, '手機：分享到 LINE 帶好訊息和連結')
  const bg = await p.getByRole('link', { name: /分享到 LINE/ }).evaluate(e => getComputedStyle(e).backgroundColor)
  ok(bg === 'rgb(6, 199, 85)', 'LINE 按鈕是 LINE 綠 ' + bg)
  if (jsQR) {
    // 截下畫面上那一塊（跟朋友用相機拍到的一樣）來解
    const shot = PNG.sync.read(await p.screenshot())
    const r = jsQR(Uint8ClampedArray.from(shot.data), shot.width, shot.height)
    ok(r && r.data === LINK, '畫面上的 QR 掃得出來，是我的連結：' + (r && r.data))
  }
  await p.screenshot({ path: __dirname + '/shots/t40_invite.png', fullPage: true })
  await p.context().close()

  // ── 電腦：LINE 走分享頁、複製連結、存圖片（下載） ──
  p = await open('/settings?s=invite', { viewport: { width: 1280, height: 900 } }, { permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
  await p.waitForTimeout(800)
  const href2 = await p.getByRole('link', { name: /分享到 LINE/ }).getAttribute('href')
  ok(href2 === 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(LINK), '電腦：開 LINE 的分享頁')
  await p.getByRole('button', { name: '複製連結' }).click(); await p.waitForTimeout(300)
  ok((await text(p)).includes('已複製') && (await p.evaluate(() => navigator.clipboard.readText())) === LINK, '複製連結 → 已複製，剪貼簿是連結')
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: '存 QR 圖片' }).click()])
  const file = await dl.path()
  ok(/\.png$/.test(dl.suggestedFilename()), '下載圖片 ' + dl.suggestedFilename())
  await p.waitForTimeout(300)
  ok((await text(p)).includes('圖片已經下載好了。'), '下載後有提示')
  if (PNG) {
    const png = PNG.sync.read(require('fs').readFileSync(file))
    ok(png.width === 1080 && png.height === 1350, '圖片是 1080×1350')
    const r = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height)
    ok(r && r.data === LINK, '圖片裡的 QR 掃得出來')
    require('fs').copyFileSync(file, __dirname + '/shots/t40_share_image.png')
  }
  await p.context().close()

  // ── 拿不到代碼：說明，不顯示壞掉的按鈕 ──
  p = await open('/settings?s=invite&nocode=1')
  t = await text(p)
  ok(t.includes('邀請連結暫時拿不到，請稍後再打開一次。') && !(await p.getByRole('link', { name: /分享到 LINE/ }).count()), '拿不到代碼：說明，沒有按鈕')
  await p.context().close()

  console.log('ERR', JSON.stringify(errs))
  await b.close(); process.exit(fail)
})()
