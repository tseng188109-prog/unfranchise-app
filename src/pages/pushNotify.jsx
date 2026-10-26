// pushNotify.jsx — 推播提醒：開啟 / 關閉，以及設定頁那一列
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
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); setBusy(false); return }
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
      setState('on')
      reg.showNotification('提醒已開啟', { body: '有約好的人，當天早上 9 點會提醒你。', icon: '/pwa-192x192.png' })
    } catch (e) {
      setMsg('開啟失敗，請稍後再試一次')
    }
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
        <span style={{ fontSize: 14, color: TEXT_MAIN, flex: 1 }}>見面提醒</span>
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
