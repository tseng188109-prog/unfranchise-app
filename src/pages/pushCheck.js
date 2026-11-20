// pushCheck.js — 這支手機現在收得到通知嗎（打氣小卡、送打氣面板用來決定要不要提醒開通知）
function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}
function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
}
export async function canReceivePush() {
  try {
    if (typeof window === 'undefined') return false
    if (isIOS() && !isStandalone()) return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false
    if (Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker.ready
    return !!(await reg.pushManager.getSubscription())
  } catch { return false }
}
