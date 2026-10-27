// 試做（Trail Run）：照官方 7 步驟，把「第 7 步＝再找下一位」做成每位聯絡人各自的試做，所以卡片上只列 6 步。
// 資料放在 trial_runs：started_on 是第 1 步的日期，steps 是 {"1":"2026-10-27", ...} 做完的日期。
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { askConfirm } from './confirmDialog'
import { IconCircleCheck, IconCircle } from '@tabler/icons-react'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS,
} from './designTokens'

export const TRIAL_STEPS = [
  { n: 1, title: '開始三天的試用品問卷', hint: '把愛尚它®每日精選組合隨身包交給他，請他用三天並填問卷。' },
  { n: 2, title: '他挑了 2–4 位朋友', hint: '請他挑 2–4 位朋友，也一起做三天問卷。' },
  { n: 3, title: '第三天聯繫、跟進', hint: '當面或用視訊問跟進的問題，並促成一次購買（例如一瓶愛尚它®綜合維生素粉末）。' },
  { n: 4, title: '完成居家購物清單', hint: '陪他把居家購物清單填完，看看他還有哪些日常用品可以換。' },
  { n: 5, title: '列出最親近的 10–20 人', hint: '請他列出最親近的 10–20 位熟人，下一輪試做就從這份名單開始。' },
  { n: 6, title: '他介紹 5 位以上顧客', hint: '如果他能介紹 5 位以上的顧客，也願意把其中一些介紹給你和資深夥伴，他就可以決定這個事業適不適合自己。' },
]

function toDateStr(d) { return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
export function todayTaipei() { return toDateStr(new Date()) }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
function md(dateStr) {
  if (!dateStr) return ''
  const p = dateStr.split('-')
  return `${Number(p[1])}/${Number(p[2])}`
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00+08:00') - new Date(a + 'T00:00:00+08:00')) / 86400000)
}

// 首頁橫條用：第三天到了、第 3 步還沒做的試做
export async function fetchTrialStrips(userId, contacts) {
  try {
    const { data } = await supabase.from('trial_runs')
      .select('contact_id,started_on,steps').eq('user_id', userId)
    const t = todayTaipei()
    const byId = {}
    ;(contacts || []).forEach(c => { byId[c.id] = c })
    return (data || [])
      .filter(r => byId[r.contact_id] && !(r.steps && r.steps['3']) && t >= addDays(r.started_on, 2) && daysBetween(r.started_on, t) <= 30)
      .map(r => {
        const day = daysBetween(r.started_on, t) + 1
        return {
          contactId: r.contact_id,
          name: byId[r.contact_id].name,
          text: day === 3 ? `${byId[r.contact_id].name} 試做第三天，去聯繫他` : `${byId[r.contact_id].name} 試做已經第 ${day} 天，還沒跟進`,
        }
      })
      .slice(0, 2)
  } catch { return [] }
}

export default function TrialRunCard({ contact, userId }) {
  const [run, setRun] = useState(undefined) // undefined = 讀取中，null = 還沒開始
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await supabase.from('trial_runs')
          .select('id,started_on,steps').eq('contact_id', contact.id).maybeSingle()
        if (alive) setRun(data || null)
      } catch { if (alive) setRun(null) }
    })()
    return () => { alive = false }
  }, [contact.id])

  async function start() {
    if (busy) return
    setBusy(true)
    const t = todayTaipei()
    const { data, error } = await supabase.from('trial_runs')
      .insert({ user_id: userId, contact_id: contact.id, started_on: t, steps: { '1': t } })
      .select('id,started_on,steps').single()
    if (!error && data) setRun(data)
    setBusy(false)
  }

  async function toggle(n) {
    if (!run || busy) return
    setBusy(true)
    const steps = { ...(run.steps || {}) }
    if (steps[String(n)]) delete steps[String(n)]
    else steps[String(n)] = todayTaipei()
    const { error } = await supabase.from('trial_runs').update({ steps }).eq('id', run.id)
    if (!error) setRun({ ...run, steps })
    setBusy(false)
  }

  async function remove() {
    if (!run || busy) return
    if (!(await askConfirm({ title: '移除這個試做？', message: '已經打的勾會一起清掉，之後可以重新開始。', okText: '移除', danger: true }))) return
    setBusy(true)
    const { error } = await supabase.from('trial_runs').delete().eq('id', run.id)
    if (!error) setRun(null)
    setBusy(false)
  }

  if (run === undefined) return null

  const card = { background: 'var(--card)', border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, padding: '12px 14px', marginBottom: 14 }

  if (run === null) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600 }}>試做</div>
          <div style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 2, lineHeight: 1.5 }}>
            請 {contact.name} 用三天試用品，再一步步帶他做完。
          </div>
        </div>
        <button onClick={start} disabled={busy}
          style={{ border: 'none', background: PRIMARY_SOFT, color: PRIMARY, borderRadius: RADIUS.sm, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          開始試做
        </button>
      </div>
    )
  }

  const steps = run.steps || {}
  const doneCount = TRIAL_STEPS.filter(s => steps[String(s.n)]).length
  const next = TRIAL_STEPS.find(s => !steps[String(s.n)])
  const t = todayTaipei()
  const day3 = addDays(run.started_on, 2)

  let nextTitle = '', nextText = ''
  if (!next) {
    nextTitle = '6 步都做完了'
    nextText = '可以到下一位聯絡人，開始新的試做。'
  } else if (next.n === 3) {
    if (t < day3) { nextTitle = `下一步：${md(day3)} 第三天聯繫他`; nextText = next.hint }
    else { nextTitle = '下一步：第三天了，聯繫他'; nextText = next.hint }
  } else {
    nextTitle = `下一步：${next.title}`
    nextText = next.hint
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_MAIN }}>試做</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>{doneCount}/6</span>
      </div>
      <div style={{ height: 6, background: 'var(--sub)', borderRadius: 3, marginTop: 8 }}>
        <div style={{ width: `${Math.round(doneCount / 6 * 100)}%`, height: 6, background: PRIMARY, borderRadius: 3 }} />
      </div>
      <div style={{ background: PRIMARY_SOFT, borderRadius: RADIUS.sm, padding: '10px 12px', marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>{nextTitle}</div>
        <div style={{ fontSize: 12, color: PRIMARY, marginTop: 2, lineHeight: 1.6 }}>{nextText}</div>
      </div>
      <div style={{ marginTop: 6 }}>
        {TRIAL_STEPS.map(s => {
          const doneOn = steps[String(s.n)]
          const isNext = next && next.n === s.n
          return (
            <button key={s.n} onClick={() => toggle(s.n)} disabled={busy}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: s.n < 6 ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
              {doneOn
                ? <IconCircleCheck size={22} stroke={1.8} color="var(--green-text)" />
                : <IconCircle size={22} stroke={1.8} color={isNext ? PRIMARY : TEXT_MUTED} />}
              <span style={{ flex: 1, fontSize: 14, fontWeight: isNext ? 600 : 400, color: doneOn || isNext ? TEXT_MAIN : TEXT_SECONDARY }}>
                {s.n}　{s.title}
              </span>
              <span style={{ fontSize: 12, color: isNext && s.n === 3 ? PRIMARY : TEXT_MUTED }}>
                {doneOn ? md(doneOn) : (s.n === 3 ? md(day3) : '')}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>點一個步驟就打勾，再點一次取消。</span>
        <button onClick={remove} disabled={busy}
          style={{ fontSize: 11, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          不做了，移除
        </button>
      </div>
    </div>
  )
}
