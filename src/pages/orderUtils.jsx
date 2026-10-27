// 訂單共用工具：OrderForm（輸入）、OrderCard（顯示）、CustomerPanel / TransactionNew 都從這裡 import
// 資料怎麼存：
//   - 一張訂單 = orders 一列（日期、備註、折扣運費的設定）+ 好幾列 transactions（每個產品一列，order_id 指到訂單）
//   - 折扣、「我出」的運費另外存成 transactions 的列（line_kind = 'discount' / 'shipping'），
//     這樣首頁季總計、業績紀錄、顧客獲利這些原本的加總完全不用改，數字就是對的
//   - 沒有 order_id 的舊紀錄維持原樣，各自是一筆
import { supabase } from '../supabase'
import { toDateStr, getWeekDays } from './teamStats'

export const KIND_DISCOUNT = 'discount'
export const KIND_SHIPPING = 'shipping'

export function num(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
export function fmt(n) {
  return Math.round(Number(n) || 0).toLocaleString()
}
export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
export function blankLine() {
  return { key: uid(), product_name: '', quantity: '1', type: 'BV', points: '', amount: '', cost: '', is_gift: false }
}
// 數量（幾份）：點數、賣價、成本都是這一列「全部份數的合計」，數量只用來顯示和算回購日
export function qtyOf(t) {
  const n = Math.round(Number(t && t.quantity))
  return Number.isFinite(n) && n >= 1 ? n : 1
}
export function qtyLabel(t) {
  const q = qtyOf(t)
  return q > 1 ? ` ×${q}` : ''
}
export function r2(x) { return Math.round((Number(x) || 0) * 100) / 100 }
export function blankAdjustment(kind) {
  let value = ''
  if (kind === 'shipping') {
    try { value = localStorage.getItem('ufa_last_shipping') || '' } catch {}
  }
  return { id: uid(), kind, value, payer: 'me' }
}
export function shortDate(d) {
  if (!d) return ''
  const p = d.split('-')
  return `${Number(p[1])}/${Number(p[2])}`
}
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00+08:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
export function isProductRow(t) {
  return !t.line_kind
}

// 算整張訂單：lines 是表單裡的產品列，adjustments 是折扣運費的設定
export function computeOrder(lines, adjustments) {
  const used = lines.filter(l => (l.product_name || '').trim())
  const paid = used.filter(l => !l.is_gift)
  const gifts = used.filter(l => l.is_gift)

  let bv = 0, ibv = 0
  used.forEach(l => {
    if (l.type === 'IBV') ibv += num(l.points)
    else bv += num(l.points)
  })
  const listTotal = paid.reduce((s, l) => s + num(l.amount), 0)
  const missingPrice = paid.filter(l => !(num(l.amount) > 0)).length
  const costTotal = used.reduce((s, l) => s + num(l.cost), 0)
  const giftCost = gifts.reduce((s, l) => s + num(l.cost), 0)

  let discountTotal = 0, shipMe = 0, shipCustomer = 0
  const adjResults = []
  ;(adjustments || []).forEach(a => {
    const v = num(a.value)
    if (!(v > 0)) return
    if (a.kind === 'amount') {
      discountTotal += v
      adjResults.push({ id: a.id, kind: 'discount', label: '折扣', amount: v })
    } else if (a.kind === 'percent') {
      if (v >= 10) return
      const amt = Math.round(listTotal * (10 - v) / 10)
      discountTotal += amt
      adjResults.push({ id: a.id, kind: 'discount', label: `${v} 折`, amount: amt })
    } else if (a.kind === 'shipping') {
      if (a.payer === 'customer') {
        shipCustomer += v
        adjResults.push({ id: a.id, kind: 'shipping_customer', label: '運費', amount: v })
      } else {
        shipMe += v
        adjResults.push({ id: a.id, kind: 'shipping_me', label: '運費（我出）', amount: v })
      }
    }
  })

  const received = listTotal - discountTotal
  const profit = received - costTotal - shipMe
  const customerPays = received + shipCustomer
  return {
    used, paid, gifts, bv, ibv, listTotal, missingPrice, costTotal, giftCost,
    discountTotal, shipMe, shipCustomer, adjResults, received, profit, customerPays,
  }
}

// 把表單內容變成要寫進 transactions 的列
export function buildRows({ userId, customerId, orderId, date, lines, calc }) {
  const base = { user_id: userId, customer_id: customerId, order_id: orderId, date }
  const rows = calc.used.map(l => ({
    ...base,
    product_name: l.product_name.trim(),
    quantity: qtyOf(l),
    type: l.type === 'IBV' ? 'IBV' : 'BV',
    points: num(l.points),
    amount: l.is_gift ? 0 : num(l.amount),
    cost: String(l.cost).trim() === '' ? null : num(l.cost),
    is_gift: !!l.is_gift,
    line_kind: null,
  }))
  calc.adjResults.forEach(a => {
    if (a.kind === 'discount') {
      rows.push({ ...base, product_name: `折扣（${a.label}）`, type: 'BV', points: 0,
        amount: -a.amount, cost: 0, is_gift: false, line_kind: KIND_DISCOUNT })
    } else if (a.kind === 'shipping_me') {
      rows.push({ ...base, product_name: '運費（我出）', type: 'BV', points: 0,
        amount: 0, cost: a.amount, is_gift: false, line_kind: KIND_SHIPPING })
    }
  })
  return rows
}

// 折扣運費的設定只存「類型、數字、誰出」，算出來的金額每次重算
export function adjustmentSpec(adjustments) {
  return (adjustments || [])
    .filter(a => num(a.value) > 0)
    .map(a => ({ id: a.id, kind: a.kind, value: String(a.value), payer: a.payer || 'me' }))
}

// 把 transactions 整理成「訂單 / 舊的單筆」，新的在前
// orders：這位顧客的 orders 列（用 id 對）
export function groupPurchases(transactions, orders) {
  const orderMap = {}
  ;(orders || []).forEach(o => { orderMap[o.id] = o })
  const byOrder = {}
  const groups = []
  ;(transactions || []).forEach(t => {
    if (t.order_id && orderMap[t.order_id]) {
      let g = byOrder[t.order_id]
      if (!g) {
        g = { key: 'o:' + t.order_id, orderId: t.order_id, order: orderMap[t.order_id], date: orderMap[t.order_id].date, lines: [], adjRows: [] }
        byOrder[t.order_id] = g
        groups.push(g)
      }
      if (t.line_kind) g.adjRows.push(t)
      else g.lines.push(t)
    } else {
      groups.push({ key: 't:' + t.id, orderId: null, order: null, date: t.date, lines: [t], adjRows: [] })
    }
  })
  groups.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return groups
}

// 給顧客看的明細：只有品名和賣價，沒有成本、BV
export function buildCopyText(customerName, lines, calc) {
  const out = []
  out.push(`${customerName} 你好，這次幫你準備了：`)
  calc.paid.forEach(l => {
    const p = num(l.amount)
    out.push(`${l.product_name.trim()}${qtyLabel(l)}　${p > 0 ? fmt(p) : '（價錢待確認）'}`)
  })
  calc.gifts.forEach(g => out.push(`另外送你 ${g.product_name.trim()}${qtyLabel(g)}`))
  calc.adjResults.forEach(a => {
    if (a.kind === 'discount') out.push(`${a.label}　-${fmt(a.amount)}`)
    if (a.kind === 'shipping_customer') out.push(`運費　${fmt(a.amount)}`)
  })
  if (calc.paid.length > 0 && calc.missingPrice === 0) out.push(`合計　${fmt(calc.customerPays)}`)
  out.push('收到之後有任何問題，隨時跟我說')
  return out.join('\n')
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }
}

// 產品目錄：從過去的紀錄找每個產品最近一次的點數、成本、賣價
// customerId：同一位顧客上次賣的價錢優先
export async function fetchProductCatalog(userId, customerId) {
  const { data } = await supabase.from('transactions')
    .select('product_name,type,points,amount,cost,date,customer_id,is_gift,line_kind,quantity')
    .eq('user_id', userId).order('date', { ascending: false }).limit(1500)
  const map = {}
  const names = []
  ;(data || []).forEach(t => {
    if (t.line_kind) return
    const name = (t.product_name || '').trim()
    if (!name) return
    if (!map[name]) { map[name] = { name, type: null, points: null, cost: null, lastPrice: null, custPrice: null }; names.push(name) }
    const m = map[name]
    // 紀錄裡存的是合計，這裡換算成「一份」的數字，帶入新訂單時再乘上這次的數量
    const q = qtyOf(t)
    if (!t.is_gift) {
      if (m.type == null) { m.type = t.type; m.points = t.points != null ? Number(t.points) / q : null }
      if (m.cost == null && t.cost != null) m.cost = Number(t.cost) / q
      if (m.lastPrice == null && Number(t.amount) > 0) m.lastPrice = Number(t.amount) / q
      if (customerId && t.customer_id === customerId && m.custPrice == null && Number(t.amount) > 0) m.custPrice = Number(t.amount) / q
    } else if (m.cost == null && t.cost != null) {
      m.cost = Number(t.cost) / q
    }
  })
  return { map, names }
}

// 這位顧客上一次買的（不含贈品、折扣、運費），給「同上次再買」用
export async function fetchLastPurchase(customerId) {
  const { data } = await supabase.from('transactions')
    .select('id,order_id,date,product_name,type,points,amount,cost,is_gift,line_kind,quantity')
    .eq('customer_id', customerId).order('date', { ascending: false }).limit(200)
  const rows = (data || []).filter(t => !t.line_kind)
  if (rows.length === 0) return null
  const first = rows[0]
  const group = first.order_id
    ? rows.filter(t => t.order_id === first.order_id)
    : rows.filter(t => !t.order_id && t.date === first.date)
  const lines = group.filter(t => !t.is_gift)
  if (lines.length === 0) return null
  return { date: first.date, lines }
}

// 本結算週（週六到週五）的 BV / IBV
export async function fetchWeekPoints(userId) {
  const days = getWeekDays()
  const { data } = await supabase.from('transactions')
    .select('type,points').eq('user_id', userId)
    .gte('date', days[0]).lte('date', days[6])
  let bv = 0, ibv = 0
  ;(data || []).forEach(t => {
    if (t.type === 'IBV') ibv += Number(t.points) || 0
    else bv += Number(t.points) || 0
  })
  return { bv, ibv }
}

export async function fetchUseDays(userId) {
  const { data } = await supabase.from('product_use_days')
    .select('product_name,use_days').eq('user_id', userId)
  const map = {}
  ;(data || []).forEach(r => { map[r.product_name] = r.use_days })
  return map
}

export async function saveUseDays(userId, map) {
  const rows = Object.entries(map)
    .filter(([name, d]) => name && Number(d) > 0)
    .map(([name, d]) => ({ user_id: userId, product_name: name, use_days: Math.round(Number(d)), updated_at: new Date().toISOString() }))
  if (rows.length === 0) return
  await supabase.from('product_use_days').upsert(rows, { onConflict: 'user_id,product_name' })
}

// ───────── 回購提醒自動串聯 ─────────
// 訂單存好之後，用「一份能用幾天 × 份數」算出大概哪天用完，自動設成這位顧客的回購提醒。
// 回傳 state：
//   'auto'  已自動設好（previous 是原本的提醒，給「復原」用）
//   'same'  算出來的日期和現在的提醒一樣，不用動
//   'past'  算出來的日期已經過了，不設
//   'ask'   有產品還沒記過天數、或現在已經有一個還沒到的提醒（可能是自己設的）→ 交給使用者決定
//   'none'  不處理：沒有付費產品，或編輯的不是這位顧客最近一張訂單
export async function autoRepurchase({ customerId, orderId, date, calc, useDays, isEdit }) {
  const paid = (calc.paid || []).filter(l => (l.product_name || '').trim())
  if (paid.length === 0) return { state: 'none' }

  // 只處理「這位顧客最近一張訂單」：補登更早的訂單、或改舊訂單，不會把提醒往回改
  const { data: others } = await supabase.from('transactions')
    .select('date,order_id,line_kind').eq('customer_id', customerId)
    .order('date', { ascending: false }).limit(60)
  const maxOther = (others || [])
    .filter(t => !t.line_kind && !(orderId && t.order_id === orderId))
    .reduce((m, t) => (t.date > m ? t.date : m), '')
  const isLatest = !maxOther || date >= maxOther
  if (!isLatest) return { state: 'none' }

  const qty = {}
  paid.forEach(l => { const n = l.product_name.trim(); qty[n] = (qty[n] || 0) + qtyOf(l) })
  const names = Object.keys(qty)
  const perName = names.map(n => (Number(useDays && useDays[n]) > 0 ? Number(useDays[n]) * qty[n] : 0))
  const { data: cust } = await supabase.from('customers')
    .select('repurchase_reminder').eq('id', customerId).single()
  const existing = (cust && cust.repurchase_reminder) || null
  if (perName.some(d => !(d > 0))) return { state: 'ask', existing }

  const computed = addDays(date, Math.round(Math.min(...perName)))
  const today = toDateStr(new Date())
  if (computed < today) return { state: 'past', computed, existing }
  if (existing && existing === computed) return { state: 'same', computed, existing }
  if (existing && existing >= today) return { state: 'ask', computed, existing }
  await supabase.from('customers').update({ repurchase_reminder: computed }).eq('id', customerId)
  return { state: 'auto', computed, previous: existing, existing }
}
