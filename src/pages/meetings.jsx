// meetings.jsx — 約會的唯一入口：定時間、改時間、刪除、自動算「見到」、見完了接上同一筆
// 一個約會 = counter_logs 一筆（counter_key='meetup'，planned_date＝約定那天，note＝「15:00 茶聊近況」）。
// 首頁、他的頁面、每日行動都從這裡讀寫，所以只要記一次。
// 規則：約定那天到了，就自動算「見到」（settleMeetings）；沒見成的自己改時間或刪掉。
import { useState } from 'react'
import { supabase } from '../supabase'
import { DateField } from './pickers'
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

// ---- 時間藏在文字前面：「15:00 茶聊近況」 ----
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
export function isMet(m) { return !!m.is_done || (!!m.planned_date && m.planned_date <= taipeiToday()) }
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

// ---- 約定那天到了，自動算見到 ----
// 只動「見面」這一種；其他（BV 分享、展示生意、賣票）仍是自己按「完成」。
export async function settleMeetings(userId) {
  const t = taipeiToday()
  const { data } = await supabase.from('counter_logs')
    .select('id,planned_date').eq('user_id', userId).eq('counter_key', MEET_KEY)
    .eq('is_done', false).not('planned_date', 'is', null).lte('planned_date', t).limit(200)
  const byDate = {}
  ;(data || []).forEach(r => { (byDate[r.planned_date] = byDate[r.planned_date] || []).push(r.id) })
  for (const d of Object.keys(byDate)) {
    await supabase.from('counter_logs').update({ is_done: true, date: d }).in('id', byDate[d])
  }
  return (data || []).length
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
  if (date <= t) await settleMeetings(userId)
  return { error: null }
}

// ---- 改時間 ----
export async function rescheduleMeeting(userId, log, { plan, date, time }) {
  const t = taipeiToday()
  if (!date) return { error: '先選哪一天' }
  if (date < t && !log.is_done) return { error: '日期要今天或之後' }
  const { error } = await supabase.from('counter_logs').update({
    planned_date: date, note: joinTime(time, plan), is_done: false,
    date: date < t ? date : t,
  }).eq('id', log.id)
  if (error) return { error: '沒存成功，再按一次試試' }
  await syncContactNext(userId, log.contact_id)
  if (date <= t) await settleMeetings(userId)
  return { error: null }
}

// ---- 刪除（沒見成） ----
export async function removeMeeting(userId, log) {
  const { error } = await supabase.from('counter_logs').delete().eq('id', log.id)
  if (error) return { error: '沒刪成功，再按一次試試' }
  await syncContactNext(userId, log.contact_id)
  return { error: null }
}

// ---- 見完了：接到同一筆，沒有的話記一筆已見到 ----
// logId：從約會清單按進來時有；從他的頁面按進來時，找最近 7 天內（或之後最近一筆）這個人的約會。
export async function recordMetNow(userId, contactId, logId) {
  const t = taipeiToday()
  let log = null
  if (logId) {
    const { data } = await supabase.from('counter_logs').select('id,planned_date,is_done').eq('id', logId).single()
    log = data
  } else {
    const { data } = await supabase.from('counter_logs')
      .select('id,planned_date,is_done').eq('user_id', userId).eq('counter_key', MEET_KEY)
      .eq('contact_id', contactId).gte('planned_date', addDaysStr(t, -7))
      .order('planned_date', { ascending: false }).limit(10)
    const rows = data || []
    // 優先接最近已過或今天的；沒有就接最近一筆還沒到的（提早見到了）
    log = rows.find(r => r.planned_date <= t) || rows[rows.length - 1] || null
  }
  if (log) {
    const upd = { is_done: true }
    if (log.planned_date > t) { upd.planned_date = t; upd.date = t } else { upd.date = log.planned_date }
    await supabase.from('counter_logs').update(upd).eq('id', log.id)
    await syncContactNext(userId, contactId)
    return
  }
  await supabase.from('counter_logs').insert({
    user_id: userId, counter_key: MEET_KEY, date: t, planned_date: t, is_done: true,
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
export async function recordPastMeeting(userId, contact, { plan, date, time }) {
  const t = taipeiToday()
  if (!date || date >= t) return { error: '請選今天以前的日期' }
  const { error } = await supabase.from('counter_logs').insert({
    user_id: userId, counter_key: MEET_KEY, date, planned_date: date, is_done: true,
    contact_id: contact.id, note: joinTime(time, plan),
  })
  if (error) return { error: '沒存成功，再按一次試試' }
  await supabase.from('contact_logs').insert({
    contact_id: contact.id, user_id: userId, date, kind: 'meet', note: joinTime(time, plan),
  })
  return { error: null }
}

// ---- 一週／一個月的顯示用：把約會整理成格子要的狀態 ----
export function dayState(list, dateStr) {
  const items = list.filter(m => m.eff === dateStr)
  if (items.length === 0) return { items, kind: 'none' }
  return { items, kind: items.every(isMet) ? 'done' : 'plan' }
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
  const [date, setDate] = useState(editing ? log.planned_date : (initialDate || ''))
  const [time, setTime] = useState(init.time)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const person = picked
  const lv = person && INTEREST_LEVELS.find(x => x.label === person.interest_level)
  const suggested = lv ? lv.plans : []
  const chips = ['茶聊近況'].concat(suggested, ALL_PLANS.filter(p => !suggested.includes(p)))
    .filter((p, i, a) => a.indexOf(p) === i)
  const today = taipeiToday()

  async function save() {
    if (saving) return
    if (!person) { setErr('先選一位'); return }
    setSaving(true); setErr('')
    const vals = { plan, date, time }
    const isPast = !editing && date && date < today
    const res = editing ? await rescheduleMeeting(userId, log, vals)
      : isPast ? await recordPastMeeting(userId, person, vals) : await scheduleMeeting(userId, person, vals)
    setSaving(false)
    if (res.error) { setErr(res.error); return }
    onSaved && onSaved()
    onClose()
  }
  async function del() {
    if (saving) return
    setSaving(true)
    const res = await removeMeeting(userId, log)
    setSaving(false)
    if (res.error) { setErr(res.error); return }
    onSaved && onSaved()
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
              <DateField value={date} min={editing ? (log.is_done ? undefined : today) : addDaysStr(today, -60)} clearable={false}
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
          {saving ? '儲存中…' : (editing ? '儲存' : (date && date < today ? '記下這次見面' : '定下了'))}
        </button>
        {editing && (
          <button onClick={del} disabled={saving}
            style={{ width: '100%', marginTop: 8, padding: 10, border: 'none', background: 'none', color: DANGER, fontSize: 13, cursor: 'pointer' }}>
            沒見成，刪除這個約會
          </button>
        )}
        {!editing && (
          <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginTop: 8 }}>
            {date && date < today ? '選的是過去的日子，會直接記成已見到' : '存起來後會出現在每日行動；約定那天到了，自動算見到'}
          </div>
        )}
      </div>
    </div>
  )
}

// 給別處用的小樣式
export const meetStyles = { PRIMARY_SOFT, SUBCARD_BG }
