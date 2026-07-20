// 表單草稿共用工具：新增/編輯表單填到一半，App 關掉重開能自動補回來
// 存在瀏覽器本機（localStorage），不是資料庫，不會跟任何人共享或衝突
// 這是單人 App，每筆資料都綁 user_id 只有自己看得到，所以不需要比對「有沒有被別人改過」

const PREFIX = 'ufa_draft:'

export function saveDraft(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }))
  } catch {}
}

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.data ?? null
  } catch {
    return null
  }
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {}
}
