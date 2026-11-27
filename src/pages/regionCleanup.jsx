// 設定 → 整理居住地區的寫法：同一個地方寫法不一樣（台北大安、臺北市大安區⋯），一次統一成標準寫法
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { regionCleanupGroups } from '../lib/twRegions'
import { PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS } from './designTokens'

export function RegionCleanupPanel({ userId }) {
  const [groups, setGroups] = useState(null)
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState([])

  const [ver, setVer] = useState(0)
  const load = () => setVer(v => v + 1)
  useEffect(() => {
    if (!userId) return
    let alive = true
    supabase.from('contacts').select('region').eq('user_id', userId).not('region', 'is', null).limit(5000)
      .then(({ data }) => { if (alive) setGroups(regionCleanupGroups((data || []).map(r => r.region))) })
    return () => { alive = false }
  }, [userId, ver])

  async function unify(g) {
    setBusy(g.canonical)
    const olds = g.variants.map(v => v.value).filter(v => v !== g.canonical)
    const { error } = await supabase.from('contacts').update({ region: g.canonical }).eq('user_id', userId).in('region', olds)
    setBusy('')
    if (!error) { setDone(d => [...d, `${olds.join('、')} → ${g.canonical}`]); load() }
  }

  const card = { background: 'var(--card)', borderRadius: RADIUS.xl, padding: 20, border: `1px solid ${BORDER}` }
  return (
    <div style={card}>
      <p style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7, margin: '0 0 14px' }}>
        同一個地方寫法不一樣時，用地區搜尋會找不齊。下面列出可以統一的寫法，按一下就會把這些人的地區一起改好。
      </p>
      {groups === null && <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>正在整理你的名單⋯</p>}
      {groups && groups.length === 0 && (
        <p style={{ fontSize: 14, color: TEXT_MAIN, margin: 0 }}>名單裡的地區寫法都已經一致了。</p>
      )}
      {groups && groups.map(g => (
        <div key={g.canonical} style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {g.variants.map(v => (
              <span key={v.value} style={{ fontSize: 13, padding: '3px 10px', borderRadius: RADIUS.pill, background: 'var(--sub)',
                color: v.value === g.canonical ? TEXT_MAIN : TEXT_SECONDARY }}>
                {v.value} · {v.count} 位
              </span>
            ))}
          </div>
          <button type="button" disabled={!!busy} onClick={() => unify(g)}
            style={{ background: 'none', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: RADIUS.md,
              padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== g.canonical ? 0.5 : 1 }}>
            {busy === g.canonical ? '統一中⋯' : `統一成「${g.canonical}」`}
          </button>
        </div>
      ))}
      {done.length > 0 && (
        <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '10px 0 0', lineHeight: 1.7 }}>已經改好：{done.join('；')}</p>
      )}
      <p style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.7, margin: '14px 0 0' }}>
        只寫了區、沒寫縣市（例如「大安區」，台北和台中都有），或是國外的地方，不會自動改。
      </p>
    </div>
  )
}
