import { useState, useEffect } from 'react'
import { CloseBtn } from './ui'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconBell, IconCake, IconCalendarEvent, IconFlask, IconUserPlus,
  IconChartBar, IconChevronRight, IconX,
} from '@tabler/icons-react'
import {
  TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS,
  ACCENT_PINK_SOFT, ACCENT_PINK_TEXT, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT,
  ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, PRIMARY_SOFT, PRIMARY, ORANGE_SOFT, ORANGE_TEXT,
  DANGER_SOFT,
} from './designTokens'

// 鈴鐺只放「首頁沒有處理」的事：生日、約好的碰面、試用品跟進、新夥伴、業績進度。
// 久未互動 → 首頁「今天的 3-1-2」；回購、久沒消費 → 首頁「老顧客，問問用得好不好」。
const BV_GOAL = 1500
const IBV_GOAL = 300

function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

function daysDiff(dateStr) {
  if (!dateStr) return null
  const a = new Date(today() + 'T00:00:00')
  const b = new Date(dateStr + 'T00:00:00')
  return Math.floor((a - b) / 86400000)
}
function daysUntil(dateStr) {
  if (!dateStr) return null
  const a = new Date(today() + 'T00:00:00')
  const b = new Date(dateStr + 'T00:00:00')
  return Math.floor((b - a) / 86400000)
}
// 生日存成 MM-DD；算「還有幾天」，跨年也算得到（12 月看到 1 月初的生日）
function birthdayDays(mmdd) {
  if (!mmdd) return null
  const md = String(mmdd).slice(-5)
  const y = new Date().getFullYear()
  const a = daysUntil(`${y}-${md}`)
  if (a !== null && !Number.isNaN(a) && a >= 0) return a
  const b = daysUntil(`${y + 1}-${md}`)
  return b !== null && !Number.isNaN(b) ? b : null
}
function whenText(n) { return n === 0 ? '今天' : n === 1 ? '明天' : `${n} 天後` }

const TONES = {
  pink:   { bg: ACCENT_PINK_SOFT,   color: ACCENT_PINK_TEXT },
  orange: { bg: ORANGE_SOFT,        color: ORANGE_TEXT },
  yellow: { bg: ACCENT_YELLOW_SOFT, color: ACCENT_YELLOW_TEXT },
  green:  { bg: ACCENT_GREEN_SOFT,  color: ACCENT_GREEN_TEXT },
  blue:   { bg: PRIMARY_SOFT,       color: PRIMARY },
  red:    { bg: DANGER_SOFT,        color: 'var(--danger-text)' },
}

export default function NotificationBell({ userId }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [soon, setSoon] = useState([])
  const [follow, setFollow] = useState([])

  useEffect(() => { if (userId) fetchAll(false) }, [userId])
  useEffect(() => { if (open && userId) fetchAll(true) }, [open])

  async function fetchAll(showLoading) {
    if (showLoading) setLoading(true)
    const [a, b] = await Promise.all([fetchSoon(), fetchFollow()])
    setSoon(a)
    setFollow(b)
    if (showLoading) setLoading(false)
  }

  // 這幾天：生日、約好的碰面
  async function fetchSoon() {
    const items = []
    const [{ data: contacts }, { data: customers }] = await Promise.all([
      supabase.from('contacts').select('id,name,birthday,next_contact_date')
        .eq('user_id', userId).eq('is_archived', false),
      supabase.from('customers').select('id,name,birthday').eq('user_id', userId),
    ])
    ;(contacts || []).forEach(c => {
      const nb = birthdayDays(c.birthday)
      if (nb !== null && nb >= 0 && nb <= 3) {
        items.push({ key: 'cb' + c.id, days: nb, Icon: IconCake, tone: 'pink',
          title: `${c.name} 生日`, sub: `${whenText(nb)}・互動名單`, path: `/contacts/${c.id}` })
      }
      const nc = daysUntil(c.next_contact_date)
      if (nc !== null && nc >= 0 && nc <= 2) {
        items.push({ key: 'cn' + c.id, days: nc, Icon: IconCalendarEvent, tone: 'orange',
          title: `${c.name} 約好的碰面`, sub: `${whenText(nc)}・互動名單`, path: `/contacts/${c.id}` })
      }
    })
    ;(customers || []).forEach(c => {
      const nb = birthdayDays(c.birthday)
      if (nb !== null && nb >= 0 && nb <= 3) {
        items.push({ key: 'kb' + c.id, days: nb, Icon: IconCake, tone: 'pink',
          title: `${c.name} 生日`, sub: `${whenText(nb)}・老顧客`, path: `/customers/${c.id}` })
      }
    })
    return items.sort((a, b) => a.days - b.days)
  }

  // 要跟進：試用品、新夥伴、業績進度
  async function fetchFollow() {
    const items = []

    const { data: samples } = await supabase.from('sample_tracking')
      .select('id,product_name,share_date,contacts(name),customers(name)')
      .eq('user_id', userId).is('result', null)
    ;(samples || []).forEach(s => {
      const d = daysDiff(s.share_date)
      if (d !== null && d >= 7) {
        const who = s.contacts?.name || s.customers?.name || '試用品'
        items.push({ key: 's' + s.id, order: -d, Icon: IconFlask, tone: 'yellow',
          title: `${who} 試用品`, sub: `給了 ${d} 天，還沒問結果`, path: '/samples' })
      }
    })

    const sevenDaysAgo = toDateStr(new Date(Date.now() - 7 * 86400000))
    const { data: partners } = await supabase.from('users')
      .select('id,name,created_at')
      .eq('referrer_id', userId)
      .gte('created_at', sevenDaysAgo + 'T00:00:00+00:00')
    ;(partners || []).forEach(p => {
      items.push({ key: 'p' + p.id, order: 0, Icon: IconUserPlus, tone: 'green',
        title: `${p.name || '新夥伴'} 加入了你的團隊`, sub: '這週加入・去打聲招呼', path: '/partners' })
    })

    const now = new Date()
    const qm = Math.floor(now.getMonth() / 3) * 3
    const quarterStart = `${now.getFullYear()}-${String(qm + 1).padStart(2, '0')}-01`
    const quarterEnd = new Date(now.getFullYear(), qm + 3, 0)
    const totalDays = Math.floor((quarterEnd - new Date(quarterStart + 'T00:00:00')) / 86400000) + 1
    const passedDays = Math.floor((now - new Date(quarterStart + 'T00:00:00')) / 86400000) + 1
    const progress = passedDays / totalDays
    const { data: txs } = await supabase.from('transactions')
      .select('type,points').eq('user_id', userId).gte('date', quarterStart)
    if (txs) {
      let bv = 0, ibv = 0
      txs.forEach(t => {
        if (t.type === 'BV') bv += t.points
        if (t.type === 'IBV') ibv += t.points
      })
      const bvBehind = bv < BV_GOAL * progress * 0.8
      const ibvBehind = ibv < IBV_GOAL * progress * 0.8
      if (bvBehind || ibvBehind) {
        const parts = []
        if (bvBehind) parts.push(`BV ${Math.round(bv / BV_GOAL * 100)}%`)
        if (ibvBehind) parts.push(`IBV ${Math.round(ibv / IBV_GOAL * 100)}%`)
        items.push({ key: 'bv', order: 1, Icon: IconChartBar, tone: 'blue',
          title: '本季業績進度落後', sub: `${parts.join('、')}，時間已走 ${Math.round(progress * 100)}%`, path: '/transactions' })
      }
    }
    return items.sort((a, b) => a.order - b.order)
  }

  const total = soon.length + follow.length

  function go(path) { setOpen(false); navigate(path) }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="提醒"
        style={{ position: 'relative', background: 'var(--sub2)', border: 'none', borderRadius: '50%',
          width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <IconBell size={18} stroke={1.9} color={TEXT_MAIN} />
        {total > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px',
            boxSizing: 'border-box', background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 600,
            borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--page)', lineHeight: 1 }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--page)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 430,
              maxHeight: '68vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px 10px',
              background: 'var(--card)', borderRadius: '20px 20px 0 0', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN, flex: 1 }}>提醒</span>
              {total > 0 && (
                <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: RADIUS.pill,
                  background: 'var(--danger-soft)', color: 'var(--danger-text)' }}>{total} 則</span>
              )}
              <CloseBtn onClick={() => setOpen(false)} size={36} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
              {loading && total === 0 ? (
                <div style={{ textAlign: 'center', padding: 36, color: TEXT_MUTED, fontSize: 13 }}>載入中…</div>
              ) : total === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_MAIN }}>目前沒有要處理的事</div>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>有生日、碰面或試用品要跟進時，會出現在這裡。</div>
                </div>
              ) : (
                <>
                  <Group title="這幾天" items={soon} go={go} />
                  <Group title="要跟進" items={follow} go={go} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Group({ title, items, go }) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, margin: '14px 4px 6px' }}>{title}</div>
      <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.card, overflow: 'hidden' }}>
        {items.map((it, i) => {
          const t = TONES[it.tone]
          const Icon = it.Icon
          return (
            <div key={it.key} onClick={() => go(it.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}>
              <div style={{ width: 34, height: 34, borderRadius: RADIUS.md, background: t.bg, color: t.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} stroke={1.9} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: TEXT_MAIN, overflowWrap: 'anywhere' }}>{it.title}</div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 1 }}>{it.sub}</div>
              </div>
              <IconChevronRight size={16} stroke={1.9} color={TEXT_MUTED} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
