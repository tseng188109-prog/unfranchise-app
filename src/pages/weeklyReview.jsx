// weeklyReview.jsx — 本週回顧：首頁一張卡，點開看目前累計（週六到週五算一週）
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { IconChartBar, IconChevronRight, IconCopy, IconCheck } from '@tabler/icons-react'
import { CloseBtn } from './ui'
import { fmtPlanDate } from './meetingFlow'
import { loadDailyMode } from './dailyMode'
import {
  TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS, PRIMARY, PRIMARY_SOFT,
  ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT, SUBCARD_BG,
} from './designTokens'

function todayStr() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
// 週六 = 一週的第一天
function weekStartOf(dateStr) {
  const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay()
  return addDays(dateStr, -((dow + 1) % 7))
}
function md(dateStr) { return `${Number(dateStr.slice(5, 7))}/${Number(dateStr.slice(8, 10))}` }

async function loadWeek(userId) {
  const t = todayStr()
  const ws = weekStartOf(t)
  const we = addDays(ws, 6)

  const [mode, logsRes, plansRes, newRes, dayLogsRes, freshRowsRes] = await Promise.all([
    loadDailyMode(userId),
    supabase.from('contact_logs')
      .select('contact_id,date,contacts(id,name,interest_level,next_plan,next_plan_date,is_muted)')
      .eq('user_id', userId).in('kind', ['meet', 'meet_plan']).gte('date', ws).lte('date', we),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).or('is_muted.is.null,is_muted.eq.false').gte('next_plan_date', t),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('source', null).gte('created_at', ws + 'T00:00:00+08:00').lte('created_at', we + 'T23:59:59+08:00'),
    supabase.from('contact_logs').select('contact_id,date,kind')
      .eq('user_id', userId).gte('date', ws).lte('date', we),
    supabase.from('contacts').select('created_at')
      .eq('user_id', userId).is('source', null).gte('created_at', ws + 'T00:00:00+08:00').lte('created_at', we + 'T23:59:59+08:00'),
  ])

  const seen = new Set()
  const met = []
  ;(logsRes.data || []).forEach(l => {
    if (!l.contacts || seen.has(l.contacts.id)) return
    seen.add(l.contacts.id)
    met.push(l.contacts)
  })
  // 「做滿」：當天互動滿 3 位、定下 1 個碰面、新增 2 位，三項都到才算一天（2025 領導者訓練大會簡報）
  const perDay = {}
  ;(dayLogsRes.data || []).forEach(l => {
    const d = (perDay[l.date] = perDay[l.date] || { people: new Set(), plan: 0, fresh: 0 })
    d.people.add(l.contact_id)
    if (l.kind === 'meet_plan') d.plan++
  })
  ;(freshRowsRes.data || []).forEach(r => {
    const day = new Date(r.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
    const d = (perDay[day] = perDay[day] || { people: new Set(), plan: 0, fresh: 0 })
    d.fresh++
  })
  const days312 = Object.values(perDay).filter(d => d.people.size >= mode.talk && d.plan >= mode.meet && d.fresh >= mode.fresh).length
  // BASIC-5 每週目標：找 5–15 人談話、邀約 5 人、增加 10 名可能人選
  const talkedWeek = new Set((dayLogsRes.data || []).map(l => l.contact_id)).size
  const invitedWeek = new Set((dayLogsRes.data || []).filter(l => l.kind === 'meet_plan').map(l => l.contact_id)).size
  return {
    ws, we, met,
    planned: plansRes.count || 0,
    fresh: newRes.count || 0,
    days312, mode, talkedWeek, invitedWeek,
    unplanned: met.filter(c => !c.next_plan && !c.is_muted),
  }
}

export default function WeeklyReviewCard({ userId }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    loadWeek(userId).then(d => { if (alive) setData(d) }).catch(() => {})
    return () => { alive = false }
  }, [userId, open])

  const n = data ? data.met.length : 0
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
          background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.xl, padding: '14px 16px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: PRIMARY_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconChartBar size={20} stroke={1.9} color={PRIMARY} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_MAIN }}>本週回顧</div>
          <div style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 }}>
            {data ? (n === 0 ? '這週還沒記錄見面，見完人記一下' : `目前見了 ${n} 位，已約好下一次 ${data.planned} 位`) : '讀取中…'}
          </div>
        </div>
        <IconChevronRight size={18} stroke={1.9} color={TEXT_MUTED} />
      </button>
      {open && data && <WeeklyReviewSheet data={data} onClose={() => setOpen(false)} />}
    </>
  )
}

function Stat({ label, value, unit }) {
  return (
    <div style={{ background: SUBCARD_BG, borderRadius: RADIUS.md, padding: 12 }}>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: TEXT_MAIN, marginTop: 2 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 400, color: TEXT_SECONDARY, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  )
}

function WeeklyReviewSheet({ data, onClose }) {
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const { ws, we, met, planned, fresh, days312, unplanned, mode, talkedWeek, invitedWeek } = data
  const shown = showAll ? met : met.slice(0, 5)

  async function copyText() {
    const txt = `本週（${md(ws)}–${md(we)}）\n見面 ${met.length} 位\n已約好下一次 ${planned} 位\n新認識 ${fresh} 位\n${mode.label} 做滿 ${days312} 天`
    try {
      await navigator.clipboard.writeText(txt)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = txt; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: '22px 22px 0 0', padding: '20px 20px 28px', width: '100%', maxWidth: 430, maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN, margin: 0 }}>本週回顧</h3>
          <CloseBtn onClick={onClose} />
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 14px' }}>{md(ws)} 週六 – {md(we)} 週五　目前累計</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <Stat label="見面" value={met.length} unit="位" />
          <Stat label="已約好下一次" value={planned} unit="位" />
          <Stat label="新認識" value={fresh} unit="位" />
          <Stat label={`${mode.label} 做滿`} value={days312} unit="天" />
        </div>

        <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: '18px 0 6px' }}>本週目標</p>
        <div style={{ background: SUBCARD_BG, borderRadius: RADIUS.md, padding: '4px 12px' }}>
          {[
            ['談話', talkedWeek, '5–15 人'],
            ['邀約', invitedWeek, '5 人'],
            ['增加名單', fresh, '10 人'],
          ].map(([k, v, g]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: 14 }}>
              <span style={{ color: TEXT_SECONDARY }}>{k}</span>
              <span style={{ color: TEXT_MAIN }}>{v} <span style={{ color: TEXT_MUTED, fontSize: 12 }}>/ {g}</span></span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: '18px 0 6px' }}>這週見的人</p>
        {met.length === 0 ? (
          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.7 }}>
            還沒有。見完人後，到聯絡人頁按「見完了」記一下，就會出現在這裡。
          </p>
        ) : (
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            {shown.map(c => (
              <div key={c.id} style={{ padding: '10px 0', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 14, color: TEXT_MAIN }}>{c.name}</span>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: 'right' }}>
                  {c.interest_level || ''}　{c.next_plan ? `${c.next_plan_date ? fmtPlanDate(c.next_plan_date) + ' ' : ''}${c.next_plan}` : '還沒約下一次'}
                </span>
              </div>
            ))}
            {met.length > 5 && (
              <button onClick={() => setShowAll(!showAll)}
                style={{ width: '100%', background: 'none', border: 'none', padding: '12px 0', fontSize: 13, color: PRIMARY, cursor: 'pointer' }}>
                {showAll ? '收起' : `還有 ${met.length - 5} 位`}
              </button>
            )}
          </div>
        )}

        {unplanned.length > 0 && (
          <div style={{ background: ACCENT_YELLOW_SOFT, borderRadius: RADIUS.md, padding: 12, marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT_YELLOW_TEXT }}>見完還沒約下一次</div>
            <div style={{ fontSize: 13, color: ACCENT_YELLOW_TEXT, marginTop: 2, lineHeight: 1.6 }}>
              {unplanned.map(c => c.name).join('、')}。給對方兩個時間選，約一次吧。
            </div>
          </div>
        )}

        <button onClick={copyText}
          style={{ width: '100%', marginTop: 16, padding: 15, borderRadius: 16, border: 'none', background: copied ? 'var(--green-text)' : PRIMARY,
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {copied ? <IconCheck size={18} stroke={2} color="#fff" /> : <IconCopy size={18} stroke={1.9} color="#fff" />}
          {copied ? '已複製，可以貼給夥伴了' : '複製成文字，傳給夥伴看'}
        </button>
        <p style={{ fontSize: 12, color: TEXT_MUTED, textAlign: 'center', margin: '8px 0 0' }}>只有數字，不會帶出任何人的名字。</p>
      </div>
    </div>
  )
}
