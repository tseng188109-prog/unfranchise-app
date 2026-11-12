import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Layout from './pages/Layout'
import Contacts from './pages/Contacts'
import ContactNew from './pages/ContactNew'
import ContactDetail from './pages/ContactDetail'
import ContactEdit from './pages/ContactEdit'
import Daily from './pages/Daily'
import Report from './pages/Report'
import Transactions from './pages/Transactions'
import TransactionNew from './pages/TransactionNew'
import Customers from './pages/Customers'
import CustomerNew from './pages/CustomerNew'
import CustomerDetail from './pages/CustomerDetail'
import CustomerEdit from './pages/CustomerEdit'
import Settings from './pages/Settings'
import Samples from './pages/Samples'
import Partners from './pages/Partners'
import Team from './pages/Team'
import Activities from './pages/Activities'
import Help from './pages/Help'
import DailyPractice from './pages/DailyPractice'
import Recording from './pages/Recording'
import Onboarding from './pages/Onboarding'
import Admin from './pages/Admin'
import WeekSummary from './pages/WeekSummary'
import ForcePassword from './pages/forcePassword'
import { needsPasswordChange } from './pages/passwordFlag'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboardingDone, setOnboardingDone] = useState(true)
  // 用管理員給的臨時密碼登入的人，要先換密碼
  const [mustChangePw, setMustChangePw] = useState(false)

  const isResetPasswordPath = window.location.pathname.startsWith('/reset-password')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkOnboarding(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        // 換完密碼（USER_UPDATED）時不要再查「要不要換密碼」，避免剛換好又被擋回去
        checkOnboarding(session.user.id, event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkOnboarding(userId, checkPw = true) {
    const [{ data }, mustChange] = await Promise.all([
      supabase.from('users').select('onboarding_done').eq('id', userId).single(),
      checkPw ? needsPasswordChange(userId) : Promise.resolve(null),
    ])
    setOnboardingDone(data?.onboarding_done === true)
    if (mustChange !== null) setMustChangePw(mustChange)
    setLoading(false)
  }

  function handleOnboardingComplete() {
    setOnboardingDone(true)
  }

  if (isResetPasswordPath) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/reset-password" />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--text)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#ffffff', fontSize: '16px'
    }}>載入中...</div>
  )

  if (!session) return <Auth />

  if (mustChangePw) return <ForcePassword onDone={() => setMustChangePw(false)} />

  if (!onboardingDone) return (
    <Onboarding
      user={session.user}
      onComplete={handleOnboardingComplete}
    />
  )

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/new" element={<ContactNew />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/contacts/:id/edit" element={<ContactEdit />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/report" element={<Report />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transactions/new" element={<TransactionNew />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/new" element={<CustomerNew />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/customers/:id/edit" element={<CustomerEdit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/team" element={<Team />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/help" element={<Help />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/week" element={<WeekSummary />} />
          <Route path="/daily-practice" element={<DailyPractice />} />
          <Route path="/recording" element={<Recording />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
