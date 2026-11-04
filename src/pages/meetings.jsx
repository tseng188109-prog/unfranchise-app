// meetings.jsx — 約會的唯一入口：定時間、改時間、刪除、見完了接上同一筆
// 一個約會 = counter_logs 一筆（counter_key='meetup'，planned_date＝約定那天，note＝「15:00 見面聊聊」）。
// 首頁、他的頁面、每日行動都從這裡讀寫，所以只要記一次。
// 規則：按了「見完了」才算「見到」（is_done）。約定那天過了還沒記，首頁和每日行動會問「見了嗎？」。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { DateField } from './pickers'
import { askConfirm } from './confirmDialog'
import { undoableDelete } from './undoDelete'
import { markDaily312, syncDaily3 } from './followUp'
import { INTEREST_LEVELS, ALL_PLANS, Chip } from './meetingFlow'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_SECONDARY, TEXT_MUTED, BORDER, SUBCARD_BG, RADIUS, DANGER,
} from './designTokens'

export const MEET_KEY = 'meetup'
export function taipeiToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
export function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

// ---- 時間藏在文字前面：「15:00 見面聊聊」 ----
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)\s+(.*)$/
export function splitTime(text) {
  const t = (text || '').trim()
  const m = t.match(TIME_RE)
  if (!m) return { time: '', label: t }
  return { time: m[1].padStart(2, '0') + ':' + m[2], label: m[3] }
}
export function joinTime(time, label) {
  const l = (label || '').trim() || '見面'
  return time ? `${time} ${l}` : l
}

// ---- 抓約會 ----
// 回傳這段日期內的約會（含已見到的），每筆帶聯絡人名字。
// eff＝這筆算在哪一天：已見到的看「見到的那天」，還沒到的看「約定那天」。
const MEET_COLS = 'id,counter_key,date,planned_date,is_done,note,contact_id,contacts(id,name,need_tags,last_quote)'
export function withEff(r) { return { ...r, eff: r.is_done ? (r.date || r.planned_date) : (r.planned_date || r.date) } }
export function isMet(m) { return !!m.is_done }
// 約定那天已經過了（不含今天），但還沒記「見完了」
export function isPending(m) { return !m.is_done && !!m.planned_date && m.planned_date < taipeiToday() }
export async function fetchMeetings(userId, fromDate, toDate) {
  const q1 = supabase.from('counter_logs').select(MEET_COLS)
    .eq('user_id', userId).eq('counter_key', MEET_KEY).gte('planned_date', fromDate).lte('planned_date', toDate)
  const q2 = supabase.from('counter_logs').select(MEET_COLS)
    .eq('user_id', userId).eq('counter_key', MEET_KEY).eq('is_done', true).gte('date', fromDate).lte('date', toDate)
  const [r1, r2] = await Promise.all([q1, q2])
  const map = new Map()
  ;[...(r1.data || []), ...(r2.data || [])].forEach(r => map.set(r.id, withEff(r)))
  return [...map.values()].filter(m => m.eff >= fromDate && m.eff <= toDate).sort((a, b) => {
    if (a.eff !== b.eff) return a.eff < b.eff ? -1 : 1
    return (splitTime(a.note).time || '99').localeCompare(splitTime(b.note).time || '99')
  })
}

// ---- 以前：約定那天到了自動算見到。現在改成「見完了」才算，這個函式不再做任何事 ----
// 留著是因為舊版畫面還可能呼叫；回傳 0。
export async function settleMeetings() { return 0 }

// 沒先約、直接見面後才記的（補記時沒有對應的約定）：也算一次「定下」，算在見面那天
// 回傳 [{ contact_id, date, kind: 'meet_plan' }]，可以直接跟 meet_plan 互動紀錄一起算
export async function fetchUnplannedMeets(userId, from, to) {
  try {
    const { data } = await supabase.from('counter_logs').select('contact_id,date,planned_date,note')
      .eq('user_id', userId).eq('counter_key', MEET_KEY).eq('is_done', true).gte('date', from).lte('date', to)
    return (data || []).filter(r => r.contact_id && !r.note && r.planned_date === r.date)
      .map(r => ({ contact_id: r.contact_id, date: r.date, kind: 'meet_plan' }))
  } catch { return [] }
}

// 他的頁面刪掉一筆「約好下一次」互動紀錄時：那個約定也一起取消
// 紀錄和約定沒有直接連結，用「同一個人、還沒見、約做什麼一樣」找；找不到就用定下那天找
export async function cancelPlanForLog(userId, log) {
  if (!log || log.kind !== 'meet_plan') return
  const { data } = await supabase.from('counter_logs').select('id,date,note')
    .eq('contact_id', log.contact_id).eq('counter_key', MEET_KEY).eq('is_done', false).limit(20)
  const rows = data || []
  const hit = rows.find(r => log.note && r.note === log.note) || rows.find(r => r.date === log.date)
  if (!hit) return
  await supabase.from('counter_logs').delete().eq('id', hit.id)
  await syncContactNext(userId, log.contact_id)
}

// 過了日期、還沒記「見完了」的約定（首頁「見了嗎？」用）
export async function fetchPendingMeets(userId, limit = 20) {
  const { data } = await supabase.from('counter_logs')
    .select('id,contact_id,planned_date,date,is_done,note,contacts(id,name)')
    .eq('user_id', userId).eq('counter_key', MEET_KEY).eq('is_done', false)
    .not('planned_date', 'is', null).lt('planned_date', taipeiToday())
    .order('planned_date', { ascending: false }).limit(limit)
  return (data || []).filter(m => m.contact_id)
}

// ---- 聯絡人的「下一次」永遠指到最近一筆（今天以後） ----
export async function syncContactNext(userId, contactId) {
  if (!contactId) return
  const t = taipeiToday()
  const { data } = await supabase.from('counter_logs')
    .select('planned_date,note').eq('user_id', userId).eq('counter_key', MEET_KEY)
    .eq('contact_id', contactId).gte('planned_date', t)
    .order('planned_date', { ascending: true }).limit(1)
  const r = data && data[0]
  await supabase.from('contacts').update(
    r ? { next_plan: r.note || '見面', next_plan_date: r.planned_date } : { next_plan: null, next_plan_date: null }
  ).eq('id', contactId)
}

// ---- 定時間 ----
export async function scheduleMeeting(userId, contact, { plan, date, time }) {
  const t = taipeiToday()
  if (!date) return { error: '先選哪一天' }
  if (date < t) return { error: '日期要今天或之後；已經見過的請用「見完了，記一下」' }
  const text = joinTime(time, plan)
  const { error: e1 } = await supabase.from('counter_logs').insert({
    user_id: userId, counter_key: MEET_KEY, date: t, planned_date: date, is_done: false,
    contact_id: contact.id, note: text,
  })
  if (e1) return { error: '沒存成功，再按一次試試' }
  // 算進今天的「定下一個碰面」
  await supabase.from('contact_logs').insert({
    contact_id: contact.id, user_id: userId, date: t, kind: 'meet_plan', note: text,
  })
  await supabase.from('contacts').update({
    last_interacted_at: new Date().toISOString(), last_contact_date: t,
  }).eq('id', contact.id)
  await syncContactNext(userId, contact.id)
  await syncDaily3(supabase, userId, t)
  await markDaily312(supabase, userId, t)
  return { error: null }
}

// ---- 改時間 ----
export async function rescheduleMeeting(userId, log, { plan, date, time }) {
  const t = taipeiToday()
  if (!date) return { error: '先選哪一天' }
  if (date < t) return { error: '日期要今天或之後；已經見過的請按「見完了」' }
  const { error } = await supabase.from('counter_logs').update({
    planned_date: date, note: joinTime(time, plan), is_done: false, date: t,
  }).eq('id', log.id)
  if (error) return { error: '沒存成功，再按一次試試' }
  await syncContactNext(userId, log.contact_id)
  return { error: null }
}

// ---- 刪除（沒見成） ----
export async function removeMeeting(userId, log) {
  const { error } = await supabase.from('counter_logs').delete().eq('id', log.id)
  if (error) return { error: '沒刪成功，再按一次試試' }
  await syncContactNext(userId, log.contact_id)
  return { error: null }
}

// 刪除約定（有確認、8 秒內可以復原）。after：刪掉或復原之後要重新整理的畫面
export async function removeMeetingWithUndo(userId, log, after) {
  const { data: row } = await supabase.from('counter_logs').select('*').eq('id', log.id).maybeSingle()
  const done = !!(row && row.is_done)
  if (!(await askConfirm({ title: done ? '刪除這次見面？' : '刪除這次約定？',
    message: (done ? '他的頁面裡那筆見面紀錄也會一起刪掉。' : '') + '刪除後 8 秒內可以按「復原」。', okText: '刪除', danger: true }))) return { cancelled: true }
  // 已經見過的：他的頁面裡同一天那筆「見面」互動紀錄一起刪，兩邊數字才對得上
  let meetLog = null
  if (done && row.contact_id) {
    const { data: ml } = await supabase.from('contact_logs').select('*')
      .eq('contact_id', row.contact_id).eq('kind', 'meet').eq('date', row.date).limit(1)
    meetLog = (ml && ml[0]) || null
  }
  const res = await removeMeeting(userId, log)
  if (res.error) return res
  if (meetLog) await supabase.from('contact_logs').delete().eq('id', meetLog.id)
  after && after()
  if (row) undoableDelete({
    label: row.note || (done ? '這次見面' : '這次約定'),
    commit: async () => null,
    undo: async () => {
      await supabase.from('counter_logs').insert(row)
      if (meetLog) await supabase.from('contact_logs').insert(meetLog)
      await syncContactNext(userId, row.contact_id); after && after()
    },
  })
  return { error: null }
}

// 他的頁面刪掉一筆「見面」互動紀錄時：對應的見面也撤回
// 純補記的（沒有約定）直接刪；原本有約定的，變回「還沒記」，會再問「見了嗎？」
async function findMetRow(contactId, date) {
  const { data } = await supabase.from('counter_logs').select('id,planned_date,date,note,is_done')
    .eq('contact_id', contactId).eq('counter_key', MEET_KEY).eq('is_done', true).eq('date', date).limit(1)
  return (data && data[0]) || null
}
export async function unlinkMeetForLog(userId, log) {
  if (!log || log.kind !== 'meet') return
  const row = await findMetRow(log.contact_id, log.date)
  if (!row) return
  if (!row.note && row.planned_date === row.date) await supabase.from('counter_logs').delete().eq('id', row.id)
  else await supabase.from('counter_logs').update({ is_done: false }).eq('id', row.id)
  await syncContactNext(userId, log.contact_id)
}
// 他的頁面改了「見面」互動紀錄的日期時：對應的見面日期一起改
export async function moveMeetForLog(log, newDate) {
  if (!log || log.kind !== 'meet' || !newDate || newDate === log.date) return
  const row = await findMetRow(log.contact_id, log.date)
  if (!row) return
  const upd = { date: newDate }
  if (!row.note && row.planned_date === row.date) upd.planned_date = newDate
  await supabase.from('counter_logs').update(upd).eq('id', row.id)
}

// ---- 見完了：接到同一筆，沒有的話記一筆已見到 ----
// logId：從約會清單按進來時有；從他的頁面按進來時，找最近 7 天內（或之後最近一筆）這個人的約會。
export async function recordMetNow(userId, contactId, logId, dateStr) {
  const d = dateStr || taipeiToday()
  let log = null
  if (logId) {
    const { data } = await supabase.from('counter_logs').select('id,planned_date,is_done').eq('id', logId).single()
    log = data
  } else {
    // 找這個人在見面那天前後 7 天內、還沒記見完的約定，接到同一筆，不會變成兩次見面
    const { data } = await supabase.from('counter_logs')
      .select('id,planned_date,is_done').eq('user_id', userId).eq('counter_key', MEET_KEY)
      .eq('contact_id', contactId).eq('is_done', false)
      .gte('planned_date', addDaysStr(d, -7)).lte('planned_date', addDaysStr(d, 7))
      .order('planned_date', { ascending: false }).limit(10)
    const rows = data || []
    // 優先接見面那天當天或之前最近的；沒有就接之後最近的一筆（提早見到了）
    log = rows.find(r => r.planned_date <= d) || rows[rows.length - 1] || null
  }
  if (log) {
    const upd = { is_done: true, date: d }
    if (log.planned_date > d) upd.planned_date = d
    await supabase.from('counter_logs').update(upd).eq('id', log.id)
    await syncContactNext(userId, contactId)
    return
  }
  await supabase.from('counter_logs').insert({
    user_id: userId, counter_key: MEET_KEY, date: d, planned_date: d, is_done: true,
    contact_id: contactId, note: null,
  })
}

// ---- 舊的約定補進來（更新前已經約好的）：只補今天以後、而且還沒有對應記錄的 ----
export async function backfillPlans(userId, contacts) {
  const t = taipeiToday()
  const wanted = (contacts || []).filter(c => c.next_plan && c.next_plan_date && c.next_plan_date >= t && !c.is_muted)
  if (wanted.length === 0) return 0
  const { data } = await supabase.from('counter_logs')
    .select('contact_id,planned_date').eq('user_id', userId).eq('counter_key', MEET_KEY).gte('planned_date', t).limit(500)
  const have = new Set((data || []).map(r => r.contact_id + '|' + r.planned_date))
  const rows = wanted.filter(c => !have.has(c.id + '|' + c.next_plan_date)).map(c => ({
    user_id: userId, counter_key: MEET_KEY, date: t, planned_date: c.next_plan_date, is_done: false,
    contact_id: c.id, note: c.next_plan,
  }))
  if (rows.length === 0) return 0
  await supabase.from('counter_logs').insert(rows)
  return rows.length
}

// ---- 刪除聯絡人前：預排的清掉，已發生的留下（名字變成「已刪除的聯絡人」） ----
export async function detachMeetingsBeforeDelete(userId, contactId) {
  const t = taipeiToday()
  await supabase.from('counter_logs').delete()
    .eq('user_id', userId).eq('contact_id', contactId).eq('counter_key', MEET_KEY).eq('is_done', false).gt('planned_date', t)
  await supabase.from('counter_logs').update({ contact_id: null }).eq('contact_id', contactId)
}

// ---- 已經見過的（過去的某一天）：直接記一筆已見到 ----

// ---- 一週／一個月的顯示用：把約會整理成格子要的狀態 ----
export function dayState(list, dateStr) {
  const items = list.filter(m => m.eff === dateStr)
  if (items.length === 0) return { items, kind: 'none' }
  return { items, kind: items.every(isMet) ? 'done' : items.some(isPending) ? 'pending' : 'plan' }
}

// ---- 定時間的小視窗 ----
function inputBox() {
  return { padding: '9px 12px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 14, outline: 'none',
    background: 'var(--card)', color: TEXT_MAIN, boxSizing: 'border-box' }
}

export function ScheduleSheet({ userId, contact, contacts, log, initialDate, onClose, onSaved }) {
  const editing = !!log
  const init = editing ? splitTime(log.note) : { time: '', label: '' }
  const [picked, setPicked] = useState(contact || null)
  const [q, setQ] = useState('')
  const [plan, setPlan] = useState(init.label)
  // 定時間只能今天以後；從過去的日子按進來就先空著
  const [date, setDate] = useState(() => { const d = editing ? log.planned_date : (initialDate || ''); return d && d < taipeiToday() ? '' : d })
  const [time, setTime] = useState(init.time)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const person = picked
  const lv = person && INTEREST_LEVELS.find(x => x.label === person.interest_level)
  const suggested = lv ? lv.plans : []
  const chips = ['見面聊聊'].concat(suggested, ALL_PLANS.filter(p => !suggested.includes(p)))
    .filter((p, i, a) => a.indexOf(p) === i)
  const today = taipeiToday()

  async function save() {
    if (saving) return
    if (!person) { setErr('先選一位'); return }
    setSaving(true); setErr('')
    const vals = { plan, date, time }
    const res = editing ? await rescheduleMeeting(userId, log, vals) : await scheduleMeeting(userId, person, vals)
    setSaving(false)
    if (res.error) { setErr(res.error); return }
    onSaved && onSaved()
    onClose()
  }
  async function del() {
    if (saving) return
    setSaving(true)
    const res = await removeMeetingWithUndo(userId, log, () => { onSaved && onSaved() })
    setSaving(false)
    if (res.cancelled) return
    if (res.error) { setErr(res.error); return }
    onClose()
  }

  const sec = { background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 12, marginTop: 10 }
  const list = (contacts || []).filter(c => !q.trim() || (c.name || '').toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30)
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--page)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>
            {person ? (editing ? `改和${person.name}的時間` : `和${person.name}定個時間`) : '和誰定個時間'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
        </div>

        {!contact && !editing && (
          <div style={sec}>
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>選一位</div>
            {picked ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN }}>{picked.name}</span>
                <button onClick={() => setPicked(null)} style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 13, cursor: 'pointer' }}>換一位</button>
              </div>
            ) : (
              <>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="打名字找"
                  style={{ ...inputBox(), width: '100%' }} />
                <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
                  {list.map(c => (
                    <button key={c.id} type="button" onClick={() => setPicked(c)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                        borderTop: `1px solid ${BORDER}`, padding: '10px 2px', fontSize: 14, color: TEXT_MAIN, cursor: 'pointer' }}>
                      {c.name}
                    </button>
                  ))}
                  {list.length === 0 && <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '8px 2px' }}>找不到，請先到互動名單新增</div>}
                </div>
              </>
            )}
          </div>
        )}

        <div style={sec}>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>約做什麼</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {chips.map((p, i) => (
              <Chip key={p} tone={i === 0 || suggested.includes(p) ? 'green' : undefined} on={plan === p} onClick={() => setPlan(plan === p ? '' : p)}>
                {p}{(i === 0 || suggested.includes(p)) && plan !== p ? ' · 建議' : ''}
              </Chip>
            ))}
          </div>
          <input value={plan} onChange={e => setPlan(e.target.value)} placeholder="或自己寫"
            style={{ ...inputBox(), width: '100%', marginTop: 4, fontSize: 13 }} />
        </div>

        <div style={sec}>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>哪天、幾點</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <DateField value={date} min={today} clearable={false}
                onChange={e => { setDate(e.target.value); setErr('') }}
                style={{ ...inputBox(), width: '100%', textAlign: 'left' }} />
            </div>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ ...inputBox(), width: 112 }} />
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.5 }}>
            約的時候給對方兩個時間選，並說明大概一小時。幾點可以不填。
          </div>
        </div>

        {err && <div style={{ color: DANGER, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <button onClick={save} disabled={saving}
          style={{ width: '100%', marginTop: 14, padding: 13, border: 'none', borderRadius: RADIUS.md, background: PRIMARY, color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '儲存中…' : (editing ? '儲存' : '定下了')}
        </button>
        {editing && (
          <button onClick={del} disabled={saving}
            style={{ width: '100%', marginTop: 8, padding: 10, border: 'none', background: 'none', color: DANGER, fontSize: 13, cursor: 'pointer' }}>
            沒見成，刪除這個約會
          </button>
        )}
        {!editing && (
          <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginTop: 8 }}>
            存起來後會出現在每日行動。見完面記得按「見完了」，才會算見到。
          </div>
        )}
      </div>
    </div>
  )
}

// 給別處用的小樣式
export const meetStyles = { PRIMARY_SOFT, SUBCARD_BG }

// 補記見面：先選「跟誰見面」。搜尋框下面先列最近互動過的 5 位，打字後換成搜尋結果。
// onPick 會拿到完整的 contact（見完了畫面要用）
export function PersonPickSheet({ userId, title = '跟誰見面？', onPick, onClose }) {
  const [all, setAll] = useState(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    let alive = true
    supabase.from('contacts').select('id,name,last_interacted_at').eq('user_id', userId).eq('is_archived', false)
      .order('last_interacted_at', { ascending: false, nullsFirst: false }).limit(500)
      .then(({ data }) => { if (alive) setAll(data || []) })
    return () => { alive = false }
  }, [userId])
  const kw = q.trim().toLowerCase()
  const recent = (all || []).filter(c => c.last_interacted_at)
    .sort((a, b) => String(b.last_interacted_at).localeCompare(String(a.last_interacted_at))).slice(0, 5)
  const list = kw ? (all || []).filter(c => (c.name || '').toLowerCase().includes(kw)).slice(0, 30) : recent
  async function pick(c) {
    const { data } = await supabase.from('contacts').select('*').eq('id', c.id).single()
    if (data) onPick(data)
  }
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--page)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋姓名…" autoFocus
          style={{ ...inputBox(), width: '100%' }} />
        {!kw && <div style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '12px 0 4px' }}>最近互動過</div>}
        <div style={{ marginTop: kw ? 8 : 0 }}>
          {all === null && <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '8px 2px' }}>讀取中…</div>}
          {list.map(c => (
            <button key={c.id} type="button" onClick={() => pick(c)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                borderTop: `1px solid ${BORDER}`, padding: '11px 2px', fontSize: 14, color: TEXT_MAIN, cursor: 'pointer' }}>
              {c.name}
            </button>
          ))}
          {all !== null && list.length === 0 && (
            <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '8px 2px' }}>{kw ? '找不到，請先到互動名單新增' : '還沒有互動過的人，打名字找'}</div>
          )}
        </div>
      </div>
    </div>
  )
}
