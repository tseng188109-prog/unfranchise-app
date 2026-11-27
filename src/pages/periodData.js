// periodData.js — 讀一段日期的行動和成果（分享圖卡和給帶領者的報告共用同一份讀法和算法）
import { supabase } from '../supabase'
import { fetchAddedContacts } from './addedDate'
import { addDaysStr } from './meetings'
import { computeActions, computeResults } from '../lib/results'

export function eachDay(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d)
  return out
}
export function spanDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) + 1 }
const WD = ['日', '一', '二', '三', '四', '五', '六']
const md = d => `${+d.slice(5, 7)}/${+d.slice(8)}`
const wd = d => WD[new Date(d + 'T12:00:00Z').getUTCDay()]
export const rangeText = (from, to) => `${md(from)}（${wd(from)}）到 ${md(to)}（${wd(to)}）`
const tpDate = iso => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
const safe = p => p.then(r => r, () => ({ data: [] }))

// rich：給帶領者的報告要用到每個人的蛋、需求度、興趣和下一次約會
export async function loadPeriod(userId, from, to, { rich = false } = {}) {
  const days = eachDay(from, to)
  const startIso = from + 'T00:00:00+08:00'
  const endIso = addDaysStr(to, 1) + 'T00:00:00+08:00'
  const ctSel = rich ? 'contacts(id,name,source,egg_type,need_level,interest_level,next_plan,next_plan_date,last_contact_date)' : 'contacts(id,name,source)'
  const [logsR, custR, meetR, added, trialR, homeR, newR, txR] = await Promise.all([
    supabase.from('contact_logs').select(`id,contact_id,date,kind,note,tool,${ctSel}`)
      .eq('user_id', userId).gte('date', from).lte('date', to),
    supabase.from('customers').select('id,contact_id').eq('user_id', userId).eq('is_archived', false).limit(500),
    supabase.from('counter_logs').select('id,contact_id,date,planned_date,note,contacts(id,name)')
      .eq('user_id', userId).eq('counter_key', 'meetup').eq('is_done', true).gte('date', from).lte('date', to),
    fetchAddedContacts(supabase, { userId, from, to }),
    safe(supabase.from('trial_runs').select('contact_id,steps').eq('user_id', userId)),
    safe(supabase.from('customers').select('id,name,home_list_given_on').eq('user_id', userId).gte('home_list_given_on', from).lte('home_list_given_on', to)),
    supabase.from('customers').select('id,name,created_at').eq('user_id', userId).gte('created_at', startIso).lt('created_at', endIso),
    supabase.from('transactions').select('date,type,points,customer_id,product_name,amount,cost,is_gift')
      .eq('user_id', userId).gte('date', from).lte('date', to),
  ])
  const allLogs = logsR.data || []
  const custByContact = new Set((custR.data || []).filter(c => c.contact_id).map(c => c.contact_id))
  // 顧客的互動是「關心顧客」，不算進潛在夥伴的行動
  const isCare = l => custByContact.has(l.contact_id) || (l.contacts && l.contacts.source === 'customer')
  const logs = allLogs.filter(l => !isCare(l))
  const meets = meetR.data || []
  // 沒先約、直接見面後補記的，也算一次定下（顧客的不算）
  const unplanned = meets.filter(r => r.contact_id && !r.note && r.planned_date === r.date && !custByContact.has(r.contact_id))
    .map(r => ({ contact_id: r.contact_id, date: r.date, kind: 'meet_plan' }))
  const actions = computeActions({ days, logs, unplanned, added })

  const trials = (trialR.data || []).filter(t => {
    const s = t.steps || {}
    return [s['1'], s['3'], s['4']].some(d => d && d >= from && d <= to)
  })
  const tx = txR.data || []
  const needNames = [...new Set(trials.map(t => t.contact_id))]
  const needCust = [...new Set(tx.map(t => t.customer_id).filter(Boolean))]
  const [nmR, cnR] = await Promise.all([
    needNames.length ? supabase.from('contacts').select('id,name').in('id', needNames) : Promise.resolve({ data: [] }),
    needCust.length ? supabase.from('customers').select('id,name').in('id', needCust) : Promise.resolve({ data: [] }),
  ])
  const names = Object.fromEntries((nmR.data || []).map(c => [c.id, c.name]))
  const custNames = Object.fromEntries((cnR.data || []).map(c => [c.id, c.name]))
  const results = computeResults({
    from, to,
    planLogs: allLogs.filter(l => l.kind === 'meet_plan'),
    meets, trials, names,
    homeLists: homeR.data || [],
    newCusts: (newR.data || []).map(c => ({ ...c, day: tpDate(c.created_at) })),
    tx, custNames,
  })
  return { from, to, days, allLogs, logs, unplanned, added, meets, actions, results, tx, custByContact }
}

// 數字摘要（亮點拿來跟前一段比）
export function periodNumbers(p) {
  const r = p.results
  return {
    met: r.met.length, bizPlanned: r.bizPlanned.length, bizMet: r.bizMet.length, survey: r.surveyPeople,
    newCust: r.newCust.length, bv: r.bv, ibv: r.ibv,
    fresh: p.actions.fresh, asks: p.actions.asks, talk: p.actions.talk,
  }
}

// 邀約評估事業的人：讀他們到約成那天為止的互動紀錄和加入名單的日期（只讀這幾位）
export async function loadBizPaths(userId, people, to) {
  const ids = [...new Set(people.map(p => p.id).filter(Boolean))]
  if (!ids.length) return { logs: [], contacts: [], meets: [] }
  const [lR, cR, mR] = await Promise.all([
    supabase.from('contact_logs').select('contact_id,date,kind,note,tool').eq('user_id', userId).in('contact_id', ids).lte('date', to).limit(1000),
    supabase.from('contacts').select('id,added_date,created_at').in('id', ids),
    supabase.from('counter_logs').select('contact_id,date,note').eq('user_id', userId).eq('counter_key', 'meetup').eq('is_done', true).in('contact_id', ids).limit(200),
  ])
  return { logs: lR.data || [], contacts: cR.data || [], meets: mR.data || [] }
}

// 月曆上的小綠點：這個月哪幾天有記錄行動（只讀日期）
const markCache = new Map()
export async function loadActionDays(userId, monthStart, monthEnd) {
  const key = userId + monthStart
  const hit = markCache.get(key)
  if (hit && Date.now() - hit.t < 60000) return hit.v
  const [a, b] = await Promise.all([
    supabase.from('contact_logs').select('date').eq('user_id', userId).gte('date', monthStart).lte('date', monthEnd).limit(2000),
    supabase.from('counter_logs').select('date').eq('user_id', userId).eq('counter_key', 'meetup').eq('is_done', true).gte('date', monthStart).lte('date', monthEnd).limit(500),
  ])
  const v = new Set([...(a.data || []), ...(b.data || [])].map(r => r.date))
  markCache.set(key, { t: Date.now(), v })
  return v
}
