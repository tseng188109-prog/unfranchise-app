// top10.jsx — 首選 10：最先要邀約的 10 位人選。
// 依據：成功五要訣（BASIC-5）訓練「前 10 位潛在人選名單」、起步指南「決定前十位潛在顧客名單」。
// 資料放在 contacts：is_top10（是不是）、top10_at（什麼時候選的）、top10_keep（按過「先留著」的那個原因）。
// 這些欄位還沒建（SQL 還沒跑）時，所有查詢都會安靜失敗，功能只是不亮，其他畫面照常。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { IconStar, IconStarFilled } from '@tabler/icons-react'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS,
} from './designTokens'

export const TOP10_MAX = 10

const TOP10_FIELDS = 'id,name,egg_type,need_level,is_top10,top10_at,top10_keep,is_archived,is_muted,referral_stage,interest_level,next_plan,next_plan_date,last_contact_date,last_interacted_at,source'

// 這個人還適合留在首選 10 嗎？回傳「可以換人」的原因，沒有就回空字串
export function top10Exit(c) {
  if (!c) return ''
  if (c.is_archived) return '已封存'
  if (c.referral_stage === '暫時婉拒') return '已選「暫時婉拒」'
  if (c.referral_stage === '已簽約' || c.referral_stage === '起步中' || c.referral_stage === '穩定經營中') return '已成為夥伴'
  if (c.interest_level === '沒興趣') return '興趣程度記了「沒興趣」'
  if (c.is_muted) return '時機未到'
  return ''
}
// 按過「先留著」的，同一個原因不再提醒
export function top10NeedsAction(c) {
  const r = top10Exit(c)
  return r && c.top10_keep !== r ? r : ''
}

export async function fetchTop10(userId) {
  try {
    const { data, error } = await supabase.from('contacts').select(TOP10_FIELDS)
      .eq('user_id', userId).eq('is_top10', true)
    if (error) return { ok: false, rows: [] }
    return { ok: true, rows: data || [] }
  } catch { return { ok: false, rows: [] } }
}

export async function setTop10(contactId, on) {
  const upd = on ? { is_top10: true, top10_at: new Date().toISOString(), top10_keep: null }
    : { is_top10: false, top10_at: null, top10_keep: null }
  const { error } = await supabase.from('contacts').update(upd).eq('id', contactId)
  return { error }
}

export async function keepTop10(contactId, reason) {
  const { error } = await supabase.from('contacts').update({ top10_keep: reason }).eq('id', contactId)
  return { error }
}

const NEED_RANK = { '大四': 3, '大三': 2, '大二': 1, '大一': 0 }
// 補位建議：需求度高的優先，再看最近有互動的；排除已在首選 10、時機未到、暫時婉拒的人
export function top10Candidates(contacts, n = 3) {
  return (contacts || [])
    .filter(c => !c.is_top10 && !c.is_muted && !c.is_archived && c.referral_stage !== '暫時婉拒'
      && c.referral_stage !== '已簽約' && c.referral_stage !== '起步中' && c.referral_stage !== '穩定經營中'
      && c.interest_level !== '沒興趣')
    .sort((a, b) => (NEED_RANK[b.need_level] ?? -1) - (NEED_RANK[a.need_level] ?? -1)
      || String(b.last_interacted_at || '').localeCompare(String(a.last_interacted_at || '')))
    .slice(0, n)
}

function Sheet({ title, onClose, children }) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--page)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const bigBtn = (primary) => ({
  width: '100%', padding: 12, borderRadius: RADIUS.md, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : `1px solid ${BORDER}`, background: primary ? PRIMARY : 'var(--card)', color: primary ? '#fff' : TEXT_MAIN,
})

// 標題列右上角的星星。欄位還沒建好時不顯示。
export function Top10Star({ contact, onChanged }) {
  const [state, setState] = useState(null) // null = 還不知道／不可用
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const t = await fetchTop10(contact.user_id)
    if (!t.ok) { setState(null); return }
    setCount(t.rows.length)
    setState(t.rows.some(r => r.id === contact.id))
  }
  useEffect(() => { load() }, [contact.id])

  if (state === null) return null
  const on = state
  const full = !on && count >= TOP10_MAX

  async function confirm() {
    if (busy) return
    setBusy(true); setErr('')
    const { error } = await setTop10(contact.id, !on)
    setBusy(false)
    if (error) { setErr('沒存成功，再按一次試試'); return }
    setOpen(false)
    await load()
    onChanged && onChanged(!on)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title={on ? '首選 10（點一下移出）' : '加入首選 10'} aria-label="首選 10"
        style={{ width: 32, height: 32, borderRadius: RADIUS.sm, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${on ? PRIMARY : BORDER}`, background: on ? PRIMARY_SOFT : 'var(--card)', color: on ? PRIMARY : TEXT_SECONDARY }}>
        {on ? <IconStarFilled size={15} /> : <IconStar size={15} stroke={1.9} />}
      </button>
      {open && (
        <Sheet title={on ? `把${contact.name}移出首選 10？` : `把${contact.name}加入首選 10？`} onClose={() => setOpen(false)}>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.7, marginBottom: 12 }}>
            首選 10 是你最先要邀約的 10 位人選，成功五要訣（BASIC-5）訓練建議跟推薦人一起挑。
            {on ? '移出後，每日行動就不會再特別提醒你聯絡他。' : '加進去後，每日行動會優先提醒你聯絡他們。'}
            目前 {count}/{TOP10_MAX}。
          </div>
          {full && <div style={{ fontSize: 13, color: '#C0392B', marginBottom: 10 }}>已滿 10 位，先移出一位。</div>}
          {err && <div style={{ fontSize: 13, color: '#C0392B', marginBottom: 10 }}>{err}</div>}
          <button disabled={busy || full} onClick={confirm} style={{ ...bigBtn(!full), opacity: full ? 0.5 : 1 }}>
            {on ? '移出首選 10' : '加入首選 10'}
          </button>
        </Sheet>
      )}
    </>
  )
}

// 「可以換人」的處理：先留著，或移出並從建議的人補位
export function Top10SwapSheet({ item, candidates, count, onClose, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [added, setAdded] = useState([])
  const [err, setErr] = useState('')
  const [base] = useState(count) // 開啟時的人數；之後名單重新載入也不會重複計算
  const left = base - (removed ? 1 : 0) + added.length

  async function keep() {
    if (busy) return
    setBusy(true)
    const { error } = await keepTop10(item.id, item.reason)
    setBusy(false)
    if (error) { setErr('沒存成功，再按一次試試'); return }
    onChanged && onChanged(); onClose()
  }
  async function remove() {
    if (busy) return
    setBusy(true)
    const { error } = await setTop10(item.id, false)
    setBusy(false)
    if (error) { setErr('沒存成功，再按一次試試'); return }
    setRemoved(true); onChanged && onChanged()
  }
  async function add(c) {
    if (busy || left >= TOP10_MAX) return
    setBusy(true)
    const { error } = await setTop10(c.id, true)
    setBusy(false)
    if (error) { setErr('沒存成功，再按一次試試'); return }
    setAdded(a => a.concat(c.id)); onChanged && onChanged()
  }

  return (
    <Sheet title={`${item.name}　${item.reason}`} onClose={onClose}>
      {!removed ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <button disabled={busy} onClick={keep} style={bigBtn(false)}>先留著</button>
          <button disabled={busy} onClick={remove} style={bigBtn(true)}>移出首選 10</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 8 }}>
            已移出。目前 {left}/{TOP10_MAX}，建議補這幾位（需求度高、還沒在首選 10 裡）：
          </div>
          {candidates.length === 0 && <div style={{ fontSize: 13, color: TEXT_MUTED }}>目前沒有合適的人，之後從他的頁面右上角星星加入。</div>}
          {candidates.map(c => {
            const done = added.includes(c.id)
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: 6,
                border: `1px solid ${BORDER}`, borderRadius: RADIUS.md, background: 'var(--card)' }}>
                <span style={{ fontSize: 14, color: TEXT_MAIN }}>{c.name}　<span style={{ fontSize: 12, color: TEXT_MUTED }}>{[c.egg_type, c.need_level].filter(Boolean).join(' ')}</span></span>
                <button disabled={busy || done || left >= TOP10_MAX} onClick={() => add(c)}
                  style={{ background: 'none', border: 'none', color: done ? TEXT_MUTED : PRIMARY, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {done ? '已加入' : '加入'}
                </button>
              </div>
            )
          })}
          <button onClick={onClose} style={{ ...bigBtn(false), marginTop: 6 }}>完成</button>
        </>
      )}
      {err && <div style={{ fontSize: 13, color: '#C0392B', marginTop: 10 }}>{err}</div>}
    </Sheet>
  )
}
