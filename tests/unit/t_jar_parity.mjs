import { summarizeJar, lastBizPlans } from '../../src/lib/jar.js'
import fs from 'fs'
const d=JSON.parse(fs.readFileSync(new URL('./data/rand2.json', import.meta.url)))
const rows=[...d.rows,{id:'seed',is_archived:false,source:null}]
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})
const s=summarizeJar(rows,lastBizPlans(d.logs),today)
const anyPlan={}; d.logs.forEach(l=>{ if(!anyPlan[l.contact_id]||l.date>anyPlan[l.contact_id]) anyPlan[l.contact_id]=l.date })
const old=summarizeJar(rows,anyPlan,today)
const got = s.beans+'|'+s.walnuts.length+'|'+s.walnuts.filter(w=>w.cooling).length
// 「熱度在退」跟今天日期有關（每天會變），所以只固定豆子和核桃；
// 資料庫那邊（tests/db/run.sh）會用同一天跑這支，拿完整的三個數字去比對。
if (process.argv.includes('--value')) { console.log(got); process.exit(0) }
// 固定的那組數字用固定的日期算（核桃也跟日期有關，用今天算每過幾天就會變，測試會自己壞掉）
const s0 = summarizeJar(rows, lastBizPlans(d.logs), '2026-11-20')
const fixed = s0.beans === 272 && s0.walnuts.length === 56
console.log((fixed ? 'PASS' : 'FAIL') + ' 400 筆模擬名單（以 2026-11-20 來算）：豆子|核桃 = ' + s0.beans + '|' + s0.walnuts.length + '；今天：' + got + '（舊規則核桃 ' + old.walnuts.length + '）')
