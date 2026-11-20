// appUpdate.js — 更新後讓每支手機、電腦都換到最新版
// 每次打開 App、從別的 App 切回來時，檢查有沒有新版；有的話新版會在背景準備好，
// 準備好就自動重新整理一次，換上新版（跳「已更新到最新版」）。
// 正在打字、或畫面上開著視窗時不重新整理，免得打到一半的字不見，改在最上面跳「有新版本，點一下更新」。
const FLAG = 'ufa_just_updated'
let pending = false

// 現在適不適合重新整理
export function isBusy() {
  const a = document.activeElement
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return true
  if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return true
  return false
}

export function applyUpdate() {
  try { sessionStorage.setItem(FLAG, '1') } catch { /* ignore */ }
  window.location.reload()
}

// 剛剛是不是因為更新而重新整理（是的話回 true，並清掉記號）
export function justUpdated() {
  try {
    if (sessionStorage.getItem(FLAG) === '1') { sessionStorage.removeItem(FLAG); return true }
  } catch { /* ignore */ }
  return false
}
export function updatePending() { return pending }

export function setupUpdates() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  let controlled = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 第一次安裝（原本沒有）不算更新，不用重新整理
    if (!controlled) { controlled = true; return }
    if (pending) return
    if (isBusy()) {
      pending = true
      window.dispatchEvent(new CustomEvent('ufa:update-ready'))
      return
    }
    applyUpdate()
  })
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        // 等很久的新版：回到 App、手上沒在打字，就直接換
        if (pending && !isBusy()) { applyUpdate(); return }
        reg.update().catch(() => {})
      })
    }).catch(() => { /* 註冊不了就照舊 */ })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register)
}
