import { handle, statusOf, makeTempPassword, downlineOf } from '../../api/admin.js'
import { makeDb } from './fakedb2.js'
let fail = 0
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
const dAgo = n => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
ok(statusOf({ lastDay: today }, today) === 'active', 'status today active')
ok(statusOf({ lastDay: dAgo(7) }, today) === 'active', 'status 7d active')
ok(statusOf({ lastDay: dAgo(8) }, today) === 'less', 'status 8d less')
ok(statusOf({ lastDay: dAgo(30) }, today) === 'less', 'status 30d less')
ok(statusOf({ lastDay: dAgo(31) }, today) === 'idle', 'status 31d idle')
ok(statusOf({ lastDay: null }, today) === 'new', 'status none new')
ok(statusOf({ lastDay: today, deactivatedAt: 'x' }, today) === 'off', 'status off')
const pw = makeTempPassword(); ok(/^[A-Za-z2-9]{3}-[A-Za-z2-9]{3}-[A-Za-z2-9]{2}$/.test(pw) && !/[0O1lI]/.test(pw), 'temp pw format ' + pw)
ok([...downlineOf('Y', [{ id: 'M', referrer_id: 'Y' }, { id: 'J', referrer_id: 'M' }, { id: 'S', referrer_id: null }])].sort().join() === 'J,M', 'downline')
ok(downlineOf('A', [{ id: 'A', referrer_id: 'B' }, { id: 'B', referrer_id: 'A' }]).size === 1, 'cycle safe')

function setup() {
  const tables = {
    users: [
      { id: 'Y', name: 'Yu', referrer_id: null, created_at: '2026-05-01T00:00:00Z' },
      { id: 'M', name: '小美', referrer_id: 'Y', created_at: '2026-05-10T00:00:00Z' },
      { id: 'J', name: '阿傑', referrer_id: 'M', created_at: '2026-07-01T00:00:00Z' },
      { id: 'C', name: '春嬌', referrer_id: 'J', created_at: '2026-06-01T00:00:00Z' },
      { id: 'K', name: '小K', referrer_id: 'C', created_at: '2026-06-02T00:00:00Z' },
      { id: 'N', name: '志明', referrer_id: null, referrer_email_pending: 'yu@gmial.com', created_at: new Date().toISOString() },
    ],
    account_status: [{ user_id: 'C', deactivated_at: new Date(Date.now() - 31 * 86400000).toISOString() }],
    push_subscriptions: [{ id: 1, user_id: 'M' }, { id: 2, user_id: 'J' }],
    admins: [{ user_id: 'Y' }],
    admin_logs: [], push_runs: [{ id: 1, kind: 'morning', slot_date: today, users: 2, sent: 2, failed: 0 }],
    feedback: [{ id: 1, user_id: 'M', kind: '出錯了', message: 'x', created_at: '2026-11-12', handled_at: null }],
    teams: [{ id: 'T1', creator_id: 'C' }, { id: 'T2', creator_id: 'C' }],
    team_members: [{ team_id: 'T1', user_id: 'C', joined_at: '2026-01-01' }, { team_id: 'T1', user_id: 'K', joined_at: '2026-01-03' }, { team_id: 'T1', user_id: 'M', joined_at: '2026-01-02' }, { team_id: 'T2', user_id: 'C', joined_at: '2026-01-01' }],
  }
  const rpcs = {
    admin_last_seen: () => ({ data: [{ user_id: 'Y', last_day: today }, { user_id: 'M', last_day: dAgo(3) }, { user_id: 'J', last_day: dAgo(12) }, { user_id: 'K', last_day: dAgo(45) }], error: null }),
    admin_purge_user: ({ p_user_id }, t) => { t.users.splice(t.users.findIndex(u => u.id === p_user_id), 1); return { data: null, error: null } },
  }
  const auth = ['Y', 'M', 'J', 'C', 'K', 'N'].map(id => ({ id, email: id.toLowerCase() + '@x.com' }))
  return makeDb(tables, rpcs, auth)
}
const Y = { id: 'Y' }
let db = setup()
let r = await handle(db, Y, { action: 'accounts' })
const by = Object.fromEntries(r.accounts.map(a => [a.id, a]))
ok(by.M.status === 'active' && by.J.status === 'less' && by.K.status === 'idle' && by.N.status === 'new' && by.C.status === 'off', 'account statuses')
ok(by.M.email === 'm@x.com' && by.M.push && !by.Y.push && by.Y.is_admin && !by.M.is_admin, 'email/push/admin flags')
r = await handle(db, Y, { action: 'overview' })
ok(r.total === 5 && r.active === 2 && r.notStarted === 1 && r.pushUsers === 2 && r.openFeedback === 1 && r.mismatched === 1 && r.deletable === 1, 'overview ' + JSON.stringify({ t: r.total, a: r.active, n: r.notStarted, p: r.pushUsers, f: r.openFeedback, mm: r.mismatched, d: r.deletable }))
r = await handle(db, Y, { action: 'feedback' }); ok(r.items[0].name === '小美', 'feedback name')
await handle(db, Y, { action: 'feedback_handled', id: 1 }); ok(!!db.tables.feedback[0].handled_at && db.tables.feedback[0].handled_by === 'Y', 'mark handled')
await handle(db, Y, { action: 'feedback_handled', id: 1, handled: false }); ok(db.tables.feedback[0].handled_at === null, 'unmark handled')
r = await handle(db, Y, { action: 'temp_password', id: 'M' })
ok(r.ok && db.authUsers.find(u => u.id === 'M').password === r.password && db.tables.account_status.find(s => s.user_id === 'M').must_change_password === true, 'temp password set + flag')
ok(db.tables.admin_logs.some(l => l.action === 'temp_password' && l.target_name === '小美'), 'logged temp pw')
r = await handle(db, Y, { action: 'deactivate', id: 'Y' }); ok(!r.ok && /自己/.test(r.error), 'cannot deactivate self')
db.tables.admins.push({ user_id: 'M' })
r = await handle(db, Y, { action: 'deactivate', id: 'M' }); ok(!r.ok && /管理員/.test(r.error), 'cannot deactivate admin')
db.tables.admins.pop()
r = await handle(db, Y, { action: 'deactivate', id: 'J' })
ok(r.ok && db.authUsers.find(u => u.id === 'J').ban_duration === '876000h' && db.tables.account_status.find(s => s.user_id === 'J').deactivated_at && !db.tables.push_subscriptions.some(s => s.user_id === 'J'), 'deactivate bans + clears push')
r = await handle(db, Y, { action: 'delete', id: 'J', confirmName: '阿傑' }); ok(!r.ok && /30/.test(r.error), 'delete blocked before 30 days')
r = await handle(db, Y, { action: 'restore', id: 'J' }); ok(r.ok && db.authUsers.find(u => u.id === 'J').ban_duration === 'none' && db.tables.account_status.find(s => s.user_id === 'J').deactivated_at === null, 'restore')
r = await handle(db, Y, { action: 'set_referrer', id: 'M', referrerId: 'J' }); ok(!r.ok && /推薦的/.test(r.error), 'no cycle referrer')
r = await handle(db, Y, { action: 'set_referrer', id: 'M', referrerId: 'M' }); ok(!r.ok, 'no self referrer')
r = await handle(db, Y, { action: 'set_referrer', id: 'N', referrerId: 'Y' }); const n = db.tables.users.find(u => u.id === 'N')
ok(r.ok && n.referrer_id === 'Y' && n.referrer_email_pending === null, 'fix mismatched referrer')
r = await handle(db, Y, { action: 'remove_admin', id: 'Y' }); ok(!r.ok && /至少/.test(r.error), 'keep last admin')
r = await handle(db, Y, { action: 'add_admin', id: 'C' }); ok(!r.ok && /停用/.test(r.error), 'cannot add deactivated admin')
r = await handle(db, Y, { action: 'add_admin', id: 'M' }); ok(r.ok && db.tables.admins.length === 2, 'add admin')
r = await handle(db, Y, { action: 'remove_admin', id: 'Y' }); ok(r.ok && db.tables.admins.map(a => a.user_id).join() === 'M', 'remove self when another remains')
r = await handle(db, Y, { action: 'delete', id: 'C', confirmName: '春' }); ok(!r.ok && /名字/.test(r.error), 'delete wrong name')
r = await handle(db, Y, { action: 'delete', id: 'C', confirmName: ' 春嬌 ' })
ok(r.ok, 'delete ok')
ok(db.tables.users.find(u => u.id === 'K').referrer_id === 'J', 'kids relinked to upline')
ok(db.tables.teams.find(t => t.id === 'T1').creator_id === 'M', 'team to earliest other member')
ok(!db.tables.teams.find(t => t.id === 'T2'), 'solo team removed')
ok(!db.authUsers.find(u => u.id === 'C') && !db.tables.users.find(u => u.id === 'C'), 'auth + user gone')
ok(db.calls.findIndex(c => c[1] === 'admin_purge_user') < db.calls.findIndex(c => c[0] === 'authDelete'), 'purge before auth delete')
r = await handle(db, Y, { action: 'logs' }); ok(r.items.length >= 6 && r.items[0].actor_name === 'Yu', 'logs list ' + r.items.length)
r = await handle(db, Y, { action: 'whatever', id: 'M' }); ok(!r.ok, 'unknown action')
r = await handle(db, Y, { action: 'temp_password', id: 'ZZ' }); ok(!r.ok && r.status === 404, 'unknown id')
// handler auth
const mod = await import('../../api/admin.js')
const mkRes = () => { const o = { code: 0, body: null }; o.status = c => { o.code = c; return o }; o.json = b => { o.body = b; return o }; return o }
let res = mkRes(); await mod.default({ method: 'GET', headers: {} }, res); ok(res.code === 405, 'GET rejected')
res = mkRes(); await mod.default({ method: 'POST', headers: {} }, res); ok(res.code === 401, 'no token 401')
process.exit(fail)
