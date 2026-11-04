// navBack.jsx — 表單存完「退回來的那一頁」，不是再開一次新頁面。
// 這樣返回箭頭（和手機右滑返回）不會再回到已經存過的表單。
// 直接打開表單網址（書籤、重新整理）時前面沒有上一頁，就改成打開 fallback，不會跳出 App。
export function goBackOr(navigate, fallback, steps = 1) {
  const idx = (window.history.state && window.history.state.idx) || 0
  if (idx >= steps) navigate(-steps)
  else navigate(fallback, { replace: true })
}

export const SAVE_FAIL = '沒存成功，網路可能不穩，再按一次試試'

export function SaveError({ msg }) {
  if (!msg) return null
  return <p style={{ fontSize: 13, color: '#E0454A', margin: '10px 0 0', textAlign: 'center', fontWeight: 600 }}>{msg}</p>
}
