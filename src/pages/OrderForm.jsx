import { useState, useEffect } from 'react'
import { DateField, SelectField } from './pickers'
import { askConfirm } from './confirmDialog'
import { supabase } from '../supabase'
import { IconX, IconPlus, IconTrash, IconRepeat, IconCircleCheck, IconCopy, IconChevronRight, IconChevronDown } from '@tabler/icons-react'
import { saveDraft, loadDraft, clearDraft } from './formDraft'
import { today } from './teamStats'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_YELLOW, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT,
  ACCENT_GREEN_TEXT,
  ACCENT_PINK,ACCENT_PINK_SOFT, ACCENT_PINK_TEXT,
  DANGER, BORDER, SUBCARD_BG, RADIUS } from './designTokens'
import {
  num, fmt, uid, blankLine, blankAdjustment, shortDate, addDays, qtyOf, r2,
  computeOrder, buildRows, adjustmentSpec, buildCopyText, copyToClipboard,
  fetchProductCatalog, fetchLastPurchase, fetchWeekPoints, fetchUseDays, saveUseDays, autoRepurchase,
} from './orderUtils'

const inp = {
  width: '100%', padding: '9px 10px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`,
  fontSize: 14, background: 'var(--card)', boxSizing: 'border-box', outline: 'none', color: TEXT_MAIN, minWidth: 0,
}
const lbl = { fontSize: 11, color: TEXT_SECONDARY, margin: '0 0 3px', display: 'block' }
const ADJ_KIND_LABEL = { amount: '金額折扣', percent: '幾折', shipping: '運費' }

// props:
// userId, customerId, customerName — 這張訂單屬於誰（必填）
// orderId  — 有的話是「編輯這張訂單」，沒有就是新增
// fromTxId — 有的話是「把一筆舊的單筆紀錄改成訂單」：讀進那一筆，可以再加產品，存檔時換成一張新訂單（舊的那一筆刪掉）
// onDone   — 存檔後按「完成」
// onCancel — 有給才會顯示右上角的 X
export default function OrderForm({ userId, customerId, customerName, orderId = null, fromTxId = null, onDone, onCancel }) {
  const editing = !!orderId || !!fromTxId
  const draftKey = `orderForm:${customerId}:${orderId || fromTxId || 'new'}`
  const [form, setForm] = useState(() => loadDraft(draftKey) || {
    date: today(), lines: [blankLine()], adjustments: [], note: '',
  })
  const [loading, setLoading] = useState(editing)
  const [oldIds, setOldIds] = useState([])
  const [catalog, setCatalog] = useState({ map: {}, names: [] })
  const [useDays, setUseDays] = useState({})
  const [last, setLast] = useState(null)
  const [showAdj, setShowAdj] = useState(() => (loadDraft(draftKey)?.adjustments || []).length > 0)
  const [showNote, setShowNote] = useState(() => !!(loadDraft(draftKey)?.note))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    fetchProductCatalog(userId, customerId).then(setCatalog)
    fetchUseDays(userId).then(setUseDays)
    if (!editing) fetchLastPurchase(customerId).then(setLast)
  }, [userId, customerId, editing])

  // 編輯模式：把這張訂單原本的內容讀進來（有未完成的草稿就用草稿）
  useEffect(() => {
    if (!orderId && !fromTxId) return
    let cancelled = false
    async function load() {
      if (!orderId) {
        const { data: r } = await supabase.from('transactions').select('*').eq('id', fromTxId).single()
        if (cancelled) return
        if (r) {
          setOldIds([r.id])
          if (!loadDraft(draftKey)) {
            setForm({
              date: r.date, adjustments: [], note: '',
              lines: [{
                key: uid(), product_name: r.product_name || '', quantity: String(qtyOf(r)), type: r.type || 'BV',
                points: r.points != null ? String(r.points) : '',
                amount: Number(r.amount) > 0 ? String(r.amount) : '',
                cost: r.cost != null ? String(r.cost) : '',
                is_gift: !!r.is_gift,
              }],
            })
          }
        }
        setLoading(false)
        return
      }
      const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single()
      const { data: rows } = await supabase.from('transactions').select('*').eq('order_id', orderId)
      if (cancelled) return
      setOldIds((rows || []).map(r => r.id))
      if (!loadDraft(draftKey) && o) {
        const lines = (rows || []).filter(r => !r.line_kind).map(r => ({
          key: uid(), product_name: r.product_name || '', quantity: String(qtyOf(r)), type: r.type || 'BV',
          points: r.points != null ? String(r.points) : '',
          amount: Number(r.amount) > 0 ? String(r.amount) : '',
          cost: r.cost != null ? String(r.cost) : '',
          is_gift: !!r.is_gift,
        }))
        const adjustments = (o.adjustments || []).map(a => ({ id: a.id || uid(), kind: a.kind, value: a.value, payer: a.payer || 'me' }))
        setForm({ date: o.date, lines: lines.length ? lines : [blankLine()], adjustments, note: o.note || '' })
        setShowAdj(adjustments.length > 0)
        setShowNote(!!o.note)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orderId, fromTxId, draftKey])

  // 填到一半 App 關掉重開，草稿自動補回來
  useEffect(() => {
    if (loading || saved) return
    saveDraft(draftKey, form)
  }, [form, loading, saved, draftKey])

  function setLine(key, patch) {
    setForm(f => ({ ...f, lines: f.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }))
  }
  function removeLine(key) {
    setForm(f => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter(l => l.key !== key) : f.lines }))
  }
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, blankLine()] }))
  }

  // 產品名對得上以前的紀錄，而且這一列的數字都還空著，就帶入上次的點數、成本、這位顧客上次的賣價
  function autofill(line, name) {
    const m = catalog.map[name.trim()]
    const empty = line.points === '' && line.cost === '' && line.amount === ''
    if (!m || !empty) return {}
    const q = qtyOf(line)
    const auto = { points: m.points, cost: m.cost, amount: m.custPrice }
    return {
      type: m.type || line.type,
      points: m.points != null ? String(r2(m.points * q)) : '',
      cost: m.cost != null ? String(r2(m.cost * q)) : '',
      amount: m.custPrice != null ? String(r2(m.custPrice * q)) : '',
      auto,
    }
  }
  // 改數量：如果點數、成本、賣價還是系統帶入的數字，就跟著數量一起換算；自己改過的不動
  function onQtyChange(line, v) {
    const oldQ = qtyOf(line)
    const newQ = Math.round(Number(v))
    const patch = { quantity: v }
    if (line.auto && v !== '' && newQ >= 1) {
      ;['points', 'cost', 'amount'].forEach(k => {
        const u = line.auto[k]
        if (u != null && line[k] !== '' && r2(num(line[k])) === r2(u * oldQ)) patch[k] = String(r2(u * newQ))
      })
    }
    setLine(line.key, patch)
  }
  function onNameChange(line, name) {
    const jumped = name.length - line.product_name.length > 1
    setLine(line.key, { product_name: name, ...(jumped ? autofill(line, name) : {}) })
  }
  function onNameBlur(line) {
    const patch = autofill(line, line.product_name)
    if (Object.keys(patch).length) setLine(line.key, patch)
  }

  async function applyLast() {
    if (!last) return
    const hasContent = form.lines.some(l => l.product_name.trim())
    if (hasContent && !(await askConfirm({ title:'取代目前填的產品？', message:'會換成上一次的產品內容。', okText:'取代' }))) return
    setForm(f => ({
      ...f,
      lines: last.lines.map(t => ({
        key: uid(), product_name: t.product_name || '', quantity: String(qtyOf(t)), type: t.type || 'BV',
        points: t.points != null ? String(t.points) : '',
        amount: Number(t.amount) > 0 ? String(t.amount) : '',
        cost: t.cost != null ? String(t.cost) : '',
        is_gift: false,
      })),
    }))
  }

  function addAdjustment(kind) {
    setForm(f => ({ ...f, adjustments: [...f.adjustments, blankAdjustment(kind)] }))
  }
  function setAdj(id, patch) {
    setForm(f => ({ ...f, adjustments: f.adjustments.map(a => (a.id === id ? { ...a, ...patch } : a)) }))
  }
  function removeAdj(id) {
    setForm(f => ({ ...f, adjustments: f.adjustments.filter(a => a.id !== id) }))
  }

  const calc = computeOrder(form.lines, form.adjustments)

  async function handleSave() {
    if (saving) return
    setError('')
    const strayIdx = form.lines.findIndex(l => !l.product_name.trim() && (l.points !== '' || l.amount !== '' || l.cost !== ''))
    if (strayIdx >= 0) { setError(`第 ${strayIdx + 1} 項填了數字，但還沒填產品名`); return }
    const used = form.lines.filter(l => l.product_name.trim())
    if (used.length === 0) { setError('至少要填一個產品'); return }
    const noPoints = used.find(l => !l.is_gift && l.points === '')
    if (noPoints) { setError(`「${noPoints.product_name.trim()}」還沒填點數`); return }

    setSaving(true)
    const c = computeOrder(form.lines, form.adjustments)
    const orderPayload = {
      date: form.date,
      note: form.note.trim() || null,
      adjustments: adjustmentSpec(form.adjustments),
    }
    let oid = orderId
    if (orderId) {
      const { error: e1 } = await supabase.from('orders').update(orderPayload).eq('id', orderId)
      if (e1) { setError('存檔失敗：' + e1.message); setSaving(false); return }
    } else {
      const { data: o, error: e1 } = await supabase.from('orders')
        .insert({ ...orderPayload, user_id: userId, customer_id: customerId }).select('id').single()
      if (e1 || !o) { setError('存檔失敗：' + (e1?.message || '')); setSaving(false); return }
      oid = o.id
    }
    const rows = buildRows({ userId, customerId, orderId: oid, date: form.date, lines: form.lines, calc: c })
    const { error: e2 } = await supabase.from('transactions').insert(rows)
    if (e2) {
      if (!orderId) await supabase.from('orders').delete().eq('id', oid)
      setError('存檔失敗：' + e2.message)
      setSaving(false)
      return
    }
    // 新的列都寫進去了，才刪掉舊的，中途失敗不會把原本的資料弄丟
    if (oldIds.length) await supabase.from('transactions').delete().in('id', oldIds)

    const ship = form.adjustments.find(a => a.kind === 'shipping' && num(a.value) > 0)
    if (ship) { try { localStorage.setItem('ufa_last_shipping', String(ship.value)) } catch {} }
    clearDraft(draftKey)

    const copyText = buildCopyText(customerName, form.lines, c)
    // 回購提醒自動串聯：一份能用幾天 × 份數 → 設好這位顧客的回購提醒（規則寫在 autoRepurchase）
    let auto = { state: 'none' }
    try { auto = await autoRepurchase({ customerId, orderId: oid, date: form.date, calc: c, useDays, isEdit: editing }) } catch { /* 算不出來就不處理，不影響存檔 */ }
    if (editing && auto.state === 'none') {
      setSaved({ edited: true, calc: c, copyText })
      setSaving(false)
      return
    }
    const week = editing ? null : await fetchWeekPoints(userId)
    const days = {}
    const qty = {}
    c.paid.forEach(l => {
      const name = l.product_name.trim()
      days[name] = useDays[name] ? String(useDays[name]) : ''
      qty[name] = (qty[name] || 0) + qtyOf(l)
    })
    setSaved({
      edited: editing, calc: c, copyText, week, date: form.date, qty,
      existingReminder: auto.existing || null,
      autoDate: auto.computed || null, prevReminder: auto.previous || null,
      days, reminderState: auto.state === 'ask' ? null : auto.state, copyOpen: false, copied: false,
    })
    setSaving(false)
  }

  if (loading) return <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: 'center', padding: 20 }}>讀取中…</p>

  // ───────── 存檔後 ─────────
  if (saved) {
    const names = Object.keys(saved.days || {})
    // 一份能用幾天 × 這次買幾份 ＝ 這個產品大概用到哪天；好幾個產品就取最早用完的
    const filled = names.map(n => num(saved.days[n]) * ((saved.qty && saved.qty[n]) || 1)).filter(d => d > 0)
    const suggest = filled.length ? addDays(saved.date, Math.round(Math.min(...filled))) : null
    const setDays = (name, v) => setSaved(s => ({ ...s, days: { ...s.days, [name]: v } }))

    async function setReminder() {
      if (!suggest) return
      const map = {}
      names.forEach(n => { map[n] = saved.days[n] })
      await saveUseDays(userId, map)
      await supabase.from('customers').update({ repurchase_reminder: suggest }).eq('id', customerId)
      setSaved(s => ({ ...s, reminderState: 'set' }))
    }
    async function doCopy() {
      const ok = await copyToClipboard(saved.copyText)
      setSaved(s => ({ ...s, copied: ok }))
    }

    return (
      <div>
        <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 14, textAlign: 'center', marginBottom: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight:600, color: TEXT_MAIN, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconCircleCheck size={18} stroke={1.9} color={ACCENT_GREEN_TEXT} />
            {saved.edited ? '已儲存修改' : `已記下 ${customerName} 的訂單`}
          </p>
          {!saved.edited && saved.week && (
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY }}>
              本週 BV {fmt(saved.week.bv)}{saved.calc.bv > 0 ? `（+${fmt(saved.calc.bv)}）` : ''}
              {(saved.week.ibv > 0 || saved.calc.ibv > 0) ? `　IBV ${fmt(saved.week.ibv)}${saved.calc.ibv > 0 ? `（+${fmt(saved.calc.ibv)}）` : ''}` : ''}
            </p>
          )}
        </div>

        {names.length > 0 && saved.reminderState !== 'skip' && saved.reminderState !== 'none' && (
          <div style={{ background: ACCENT_PINK_SOFT, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 }}>
            {saved.reminderState === 'set' ? (
              <p style={{ margin: 0, fontSize: 13, fontWeight:600, color: ACCENT_PINK_TEXT }}>
                已設好回購提醒：{shortDate(suggest)}
              </p>
            ) : saved.reminderState === 'auto' ? (
              <>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight:600, color: ACCENT_PINK_TEXT }}>
                  已幫你設好回購提醒：{shortDate(saved.autoDate)}
                </p>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                  {names.map(n => `${n}${saved.qty[n] > 1 ? ` ×${saved.qty[n]}` : ''}（一份 ${saved.days[n]} 天）`).join('、')}，最早用完的那個。快用完前首頁會提醒你。
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSaved(s => ({ ...s, reminderState: null, adjusting: true }))}
                    style={{ flex: 1, padding: '9px', borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, background: 'var(--card)', color: TEXT_SECONDARY, fontSize: 13, cursor: 'pointer' }}>
                    調整天數
                  </button>
                  <button onClick={async () => {
                      await supabase.from('customers').update({ repurchase_reminder: saved.prevReminder || null }).eq('id', customerId)
                      setSaved(s => ({ ...s, reminderState: 'skip' }))
                    }}
                    style={{ flex: 1, padding: '9px', borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, background: 'var(--card)', color: TEXT_SECONDARY, fontSize: 13, cursor: 'pointer' }}>
                    不要這個提醒
                  </button>
                </div>
              </>
            ) : saved.reminderState === 'same' ? (
              <p style={{ margin: 0, fontSize: 13, fontWeight:600, color: ACCENT_PINK_TEXT }}>
                回購提醒維持 {shortDate(saved.autoDate)}
              </p>
            ) : saved.reminderState === 'past' ? (
              <p style={{ margin: 0, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                這張訂單算出來的用完日（{shortDate(saved.autoDate)}）已經過了，沒有設回購提醒。
              </p>
            ) : (
              <>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight:600, color: ACCENT_PINK_TEXT }}>
                  {suggest ? `大約 ${shortDate(suggest)} 會用完` : '要設回購提醒嗎？'}
                </p>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                  填每個產品「一份」大概用幾天，買幾份會自動乘上去。快用完前首頁會提醒你問問他用得順不順。
                  {saved.existingReminder ? `（目前的提醒是 ${shortDate(saved.existingReminder)}，設了會換成新的）` : ''}
                </p>
                {names.map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: TEXT_MAIN, wordBreak: 'break-word' }}>{n}{saved.qty && saved.qty[n] > 1 ? ` ×${saved.qty[n]}` : ''}</span>
                    <input type="number" inputMode="numeric" placeholder="一份幾天" value={saved.days[n]}
                      onChange={e => setDays(n, e.target.value)}
                      style={{ ...inp, width: 80, textAlign: 'right' }} />
                    <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>天</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={setReminder} disabled={!suggest}
                    style={{ flex: 1, padding: '10px', borderRadius: RADIUS.md, border: 'none', background: suggest ? ACCENT_PINK : 'var(--pink-border)', color: '#fff', fontSize: 14, fontWeight:600, cursor: suggest ? 'pointer' : 'default' }}>
                    設提醒
                  </button>
                  <button onClick={async () => {
                      // 從「調整天數」進來的，按「不用」＝連自動設的提醒也還原
                      if (saved.adjusting) await supabase.from('customers').update({ repurchase_reminder: saved.prevReminder || null }).eq('id', customerId)
                      setSaved(s => ({ ...s, reminderState: 'skip' }))
                    }}
                    style={{ flex: 1, padding: '10px', borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, background: 'var(--card)', color: TEXT_SECONDARY, fontSize: 14, cursor: 'pointer' }}>
                    不用
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 }}>
          <button onClick={() => setSaved(s => ({ ...s, copyOpen: !s.copyOpen }))}
            style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight:600, color: PRIMARY }}>
            <IconCopy size={16} stroke={1.9} /> 複製給 {customerName}
            <span style={{ marginLeft: 'auto', display: 'flex' }}>{saved.copyOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}</span>
          </button>
          {saved.copyOpen && (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: TEXT_SECONDARY }}>只有品名和價錢，沒有成本和 BV。可以直接改文字。</p>
              <textarea value={saved.copyText} rows={7}
                onChange={e => setSaved(s => ({ ...s, copyText: e.target.value, copied: false }))}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
              <button onClick={doCopy}
                style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: RADIUS.md, border: 'none', background: PRIMARY, color: '#fff', fontSize: 14, fontWeight:600, cursor: 'pointer' }}>
                {saved.copied ? '已複製' : '複製'}
              </button>
              {saved.calc.missingPrice > 0 && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: ACCENT_YELLOW_TEXT }}>有產品的賣價還沒填，那一行會寫「價錢待確認」，補上價錢後再複製比較完整。</p>
              )}
            </div>
          )}
        </div>

        <button onClick={() => onDone && onDone()}
          style={{ width: '100%', padding: '12px', borderRadius: RADIUS.lg, border: 'none', background: PRIMARY, color: '#fff', fontSize: 15, fontWeight:600, cursor: 'pointer' }}>
          完成
        </button>
      </div>
    )
  }

  // ───────── 輸入畫面 ─────────
  return (
    <div>
      <datalist id="ufa-products">
        {catalog.names.slice(0, 200).map(n => <option key={n} value={n} />)}
      </datalist>

      <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={lbl}>{editing ? '編輯訂單' : '新增訂單'}</span>
            <p style={{ margin: 0, fontSize: 15, fontWeight:600, color: TEXT_MAIN, wordBreak: 'break-word' }}>{customerName}</p>
          </div>
          <div style={{ width: 140 }}>
            <span style={lbl}>日期</span>
            <DateField value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} />
          </div>
          {onCancel && (
            <button onClick={onCancel} aria-label="關閉"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, display: 'flex', padding: 4 }}>
              <IconX size={18} />
            </button>
          )}
        </div>
        {last && (
          <button onClick={applyLast}
            style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: RADIUS.md, border: 'none', background: PRIMARY_SOFT, color: PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconRepeat size={16} stroke={1.9} /> 同上次再買（{shortDate(last.date)} 的 {last.lines.length} 項）
          </button>
        )}
      </div>

      {form.lines.map((l, i) => {
        const m = catalog.map[l.product_name.trim()]
        const lq = qtyOf(l)
        const priceHint = m ? (m.custPrice != null ? `上次賣 ${fmt(m.custPrice * lq)}` : m.lastPrice != null ? `一般賣 ${fmt(m.lastPrice * lq)}` : '之後補') : '之後補'
        return (
          <div key={l.key} style={{ background: l.is_gift ? ACCENT_YELLOW_SOFT : 'var(--card)', border: `1px solid ${l.is_gift ? 'var(--yellow-soft)' : BORDER}`, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight:600, color: TEXT_MAIN }}>
                產品 {i + 1}
                {l.is_gift && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: RADIUS.pill, background: ACCENT_YELLOW, color: ACCENT_YELLOW_TEXT }}>贈品</span>}
              </span>
              {form.lines.length > 1 && (
                <button onClick={() => removeLine(l.key)} aria-label="刪除這個產品"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: DANGER, display: 'flex', padding: 2 }}>
                  <IconTrash size={15} stroke={1.9} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={lbl}>產品名</span>
                <input list="ufa-products" value={l.product_name} placeholder="輸入或選擇產品"
                  onChange={e => onNameChange(l, e.target.value)} onBlur={() => onNameBlur(l)} style={inp} />
              </div>
              <div style={{ width: 76 }}>
                <span style={lbl}>數量</span>
                <input type="number" inputMode="numeric" min="1" value={l.quantity} placeholder="1"
                  onChange={e => onQtyChange(l, e.target.value)} style={{ ...inp, textAlign: 'center' }} />
              </div>
            </div>
            {lq > 1 && <p style={{ margin: '6px 0 0', fontSize: 12, color: TEXT_SECONDARY }}>下面三格填 {lq} 份的合計</p>}
            <div style={{ display: 'grid', gridTemplateColumns: l.is_gift ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))', gap: 8, marginTop: 8 }}>
              <div>
                <span style={lbl}>{l.is_gift ? '成本價（選填）' : '成本價'}</span>
                <input type="number" inputMode="decimal" value={l.cost} placeholder="0" onChange={e => setLine(l.key, { cost: e.target.value })} style={inp} />
              </div>
              {!l.is_gift && (
                <>
                  <div>
                    <span style={lbl}>賣價</span>
                    <input type="number" inputMode="decimal" value={l.amount} placeholder={priceHint} onChange={e => setLine(l.key, { amount: e.target.value })} style={inp} />
                  </div>
                  <div>
                    <span style={lbl}>點數</span>
                    <input type="number" inputMode="decimal" value={l.points} placeholder="0" onChange={e => setLine(l.key, { points: e.target.value })} style={inp} />
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['BV', 'IBV'].map(t => (
                  <button key={t} onClick={() => setLine(l.key, { type: t })}
                    style={{ padding: '5px 14px', borderRadius: RADIUS.pill, border: 'none', fontSize: 12, fontWeight:600, cursor: 'pointer',
                      background: l.type === t ? (t === 'BV' ? ACCENT_YELLOW : PRIMARY) : SUBCARD_BG,
                      color: l.type === t ? (t === 'BV' ? '#5B3200' : '#fff') : TEXT_SECONDARY }}>{t}</button>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT_MAIN, cursor: 'pointer' }}>
                <input type="checkbox" checked={l.is_gift}
                  onChange={e => setLine(l.key, { is_gift: e.target.checked, ...(e.target.checked ? { amount: '', points: l.points === '' ? '0' : l.points } : {}) })} />
                贈品
              </label>
            </div>
          </div>
        )
      })}

      <button onClick={addLine}
        style={{ width: '100%', padding: '10px', borderRadius: RADIUS.md, border: `1px dashed ${PRIMARY}`, background: 'var(--card)', color: PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <IconPlus size={16} stroke={1.9} /> 再加一個產品
      </button>

      {/* 調整：折扣、運費 */}
      <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10 }}>
        <button onClick={() => setShowAdj(v => !v)}
          style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight:600, color: TEXT_MAIN }}>
          調整（折扣／運費）
          {form.adjustments.length > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: TEXT_SECONDARY }}>已加 {form.adjustments.length} 項</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', color: TEXT_MUTED }}>{showAdj ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}</span>
        </button>
        {showAdj && (
          <div style={{ marginTop: 10 }}>
            {form.adjustments.map(a => {
              const r = calc.adjResults.find(x => x.id === a.id)
              return (
                <div key={a.id} style={{ border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
                    <div>
                      <span style={lbl}>類型</span>
                      <SelectField value={a.kind} title="類型" onChange={v => setAdj(a.id, { kind: v })} style={inp}
                        options={Object.keys(ADJ_KIND_LABEL).map(k => ({ value: k, label: ADJ_KIND_LABEL[k] }))} />
                    </div>
                    <div>
                      <span style={lbl}>{a.kind === 'percent' ? '幾折' : '金額'}</span>
                      <input type="number" inputMode="decimal" value={a.value}
                        placeholder={a.kind === 'percent' ? '例如 9' : '0'}
                        onChange={e => setAdj(a.id, { value: e.target.value })} style={inp} />
                    </div>
                    <button onClick={() => removeAdj(a.id)} aria-label="刪除這一項"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: DANGER, display: 'flex', padding: '0 2px 10px' }}>
                      <IconTrash size={15} stroke={1.9} />
                    </button>
                  </div>
                  {a.kind === 'shipping' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {[['me', '我出'], ['customer', '客人出']].map(([v, t]) => (
                        <button key={v} onClick={() => setAdj(a.id, { payer: v })}
                          style={{ flex: 1, padding: '8px', borderRadius: RADIUS.sm, border: a.payer === v ? 'none' : `1px solid ${BORDER}`, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            background: a.payer === v ? PRIMARY : 'var(--card)', color: a.payer === v ? '#fff' : TEXT_SECONDARY }}>{t}</button>
                      ))}
                    </div>
                  )}
                  {a.kind === 'percent' && r && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: TEXT_SECONDARY }}>只算有賣價的產品，贈品不算，折掉 {fmt(r.amount)}</p>
                  )}
                  {a.kind === 'percent' && num(a.value) >= 10 && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: DANGER }}>幾折要小於 10，例如 9 折填 9</p>
                  )}
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['amount', 'percent', 'shipping'].map(k => (
                <button key={k} onClick={() => addAdjustment(k)}
                  style={{ padding: '7px 12px', borderRadius: RADIUS.sm, border: `1px dashed ${PRIMARY}`, background: 'var(--card)', color: PRIMARY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + {ADJ_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 合計 */}
      <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, color: TEXT_MAIN }}>
        <Row k="點數合計" v={`BV ${fmt(calc.bv)}${calc.ibv > 0 ? `　IBV ${fmt(calc.ibv)}` : ''}`} />
        <Row k="成本合計" v={fmt(calc.costTotal)} />
        <Row k="賣價合計" v={fmt(calc.listTotal)} />
        {calc.adjResults.filter(a => a.kind === 'discount').map(a => (
          <Row key={a.id} k={a.label} v={`-${fmt(a.amount)}`} color={ACCENT_PINK_TEXT} />
        ))}
        {calc.discountTotal > 0 && <Row k="折扣後實收" v={fmt(calc.received)} bold />}
        {calc.shipCustomer > 0 && <Row k="運費（客人出）" v={fmt(calc.shipCustomer)} muted />}
        {calc.shipMe > 0 && <Row k="我出的運費" v={fmt(calc.shipMe)} color={ACCENT_YELLOW_TEXT} />}
        {calc.giftCost > 0 && <Row k="其中贈品成本" v={fmt(calc.giftCost)} color={ACCENT_YELLOW_TEXT} small />}
        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 8 }}>
          <Row k="預估獲利" v={fmt(calc.profit)} bold color={calc.profit >= 0 ? ACCENT_GREEN_TEXT : DANGER} />
          {calc.missingPrice > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SECONDARY }}>
              有 {calc.missingPrice} 個產品的賣價還沒填，補上之後才完整。
            </p>
          )}
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 8 }}>
          <button onClick={() => setShowNote(v => !v)}
            style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: TEXT_SECONDARY }}>
            {showNote ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />} 整單備註（選填）
          </button>
          {showNote && (
            <textarea value={form.note} rows={3} placeholder="這張訂單想記的事"
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={{ ...inp, marginTop: 8, resize: 'vertical', fontFamily: 'inherit' }} />
          )}
        </div>
      </div>

      {error && <p style={{ margin: '0 0 10px', fontSize: 13, color: DANGER, wordBreak: 'break-word' }}>{error}</p>}

      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: '14px', borderRadius: RADIUS.lg, border: 'none', background: saving ? '#9BBBF2' : PRIMARY, color: '#fff', fontSize: 16, fontWeight:600, cursor: 'pointer' }}>
        {saving ? '儲存中…' : editing ? '儲存修改' : '儲存訂單'}
      </button>
    </div>
  )
}

function Row({ k, v, bold, muted, small, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: small ? 12 : 14,
      fontWeight: bold ? 700 : 400, color: color || (muted ? TEXT_SECONDARY : TEXT_MAIN) }}>
      <span>{k}</span><span>{v}</span>
    </div>
  )
}
