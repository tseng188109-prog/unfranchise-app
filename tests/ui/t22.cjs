const { chromium } = require('playwright')
const sheet = p => p.locator('div[style*="max-width: 520px"]').last()
;(async()=>{
  const b=await chromium.launch(); const errs=[]
  const p=await b.newPage({viewport:{width:390,height:1500}}); p.on('pageerror',e=>errs.push(e.message))
  await p.goto('http://127.0.0.1:8765/?fast=1'); await p.waitForTimeout(300); await p.click('#goHome'); await p.waitForTimeout(1800)
  const cnt = async () => { await p.evaluate(()=>window.__nav('/daily')); await p.waitForTimeout(1500); const t=(await p.textContent('#root')); await p.evaluate(()=>window.__nav('/home')); await p.waitForTimeout(1500); return (t.match(/邀約[^0-9]{0,6}(\d+) *\/ *3/)||[])[0] }
  console.log('開始（林小美今天已約 1 筆）:', await cnt())
  for (const r of ['沒約成','約成了']) {
    await p.getByRole('button',{name:'記一次邀約'}).first().click(); await p.waitForTimeout(400)
    let s = sheet(p); await s.getByRole('button',{name:/換人|選 ›/}).click(); await p.waitForTimeout(400)
    await p.locator('input[placeholder="搜尋姓名…"]').fill('張'); await p.getByRole('button',{name:'張雅婷',exact:true}).last().click(); await p.waitForTimeout(400)
    s = sheet(p); await s.getByRole('button',{name:r}).click()
    if (r==='約成了') { await s.getByRole('button',{name:'選日期'}).last().click(); await p.waitForTimeout(300); await p.getByRole('button',{name:String(Number((await p.evaluate(()=>window.__add(2))).slice(8,10))),exact:true}).last().click(); await p.waitForTimeout(200) }
    await sheet(p).getByRole('button',{name:'記下來'}).click(); await p.waitForTimeout(1500)
    console.log(`張雅婷 ${r} 後:`, await cnt())
  }
  await p.evaluate(()=>window.__nav('/report')); await p.waitForTimeout(1800)
  const t = await p.textContent('#root'); console.log('報告開口邀約(每次都算):', (t.match(/開口邀約(\d+)/)||[])[1], (t.match(/開口邀約裡：[^。]*/)||[])[0])
  console.log('ERR', errs.slice(0,5)); await b.close()
})()
