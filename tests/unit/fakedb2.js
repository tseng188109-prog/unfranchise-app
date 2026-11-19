export function makeDb(tables, rpcs = {}, authUsers = []) {
  let idc = 100
  const calls = []
  const db = { tables, calls, authUsers,
    rpc(name, args) { calls.push(['rpc', name, args]); const f = rpcs[name]; return Promise.resolve(f ? f(args, tables) : { data: null, error: { message: 'no rpc ' + name } }) },
    auth: { admin: {
      listUsers: async () => ({ data: { users: authUsers }, error: null }),
      getUserById: async (id) => ({ data: { user: authUsers.find(u => u.id === id) || null }, error: null }),
      updateUserById: async (id, p) => { calls.push(['authUpdate', id, p]); const u = authUsers.find(x => x.id === id); Object.assign(u, p); return { data: { user: u }, error: null } },
      deleteUser: async (id) => { calls.push(['authDelete', id]); authUsers.splice(authUsers.findIndex(u => u.id === id), 1); return { error: null } },
    } },
    from(t) {
      const rows = tables[t] || (tables[t] = [])
      let rng = null, filt = [], mode = 'select', payload = null, single = false, order = null, limit = null, conflict = null
      const q = {
        select() { return q }, eq(k, v) { filt.push(r => r[k] === v); return q }, is(k, v) { filt.push(r => (r[k] ?? null) === v); return q },
        in(k, vs) { filt.push(r => vs.includes(r[k])); return q }, gte(k, v) { filt.push(r => r[k] != null && r[k] >= v); return q }, lte(k, v) { filt.push(r => r[k] != null && r[k] <= v); return q }, lt(k, v) { filt.push(r => r[k] != null && r[k] < v); return q }, range(a, b) { rng = [a, b]; return q }, not(k, op, v) { const vals = String(v).replace(/[()]/g, '').split(','); filt.push(r => !vals.includes(r[k])); return q }, order(k, o) { order = [k, o && o.ascending === false ? -1 : 1]; return q }, limit(n) { limit = n; return q },
        single() { single = true; return q }, maybeSingle() { single = true; return q },
        insert(p) { mode = 'insert'; payload = p; return q }, update(p) { mode = 'update'; payload = p; return q }, delete() { mode = 'delete'; return q },
        upsert(p, o) { mode = 'upsert'; payload = p; conflict = o && o.onConflict; return q },
        then(res, rej) { try {
          calls.push([mode, t, payload])
          let out
          if (mode === 'insert') { const r = { id: idc++, created_at: new Date().toISOString(), ...payload }; rows.push(r); out = single ? r : [r] }
          else if (mode === 'upsert') { const k = conflict || 'id'; const ex = rows.find(r => r[k] === payload[k]); if (ex) Object.assign(ex, payload); else rows.push({ ...payload }); out = [payload] }
          else { let m = rows.filter(r => filt.every(f => f(r)))
            if (mode === 'update') { m.forEach(r => Object.assign(r, payload)); out = m }
            else if (mode === 'delete') { m.forEach(r => rows.splice(rows.indexOf(r), 1)); out = m }
            else { if (order) m = [...m].sort((a, b) => (a[order[0]] > b[order[0]] ? 1 : -1) * order[1]); if (limit) m = m.slice(0, limit); if (rng) m = m.slice(rng[0], rng[1] + 1); out = single ? (m[0] || null) : m } }
          res({ data: out, error: null }) } catch (e) { rej(e) } },
      }
      return q
    } }
  return db
}
