import { useState } from 'react'
import { supabase } from '../supabase'
import {
  IconTarget, IconSpeakerphone, IconMessageCircle, IconBook,
  IconHeadphones, IconCamera, IconUsers, IconRobot,
} from '@tabler/icons-react'

const PRIMARY = '#1668E3'
const TEXT_MAIN = '#132A4D'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_GREEN = '#3ECF8E'

const STEPS = [
  'welcome',
  'name',
  'referrer',
  'why',
  'daily',
  'done',
]

const DAILY_ITEMS = [
  { Icon: IconTarget, key: 'goal_declaration',     label: '目標宣言',   desc: '每天讀一次你的 Why，讓自己記得為什麼出發' },
  { Icon: IconSpeakerphone, key: 'backend_announcement', label: '後台公告',   desc: '掌握最新團隊動態與公司資訊' },
  { Icon: IconMessageCircle, key: 'respond_social',       label: '回應社群',   desc: '在社群上與潛在名單保持連結與互動' },
  { Icon: IconBook, key: 'daily_practice',       label: '每日練習',   desc: '持續精進你的銷售與溝通技巧' },
  { Icon: IconHeadphones, key: 'listen_recording',     label: '聽錄音',     desc: '每天至少聽一份錄音，建立正確心態' },
  { Icon: IconCamera, key: 'ig_story',             label: 'IG 限動',    desc: '透過社群媒體讓更多人認識你的事業' },
  { Icon: IconUsers, key: 'daily_3_contacts',     label: '每日3互動', desc: '每天主動聯繫名單中的人，這是業績的根本' },
]

// 這份清單必須跟 Dashboard.jsx 的 STARTER_TASKS 完全一致，
// 不然新用戶在引導流程看到一份任務，進首頁又看到另一份，會搞不清楚狀況
const STARTER_TASK_LABELS = [
  '新增第一筆互動名單',
  '完成一次打卡',
  '一週內累積打卡 3 天',
  '新增第一筆互動紀錄',
  '設定你的目標宣言',
]

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [referrer, setReferrer] = useState('')
  const [why, setWhy] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeDaily, setActiveDaily] = useState(null)

  const totalSteps = STEPS.length
  const currentStep = STEPS[step]

  async function handleNext() {
    if (currentStep === 'name') {
      if (!name.trim()) return
      setSaving(true)
      await supabase.from('profiles').update({ name: name.trim() }).eq('id', user.id)
      await supabase.from('users').update({ name: name.trim() }).eq('id', user.id)
      setSaving(false)
    }

    if (currentStep === 'referrer' && referrer.trim()) {
      setSaving(true)
      // 用 email 找推薦人
      const { data } = await supabase
        .from('profiles').select('id').eq('email', referrer.trim()).single()
      if (data) {
        await supabase.from('users').update({ referrer_id: data.id }).eq('id', user.id)
      }
      setSaving(false)
    }

    if (currentStep === 'why') {
      if (!why.trim()) return
      setSaving(true)
      await supabase.from('users').update({ goal_declaration: why.trim() }).eq('id', user.id)
      setSaving(false)
    }

    if (currentStep === 'done') {
      setSaving(true)
      await supabase.from('users').update({ onboarding_done: true }).eq('id', user.id)
      setSaving(false)
      onComplete()
      return
    }

    setStep(s => s + 1)
  }

  function handleSkip() {
    setStep(s => s + 1)
  }

  const canNext =
    currentStep === 'welcome' ? true :
    currentStep === 'name' ? name.trim().length > 0 :
    currentStep === 'referrer' ? true :
    currentStep === 'why' ? why.trim().length > 0 :
    currentStep === 'daily' ? true :
    true

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1668E3 0%, #2E8FEA 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 20px 40px',
    }}>

      {/* 進度點 */}
      {step > 0 && step < totalSteps - 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {STEPS.slice(1, -1).map((s, i) => {
            const idx = i + 1
            const done = step > idx
            const active = step === idx
            return (
              <div key={s} style={{
                height: 6, borderRadius: 99,
                width: active ? 20 : 6,
                background: done ? ACCENT_GREEN : active ? '#fff' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
              }} />
            )
          })}
        </div>
      )}

      {/* 對話泡泡區 */}
      <div style={{
        width: '100%', maxWidth: 400,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* 機器人泡泡 */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><IconRobot size={19} stroke={1.9} color="#fff" /></div>
          <div style={{
            background: '#fff', borderRadius: '18px 18px 18px 4px',
            padding: '14px 16px', maxWidth: 300,
            boxShadow: '0 8px 24px rgba(19,42,77,0.18)',
          }}>
            {currentStep === 'welcome' && (
              <>
                <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, margin: '0 0 8px' }}>
                  歡迎加入超連鎖行動計畫！👋
                </p>
                <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
                  我是你的小助手，花 2 分鐘完成設定，讓 App 陪你從第一天就走在正確的軌道上。
                </p>
              </>
            )}
            {currentStep === 'name' && (
              <>
                <p style={{ fontSize: 14, color: TEXT_MAIN, margin: '0 0 4px', fontWeight: 700 }}>
                  先確認一下你的名字 😊
                </p>
                <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
                  這會顯示在你的個人頁面上
                </p>
              </>
            )}
            {currentStep === 'referrer' && (
              <>
                <p style={{ fontSize: 14, color: TEXT_MAIN, margin: '0 0 4px', fontWeight: 700 }}>
                  你的推薦人是誰？
                </p>
                <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
                  輸入推薦人的 Email，讓他/她能看到你的進度（可略過）
                </p>
              </>
            )}
            {currentStep === 'why' && (
              <>
                <p style={{ fontSize: 14, color: TEXT_MAIN, margin: '0 0 6px', fontWeight: 700 }}>
                  你為什麼加入美安？✍️
                </p>
                <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
                  寫下你的 Why 和目標，這就是你的目標宣言。遇到困難的時候，它會提醒你為什麼出發。
                </p>
              </>
            )}
            {currentStep === 'daily' && (
              <>
                <p style={{ fontSize: 14, color: TEXT_MAIN, margin: '0 0 6px', fontWeight: 700 }}>
                  這是你每天要做的 7 件事
                </p>
                <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
                  這不是 App 發明的，是美安官方起步指南要求的每日行動。點每一項看看為什麼要做。
                </p>
              </>
            )}
            {currentStep === 'done' && (
              <>
                <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, margin: '0 0 8px' }}>
                  設定完成！🎉
                </p>
                <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
                  接下來去新增你的第一批名單吧，起步指南說：第一週就要有首選 10 人名單！
                </p>
              </>
            )}
          </div>
        </div>

        {/* 輸入區 */}
        <div style={{ paddingLeft: 46 }}>

          {currentStep === 'name' && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="請輸入你的名字"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', borderRadius: 14,
                border: 'none', fontSize: 15,
                background: 'rgba(255,255,255,0.95)',
                color: TEXT_MAIN, outline: 'none',
                boxShadow: '0 4px 14px rgba(19,42,77,0.15)',
              }}
            />
          )}

          {currentStep === 'referrer' && (
            <input
              value={referrer}
              onChange={e => setReferrer(e.target.value)}
              placeholder="推薦人 Email（可略過）"
              type="email"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', borderRadius: 14,
                border: 'none', fontSize: 14,
                background: 'rgba(255,255,255,0.95)',
                color: TEXT_MAIN, outline: 'none',
                boxShadow: '0 4px 14px rgba(19,42,77,0.15)',
              }}
            />
          )}

          {currentStep === 'why' && (
            <textarea
              value={why}
              onChange={e => setWhy(e.target.value)}
              placeholder={'例如：我想在3年內財務自由，讓家人過更好的生活。\n我願意每週投入10小時，認真執行每日行動。'}
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', borderRadius: 14,
                border: 'none', fontSize: 13,
                background: 'rgba(255,255,255,0.95)',
                color: TEXT_MAIN, outline: 'none',
                resize: 'none', fontFamily: 'inherit',
                lineHeight: 1.7,
                boxShadow: '0 4px 14px rgba(19,42,77,0.15)',
              }}
            />
          )}

          {currentStep === 'daily' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DAILY_ITEMS.map(item => (
                <div key={item.key}>
                  <div
                    onClick={() => setActiveDaily(activeDaily === item.key ? null : item.key)}
                    style={{
                      background: activeDaily === item.key
                        ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
                      borderRadius: 12, padding: '10px 12px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                    <item.Icon size={18} stroke={1.9}
                      color={activeDaily === item.key ? PRIMARY : '#fff'} />
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: activeDaily === item.key ? TEXT_MAIN : '#fff',
                      flex: 1,
                    }}>{item.label}</span>
                    <span style={{
                      fontSize: 12,
                      color: activeDaily === item.key ? TEXT_SECONDARY : 'rgba(255,255,255,0.6)',
                    }}>{activeDaily === item.key ? '▲' : '▼'}</span>
                  </div>
                  {activeDaily === item.key && (
                    <div style={{
                      background: 'rgba(255,255,255,0.12)',
                      borderRadius: '0 0 12px 12px',
                      padding: '8px 12px 10px 40px',
                      marginTop: -2,
                    }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.6 }}>
                        {item.desc}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentStep === 'done' && (
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 14, padding: 14,
            }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', margin: '0 0 8px', fontWeight: 700 }}>
                你的新手起步任務
              </p>
              {STARTER_TASK_LABELS.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: '1.5px solid rgba(255,255,255,0.5)',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 按鈕區 */}
        <div style={{ paddingLeft: 46, display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={handleNext}
            disabled={!canNext || saving}
            style={{
              flex: 1, padding: '13px', borderRadius: 14, border: 'none',
              background: canNext ? '#fff' : 'rgba(255,255,255,0.3)',
              color: canNext ? PRIMARY : 'rgba(255,255,255,0.5)',
              fontWeight: 700, fontSize: 15, cursor: canNext ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}>
            {saving ? '儲存中…' :
              currentStep === 'welcome' ? '開始設定 →' :
              currentStep === 'done' ? '去新增名單 →' :
              '下一步 →'}
          </button>

          {(currentStep === 'referrer') && (
            <button
              onClick={handleSkip}
              style={{
                padding: '13px 16px', borderRadius: 14,
                border: '1.5px solid rgba(255,255,255,0.4)',
                background: 'transparent', color: 'rgba(255,255,255,0.7)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
              略過
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
