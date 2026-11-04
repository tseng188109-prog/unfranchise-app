// addedDate.jsx — 「哪天加進名單的」
// 成功五要訣（BASIC-5）CD：每天往罐子裡放兩顆豆子——發展兩個新關係，或重建兩個老關係。
// 算「新名單」看的是你哪天決定把他放進名單（contacts.added_date），不是哪天打進 App。
// 以前的名單沒有 added_date，照舊用建立時間（created_at）。
// 欄位還沒建好（SQL 還沒跑）時，所有查詢自動退回只用建立時間，畫面照常。
import { DateField } from './pickers'
import { PRIMARY, TEXT_SECONDARY, RADIUS } from './designTokens'

export function twToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
export function twDay(iso) { return iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) : '' }
function addDay(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
export function twYesterday() { return addDay(twToday(), -1) }

// 這個人算在哪一天的新名單
export function addedDay(c) { return (c && (c.added_date || twDay(c.created_at))) || '' }

// 抓一段日期內（含頭尾，台北時間）加進名單的人（不含匯入、顧客自動建立的檔案）
// 回傳 [{ id, user_id, day, created_at }]
export async function fetchAddedContacts(supabase, { userId, userIds, from, to }) {
  const base = sel => {
    const q = supabase.from('contacts').select(sel).is('source', null)
    return userIds ? q.in('user_id', userIds) : q.eq('user_id', userId)
  }
  const fi = from + 'T00:00:00+08:00', ti = addDay(to, 1) + 'T00:00:00+08:00'
  try {
    const r1 = await base('id,user_id,added_date,created_at').gte('added_date', from).lte('added_date', to)
    if (!r1.error) {
      const r2 = await base('id,user_id,added_date,created_at').is('added_date', null).gte('created_at', fi).lt('created_at', ti)
      return [...(r1.data || []), ...(r2.data || [])].map(c => ({ ...c, day: addedDay(c) }))
    }
  } catch { /* 欄位還沒建好 */ }
  const r0 = await base('id,user_id,created_at').gte('created_at', fi).lt('created_at', ti)
  return (r0.data || []).map(c => ({ ...c, day: twDay(c.created_at) }))
}

// 有填「哪天加進名單的」的人：Map(id → 日期)；欄位不存在就回空的
export async function fetchAddedMap(supabase, userId) {
  try {
    const { data, error } = await supabase.from('contacts').select('id,added_date').eq('user_id', userId).not('added_date', 'is', null)
    if (error || !data) return new Map()
    return new Map(data.map(r => [r.id, r.added_date]))
  } catch { return new Map() }
}
export function withAddedDates(list, map) {
  if (!map || !map.size) return list
  return list.map(c => (map.has(c.id) ? { ...c, added_date: map.get(c.id) } : c))
}
// 把 added_date 補進已經抓好的名單（欄位不存在就原樣回傳）
export async function mergeAddedDates(supabase, userId, list) {
  return withAddedDates(list, await fetchAddedMap(supabase, userId))
}

// 寫入時欄位不存在：拿掉 added_date 再試一次
export async function writeWithAddedDate(run, payload) {
  let res = await run(payload)
  if (res.error && 'added_date' in payload && /added_date/.test(res.error.message || '')) {
    const rest = { ...payload }
    delete rest.added_date
    res = await run(rest)
  }
  return res
}

const chip = on => ({
  padding: '7px 14px', borderRadius: RADIUS.sm, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  background: on ? PRIMARY : 'var(--sub)', color: on ? '#fff' : TEXT_SECONDARY,
})
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

// 今天／昨天／選日期（最晚今天）。value 是 'YYYY-MM-DD'，空白當今天。新增名單、見完面都用這個
export function DayPicker({ value, onChange, hint }) {
  const t = twToday(), y = twYesterday()
  const v = value || t
  const custom = v !== t && v !== y
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => onChange(t)} style={chip(v === t)}>今天</button>
        <button type="button" onClick={() => onChange(y)} style={chip(v === y)}>昨天 {md(y)}</button>
        <DateField value={custom ? v : ''} max={t} clearable={false} placeholder="選日期"
          onChange={e => e.target.value && onChange(e.target.value)}
          style={{ ...chip(custom), width: 'auto', justifyContent: 'center' }} />
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
      )}
    </div>
  )
}

export function AddedDatePicker({ value, onChange }) {
  return <DayPicker value={value} onChange={onChange} hint="新認識的朋友，或重新聯絡上的老朋友都算。這一天會算進那天的新名單。" />
}
