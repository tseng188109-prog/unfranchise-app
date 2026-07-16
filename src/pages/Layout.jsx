import { useNavigate, useLocation } from 'react-router-dom'
import {
  IconHome2, IconUsers, IconChartBar, IconMail, IconCheck,
  IconFlag, IconSettings,
} from '@tabler/icons-react'

const TABS = [
  { path: '/',             Icon: IconHome2,  label: '首頁'     },
  { path: '/contacts',     Icon: IconUsers,  label: '互動名單' },
  { path: '/transactions', Icon: IconChartBar, label: '業績'   },
  { path: '/customers',    Icon: IconMail,   label: '顧客'     },
  { path: '/daily',        Icon: IconCheck,  label: '每日行動' },
]

const SECONDARY_TABS = [
  { path: '/team',     Icon: IconFlag,     label: '戰隊' },
  { path: '/settings', Icon: IconSettings, label: '設定' },
]

const SIDEBAR_WIDTH = 220

// 設計系統色碼
const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path) =>
    pathname === path || (path !== '/' && pathname.startsWith(path))

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
        .rwd-sidebar { display: none; }
        .rwd-bottomnav { display: flex; }
        .rwd-content { padding-bottom: 64px; }
        @media (min-width: 1024px) {
          .rwd-sidebar { display: flex; }
          .rwd-bottomnav { display: none; }
          .rwd-content { padding-bottom: 0; margin-left: ${SIDEBAR_WIDTH}px; }
        }
      `}</style>

      {/* 電腦版左側固定選單 */}
      <div className="rwd-sidebar" style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH,
        background: '#fff', borderRight: '1px solid #F0F1F4',
        flexDirection: 'column', zIndex: 100,
      }}>
        <div style={{
          padding: '20px 16px', fontSize: 16, fontWeight: 700, color: TEXT_MAIN,
          borderBottom: '1px solid #F0F1F4',
        }}>
          超連鎖行動計畫
        </div>

        <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(tab => {
            const active = isActive(tab.path)
            const Icon = tab.Icon
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12, border: 'none',
                  background: active ? PRIMARY_SOFT : 'transparent',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                <Icon size={19} stroke={1.75} color={active ? PRIMARY : TEXT_MUTED} />
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 600,
                  color: active ? PRIMARY : TEXT_MAIN }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{
          padding: '8px', borderTop: '1px solid #F0F1F4',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {SECONDARY_TABS.map(tab => {
            const active = isActive(tab.path)
            const Icon = tab.Icon
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12, border: 'none',
                  background: active ? PRIMARY_SOFT : 'transparent',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                <Icon size={19} stroke={1.75} color={active ? PRIMARY : TEXT_MUTED} />
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 600,
                  color: active ? PRIMARY : TEXT_MAIN }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 內容區 */}
      <div className="rwd-content">
        {children}
      </div>

      {/* 手機版底部選單 */}
      <div className="rwd-bottomnav" style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: '#fff', borderTop: '1px solid #F0F1F4',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map(tab => {
          const active = isActive(tab.path)
          const Icon = tab.Icon
          return (
            <button key={tab.path} onClick={() => navigate(tab.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '8px 0', border: 'none',
                background: 'none', cursor: 'pointer',
              }}>
              <Icon size={21} stroke={1.75} color={active ? PRIMARY : TEXT_MUTED} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 600,
                color: active ? PRIMARY : TEXT_MUTED }}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
