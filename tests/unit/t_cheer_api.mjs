// 打氣的手機通知（api/cheer.js）：誰能叫、送給誰、什麼時候不送、同一則只送一次
import { makeDb } from './fakedb.js'
import handler from '../../api/cheer.js'
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
const now = new Date().toISOString()
function db(tables) {
  const d = makeDb(tables)
  const from0 = d.from.bind(d)
  d.from = t => { const q = from0(t); q.maybeSingle = () => q.single(); return q }
  d.auth = { getUser: tok => Promise.resolve(tok === 'tok-yu' ? { data: { user: { id: 'yu' } }, error: null } : tok === 'tok-mei' ? { data: { user: { id: 'mei' } }, error: null } : { data: null, error: { message: 'bad' } }) }
  return d
}
function call(token, body) {
  return new Promise(r => { const res = { c: 0, status(c) { this.c = c; return this }, json(j) { r([this.c, j]) } }; handler({ method: 'POST', headers: token ? { authorization: 'Bearer ' + token } : {}, body }, res) })
}
const base = () => ({
  cheers: [{ id: 5, from_id: 'yu', to_id: 'mei', text: '欸，你今天很猛欸', created_at: now, pushed_at: null }],
  users: [{ id: 'yu', name: 'Yu', tag_settings: {} }, { id: 'mei', name: '小美', tag_settings: {} }],
  push_subscriptions: [{ id: 1, user_id: 'mei', endpoint: 'ok-1', p256dh: 'a', auth: 'b' }, { id: 2, user_id: 'yu', endpoint: 'ok-yu', p256dh: 'a', auth: 'b' }],
})
const hourTW = Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }))
const night = hourTW >= 22 || hourTW < 7

globalThis.__db = db(base()); globalThis.__sent.length = 0
ok((await call(null, { id: 5 }))[0] === 401, '沒登入 → 401')
ok((await call('tok-x', { id: 5 }))[0] === 401, '登入憑證不對 → 401')
ok((await call('tok-mei', { id: 5 }))[0] === 404, '不是送的人本人不能叫 → 404')
const r = await call('tok-yu', JSON.stringify({ id: 5 }))
if (night) {
  ok(r[1].pushed === false && r[1].reason === 'night', '現在是晚上：不送（' + hourTW + ' 點）')
} else {
  ok(r[1].pushed === true && globalThis.__sent.length === 1 && globalThis.__sent[0][0] === 'ok-1', '送給收到的人的手機（不是送的人）')
  ok(globalThis.__sent[0][1].title === 'Yu給你打氣' && globalThis.__sent[0][1].body === '欸，你今天很猛欸', '通知內容：誰給你打氣＋那一句')
  ok(!!globalThis.__db.tables.cheers[0].pushed_at, '記下送過了')
  const again = await call('tok-yu', { id: 5 })
  ok(again[1].pushed === false && again[1].reason === 'already' && globalThis.__sent.length === 1, '同一則只送一次')
}
const t2 = base(); t2.users[1].tag_settings = { notify: { cheer: false } }
globalThis.__db = db(t2)
ok((await call('tok-yu', { id: 5 }))[1].reason === (night ? 'night' : 'off'), '對方關掉隊友打氣 → 不送')
const t3 = base(); t3.users[1].tag_settings = { notify: { quietUntil: '2999-01-01' } }
globalThis.__db = db(t3)
ok((await call('tok-yu', { id: 5 }))[1].reason === 'quiet', '對方開安靜模式 → 不送')
if (!night) {
  const t4 = base(); t4.push_subscriptions = []
  globalThis.__db = db(t4)
  ok((await call('tok-yu', { id: 5 }))[1].reason === 'no-device', '對方沒開通知 → 不送，也不出錯')
}
process.exit(fail)
