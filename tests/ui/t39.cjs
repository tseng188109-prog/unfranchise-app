// deliver-76 更新：真的打包兩次（舊版、新版），用瀏覽器打開舊版，再把網站換成新版，
// 確認 App 會自己換到新版；正在打字時不換，改跳「有新版本」，打完字回到 App 才換。
// 用假的 Supabase 網址打包，不會連到真的資料庫。
const { chromium } = require('playwright')
const { execSync, spawn } = require('child_process')
const fs = require('fs'), path = require('path')
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
const root = path.resolve(__dirname, '../..')
const out = n => path.join(__dirname, '.build', n)
function build(n) {
  execSync(`npx vite build --outDir ${out(n)} --emptyOutDir`, { cwd: root, stdio: 'ignore',
    env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_ANON_KEY: 'test' } })
}
function serveFrom(n) {
  const d = out('pwa'); fs.rmSync(d, { recursive: true, force: true }); fs.cpSync(out(n), d, { recursive: true })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  build('pwaA'); await sleep(1100); build('pwaB')
  const verA = fs.readFileSync(path.join(out('pwaA'), 'index.html'), 'utf8').match(/assets\/index-[^"]+\.js/)[0]
  const verB = fs.readFileSync(path.join(out('pwaB'), 'index.html'), 'utf8').match(/assets\/index-[^"]+\.js/)[0]
  ok(verA !== verB, '兩次打包是不同的版本')
  ok(!fs.existsSync(path.join(out('pwaA'), 'registerSW.js')), '不再用自動註冊（改成 App 自己決定什麼時候換）')
  const sw = fs.readFileSync(path.join(out('pwaA'), 'sw.js'), 'utf8')
  ok(/skipWaiting\(\)/.test(sw) && /clientsClaim\(\)/.test(sw), '新版一下載好就接手')

  serveFrom('pwaA')
  const srv = spawn('node', [path.join(__dirname, 'serve.mjs'), out('pwa'), '8768'], { stdio: 'ignore' })
  await sleep(500)
  const b = await chromium.launch()
  const errs = []
  async function case1(busy) {
    serveFrom('pwaA')
    const ctx = await b.newContext(); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://127.0.0.1:8768/')
    await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 })
    const src0 = await p.evaluate(() => [...document.scripts].map(s => s.src).join(' '))
    ok(src0.includes(verA.split('/')[1]), (busy ? '[打字中] ' : '') + '先打開舊版')
    await p.evaluate(() => { window.__old = 1; window.addEventListener('ufa:update-ready', () => { window.__ready = 1 }) })
    if (busy) {
      // 登入頁的 Email 欄位：正在打字
      await p.waitForSelector('input', { timeout: 10000 }); await p.locator('input').first().click(); await p.keyboard.type('yu@')
    }
    serveFrom('pwaB')
    // 從別的 App 切回來：會檢查新版
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    if (!busy) {
      await p.waitForFunction(() => !window.__old, null, { timeout: 15000 }).catch(() => {})
      const src1 = await p.evaluate(() => [...document.scripts].map(s => s.src).join(' '))
      ok(src1.includes(verB.split('/')[1]), '回到 App → 自己換成新版')
      ok(await p.evaluate(() => sessionStorage.getItem('ufa_just_updated')) === '1', '換完會跳「已更新到最新版」')
    } else {
      await p.waitForFunction(() => window.__ready === 1, null, { timeout: 15000 }).catch(() => {})
      ok(await p.evaluate(() => window.__old === 1), '正在打字 → 不重新整理')
      ok(await p.evaluate(() => window.__ready === 1), '改成跳「有新版本，點一下更新」')
      ok((await p.locator('input').first().inputValue()) === 'yu@', '打到一半的字還在')
      // 打完字（離開欄位）、切到別的 App 再回來 → 換
      await p.evaluate(() => document.activeElement && document.activeElement.blur())
      await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await p.waitForFunction(() => !window.__old, null, { timeout: 15000 }).catch(() => {})
      const src2 = await p.evaluate(() => [...document.scripts].map(s => s.src).join(' '))
      ok(src2.includes(verB.split('/')[1]), '沒在打字時回到 App → 換成新版')
    }
    await ctx.close()
  }
  await case1(false)
  await case1(true)
  ok(errs.filter(e => !/fetch|network|127\.0\.0\.1:9/i.test(e)).length === 0, '沒有頁面錯誤 ' + JSON.stringify(errs).slice(0, 200))
  console.log('ERR []')
  await b.close(); srv.kill(); process.exit(fail)
})()
