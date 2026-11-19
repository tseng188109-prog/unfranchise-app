import * as R from '../../src/lib/rhythm.js'
let fail=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) fail=1}
ok(R.weekStartOf('2026-11-13')==='2026-11-07' && R.weekStartOf('2026-11-07')==='2026-11-07' && R.weekStartOf('2026-11-08')==='2026-11-07', 'week start Sat')
ok(R.weekDaysOf('2026-11-12').join()==='2026-11-07,2026-11-08,2026-11-09,2026-11-10,2026-11-11,2026-11-12,2026-11-13','week days')
const S=a=>new Set(a)
// 連續：11/1..11/12 都有做 → 12
let days=[]; for(let i=1;i<=12;i++) days.push('2026-11-'+String(i).padStart(2,'0'))
let s=R.computeStreak(S(days),'2026-11-12'); ok(s.count===12&&s.todayActive,'12 days '+s.count)
s=R.computeStreak(S(days.slice(0,11)),'2026-11-12'); ok(s.count===11&&!s.todayActive,'today not done keeps 11')
// 11/8(日) 沒做 → 休息日，不斷
let d2=days.filter(d=>d!=='2026-11-08'); s=R.computeStreak(S(d2),'2026-11-12'); ok(s.count===11 && s.restDays.includes('2026-11-08'),'rest day keeps streak '+s.count)
// 同一週兩天沒做 → 斷
let d3=d2.filter(d=>d!=='2026-11-10'); s=R.computeStreak(S(d3),'2026-11-12'); ok(s.count===3,'two misses same week break '+s.count)
// 不同週各一天 → 都不斷
let d4=d2.filter(d=>d!=='2026-11-03'); s=R.computeStreak(S(d4),'2026-11-12'); ok(s.count===10,'one miss per week ok '+s.count)
// 昨天休息、今天有做 → restUsedYesterday
let d5=days.filter(d=>d!=='2026-11-11'); s=R.computeStreak(S(d5),'2026-11-12'); ok(s.restUsedYesterday && s.count===11,'rest yesterday flag')
s=R.computeStreak(S([]),'2026-11-12'); ok(s.count===0 && s.restDays.length===0,'empty')
// 今天沒做、昨天也沒做（休息）→ 還在
s=R.computeStreak(S(days.slice(0,10)),'2026-11-12'); ok(s.count===10,'yesterday rest today pending '+s.count)
const st=R.weekStrip(S(d5),'2026-11-12',R.computeStreak(S(d5),'2026-11-12')); ok(st.map(x=>x.state).join()==='on,on,on,on,rest,on,future','strip '+st.map(x=>x.state).join())
// count312
const c=R.count312({logs:[{contact_id:'a',kind:null},{contact_id:'a',kind:'meet_plan'},{contact_id:'b',kind:'invite_no'},{contact_id:'c',kind:null}],added:[1,2],met:[{contact_id:'d',date:'x',planned_date:'x',note:null},{contact_id:'e',date:'x',planned_date:'y'}]})
ok(c.talk===3&&c.plan===3&&c.fresh===2,'count312 '+JSON.stringify(c))
const m=R.MODE_COUNTS.std
ok(R.eveningMessage({talk:3,plan:1,fresh:2},m,{count:5,todayActive:true})===null,'full no msg')
ok(R.eveningMessage({talk:3,plan:0,fresh:2},m,{count:5,todayActive:true}).title==='今天只差 1 個邀約','one missing')
ok(R.eveningMessage({talk:0,plan:0,fresh:0},m,{count:12,todayActive:false}).title==='連續 12 天了','streak keep')
ok(R.eveningMessage({talk:0,plan:0,fresh:0},m,{count:0,todayActive:false}).title.includes('還沒開始'),'none')
ok(R.eveningMessage({talk:1,plan:0,fresh:0},m,{count:0,todayActive:true}).title==='今天還差：互動 2 位、邀約 1 個、新名單 2 位','multi')
ok(R.notifyPrefs({}).eveningHour===21 && R.notifyPrefs({notify:{eveningHour:23,team:true}}).team && R.notifyPrefs({notify:{eveningHour:5}}).eveningHour===21,'prefs')
ok(R.modeOf({},new Date(Date.now()-3*864e5).toISOString()).key==='start' && R.modeOf({daily_mode:'fast'}).key==='fast','mode')
ok(R.partnerAdvice({talk:0,invites:0,contacts_new:0}).includes('還沒動'),'adv idle')
ok(R.partnerAdvice({talk:5,invites:4,invite_yes:1,contacts_new:2,contacts_total:40,top10_filled:10}).includes('練邀約'),'adv invites')
process.exit(fail)
