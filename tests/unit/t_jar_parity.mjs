import { summarizeJar, lastBizPlans } from '../../src/lib/jar.js'
import fs from 'fs'
const d=JSON.parse(fs.readFileSync(new URL('./data/rand2.json', import.meta.url)))
const rows=[...d.rows,{id:'seed',is_archived:false,source:null}]
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})
const s=summarizeJar(rows,lastBizPlans(d.logs),today)
const anyPlan={}; d.logs.forEach(l=>{ if(!anyPlan[l.contact_id]||l.date>anyPlan[l.contact_id]) anyPlan[l.contact_id]=l.date })
const old=summarizeJar(rows,anyPlan,today)
const got = s.beans+'|'+s.walnuts.length+'|'+s.walnuts.filter(w=>w.cooling).length
// 資料庫那邊（tests/db/run.sh）用同一份名單算出來也要是這個數字
console.log((got === '272|56|55' ? 'PASS' : 'FAIL') + ' 400 筆模擬名單：豆子|核桃|熱度在退 = ' + got + '（舊規則核桃 ' + old.walnuts.length + '）')
