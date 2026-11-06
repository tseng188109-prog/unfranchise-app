// invite.jsx — 「記一次邀約」：開口邀了就記，不管對方答不答應
//   邀誰 → 哪天邀的（可以補記昨天）→ 邀了什麼（含近期活動）→ 結果
//   結果三種，都算在「邀的那天」的 3-1-2「1」：
//     約成了    → contact_logs kind 'meet_plan'＋一筆約會（counter_logs），也算每週「定下」
//     沒約成    → contact_logs kind 'invite_no'，照原因冷卻幾天再推薦
//     還在等回覆 → contact_logs kind 'invite_wait'，3 天後首頁每天問「他回了嗎？」，按了約成／沒約成就把同一筆改掉（不會多算一次）
// 同一個人只留最新的一筆「等回覆」；舊的自動結束成「沒約成（後來又邀了一次）」。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { DateField } from './pickers'
import { askConfirm } from './confirmDialog'
import { DayPicker } from './addedDate'
import { syncDaily3, markDaily312 } from './followUp'
import { MEET_KEY, taipeiToday, addDaysStr, joinTime, splitTime, syncContactNext, PersonPickSheet } from './meetings'
import { ALL_PLANS, INTEREST_LEVELS, Chip, AfterMeetSheet, fmtPlanDate } from './meetingFlow'
import { fetchUpcomingEvents, invitePlanText, isInvitedTo, INVITE_PREFIX } from './eventInvite'
import { REASONS, NO_HEAD, SUPERSEDED, confirmTag } from './beanJar'
import { PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_SECONDARY, TEXT_MUTED, BORDER, RADIUS, DANGER, SUBCARD_BG } from './designTokens'

export const WAIT_HEAD = '邀了，等回覆'
export const ASK_KINDS = ['meet_plan', 'invite_no', 'invite_wait']
export const WAIT_REMIND_DAYS = 3
const SAVE_FAIL = '沒存成功，再按一次試試'
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

// 這筆邀約邀了什麼（約聚餐、一對一會談、邀請參加 某活動…）
export function planOf(log) {
  const note = String((log && log.note) || '')
  if (!log) return ''
  if (log.kind === 'meet_plan') return splitTime(note).label
  if (log.kind === 'invite_wait') return note.startsWith(WAIT_HEAD + '：') ? note.slice(WAIT_HEAD.length + 1) : ''
  if (log.kind === 'invite_no') { const s = note.split('　').find(x => x.startsWith('邀的是 ')); return s ? s.slice(4) : '' }
  return ''
}
function noNote(reason, said, plan, confirmDate) {
  return [NO_HEAD + (reason ? '：' + reason : ''), (said || '').trim(), plan ? '邀的是 ' + plan : '', confirmDate ? confirmTag(confirmDate) : '']
    .filter(Boolean).join('　')
}

// 等回覆超過 3 天的（首頁提醒用）：同一個人只留最新一筆；封存、先不排的人不提醒
export async function fetchWaitingInvites(userId) {
  try {
    const { data } = await supabase.from('contact_logs').select('id,contact_id,date,note,kind,contacts(id,name,is_archived,is_muted)')
      .eq('user_id', userId).eq('kind', 'invite_wait')
    const latest = new Map()
    ;(data || []).forEach(l => {
      if (!l.contacts || l.contacts.is_archived || l.contacts.is_muted) return
      const cur = latest.get(l.contact_id)
      if (!cur || l.date > cur.date) latest.set(l.contact_id, l)
    })
    const due = addDaysStr(taipeiToday(), -WAIT_REMIND_DAYS)
    return [...latest.values()].filter(l => l.date <= due).sort((a, b) => a.date.localeCompare(b.date))
  } catch { return [] }
}

// 存一次邀約。o：{ date, plan, ev, result: 'yes'|'no'|'wait', meetDate, time, reason, said, waitLog }
// waitLog：從「他回了嗎？」按進來的那筆等回覆，把它改成約成／沒約成（日期不變）
export async function saveInvite(userId, contact, o) {
  const t = taipeiToday()
  const wl = o.waitLog || null
  const date = wl ? wl.date : (o.date || t)
  if (date > t) return { error: '邀的日期最晚是今天' }
  if (!o.result) return { error: '選一下結果' }
  const plan = o.ev ? invitePlanText(o.ev) : (o.plan || '').trim()
  let logId = wl ? wl.id : null
  let counterId = null, meetDate = null
  if (o.result === 'yes') {
    meetDate = o.ev ? o.ev.event_date : o.meetDate
    if (!meetDate) return { error: '選一下見面是哪一天' }
    if (meetDate < date) return { error: '見面的日子要在邀的那天或之後' }
    const text = o.ev ? plan : joinTime(o.time, plan)
    const { data: row, error: e1 } = await supabase.from('counter_logs').insert({
      user_id: userId, counter_key: MEET_KEY, date, planned_date: meetDate, is_done: false, contact_id: contact.id, note: text,
    }).select('id').single()
    if (e1 || !row) return { error: SAVE_FAIL }
    counterId = row.id
    const res = wl
      ? await supabase.from('contact_logs').update({ kind: 'meet_plan', note: text }).eq('id', wl.id)
      : await supabase.from('contact_logs').insert({ contact_id: contact.id, user_id: userId, date, kind: 'meet_plan', note: text }).select('id').single()
    if (res.error) { await supabase.from('counter_logs').delete().eq('id', counterId); return { error: SAVE_FAIL } }
    if (!wl && res.data) logId = res.data.id
    await syncContactNext(userId, contact.id)
    await markDaily312(supabase, userId, date)
  } else if (o.result === 'no') {
    // 等了好幾天才確定沒約成：冷卻從確定的那天算
    const note = noNote(o.reason, o.said, plan, wl && t !== date ? t : '')
    const res = wl
      ? await supabase.from('contact_logs').update({ kind: 'invite_no', note }).eq('id', wl.id)
      : await supabase.from('contact_logs').insert({ contact_id: contact.id, user_id: userId, date, kind: 'invite_no', note }).select('id').single()
    if (res.error) return { error: SAVE_FAIL }
    if (!wl && res.data) logId = res.data.id
  } else {
    const res = await supabase.from('contact_logs').insert({
      contact_id: contact.id, user_id: userId, date, kind: 'invite_wait', note: WAIT_HEAD + (plan ? '：' + plan : ''),
    }).select('id').single()
    if (res.error) return { error: SAVE_FAIL }
    if (res.data) logId = res.data.id
  }
  // 同一個人只留最新一筆等回覆，其他的結束掉（不然首頁會問兩次）。
  // 這次是約成／沒約成：這天以前的等回覆都結束（又邀了一次，就不用再問上一次了）
  try {
    const { data: waits } = await supabase.from('contact_logs').select('id,date').eq('contact_id', contact.id).eq('kind', 'invite_wait')
    const list = (waits || []).slice().sort((a, b) => (b.date.localeCompare(a.date)) || (a.id === logId ? -1 : b.id === logId ? 1 : 0))
    const keep = o.result === 'wait' ? (list[0] && list[0].id) : null
    for (const w of list.filter(x => x.id !== keep && (o.result === 'wait' || x.date <= date))) {
      await supabase.from('contact_logs').update({ kind: 'invite_no', note: noNote('', SUPERSEDED, '', t) }).eq('id', w.id)
    }
  } catch { /* 收不掉就算了，首頁只會多一條提醒 */ }
  // 最近互動：開口就算互動
  const { data: cur } = await supabase.from('contacts').select('last_contact_date').eq('id', contact.id).single()
  const upd = { last_interacted_at: new Date().toISOString() }
  if (!cur || !cur.last_contact_date || date >= cur.last_contact_date) upd.last_contact_date = date
  await supabase.from('contacts').update(upd).eq('id', contact.id)
  await syncDaily3(supabase, userId, date)
  return { error: null, counterId, meetDate, metPast: o.result === 'yes' && meetDate < t }
}

const sec = { background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 12, marginTop: 10 }
const label = { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }
const inputBox = { padding: '9px 12px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 14, outline: 'none',
  background: 'var(--card)', color: TEXT_MAIN, boxSizing: 'border-box' }
const RESULTS = [['yes', '約成了'], ['no', '沒約成'], ['wait', '還在等回覆']]
const FIRST_CHIPS = 4

// contact：從首頁或他的頁面帶進來的人；waitLog：從「他回了嗎？」帶進來（要有 contacts 或另外給 contact）
export function InviteSheet({ userId, contact, waitLog, initialResult, onClose, onSaved }) {
  const t = taipeiToday()
  const resolving = !!waitLog
  const [person, setPerson] = useState(contact || null)
  const [picking, setPicking] = useState(false)
  const [date, setDate] = useState(t)
  const [plan, setPlan] = useState(() => (resolving ? planOf(waitLog) : ''))
  const [evId, setEvId] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [result, setResult] = useState(initialResult || '')
  const [meetDate, setMeetDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState('')
  const [events, setEvents] = useState([])
  const [plans, setPlans] = useState([])
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [after, setAfter] = useState(null)

  useEffect(() => { fetchUpcomingEvents(supabase, 10).then(evs => setEvents(evs || [])) }, [])
  // 這個人今天以後的約會：已經邀過的活動不再列出；已經有約的提醒一下
  useEffect(() => {
    if (!person) { setPlans([]); return }
    let alive = true
    supabase.from('counter_logs').select('contact_id,planned_date,note,is_done').eq('contact_id', person.id).eq('counter_key', MEET_KEY)
      .eq('is_done', false).gte('planned_date', t)
      .then(({ data }) => { if (alive) setPlans((data || []).slice().sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)))) })
    return () => { alive = false }
  }, [person && person.id])
  // 等回覆的是活動：找回那個活動，約成了就自動帶活動那天
  useEffect(() => {
    if (!resolving || !plan.startsWith(INVITE_PREFIX)) return
    const ev = events.find(e => invitePlanText(e) === plan)
    if (ev) setEvId(ev.id)
  }, [events])

  const ev = events.find(e => e.id === evId) || null
  const lv = person && INTEREST_LEVELS.find(x => x.label === person.interest_level)
  const suggested = lv ? lv.plans : []
  const chips = ['見面聊聊'].concat(suggested, ALL_PLANS.filter(p => !suggested.includes(p))).filter((p, i, a) => a.indexOf(p) === i)
  const shownChips = moreOpen || (plan && !chips.slice(0, FIRST_CHIPS).includes(plan) && chips.includes(plan)) ? chips : chips.slice(0, FIRST_CHIPS)
  const evChoices = events.filter(e => e.id === evId || !(person && isInvitedTo(person, e, plans)))
  const hasPlan = !resolving && plans.length > 0 ? plans[0] : null

  async function save() {
    if (saving) return
    if (!person) { setErr('先選邀誰'); return }
    setSaving(true); setErr('')
    const res = await saveInvite(userId, person, { date, plan, ev, result, meetDate, time, reason, said, waitLog })
    setSaving(false)
    if (res.error) { setErr(res.error); return }
    // 畫面重新讀取放到最後（他的頁面重新讀取時會把這個視窗收掉，接著要問的「見完了嗎」就不見了）
    if (res.metPast) {
      const ok = await askConfirm({ title: '這次見完了嗎？', message: `約的是 ${md(res.meetDate)}，日子已經過了。見完了就接著記一下；還沒的話，首頁會再問你。`, okText: '見完了，記一下', cancelText: '還沒' })
      if (ok) {
        const { data } = await supabase.from('contacts').select('*').eq('id', person.id).single()
        if (data) { setAfter({ contact: data, logId: res.counterId, date: res.meetDate }); return }
      }
    }
    finish()
  }
  function finish() { onSaved && onSaved(); onClose() }

  if (after) {
    return <AfterMeetSheet contact={after.contact} userId={userId} logId={after.logId} initialDate={after.date}
      onClose={finish} />
  }

  const title = !resolving ? '記一次邀約'
    : result === 'no' ? `邀了${person ? person.name : ''}，沒約成`
    : `${person ? person.name : ''}答應了，定個時間`
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--page)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
        </div>

        {resolving ? (
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 6 }}>
            {md(waitLog.date)} 邀的{plan ? `：${plan}` : ''}。算在 {md(waitLog.date)} 那天，不會重複算。
          </div>
        ) : (
          <>
            <div style={sec}>
              <div style={label}>邀誰</div>
              <button type="button" onClick={() => setPicking(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', ...inputBox, cursor: 'pointer' }}>
                <span style={{ fontWeight: 600, color: person ? TEXT_MAIN : TEXT_MUTED }}>{person ? person.name : '選一位'}</span>
                <span style={{ fontSize: 13, color: PRIMARY }}>{person ? '換人 ›' : '選 ›'}</span>
              </button>
              {hasPlan && (
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 8 }}>
                  他已經約了 {fmtPlanDate(hasPlan.planned_date)}{hasPlan.note ? ` ${hasPlan.note}` : ''}，還是可以再記一筆
                </div>
              )}
            </div>

            <div style={sec}>
              <div style={label}>哪天邀的</div>
              <DayPicker value={date} onChange={d => { setDate(d); setErr('') }} hint="算進那天的 3-1-2。" />
            </div>

            <div style={sec}>
              <div style={label}>邀了什麼</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {shownChips.map(p => (
                  <Chip key={p} on={!ev && plan === p}
                    onClick={() => { setEvId(null); setPlan(plan === p && !ev ? '' : p) }}>{p}</Chip>
                ))}
                {!moreOpen && shownChips.length < chips.length && <Chip dashed onClick={() => setMoreOpen(true)}>更多</Chip>}
              </div>
              {moreOpen && (
                <input value={ev ? '' : plan} onChange={e => { setEvId(null); setPlan(e.target.value) }} placeholder="或自己寫"
                  style={{ ...inputBox, width: '100%', marginTop: 4, fontSize: 13 }} />
              )}
              {evChoices.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, margin: '6px 0 6px' }}>近期活動</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {evChoices.map(e => (
                      <Chip key={e.id} on={evId === e.id} onClick={() => setEvId(evId === e.id ? null : e.id)}>
                        {md(e.event_date)} {e.title}
                      </Chip>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div style={sec}>
          <div style={label}>結果</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${resolving ? 2 : 3}, 1fr)`, gap: 6 }}>
            {RESULTS.filter(([k]) => !resolving || k !== 'wait').map(([k, txt]) => (
              <button key={k} type="button" onClick={() => { setResult(k); setErr('') }}
                style={{ padding: '10px 4px', borderRadius: RADIUS.md, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${result === k ? PRIMARY : BORDER}`, background: result === k ? PRIMARY_SOFT : 'var(--card)',
                  color: result === k ? PRIMARY : TEXT_MAIN }}>{txt}</button>
            ))}
          </div>

          {result === 'yes' && (
            <div style={{ background: SUBCARD_BG, borderRadius: RADIUS.md, padding: 10, marginTop: 10 }}>
              {ev ? (
                <div style={{ fontSize: 13, color: TEXT_MAIN }}>見面那天就是活動那天：{fmtPlanDate(ev.event_date)}</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6 }}>約在哪天、幾點</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <DateField value={meetDate} min={resolving ? waitLog.date : date} clearable={false}
                        onChange={e => { setMeetDate(e.target.value); setErr('') }}
                        style={{ ...inputBox, width: '100%', textAlign: 'left' }} />
                    </div>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputBox, width: 112 }} />
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6, lineHeight: 1.5 }}>
                    幾點可以不填。{meetDate && meetDate < t ? '這天已經過了，存完會問你見完了沒。' : '存起來會出現在每日行動，見完面記得按「見完了」。'}
                  </div>
                </>
              )}
            </div>
          )}

          {result === 'no' && (
            <div style={{ background: SUBCARD_BG, borderRadius: RADIUS.md, padding: 10, marginTop: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 2 }}>
                {REASONS.map(r => <Chip key={r} on={reason === r} onClick={() => setReason(reason === r ? '' : r)}>{r}</Chip>)}
              </div>
              <input value={said} onChange={e => setSaid(e.target.value)} placeholder="對方怎麼說（選填）"
                style={{ ...inputBox, width: '100%', fontSize: 13 }} />
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>開口就算數。記一下原因，下次比較知道怎麼約。</div>
            </div>
          )}

          {result === 'wait' && (
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 10, lineHeight: 1.5 }}>
              {WAIT_REMIND_DAYS} 天後首頁會問你他回了沒。等回覆的這段時間，不會再推薦你去邀他。
            </div>
          )}
        </div>

        {err && <div style={{ color: DANGER, fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button onClick={save} disabled={saving}
          style={{ width: '100%', marginTop: 14, padding: 13, border: 'none', borderRadius: RADIUS.md, background: PRIMARY, color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '儲存中…' : '記下來'}
        </button>
      </div>
      {picking && (
        <div onClick={e => e.stopPropagation()}>
          <PersonPickSheet userId={userId} title="邀誰？" onClose={() => setPicking(false)}
            onPick={c => { setPerson(c); setEvId(null); setPicking(false) }} />
        </div>
      )}
    </div>
  )
}
