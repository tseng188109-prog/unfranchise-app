import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

const BV_GOAL = 1500
const IBV_GOAL = 300

// 與 ContactDetail 共用同一套邏輯
const ACTION_MAP = {
  '茶葉蛋': { '大一': '軟性活動', '大二': '商機講座', '大三': '直接法', '大四': '直接法' },
  '荷包蛋': { '大一': '輕鬆互動', '大二': '軟性活動', '大三': '商機講座', '大四': '直接法' },
  '生雞蛋': { '大一': '輕鬆互動', '大二': '輕鬆互動', '大三': '軟性活動', '大四': '商機講座' },
}
const DAYS_MAP = { '輕鬆互動': 30, '軟性活動': 14, '商機講座': 5, '直接法': 5 }

function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
function today() { return toDateStr(new Date()) }

function daysDiff(dateStr) {
  if (!dateStr) return 9999
  const a = new Date(today() + 'T00:00:00')
  const b = new Date(dateStr + 'T00:00:00')
  return Math.floor((a - b) / 86400000)
}

function daysUntil(dateStr) {
  if (!dateStr) return 9999
  const a = new Date(today() + 'T00:00:00')
  const b = new Date(dateStr + 'T00:00:00')
  return Math.floor((b - a) / 86400000)
}

// 今年的 MM-DD 轉成日期字串
function birthdayThisYear(mmdd) {
  if (!mmdd) return null
  const year = new Date().getFullYear()
  return `${year}-${mmdd}`
}

function getEggColor(t) { return t === '茶葉蛋' ? '#F97316' : t === '荷包蛋' ? '#3B82F6' : t === '生雞蛋' ? '#22C55E' : '#9CA3AF' }
function getEggBg(t) { return t === '茶葉蛋' ? '#FFF7ED' : t === '荷包蛋' ? '#EFF6FF' : t === '生雞蛋' ? '#F0FDF4' : '#F9FAFB' }

function avatarBg(name) {
  const colors = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EC4899', '#14B8A6']
  let n = 0; for (let i = 0; i < (name || '').length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

function Avatar({ name, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: avatarBg(name || ''),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0
    }}>
      {name ? name[0] : '?'}
    </div>
  )
}

const TABS = ['👤 名單經營', '🛍️ 顧客維繫', '📊 業務進度']

export default function NotificationBell({ userId }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)

  // 名單經營
  const [overdueContacts, setOverdueContacts] = useState([])       // 依 DAYS_MAP 久未互動
  const [dueSoonContacts, setDueSoonContacts] = useState([])       // next_contact_date 2天內
  const [contactBirthdays, setContactBirthdays] = useState([])     // 名單生日 3天內

  // 顧客維繫
  const [repurchaseReminders, setRepurchaseReminders] = useState([]) // 回購提醒 3天內
  const [inactiveCustomers, setInactiveCustomers] = useState([])     // 90天未消費
  const [sampleFollowups, setSampleFollowups] = useState([])         // 試用品超過7天未結案
  const [customerBirthdays, setCustomerBirthdays] = useState([])     // 顧客生日 3天內

  // 業務進度
  const [bvWarning, setBvWarning] = useState(null)
  const [newPartners, setNewPartners] = useState([])

  const totalCount =
    overdueContacts.length + dueSoonContacts.length + contactBirthdays.length +
    repurchaseReminders.length + inactiveCustomers.length + sampleFollowups.length + customerBirthdays.length +
    (bvWarning ? 1 : 0) + newPartners.length

  useEffect(() => {
    if (open && userId) fetchAll()
  }, [open, userId])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([
      fetchContactNotifications(),
      fetchCustomerNotifications(),
      fetchBusinessNotifications(),
    ])
    setLoading(false)
  }

  // ── 名單經營 ──────────────────────────────
  async function fetchContactNotifications() {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id,name,egg_type,need_level,action_type,last_contact_date,next_contact_date,birthday,occupation')
      .eq('user_id', userId)
      .eq('is_archived', false)

    if (!contacts) return

    const overdue = []
    const dueSoon = []

    contacts.forEach(c => {
      // 久未互動：根據 action_type → DAYS_MAP
      const suggestedAction = ACTION_MAP[c.egg_type]?.[c.need_level] || c.action_type
      const threshold = DAYS_MAP[suggestedAction] || 30
      const lastDiff = daysDiff(c.last_contact_date)

      if (lastDiff >= threshold) {
        overdue.push({ ...c, daysSince: lastDiff, threshold, suggestedAction })
      } else {
        // next_contact_date 2天內
        const until = daysUntil(c.next_contact_date)
        if (until >= 0 && until <= 2) {
          dueSoon.push({ ...c, daysUntil: until })
        }
      }
    })

    // 生日 3天內
    const birthdays = contacts.filter(c => {
      if (!c.birthday) return false
      const bday = birthdayThisYear(c.birthday)
      if (!bday) return false
      const until = daysUntil(bday)
      return until >= 0 && until <= 3
    }).map(c => ({ ...c, daysUntilBirthday: daysUntil(birthdayThisYear(c.birthday)) }))

    setOverdueContacts(overdue.sort((a, b) => b.daysSince - a.daysSince))
    setDueSoonContacts(dueSoon.sort((a, b) => a.daysUntil - b.daysUntil))
    setContactBirthdays(birthdays)
  }

  // ── 顧客維繫 ──────────────────────────────
  async function fetchCustomerNotifications() {
    const { data: customers } = await supabase
      .from('customers')
      .select('id,name,repurchase_reminder,birthday,phone')
      .eq('user_id', userId)

    if (!customers) return

    // 回購提醒 3天內
    const repurchase = customers.filter(c => {
      if (!c.repurchase_reminder) return false
      const until = daysUntil(c.repurchase_reminder)
      return until >= 0 && until <= 3
    }).map(c => ({ ...c, daysUntil: daysUntil(c.repurchase_reminder) }))

    // 顧客生日 3天內
    const birthdays = customers.filter(c => {
      if (!c.birthday) return false
      const bday = birthdayThisYear(c.birthday)
      if (!bday) return false
      const until = daysUntil(bday)
      return until >= 0 && until <= 3
    }).map(c => ({ ...c, daysUntilBirthday: daysUntil(birthdayThisYear(c.birthday)) }))

    setRepurchaseReminders(repurchase.sort((a, b) => a.daysUntil - b.daysUntil))
    setCustomerBirthdays(birthdays)

    // 90天未消費：從 transactions 找最後一筆
    const { data: txs } = await supabase
      .from('transactions')
      .select('customer_id,date')
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (txs) {
      const lastTxMap = {}
      txs.forEach(t => {
        if (!lastTxMap[t.customer_id]) lastTxMap[t.customer_id] = t.date
      })
      const inactive = customers.filter(c => {
        const last = lastTxMap[c.id]
        if (!last) return false
        return daysDiff(last) >= 90
      }).map(c => ({ ...c, daysSince: daysDiff(lastTxMap[c.id]) }))
      setInactiveCustomers(inactive.sort((a, b) => b.daysSince - a.daysSince))
    }

    // 試用品：超過 7 天未結案
    const { data: samples } = await supabase
      .from('sample_tracking')
      .select('id,product_name,share_date,contacts(name)')
      .eq('user_id', userId)
      .is('result', null)

    if (samples) {
      const followups = samples.filter(s => daysDiff(s.share_date) >= 7)
        .map(s => ({ ...s, daysSince: daysDiff(s.share_date) }))
      setSampleFollowups(followups.sort((a, b) => b.daysSince - a.daysSince))
    }
  }

  // ── 業務進度 ──────────────────────────────
  async function fetchBusinessNotifications() {
    const now = new Date()
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    const quarterStart = `${now.getFullYear()}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`
    const quarterEnd = new Date(now.getFullYear(), quarterStartMonth + 3, 0)
    const totalDays = Math.floor((quarterEnd - new Date(quarterStart)) / 86400000) + 1
    const passedDays = Math.floor((now - new Date(quarterStart + 'T00:00:00')) / 86400000) + 1
    const progress = passedDays / totalDays

    const { data: txs } = await supabase
      .from('transactions')
      .select('type,points')
      .eq('user_id', userId)
      .gte('date', quarterStart)

    if (txs) {
      let bv = 0, ibv = 0
      txs.forEach(t => {
        if (t.type === 'BV') bv += t.points
        if (t.type === 'IBV') ibv += t.points
      })
      const bvBehind = bv < BV_GOAL * progress * 0.8
      const ibvBehind = ibv < IBV_GOAL * progress * 0.8
      if (bvBehind || ibvBehind) {
        setBvWarning({
          bv, ibv, bvBehind, ibvBehind,
          bvPct: Math.round(bv / BV_GOAL * 100),
          ibvPct: Math.round(ibv / IBV_GOAL * 100),
          progressPct: Math.round(progress * 100),
        })
      } else {
        setBvWarning(null)
      }
    }

    // 新夥伴（7天內加入且推薦人是自己）
    const sevenDaysAgo = toDateStr(new Date(Date.now() - 7 * 86400000))
    const { data: partners } = await supabase
      .from('profiles')
      .select('id,name,email,created_at')
      .eq('referrer_id', userId)
      .gte('created_at', sevenDaysAgo + 'T00:00:00+00:00')

    if (partners) setNewPartners(partners)
  }

  function handleClose() { setOpen(false) }

  const tab1Count = overdueContacts.length + dueSoonContacts.length + contactBirthdays.length
  const tab2Count = repurchaseReminders.length + inactiveCustomers.length + sampleFollowups.length + customerBirthdays.length
  const tab3Count = (bvWarning ? 1 : 0) + newPartners.length

  return (
    <>
      {/* 鈴鐺按鈕 */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'relative', background: 'rgba(255,255,255,0.15)',
          border: 'none', borderRadius: '50%', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        {totalCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700,
            borderRadius: '50%', width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #1E3A5F'
          }}>
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* 抽屜遮罩 */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#F8FAFC', borderRadius: '20px 20px 0 0',
              width: '100%', maxWidth: 430, maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)'
            }}>

            {/* 抽屜 Header */}
            <div style={{ padding: '16px 20px 0', background: '#fff', borderRadius: '20px 20px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🔔</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>提醒通知</span>
                  {totalCount > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: '#FEF2F2', color: '#DC2626'
                    }}>{totalCount} 則</span>
                  )}
                </div>
                <button onClick={handleClose}
                  style={{ background: 'none', border: 'none', fontSize: 20, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #F3F4F6' }}>
                {TABS.map((tab, i) => {
                  const cnt = [tab1Count, tab2Count, tab3Count][i]
                  return (
                    <button key={i} onClick={() => setActiveTab(i)}
                      style={{
                        flex: 1, padding: '8px 4px', border: 'none', background: 'none',
                        fontSize: 12, fontWeight: activeTab === i ? 700 : 500,
                        color: activeTab === i ? '#2563EB' : '#6B7280',
                        borderBottom: activeTab === i ? '2px solid #2563EB' : '2px solid transparent',
                        marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                      }}>
                      {tab}
                      {cnt > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                          background: activeTab === i ? '#DBEAFE' : '#F3F4F6',
                          color: activeTab === i ? '#2563EB' : '#9CA3AF'
                        }}>{cnt}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 內容 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>載入中…</div>
              ) : (
                <>
                  {/* Tab 0：名單經營 */}
                  {activeTab === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tab1Count === 0 && <EmptyState icon="👤" text="名單經營狀況良好！" />}

                      {overdueContacts.length > 0 && (
                        <Section title="⏰ 久未互動" color="#EF4444" bgColor="#FEF2F2">
                          {overdueContacts.map(c => (
                            <NotifCard key={c.id} onClick={() => { navigate(`/contacts/${c.id}`); handleClose() }}>
                              <Avatar name={c.name} size={38} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</span>
                                  {c.egg_type && (
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: getEggBg(c.egg_type), color: getEggColor(c.egg_type) }}>
                                      {c.egg_type}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 12, color: '#6B7280' }}>
                                  建議行動：{c.suggestedAction}｜每 {c.threshold} 天互動一次
                                </span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', whiteSpace: 'nowrap' }}>
                                已 {c.daysSince} 天
                              </span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}

                      {dueSoonContacts.length > 0 && (
                        <Section title="📅 即將到期" color="#F97316" bgColor="#FFF7ED">
                          {dueSoonContacts.map(c => (
                            <NotifCard key={c.id} onClick={() => { navigate(`/contacts/${c.id}`); handleClose() }}>
                              <Avatar name={c.name} size={38} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</span>
                                  {c.egg_type && (
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: getEggBg(c.egg_type), color: getEggColor(c.egg_type) }}>
                                      {c.egg_type}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 12, color: '#6B7280' }}>{c.action_type}</span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', whiteSpace: 'nowrap' }}>
                                {c.daysUntil === 0 ? '今天到期' : `${c.daysUntil} 天後`}
                              </span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}

                      {contactBirthdays.length > 0 && (
                        <Section title="🎂 名單生日" color="#A855F7" bgColor="#FAF5FF">
                          {contactBirthdays.map(c => (
                            <NotifCard key={c.id} onClick={() => { navigate(`/contacts/${c.id}`); handleClose() }}>
                              <Avatar name={c.name} size={38} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</span>
                                {c.occupation && <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{c.occupation}</p>}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#A855F7', whiteSpace: 'nowrap' }}>
                                {c.daysUntilBirthday === 0 ? '今天生日 🎉' : `${c.daysUntilBirthday} 天後`}
                              </span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}
                    </div>
                  )}

                  {/* Tab 1：顧客維繫 */}
                  {activeTab === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tab2Count === 0 && <EmptyState icon="🛍️" text="顧客維繫狀況良好！" />}

                      {repurchaseReminders.length > 0 && (
                        <Section title="🔁 回購提醒" color="#2563EB" bgColor="#EFF6FF">
                          {repurchaseReminders.map(c => (
                            <NotifCard key={c.id} onClick={() => { navigate(`/customers/${c.id}`); handleClose() }}>
                              <Avatar name={c.name} size={38} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</span>
                                {c.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{c.phone}</p>}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', whiteSpace: 'nowrap' }}>
                                {c.daysUntil === 0 ? '今天到期' : `${c.daysUntil} 天後`}
                              </span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}

                      {customerBirthdays.length > 0 && (
                        <Section title="🎂 顧客生日" color="#EC4899" bgColor="#FDF2F8">
                          {customerBirthdays.map(c => (
                            <NotifCard key={c.id} onClick={() => { navigate(`/customers/${c.id}`); handleClose() }}>
                              <Avatar name={c.name} size={38} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</span>
                                {c.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{c.phone}</p>}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#EC4899', whiteSpace: 'nowrap' }}>
                                {c.daysUntilBirthday === 0 ? '今天生日 🎉' : `${c.daysUntilBirthday} 天後`}
                              </span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}

                      {sampleFollowups.length > 0 && (
                        <Section title="🧪 試用品跟進" color="#F97316" bgColor="#FFF7ED">
                          {sampleFollowups.map(s => (
                            <NotifCard key={s.id} onClick={() => { navigate('/samples'); handleClose() }}>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧪</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.contacts?.name}</span>
                                <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{s.product_name}</p>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', whiteSpace: 'nowrap' }}>
                                已 {s.daysSince} 天
                              </span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}

                      {inactiveCustomers.length > 0 && (
                        <Section title="😴 長期未消費" color="#6B7280" bgColor="#F9FAFB">
                          {inactiveCustomers.map(c => (
                            <NotifCard key={c.id} onClick={() => { navigate(`/customers/${c.id}`); handleClose() }}>
                              <Avatar name={c.name} size={38} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.name}</span>
                                {c.phone && <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{c.phone}</p>}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>
                                {c.daysSince} 天未購
                              </span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}
                    </div>
                  )}

                  {/* Tab 2：業務進度 */}
                  {activeTab === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tab3Count === 0 && <EmptyState icon="📊" text="業務進度一切正常！繼續加油 💪" />}

                      {bvWarning && (
                        <Section title="⚠️ 業績進度落後" color="#DC2626" bgColor="#FEF2F2">
                          <div style={{ padding: '4px 0' }}>
                            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 10px' }}>
                              本季已過 <strong>{bvWarning.progressPct}%</strong>，但業績進度落後：
                            </p>
                            {bvWarning.bvBehind && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>BV</span>
                                  <span style={{ fontSize: 13, color: '#374151' }}>{bvWarning.bv.toFixed(0)} / {BV_GOAL}（{bvWarning.bvPct}%）</span>
                                </div>
                                <div style={{ background: '#FED7AA', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                  <div style={{ width: `${bvWarning.bvPct}%`, height: '100%', background: '#F97316', borderRadius: 99 }} />
                                </div>
                              </div>
                            )}
                            {bvWarning.ibvBehind && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6' }}>IBV</span>
                                  <span style={{ fontSize: 13, color: '#374151' }}>{bvWarning.ibv.toFixed(0)} / {IBV_GOAL}（{bvWarning.ibvPct}%）</span>
                                </div>
                                <div style={{ background: '#BFDBFE', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                  <div style={{ width: `${bvWarning.ibvPct}%`, height: '100%', background: '#3B82F6', borderRadius: 99 }} />
                                </div>
                              </div>
                            )}
                            <button onClick={() => { navigate('/transactions'); handleClose() }}
                              style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                              前往業績頁面 →
                            </button>
                          </div>
                        </Section>
                      )}

                      {newPartners.length > 0 && (
                        <Section title="🤝 新夥伴加入" color="#22C55E" bgColor="#F0FDF4">
                          {newPartners.map(p => (
                            <NotifCard key={p.id}>
                              <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarBg(p.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                                {p.name ? p.name[0] : '?'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{p.name || '新夥伴'}</span>
                                <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{p.email}</p>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: '#DCFCE7', color: '#16A34A' }}>新加入</span>
                            </NotifCard>
                          ))}
                        </Section>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// 小元件
function Section({ title, color, bgColor, children }) {
  return (
    <div style={{ background: bgColor, borderRadius: 14, padding: '12px 14px', border: `1px solid ${color}22` }}>
      <p style={{ fontSize: 12, fontWeight: 700, color, margin: '0 0 8px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function NotifCard({ children, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#fff', borderRadius: 10, padding: '10px 12px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
      {children}
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
      <p style={{ fontSize: 36, margin: '0 0 12px' }}>{icon}</p>
      <p style={{ fontSize: 14, margin: 0 }}>{text}</p>
    </div>
  )
}
