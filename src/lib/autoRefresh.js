// 回到畫面就自動更新（手機記完，切回電腦不用自己重新整理）
// 不做「每隔幾分鐘自動讀一次」：幾百人同時開著畫面會吃掉 Supabase 免費方案每月的流量
// 正在打字或開著視窗時不更新，免得打到一半的內容被蓋掉；兩次更新至少隔 1 分鐘（一直切視窗也不會一直讀）
import { useEffect, useRef } from 'react'
import { isBusy } from '../pages/appUpdate'

const MIN_GAP_MS = 60000

export function useAutoRefresh(fn, enabled = true) {
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })
  useEffect(() => {
    if (!enabled) return
    let last = Date.now()
    // 測試時可以把間隔調短（window.__autoRefreshGap）
    const gap = window.__autoRefreshGap ?? MIN_GAP_MS
    let pending = false
    function run() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - last < gap) return
      // 正在打字：等離開輸入框再更新
      if (isBusy()) { pending = true; return }
      pending = false
      last = Date.now()
      try { fnRef.current() } catch { /* 更新失敗就等下一次 */ }
    }
    const onBlurInput = () => { if (pending) setTimeout(run, 0) }
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    document.addEventListener('focusout', onBlurInput)
    return () => {
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
      document.removeEventListener('focusout', onBlurInput)
    }
  }, [enabled])
}
