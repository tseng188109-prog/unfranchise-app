// updateBar.jsx — 「已更新到最新版」小提示，和「有新版本，點一下更新」
import { useEffect, useState } from 'react'
import { justUpdated, applyUpdate, updatePending } from './appUpdate'

export default function UpdateBar() {
  const [done, setDone] = useState(() => justUpdated())
  const [ready, setReady] = useState(() => updatePending())
  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener('ufa:update-ready', on)
    return () => window.removeEventListener('ufa:update-ready', on)
  }, [])
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 2500)
    return () => clearTimeout(t)
  }, [done])
  if (!ready && !done) return null
  const wrap = { position: 'fixed', left: 12, right: 12, top: 'calc(10px + env(safe-area-inset-top))', zIndex: 2500, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }
  const bar = { pointerEvents: 'auto', width: '100%', maxWidth: 420, background: '#1E2A44', color: '#fff', borderRadius: 14, padding: '11px 14px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, boxSizing: 'border-box', border: 'none', textAlign: 'left' }
  if (ready) {
    return (
      <div style={wrap}>
        <button onClick={applyUpdate} style={{ ...bar, cursor: 'pointer' }}>
          <span style={{ flex: 1 }}>有新版本</span><span style={{ color: '#9DB8F2', fontWeight: 600 }}>點一下更新</span>
        </button>
      </div>
    )
  }
  return <div style={wrap}><div role="status" style={bar}>已更新到最新版</div></div>
}
