import { makeDb } from './fakedb.js'
import handler, { slotOf } from '../../api/send-reminders.js'
process.env.CRON_SECRET='s'
const today = new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})
const db = makeDb({
  contacts:[{user_id:'u1',name:'沈安妮',next_plan:'21:30 見面',next_plan_date:today},{user_id:'u1',name:'王小明',next_plan:null,next_plan_date:today},
            {user_id:'u2',name:'李',next_plan:'一對一',next_plan_date:today},{user_id:'u3',name:'靜音',next_plan_date:today,is_muted:true},{user_id:'u1',name:'明天',next_plan_date:'2099-01-01'}],
  push_subscriptions:[{id:1,user_id:'u1',endpoint:'ok-1',p256dh:'a',auth:'b'},{id:2,user_id:'u1',endpoint:'gone-2',p256dh:'a',auth:'b'},{id:3,user_id:'u2',endpoint:'boom-3',p256dh:'a',auth:'b'}],
  push_runs:[], users:[{id:'u1',tag_settings:{}},{id:'u2',tag_settings:{}},{id:'u3',tag_settings:{}}] })
globalThis.__db=db
function call(headers){ return new Promise(r=>{ const res={c:0,status(c){this.c=c;return this},json(j){r([this.c,j])}}; handler({headers},res) }) }
const nineUTC = new Date(`${today}T01:00:00Z`).toISOString(), tenUTC=new Date(`${today}T02:00:00Z`).toISOString()
console.log('slot 9am:', JSON.stringify(slotOf({headers:{'ce-vssscheduledat':nineUTC}})))
console.log('沒密碼:', JSON.stringify(await call({})))
console.log('早上:', JSON.stringify(await call({authorization:'Bearer s','ce-id':'x1','ce-vssscheduledat':nineUTC})))
console.log('送出:', JSON.stringify(globalThis.__sent))
console.log('過期的登記被清掉:', !db.tables.push_subscriptions.some(s=>s.id===2))
console.log('同一次重送:', JSON.stringify(await call({authorization:'Bearer s','ce-id':'x1','ce-vssscheduledat':nineUTC})), '送出數仍為', globalThis.__sent.length)
console.log('10點:', JSON.stringify(await call({authorization:'Bearer s','ce-id':'x2','ce-vssscheduledat':tenUTC})))
console.log('紀錄:', JSON.stringify(db.tables.push_runs.map(r=>[r.slot_hour,r.kind,r.users,r.sent,r.failed,!!r.finished_at])))
// 紀錄表還沒建：insert 回錯誤也照送
const db2 = makeDb({contacts:[{user_id:'u1',name:'A',next_plan_date:today}],push_subscriptions:[{id:9,user_id:'u1',endpoint:'ok-9',p256dh:'a',auth:'b'}],users:[{id:'u1',tag_settings:{}}]})
const origFrom=db2.from.bind(db2); db2.from=t=>{ if(t==='push_runs'){ return {insert(){return{select(){return{single(){return Promise.resolve({data:null,error:{code:'42P01',message:'no table'}})}}}}}, update(){return{eq(){return Promise.resolve({})}}}} } return origFrom(t) }
globalThis.__db=db2
console.log('沒有紀錄表:', JSON.stringify(await call({authorization:'Bearer s','ce-id':'y','ce-vssscheduledat':nineUTC})))

// ── 自動判斷（上面印出來的是給人看的）
{
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m)
  const noAuth = await call({})
  ok(noAuth[0] === 401, '沒有密碼 → 401')
  ok(globalThis.__sent[0][1].title === '今天約了 2 位' && !globalThis.__sent.some(s => s[0] === 'boom-3' || s[0] === 'gone-2'), '早上只送給有約的人，內容對（壞掉的登記沒送到）')
  ok(!db.tables.push_subscriptions.some(s => s.id === 2), '手機已經取消的登記會被清掉')
  ok(db.tables.push_runs.some(r => r.slot_hour === 9 && r.kind === 'morning') && db.tables.push_runs.some(r => r.slot_hour === 10 && r.kind === 'idle'), '每一輪都有紀錄')
}
