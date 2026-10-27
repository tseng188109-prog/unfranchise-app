// 顧客和互動名單是同一個人：顧客頁記的互動，就是互動名單那位的互動（contact_logs 同一份）。
// 這裡放「顧客 → 互動檔案」的連結、建立、封存同步。
// 規則：
//  - 互動名單裡找不到同名的人，才會自動建立一份新的互動檔案（source = 'customer'），並連到顧客。
//  - 找到同名的人時不自動連，交給使用者按「是，連起來」（標注不自動推導）。
//  - source = 'customer' 的檔案不算「新名單」、不當「新朋友」，也不會自動寫關係階段或下次聯絡日。
import { markDaily312, syncDaily3 } from './followUp'

function taipeiToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }

// 互動名單裡「同名、未封存」的人
export async function findSameNameContacts(supabase, customer) {
  if (!customer || !customer.name) return []
  const { data } = await supabase.from('contacts')
    .select('id,name,occupation')
    .eq('user_id', customer.user_id).eq('name', customer.name).eq('is_archived', false).limit(3)
  return data || []
}

// 幫這位顧客建立互動檔案並連起來，回傳新檔案的 id（失敗回傳 null）
export async function createContactForCustomer(supabase, customer) {
  const { data, error } = await supabase.from('contacts').insert({
    user_id: customer.user_id,
    name: customer.name,
    occupation: customer.occupation || null,
    source: 'customer',
    is_muted: false,
  }).select('id').single()
  if (error || !data) return null
  const { error: e2 } = await supabase.from('customers').update({ contact_id: data.id }).eq('id', customer.id)
  if (e2) return null
  return data.id
}

// 記一筆互動到互動名單那位（contactId）。和互動名單頁的「新增」做一樣的事：
// 寫 contact_logs、更新最近互動，並算進今天的 3-1-2。不動下次聯絡日（顧客的提醒由老顧客關懷卡負責）。
async function writeInteraction(supabase, userId, contactId, note) {
  const dt = taipeiToday()
  await supabase.from('contact_logs').insert({
    contact_id: contactId, user_id: userId, date: dt, note: note || null,
  })
  await supabase.from('contacts').update({
    last_interacted_at: new Date().toISOString(), last_contact_date: dt,
  }).eq('id', contactId)
  await syncDaily3(supabase, userId, dt)
  await markDaily312(supabase, userId, dt)
}

// 「我關心過了」：記下最近一次關心，同時記成一筆互動。
// 還沒連到互動名單、而且沒有同名的人時，順便建立互動檔案；有同名的人就只記時間，等使用者自己決定要不要連。
export async function logCareInteraction(supabase, customerId) {
  const nowIso = new Date().toISOString()
  const { data: customer } = await supabase.from('customers')
    .select('id,user_id,name,occupation,contact_id').eq('id', customerId).single()
  if (!customer) return
  await supabase.from('customers')
    .update({ last_cared_at: nowIso, care_snoozed_until: null }).eq('id', customerId)
  let contactId = customer.contact_id
  if (!contactId) {
    const same = await findSameNameContacts(supabase, customer)
    if (same.length === 0) contactId = await createContactForCustomer(supabase, customer)
  }
  if (contactId) await writeInteraction(supabase, customer.user_id, contactId, '關心過了')
}

// 封存顧客時，如果對應的互動檔案是自動建的、而且沒有任何互動和約定，就一起封存。
export async function archiveLinkedPlainContact(supabase, contactId) {
  if (!contactId) return
  const { data: ct } = await supabase.from('contacts')
    .select('id,source,next_plan').eq('id', contactId).single()
  if (!ct || ct.source !== 'customer' || ct.next_plan) return
  const { count } = await supabase.from('contact_logs')
    .select('id', { count: 'exact', head: true }).eq('contact_id', contactId)
  if ((count || 0) > 0) return
  await supabase.from('contacts').update({ is_archived: true }).eq('id', contactId)
}

// 復原顧客時，自動建的互動檔案如果被一起封存了，也一起復原。
export async function restoreLinkedPlainContact(supabase, contactId) {
  if (!contactId) return
  await supabase.from('contacts')
    .update({ is_archived: false }).eq('id', contactId).eq('source', 'customer')
}

// 上面兩個的「用顧客 id 查」版本，給只有顧客 id 的地方用（顧客名單、編輯頁）
export async function archiveContactOfCustomer(supabase, customerId) {
  const { data } = await supabase.from('customers').select('contact_id').eq('id', customerId).single()
  if (data) await archiveLinkedPlainContact(supabase, data.contact_id)
}
export async function restoreContactOfCustomer(supabase, customerId) {
  const { data } = await supabase.from('customers').select('contact_id').eq('id', customerId).single()
  if (data) await restoreLinkedPlainContact(supabase, data.contact_id)
}
