// 活動邀請：把「邀請參加某個活動」記成這個人的下一次約定。
// 不另外建邀請表：已邀 = 對方的下一次約定日期等於活動日期，而且約定文字是「邀請參加 活動名稱」。
import { markDaily312, syncDaily3 } from './followUp'
import { MEET_KEY, syncContactNext } from './meetings'

export const INVITE_PREFIX = '邀請參加 '

function taipeiToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }

export function invitePlanText(ev) { return INVITE_PREFIX + ev.title }

// 這位聯絡人是不是已經被邀請參加這個活動
// plans：這個人今天以後的約會清單（有的話，就算他另有更近的約會，也找得到這筆邀請）
export function isInvitedTo(contact, ev, plans) {
  if (!contact || !ev) return false
  if (contact.next_plan === invitePlanText(ev) && contact.next_plan_date === ev.event_date) return true
  return (plans || []).some(p => p.contact_id === contact.id && p.planned_date === ev.event_date && p.note === invitePlanText(ev))
}

// 邀請：記成一筆約會（每日行動看得到），算進本週約人，也算進今天的互動
export async function inviteToEvent(supabase, userId, contact, ev) {
  const dt = taipeiToday()
  const text = invitePlanText(ev)
  await supabase.from('contact_logs').insert({
    contact_id: contact.id, user_id: userId, date: dt, kind: 'meet_plan', note: text,
  })
  await supabase.from('counter_logs').insert({
    user_id: userId, counter_key: MEET_KEY, date: dt, planned_date: ev.event_date, is_done: false,
    contact_id: contact.id, note: text,
  })
  await supabase.from('contacts').update({
    last_interacted_at: new Date().toISOString(), last_contact_date: dt,
  }).eq('id', contact.id)
  await syncContactNext(userId, contact.id)
  await syncDaily3(supabase, userId, dt)
  await markDaily312(supabase, userId, dt)
}

// 取消邀請：只清掉這個活動的約會，其他約會不動
export async function cancelInvite(supabase, contact, ev, userId) {
  const text = invitePlanText(ev)
  await supabase.from('counter_logs').delete()
    .eq('contact_id', contact.id).eq('counter_key', MEET_KEY).eq('planned_date', ev.event_date).eq('note', text)
  if (contact.next_plan === text && contact.next_plan_date === ev.event_date) {
    await supabase.from('contacts').update({ next_plan: null, next_plan_date: null }).eq('id', contact.id)
  }
  if (userId) await syncContactNext(userId, contact.id)
}

export function daysUntil(dateStr) {
  const t = taipeiToday()
  return Math.round((new Date(dateStr + 'T00:00:00+08:00') - new Date(t + 'T00:00:00+08:00')) / 86400000)
}

// 抓還沒過的活動（RLS 會自動只給自己的 + 所屬團隊的）
export async function fetchUpcomingEvents(supabase, limit = 30) {
  const { data, error } = await supabase.from('events')
    .select('id,owner_id,team_id,title,event_date,event_time,place')
    .gte('event_date', taipeiToday()).order('event_date', { ascending: true }).limit(limit)
  return error ? [] : (data || [])
}
