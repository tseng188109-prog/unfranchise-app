// beanJar.jsx — 放豆子進罐子的兩個小幫手
//   MemoryJogSheet：「想不到人？」成功五要訣（BASIC-5）的記憶喚醒練習，熟人名單分類出題，一次三題
//   邀約的冷卻期：邀了沒約成、還在等回覆的人，先不推薦去邀約
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { PRIMARY, TEXT_MAIN, TEXT_SECONDARY, TEXT_MUTED, BORDER, RADIUS, SUBCARD_BG } from './designTokens'

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

// 邀約的冷卻期：邀了沒約成之後，隔幾天才再推薦去邀約（這段時間照樣會出現在「3 位互動」）
// 「記一次邀約」視窗（invite.jsx）也用這裡的原因清單
export const REASONS = ['最近比較忙', '之後再說', '還沒興趣', '沒回訊息']
const COOL_DAYS = { '沒回訊息': 3, '最近比較忙': 14, '之後再說': 14, '還沒興趣': 30 }
const COOL_DEFAULT = 7
export const NO_HEAD = '邀了沒約成'
export const SUPERSEDED = '後來又邀了一次'
function addDay(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const pad2 = n => String(n).padStart(2, '0')
// 「等回覆」後來才確定沒約成：備註會多一段「（11/10 確認）」，冷卻從確認那天開始算
export function confirmTag(dateStr) { return `（${Number(dateStr.slice(5, 7))}/${Number(dateStr.slice(8, 10))} 確認）` }
export function confirmedDay(log) {
  const seg = String(log.note || '').split('　').find(x => x.startsWith('（') && x.endsWith(' 確認）'))
  if (!seg) return ''
  const [m, d] = seg.slice(1, -4).split('/').map(Number)
  if (!m || !d) return ''
  const y = Number(String(log.date).slice(0, 4))
  let c = `${y}-${pad2(m)}-${pad2(d)}`
  if (c < log.date) c = `${y + 1}-${pad2(m)}-${pad2(d)}`
  return c
}
export function coolUntil(log) {
  // 用字串比對，不用正規表示式（中文寫在正規表示式裡，有些環境會讀錯）
  const segs = String(log.note || '').split('　')
  // 舊的等回覆因為又邀了一次而結束：不另外冷卻，照新的那次算
  if (segs.includes(SUPERSEDED)) return log.date
  const first = segs[0]
  const head = NO_HEAD + '：'
  const reason = first.startsWith(head) ? first.slice(head.length) : ''
  return addDay(confirmedDay(log) || log.date, COOL_DAYS[reason] || COOL_DEFAULT)
}
// 每個人最晚冷卻到哪天：Map(contact_id → 'YYYY-MM-DD')
// 還在等回覆的人也先不推薦（等對方回了再說）
export async function fetchInviteCooldowns(userId) {
  try {
    const since = addDay(twToday(), -120)
    const [{ data: no }, { data: wait }] = await Promise.all([
      supabase.from('contact_logs').select('contact_id,date,note,kind').eq('user_id', userId).eq('kind', 'invite_no').gte('date', since),
      supabase.from('contact_logs').select('contact_id,date,note,kind').eq('user_id', userId).eq('kind', 'invite_wait'),
    ])
    const map = new Map()
    ;[...(no || []), ...(wait || [])].forEach(l => {
      const u = l.kind === 'invite_wait' ? '9999-12-31' : coolUntil(l)
      if (!map.has(l.contact_id) || u > map.get(l.contact_id)) map.set(l.contact_id, u)
    })
    return map
  } catch { return new Map() }
}
function twToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
