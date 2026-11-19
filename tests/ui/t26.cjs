const { chromium, devices } = require('playwright')
;(async()=>{ const b=await chromium.launch(); const c=await b.newContext({...devices['iPhone 14']}); await c.addInitScript(()=>localStorage.setItem('ufa_push_guide_hidden_at',String(Date.now())))
 const p=await c.newPage(); await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(300); await p.click('#goHome'); await p.waitForTimeout(1800)
 const bb=await p.locator('text=新手起步').first().boundingBox(); await p.screenshot({path:'v11_noguide.png',clip:{x:0,y:bb.y-20,width:390,height:160}}); await b.close() })()
