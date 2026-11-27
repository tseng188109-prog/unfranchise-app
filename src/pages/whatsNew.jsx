// 更新後第一次打開首頁：跳一張小卡說「這次新增了什麼」，每台裝置只跳一次
// 之後每次有大更新，改 WHATS_NEW 的 id 和內容就好
import { useState, useEffect } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import { PRIMARY, PRIMARY_SOFT } from './designTokens'

const WHATS_NEW = {
  id: '2026-11-28',
  items: [
    '首頁的「本週回顧」點開後，可以「分享成圖片，貼到群組」。日期由你自己選，圖片上不會出現任何人的名字。',
    '分享的圖片下面有「你的細節」，只有你看得到。有人問你是誰、怎麼約到的，打開就答得出來。',
    '給帶領者的報告把想討論的事放在最前面，潛在夥伴也分組列好，帶領者讀起來比較快。',
    '選一段日期改成月曆：先點開始那天，再點結束那天。',
  ],
}
const KEY = 'ufa_whatsnew_seen'

// isNewUser：剛註冊的人沒有「舊版」可以比，直接記成看過
export function WhatsNewCard({ ready, isNewUser }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!ready || window.__noWhatsNew) return
    let seen = null
    try { seen = localStorage.getItem(KEY) } catch { /* */ }
    if (seen === WHATS_NEW.id) return
    if (isNewUser) { try { localStorage.setItem(KEY, WHATS_NEW.id) } catch { /* */ } return }
    // 晚一點再跳：別的小卡（打氣、慶祝）正開著就先不跳，下次打開再說
    const t = setTimeout(() => { if (!document.querySelector('[role=dialog]')) setShow(true) }, 1500)
    return () => clearTimeout(t)
  }, [ready, isNewUser])
  if (!show) return null
  const close = () => { try { localStorage.setItem(KEY, WHATS_NEW.id) } catch { /* */ } setShow(false) }
  return (
    <div role="dialog" aria-label="這次更新了什麼" onClick={e => { if (e.target === e.currentTarget) close() }}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', borderRadius: '22px 22px 0 0', padding: '22px 20px 28px', width: '100%', maxWidth: 430, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, background: PRIMARY_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconSparkles size={20} stroke={1.8} color={PRIMARY} />
          </span>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>這次更新了什麼</div>
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'var(--text)', fontSize: 14, lineHeight: 1.8 }}>
          {WHATS_NEW.items.map(t => <li key={t} style={{ marginBottom: 4 }}>{t}</li>)}
        </ul>
        <button onClick={close}
          style={{ width: '100%', marginTop: 18, padding: '13px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          知道了
        </button>
      </div>
    </div>
  )
}
