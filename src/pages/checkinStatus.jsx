// checkinStatus.jsx — 每日打卡：要顯示哪些項目、週列圓點的顏色
// 圓點跟上面「N/M」同一個算法：只算你看得到的項目、只算有打勾的；系統在背景記的資料不算。
//   綠：全部打勾　黃：做了一部分　灰：一個都沒勾
import { IconCheck } from '@tabler/icons-react'
import { DAILY_TASKS } from './taskDefinitions'
import { saveTagSetting } from './dailyMode'
import { TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, ACCENT_GREEN, ACCENT_YELLOW } from './designTokens'

export function hiddenTaskKeys(tagSettings) {
  return (tagSettings && tagSettings.hidden_daily_tasks) || []
}
export function visibleDailyTasks(tagSettings) {
  const hidden = hiddenTaskKeys(tagSettings)
  return DAILY_TASKS.filter(t => !hidden.includes(t.key))
}

// rows：daily_checkins 的 [{date, task_key, is_done}]；tasks：這個人看得到的項目
export function dayDotStatus(rows, date, tasks) {
  const keys = new Set(tasks.map(t => t.key))
  const done = new Set((rows || []).filter(r => r.date === date && r.is_done && keys.has(r.task_key)).map(r => r.task_key)).size
  if (tasks.length > 0 && done >= tasks.length) return 'full'
  if (done > 0) return 'partial'
  return 'none'
}

export function DotLegend() {
  const dot = c => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 4, verticalAlign: 0 }} />
  return (
    <div style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center', margin: '-2px 0 8px' }}>
      {dot(ACCENT_GREEN)}全部打勾　{dot(ACCENT_YELLOW)}做了一部分　{dot('var(--border)')}還沒做
    </div>
  )
}

// 「要顯示哪些每日行動」：每日行動頁和設定頁共用同一個視窗
export function TaskVisibilitySheet({ userId, tagSettings, modeLabel, onChange, onClose }) {
  const hidden = hiddenTaskKeys(tagSettings)
  async function toggle(key) {
    const next = hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key]
    onChange && onChange(next)
    await saveTagSetting(userId, { hidden_daily_tasks: next })
  }
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--card)', borderRadius: '22px 22px 0 0', padding: 24, width: '100%', maxWidth: 430, maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN, margin: 0 }}>要顯示哪些每日行動</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 13, cursor: 'pointer' }}>關閉</button>
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 12px' }}>不需要的可以關掉，只影響你自己，資料不會刪掉</p>
        {DAILY_TASKS.map(t => {
          const on = !hidden.includes(t.key)
          return (
            <button key={t.key} onClick={() => toggle(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 4px', background: 'none', border: 'none',
                borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? ACCENT_GREEN : 'var(--card)', border: on ? 'none' : '2px solid var(--border2)' }}>
                {on && <IconCheck size={12} stroke={2.5} color="#fff" />}
              </span>
              <span style={{ fontSize: 14, color: TEXT_MAIN, fontWeight: 600 }}>{t.key === 'daily_3_contacts' && modeLabel ? `每日 ${modeLabel}（互動／邀約／新名單）` : t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
