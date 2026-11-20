// 搭檔的手機通知（api/cheer.js 的 buddy 分支）：邀請通知被邀的人、答應通知邀請的人、誰能叫、什麼時候不送、同一次只送一次
import { makeDb } from './fakedb.js'
import handler, { buddySkipReason } from '../../api/cheer.js'
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
const now = new Date().toISOString()
function db(tables) {
  const d = makeDb(tables)
  const from0 = d.from.bind(d)
  d.from = t => { const q = from0(t); q.maybeSingle = () => q.single(); return q }
  const who = { 'tok-yu': 'yu', 'tok-mei': 'mei', 'tok-x': 'x' }
  d.auth = { getUser: tok => Promise.resolve(who[tok] ? { data: { user: { id: who[tok] } }, error: null } : { data: null, error: { message: 'bad' } }) }
  return d
}
function call(token, body) {
  return new Promise(r => { const res = { c: 0, status(c) { this.c = c; return this }, json(j) { r([this.c, j]) } }; handler({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body }, res) })
}
const base = () => ({
  buddies: [
    { id: 7, from_id: 'yu', to_id: 'mei', status: 'pending', created_at: now, accepted_at: null, invite_pushed_at: null, accept_pushed_at: null },
    { id: 8, from_id: 'yu', to_id: 'x', status: 'active', created_at: now, accepted_at: now, invite_pushed_at: null, accept_pushed_at: null },
  ],
  users: [{ id: 'yu', name: 'Yu', tag_settings: {} }, { id: 'mei', name: '小美', tag_settings: {} }, { id: 'x', name: '阿華', tag_settings: {} }],
  push_subscriptions: [{ id: 1, user_id: 'mei', endpoint: 'ok-mei', p256dh: 'a', auth: 'b' }, { id: 2, user_id: 'yu', endpoint: 'ok-yu', p256dh: 'a', auth: 'b' }],
})

// ── 規則（固定時間，不看現在幾點） ──
const noon = new Date('2026-11-20T04:00:00Z'), late = new Date('2026-11-20T15:00:00Z') // 台灣中午 12 點、晚上 11 點
const row = { created_at: '2026-11-20T03:58:00Z', accepted_at: '2026-11-20T03:59:00Z' }
ok(buddySkipReason({ row, kind: 'invite', tagSettings: {}, now: noon }) === null, '白天、剛邀請 → 送')
ok(buddySkipReason({ row, kind: 'accept', tagSettings: {}, now: noon }) === null, '白天、剛答應 → 送')
ok(buddySkipReason({ row: { created_at: '2026-11-20T14:58:00Z' }, kind: 'invite', tagSettings: {}, now: late }) === 'night', '晚上 11 點 → 不送')
ok(buddySkipReason({ row: { ...row, created_at: '2026-11-20T03:00:00Z' }, kind: 'invite', tagSettings: {}, now: noon }) === 'too-old', '一小時前的邀請 → 不補送')
ok(buddySkipReason({ row: { ...row, invite_pushed_at: 'x' }, kind: 'invite', tagSettings: {}, now: noon }) === 'already', '送過了 → 不再送')
ok(buddySkipReason({ row, kind: 'invite', tagSettings: { notify: { quietUntil: '2999-01-01' } }, now: noon }) === 'quiet', '對方開安靜模式 → 不送')
ok(buddySkipReason({ row, kind: 'invite', tagSettings: { notify: { cheer: false } }, now: noon }) === null, '對方關掉隊友打氣，搭檔邀請一樣會通知')
ok(buddySkipReason({ row: { ...row, accepted_at: null }, kind: 'accept', tagSettings: {}, now: noon }) === 'too-old', '沒有答應時間 → 不送')

// ── 實際叫 API ──
const hourTW = Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }))
const night = hourTW >= 22 || hourTW < 7
globalThis.__db = db(base()); globalThis.__sent.length = 0
ok((await call('tok-mei', { buddy: 'invite', id: 7 }))[0] === 404, '不是送出邀請的人，不能叫邀請通知')
ok((await call('tok-yu', { buddy: 'accept', id: 7 }))[0] === 404, '還沒答應，不能叫答應通知')
ok((await call('tok-yu', { buddy: 'invite' }))[0] === 400, '少了編號 → 400')
const r = await call('tok-yu', JSON.stringify({ buddy: 'invite', id: 7 }))
if (night) ok(r[1].reason === 'night', '現在是晚上：不送（' + hourTW + ' 點）')
else {
  ok(r[1].pushed === true && globalThis.__sent.length === 1 && globalThis.__sent[0][0] === 'ok-mei', '邀請通知送給被邀的小美')
  ok(globalThis.__sent[0][1].title === 'Yu邀你當搭檔' && globalThis.__sent[0][1].body === '打開 App 點右上角的鈴鐺，就能答應他。', '邀請通知的內容')
  ok(!!globalThis.__db.tables.buddies[0].invite_pushed_at, '記下送過了')
  ok((await call('tok-yu', { buddy: 'invite', id: 7 }))[1].reason === 'already' && globalThis.__sent.length === 1, '同一次邀請只送一次')
}
// 小美答應 → 通知 Yu
const t2 = base(); t2.buddies[0].status = 'active'; t2.buddies[0].accepted_at = now
globalThis.__db = db(t2); globalThis.__sent.length = 0
ok((await call('tok-yu', { buddy: 'accept', id: 7 }))[0] === 404, '邀請的人自己不能叫答應通知')
const r2 = await call('tok-mei', { buddy: 'accept', id: 7 })
if (night) ok(r2[1].reason === 'night', '晚上：答應通知也不送')
else {
  ok(r2[1].pushed === true && globalThis.__sent[0][0] === 'ok-yu', '答應通知送給邀請的 Yu')
  ok(globalThis.__sent[0][1].title === '小美答應當你的搭檔了' && globalThis.__sent[0][1].body === '從今天開始一起連續行動，看你們能連勝幾天。', '答應通知的內容')
  const t3 = base(); globalThis.__db = db(t3)
  ok((await call('tok-yu', { buddy: 'invite', id: 8 }))[0] === 404, '已經是搭檔，不能再叫邀請通知')
  const t4 = base(); t4.push_subscriptions = []; globalThis.__db = db(t4)
  ok((await call('tok-yu', { buddy: 'invite', id: 7 }))[1].reason === 'no-device', '對方沒開通知 → 不送，也不出錯')
}
process.exit(fail)
