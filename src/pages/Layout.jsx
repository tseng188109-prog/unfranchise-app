import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/',             icon: '⌂',  label: '首頁'     },
  { path: '/contacts',     icon: '☰',  label: '互動名單' },
  { path: '/transactions', icon: '▦',  label: '業績'     },
  { path: '/customers',    icon: '✉',  label: '顧客'     },
  { path: '/daily',        icon: '✓',  label: '每日行動' },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div style={{ paddingBottom: 64 }}>
        {children}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: '#fff', borderTop: '1px solid #E5E7EB',
        display: 'flex', zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map(tab => {
          const active = pathname === tab.path ||
            (tab.path !== '/' && pathname.startsWith(tab.path))
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