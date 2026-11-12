// WeekSummary.jsx — 一週總結（週五晚上的通知點進來；路徑 /week）
// 週五打開看「這一週」；其他天打開看「上一週」（週六早上點昨晚的通知也對得上）。
// 數字跟「給帶領者的報告」同一套算法（rhythm.js 的 weekStats）。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Bean } from './bean'
import { fetchAddedContacts } from './addedDate'
import { resolveMode, resolveWeeklyMet } from './dailyMode'
import { loadStreak } from './streakData'
import { twToday, dowOf, md, weekStats, weekSummaryText, summaryRange } from '../lib/rhythm'

const DOW = ['日', '一', '二', '三', '四', '五', '六']
const TILES = [
  { key: 'met', label: '見到', unit: '位', color: '#2F7A52' },
  { key: 'invites', label: '開口邀約', unit: '次', color: '#2457D6' },
  { key: 'fresh', label: '新名單', unit: '位', color: '#C9822B' },
  { key: 'streak', label: '連續行動', unit: '天', color: '#F08A3C' },
]

export default function WeekSummary() {
  const navigate = useNavigate()
  const [w, setW] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { start, end } = summaryRange(twToday())
      const [{ data: prof }, { data: meets }, { data: logs }, added, { data: checkins }, st] = await Promise.all([
        supabase.from('users').select('tag_settings,created_at').eq('id', user.id).single(),
        supabase.from('counter_logs').select('contact_id,date,planned_date,note').eq('user_id', user.id).eq('counter_key', 'meetup').eq('is_done', true).gte('date', start).lte('date', end),
        supabase.from('contact_logs').select('contact_id,date,kind').eq('user_id', user.id).gte('date', start).lte('date', end),
        fetchAddedContacts(supabase, { userId: user.id, from: start, to: end }),
        supabase.from('daily_checkins').select('date,task_key,is_done').eq('user_id', user.id).eq('task_key', 'daily_3_contacts').eq('is_done', true).gte('date', start).lte('date', end),
        loadStreak(user.id),
      ])
      const s = weekStats({ meets: meets || [], logs: logs || [], added: added || [], checkins: checkins || [] })
      const mode = resolveMode(prof && prof.tag_settings, prof && prof.created_at)
      const goal = resolveWeeklyMet(prof && prof.tag_settings)
      const most = [['互動', s.talk], ['開口邀約', s.invites], ['新名單', s.fresh], ['見面', s.met]].sort((a, b) => b[1] - a[1])[0]
      setW({ ...s, start, end, streak: st.streak.count, modeLabel: mode.label, goal, most: most[1] > 0 ? most[0] : '' })
    })()
  }, [])

  async function share() {
    const text = weekSummaryText(w)
    try {
      if (navigator.share) { await navigator.share({ text }); return }
    } catch { return /* 使用者按了取消 */ }
    try { await navigator.clipboard.writeText(text); setCopied('已複製，可以貼到 LINE 給推薦人') } catch { setCopied(text) }
  }

  const btn = { width: '100%', padding: 14, borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer' }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page)', display: 'flex', justifyContent: 'center', padding: '28px 20px 100px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {!w ? <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 80 }}>整理這一週…</div> : <>
          <Bean mood="cheer" size={120} />
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {md(w.start)}（{DOW[dowOf(w.start)]}）– {md(w.end)}（{DOW[dowOf(w.end)]}）
          </div>
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '4px 0 16px' }}>
            {w.met + w.invites + w.fresh > 0 ? '這一週，你做到了這些' : '這週先休息了也沒關係'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
            {TILES.map(t => (
              <div key={t.key} className="bean-pop" style={{ borderRadius: 14, border: `2px solid ${t.color}`, overflow: 'hidden', background: 'var(--card)', textAlign: 'center' }}>
                <div style={{ background: t.color, color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 0' }}>{t.label}</div>
                <div style={{ color: t.color, fontSize: 22, fontWeight: 700, padding: '8px 0' }}>{w[t.key]} {t.unit}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', fontSize: 14, color: 'var(--text)', lineHeight: 1.8, marginBottom: 20 }}>
            每天 {w.modeLabel} 做滿 <b>{w.fullDays} 天</b><br />
            每週目標：見到 {w.met}/{w.goal} 位{' '}
            <span style={{ color: w.met >= w.goal ? 'var(--green-text)' : 'var(--text2)', fontWeight: 600 }}>{w.met >= w.goal ? '達成' : `差 ${w.goal - w.met} 位`}</span>
            {w.most && <><br />這週最常做的是「{w.most}」</>}
          </div>
          <button onClick={() => navigate('/')} style={{ ...btn, border: 'none', background: 'var(--primary)', color: '#fff', boxShadow: '0 3px 0 #1A42A8' }}>下週繼續</button>
          <button onClick={share} style={{ ...btn, marginTop: 10, border: '1px solid var(--border2)', background: 'var(--card)', color: 'var(--primary)' }}>分享給推薦人</button>
          {copied && <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>{copied}</div>}
        </>}
      </div>
    </div>
  )
}
