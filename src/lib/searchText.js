// 搜尋用的比對（純計算，方便測試）
// 寫法差異當成一樣：大小寫、全形半形、臺／台、前後與中間的空白、IG 帳號前面的 @
export function normText(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/臺/g, '台')
    .replace(/[@\s]/g, '')
}

// 一筆資料裡要找的欄位：[欄位名稱, 顯示用的名稱]，照順序找，第一個符合的就是「為什麼找到他」
export const CONTACT_FIELDS = [
  ['name', null], ['occupation', null],
  ['platform_account', 'social'], ['region', '地區'], ['note', '備註'],
  ['pain_point', '痛點'], ['asked_products', '問過'],
]
export const CUSTOMER_FIELDS = [
  ['name', null], ['phone', null], ['occupation', null], ['address', '地址'],
]

// 回傳 null 表示不符合；符合時回傳 { label, value }，label 是 null 表示名字或畫面上本來就看得到的欄位，不用再多一行說明
export function matchRecord(rec, q, fields) {
  const nq = normText(q)
  if (!nq) return { label: null, value: '' }
  for (const [key, label] of fields) {
    const v = rec[key]
    // 電話只比數字：0912-345-678 打 0912345678 也找得到
    if (key === 'phone' && v && /\d/.test(nq) && /^[\d-]+$/.test(nq)) {
      if (String(v).replace(/\D/g, '').includes(nq.replace(/\D/g, ''))) return { label, value: String(v).trim() }
      continue
    }
    // 地區、地址：不管有沒有打「市、縣、區、鄉、鎮」，打「台北大安」也找得到「臺北市大安區」
    const loose = t => normText(t).replace(/[市縣區鄉鎮]/g, '')
    const hitLoose = (key === 'region' || key === 'address') && v && loose(q) && loose(v).includes(loose(q))
    if (v && (normText(v).includes(nq) || hitLoose)) {
      if (label === 'social') return { label: rec.platform || '社群', value: String(v).trim() }
      return { label, value: String(v).trim() }
    }
  }
  return null
}

// 說明那一行太長就截短，讓找到的字留在中間
export function snippet(value, q, max = 24) {
  const v = String(value || '').replace(/\s+/g, ' ').trim()
  if (v.length <= max) return v
  const i = normText(v).indexOf(normText(q))
  if (i < 0) return v.slice(0, max) + '…'
  const start = Math.max(0, Math.min(i - 6, v.length - max))
  return (start > 0 ? '…' : '') + v.slice(start, start + max) + (start + max < v.length ? '…' : '')
}
