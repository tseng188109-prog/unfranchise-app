// undoDelete.jsx — 刪除的後悔按鈕。
// 按下刪除（確認過）之後：畫面先把那一筆拿掉，下方出現「已刪除… 復原」8 秒。
//   8 秒內按「復原」→ 什麼都沒刪，畫面放回去。
//   8 秒到、又刪了另一筆、或換到別的頁面 → 才真的從資料庫刪除。
//   刪完馬上關掉 App → 沒有刪（寧可多留一筆，不要誤刪）。
// 用法：
//   undoableDelete({ label: '回覆他旅遊的限動…', hide: () => 畫面先拿掉, undo: () => 放回去, commit: async () => 真的刪 })
import { createRoot } from 'react-dom/client'
import { askConfirm } from './confirmDialog'

const WAIT_MS = 8000
let pending = null

function Toast({ label, onUndo }) {
  const wide = typeof window !== 'undefined' && window.innerWidth >= 1024
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: wide ? 24 : 'calc(84px + env(safe-area-inset-bottom))', zIndex: 2100,
      display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
      <style>{'@keyframes ufaUndoBar{from{width:100%}to{width:0}}'}</style>
      <div style={{ width: '100%', maxWidth: 430, pointerEvents: 'auto', background: 'var(--text)', color: 'var(--card)',
        borderRadius: 14, overflow: 'hidden', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px 9px 16px' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            已刪除{label ? `「${label}」` : ''}
          </span>
          <button onClick={onUndo}
            style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 99, border: 'none', background: 'var(--card)', color: 'var(--primary)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            復原
          </button>
        </div>
        <div style={{ height: 3, background: 'var(--card)', opacity: 0.6, animation: `ufaUndoBar ${WAIT_MS}ms linear forwards` }} />
      </div>
    </div>
  )
}

function close(p) {
  clearTimeout(p.timer)
  try { p.root.unmount() } catch { /* 已經關了 */ }
  p.host.remove()
}

// 把等待中的那一筆真的刪掉（8 秒到、刪了下一筆、換頁時呼叫）
export async function flushUndo() {
  if (!pending) return
  const p = pending
  pending = null
  close(p)
  try {
    const res = await p.commit()
    if (res && res.error) throw res.error
  } catch (e) {
    if (p.undo) p.undo()
    await askConfirm({ title: '刪除失敗', message: (e && e.message) || '網路可能不穩，再試一次', okText: '知道了', hideCancel: true })
  }
}

export function undoableDelete({ label = '', hide, undo, commit }) {
  flushUndo()
  if (hide) hide()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const p = { host, root, commit, undo, timer: null }
  p.timer = setTimeout(() => { if (pending === p) flushUndo() }, WAIT_MS)
  pending = p
  const onUndo = () => {
    if (pending !== p) return
    pending = null
    close(p)
    if (undo) undo()
  }
  root.render(<Toast label={String(label).slice(0, 20)} onUndo={onUndo} />)
}

// 換頁就先把等待中的刪掉，其他頁的數字才不會把它算進去
if (typeof window !== 'undefined' && !window.__ufaUndoPatched) {
  window.__ufaUndoPatched = true
  const wrap = name => {
    const orig = window.history[name]
    window.history[name] = function (...args) {
      const before = window.location.pathname
      const r = orig.apply(this, args)
      if (window.location.pathname !== before) flushUndo()
      return r
    }
  }
  wrap('pushState'); wrap('replaceState')
  window.addEventListener('popstate', () => flushUndo())
}
