import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { IconPencil, IconTrash, IconX, IconFlask } from '@tabler/icons-react'
import { cardStyle } from './ui'
import { SAMPLE_STEPS, SAMPLE_RESULTS, sampleResultBadgeColor, formatSampleDue } from './sampleTracking'
import {
  PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_GREEN, DANGER, BORDER, SUBCARD_BG, RADIUS,
} from './designTokens'

function toDateStr(d) { return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function today() { return toDateStr(new Date()) }

const EMPTY = () => ({ product_name: '', portions: '', share_date: today(), cost: '' })

const inp = {
  width: '100%', padding: '8px 10px', borderRadius: RADIUS.xs, border: `1px solid ${BORDER}`,
  fontSize: 13, background: 'var(--card)', boxSizing: 'border-box', outline: 'none', color: TEXT_MAIN,
}

// 試用品區塊：互動名單頁、顧客頁共用同一份，兩邊看到的永遠一樣。
// props:
//   contactId  — 這個人在互動名單的 id（可為空：只有顧客檔案、沒連互動名單）
//   customerId — 顧客檔案 id（可為空）
//   onChanged  — 資料有變動時通知上層
// 儲存規則：有 contactId 就存在 contact_id（單一來源，兩頁都看得到）；沒有才存 customer_id。
export default function SampleSection({ contactId = null, customerId = null, onChanged }) {
  const navigate = useNavigate()
  const [samples, setSamples] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY())
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const fetchSamples = useCallback(async () => {
    const conds = []
    if (contactId) conds.push(`contact_id.eq.${contactId}`)
    if (customerId) conds.push(`customer_id.eq.${customerId}`)
    if (conds.length === 0) { setSamples([]); return }
    const { data } = await supabase.from('sample_tracking')
      .select('*').or(conds.join(',')).order('share_date', { ascending: false })
    setSamples(data || [])
  }, [contactId, customerId])

  useEffect(() => { fetchSamples() }, [fetchSamples])

  function costValue(v) {
    const n = Number(v)
    return v === '' || v == null || Number.isNaN(n) ? null : n
  }

  async function handleAdd() {
    if (!form.product_name.trim() || !form.portions || saving) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const row = {
      user_id: user.id,
      product_name: form.product_name.trim(),
      portions: Number(form.portions),
      share_date: form.share_date,
      cost: costValue(form.cost),
    }
    if (contactId) row.contact_id = contactId
    else row.customer_id = customerId
    const { error: e } = await supabase.from('sample_tracking').insert(row)
    setSaving(false)
    if (e) { setError('儲存失敗：' + e.message); return }
    setShowForm(false)
    setForm(EMPTY())
    fetchSamples()
    onChanged?.()
  }

  async function toggleStep(id, field, current) {
    await supabase.from('sample_tracking').update({ [field]: !current }).eq('id', id)
    setSamples(p => p.map(s => s.id === id ? { ...s, [field]: !current } : s))
    onChanged?.()
  }

  async function setResult(id, result) {
    await supabase.from('sample_tracking').update({ result }).eq('id', id)
    setSamples(p => p.map(s => s.id === id ? { ...s, result } : s))
    onChanged?.()
  }

  function openEdit(s) {
    setEditTarget(s)
    setEditForm({
      product_name: s.product_name || '', portions: s.portions || '',
      share_date: s.share_date || today(), cost: s.cost == null ? '' : String(s.cost),
    })
  }

  async function saveEdit() {
    if (!editForm.product_name.trim() || !editForm.portions) return
    setEditSaving(true); setError('')
    const { error: e } = await supabase.from('sample_tracking').update({
      product_name: editForm.product_name.trim(),
      portions: Number(editForm.portions),
      share_date: editForm.share_date,
      cost: costValue(editForm.cost),
    }).eq('id', editTarget.id)
    setEditSaving(false)
    if (e) { setError('儲存失敗：' + e.message); return }
    setEditTarget(null)
    fetchSamples()
    onChanged?.()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('sample_tracking').delete().eq('id', deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
    fetchSamples()
    onChanged?.()
  }

  const totalCost = samples.reduce((s, x) => s + (Number(x.cost) || 0), 0)

  return (
    <div style={{ ...cardStyle, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconFlask size={14} stroke={1.9} color={TEXT_SECONDARY} /> 試用品
          {totalCost > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED }}>成本合計 NT${totalCost.toLocaleString()}</span>
          )}
        </span>
        <button onClick={() => setShowForm(v => !v)}
          style={{ fontSize: 12, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
          {showForm ? '取消' : '+ 發送試用品'}
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: DANGER, margin: '0 0 8px' }}>{error}</p>}

      {showForm && (
        <div style={{ background: SUBCARD_BG, borderRadius: RADIUS.sm, padding: 12, marginBottom: 10 }}>
          <input value={form.product_name} placeholder="體驗產品 *"
            onChange={e => setForm(p => ({ ...p, product_name: e.target.value }))}
            style={{ ...inp, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="number" value={form.portions} placeholder="幾天份 *"
              onChange={e => setForm(p => ({ ...p, portions: e.target.value }))} style={{ ...inp, flex: 1 }} />
            <input type="date" value={form.share_date} max={today()}
              onChange={e => setForm(p => ({ ...p, share_date: e.target.value }))} style={{ ...inp, flex: 1 }} />
          </div>
          <input type="number" value={form.cost} placeholder="成本 NT$（選填）"
            onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} style={inp} />
          <button onClick={handleAdd} disabled={saving}
            style={{ width: '100%', padding: '9px', borderRadius: RADIUS.xs, border: 'none', marginTop: 8,
              background: saving ? '#9BBBF2' : PRIMARY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      )}

      {samples.length === 0 ? (
        !showForm && <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0 }}>目前沒有試用品紀錄</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {samples.map(s => {
            const isActive = !s.result
            const isConsidering = s.result === '考慮中'
            const badgeColor = sampleResultBadgeColor(s.result)
            return (
              <div key={s.id} style={{ background: SUBCARD_BG, borderRadius: RADIUS.sm, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isActive || isConsidering ? 8 : 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MAIN }}>
                    {s.product_name} · {s.portions}天份
                    {s.cost != null && <span style={{ color: TEXT_MUTED, fontWeight: 500 }}> · 成本 ${Number(s.cost).toLocaleString()}</span>}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {s.result && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: RADIUS.pill,
                        background: badgeColor.bg, color: badgeColor.text }}>{s.result}</span>
                    )}
                    <button onClick={() => openEdit(s)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, padding: 2, display: 'flex' }}>
                      <IconPencil size={13} stroke={1.9} />
                    </button>
                    <button onClick={() => setDeleteTarget(s.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: DANGER, padding: 2, display: 'flex' }}>
                      <IconTrash size={13} stroke={1.9} />
                    </button>
                  </div>
                </div>

                {isActive && (
                  <>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {SAMPLE_STEPS.map(step => (
                        <button key={step.field} onClick={() => toggleStep(s.id, step.field, s[step.field])}
                          style={{ flex: 1, padding: '5px 4px', borderRadius: RADIUS.xs, border: 'none',
                            fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            background: s[step.field] ? ACCENT_GREEN : 'var(--card)',
                            color: s[step.field] ? '#fff' : TEXT_SECONDARY }}>
                          {s[step.field] ? '✓ ' : ''}{step.label}
                        </button>
                      ))}
                    </div>
                    {s.followup_3_done && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {SAMPLE_RESULTS.map(r => (
                          <button key={r} onClick={() => setResult(s.id, r)}
                            style={{ flex: 1, padding: '5px 4px', borderRadius: RADIUS.xs, border: 'none',
                              fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'var(--card)', color: TEXT_SECONDARY }}>{r}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {isConsidering && s.next_followup_date && (
                  <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 6px' }}>
                    下次追蹤：{formatSampleDue(s.next_followup_date, today())}
                    <span style={{ color: PRIMARY, marginLeft: 6, cursor: 'pointer' }}
                      onClick={() => navigate('/samples')}>去試用品頁追蹤 →</span>
                  </p>
                )}

                {!isActive && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {SAMPLE_RESULTS.map(r => (
                      <button key={r} onClick={() => setResult(s.id, r)}
                        style={{ flex: 1, padding: '5px 4px', borderRadius: RADIUS.xs, border: 'none',
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          background: s.result === r ? PRIMARY : 'var(--card)',
                          color: s.result === r ? '#fff' : TEXT_SECONDARY }}>{r}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,42,77,0.4)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setEditTarget(null)}>
          <div style={{ background: 'var(--card)', borderRadius: '22px 22px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>編輯試用品紀錄</h2>
              <button onClick={() => setEditTarget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED }}><IconX size={22} /></button>
            </div>
            <input value={editForm.product_name} placeholder="體驗產品 *"
              onChange={e => setEditForm(p => ({ ...p, product_name: e.target.value }))}
              style={{ ...inp, padding: '10px 12px', fontSize: 14, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="number" value={editForm.portions} placeholder="幾天份 *"
                onChange={e => setEditForm(p => ({ ...p, portions: e.target.value }))}
                style={{ ...inp, padding: '10px 12px', fontSize: 14, flex: 1 }} />
              <input type="date" value={editForm.share_date}
                onChange={e => setEditForm(p => ({ ...p, share_date: e.target.value }))}
                style={{ ...inp, padding: '10px 12px', fontSize: 14, flex: 1 }} />
            </div>
            <input type="number" value={editForm.cost} placeholder="成本 NT$（選填）"
              onChange={e => setEditForm(p => ({ ...p, cost: e.target.value }))}
              style={{ ...inp, padding: '10px 12px', fontSize: 14, marginBottom: 16 }} />
            <button onClick={saveEdit} disabled={editSaving}
              style={{ width: '100%', padding: '13px 0', borderRadius: RADIUS.lg, border: 'none',
                background: editSaving ? '#9BBBF2' : PRIMARY, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {editSaving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,42,77,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'var(--card)', borderRadius: RADIUS.xl, padding: 24, width: 280, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <IconTrash size={30} stroke={1.6} color={DANGER} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, margin: '0 0 8px' }}>確定刪除這筆試用品紀錄？</p>
            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '0 0 20px' }}>連同追蹤紀錄一併刪除，無法復原</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: RADIUS.md, border: `1px solid ${BORDER}`,
                  background: 'var(--card)', fontSize: 14, cursor: 'pointer', color: TEXT_SECONDARY }}>取消</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, padding: '10px 0', borderRadius: RADIUS.md, border: 'none',
                  background: DANGER, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {deleting ? '刪除中…' : '刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
