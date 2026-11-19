const { chromium } = require('playwright')
;(async()=>{
  const b=await chromium.launch(); const errs=[]
  const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}); p.on('pageerror',e=>errs.push(e.message))
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(300)
  for (const path of ['/contacts/new','/contacts/w1/edit']) {
    await p.evaluate(x=>window.__nav(x), path); await p.waitForTimeout(1500)
    const ig = p.getByRole('button',{name:'IG',exact:true}).first()
    if (path.endsWith('new') || !(await p.locator('input[name="social-handle"]').count())) { await ig.click(); await p.waitForTimeout(200) }
    const a = await p.locator('input[name="social-handle"]').evaluate(el=>({ph:el.placeholder, ac:el.getAttribute('autocomplete'), cap:el.getAttribute('autocapitalize'), cor:el.getAttribute('autocorrect'), sp:el.getAttribute('spellcheck')}))
    console.log(path, JSON.stringify(a))
    const el = p.locator('input[name="social-handle"]'); await el.fill('Abc_123'); console.log('  打字後:', await el.inputValue())
    if (path.endsWith('new')) { const bx = await el.boundingBox(); await p.screenshot({path:'v8_handle.png', clip:{x:0,y:Math.max(0,bx.y-120),width:390,height:200}}) }
  }
  console.log('ERR', errs.slice(0,5)); await b.close()
})()
