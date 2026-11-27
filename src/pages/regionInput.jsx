// 居住地區：可以自己打字，打的時候跳出建議（台灣縣市、鄉鎮市區，加上自己以前打過的）；其他國家照樣可以直接打
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { suggestRegions } from '../lib/twRegions'
import { TEXT_MAIN, TEXT_MUTED, BORDER, RADIUS } from './designTokens'

export default function RegionInput({ value, onChange, inputStyle, placeholder = '例：台北市大安區' }) {
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState([])
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('contacts').select('region').eq('user_id', user.id).not('region', 'is', null).limit(2000)
      if (!alive || !data) return
      // 自己打過的地區，用得越多次排越前面
      const count = {}
      for (const r of data) { const v = String(r.region || '').trim(); if (v) count[v] = (count[v] || 0) + 1 }
      setMine(Object.keys(count).sort((a, b) => count[b] - count[a]))
    })()
    return () => { alive = false }
  }, [])
  const list = open ? suggestRegions(value || '', mine) : []
  return (
    <div>
      <input value={value} placeholder={placeholder} style={inputStyle}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { clearTimeout(timer.current); setOpen(true) }}
        onBlur={() => { timer.current = setTimeout(() => setOpen(false), 150) }}
        autoComplete="off" />
      {list.length > 0 && (
        <div role="listbox" aria-label="地區建議"
          style={{ marginTop: 6, background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, overflow: 'hidden' }}>
          {list.map(v => (
            <button key={v} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(v); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none',
                borderBottom: `1px solid ${BORDER}`, fontSize: 14, color: TEXT_MAIN, cursor: 'pointer' }}>
              {v}
              {mine.includes(v) && <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 8 }}>你打過的</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
