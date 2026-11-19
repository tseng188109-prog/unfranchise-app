const { chromium, devices } = require('playwright')
const mockPush = (perm, hasSub) => `
  window.__sub = ${hasSub} ? { toJSON(){return {endpoint:'https://push/x',keys:{p256dh:'p',auth:'a'}}} } : null;
  const reg = { pushManager:{ getSubscription: async()=>window.__sub, subscribe: async()=>{ window.__sub={toJSON(){return {endpoint:'https://push/new',keys:{p256dh:'p',auth:'a'}}}}; return window.__sub } }, showNotification(t){ window.__shown=t } };
  Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve(reg)},configurable:true});
  window.PushManager = function(){};
  window.Notification = { permission:'${perm}', requestPermission: async()=>{ window.Notification.permission='granted'; return 'granted' } };
`
;(async()=>{
  const b=await chromium.launch(); const errs=[]
  async function open(ctxOpts, init){ const c=await b.newContext(ctxOpts); if(init) await c.addInitScript(init); const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(300); await p.click('#goHome'); await p.waitForTimeout(1800); return p }
  // 1. iPhone Safari，沒加主畫面
  let p = await open({ ...devices['iPhone 14'] })
  let t = await p.textContent('#root'); console.log('iPhone 沒加主畫面 → 顯示:', t.includes('加到主畫面，才收得到手機提醒'))
  const bar = p.locator('text=加到主畫面，才收得到手機提醒'); const bb = await bar.boundingBox()
  await p.screenshot({path:'v9_guide_install.png', clip:{x:0,y:Math.max(0,bb.y-60),width:390,height:200}})
  await p.getByRole('button',{name:'怎麼加'}).click(); await p.waitForTimeout(300)
  t = await p.textContent('body'); console.log('怎麼加 → 三步驟:', t.includes('加入主畫面') && t.includes('超連鎖圖示'))
  await p.screenshot({path:'v10_guide_steps.png'})
  await p.getByRole('button',{name:'關閉'}).last().click(); await p.waitForTimeout(200)
  await p.getByRole('button',{name:'先不要'}).click(); await p.waitForTimeout(200)
  t = await p.textContent('#root'); console.log('按 ✕ → 消失:', !t.includes('加到主畫面，才收得到'))
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(300); await p.click('#goHome'); await p.waitForTimeout(1500)
  t = await p.textContent('#root'); console.log('重新打開 → 30 天內不出現:', !t.includes('加到主畫面，才收得到'))
  await p.context().close()
  // 2. 可以收通知但還沒開（電腦／Android／已加主畫面）
  p = await open({ viewport:{width:390,height:844} }, mockPush('default', false))
  t = await p.textContent('#root'); console.log('還沒開 → 顯示開啟:', t.includes('打開手機提醒，約好的人當天早上會提醒你'))
  await p.getByRole('button',{name:'開啟',exact:true}).click(); await p.waitForTimeout(800)
  const db = await p.evaluate(()=>window.__db.push_subscriptions || [])
  console.log('按開啟 → 存進資料庫:', JSON.stringify(db.map(r=>r.endpoint)), ' 跳確認通知:', await p.evaluate(()=>window.__shown))
  t = await p.textContent('#root'); console.log('開好後引導條消失:', !t.includes('打開手機提醒，約好'))
  await p.context().close()
  // 3. 已經開好（有訂閱）但資料庫沒有 → 不顯示引導條，且自動補登記
  p = await open({ viewport:{width:390,height:844} }, mockPush('granted', true))
  t = await p.textContent('#root'); console.log('已開好 → 不顯示:', !t.includes('打開手機提醒，約好') && !t.includes('加到主畫面，才收'))
  console.log('自動補登記:', JSON.stringify(await p.evaluate(()=>(window.__db.push_subscriptions||[]).map(r=>[r.user_id,r.endpoint]))))
  await p.context().close()
  // 4. 手機把通知關掉 → 首頁不吵
  p = await open({ viewport:{width:390,height:844} }, mockPush('denied', false))
  t = await p.textContent('#root'); console.log('通知被關 → 首頁不顯示:', !t.includes('打開手機提醒，約好'))
  await p.context().close()
  console.log('ERR', errs.slice(0,5)); await b.close()
})()
