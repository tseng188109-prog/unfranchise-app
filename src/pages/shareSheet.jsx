// 分享成圖片，貼到群組：選日期 → 看圖片、分享 → 往下看「你的細節」（只有自己看得到）
// 入口：首頁 › 本週回顧（點開）、週五晚上通知點進去那一頁的「分享給推薦人」
// 選過的日期、BV 開關、想說的話存在 users.tag_settings（share_range / share_bv / share_say），下次打開還在
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { CloseBtn } from './ui'
import { RangeCalendar } from './rangeCalendar'
import { loadPeriod, periodNumbers, loadBizPaths, loadActionDays, spanDays, rangeText } from './periodData'
import { resultTiles, dayDots, pickHighlight, pathOf, pathSummary } from '../lib/results'
import { renderShareCard, shareOrDownload } from './shareImage'
import { resolveMode, saveTagSetting } from './dailyMode'
import { taipeiToday, addDaysStr } from './meetings'
import { IconLock, IconShare2, IconDownload, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER } from './designTokens'

const md = d => `${+d.slice(5, 7)}/${+d.slice(8)}`

const chip = on => ({ padding: '7px 13px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: `1.5px solid ${on ? PRIMARY : BORDER}`, background: on ? PRIMARY_SOFT : 'var(--card)', color: on ? PRIMARY : TEXT_SECONDARY })
const seg = on => ({ padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: `1.5px solid ${on ? PRIMARY : BORDER}`, background: on ? PRIMARY_SOFT : 'var(--card)', color: on ? PRIMARY : TEXT_SECONDARY })
const bigBtn = { width: '100%', padding: 15, borderRadius: 16, border: 'none', background: PRIMARY, color: '#fff', fontSize: 15, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }

function initialRange(ts, today, initial) {
  if (initial && initial.from && initial.to) return { n: 0, from: initial.from, to: initial.to > today ? today : initial.to }
  const r = ts && ts.share_range
  if (r && [3, 5, 7].includes(r.n)) return { n: r.n, from: addDaysStr(today, -(r.n - 1)), to: today }
  if (r && r.n === 0 && r.from && r.to && r.to <= today) return { n: 0, from: r.from, to: r.to }
  return { n: 7, from: addDaysStr(today, -6), to: today }
}

export default function ShareSheet({ userId, onClose, initial }) {
  const today = taipeiToday()
  const [profile, setProfile] = useState(null)
  const [range, setRange] = useState(null)
  const [showBv, setShowBv] = useState(true)
  const [say, setSay] = useState('')
  const [marks, setMarks] = useState(() => new Set())
  const [step, setStep] = useState('pick')
  const [view, setView] = useState(null) // { period, img, blob, ... }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    supabase.from('users').select('name,tag_settings,created_at').eq('id', userId).single().then(({ data }) => {
      if (!alive) return
      const ts = (data && data.tag_settings) || {}
      setProfile(data || {})
      setRange(initialRange(ts, today, initial))
      if (ts.share_bv === 0) setShowBv(false)
      if (typeof ts.share_say === 'string') setSay(ts.share_say)
    })
    return () => { alive = false }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  function quick(n) { setRange({ n, from: addDaysStr(today, -(n - 1)), to: today }) }
  function pick(from, to) {
    const n = [3, 5, 7].find(k => to === today && spanDays(from, to) === k) || 0
    setRange({ n, from, to })
  }
  async function onMonth(a, b) {
    const s = await loadActionDays(userId, a, b)
    setMarks(old => new Set([...old, ...s]))
  }

  async function next() {
    setStep('view'); setView(null); setMsg('')
    saveTagSetting(userId, { share_range: range.n ? { n: range.n } : { n: 0, from: range.from, to: range.to }, share_bv: showBv ? 1 : 0, share_say: say.trim() })
    const { from, to } = range
    const len = spanDays(from, to)
    const pTo = addDaysStr(from, -1), pFrom = addDaysStr(from, -len)
    const [cur, prev] = await Promise.all([loadPeriod(userId, from, to), loadPeriod(userId, pFrom, pTo)])
    const mode = resolveMode(profile.tag_settings, profile.created_at)
    const dots = dayDots(cur.days, cur.actions.perDay, mode, cur.results.met.map(m => m.date))
    const activeDays = dots.filter(d => d.s !== 'rest').length
    const curN = periodNumbers(cur)
    const highlight = pickHighlight({ cur: curN, prev: periodNumbers(prev), len, activeDays })
    const tiles = resultTiles(cur.results, { showBv })
    const anything = curN.fresh + curN.asks + curN.talk + activeDays > 0
    const name = (profile && profile.name) || ''
    const img = await renderShareCard({
      title: `${name ? name + ' 的' : ''}行動紀錄`,
      rangeText: `${rangeText(from, to)}，共 ${len} 天`,
      actions: [{ v: curN.talk, label: '互動（人次）' }, { v: curN.fresh, label: '新名單（位）' }, { v: curN.asks, label: '開口邀約（次）' }],
      tiles, emptyText: anything ? '這段時間在累積名單和互動' : '這段時間先休息了也沒關係',
      dots, fullLabel: `${mode.label} 做滿`, highlight, sayName: name || '我', say: say.trim(),
    })
    // 邀約評估事業的人：讀他們的互動，整理「怎麼走到這一步」
    let paths = []
    if (cur.results.bizPlanned.length) {
      const raw = await loadBizPaths(userId, cur.results.bizPlanned, to)
      const addedOf = id => { const c = raw.contacts.find(x => x.id === id); return c ? (c.added_date || (c.created_at ? new Date(c.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) : '')) : '' }
      paths = cur.results.bizPlanned.map(p => ({
        person: p,
        ...pathOf({ person: p, logs: raw.logs.filter(l => l.contact_id === p.id), addedOn: addedOf(p.id),
          metOn: (raw.meets.filter(m => m.contact_id === p.id && m.date >= p.date).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || {}).date || '' }),
      }))
    }
    setView({ cur, img, len, paths, from, to })
  }

  async function doShare() {
    if (!view || !view.img.blob || busy) return
    setBusy(true); setMsg('')
    const r = await shareOrDownload(view.img.blob, `unfranchise_${view.from}_${view.to}.png`)
    setBusy(false)
    if (r === 'downloaded') setMsg('圖片已經存好了，到 LINE 選這張圖片傳送就好。')
  }

  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return (
    <div className="shs" role="dialog" aria-label="分享成圖片，貼到群組" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1100 }}>
      <style>{'@media(min-width:1024px){.shs{align-items:center!important}.shs>.shs-box{border-radius:22px!important;max-height:90vh!important}}'}</style>
      <div className="shs-box" style={{ background: step === 'view' ? 'var(--page)' : 'var(--card)', borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 430,
        maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px' }}>
          {step === 'pick'
            ? <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_MAIN, margin: 0 }}>分享成圖片，貼到群組</h3>
            : <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: PRIMARY, fontSize: 15, cursor: 'pointer', padding: 0 }}>‹ 改日期</button>}
          <CloseBtn onClick={onClose} size={36} />
        </div>

        {!range ? <div style={{ padding: 40, textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>讀取中…</div> : step === 'pick' ? (
          <>
            <div style={{ overflowY: 'auto', padding: '4px 20px 12px' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[3, 5, 7].map(v => <button key={v} onClick={() => quick(v)} style={chip(range.n === v)}>最近{v}天</button>)}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_MAIN, margin: '14px 0 10px' }}>
                {rangeText(range.from, range.to)}<span style={{ fontWeight: 400, fontSize: 13, color: TEXT_SECONDARY, marginLeft: 6 }}>共 {spanDays(range.from, range.to)} 天</span>
              </div>
              <RangeCalendar from={range.from} to={range.to} today={today} onPick={pick} marks={marks} onMonth={onMonth} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '9px 12px',
                border: `1px solid ${BORDER}`, borderRadius: 14, fontSize: 13, fontWeight: 600, color: TEXT_MAIN }}>
                <span>圖片包含 BV、IBV</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowBv(true)} style={seg(showBv)}>開</button>
                  <button onClick={() => setShowBv(false)} style={seg(!showBv)}>關</button>
                </div>
              </div>
              <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: '14px 0 6px' }}>想跟大家說的一句話（選填）</p>
              <textarea value={say} onChange={e => setSay(e.target.value.slice(0, 80))} rows={2} aria-label="想跟大家說的一句話"
                placeholder="例如：這週的做法，或卡住想問大家的地方"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 14,
                  outline: 'none', resize: 'none', background: 'var(--card)', color: TEXT_MAIN, fontFamily: 'inherit', lineHeight: 1.6 }} />
              <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '4px 0 0' }}>這句話會出現在圖片上，請不要寫到別人的名字。</p>
            </div>
            <div style={{ padding: '10px 20px 22px', borderTop: `1px solid ${BORDER}` }}>
              <button onClick={next} style={bigBtn}>下一步：看圖片</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ overflowY: 'auto', padding: '4px 16px 12px' }}>
              {!view ? <div style={{ padding: 60, textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>正在整理圖片…</div> : (
                <>
                  <img src={view.img.url} alt="分享圖片預覽" style={{ width: '100%', display: 'block', borderRadius: 18 }} />
                  <Details view={view} />
                </>
              )}
            </div>
            <div style={{ padding: '10px 20px 22px', borderTop: `1px solid ${BORDER}`, background: 'var(--card)' }}>
              {msg && <p role="status" style={{ fontSize: 12, color: 'var(--green-text)', textAlign: 'center', margin: '0 0 8px' }}>{msg}</p>}
              <button onClick={doShare} disabled={!view || busy} style={{ ...bigBtn, opacity: view ? 1 : 0.5 }}>
                {touch ? <IconShare2 size={18} stroke={1.9} color="#fff" /> : <IconDownload size={18} stroke={1.9} color="#fff" />}
                {touch ? '分享' : '下載圖片'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// 你的細節：每個成果是誰、哪一天、什麼內容；邀約評估事業的人看得到「怎麼走到這一步」
function Details({ view }) {
  const r = view.cur.results
  const [open, setOpen] = useState({ bizPlanned: true })
  const [person, setPerson] = useState(null)
  const sum = pathSummary(view.paths)
  const sections = [
    { key: 'bizPlanned', title: '邀約評估事業', n: r.bizPlanned.length, unit: '位', rows: r.bizPlanned.map(p => ({ k: p.id, name: p.name, text: `${md(p.date)} 約成${p.label}`, id: p.id })) },
    { key: 'bizMet', title: '已評估事業', n: r.bizMet.length, unit: '位', rows: r.bizMet.map(p => ({ k: p.id, name: p.name, text: `${md(p.date)} ${p.label}` })) },
    { key: 'met', title: '已見面', n: r.met.length, unit: '位', rows: r.met.map((p, i) => ({ k: i, name: p.name, text: `${md(p.date)} ${p.label || '見完了'}` })) },
    { key: 'survey', title: '已給問卷或購物清單', n: r.surveyPeople, unit: '位', rows: r.survey.map((p, i) => ({ k: i, name: p.name, text: `${md(p.date)} ${p.what}` })) },
    { key: 'newCust', title: '新顧客', n: r.newCust.length, unit: '位', rows: r.newCust.map(p => ({ k: p.id, name: p.name, text: p.date ? `${md(p.date)} 新增` : '' })) },
    { key: 'bv', title: 'BV、IBV', n: r.bvLines.length, label: `BV ${r.bv}・IBV ${r.ibv}`, rows: r.bvLines.map((p, i) => ({ k: i, name: p.name || '沒有連到顧客', text: `${md(p.date)} ${p.product}\u3000${p.type} ${p.points}` })) },
  ].filter(s => s.n > 0)
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXT_SECONDARY }}>
        <IconLock size={14} stroke={2} />你的細節，只有你看得到，不會出現在圖片上
      </div>
      {sum.length > 0 && (
        <div style={{ background: 'var(--green-soft)', borderRadius: 12, padding: '10px 12px', fontSize: 13, color: 'var(--green-text)', lineHeight: 1.7, marginTop: 10 }}>
          <b>邀約評估事業的 {view.paths.length} 位：</b>
          {sum.map(t => <div key={t}>・{t}</div>)}
        </div>
      )}
      {sections.length === 0 && (
        <div style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '12px 14px', marginTop: 10, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.7 }}>
          這段時間還沒有成果，互動、新名單和邀約的數字都在圖片上。
        </div>
      )}
      {sections.map(s => (
        <div key={s.key} style={{ background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '4px 14px', marginTop: 10 }}>
          <button onClick={() => setOpen(o => ({ ...o, [s.key]: !o[s.key] }))} aria-expanded={!!open[s.key]}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN }}>{s.title}</span>
            <span style={{ fontSize: 12, color: TEXT_MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
              {s.label || `${s.n} ${s.unit}`}{open[s.key] ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </span>
          </button>
          {open[s.key] && s.rows.map((row, i) => {
            const path = s.key === 'bizPlanned' ? view.paths.find(p => p.person.id === row.id) : null
            const on = person === row.k && path
            return (
              <div key={row.k} style={{ borderTop: `1px solid ${BORDER}` }}>
                <button onClick={() => path && setPerson(on ? null : row.k)} disabled={!path}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', background: 'none', border: 'none',
                    cursor: path ? 'pointer' : 'default', textAlign: 'left', fontSize: 13.5, color: TEXT_MAIN }}>
                  <span style={{ flexShrink: 0 }}>{row.name}</span>
                  <span style={{ fontSize: 12.5, color: TEXT_SECONDARY, textAlign: 'right' }}>{row.text}{path ? (on ? ' ▴' : ' ›') : ''}</span>
                </button>
                {on && (
                  <div style={{ margin: '0 0 10px', padding: '2px 0 2px 12px', borderLeft: '2px solid var(--border2)', fontSize: 12.5, color: TEXT_SECONDARY, lineHeight: 1.9 }}>
                    {path.steps.map((st, j) => (
                      <div key={j}><b style={{ color: TEXT_MAIN, fontWeight: 600 }}>{md(st.date)}{st.to ? `–${md(st.to)}` : ''}</b>{'\u3000'}{st.text}</div>
                    ))}
                  </div>
                )}
                {i === s.rows.length - 1 && <div style={{ height: 4 }} />}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
