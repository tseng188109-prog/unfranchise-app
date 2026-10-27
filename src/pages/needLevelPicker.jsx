// 需求度選擇：新增聯絡人、編輯聯絡人共用，兩邊長得一樣。
// 例句寫的是「他說過或做過什麼」，夥伴照著對就能選，不用猜他心裡怎麼想。
// 大一～大四的意思來自 2025 領導者訓練大會的荷包蛋理論（朋友對現況想不想改變的程度）。
import { PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS } from './designTokens'

export const NEED_LEVELS = [
  { value: '大一', desc: '沒需求', hint: '聊過，他對現況很滿意' },
  { value: '大二', desc: '小抱怨', hint: '提過不滿，或有想要但還沒做到的事' },
  { value: '大三', desc: '想改變', hint: '在考慮、比較，或問過相關的事' },
  { value: '大四', desc: '有行動', hint: '已經做了改變，或主動來問' },
]

export default function NeedLevelPicker({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '2px 0 10px', lineHeight: 1.5 }}>
        他說過或做過什麼？符合哪句就選，都符合就選高的。
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {NEED_LEVELS.map(n => {
          const selected = value === n.value
          return (
            <button key={n.value} type="button" onClick={() => onChange(selected ? '' : n.value)}
              style={{ textAlign: 'left', padding: '9px 10px', borderRadius: RADIUS.md, cursor: 'pointer',
                border: `2px solid ${selected ? PRIMARY : BORDER}`,
                background: selected ? PRIMARY_SOFT : 'var(--sub)', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: selected ? PRIMARY : TEXT_MAIN }}>
                {n.value} <span style={{ fontSize: 11, fontWeight: 400, color: selected ? PRIMARY : TEXT_MUTED }}>{n.desc}</span>
              </div>
              <div style={{ fontSize: 11, color: selected ? PRIMARY : TEXT_SECONDARY, marginTop: 3, lineHeight: 1.5 }}>
                {n.hint}
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 10, lineHeight: 1.5 }}>
        還沒聊過就先空著，見面後再補。沒選的話，App 不會自動排下次聯絡日。
      </div>
    </div>
  )
}
