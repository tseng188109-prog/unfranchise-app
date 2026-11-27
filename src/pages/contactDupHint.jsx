// 新增互動名單：同名、或社群帳號一樣的人已經在名單裡（含封存名單），就提醒一下，免得同一個人加兩次
import { useNavigate } from 'react-router-dom'
import { normText } from '../lib/searchText'
import { PRIMARY, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT, RADIUS } from './designTokens'

// kind：'name' 比姓名、'account' 比社群帳號
export function ContactDupHint({ kind, value, contacts }) {
  const navigate = useNavigate()
  const v = normText(value)
  if (!v) return null
  const key = kind === 'name' ? 'name' : 'platform_account'
  const same = contacts.filter(c => normText(c[key]) === v)
  if (!same.length) return null
  const shown = String(value).trim()
  const head = kind === 'name'
    ? (same.length === 1 ? `互動名單裡已經有一位「${shown}」` : `互動名單裡已經有 ${same.length} 位叫「${shown}」的人`)
    : `互動名單裡的「${same[0].name}」也是這個帳號`
  const archived = same.every(c => c.is_archived)
  return (
    <div style={{ background: ACCENT_YELLOW_SOFT, borderRadius: RADIUS.md, padding: '10px 12px', marginTop: 8 }}>
      <p style={{ fontSize: 13, color: ACCENT_YELLOW_TEXT, margin: 0, lineHeight: 1.6 }}>
        {head}{archived ? '（在封存名單裡）' : ''}，請確認是不是同一個人。
      </p>
      {same.slice(0, 3).map(c => (
        <div key={c.id}>
          <button type="button" onClick={() => navigate(`/contacts/${c.id}`)}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, fontSize: 13, fontWeight: 600, color: PRIMARY, cursor: 'pointer', textAlign: 'left' }}>
            看這個人的資料{c.occupation ? `（${c.occupation}）` : ''} ›
          </button>
        </div>
      ))}
    </div>
  )
}
