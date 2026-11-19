const { chromium } = require('playwright')
;(async()=>{
  const b=await chromium.launch(); const errs=[]
  const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}); p.on('pageerror',e=>errs.push(e.message))
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(300)
  await p.evaluate(()=>{ const db=window.__db, a=window.__add
    db.contact_logs.push({id:'r1',user_id:'u',contact_id:'w2',date:a(-1),kind:'invite_no',note:'邀了沒約成　說自己很懶得用 但有聊其他的　邀的是 逛網站'})
    db.contact_logs.push({id:'r2',user_id:'u',contact_id:'w2',date:a(-3),kind:null,note:'今天聊到網站，也聊到他以前的狀況',tool:null})
    db.contact_logs.push({id:'r3',user_id:'u',contact_id:'w1',date:a(-2),kind:'invite_no',note:'邀了沒約成　後來又邀了一次　（11/6 確認）'})
    db.contact_logs.push({id:'r4',user_id:'u',contact_id:'w1',date:a(-2),kind:'invite_no',note:'邀了沒約成：最近比較忙　下個月　邀的是 約聚餐　（11/6 確認）'})
    db.contact_logs.push({id:'r5',user_id:'u',contact_id:'w1',date:a(-9),kind:'meet_plan',note:'見面聊聊'})
    db.counter_logs.push({id:'rm',user_id:'u',counter_key:'meetup',date:a(-9),planned_date:a(-9),is_done:true,note:'見面聊聊',contact_id:'w1'})
  })
  await p.evaluate(()=>window.__nav('/report')); await p.waitForTimeout(1500)
  await p.getByRole('button',{name:'最近7天'}).click(); await p.waitForTimeout(1500)
  await p.screenshot({path:'v5_report_top.png', fullPage:false})
  const goal = p.locator('text=目標').first(); await goal.scrollIntoViewIfNeeded(); await p.screenshot({path:'v6_report_goal.png'})
  // 展開張雅婷，把那句設成不放
  const row = p.locator('div').filter({has: p.locator('span',{hasText:/^張雅婷$/})}).last()
  await p.locator('span',{hasText:/^張雅婷$/}).first().locator('..').getByRole('button',{name:/展開/}).click(); await p.waitForTimeout(300)
  const line = p.locator('text=今天聊到網站').first(); await line.scrollIntoViewIfNeeded()
  await line.locator('xpath=ancestor::div[2]').getByRole('button',{name:'放進報告'}).click(); await p.waitForTimeout(300)
  const lb = await line.boundingBox(); await p.screenshot({path:'v7_report_hide.png', clip:{x:0,y:Math.max(0,lb.y-160),width:390,height:330}})
  await p.getByRole('button',{name:/複製給帶領者/}).click(); await p.waitForTimeout(600)
  const txt = await p.locator('pre').first().textContent()
  console.log(txt)
  // 重新整理後還記得不放
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(300); await p.evaluate(()=>window.__nav('/report')); await p.waitForTimeout(1500)
  console.log('重開後還記得(localStorage):', await p.evaluate(()=>localStorage.getItem('ufa_report_hidden')))
  // 自選 14 天：兩週
  await p.getByRole('button',{name:'自選日期'}).click(); await p.waitForTimeout(1500)
  const t2 = await p.textContent('#root'); console.log('14天週數:', (t2.match(/(這週（[^）]*）到今天|\d+\/\d+ 那週)/g)||[]).join(' / '))
  console.log('ERR', errs.slice(0,5)); await b.close()
})()
