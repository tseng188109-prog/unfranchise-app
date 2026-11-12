// pushNotify.jsx — 手機提醒：開啟 / 關閉、設定頁那一列，以及打開 App 時自動補登記
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { IconBell } from '@tabler/icons-react'
import { PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS } from './designTokens'

const VAPID_PUBLIC_KEY = 'BNh0rz80Bym8RYKfsYfMjzMEQ6kl6Bkkqsli6jHSmFuajy3AQElzTgly-FLuS9YaSAcaIKTIFeC9BM2YzvytVAE'

function keyToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)))
}

function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// 打開 App 時檢查：手機已經允許通知、也有訂閱，但資料庫沒有（或被清掉）→ 自動補上。
// 以前有人按過「開啟」卻沒存進資料庫，畫面顯示已開啟、其實收不到；這個讓它自己好起來。
// 不會跳任何詢問，沒允許過通知的人什麼都不做。
export async function syncPushSubscription(userId) {
  try {
    if (!userId || !pushSupported() || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys) return
    await supabase.from('push_subscriptions').upsert({
      user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
    }, { onConflict: 'endpoint' })
  } catch { /* 補不上就下次再補 */ }
}

// 開啟手機提醒（設定頁和首頁引導條共用）：回傳 'on' | 'off'（沒允許）| 'denied' | 'fail'
export async function enablePush(userId) {
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToUint8(VAPID_PUBLIC_KEY) })
    }
    const j = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
    }, { onConflict: 'endpoint' })
    if (error) throw error
    reg.showNotification('提醒已開啟', { body: '有約好的人，當天早上 9 點會提醒你。', icon: '/pwa-192x192.png' })
    return 'on'
  } catch { return 'fail' }
}

// ---- 首頁引導條 ----
// 狀態 1（iPhone／iPad 還沒加到主畫面）：「加到主畫面，才收得到手機提醒」＋怎麼加
// 狀態 2（可以收通知，但還沒開）：「打開手機提醒」＋開啟
// 開好了、手機把通知關掉了（改在設定頁說明）、或按了 ✕（30 天內）都不出現
const GUIDE_KEY = 'ufa_push_guide_hidden_at'
const GUIDE_DAYS = 30
function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}
function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
}
function guideHidden() {
  try {
    const t = Number(localStorage.getItem(GUIDE_KEY) || 0)
    return t && Date.now() - t < GUIDE_DAYS * 86400000
  } catch { return false }
}
export async function pushGuideState() {
  if (typeof window === 'undefined' || guideHidden()) return null
  if (isIOS() && !isStandalone()) return 'install'
  if (!pushSupported()) return null
  if (Notification.permission === 'denied') return null
  try {
    if (Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready
      if (await reg.pushManager.getSubscription()) return null
    }
  } catch { return null }
  return 'enable'
}

export function PushGuide({ userId }) {
  const [state, setState] = useState(null)
  const [howOpen, setHowOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let alive = true
    pushGuideState().then(s => { if (alive) setState(s) })
    return () => { alive = false }
  }, [])
  if (!state) return null
  function hide() {
    try { localStorage.setItem(GUIDE_KEY, String(Date.now())) } catch { /* 存不了就只關這一次 */ }
    setState(null)
  }
  async function turnOn() {
    setBusy(true); setMsg('')
    const r = await enablePush(userId)
    setBusy(false)
    if (r === 'on' || r === 'denied') { setState(null); return }
    if (r === 'fail') setMsg('開啟失敗，可以到設定頁再試一次')
  }
  const strip = { background: 'var(--primary-soft)', borderRadius: RADIUS.lg, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }
  const btn = { fontSize: 13, padding: '7px 12px', borderRadius: RADIUS.sm, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
  const x = { background: 'none', border: 'none', color: TEXT_SECONDARY, fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }
  return (
    <>
      <div style={strip}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: PRIMARY, lineHeight: 1.5 }}>
          {state === 'install' ? '加到主畫面，才收得到手機提醒' : '打開手機提醒，約好的人當天早上會提醒你'}
          {msg && <span style={{ display: 'block', fontWeight: 400, color: TEXT_SECONDARY, fontSize: 12 }}>{msg}</span>}
        </span>
        {state === 'install'
          ? <button onClick={() => setHowOpen(true)} style={btn}>怎麼加</button>
          : <button onClick={turnOn} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? '開啟中…' : '開啟'}</button>}
        <button onClick={hide} aria-label="先不要" style={x}>✕</button>
      </div>
      {howOpen && (
        <div onClick={() => setHowOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card)', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>加到主畫面</span>
              <button onClick={() => setHowOpen(false)} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
            </div>
            {[
              <>按 Safari 下方的<b>分享</b>按鈕 <svg width="14" height="16" viewBox="0 0 14 16" style={{ verticalAlign: -2 }}><path d="M7 1v9M3.5 4.5L7 1l3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="1.5" y="7" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg></>,
              <>往下滑，按<b>「加入主畫面」</b></>,
              <>之後從主畫面的<b>超連鎖圖示</b>打開，首頁會再提醒你打開手機提醒</>,
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? `1px solid ${BORDER}` : 'none', fontSize: 14, color: TEXT_MAIN, lineHeight: 1.6 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-soft)', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export function PushSetting({ userId }) {
  const [state, setState] = useState('loading') // loading | unsupported | off | on | denied
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    async function check() {
      if (!pushSupported()) { if (alive) setState('unsupported'); return }
      if (Notification.permission === 'denied') { if (alive) setState('denied'); return }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (alive) setState(sub ? 'on' : 'off')
      } catch { if (alive) setState('off') }
    }
    check()
    return () => { alive = false }
  }, [])

  async function turnOn() {
    setBusy(true); setMsg('')
    const r = await enablePush(userId)
    if (r === 'on') setState('on')
    else if (r === 'denied') setState('denied')
    else if (r === 'off') setState('off')
    else setMsg('開啟失敗，請稍後再試一次')
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true); setMsg('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
    } catch (e) { setMsg('關閉失敗，請稍後再試一次') }
    setBusy(false)
  }

  const desc = {
    loading: '',
    unsupported: '要先把 App 加到主畫面，再從主畫面的圖示打開，才能開啟提醒。（Safari 底部分享按鈕 → 加入主畫面）',
    denied: '手機的通知被關掉了。到 手機設定 → 通知 → 超連鎖，打開「允許通知」後再回來。',
    off: '有約好的人，當天早上 9 點提醒你。',
    on: '已開啟。有約好的人，當天早上 9 點會提醒你。',
  }[state]

  const canTap = state === 'off' || state === 'on'

  return (
    <div style={{ background: 'var(--card)', borderRadius: RADIUS.xl, padding: 16, border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconBell size={17} stroke={1.9} color={PRIMARY} />
        <span style={{ fontSize: 14, color: TEXT_MAIN, flex: 1 }}>手機提醒</span>
        {canTap && (
          <button onClick={state === 'on' ? turnOff : turnOn} disabled={busy}
            style={{
              minWidth: 76, padding: '9px 14px', borderRadius: RADIUS.md, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: state === 'on' ? `1px solid ${BORDER}` : 'none',
              background: state === 'on' ? 'transparent' : PRIMARY,
              color: state === 'on' ? TEXT_SECONDARY : '#fff', opacity: busy ? 0.6 : 1,
            }}>
            {state === 'on' ? '關閉' : '開啟'}
          </button>
        )}
      </div>
      {desc && <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '8px 0 0', lineHeight: 1.6 }}>{desc}</p>}
      {msg && <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '6px 0 0' }}>{msg}</p>}
    </div>
  )
}
