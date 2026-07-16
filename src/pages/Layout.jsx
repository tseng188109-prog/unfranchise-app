import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/',             icon: '⌂',  label: '首頁'     },
  { path: '/contacts',     icon: '☰',  label: '互動名單' },
  { path: '/transactions', icon: '▦',  label: '業績'     },
  { path: '/customers',    icon: '✉',  label: '顧客'     },
  { path: '/daily',        icon: '✓',  label: '每日行動' },
]

const SECONDARY_TABS = [
  { path: '/team',     icon: '⚑', label: '戰隊' },
  { path: '/settings', icon: '⚙', label: '設定' },
]

const SIDEBAR_WIDTH = 220

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path) =>
    pathname === path || (path !== '/' && pathname.startsWith(path))

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <style>{`
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
        background: '#fff', borderRight: '1px solid #E5E7EB',
        flexDirection: 'column', zIndex: 100,
      }}>
        <div style={{
          padding: '20px 16px', fontSize: 16, fontWeight: 700, color: '#111827',
          borderBottom: '1px solid #F3F4F6',
        }}>
          超連鎖行動計畫
        </div>

        <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(tab => {
            const active = isActive(tab.path)
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: active ? '#EFF6FF' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                <span style={{ fontSize: 18, lineHeight: 1, color: active ? '#2563EB' : '#6B7280' }}>
                  {tab.icon}
                </span>
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 500,
                  color: active ? '#2563EB' : '#374151' }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{
          padding: '8px', borderTop: '1px solid #F3F4F6',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {SECONDARY_TABS.map(tab => {
            const active = isActive(tab.path)
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: active ? '#EFF6FF' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                <span style={{ fontSize: 18, lineHeight: 1, color: active ? '#2563EB' : '#6B7280' }}>
                  {tab.icon}
                </span>
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 500,
                  color: active ? '#2563EB' : '#374151' }}>
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
        background: '#fff', borderTop: '1px solid #E5E7EB',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map(tab => {
          const active = isActive(tab.path)
          return (
            <button key={tab.path} onClick={() => navigate(tab.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '8px 0', border: 'none',
                background: 'none', cursor: 'pointer',
              }}>
              <span style={{ fontSize: 20, lineHeight: 1, color: active ? '#2563EB' : '#9CA3AF' }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400,
                color: active ? '#2563EB' : '#9CA3AF' }}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
