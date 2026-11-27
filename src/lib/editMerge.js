// 同一個人在兩台裝置同時改：存檔時只寫「這次真的改了」的欄位，另一台改的其他欄位不會被蓋掉；
// 兩邊改到同一個欄位、而且改得不一樣，才問要用哪一份（純計算，方便測試）
const same = (a, b) => String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim()

// base：打開編輯頁時資料庫的樣子；form：現在畫面上的；latest：存檔前再讀一次資料庫的樣子（都用同一種格式）
export function planSave(base, form, latest) {
  const mine = Object.keys(form).filter(k => k in base && !same(form[k], base[k]))
  const theirs = Object.keys(base).filter(k => latest && k in latest && !same(latest[k], base[k]))
  const conflicts = mine.filter(k => theirs.includes(k) && !same(latest[k], form[k]))
  return { mine, theirs, conflicts }
}
