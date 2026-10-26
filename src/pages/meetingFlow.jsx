// meetingFlow.jsx — 「見完了 → 約下一次」流程、標籤清單、下一次卡片、見面前提示
// 原則：必填只有「她有興趣嗎」，其他都選填；標籤清單可改名／隱藏／自己新增。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { markDaily312 } from './followUp'
import { trackUsage } from './usage'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_SECONDARY, TEXT_MUTED, BORDER, SUBCARD_BG, RADIUS,
  ACCENT_GREEN_TEXT, ACCENT_GREEN_SOFT, DANGER,
} from './designTokens'

function todayStr() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
export function fmtPlanDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00+08:00')
  const t = todayStr()
  if (dateStr === t) return '今天'
  if (dateStr === addDays(t, 1)) return '明天'
  return `${d.getMonth() + 1}/${d.getDate()} 週${WEEK[new Date(dateStr + 'T12:00:00Z').getUTCDay()]}`
}

// ---- 興趣程度 ----
export const INTEREST_LEVELS = [
  { key: 'very', label: '很有興趣', dot: '#3ECF8E', desc: '她自己想多了解', tip: '約下一次：一對一或說明會', plans: ['一對一聊聊', '事業說明會', '三方通話'] },
  { key: 'some', label: '有點興趣', dot: '#8FCBA8', desc: '問了幾句、想看看', tip: '約下一次：體驗產品，或聊她在意的事', plans: ['體驗產品', '逛網站', '家庭事業說明會'] },
  { key: 'watch', label: '觀望中', dot: '#FFD166', desc: '不排斥，但還沒想動', tip: '先保持聯絡，分享一則對她有用的資訊', plans: ['看線上影片', '約聚餐'] },
  { key: 'none', label: '沒興趣', dot: '#E8A06B', desc: '這次聽完沒有火花', tip: '先放著，維持朋友關係，不打擾', plans: [] },
  { key: 'unknown', label: '看不出來', dot: '#77726A', desc: '她說得不多', tip: '下次多問、多聽，別急著介紹', plans: ['約聚餐', '一對一聊聊'] },
]
export const ABOUT_OPTIONS = ['產品', '生意機會', '還不確定']
const ALL_PLANS = ['體驗產品', '逛網站', '一對一聊聊', '家庭事業說明會', '事業說明會', '三方通話', '看線上影片', '約聚餐']

// ---- 預設標籤 ----
export const DEFAULT_NEEDS = ['睡眠精神', '省錢', '身體狀況', '皮膚保養', '家人照顧', '額外收入', '時間自由', '想轉變', '有能力沒舞台', '想學習成長', '孩子教養', '人脈社群']
export const DEFAULT_SIGNALS = ['問了價格', '問怎麼做', '想帶朋友', '自己提時間', '要了資料', '主動傳訊息']
const SHOW_FIRST = 8

function resolveTags(defaults, saved, prefix) {
  const list = (saved || [])
  const base = defaults.map((l, i) => {
    const o = list.find(s => s.id === prefix + i)
    return { id: prefix + i, label: (o && o.label) || l, hidden: !!(o && o.hidden), custom: false }
  })
  const customs = list.filter(s => s.custom).map(s => ({ id: s.id, label: s.label, hidden: !!s.hidden, custom: true }))
  return base.concat(customs)
}

// 「多記一點」開關（個人偏好，只存在這支手機）
export function getShowMore() {
  try { return localStorage.getItem('ufa_more_tags') !== '0' } catch { return true }
}
export function setShowMore(v) {
  try { localStorage.setItem('ufa_more_tags', v ? '1' : '0') } catch { /* ignore */ }
}

export function useTagLists(userId) {
  const [saved, setSaved] = useState({ needs: [], signals: [] })
  const [usage, setUsage] = useState({})
  const [ready, setReady] = useState(false)

  async function load() {
    if (!userId) return
    const { data } = await supabase.from('users').select('tag_settings').eq('id', userId).single()
    const ts = (data && data.tag_settings) || {}
    setSaved({ needs: ts.needs || [], signals: ts.signals || [] })
    const { data: cts } = await supabase.from('contacts').select('need_tags,signal_tags').eq('user_id', userId).limit(1000)
    const u = {}
    ;(cts || []).forEach(c => {
      ;(c.need_tags || []).forEach(t => { u[t] = (u[t] || 0) + 1 })
      ;(c.signal_tags || []).forEach(t => { u[t] = (u[t] || 0) + 1 })
    })
    setUsage(u)
    setReady(true)
  }
  useEffect(() => { load() }, [userId])

  async function persist(next) {
    setSaved(next)
    await supabase.from('users').update({ tag_settings: next }).eq('id', userId)
  }

  const needs = resolveTags(DEFAULT_NEEDS, saved.needs, 'n')
  const signals = resolveTags(DEFAULT_SIGNALS, saved.signals, 's')
  const byUsage = (a, b) => (usage[b.label] || 0) - (usage[a.label] || 0)
  const sortUsed = (arr) => arr.map((x, i) => ({ x, i })).sort((a, b) => byUsage(a.x, b.x) || a.i - b.i).map(o => o.x)

  async function update(kind, id, patch) {
    const prefix = kind === 'needs' ? 'n' : 's'
    const cur = saved[kind] || []
    const exists = cur.find(s => s.id === id)
    const nextList = exists
      ? cur.map(s => s.id === id ? { ...s, ...patch } : s)
      : cur.concat([{ id, ...patch }])
    await persist({ ...saved, [kind]: nextList })
    return prefix
  }
  async function add(kind, label) {
    const text = label.trim()
    if (!text) return null
    const all = kind === 'needs' ? needs : signals
    const dup = all.find(t => t.label === text)
    if (dup) {
      if (dup.hidden) await update(kind, dup.id, { hidden: false })
      return text
    }
    const id = (kind === 'needs' ? 'nc' : 'sc') + Date.now()
    await persist({ ...saved, [kind]: (saved[kind] || []).concat([{ id, label: text, custom: true }]) })
    return text
  }
  async function remove(kind, id) {
    await persist({ ...saved, [kind]: (saved[kind] || []).filter(s => s.id !== id) })
  }

  return {
    ready, needs, signals, update, add, remove,
    visibleNeeds: sortUsed(needs.filter(t => !t.hidden)),
    visibleSignals: sortUsed(signals.filter(t => !t.hidden)),
  }
}

// ---- 小元件 ----
function Chip({ on, onClick, children, dashed, tone }) {
  const green = tone === 'green'
  return (
    <button type="button" onClick={onClick}
      style={{ border: `1px ${dashed ? 'dashed' : 'solid'} ${on ? (green ? ACCENT_GREEN_TEXT : PRIMARY) : 'var(--border2)'}`,
        background: on ? (green ? ACCENT_GREEN_SOFT : PRIMARY_SOFT) : 'transparent',
        color: on ? (green ? ACCENT_GREEN_TEXT : PRIMARY) : (dashed ? TEXT_MUTED : TEXT_MAIN),
        borderRadius: RADIUS.pill, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        margin: '0 6px 6px 0' }}>
      {children}
    </button>
  )
}

function TagPicker({ title, items, picked, setPicked, onAdd, tone }) {
  const [showAll, setShowAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const shown = showAll ? items : items.slice(0, SHOW_FIRST)
  function toggle(label) {
    setPicked(picked.includes(label) ? picked.filter(x => x !== label) : picked.concat([label]))
  }
  async function submitAdd() {
    const t = await onAdd(text)
    if (t && !picked.includes(t)) setPicked(picked.concat([t]))
    setText(''); setAdding(false)
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {shown.map(t => <Chip key={t.id} tone={tone} on={picked.includes(t.label)} onClick={() => toggle(t.label)}>{t.label}</Chip>)}
        {items.length > SHOW_FIRST && !showAll && <Chip dashed onClick={() => setShowAll(true)}>更多</Chip>}
        {!adding && <Chip dashed onClick={() => setAdding(true)}>+ 自己加</Chip>}
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="打一個詞，例如：陪孩子學習"
            style={{ flex: 1, padding: '8px 10px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none' }} />
          <button type="button" onClick={submitAdd}
            style={{ border: 'none', background: PRIMARY, color: '#fff', borderRadius: RADIUS.sm, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>加入</button>
        </div>
      )}
    </div>
  )
}

// ---- 見完了面板 ----
export function AfterMeetSheet({ contact, userId, onClose, onSaved }) {
  const tags = useTagLists(userId)
  const [level, setLevel] = useState(null)
  const [about, setAbout] = useState([])
  const [quote, setQuote] = useState('')
  const [openMore, setOpenMore] = useState(false)
  const [needs, setNeeds] = useState(contact.need_tags || [])
  const [signals, setSignals] = useState([])
  const [plan, setPlan] = useState(contact.next_plan || '')
  const [planDate, setPlanDate] = useState(contact.next_plan_date || '')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const showMore = getShowMore()

  const lv = INTEREST_LEVELS.find(x => x.key === level)
  const suggested = lv ? lv.plans : []
  const planChips = suggested.concat(ALL_PLANS.filter(p => !suggested.includes(p)))

  async function handleSave() {
    if (!lv) { setErr('先選一個：她有興趣嗎'); return }
    if (saving) return
    setSaving(true)
    const dt = todayStr()
    const note = quote.trim()
    const planText = plan.trim()
    await supabase.from('contact_logs').insert({
      contact_id: contact.id, user_id: userId, date: dt, note: note || `見面：${lv.label}`,
    })
    const upd = {
      last_interacted_at: new Date().toISOString(),
      last_contact_date: dt,
      interest_level: lv.label,
      interest_about: about,
      need_tags: needs,
      signal_tags: signals,
      next_plan: planText || null,
      next_plan_date: planDate || null,
    }
    if (note) upd.last_quote = note
    if (planDate) upd.next_contact_date = planDate
    const { error } = await supabase.from('contacts').update(upd).eq('id', contact.id)
    if (error) { setSaving(false); setErr('沒存成功，再按一次試試'); return }
    // 成功＝真的約到下一次（有內容、有日期），才算今天的 3-1-2 有推進
    if (planText && planDate) await markDaily312(supabase, userId, dt)
    trackUsage('after_meet_saved')
    if (planText && planDate) trackUsage('next_booked')
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const sec = { background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: 12, marginTop: 10 }
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--page)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>和{contact.name}見完了</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
        </div>

        <div style={sec}>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>她有興趣嗎（必選）</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 }}>
            {INTEREST_LEVELS.map(x => (
              <button key={x.key} type="button" onClick={() => { setLevel(x.key === level ? null : x.key); setErr('') }}
                style={{ border: `1px solid ${level === x.key ? PRIMARY : 'var(--border2)'}`, background: level === x.key ? PRIMARY_SOFT : 'transparent',
                  borderRadius: RADIUS.md, padding: '10px 2px 9px', cursor: 'pointer', fontSize: 11, color: TEXT_MAIN, whiteSpace: 'nowrap', minWidth: 0, letterSpacing: 0 }}>
                <span style={{ display: 'block', width: 9, height: 9, borderRadius: '50%', background: x.dot, margin: '0 auto 5px' }} />
                {x.label}
              </button>
            ))}
          </div>
          {lv && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN }}>{lv.label}</div>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{lv.desc}</div>
              <div style={{ background: ACCENT_GREEN_SOFT, color: ACCENT_GREEN_TEXT, borderRadius: RADIUS.md, padding: '8px 12px', marginTop: 8, fontSize: 13 }}>
                建議下一步　{lv.tip}
              </div>
            </div>
          )}
          {err && <div style={{ color: DANGER, fontSize: 13, marginTop: 8 }}>{err}</div>}
        </div>

        <div style={sec}>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>對哪方面（選填）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {ABOUT_OPTIONS.map(a => (
              <Chip key={a} on={about.includes(a)} onClick={() => setAbout(about.includes(a) ? about.filter(x => x !== a) : about.concat([a]))}>{a}</Chip>
            ))}
          </div>
        </div>

        <div style={sec}>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>她說了什麼（選填，一句話就好）</div>
          <input value={quote} onChange={e => setQuote(e.target.value)} placeholder="例如：最近都睡不好"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 14, outline: 'none' }} />
        </div>

        {showMore && (
          <div style={sec}>
            <button type="button" onClick={() => setOpenMore(v => !v)}
              style={{ background: 'none', border: 'none', padding: 0, color: TEXT_SECONDARY, fontSize: 13, cursor: 'pointer' }}>
              {openMore ? '▾' : '▸'} 多記一點（選填）
            </button>
            {openMore && (
              <div style={{ marginTop: 10 }}>
                <TagPicker title="她在意什麼（可複選）" items={tags.visibleNeeds} picked={needs} setPicked={setNeeds} onAdd={(t) => tags.add('needs', t)} />
                <TagPicker title="她主動做了什麼（可複選）" tone="green" items={tags.visibleSignals} picked={signals} setPicked={setSignals} onAdd={(t) => tags.add('signals', t)} />
              </div>
            )}
          </div>
        )}

        <div style={sec}>
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 }}>
            約下一次{lv && lv.key === 'none' ? '（這次可以先不約）' : ''}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, lineHeight: 1.5 }}>
            約的時候給對方兩個時間選，並說明大概一小時。
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {planChips.map(p => (
              <Chip key={p} tone={suggested.includes(p) ? 'green' : undefined} on={plan === p} onClick={() => setPlan(plan === p ? '' : p)}>
                {p}{suggested.includes(p) && plan !== p ? ' · 建議' : ''}
              </Chip>
            ))}
          </div>
          <input value={plan} onChange={e => setPlan(e.target.value)} placeholder="或自己寫"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', marginTop: 4 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>哪天</span>
            <input type="date" value={planDate} min={todayStr()} onChange={e => setPlanDate(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none' }} />
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>還沒定可以空著</span>
          </div>
        </div>

        <button onClick={handleSave}
          style={{ width: '100%', marginTop: 14, padding: 12, border: 'none', borderRadius: RADIUS.md, background: PRIMARY, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? '儲存中…' : '存起來'}
        </button>
      </div>
    </div>
  )
}

// ---- 聯絡人頁的「下一次」卡 ----
export function NextPlanCard({ contact, onOpen }) {
  const hasPlan = !!contact.next_plan
  const needs = contact.need_tags || []
  const signals = contact.signal_tags || []
  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600 }}>下一次</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_MAIN, marginTop: 2 }}>
            {hasPlan ? `${contact.next_plan_date ? fmtPlanDate(contact.next_plan_date) + '　' : ''}${contact.next_plan}` : '還沒約下一次'}
          </div>
        </div>
        <button onClick={onOpen}
          style={{ border: 'none', background: PRIMARY, color: '#fff', borderRadius: RADIUS.sm, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          見完了，記一下
        </button>
      </div>
      {needs.length > 0 && <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 6 }}>她在意：{needs.join('、')}</div>}
      {signals.length > 0 && <div style={{ fontSize: 12, color: ACCENT_GREEN_TEXT, marginTop: 2 }}>上次：{signals.join('、')}</div>}
      {contact.last_quote && <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>上次她說：「{contact.last_quote}」</div>}
    </div>
  )
}

// ---- 見面前提示：只有今天或明天有約才出現 ----
export function upcomingPlans(contacts) {
  const t = todayStr()
  const tm = addDays(t, 1)
  return (contacts || [])
    .filter(c => !c.is_muted && c.next_plan_date && (c.next_plan_date === t || c.next_plan_date === tm))
    .sort((a, b) => (a.next_plan_date < b.next_plan_date ? -1 : 1))
}

// ---- 設定頁：標籤清單管理 ----
function TagRows({ kind, items, tags }) {
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState('')
  const link = { background: 'none', border: 'none', color: TEXT_SECONDARY, fontSize: 12, cursor: 'pointer', padding: '2px 6px' }
  return (
    <div>
      {items.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderTop: `1px solid ${BORDER}`, opacity: t.hidden ? 0.5 : 1 }}>
          {editId === t.id ? (
            <>
              <input value={draft} onChange={e => setDraft(e.target.value)}
                style={{ flex: 1, padding: '6px 8px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none' }} />
              <button style={{ ...link, color: PRIMARY }} onClick={async () => { if (draft.trim()) await tags.update(kind, t.id, t.custom ? { label: draft.trim(), custom: true } : { label: draft.trim() }); setEditId(null) }}>存</button>
              <button style={link} onClick={() => setEditId(null)}>取消</button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, fontSize: 14, color: TEXT_MAIN }}>
                {t.label}{t.custom && <span style={{ fontSize: 11, color: PRIMARY, marginLeft: 6 }}>自訂</span>}{t.hidden && <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 6 }}>已隱藏</span>}
              </span>
              <button style={link} onClick={() => { setEditId(t.id); setDraft(t.label) }}>改名</button>
              {t.custom
                ? <button style={{ ...link, color: DANGER }} onClick={() => tags.remove(kind, t.id)}>刪除</button>
                : <button style={link} onClick={() => tags.update(kind, t.id, { hidden: !t.hidden })}>{t.hidden ? '顯示' : '隱藏'}</button>}
            </>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
        <input value={adding} onChange={e => setAdding(e.target.value)} placeholder="+ 新增標籤"
          style={{ flex: 1, padding: '7px 10px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none' }} />
        <button onClick={async () => { await tags.add(kind, adding); setAdding('') }}
          style={{ border: 'none', background: PRIMARY, color: '#fff', borderRadius: RADIUS.sm, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>加入</button>
      </div>
    </div>
  )
}

export function TagManager({ userId, cardStyle }) {
  const tags = useTagLists(userId)
  const [more, setMore] = useState(getShowMore())
  const head = { fontSize: 13, fontWeight:600, color: TEXT_SECONDARY, margin: '0 0 6px' }
  return (
    <div style={cardStyle}>
      <p style={{ ...head, margin: '0 0 4px' }}>見完了的標籤</p>
      <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 12px', lineHeight: 1.5 }}>預設的標籤只能隱藏，自己加的可以刪除。用得多的會自動排前面。</p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: TEXT_MAIN, marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={more} onChange={e => { setMore(e.target.checked); setShowMore(e.target.checked) }} style={{ width: 16, height: 16 }} />
        見完了時顯示「多記一點」
      </label>
      {tags.ready && (
        <>
          <p style={head}>她在意什麼</p>
          <TagRows kind="needs" items={tags.needs} tags={tags} />
          <p style={{ ...head, marginTop: 16 }}>她主動做了什麼</p>
          <TagRows kind="signals" items={tags.signals} tags={tags} />
        </>
      )}
    </div>
  )
}
