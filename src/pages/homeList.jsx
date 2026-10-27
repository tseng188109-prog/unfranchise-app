// 居家購物清單：只記「上次給的日期」。第一次是讓對方認識產品，之後是幫老顧客多逛幾類。
// 給過之後隔一段時間（設定頁可選 2 個月／3 個月／半年，預設 3 個月），那一列的文字改成「可以再給一次」。
// 不會跳通知，也不會出現在首頁。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { DateField } from './pickers'
import { IconListCheck, IconCheck } from '@tabler/icons-react'
import {
  PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, ACCENT_GREEN_TEXT, BORDER, RADIUS,
} from './designTokens'

export const HOME_LIST_OPTIONS = [
  { months: 2, label: '2 個月' },
  { months: 3, label: '3 個月' },
  { months: 6, label: '半年' },
]
export function resolveHomeListMonths(tagSettings) {
  const n = Number(tagSettings && tagSettings.home_list_months)
  return [2, 3, 6].includes(n) ? n : 3
}

function todayTaipei() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function md(d) { const p = d.split('-'); return `${Number(p[1])}/${Number(p[2])}` }
function monthsBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  let m = (ty - fy) * 12 + (tm - fm)
  if (td < fd) m -= 1
  return m
}

export default function HomeListRow({ customer, onChanged }) {
  const [months, setMonths] = useState(3)
  const [given, setGiven] = useState(customer.home_list_given_on || '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setGiven(customer.home_list_given_on || ''); setEditing(false) }, [customer.id, customer.home_list_given_on])
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await supabase.from('users').select('tag_settings').eq('id', customer.user_id).single()
        if (alive && data) setMonths(resolveHomeListMonths(data.tag_settings))
      } catch { /* 讀不到就用預設 3 個月 */ }
    })()
    return () => { alive = false }
  }, [customer.user_id])

  async function save(value) {
    setSaving(true)
    const { error } = await supabase.from('customers').update({ home_list_given_on: value || null }).eq('id', customer.id)
    setSaving(false)
    if (error) return
    setGiven(value || '')
    setEditing(false)
    if (onChanged) onChanged(value || null)
  }

  const t = todayTaipei()
  const ago = given ? monthsBetween(given, t) : 0
  const due = !!given && ago >= months

  let text
  if (!given) text = '還沒給過。給對方看看日常用品還有哪些可以換。'
  else if (due) text = `${ago} 個月前（${md(given)}）給過，可以再給一次，看看有沒有新的需要。`
  else text = `${md(given)} 給過`

  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.card, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
          <IconListCheck size={16} stroke={1.8} color={TEXT_SECONDARY} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 2px' }}>居家購物清單</p>
            {editing ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <DateField value={draft} onChange={e => setDraft(e.target.value)} max={t} clearable={false} placeholder="哪天給的"
                  style={{ padding: '5px 8px', borderRadius: RADIUS.xs, border: `1px solid ${BORDER}`, fontSize: 12, outline: 'none' }} />
                <button onClick={() => draft && save(draft)} disabled={saving || !draft} aria-label="存起來"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT_GREEN_TEXT, display: 'flex', opacity: draft ? 1 : 0.4 }}>
                  <IconCheck size={18} stroke={2} />
                </button>
                {given && (
                  <button onClick={() => save('')} disabled={saving}
                    style={{ fontSize: 12, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>取消紀錄</button>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: given ? TEXT_MAIN : TEXT_MUTED, margin: 0, lineHeight: 1.5 }}>{text}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {editing ? (
            <button onClick={() => setEditing(false)}
              style={{ fontSize: 12, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>取消</button>
          ) : (
            <>
              {(!given || due) && (
                <button onClick={() => save(t)} disabled={saving}
                  style={{ fontSize: 12, color: PRIMARY, background: 'var(--primary-soft)', border: 'none', borderRadius: RADIUS.sm, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {given ? '再給一次' : '給了'}
                </button>
              )}
              {given && !due && (
                <span style={{ fontSize: 12, color: ACCENT_GREEN_TEXT, fontWeight: 600 }}>已給</span>
              )}
              {given && (
                <button onClick={() => { setDraft(given); setEditing(true) }}
                  style={{ fontSize: 11, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>改日期</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
