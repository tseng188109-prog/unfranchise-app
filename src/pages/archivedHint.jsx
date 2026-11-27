// 搜尋時，封存名單裡也有符合的人：在清單下面說一聲，點了切到封存名單（搜尋字保留）
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { matchRecord } from '../lib/searchText'
import { PRIMARY, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT, RADIUS } from './designTokens'

export function ArchivedHint({ table, fields, select, search, active, onOpen }) {
  const [pool, setPool] = useState(null)
  const fetchedAt = useRef(0)
  const q = search.trim()
  // 有打字才去讀封存的；停手 0.3 秒再讀。讀過 1 分鐘內不再讀（幾百人用時省流量），剛封存的人 1 分鐘後也找得到
  useEffect(() => {
    if (!active || !q || Date.now() - fetchedAt.current < (window.__archivedCacheMs ?? 60000)) return
    let alive = true
    const t = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from(table).select(select).eq('user_id', user.id).eq('is_archived', true).limit(3000)
      if (alive) { fetchedAt.current = Date.now(); setPool(data || []) }
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [active, q, table, select])
  if (!active || !q || !pool) return null
  const n = pool.filter(c => matchRecord(c, q, fields)).length
  if (!n) return null
  return (
    <div style={{ background: ACCENT_YELLOW_SOFT, borderRadius: RADIUS.md, padding: '10px 14px', margin: '10px 0',
      display: 'flex', alignItems: 'center', gap: 10 }}>
      <p style={{ flex: 1, fontSize: 13, color: ACCENT_YELLOW_TEXT, margin: 0, lineHeight: 1.6 }}>
        封存名單裡還有 {n} 位符合「{q}」的人。
      </p>
      <button type="button" onClick={onOpen}
        style={{ flexShrink: 0, background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: PRIMARY, cursor: 'pointer', padding: 0 }}>
        看封存名單 ›
      </button>
    </div>
  )
}
