// tools.jsx — 美安官方的事業／零售工具。記互動、見完面時可以選填「這次用了什麼工具」，
// 存在 contact_logs.tool（一筆互動一個工具）。團隊頁只統計次數，不排名。
import { useState } from 'react'
import { PRIMARY, PRIMARY_SOFT, TEXT_SECONDARY, TEXT_MUTED, BORDER, SUBCARD_BG, ORANGE_TEXT, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT } from './designTokens'

export const PARTNER_TOOLS = ['一對一會談', '二對一會談', '三方通話', '線上影片', '家庭事業說明會']
export const PARTNER_TOOLS_MORE = ['社群媒體工具', '邀請朋友', '美安台灣產品目錄', '線上事業說明會', '超連鎖事業說明會']
export const CUSTOMER_TOOLS = ['分享我的使用經驗', '美安台灣產品目錄', 'ShopBuddy', '網站導覽']
export const CUSTOMER_TOOLS_MORE = ['家庭產品說明會', '線上產品說明會', '健康講座']
export const ALL_TOOLS = [...PARTNER_TOOLS, ...PARTNER_TOOLS_MORE, ...CUSTOMER_TOOLS, ...CUSTOMER_TOOLS_MORE]

// 依她的興趣程度，建議下一步用哪個工具（夥伴）
const BY_LEVEL = {
  '很有興趣': { tools: ['一對一會談', '三方通話'], text: '她很有興趣：約一對一會談，想更了解就拉三方通話' },
  '有點興趣': { tools: ['線上影片', '一對一會談'], text: '她有點興趣：先給一支線上影片，再約一對一會談' },
  '觀望中': { tools: ['社群媒體工具'], text: '她還在觀望：用社群分享對她有用的資訊，保持聯絡' },
  '看不出來': { tools: ['一對一會談'], text: '還看不出來：多問多聽，約一次一對一會談了解她' },
}
export function suggestTools(contact, isCustomer) {
  if (isCustomer) return { tools: ['分享我的使用經驗'], text: '用得不錯的話，問她要不要介紹朋友來試用' }
  return BY_LEVEL[contact && contact.interest_level] || { tools: [], text: '' }
}

export function ToolRow({ value, onChange, customer, contact }) {
  const [more, setMore] = useState(false)
  const main = customer ? CUSTOMER_TOOLS : PARTNER_TOOLS
  const rest = customer ? CUSTOMER_TOOLS_MORE : PARTNER_TOOLS_MORE
  const sug = suggestTools(contact, customer)
  const list = more || rest.includes(value) ? main.concat(rest) : main
  const chip = (on, dashed) => ({
    padding: '7px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: `1.5px ${dashed ? 'dashed' : 'solid'} ${on ? PRIMARY : BORDER}`,
    background: on ? PRIMARY_SOFT : '#fff', color: on ? PRIMARY : (dashed ? TEXT_MUTED : TEXT_SECONDARY),
  })
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY, marginBottom: 6 }}>
        用了什麼工具<span style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, marginLeft: 4 }}>選填，不填也能存</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {list.map(t => (
          <button key={t} type="button" onClick={() => onChange(value === t ? '' : t)} style={chip(value === t)}>{t}</button>
        ))}
        {!more && !rest.includes(value) && (
          <button type="button" onClick={() => setMore(true)} style={chip(false, true)}>更多 ▾</button>
        )}
      </div>
      {sug.text && (
        <div style={{ marginTop: 8, background: ACCENT_YELLOW_SOFT, color: ACCENT_YELLOW_TEXT, borderRadius: 12,
          padding: '8px 11px', fontSize: 12, lineHeight: 1.5 }}>
          建議：{sug.text}
        </div>
      )}
    </div>
  )
}

// 互動紀錄旁邊的小標籤
export function ToolTag({ tool }) {
  if (!tool) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99, marginLeft: 6,
      background: SUBCARD_BG, color: ORANGE_TEXT || TEXT_SECONDARY, border: `1px solid ${BORDER}` }}>{tool}</span>
  )
}
