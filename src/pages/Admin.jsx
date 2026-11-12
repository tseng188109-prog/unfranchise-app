// Admin.jsx — 系統管理（入口：設定 → 功能 → 系統管理，只有管理員看得到）
// 只看大家有沒有在用，看不到任何人的名單、顧客、業績、互動內容。
// 所有資料和動作都經過 /api/admin，後台會先確認按的人真的是管理員。
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { IconArrowLeft, IconKey, IconUserEdit, IconUserOff, IconUserCheck, IconTrash, IconSearch, IconCopy } from '@tabler/icons-react'
import { askConfirm } from './confirmDialog'
import { CloseBtn } from './ui'
import { RADIUS } from './designTokens'
import LoadingSpinner from './LoadingSpinner'

const DAY = 86400000
const TABS = [['overview', '整體'], ['accounts', '帳號'], ['tree', '夥伴關係'], ['feedback', '回報'], ['admins', '管理員']]
const STATUS = {
  active: { label: '常用', bg: 'var(--green-soft)', color: 'var(--green-text)' },
  less: { label: '最近較少用', bg: 'var(--yellow-soft)', color: 'var(--yellow-text)' },
  idle: { label: '很久沒用', bg: 'var(--danger-soft)', color: 'var(--danger-text)' },
  new: { label: '還沒開始', bg: 'var(--sub2)', color: 'var(--text2)' },
  off: { label: '已停用', bg: 'var(--sub2)', color: 'var(--text2)' },
}
const ACTION_TEXT = {
  temp_password: '給臨時密碼', deactivate: '停用', restore: '恢復', delete: '永久刪除',
  set_referrer: '改推薦人', add_admin: '加為管理員', remove_admin: '移除管理員',
}

async function callAdmin(action, extra = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') },
    body: JSON.stringify({ action, ...extra }),
  })
  let out = {}
  try { out = await res.json() } catch { /* ignore */ }
  if (!res.ok || out.ok === false) {
    const e = new Error(out.error || '沒成功，網路可能不穩，再按一次試試')
    e.status = res.status
    throw e
  }
  return out
}

function ym(d) {
  if (!d) return ''
  const t = new Date(d)
  return `${t.getFullYear()}/${String(t.getMonth() + 1).padStart(2, '0')}`
}
function md(d) {
  if (!d) return ''
  const t = new Date(d)
  return `${t.getMonth() + 1}/${t.getDate()}`
}
function daysSince(d, today) {
  if (!d) return null
  return Math.round((new Date(today + 'T00:00:00Z') - new Date(String(d).slice(0, 10) + 'T00:00:00Z')) / DAY)
}
function lastOpenText(a, today) {
  const n = daysSince(a.last_day, today)
  if (n === null) return '—'
  return n <= 0 ? '今天' : `${n} 天前`
}
function offDays(a) {
  return a.deactivated_at ? Math.floor((Date.now() - new Date(a.deactivated_at).getTime()) / DAY) : 0
}
// 永久刪除要打的字：有名字打名字，沒名字打 Email
function delKey(a) { return (a.name || '').trim() || (a.email || '').trim() }
function canDelete(a) { return !!a.deactivated_at && offDays(a) >= 30 }
function mismatched(a) { return !a.referrer_id && !!a.referrer_email_pending && !a.deactivated_at }

// 這一輪送了哪幾種提醒
const RUN_KIND = { morning: '約會', evening: '晚上', news: '夥伴好消息', weekly: '一週總結', team: '戰隊', error: '出錯' }
function runKindText(kind) { return String(kind || '').split('+').map(k => RUN_KIND[k] || k).join('、') }

function Pill({ s, text }) {
  const st = STATUS[s] || STATUS.new
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: st.bg, color: st.color }}>{text || st.label}</span>
}
function Warn({ children }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--yellow-soft)', color: 'var(--yellow-text)' }}>{children}</span>
}

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: RADIUS.xl, padding: 14 }
const btn = { padding: '8px 14px', borderRadius: RADIUS.sm, border: '1px solid var(--border2)', background: 'var(--card)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const btnPrimary = { ...btn, background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }
const btnDanger = { ...btn, background: 'var(--danger-soft)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }
const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: '1px solid var(--border)' }

function Sheet({ title, onClose, children }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', borderRadius: '22px 22px 0 0', padding: '16px 18px 28px', width: '100%', maxWidth: 480, boxSizing: 'border-box', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
          <CloseBtn onClick={onClose} size={36} />
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [me, setMe] = useState(null)
  const [denied, setDenied] = useState(false)
  const [accounts, setAccounts] = useState(null)
  const [today, setToday] = useState('')
  const [overview, setOverview] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [logs, setLogs] = useState(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [showHandled, setShowHandled] = useState(false)
  // 彈出視窗
  const [actFor, setActFor] = useState(null)      // 操作選單
  const [tempPw, setTempPw] = useState(null)      // { name, password }
  const [refFor, setRefFor] = useState(null)      // 改推薦人
  const [refPick, setRefPick] = useState('')
  const [delFor, setDelFor] = useState(null)      // 永久刪除第二次確認
  const [delName, setDelName] = useState('')
  const [pickAdmin, setPickAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadAccounts = useCallback(async () => {
    const out = await callAdmin('accounts')
    setAccounts(out.accounts); setToday(out.today)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [ov] = await Promise.all([callAdmin('overview'), loadAccounts()])
      setOverview(ov)
      setErr('')
    } catch (e) {
      if (e.status === 401 || e.status === 403) setDenied(true)
      else setErr(e.message)
    }
  }, [loadAccounts])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { setMe(user); loadAll() })
  }, [loadAll])

  useEffect(() => {
    if (tab === 'feedback' && !feedback) callAdmin('feedback').then(o => setFeedback(o.items)).catch(e => setErr(e.message))
    if (tab === 'admins' && !logs) callAdmin('logs').then(o => setLogs(o.items)).catch(e => setErr(e.message))
  }, [tab, feedback, logs])

  async function act(action, extra, okMsg) {
    setBusy(true); setErr('')
    try {
      const out = await callAdmin(action, extra)
      await loadAll()
      setLogs(null)
      if (okMsg) okMsg(out)
      return out
    } catch (e) {
      setErr(e.message)
      return null
    } finally { setBusy(false) }
  }

  async function doTempPassword(a) {
    setActFor(null)
    if (!(await askConfirm({ title: `給${a.name}一組臨時密碼？`, message: '他原本的密碼會失效。你會看到一組臨時密碼，用 LINE 傳給他，他登入後要換成自己的密碼。', okText: '產生臨時密碼' }))) return
    const out = await act('temp_password', { id: a.id })
    if (out) { setCopied(false); setTempPw({ name: a.name, password: out.password }) }
  }
  async function doDeactivate(a) {
    setActFor(null)
    if (!(await askConfirm({ title: `停用${a.name}的帳號？`, message: '停用後他就登不進來了，他的資料都還在。30 天內隨時可以「恢復」。', okText: '停用', danger: true }))) return
    act('deactivate', { id: a.id })
  }
  async function doRestore(a) {
    setActFor(null)
    if (!(await askConfirm({ title: `恢復${a.name}的帳號？`, message: '恢復後他就可以用原本的密碼登入。', okText: '恢復' }))) return
    act('restore', { id: a.id })
  }
  async function doDeleteStep1(a) {
    setActFor(null)
    const kids = (accounts || []).filter(x => x.referrer_id === a.id).length
    const up = (accounts || []).find(x => x.id === a.referrer_id)
    const msg = `${a.name}的名單、顧客、紀錄會全部刪掉，刪了救不回來。` +
      (kids ? `他推薦的 ${kids} 位，推薦人會改成${up ? up.name : '「沒有推薦人」'}。` : '') +
      '他建的戰隊會交給隊上最早加入的人。'
    if (!(await askConfirm({ title: `永久刪除${a.name}？`, message: msg, okText: '下一步', danger: true }))) return
    setDelName(''); setDelFor(a)
  }
  async function doDeleteStep2() {
    const a = delFor
    const out = await act('delete', { id: a.id, confirmName: delName })
    if (out) setDelFor(null)
  }
  async function saveReferrer() {
    const out = await act('set_referrer', { id: refFor.id, referrerId: refPick || null })
    if (out) setRefFor(null)
  }
  async function toggleHandled(f) {
    try {
      await callAdmin('feedback_handled', { id: f.id, handled: !f.handled_at })
      const o = await callAdmin('feedback'); setFeedback(o.items)
      const ov = await callAdmin('overview'); setOverview(ov)
    } catch (e) { setErr(e.message) }
  }
  async function addAdmin(a) {
    setPickAdmin(false)
    if (!(await askConfirm({ title: `把${a.name}加為管理員？`, message: '管理員看得到每個人的名字、Email、最近哪天打開 App，也可以給臨時密碼、停用帳號。', okText: '加為管理員' }))) return
    act('add_admin', { id: a.id })
  }
  async function removeAdmin(a) {
    const self = me && a.id === me.id
    if (!(await askConfirm({ title: self ? '移除你自己的管理員身分？' : `移除${a.name}的管理員身分？`, message: self ? '移除後你就看不到系統管理了。' : '', okText: '移除', danger: true }))) return
    const out = await act('remove_admin', { id: a.id })
    if (out && self) navigate('/settings', { replace: true })
  }

  // ── 畫面 ─────────────────────────────────
  const header = (
    <div style={{ background: 'var(--hero)', padding: '52px 0 18px' }}>
      <div className="adm-wrap" style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} aria-label="返回" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}>
          <IconArrowLeft size={22} stroke={1.9} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>系統管理</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '3px 0 0' }}>只看大家有沒有在用，看不到任何人的名單、顧客和業績</p>
        </div>
      </div>
    </div>
  )
  const style = (
    <style>{`
      .adm-wrap{max-width:430px;margin:0 auto}
      .adm-table{display:none}
      @media(min-width:1024px){.adm-wrap{max-width:1100px}.adm-table{display:table}.adm-cards{display:none}.adm-grid4{grid-template-columns:repeat(4,minmax(0,1fr))!important}.adm-two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}}
      .adm-table th{font-weight:400;color:var(--muted);text-align:left;padding:8px 6px;border-bottom:1px solid var(--border);font-size:12px;white-space:nowrap}
      .adm-table td{padding:10px 6px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text);vertical-align:middle}
    `}</style>
  )

  if (denied) {
    return (
      <div style={{ background: 'var(--page)', minHeight: '100vh' }}>{style}{header}
        <div className="adm-wrap" style={{ padding: 16 }}><div style={{ ...card, color: 'var(--text2)', fontSize: 14 }}>這一頁只有管理員可以看。</div></div>
      </div>
    )
  }

  const list = accounts || []
  const nameOf = {}; list.forEach(a => { nameOf[a.id] = a.name })
  const counts = {
    all: list.length,
    active: list.filter(a => a.status === 'active').length,
    less: list.filter(a => a.status === 'less').length,
    idle: list.filter(a => a.status === 'idle').length,
    new: list.filter(a => a.status === 'new').length,
    off: list.filter(a => a.status === 'off').length,
    mismatch: list.filter(mismatched).length,
    deletable: list.filter(canDelete).length,
  }
  const FILTERS = [['all', '全部'], ['active', '常用'], ['less', '較少用'], ['idle', '很久沒用'], ['new', '還沒開始'], ['off', '已停用'],
    ...(counts.mismatch ? [['mismatch', '推薦人對不上']] : []), ...(counts.deletable ? [['deletable', '可以刪除']] : [])]
  const shown = list.filter(a => {
    if (filter === 'mismatch') return mismatched(a)
    if (filter === 'deletable') return canDelete(a)
    if (filter !== 'all' && a.status !== filter) return false
    const k = q.trim().toLowerCase()
    return !k || (a.name || '').toLowerCase().includes(k) || (a.email || '').toLowerCase().includes(k)
  }).sort((a, b) => (a.status === 'off') - (b.status === 'off') || String(b.last_day || '').localeCompare(String(a.last_day || '')))

  const statusPill = (a) => a.status === 'off' ? <Pill s="off" text={`停用 ${offDays(a)} 天`} /> : <Pill s={a.status} />
  const refCell = (a) => a.referrer_id ? (nameOf[a.referrer_id] || '—') : mismatched(a) ? <Warn>Email 對不上</Warn> : '—'

  const goto = (t, f) => { setTab(t); if (f) { setFilter(f); setQ('') } }

  let body = null
  if (!accounts) body = <LoadingSpinner fullPage={false} />
  else if (tab === 'overview' && overview) {
    body = (
      <>
        <div style={card}>
          <div className="adm-grid4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {[['全部帳號', overview.total], ['這 7 天有打開', overview.active], ['新加入（14 天內）', overview.newbies], ['還沒開始', overview.notStarted]].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--sub)', borderRadius: 12, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="adm-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>手機提醒</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', margin: '4px 0 6px' }}>有登記手機提醒 {overview.pushUsers} 人（{overview.total} 人中）</div>
            {overview.runs.length === 0 && <div style={{ ...row, fontSize: 13, color: 'var(--muted)' }}>還沒有送出紀錄</div>}
            {overview.runs.map((r, i) => (
              <div key={i} style={{ ...row, fontSize: 13, color: 'var(--text)' }}>
                <span>{md(r.slot_date)} {r.slot_hour}:00 {runKindText(r.kind)}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text2)' }}>送給 {r.users} 人</span>
                {r.note ? <Pill s="idle" text="出錯了" /> : r.failed ? <Pill s="idle" text={`${r.failed} 則沒送到`} /> : <Pill s="active" text={r.users ? '都送到' : '沒有要送的'} />}
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>要處理的事</div>
            {!overview.openFeedback && !overview.mismatched && !overview.deletable && (
              <div style={{ ...row, fontSize: 13, color: 'var(--green-text)' }}>目前沒有要處理的事</div>
            )}
            {[[overview.openFeedback, '則回報還沒處理', '看回報', () => goto('feedback')],
              [overview.mismatched, '位推薦人 Email 對不上', '去處理', () => goto('accounts', 'mismatch')],
              [overview.deletable, '位停用滿 30 天，可以刪除', '看帳號', () => goto('accounts', 'deletable')]]
              .filter(x => x[0] > 0).map(([n, text, link, fn]) => (
                <button key={text} onClick={fn} style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text)' }}>
                  <Warn>{n}</Warn> {text}<span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>{link} ›</span>
                </button>
              ))}
          </div>
        </div>
      </>
    )
  } else if (tab === 'accounts') {
    body = (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: RADIUS.md, padding: '0 10px', marginBottom: 8 }}>
          <IconSearch size={16} stroke={1.8} color="var(--muted)" />
          <input value={q} onChange={e => { setQ(e.target.value); if (filter === 'mismatch' || filter === 'deletable') setFilter('all') }} placeholder="搜尋名字或 Email"
            style={{ flex: 1, border: 'none', outline: 'none', padding: '9px 0', fontSize: 14, background: 'transparent' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: `1px solid ${filter === k ? 'var(--primary)' : 'var(--border2)'}`,
                background: filter === k ? 'var(--primary-soft)' : 'transparent', color: filter === k ? 'var(--primary)' : 'var(--text2)', fontWeight: filter === k ? 600 : 400 }}>
              {label} {counts[k]}
            </button>
          ))}
        </div>
        <table className="adm-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>名字</th><th>Email</th><th>推薦人</th><th>加入</th><th>最近打開</th><th>狀態</th><th>手機提醒</th><th></th></tr></thead>
          <tbody>
            {shown.map(a => (
              <tr key={a.id} style={{ opacity: a.status === 'off' ? 0.6 : 1 }}>
                <td style={{ fontWeight: 600 }}>{a.name || '（沒名字）'}{a.is_admin && <span style={{ fontSize: 11, color: 'var(--primary)', marginLeft: 6 }}>管理員</span>}</td>
                <td>{a.email}</td><td>{refCell(a)}</td><td>{ym(a.created_at)}</td><td>{lastOpenText(a, today)}</td>
                <td>{statusPill(a)}</td><td>{a.push ? '開' : '—'}</td>
                <td style={{ textAlign: 'right' }}><button style={btn} onClick={() => setActFor(a)}>操作 ▾</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="adm-cards">
          {shown.map(a => (
            <button key={a.id} onClick={() => setActFor(a)}
              style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', opacity: a.status === 'off' ? 0.6 : 1 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{a.name || '（沒名字）'}</span>{statusPill(a)}
                  {a.is_admin && <span style={{ fontSize: 11, color: 'var(--primary)' }}>管理員</span>}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.email} · 推薦人 {a.referrer_id ? (nameOf[a.referrer_id] || '—') : mismatched(a) ? 'Email 對不上' : '—'} · {lastOpenText(a, today) === '—' ? '還沒打開過' : lastOpenText(a, today) + '打開'}
                </span>
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>›</span>
            </button>
          ))}
        </div>
        {shown.length === 0 && <div style={{ ...row, fontSize: 13, color: 'var(--muted)' }}>沒有符合的帳號</div>}
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>{'常用＝7 天內打開過　最近較少用＝8–30 天　很久沒用＝超過 30 天　還沒開始＝加入後還沒打開過'}</div>
      </div>
    )
  } else if (tab === 'tree') {
    const kids = {}
    list.forEach(a => { if (a.referrer_id && nameOf[a.referrer_id] !== undefined) (kids[a.referrer_id] = kids[a.referrer_id] || []).push(a) })
    const roots = list.filter(a => !a.referrer_id || nameOf[a.referrer_id] === undefined)
      .sort((a, b) => (kids[b.id] || []).length - (kids[a.id] || []).length || new Date(a.created_at) - new Date(b.created_at))
    const rows = []
    const seen = new Set()
    const walk = (a, depth) => {
      if (seen.has(a.id)) return
      seen.add(a.id); rows.push({ a, depth })
      ;(kids[a.id] || []).sort((x, y) => new Date(x.created_at) - new Date(y.created_at)).forEach(k => walk(k, depth + 1))
    }
    roots.forEach(r => walk(r, 0))
    list.forEach(a => { if (!seen.has(a.id)) rows.push({ a, depth: 0 }) })
    body = (
      <div style={card}>
        {rows.map(({ a, depth }, i) => (
          <div key={a.id} style={{ ...row, borderTop: i ? '1px solid var(--border)' : 'none', paddingLeft: Math.min(depth, 6) * 20, opacity: a.status === 'off' ? 0.6 : 1, flexWrap: 'wrap' }}>
            {depth > 0 && <span style={{ color: 'var(--muted)' }}>└</span>}
            <span style={{ fontSize: 14, fontWeight: depth ? 400 : 600, color: 'var(--text)' }}>{a.name || '（沒名字）'}</span>
            {(kids[a.id] || []).length > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>推薦了 {kids[a.id].length} 位</span>}
            {mismatched(a) && <Warn>推薦人 Email 對不上</Warn>}
            <span style={{ marginLeft: 'auto' }}>{statusPill(a)}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>只有名字和推薦了幾位，沒有業績。</div>
      </div>
    )
  } else if (tab === 'feedback') {
    const items = (feedback || []).filter(f => showHandled ? !!f.handled_at : !f.handled_at)
    const handledCount = (feedback || []).filter(f => f.handled_at).length
    body = !feedback ? <LoadingSpinner fullPage={false} /> : (
      <>
        {items.length === 0 && <div style={{ ...card, fontSize: 13, color: 'var(--muted)' }}>{showHandled ? '還沒有處理過的回報' : '沒有還沒處理的回報'}</div>}
        {items.map(f => (
          <div key={f.id} style={card}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <Pill s={f.kind === '出錯了' ? 'less' : 'new'} text={f.kind} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{f.name || '（不知道是誰）'} · {md(f.created_at)}{f.page ? ` · 在 ${f.page}` : ''}</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{f.message}</div>
            <div style={{ marginTop: 8 }}><button style={btn} onClick={() => toggleHandled(f)}>{f.handled_at ? '改回還沒處理' : '標成已處理'}</button></div>
          </div>
        ))}
        <button onClick={() => setShowHandled(!showHandled)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: '4px 2px' }}>
          {showHandled ? '‹ 回到還沒處理的' : `已處理的 ${handledCount} 則 ›`}
        </button>
      </>
    )
  } else if (tab === 'admins') {
    const admins = list.filter(a => a.is_admin)
    const candidates = list.filter(a => !a.is_admin && !a.deactivated_at)
    body = (
      <div className="adm-two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>管理員</div>
          {admins.map((a, i) => (
            <div key={a.id} style={{ ...row, borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{a.name || '（沒名字）'}{me && a.id === me.id && <span style={{ color: 'var(--muted)', fontSize: 12 }}>（你）</span>}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{a.email}</span>
              {admins.length > 1 && <button onClick={() => removeAdmin(a)} disabled={busy} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger-text)', fontSize: 13, cursor: 'pointer' }}>移除</button>}
            </div>
          ))}
          <div style={{ marginTop: 10 }}><button style={btnPrimary} onClick={() => setPickAdmin(true)}>+ 加一位管理員</button></div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>至少要留一位管理員，最後一位不能移除自己。</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>管理紀錄</div>
          {!logs ? <LoadingSpinner fullPage={false} /> : logs.length === 0 ? <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>還沒有紀錄</div> :
            logs.map((l, i) => (
              <div key={l.id} style={{ ...row, borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13, color: 'var(--text)' }}>
                <span style={{ color: 'var(--muted)', fontSize: 12, minWidth: 38 }}>{md(l.created_at)}</span>
                <span>{l.actor_name || '管理員'} {ACTION_TEXT[l.action] || l.action}：{l.target_name || ''}{l.detail ? `（${l.detail}）` : ''}</span>
              </div>
            ))}
        </div>
        {pickAdmin && (
          <Sheet title="加一位管理員" onClose={() => setPickAdmin(false)}>
            {candidates.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>沒有可以加的人</div>}
            {candidates.map(a => (
              <button key={a.id} onClick={() => addAdmin(a)} style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>{a.name || '（沒名字）'}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{a.email}</span>
              </button>
            ))}
          </Sheet>
        )}
      </div>
    )
  }

  // 改推薦人可以選的人：不能是自己，也不能是他底下的人
  const refOptions = (() => {
    if (!refFor) return []
    const below = new Set([refFor.id])
    let grew = true
    while (grew) { grew = false; list.forEach(a => { if (a.referrer_id && below.has(a.referrer_id) && !below.has(a.id)) { below.add(a.id); grew = true } }) }
    return list.filter(a => !below.has(a.id) && !a.deactivated_at).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  })()
  const isMe = actFor && me && actFor.id === me.id

  return (
    <div style={{ background: 'var(--page)', minHeight: '100vh', paddingBottom: 80 }}>
      {style}{header}
      <div className="adm-wrap" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer', border: `1px solid ${tab === k ? 'var(--primary)' : 'var(--border2)'}`,
                background: tab === k ? 'var(--primary)' : 'var(--card)', color: tab === k ? '#fff' : 'var(--text2)', fontWeight: tab === k ? 600 : 400 }}>{label}</button>
          ))}
        </div>
        {err && <div style={{ background: 'var(--danger-soft)', color: 'var(--danger-text)', borderRadius: 12, padding: '10px 12px', fontSize: 13 }}>{err}</div>}
        {body}
      </div>

      {actFor && (
        <Sheet title={actFor.name || '（沒名字）'} onClose={() => setActFor(null)}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{actFor.email} · 推薦人 {actFor.referrer_id ? (nameOf[actFor.referrer_id] || '—') : '—'} · 最近打開 {lastOpenText(actFor, today)}</div>
          {mismatched(actFor) && <div style={{ fontSize: 12, color: 'var(--yellow-text)', background: 'var(--yellow-soft)', borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>註冊時填的推薦人 Email 是 {actFor.referrer_email_pending}，對不上任何帳號</div>}
          {!actFor.deactivated_at && (
            <>
              <button disabled={busy} onClick={() => doTempPassword(actFor)} style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}><IconKey size={18} stroke={1.8} /> 給他一組臨時密碼</button>
              <button disabled={busy} onClick={() => { setRefPick(actFor.referrer_id || ''); setRefFor(actFor); setActFor(null) }} style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}><IconUserEdit size={18} stroke={1.8} /> 改推薦人</button>
              {!isMe && <button disabled={busy} onClick={() => doDeactivate(actFor)} style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, color: 'var(--danger-text)' }}><IconUserOff size={18} stroke={1.8} /> 停用這個帳號</button>}
              {!isMe && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>停用滿 30 天後，才會出現「永久刪除」。</div>}
            </>
          )}
          {actFor.deactivated_at && (
            <>
              <button disabled={busy} onClick={() => doRestore(actFor)} style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}><IconUserCheck size={18} stroke={1.8} /> 恢復這個帳號</button>
              {canDelete(actFor)
                ? <button disabled={busy} onClick={() => doDeleteStep1(actFor)} style={{ ...row, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, color: 'var(--danger-text)' }}><IconTrash size={18} stroke={1.8} /> 永久刪除</button>
                : <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>已停用 {offDays(actFor)} 天，滿 30 天後可以永久刪除。</div>}
            </>
          )}
        </Sheet>
      )}

      {tempPw && (
        <Sheet title={`給${tempPw.name}的臨時密碼`} onClose={() => setTempPw(null)}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 2, background: 'var(--sub)', borderRadius: 12, padding: 12, textAlign: 'center', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', userSelect: 'all' }}>{tempPw.password}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', margin: '8px 0 12px', lineHeight: 1.6 }}>這組密碼只顯示這一次。用 LINE 傳給他，他登入後會被要求換成自己的密碼。</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnPrimary, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={async () => { try { await navigator.clipboard.writeText(tempPw.password); setCopied(true) } catch { setCopied(false) } }}>
              <IconCopy size={16} stroke={1.9} /> {copied ? '已複製' : '複製'}
            </button>
            <button style={{ ...btn, flex: 1 }} onClick={() => setTempPw(null)}>完成</button>
          </div>
        </Sheet>
      )}

      {refFor && (
        <Sheet title={`改${refFor.name}的推薦人`} onClose={() => setRefFor(null)}>
          {refFor.referrer_email_pending && !refFor.referrer_id && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.6 }}>{refFor.name}註冊時填的推薦人 Email 是 {refFor.referrer_email_pending}，對不上任何帳號。</div>}
          <select value={refPick} onChange={e => setRefPick(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: RADIUS.md, border: '1px solid var(--border)', fontSize: 14, marginBottom: 12 }}>
            <option value="">（沒有推薦人）</option>
            {refOptions.map(a => <option key={a.id} value={a.id}>{(a.name || '（沒名字）') + '\u3000' + a.email}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>他推薦的人（和再往下的）不能當他的推薦人，所以不在名單裡。</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btn, flex: 1 }} onClick={() => setRefFor(null)}>取消</button>
            <button style={{ ...btnPrimary, flex: 1 }} disabled={busy} onClick={saveReferrer}>{busy ? '儲存中…' : '確定'}</button>
          </div>
        </Sheet>
      )}

      {delFor && (
        <Sheet title={`永久刪除${delFor.name || delFor.email}？`} onClose={() => setDelFor(null)}>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>這是最後一次確認，刪了救不回來。</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 4px' }}>請打{delFor.name ? '他的名字' : '他的 Email'}「{delKey(delFor)}」才能刪除</div>
          <input value={delName} onChange={e => setDelName(e.target.value)} placeholder={delKey(delFor)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: RADIUS.md, border: '1px solid var(--border)', fontSize: 14, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ ...btn, flex: 1 }} onClick={() => setDelFor(null)}>取消</button>
            <button style={{ ...btnDanger, flex: 1, opacity: delName.trim() === delKey(delFor) ? 1 : 0.5 }} disabled={busy || delName.trim() !== delKey(delFor)} onClick={doDeleteStep2}>{busy ? '刪除中…' : '永久刪除'}</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
