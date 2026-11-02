// contactQuick.jsx — 他的頁面上，直接點「熟悉度／需求度／興趣程度」標籤就能改，不用進編輯頁。
// 熟悉度＋需求度改了之後，下一步建議（action_type）的算法跟編輯頁完全一樣：
// 兩個都有 → 重算 action_type；action_type 真的變了才重排下次聯絡日。
import { useState } from 'react'
import { supabase } from '../supabase'
import { NEED_LEVELS } from './needLevelPicker'
import { INTEREST_LEVELS } from './meetingFlow'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS, SUBCARD_BG,
  getEggBg, getEggColor,
} from './designTokens'

export const ACTION_MAP = {
  '茶葉蛋': { '大一': '軟性活動', '大二': '商機講座', '大三': '直接法', '大四': '直接法' },
  '荷包蛋': { '大一': '輕鬆互動', '大二': '軟性活動', '大三': '商機講座', '大四': '直接法' },
  '生雞蛋': { '大一': '輕鬆互動', '大二': '輕鬆互動', '大三': '軟性活動', '大四': '商機講座' },
}
export const DAYS_MAP = { '輕鬆互動': 30, '軟性活動': 14, '商機講座': 5, '直接法': 5 }

export const EGG_OPTIONS = [
  { value: '茶葉蛋', desc: '很熟', hint: '' },
  { value: '荷包蛋', desc: '半熟', hint: '' },
  { value: '生雞蛋', desc: '不熟', hint: '' },
]

function twDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

// 回傳要寫進 contacts 的欄位（不碰資料庫，方便測）
export function eggNeedPatch(contact, patch) {
  const egg = 'egg_type' in patch ? patch.egg_type : contact.egg_type
  const need = 'need_level' in patch ? patch.need_level : contact.need_level
  const upd = { egg_type: egg || null, need_level: need || null }
  const next = egg && need ? ACTION_MAP[egg] && ACTION_MAP[egg][need] : null
  if (next) {
    upd.action_type = next
    if (next !== contact.action_type) upd.next_contact_date = twDate(DAYS_MAP[next] || 30)
  }
  return upd
}

export async function saveEggNeed(contact, patch) {
  const upd = eggNeedPatch(contact, patch)
  const { error } = await supabase.from('contacts').update(upd).eq('id', contact.id)
  return { error, upd }
}

export async function saveInterest(contact, label) {
  const upd = { interest_level: label }
  const { error } = await supabase.from('contacts').update(upd).eq('id', contact.id)
  return { error, upd }
}

const tagBase = { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, cursor: 'pointer', border: 'none', lineHeight: 1.4 }

export function QuickTags({ contact, onSaved }) {
  const [open, setOpen] = useState(null) // 'egg' | 'need' | 'interest'
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const needInfo = NEED_LEVELS.find(n => n.value === contact.need_level)

  async function pick(kind, value) {
    if (busy) return
    setBusy(true)
    let res
    if (kind === 'egg') res = await saveEggNeed(contact, { egg_type: contact.egg_type === value ? '' : value })
    else if (kind === 'need') res = await saveEggNeed(contact, { need_level: contact.need_level === value ? '' : value })
    else res = await saveInterest(contact, value)
    setBusy(false)
    if (res.error) { setMsg('沒存成功，再點一次試試'); return }
    setOpen(null)
    setMsg('已儲存')
    setTimeout(() => setMsg(''), 1800)
    onSaved && onSaved(res.upd)
  }

  const empty = { ...tagBase, background: 'none', border: `1px dashed ${BORDER}`, color: TEXT_MUTED }
  const sheetOpts = open === 'egg' ? EGG_OPTIONS.map(o => ({ ...o, label: o.value, cur: contact.egg_type === o.value }))
    : open === 'need' ? NEED_LEVELS.map(o => ({ ...o, label: o.value, cur: contact.need_level === o.value }))
    : open === 'interest' ? INTEREST_LEVELS.map(o => ({ value: o.label, label: o.label, desc: '', hint: o.desc, cur: contact.interest_level === o.label }))
    : []
  const title = open === 'egg' ? '你們多熟？（熟悉度）' : open === 'need' ? '他對現況想不想改變？（需求度）' : '他對這門生意有興趣嗎？'

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        {contact.egg_type ? (
          <button type="button" onClick={() => setOpen('egg')}
            style={{ ...tagBase, background: getEggBg(contact.egg_type), color: getEggColor(contact.egg_type) }}>
            熟悉度 {contact.egg_type} ▾
          </button>
        ) : <button type="button" onClick={() => setOpen('egg')} style={empty}>＋熟悉度</button>}
        {contact.need_level ? (
          <button type="button" onClick={() => setOpen('need')}
            style={{ ...tagBase, background: PRIMARY_SOFT, color: PRIMARY }}>
            需求度 {contact.need_level}{needInfo ? `（${needInfo.desc}）` : ''} ▾
          </button>
        ) : <button type="button" onClick={() => setOpen('need')} style={empty}>＋需求度</button>}
        {contact.interest_level && (
          <button type="button" onClick={() => setOpen('interest')}
            style={{ ...tagBase, background: SUBCARD_BG, color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}>
            興趣 {contact.interest_level} ▾
          </button>
        )}
        {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg === '已儲存' ? PRIMARY : '#C0392B' }}>{msg}</span>}
      </div>

      {open && (
        <div onClick={() => setOpen(null)}
          style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--page)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
              borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>{title}</span>
              <button onClick={() => setOpen(null)} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
            </div>
            {open === 'need' && (
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8, lineHeight: 1.5 }}>他說過或做過什麼？符合哪句就選，都符合就選高的。</div>
            )}
            {open === 'interest' && (
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8, lineHeight: 1.5 }}>通常是見完面才會有。這裡只是修正，不會新增互動紀錄。</div>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {sheetOpts.map(o => (
                <button key={o.value} type="button" disabled={busy} onClick={() => pick(open, o.value)}
                  style={{ textAlign: 'left', padding: '11px 12px', borderRadius: RADIUS.md, cursor: 'pointer',
                    border: `2px solid ${o.cur ? PRIMARY : BORDER}`, background: o.cur ? PRIMARY_SOFT : 'var(--card)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: o.cur ? PRIMARY : TEXT_MAIN }}>
                    {o.label} {o.desc && <span style={{ fontSize: 12, fontWeight: 400, color: o.cur ? PRIMARY : TEXT_MUTED }}>{o.desc}</span>}
                  </div>
                  {o.hint && <div style={{ fontSize: 12, color: o.cur ? PRIMARY : TEXT_SECONDARY, marginTop: 3, lineHeight: 1.5 }}>{o.hint}</div>}
                </button>
              ))}
            </div>
            {open !== 'interest' && (
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10, lineHeight: 1.5 }}>
                點一下就存好。再點一次已選的，會變成沒選。兩個都選了，App 會自動排下一步建議。
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
