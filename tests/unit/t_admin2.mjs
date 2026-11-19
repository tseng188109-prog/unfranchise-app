import { handle } from '../../api/admin.js'
import { makeDb } from './fakedb2.js'
import { deviceOf, stuckOf, pageName } from '../../src/lib/device.js'
let P = 0, F = 0; const ok = (c, m) => { if (c) P++; else { F++; console.log('FAIL', m) } }
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
function setup(withOnb = true) {
  const tables = {
    users: [{ id: 'Y', name: 'Yu', created_at: '2026-05-01T00:00:00Z' }, { id: 'A', name: 'Abby', created_at: '2026-05-01T00:00:00Z' }, { id: 'B', name: '', created_at: '2026-05-01T00:00:00Z' }, { id: 'C', name: '春嬌', created_at: '2026-05-01T00:00:00Z' }, { id: 'D', name: '大明', created_at: '2026-05-01T00:00:00Z' }],
    account_status: [{ user_id: 'D', deactivated_at: new Date().toISOString() }], push_subscriptions: [{ user_id: 'C' }], admins: [{ user_id: 'Y' }], admin_logs: [], push_runs: [], feedback: [],
    login_events: [{ user_id: 'A', at: '2026-11-18T13:04:00Z', device: 'iPhone' }, { user_id: 'A', at: '2026-11-12T00:31:00Z', device: 'Windows 電腦' }, { user_id: 'C', at: '2026-11-10T00:00:00Z', device: 'Android' }],
    app_errors: [{ id: 1, page: '首頁', message: 'boom', device: 'iPhone', count: 5, first_at: '2026-11-18T00:00:00Z', last_at: '2026-11-19T06:02:00Z', handled_at: null },
      { id: 2, page: '互動名單', message: 'old', device: 'Android', count: 1, first_at: '2026-11-01T00:00:00Z', last_at: '2026-11-01T00:00:00Z', handled_at: '2026-11-02T00:00:00Z' },
      { id: 3, page: '首頁', message: 'again', device: 'iPhone', count: 1, first_at: '2026-11-01T00:00:00Z', last_at: '2026-11-01T00:00:00Z', handled_at: '2026-11-02T00:00:00Z' },
      { id: 4, page: '首頁', message: 'again', device: 'iPhone', count: 2, first_at: '2026-11-10T00:00:00Z', last_at: '2026-11-10T00:00:00Z', handled_at: null }],
    app_error_hits: [{ error_id: 1, user_id: 'A' }, { error_id: 1, user_id: 'A' }, { error_id: 1, user_id: 'C' }, { error_id: 1, user_id: 'Y' }, { error_id: 4, user_id: 'A' }],
  }
  const sessions = { A: [{ created_at: '2026-11-15T01:00:00Z', last_at: '2026-11-19T05:00:00Z', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)' }, { created_at: '2026-11-01T01:00:00Z', last_at: '2026-11-02T05:00:00Z', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64)' }] }
  const rpcs = {
    admin_last_seen: () => ({ data: [{ user_id: 'Y', last_day: today }], error: null }),
    admin_sessions: ({ p_user_id }) => ({ data: sessions[p_user_id] || [], error: null }),
    admin_signout_all: ({ p_user_id }) => { const n = (sessions[p_user_id] || []).length; sessions[p_user_id] = []; return { data: n, error: null } },
  }
  if (withOnb) rpcs.admin_onboarding = () => ({ data: [
    { user_id: 'Y', signed_in: true, has_contacts: true, has_logs: true },
    { user_id: 'A', signed_in: true, has_contacts: true, has_logs: false },
    { user_id: 'B', signed_in: false, has_contacts: false, has_logs: false },
    { user_id: 'C', signed_in: true, has_contacts: false, has_logs: false },
    { user_id: 'D', signed_in: false, has_contacts: false, has_logs: false }], error: null })
  return makeDb(tables, rpcs, ['Y', 'A', 'B', 'C', 'D'].map(id => ({ id, email: id.toLowerCase() + '@x.com' })))
}
const Y = { id: 'Y' }
let db = setup()
// 卡在哪
let r = await handle(db, Y, { action: 'accounts' }); let by = Object.fromEntries(r.accounts.map(a => [a.id, a]))
ok(by.Y.stuck === null, '都做到了 → 不顯示')
ok(by.A.stuck === '加了名單，還沒記過互動', 'A 卡在記互動')
ok(by.B.stuck === '註冊完還沒登入過', 'B 還沒登入')
ok(by.C.stuck === '登入過，還沒加名單', 'C 還沒加名單')
ok(by.D.stuck === null, '已停用 → 不顯示卡在哪')
ok(by.A.steps.has_contacts === true && by.A.steps.has_logs === false && !('contacts' in by.A.steps), '起步只有有沒有，沒有數量')
ok(!JSON.stringify(r).match(/contact_id|note|"count"/), '帳號資料裡沒有名單內容或數量')
// SQL 還沒跑：照常顯示，只是沒有卡在哪
let db0 = setup(false); r = await handle(db0, Y, { action: 'accounts' })
ok(r.ok && r.accounts.every(a => a.stuck === null && a.steps === null), 'SQL 還沒跑也不會壞')
// 裝置
r = await handle(db, Y, { action: 'devices', id: 'A' })
ok(r.sessions.length === 2 && r.sessions[0].device === 'iPhone' && r.sessions[1].device === 'Windows 電腦' && !('user_agent' in r.sessions[0]), '登入中的裝置：只給裝置種類，不給原始資訊')
ok(r.logins.length === 2 && r.logins[0].device === 'iPhone' && r.logins[0].at > r.logins[1].at, '最近登入：新的在前')
ok(!JSON.stringify(r).match(/"ip"|"ip_address"|location/i), "沒有 IP、位置")
r = await handle(db, Y, { action: 'devices', id: 'B' }); ok(r.sessions.length === 0 && r.logins.length === 0, '沒裝置、沒紀錄')
// 登出所有裝置
r = await handle(db, Y, { action: 'signout_all', id: 'A' })
ok(r.ok && r.count === 2, '登出 2 台')
ok(db.tables.admin_logs.some(l => l.action === 'signout_all' && l.target_name === 'Abby' && l.detail === '登出 2 台裝置'), '記進管理員紀錄')
r = await handle(db, Y, { action: 'devices', id: 'A' }); ok(r.sessions.length === 0, '登出後沒有裝置')
// 改名字
r = await handle(db, Y, { action: 'rename', id: 'B', name: '   ' }); ok(!r.ok && /空白/.test(r.error), '不能改成空白')
r = await handle(db, Y, { action: 'rename', id: 'B', name: '  林小美  ' })
ok(r.ok && db.tables.users.find(u => u.id === 'B').name === '林小美', '改名字（去掉前後空白）')
ok(db.tables.admin_logs.some(l => l.action === 'rename' && l.target_name === '林小美' && l.detail === '（沒名字） → 林小美'), '紀錄寫從什麼改成什麼')
const nLogs = db.tables.admin_logs.length
r = await handle(db, Y, { action: 'rename', id: 'B', name: '林小美' }); ok(r.ok && db.tables.admin_logs.length === nLogs, '名字沒變不記')
r = await handle(db, Y, { action: 'rename', id: 'B', name: 'x'.repeat(50) }); ok(db.tables.users.find(u => u.id === 'B').name.length === 30, '名字最多 30 字')
r = await handle(db, Y, { action: 'rename', id: 'ZZ', name: 'a' }); ok(!r.ok && r.status === 404, '找不到帳號')
// 出錯紀錄
r = await handle(db, Y, { action: 'errors' })
const e1 = r.items.find(e => e.id === 1)
ok(e1.people === 3 && e1.count === 5, '幾個人遇到（不重複算同一人）')
ok(!JSON.stringify(r.items).match(/"user_id"|Abby|春嬌/), '出錯紀錄不列名字')
r = await handle(db, Y, { action: 'overview' }); ok(r.openErrors === 2, '整體：2 種還沒修好')
await handle(db, Y, { action: 'error_handled', id: 1 })
ok(!!db.tables.app_errors[0].handled_at && db.tables.app_errors[0].handled_by === 'Y', '修好了')
r = await handle(db, Y, { action: 'overview' }); ok(r.openErrors === 1, '修好後剩 1 種')
r = await handle(db, Y, { action: 'error_handled', id: 1, handled: false }); ok(r.ok && db.tables.app_errors[0].handled_at === null, '改回還沒修好')
r = await handle(db, Y, { action: 'error_handled', id: 3, handled: false }); ok(!r.ok && /又出現/.test(r.error), '同一個錯誤已經有新的一筆 → 舊的不能再打開')
// 共用小工具
ok(deviceOf('Mozilla/5.0 (Linux; Android 14; Pixel)') === 'Android' && deviceOf('Mozilla/5.0 (iPad; CPU OS 17)') === 'iPad' && deviceOf(null) === '其他裝置', '裝置判斷')
ok(stuckOf(null) === null, '沒資料不顯示')
ok(pageName('/contacts/1b2c/edit') === '互動名單 → 編輯資料' && pageName('/?x=1') === '首頁', '頁面名字')
console.log('t_admin2 PASS', P, 'FAIL', F)
