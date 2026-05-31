import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Layout from './pages/Layout'
import Contacts from './pages/Contacts'
import ContactNew from './pages/ContactNew'
import ContactDetail from './pages/ContactDetail'
import ContactEdit from './pages/ContactEdit'
import Daily from './pages/Daily'
import Transactions from './pages/Transactions'
import TransactionNew from './pages/TransactionNew'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Settings from './pages/Settings'
import Samples from './pages/Samples'
import Partners from './pages/Partners'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#ffffff', fontSize: '16px'
    }}>載入中...</div>
  )

  if (!session) return <Auth />

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
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transactions/new" element={<TransactionNew />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App