import { useState } from 'react'
import { supabase } from '../supabase'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referrerEmail, setReferrerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin() {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setLoading(false)
  }

  async function handleRegister() {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          referrer_email: referrerEmail
        }
      }
    })
    if (error) setMessage(error.message)
    else setMessage('註冊成功！請確認您的信箱後登入。')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{
          color: '#ffffff',
          fontSize: '24px',
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: '8px'
        }}>超連鎖行動計畫</h1>
        <p style={{
          color: '#94a3b8',
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '32px'
        }}>Unfranchise Daily Work App</p>

        <div style={{
          display: 'flex',
          background: '#0f172a',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: isLogin ? '#3b82f6' : 'transparent',
              color: isLogin ? '#ffffff' : '#94a3b8',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>登入</button>
          <button
            onClick={() => setIsLogin(false)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              background: !isLogin ? '#3b82f6' : 'transparent',
              color: !isLogin ? '#ffffff' : '#94a3b8',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>註冊</button>
        </div>

        {!isLogin && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
              姓名 <span style={{ color: '#ef4444' }}>必填</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="輸入姓名"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }} />
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Email <span style={{ color: '#ef4444' }}>必填</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="輸入 Email"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '14px',
              boxSizing: 'border-box'
            }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            密碼 <span style={{ color: '#ef4444' }}>必填</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="輸入密碼"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '14px',
              boxSizing: 'border-box'
            }} />
        </div>

        {!isLogin && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
              推薦人 Email <span style={{ color: '#64748b' }}>選填</span>
            </label>
            <input
              type="email"
              value={referrerEmail}
              onChange={e => setReferrerEmail(e.target.value)}
              placeholder="輸入推薦人 Email"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }} />
          </div>
        )}

        {message && (
          <div style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: message.includes('成功') ? '#166534' : '#7f1d1d',
            color: message.includes('成功') ? '#86efac' : '#fca5a5',
            fontSize: '13px',
            marginBottom: '16px'
          }}>{message}</div>
        )}

        <button
          onClick={isLogin ? handleLogin : handleRegister}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: loading ? '#334155' : '#3b82f6',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}>
          {loading ? '處理中...' : isLogin ? '登入' : '註冊'}
        </button>
      </div>
    </div>
  )
}