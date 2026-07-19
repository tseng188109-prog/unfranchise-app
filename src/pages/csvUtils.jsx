// CSV 匯入共用工具：統一從這裡 import，不要在各頁面重複宣告
//
// 背景：原本 Contacts.jsx / Customers.jsx 用簡單的 line.split(',')，
// 欄位裡如果剛好有逗號（例如備註、地區）會整行錯位；
// Transactions.jsx 原本就有逐字元解析、正確處理引號內逗號的版本，
// 這裡統一升級成 Transactions.jsx 那一版，三個頁面都改用同一份。
//
// parseBirthday 原本只有 Customers.jsx 有定義，但 Contacts.jsx 也會呼叫它
// （沒定義會直接 ReferenceError，只要匯入的 CSV 有填生日欄位就會炸）；
// normalizePhone 原本只有 Transactions.jsx 有，這裡讓 Customers.jsx 匯入顧客電話時也套用。

// 解析 CSV 文字 → 陣列物件（正確處理引號包住、內含逗號的欄位）
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '')
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    vals.push(cur.trim())
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').replace(/^"|"$/g,'').replace(/\r$/, '')
    })
    return row
  })
}

// 解析各種日期格式 → YYYY-MM-DD
// 支援：2025-07-01 / 2025/7/1 / 2025/07/01 / 114/7/1（民國）
export function parseDate(val) {
  if (!val) return ''
  val = val.trim()
  if (!val) return ''

  // 任何含 /00 或 -00 或 1900 開頭的都直接丟棄
  if (/\/00|-00|^1900/.test(val)) return ''

  // 已經是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val

  // YYYY/M/D 或 YYYY/MM/DD
  const m1 = val.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (m1) {
    const [, y, mo, d] = m1
    if (mo === '0' || d === '0' || mo === '00' || d === '00') return ''
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // 民國 YYY/M/D
  const m2 = val.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/)
  if (m2) {
    const [, ry, mo, d] = m2
    if (mo === '0' || d === '0' || mo === '00' || d === '00') return ''
    return `${parseInt(ry)+1911}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  // YYYY-M-D
  const m3 = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m3) {
    const [, y, mo, d] = m3
    if (mo === '0' || d === '0' || mo === '00' || d === '00') return ''
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  return ''
}

// 解析生日 → MM-DD（只記月份和日期，不記年份）
export function parseBirthday(val) {
  if (!val) return ''
  val = val.trim()
  if (!val) return ''
  if (/^\d{2}-\d{2}$/.test(val)) return val
  const match = val.match(/^(\d{1,2})[-\/](\d{1,2})$/)
  if (match) {
    const [, m, d] = match
    return `${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  const fullDate = parseDate(val)
  if (fullDate) return fullDate.slice(5)
  return ''
}

// 手機號碼正規化：Excel 常把開頭的 0 當數字吃掉，這裡補回來
export function normalizePhone(val) {
  if (!val) return ''
  let p = String(val).trim().replace(/[-\s()]/g, '')
  if (!p) return ''
  if (/^\d{9}$/.test(p)) p = '0' + p
  return p
}
