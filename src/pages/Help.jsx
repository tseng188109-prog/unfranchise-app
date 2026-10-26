// Help.jsx — 使用說明 + 回報問題
// 入口：設定 → 使用說明
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  IconArrowLeft, IconRocket, IconTarget, IconCalendarEvent, IconEgg, IconHelpCircle,
  IconChevronDown, IconChevronUp, IconCheck,
} from '@tabler/icons-react'
import { cardStyle } from './ui'
import { RADIUS } from './designTokens'

const SECTIONS = [
  {
    key: 'day1', title: '第一天先做這 3 件事', sub: '新手起步，5 分鐘', Icon: IconRocket, bg: 'var(--yellow-soft)', color: 'var(--yellow-text)',
    body: [
      '1. 新增第一位名單：底部「互動名單」→ 右上角「＋」，只要打名字就可以存。',
      '2. 記下第一筆互動：點進那個人的名字 → 往下找「記錄一筆新互動」→ 寫一句話 → 按「新增」。',
      '3. 完成第一次每日打卡：回到「首頁」→「今日打卡」→ 點方框打勾。',
      '做完這三件事，新手起步就會前進，後面的功能再慢慢用就好。',
    ],
  },
  {
    key: '312', title: '3-1-2 是什麼', sub: '每天只要做這三件事', Icon: IconTarget, bg: 'var(--primary-soft)', color: 'var(--primary)',
    body: [
      '3 位互動：今天找 3 個人聊聊近況，不用談生意。首頁會幫你挑，點名字進去記一下就好。',
      '1 個會議：今天約一個人見面或通話。首頁會挑最接近的那一位，按「約下一次」。',
      '2 位新名單：這週新認識兩位朋友，加進名單。',
      '不用每天都湊滿，今天有往前一步就很好。',
    ],
  },
  {
    key: 'meet', title: '見完面，怎麼記', sub: '興趣、約下一次、標籤', Icon: IconCalendarEvent, bg: 'var(--orange-soft)', color: 'var(--orange-text)',
    body: [
      '點進那位朋友的頁面，最上面有「下一次」卡，按「見完了，記一下」。',
      '只有「她有興趣嗎」一定要選：很有興趣、有點興趣、觀望中、沒興趣、看不出來。選了以後，會看到建議的下一步。',
      '「她說了什麼」寫一句她的原話就好，下次見面前，首頁會提醒你。',
      '「多記一點」可以選她在意什麼、她主動做了什麼，不想記就不用打開。想新增自己的標籤，按「＋自己加」。',
      '最後選「約下一次」要做什麼、哪一天，沒有定可以先空著。',
    ],
  },
  {
    key: 'egg', title: '茶葉蛋、荷包蛋、生雞蛋', sub: '還有大一到大四', Icon: IconEgg, bg: 'var(--green-soft)', color: 'var(--green-text)',
    body: [
      '這是用來判斷「這個人有多熟」和「他現在有沒有需求」，幫你決定用什麼方式接觸。',
      '熟悉度：生雞蛋＝不熟、荷包蛋＝半熟、茶葉蛋＝很熟。',
      '需求度：大一＝沒需求、大二＝小抱怨、大三＝想改變、大四＝有行動。',
      '兩個合起來，App 會建議你輕鬆互動、軟性活動、商機講座，或直接約時間深聊。這只是建議，怎麼做由你決定。',
    ],
  },
  {
    key: 'faq', title: '常見問題', sub: '忘記密碼、換手機、資料在哪', Icon: IconHelpCircle, bg: 'var(--pink-soft)', color: 'var(--pink-text)',
    body: [
      '忘記密碼：在登入頁按「忘記密碼」，輸入 Email，會寄一封重設信給你。',
      '想改密碼：底部「首頁」右上角齒輪進「設定」→「修改密碼」。',
      '換手機：用同一個 Email 和密碼登入，資料都在，不用搬。',
      '白天夜晚：「設定」→「外觀」，可以選跟隨手機、白天、夜晚。',
      '我的名單別人看得到嗎：聯絡人的內容只有你自己看得到。推薦你的人，只能看到你的打卡和業績進度。',
    ],
  },
]

function Feedback({ onBack }) {
  const [kind, setKind] = useState('看不懂怎麼用')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    if (!msg.trim()) { setErr('寫一句發生了什麼事'); return }
    setSending(true); setErr('')
    let page = ''
    try { page = sessionStorage.getItem('ufa_last_path') || '' } catch { /* ignore */ }
    const { error } = await supabase.from('feedback').insert({
      kind, message: msg.trim(), page, device: (navigator.userAgent || '').slice(0, 160),
    })
    setSending(false)
    if (error) { setErr('沒送成功，再按一次試試'); return }
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-soft)', color: 'var(--green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <IconCheck size={22} stroke={2} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>收到了</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, lineHeight: 1.6 }}>謝謝你告訴我們，我們會看。</div>
        <button onClick={onBack} style={{ marginTop: 16, border: 'none', background: 'var(--sub2)', color: 'var(--text)', borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>回到使用說明</button>
      </div>
    )
  }
  return (
    <div>
      <div style={{ ...cardStyle, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>是哪一種</div>
        {['看不懂怎麼用', '出錯了', '我有建議'].map(k => (
          <button key={k} onClick={() => setKind(k)}
            style={{ border: `1px solid ${kind === k ? 'var(--primary)' : 'var(--border2)'}`, background: kind === k ? 'var(--primary-soft)' : 'transparent',
              color: kind === k ? 'var(--primary)' : 'var(--text)', borderRadius: 999, padding: '6px 14px', fontSize: 13, margin: '0 6px 6px 0', cursor: 'pointer' }}>{k}</button>
        ))}
      </div>
      <div style={{ ...cardStyle, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>發生了什麼事</div>
        <textarea value={msg} onChange={e => { setMsg(e.target.value); setErr('') }} rows={4} placeholder="例如：按了存起來沒有反應"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', resize: 'none', lineHeight: 1.6 }} />
        {err && <div style={{ color: '#E0454A', fontSize: 13, marginTop: 6 }}>{err}</div>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '0 4px 8px', lineHeight: 1.6 }}>會自動帶上你在哪一頁、手機型號，不會帶任何姓名或聯絡人內容。</div>
      <button onClick={send} style={{ width: '100%', padding: 13, border: 'none', borderRadius: 14, background: 'var(--primary)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
        {sending ? '送出中…' : '送出'}
      </button>
    </div>
  )
}

export default function Help() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(null)
  const [view, setView] = useState('help') // help | feedback

  return (
    <div style={{ background: 'var(--page)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`.help-wrap{max-width:430px;margin:0 auto}@media(min-width:1024px){.help-wrap{max-width:720px}}`}</style>
      <div style={{ background: 'var(--hero)', padding: '52px 0 20px' }}>
        <div className="help-wrap" style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => (view === 'feedback' ? setView('help') : navigate(-1))} aria-label="返回"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <IconArrowLeft size={22} stroke={1.9} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>{view === 'feedback' ? '回報問題' : '使用說明'}</h1>
        </div>
      </div>
      <div className="help-wrap" style={{ padding: 16 }}>
        {view === 'feedback' ? <Feedback onBack={() => setView('help')} /> : (
          <>
            {SECTIONS.map(s => {
              const isOpen = open === s.key
              return (
                <div key={s.key} style={{ ...cardStyle, marginBottom: 8, overflow: 'hidden' }}>
                  <button onClick={() => setOpen(isOpen ? null : s.key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <s.Icon size={21} stroke={1.8} />
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{s.sub}</span>
                    </span>
                    {isOpen ? <IconChevronUp size={18} stroke={1.9} color="var(--muted)" /> : <IconChevronDown size={18} stroke={1.9} color="var(--muted)" />}
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px 16px', borderTop: '1px solid var(--border)' }}>
                      {s.body.map((t, i) => (
                        <p key={i} style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)', margin: '10px 0 0' }}>{t}</p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ background: 'var(--primary-soft)', borderRadius: RADIUS.lg, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>找不到答案？</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>告訴我們，我們會看</span>
              </span>
              <button onClick={() => setView('feedback')}
                style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>回報問題</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
