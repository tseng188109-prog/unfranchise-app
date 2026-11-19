import { planMessages, slotOf } from '../../api/send-reminders.js'
import { makeDb } from './fakedb2.js'
import { addDays, weekStartOf } from '../../src/lib/rhythm.js'
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail=1}
const FRI='2026-11-13', WED='2026-11-11', THU='2026-11-12'
function streakRows(uid, today, n){ const r=[]; for(let i=0;i<n;i++) r.push({user_id:uid,date:addDays(today,-i),task_key:'daily_312',is_done:true}); return r }
function setup(today){
  return makeDb({
    push_subscriptions:[{id:1,user_id:'Y'},{id:2,user_id:'M'},{id:3,user_id:'Q'},{id:4,user_id:'Z'}],
    users:[
      {id:'Y',name:'Yu',referrer_id:null,tag_settings:{notify:{eveningHour:21}},created_at:'2026-01-01T00:00:00Z'},
      {id:'M',name:'小美',referrer_id:'Y',tag_settings:{notify:{eveningHour:21}},created_at:'2026-01-01T00:00:00Z'},
      {id:'Q',name:'安靜',referrer_id:'Y',tag_settings:{notify:{eveningHour:21,quietUntil:'2099-01-01'}},created_at:'2026-01-01T00:00:00Z'},
      {id:'Z',name:'不要晚上',referrer_id:null,tag_settings:{notify:{evening:false,weekly:false,partnerNews:false,team:true}},created_at:'2026-01-01T00:00:00Z'},
      {id:'K',name:'阿凱',referrer_id:'Y',tag_settings:{},created_at:'2026-01-01T00:00:00Z'},
    ],
    contacts:[{id:'c1',user_id:'Y',name:'王',next_plan:'喝咖啡',next_plan_date:today,is_muted:false,source:null,added_date:today},{id:'c2',user_id:'Y',source:null,added_date:today},{id:'c3',user_id:'M',name:'李',next_plan_date:today,is_muted:true}],
    contact_logs:[{user_id:'Y',contact_id:'c1',kind:null,date:today},{user_id:'Y',contact_id:'c9',kind:null,date:today},{user_id:'Y',contact_id:'c8',kind:null,date:today}],
    counter_logs:[{user_id:'Y',contact_id:'c1',counter_key:'meetup',is_done:true,date:today,planned_date:today,note:null}],
    daily_checkins:[...streakRows('M',addDays(today,-1),5),...streakRows('K',today,7),{user_id:'Y',date:today,task_key:'daily_3_contacts',is_done:true}],
    team_members:[{team_id:'T',user_id:'Z'},{team_id:'T',user_id:'Y'}],
  })
}
// 早上 9 點
let r=await planMessages(setup(THU),{date:THU,hour:9})
ok(r.parts.join()==='morning' && r.messages.length===1 && r.messages[0].userId==='Y' && r.messages[0].title==='今天約了 王','morning: muted skipped')
// 晚上 21：Y 今天互動3、邀約1(直接見面)、新名單2 → 做滿 → 不送；M 沒做、連續5天 → 守住；Q 安靜；Z 關掉
r=await planMessages(setup(THU),{date:THU,hour:21})
const by=Object.fromEntries(r.messages.map(m=>[m.userId,m]))
ok(r.parts.join()==='evening','evening part')
ok(!by.Y,'Y full -> no evening')
ok(by.M && by.M.title==='連續 5 天了','M streak keep: '+(by.M&&by.M.title))
ok(!by.Q && !by.Z,'quiet & off skipped')
// 晚上 20 (週四)：夥伴好消息 K 今天第 7 天 → 通知 Y
r=await planMessages(setup(THU),{date:THU,hour:20})
ok(r.parts.join()==='news' && r.messages.some(m=>m.userId==='Y'&&m.title==='阿凱連續 7 天了'),'partner news '+r.messages.map(m=>m.title).join('|'))
ok(!r.messages.some(m=>m.userId==='Z'),'Z news off')
// 週五 20：weekly for Y,M (Q quiet, Z off)
r=await planMessages(setup(FRI),{date:FRI,hour:20})
const wk=r.messages.filter(m=>m.url==='/week')
ok(r.parts.includes('weekly') && wk.length===2,'weekly '+wk.map(m=>m.userId+':'+m.body).join('|'))
ok(wk.find(m=>m.userId==='Y').body.includes('見到 1 位、開口邀約 1 次、新名單 2 位'),'weekly numbers')
ok(wk.find(m=>m.userId==='M').title==='這週先休息了也沒關係','weekly empty')
// 週三 20：戰隊（Z 開了）
r=await planMessages(setup(WED),{date:WED,hour:20})
ok(r.parts.includes('team') && r.messages.some(m=>m.userId==='Z' && m.title.includes('1 人')),'team '+r.messages.map(m=>m.userId+':'+m.title).join('|'))
// 其他時間 idle
r=await planMessages(setup(THU),{date:THU,hour:14}); ok(r.parts.length===0 && r.messages.length===0,'idle')
// 上限：同一人同一輪最多 2 則
const db=setup(FRI); db.tables.users[0].tag_settings={notify:{eveningHour:20}}; db.tables.daily_checkins=db.tables.daily_checkins.filter(c=>c.user_id!=='Y')
r=await planMessages(db,{date:FRI,hour:20}); ok(r.messages.filter(m=>m.userId==='Y').length===2,'cap 2 per user: '+r.messages.filter(m=>m.userId==='Y').map(m=>m.title).join('|'))
ok(slotOf({headers:{'ce-vssscheduledat':'2026-11-13T12:00:00Z'}}).hour===20,'slot 20')
// 沒有人登記
r=await planMessages(makeDb({push_subscriptions:[]}),{date:THU,hour:21}); ok(r.messages.length===0,'no subs')
process.exit(fail)
