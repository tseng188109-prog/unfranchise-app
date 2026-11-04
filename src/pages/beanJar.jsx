// beanJar.jsx — 放豆子進罐子的兩個小幫手
//   MemoryJogSheet：「想不到人？」成功五要訣（BASIC-5）的記憶喚醒練習，熟人名單分類出題，一次三題
//   InviteNoSheet：「邀了，沒約成」開口就算數；算今天 3-1-2 的「1」和一次互動，不算每週「定下」
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { syncDaily3 } from './followUp'
import { PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_SECONDARY, TEXT_MUTED, BORDER, RADIUS, SUBCARD_BG, DANGER } from './designTokens'

// 依熟人名單分類：朋友家人鄰居、同學、團體、同事、社群、顧客、住附近、常去的店、朋友的朋友
const JOG = [
  '高中、大學同學裡，誰最近在 IG 或臉書有發文？',
  '大學時一起做報告、一起熬夜的那幾個人，現在在做什麼？',
  '上一份工作，你跟誰最聊得來？',
  '現在的同事裡，誰最近在抱怨很累、想改變？',
  '你參加過的社團或團體裡，誰是你一直覺得很好相處的？',
  '你常去的店，老闆或店員叫得出你的名字嗎？',
  '常幫你剪頭髮、做指甲或推拿的人，你們聊過工作以外的事嗎？',
  '住你家附近、常在電梯或樓下遇到的人，有誰可以多聊兩句？',
  '你家人的朋友裡，誰是你也認識、但很久沒聯絡的？',
  '兄弟姊妹、表兄弟姊妹裡，誰最近剛換工作或搬家？',
  '小孩同學的家長裡，誰是你聊得來的？',
  'LINE 聊天列表往下滑，最下面那幾個很久沒聊的人是誰？',
  'IG 你追蹤、但從來沒聊過天的人裡，有誰常發生活或健康的內容？',
  '臉書上今天或這週生日的朋友，可以傳一句生日快樂嗎？',
  '以前常一起運動、上課的人，現在還有聯絡嗎？',
  '買過你產品的顧客裡，誰最近可以關心一下用得怎麼樣？',
  '顧客介紹你認識、但你還沒加進名單的人是誰？',
  '朋友的朋友裡，誰你見過一兩次、印象還不錯？',
  '最近一場聚會或活動上，你跟誰交換了聯絡方式？',
  '你以前的老師、教練或主管，現在過得怎樣？',
  '婚禮、喜宴上同桌、聊過天的人，有誰還記得？',
  '手機通訊錄從 A 滑到 Z，有誰的名字讓你想到「好久沒聯絡了」？',
  '誰是你身邊最常說「想多賺一點」或「想要更有彈性」的人？',
  '誰最近在關心健康、保養或想變瘦？',
]
function pick3(exclude = []) {
  const pool = JOG.filter(q => !exclude.includes(q))
  const out = []
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  return out
}

function Sheet({ title, onClose, children }) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--page)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          borderRadius: '18px 18px 0 0', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
        </div>
        {children}
      </div>
    </div>
  )
}
const btn = primary => ({
  flex: 1, padding: 12, borderRadius: RADIUS.md, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : `1px solid ${BORDER}`, background: primary ? PRIMARY : 'var(--card)', color: primary ? '#fff' : TEXT_MAIN,
})

export function MemoryJogSheet({ onClose }) {
  const navigate = useNavigate()
  const [qs, setQs] = useState(() => pick3())
  return (
    <Sheet title="想一想，你認識誰" onClose={onClose}>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 10, lineHeight: 1.6 }}>
        成功五要訣（BASIC-5）的記憶喚醒練習：不只是新朋友，很久沒聯絡的老朋友也算。
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {qs.map(q => (
          <div key={q} style={{ background: SUBCARD_BG, borderRadius: RADIUS.md, padding: '11px 12px', fontSize: 14, color: TEXT_MAIN, lineHeight: 1.6 }}>{q}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={() => setQs(pick3(qs))} style={btn(false)}>換三題</button>
        <button onClick={() => { onClose(); navigate('/contacts/new') }} style={btn(true)}>想到了，新增名單</button>
      </div>
    </Sheet>
  )
}

const REASONS = ['最近比較忙', '之後再說', '還沒興趣', '沒回訊息']
// 邀了沒約成之後，隔幾天才再推薦去邀約（這段時間照樣會出現在「3 位互動」）
const COOL_DAYS = { '沒回訊息': 3, '最近比較忙': 14, '之後再說': 14, '還沒興趣': 30 }
const COOL_DEFAULT = 7
function addDay(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
export function coolUntil(log) {
  // 用字串比對，不用正規表示式（中文寫在正規表示式裡，有些環境會讀錯）
  const head = '邀了沒約成：'
  const note = log.note || ''
  const reason = note.startsWith(head) ? note.slice(head.length).split('　')[0] : ''
  return addDay(log.date, COOL_DAYS[reason] || COOL_DEFAULT)
}
// 每個人最晚冷卻到哪天：Map(contact_id → 'YYYY-MM-DD')
export async function fetchInviteCooldowns(userId) {
  try {
    const since = addDay(twToday(), -31)
    const { data } = await supabase.from('contact_logs').select('contact_id,date,note')
      .eq('user_id', userId).eq('kind', 'invite_no').gte('date', since)
    const map = new Map()
    ;(data || []).forEach(l => { const u = coolUntil(l); if (!map.has(l.contact_id) || u > map.get(l.contact_id)) map.set(l.contact_id, u) })
    return map
  } catch { return new Map() }
}
function twToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }

export function InviteNoSheet({ contact, userId, onClose, onSaved }) {
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (saving) return
    setSaving(true); setErr('')
    const t = twToday()
    const text = ['邀了沒約成' + (reason ? `：${reason}` : ''), said.trim()].filter(Boolean).join('　')
    const { error } = await supabase.from('contact_logs').insert({ contact_id: contact.id, user_id: userId, date: t, kind: 'invite_no', note: text })
    if (error) { setSaving(false); setErr('沒存成功，再按一次試試'); return }
    const upd = { last_interacted_at: new Date().toISOString() }
    if (!contact.last_contact_date || t >= contact.last_contact_date) upd.last_contact_date = t
    await supabase.from('contacts').update(upd).eq('id', contact.id)
    await syncDaily3(supabase, userId, t)
    setSaving(false)
    onSaved && onSaved()
    onClose()
  }
  const chip = on => ({
    padding: '7px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: `1.5px solid ${on ? PRIMARY : BORDER}`, background: on ? PRIMARY_SOFT : 'var(--card)', color: on ? PRIMARY : TEXT_SECONDARY,
  })
  return (
    <Sheet title={`邀了${contact.name}，沒約成`} onClose={onClose}>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 10 }}>開口就算數。記一下原因，下次比較知道怎麼約。</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {REASONS.map(r => <button key={r} type="button" onClick={() => setReason(reason === r ? '' : r)} style={chip(reason === r)}>{r}</button>)}
      </div>
      <input value={said} onChange={e => setSaid(e.target.value)} placeholder="對方怎麼說（選填）"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: RADIUS.sm, border: `1px solid ${BORDER}`,
          fontSize: 14, background: 'var(--card)', color: TEXT_MAIN, outline: 'none' }} />
      {err && <div style={{ color: DANGER, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <button onClick={save} disabled={saving} style={{ ...btn(true), width: '100%', marginTop: 14, opacity: saving ? 0.7 : 1 }}>
        {saving ? '儲存中…' : '記下來'}
      </button>
    </Sheet>
  )
}
