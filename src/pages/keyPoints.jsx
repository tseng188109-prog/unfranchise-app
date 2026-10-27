// 「重點」（原本叫認識故事）相關的小工具：
//   - activeNotes：把已經過期（被「已經不是了」接續）和被「還是這樣」換新的舊紀錄濾掉，只留現在還算數的
//   - chainIds：某一則重點，加上之後接續它的所有紀錄（刪除、改字時要一起處理）
//   - AutoTextarea：會自己長高的多行輸入框
//   - MeetingKeyNote：首頁「今天的會議」那張卡裡的一行重點
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { TEXT_MAIN, TEXT_MUTED, BORDER, RADIUS } from './designTokens'

export const NO_LONGER = '已經不是了'

export function activeNotes(notes) {
  const list = notes || []
  const superseded = new Set(list.filter(n => n.resolves_note_id).map(n => n.resolves_note_id))
  return list.filter(n => !superseded.has(n.id) && n.note !== NO_LONGER)
}

export function chainIds(notes, startId) {
  const list = notes || []
  const ids = new Set([startId])
  let grew = true
  while (grew) {
    grew = false
    list.forEach(n => {
      if (n.resolves_note_id && ids.has(n.resolves_note_id) && !ids.has(n.id)) { ids.add(n.id); grew = true }
    })
  }
  return [...ids]
}

export function AutoTextarea({ value, onChange, placeholder, minRows = 3, style, autoFocus }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea ref={ref} value={value} onChange={onChange} placeholder={placeholder} rows={minRows} autoFocus={autoFocus}
      style={{ width: '100%', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', fontFamily: 'inherit',
        lineHeight: 1.6, outline: 'none', color: TEXT_MAIN, border: `1px solid ${BORDER}`, background: 'var(--card)',
        borderRadius: RADIUS.md, padding: '10px 12px', fontSize: 14, ...style }} />
  )
}

// 首頁會議卡：這位的最新一則重點，點一下到他的頁面
export function MeetingKeyNote({ contactId, color }) {
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  useEffect(() => {
    let cancelled = false
    setNotes([])
    if (!contactId) return undefined
    supabase.from('contact_notes').select('id,note,created_at,resolves_note_id')
      .eq('contact_id', contactId).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (!cancelled) setNotes(activeNotes(data || [])) })
    return () => { cancelled = true }
  }, [contactId])
  if (notes.length === 0) return null
  return (
    <button onClick={() => navigate(`/contacts/${contactId}`)}
      style={{ display: 'flex', alignItems: 'baseline', gap: 6, width: '100%', background: 'none', border: 'none', padding: 0, marginTop: 3, cursor: 'pointer', textAlign: 'left', fontSize: 12, lineHeight: 1.5, color }}>
      <span style={{ minWidth: 0, flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>重點：{notes[0].note}</span>
      {notes.length > 1 && <span style={{ color: TEXT_MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>還有 {notes.length - 1} 則 ›</span>}
    </button>
  )
}
