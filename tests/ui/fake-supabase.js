let seq = 100
const T = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
const add = (n) => { const d = new Date(T + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }
export const db = window.__db = {
  users: [{ id: 'u', goal_declaration: '', tag_settings: {}, created_at: '2025-01-01T00:00:00Z' }],
  contacts: [
    { id: 'c3', user_id: 'u', name: '陳美玲', source: 'customer', is_archived: false, created_at: '2025-01-01T00:00:00Z' },
    { id: 'c1', user_id: 'u', name: '王怡茜', egg_type: '荷包蛋', need_level: '大二', action_type: '軟性活動', next_contact_date: '2026-01-01', interest_level: '有點興趣', need_tags: ['睡眠精神', '省錢'], last_quote: '最近很累', is_archived: false, source: null, created_at: '2025-01-01T00:00:00Z' },
    { id: 'c2', user_id: 'u', name: '林小美', egg_type: '生雞蛋', need_level: '大四', action_type: '商機講座', interest_level: '', need_tags: [], last_quote: null, is_archived: false, source: null, created_at: new Date().toISOString() },
  ],
  contact_logs: [
    { id: 'l9', user_id: 'u', contact_id: 'c3', date: T, kind: null, note: '問她維他命吃完了沒' },
    { id: 'l1', user_id: 'u', contact_id: 'c1', date: add(-1), kind: 'meet', note: '她說最近睡不好，對產品有興趣', tool: '一對一會談' },
    { id: 'l2', user_id: 'u', contact_id: 'c2', date: T, kind: 'meet_plan', note: null },
    { id: 'l3', user_id: 'u', contact_id: 'c2', date: add(-2), kind: null, note: '說想先觀望', tool: null },
  ],
  transactions: [{ user_id: 'u', customer_id:'k2', date: '2026-09-01', type: 'BV', points: 10, amount: 500, cost: 300, is_gift: false, product_name:'OPC-3' },{ user_id: 'u', date: add(-1), type: 'BV', points: 120, amount: 3000, cost: 2200, is_gift: false }], daily_checkins: [], counter_logs: [
    { id: 'm1', user_id: 'u', counter_key: 'meetup', date: T, planned_date: T, is_done: false, note: '14:30 體驗產品', contact_id: 'c1' },
    { id: 'm2', user_id: 'u', counter_key: 'meetup', date: T, planned_date: add(2), is_done: false, note: '一對一聊聊', contact_id: 'c2' },
    { id: 'm3', user_id: 'u', counter_key: 'meetup', date: add(-1), planned_date: add(-1), is_done: true, note: null, contact_id: 'c2' },
  ], events: [], sample_tracking: [], customers: [{id:'k1',user_id:'u',name:'陳美玲',contact_id:'c3',is_archived:false,last_cared_at:null,created_at:'2025-01-01T00:00:00Z'},{id:'k2',user_id:'u',name:'黃先生',contact_id:null,is_archived:false,last_cared_at:'2026-09-20T00:00:00Z',created_at:'2025-01-01T00:00:00Z'}],
}
window.__T = T; window.__add = add
function q(name) {
  const f = []; let mode = 'select'; let payload = null; let single = false; let ord = null; let head = false; let selStr = ''; let rng = null
  const rows = () => (db[name] || []).filter(r => f.every(fn => fn(r)))
  const embed = r => {
    if (name === 'contact_logs' && /contacts\(/.test(selStr)) return { ...r, contacts: db.contacts.find(c => c.id === r.contact_id) || null }
    if (name === 'counter_logs' && /contacts\(/.test(selStr)) return { ...r, contacts: db.contacts.find(c => c.id === r.contact_id) || null }
    return r
  }
  const run = () => {
    if (mode === 'insert') { const arr = Array.isArray(payload) ? payload : [payload]; const out = arr.map(v => { const r = { id: 'x' + (seq++), created_at: new Date().toISOString(), ...v }; db[name].push(r); return r }); window.__ops.push(['insert', name, payload]); return { data: single ? out[0] : out, error: null } }
    if (mode === 'update') { rows().forEach(r => Object.assign(r, payload)); window.__ops.push(['update', name, payload]); return { data: null, error: null } }
    if (mode === 'delete') { const del = new Set(rows()); db[name] = db[name].filter(r => !del.has(r)); window.__ops.push(['delete', name]); return { data: null, error: null } }
    let r = rows().map(embed)
    if (ord) r = r.slice().sort((a, b) => String(a[ord]).localeCompare(String(b[ord])))
    if (rng) r = r.slice(rng[0], rng[1] + 1)
    if (head) return { data: null, count: r.length, error: null }
    return { data: single ? (r[0] || null) : r, error: null }
  }
  const o = {
    select(s, opt) { selStr = s || ''; if (opt && opt.head) head = true; return o },
    eq(k, v) { f.push(r => r[k] === v); return o }, neq(k, v) { f.push(r => r[k] !== v); return o },
    in(k, v) { f.push(r => v.includes(r[k])); return o },
    gte(k, v) { f.push(r => r[k] != null && String(r[k]) >= v); return o },
    lte(k, v) { f.push(r => r[k] != null && String(r[k]) <= v); return o },
    lt(k, v) { f.push(r => r[k] != null && String(r[k]) < v); return o },
    gt(k, v) { f.push(r => r[k] != null && String(r[k]) > v); return o },
    not(k, op, v) { if (op === 'in') { const set = v.replace(/[()"]/g, '').split(','); f.push(r => !set.includes(r[k])) } else if (op === 'is') f.push(r => r[k] != null); return o },
    is(k, v) { f.push(r => (r[k] ?? null) === v); return o },
    limit() { return o }, range(a, b) { rng = [a, b]; return o }, or() { return o }, order(k) { ord = k; return o },
    single() { single = true; return Promise.resolve(run()) }, maybeSingle() { single = true; return Promise.resolve(run()) },
    insert(v) { mode = 'insert'; payload = v; return o }, update(v) { mode = 'update'; payload = v; return o }, delete() { mode = 'delete'; return o },
    upsert(v) { window.__ops.push(['upsert', name, v]); const arr = Array.isArray(v) ? v : [v]; arr.forEach(x => { const ex = db[name].find(r => r.user_id === x.user_id && r.date === x.date && r.task_key === x.task_key); if (ex) Object.assign(ex, x); else db[name].push({ id: 'u' + (seq++), ...x }) }); return Promise.resolve({ error: null }) },
    then(res, rej) { return Promise.resolve(run()).then(res, rej) },
  }
  return o
}
window.__ops = []
export const supabase = { from: q, auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u' } } }) }, rpc: () => Promise.resolve({ data: null, error: null }) }
