// 新增顧客、編輯顧客共用：連結互動名單的搜尋框、同名顧客提醒、「補回上次沒存的內容」提醒
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, PRIMARY,
  ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT,
  BORDER, RADIUS } from './designTokens'

const norm = s => String(s || '').trim().toLowerCase()
const who = c => c.phone || c.occupation || ''

const noteBox = { background: ACCENT_YELLOW_SOFT, borderRadius: RADIUS.md, padding: '10px 12px', marginTop: 8 }
const noteText = { fontSize: 13, color: ACCENT_YELLOW_TEXT, margin: 0, lineHeight: 1.6 }
const linkBtn = { background: 'none', border: 'none', padding: 0, marginTop: 4, fontSize: 13, fontWeight: 600, color: PRIMARY, cursor: 'pointer', textAlign: 'left' }

// 連結互動名單：名單直接排在搜尋框下面（不蓋住別的欄位），點別的地方就收起來
export function ContactLinkField({ mode, contacts, customers, selfId, linkedId, linkedName, search, setSearch, onSelect, onClear }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  const q = search.trim()
  const matches = q && !linkedId ? contacts.filter(c => c.name.includes(q)) : []
  const custOf = contactId => customers.find(k => k.contact_id === contactId && k.id !== selfId)
  const linkedCust = linkedId ? custOf(linkedId) : null

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        連結互動名單 <span style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 400 }}>
          {mode === 'new' ? '選填，這位顧客本來就在互動名單裡的話可以連起來' : '選填'}
        </span>
      </label>
      {linkedId ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT_GREEN_SOFT, borderRadius: RADIUS.md, padding: '10px 12px' }}>
          <span style={{ fontSize: 14, color: ACCENT_GREEN_TEXT, fontWeight: 600, flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            ✓ 已連結：{linkedName}
          </span>
          <button onClick={onClear} style={{ fontSize: 12, color: TEXT_SECONDARY, background: 'none', border: 'none', cursor: 'pointer' }}>
            取消連結
          </button>
        </div>
      ) : (
        <input value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => { clearTimeout(closeTimer.current); setOpen(true) }}
          onBlur={() => { closeTimer.current = setTimeout(() => setOpen(false), 150) }}
          placeholder="搜尋互動名單裡的姓名..."
          style={{ width: '100%', padding: '11px 12px', borderRadius: RADIUS.md, border: `1px solid ${BORDER}`,
            fontSize: 14, background: 'var(--card)', boxSizing: 'border-box', outline: 'none', color: TEXT_MAIN }} />
      )}

      {open && matches.length > 0 && (
        <div role="listbox" aria-label="互動名單搜尋結果"
          style={{ marginTop: 6, background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.md,
            maxHeight: 200, overflowY: 'auto' }}>
          {matches.map(c => {
            const already = custOf(c.id)
            return (
              <button key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => { setOpen(false); onSelect(c) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                  background: 'none', border: 'none', borderBottom: `1px solid ${BORDER}`,
                  textAlign: 'left', cursor: 'pointer', fontSize: 14, color: TEXT_MAIN }}>
                <span style={{ flex: 1, minWidth: 0 }}>{c.name}</span>
                {already && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: RADIUS.pill, background: ACCENT_YELLOW_SOFT, color: ACCENT_YELLOW_TEXT, fontWeight: 600 }}>已是顧客</span>}
                {c.occupation && <span style={{ fontSize: 12, color: TEXT_MUTED }}>{c.occupation}</span>}
              </button>
            )
          })}
        </div>
      )}

      {q && !linkedId && matches.length === 0 && (
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '6px 0 0', lineHeight: 1.6 }}>
          互動名單裡沒有叫「{q}」的人，不用連結也可以直接{mode === 'new' ? '新增' : '儲存'}。
        </p>
      )}

      {linkedCust && (
        <div style={noteBox}>
          <p style={noteText}>
            {mode === 'new'
              ? `${linkedName}已經是你的顧客了，不用再新增一次。`
              : `${linkedName}已經連結到顧客「${linkedCust.name}」了，請確認是不是同一個人。`}
          </p>
          <button style={linkBtn} onClick={() => navigate(`/customers/${linkedCust.id}`)}>看這位顧客的資料 ›</button>
        </div>
      )}
    </div>
  )
}

// 同名顧客提醒：姓名打完，顧客裡已經有一模一樣名字的人
export function SameNameHint({ name, customers, selfId, skipId }) {
  const navigate = useNavigate()
  const n = norm(name)
  if (!n) return null
  const same = customers.filter(k => k.id !== selfId && k.id !== skipId && norm(k.name) === n)
  if (!same.length) return null
  return (
    <div style={noteBox}>
      <p style={noteText}>
        {same.length === 1
          ? `顧客裡已經有一位「${name.trim()}」，請確認是不是同一個人。`
          : `顧客裡已經有 ${same.length} 位叫「${name.trim()}」的人，請確認是不是同一個人。`}
      </p>
      {same.slice(0, 3).map(k => (
        <div key={k.id}>
          <button style={linkBtn} onClick={() => navigate(`/customers/${k.id}`)}>
            看這位顧客的資料{who(k) ? `（${who(k)}）` : ''} ›
          </button>
        </div>
      ))}
    </div>
  )
}

// 補回上次沒存的內容時，最上面說一聲，可以清掉重來
export function DraftNotice({ text, actionText, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: ACCENT_YELLOW_SOFT, borderRadius: RADIUS.md,
      padding: '10px 12px', marginBottom: 16 }}>
      <p style={{ ...noteText, flex: 1, minWidth: 0 }}>{text}</p>
      <button onClick={onAction}
        style={{ flexShrink: 0, background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm,
          padding: '6px 10px', fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY, cursor: 'pointer' }}>
        {actionText}
      </button>
    </div>
  )
}
