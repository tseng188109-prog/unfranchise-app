// 更新後第一次打開首頁：跳一張小卡說「這次新增了什麼」，每台裝置只跳一次
// 之後每次有大更新，改 WHATS_NEW 的 id 和內容就好
import { useState, useEffect } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import { PRIMARY, PRIMARY_SOFT } from './designTokens'

const WHATS_NEW = {
  id: '2026-11-27',
  items: [
    '互動名單和顧客的每一列右邊多了「⋮」，點一下就能釘選或封存。',
    '搜尋現在也找得到 IG 帳號、地區、備註、痛點和問過的產品。',
    '填居住地區時，打幾個字就會跳出建議，點一下就填好。',
    '在手機記完，回到電腦畫面就會自動更新，不用自己重新整理。',
    '同一個人在手機和電腦同時改，存檔時不會把另一邊改的蓋掉。',
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
