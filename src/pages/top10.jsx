// top10.jsx — 首選 10：最先要邀約的 10 位人選。
// 依據：成功五要訣（BASIC-5）訓練「前 10 位潛在人選名單」、起步指南「決定前十位潛在顧客名單」。
// 資料放在 contacts：is_top10（是不是）、top10_at（什麼時候選的）、top10_keep（按過「先留著」的那個原因）。
// 這些欄位還沒建（SQL 還沒跑）時，所有查詢都會安靜失敗，功能只是不亮，其他畫面照常。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { IconStar, IconStarFilled, IconChevronRight, IconCheck } from '@tabler/icons-react'
import { loadJar } from './jarData'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS, SUBCARD_BG,
  ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT, ACCENT_GREEN_TEXT, DANGER, DANGER_SOFT,
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

// ───────── 這週聯絡了誰（週六到週五，台北時間） ─────────
function twToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function twDay(iso) { return iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) : '' }
function addDay(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
export function weekStartOf(t) {
  const d = new Date(t + 'T00:00:00Z')
  return addDay(t, -((d.getUTCDay() + 1) % 7))
}
function md(d) { return d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '' }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) }

// 回傳 { ok, rows(附 lastDate, touched), flagged, pending, done, ws, we }
export async function loadTop10Week(userId) {
  const t10 = await fetchTop10(userId)
  if (!t10.ok) return { ok: false }
  const today = twToday()
  const ws = weekStartOf(today), we = addDay(ws, 6)
  const ids = t10.rows.map(r => r.id)
  const last = {}
  if (ids.length) {
    const { data } = await supabase.from('contact_logs').select('contact_id,date').in('contact_id', ids)
    ;(data || []).forEach(l => { if (!last[l.contact_id] || l.date > last[l.contact_id]) last[l.contact_id] = l.date })
  }
  const rows = t10.rows.map(r => {
    const li = twDay(r.last_interacted_at)
    const lastDate = [last[r.id] || '', li].sort().pop() || ''
    return { ...r, lastDate, touched: !!lastDate && lastDate >= ws && lastDate <= we, reason: top10NeedsAction(r) }
  })
  const flagged = rows.filter(r => r.reason)
  const live = rows.filter(r => !r.reason)
  const pending = live.filter(r => !r.touched).sort((a, b) => (a.lastDate || '').localeCompare(b.lastDate || ''))
  const done = live.filter(r => r.touched).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
  return { ok: true, rows, flagged, pending, done, ws, we, today, total: rows.length }
}

// 首頁的薄條／名單頁的橫幅：點開就是清單
export function Top10Strip({ userId, variant = 'home', onChanged }) {
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(false)
  // 首頁：首選 10 沒滿、又有核桃浮上來（還不在首選 10）時，提示可以補
  const [walnutsFree, setWalnutsFree] = useState(0)
  const navigate = useNavigate()
  async function reload() { try { setD(await loadTop10Week(userId)) } catch { setD({ ok: false }) } }
  useEffect(() => { if (userId) reload() }, [userId])
  useEffect(() => {
    if (!userId || variant === 'banner' || !d || !d.ok || d.total >= TOP10_MAX) return
    loadJar(userId).then(j => setWalnutsFree(j.walnuts.filter(w => !w.is_top10).length)).catch(() => {})
  }, [userId, variant, d])
  if (!d || !d.ok) return null
  const empty = d.total === 0
  const short = d.total < TOP10_MAX
  const warn = empty || short
  const touched = d.done.length + d.flagged.filter(r => r.touched).length
  const label = empty ? '還沒選，點這裡開始' : short ? `${d.total}/${TOP10_MAX}　再選 ${TOP10_MAX - d.total} 位` : `${d.total}/${TOP10_MAX}`
  const right = empty || short ? '' : `這週聯絡 ${touched} 位`
  const bar = variant === 'banner'
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box',
          height: 44, padding: '0 14px', borderRadius: RADIUS.xl,
          background: bar ? (warn ? ACCENT_YELLOW_SOFT : PRIMARY_SOFT) : 'var(--card)',
          border: bar ? 'none' : `1px solid ${BORDER}` }}>
        <IconStar size={18} stroke={1.9} color={warn ? ACCENT_YELLOW_TEXT : PRIMARY} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: warn ? ACCENT_YELLOW_TEXT : (bar ? PRIMARY : TEXT_MAIN), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
          {/* 有核桃提示時，字縮短一點，免得整條被擠出畫面 */}
          {'首選 10\u3000' + (walnutsFree > 0 && d.total < TOP10_MAX ? (empty ? '還沒選' : `${d.total}/${TOP10_MAX}`) : label)}
        </span>
        {walnutsFree > 0 && d.total < TOP10_MAX && (
          <span role="link" tabIndex={0} onClick={e => { e.stopPropagation(); navigate('/contacts?jar=1') }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); navigate('/contacts?jar=1') } }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#F3E7D8', color: '#7B532E', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="-11 -11 22 22" aria-hidden="true"><path d="M0,-9 C6.5,-9 10,-4 10,1 C10,6.5 6,10 0,10 C-6,10 -10,6.5 -10,1 C-10,-4 -6.5,-9 0,-9Z" fill="#9A6A3F" /><path d="M0,-8 C-1,-3 1,3 0,9" stroke="#6F4825" strokeWidth="1.4" fill="none" /></svg>
            {walnutsFree} 顆核桃可以補
          </span>
        )}
        {d.flagged.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: DANGER_SOFT, color: DANGER, whiteSpace: 'nowrap' }}>{d.flagged.length} 位可以換人</span>
        )}
        <span style={{ flex: 1, textAlign: 'right', fontSize: 12, color: TEXT_SECONDARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{walnutsFree > 0 && d.total < TOP10_MAX ? '' : right}</span>
        <IconChevronRight size={16} stroke={1.9} color={TEXT_MUTED} style={{ flexShrink: 0 }} />
      </button>
      {open && <Top10Panel data={d} userId={userId} onClose={() => setOpen(false)} onChanged={() => { reload(); onChanged && onChanged() }} />}
    </>
  )
}

function PersonRow({ r, right, rightColor, sub, onOpen }) {
  return (
    <div onClick={() => onOpen(r)}
      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${BORDER}`, cursor: 'pointer' }}>
      <span style={{ width: 36, height: 36, borderRadius: '50%', background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{(r.name || '?')[0]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_MAIN }}>{r.name}</div>
        {sub && <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 12, color: rightColor, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )
}

export function Top10Panel({ data, userId, onClose, onChanged }) {
  const navigate = useNavigate()
  const [swap, setSwap] = useState(null)
  const { ws, we, today, total, flagged, pending, done } = data
  const touched = done.length
  const subOf = r => [r.egg_type, r.need_level, r.interest_level && `興趣 ${r.interest_level}`].filter(Boolean).join(' · ')
  const open = r => { onClose(); navigate(`/contacts/${r.id}`) }

  async function openSwap(r) {
    const [{ data: cs }, { data: cust }] = await Promise.all([
      supabase.from('contacts').select('id,name,egg_type,need_level,is_top10,is_muted,is_archived,referral_stage,interest_level,last_interacted_at')
        .eq('user_id', userId).eq('is_archived', false).limit(300),
      supabase.from('customers').select('contact_id').eq('user_id', userId).eq('is_archived', false).not('contact_id', 'is', null),
    ])
    const custIds = new Set((cust || []).map(x => x.contact_id))
    const pool = (cs || []).filter(c => !custIds.has(c.id) || c.referral_stage)
    setSwap({ id: r.id, name: r.name, reason: r.reason, candidates: top10Candidates(pool, 3) })
  }

  return (
    <>
      <Sheet title={`首選 10　${total}/${TOP10_MAX}`} onClose={onClose}>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6 }}>
          這週（{md(ws)}–{md(we)}）聯絡了 {touched} 位，還有 {pending.length} 位沒聯絡
        </div>
        <div style={{ height: 5, borderRadius: 3, background: SUBCARD_BG, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${Math.min(100, (touched / TOP10_MAX) * 100)}%`, height: '100%', background: PRIMARY }} />
        </div>
        <div style={{ margin: '0 -16px', background: 'var(--card)' }}>
          {flagged.length > 0 && (
            <div style={{ padding: '10px 16px', background: DANGER_SOFT }}>
              {flagged.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ fontSize: 13, color: DANGER }}>{r.name}　{r.reason}</span>
                  <button onClick={() => openSwap(r)} style={{ background: 'none', border: 'none', color: DANGER, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>處理</button>
                </div>
              ))}
            </div>
          )}
          {total === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7 }}>
              首選 10 是你最先要邀約的 10 位人選，成功五要訣（BASIC-5）訓練建議跟推薦人一起挑。<br />到他的頁面，點右上角的星星就能加進來。
            </div>
          )}
          {pending.length > 0 && <div style={{ padding: '8px 16px', background: SUBCARD_BG, fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>還沒聯絡 · {pending.length} 位</div>}
          {pending.map(r => (
            <PersonRow key={r.id} r={r} onOpen={open} sub={subOf(r)} rightColor={r.lastDate ? ACCENT_YELLOW_TEXT : TEXT_MUTED}
              right={r.lastDate ? `${daysBetween(r.lastDate, today)} 天沒聯絡` : '還沒聯絡過'} />
          ))}
          {done.length > 0 && <div style={{ padding: '8px 16px', background: SUBCARD_BG, fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY }}>這週已聯絡 · {done.length} 位</div>}
          {done.map(r => {
            const planned = r.next_plan_date && r.next_plan_date >= today ? `約好 ${md(r.next_plan_date)}${r.next_plan ? ' ' + r.next_plan : ''}` : ''
            return (
              <PersonRow key={r.id} r={r} onOpen={open} sub={[subOf(r), planned].filter(Boolean).join(' · ')} rightColor={ACCENT_GREEN_TEXT}
                right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><IconCheck size={14} stroke={2} />{md(r.lastDate)}</span>} />
            )
          })}
          {total > 0 && total < TOP10_MAX && (
            <button onClick={() => { onClose(); navigate('/contacts') }}
              style={{ width: '100%', padding: 14, background: 'none', border: 'none', color: PRIMARY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              再選 {TOP10_MAX - total} 位，湊滿 10 位
            </button>
          )}
        </div>
      </Sheet>
      {swap && <Top10SwapSheet item={swap} candidates={swap.candidates} count={total} onClose={() => setSwap(null)} onChanged={onChanged} />}
    </>
  )
}
