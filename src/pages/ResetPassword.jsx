import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Supabase 點開重設密碼連結後，會自動建立一個臨時 session（PASSWORD_RECOVERY 事件）
    // 用這個監聽確認連結有效，再允許使用者輸入新密碼
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true)
        setChecking(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    setMessage('')
    if (!password || password.length < 6) {
      setMessage('密碼至少需要 6 個字元'); return
    }
    if (password !== confirmPassword) {
      setMessage('兩次輸入的密碼不一致'); return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setMessage(error.message); return }
    setMessage('密碼已更新！正在跳轉…')
    setTimeout(() => navigate('/'), 1500)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid #334155', background: '#0f172a',
    color: '#ffffff', fontSize: '14px', boxSizing: 'border-box'
  }
  const labelStyle = { color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial, sans-serif', padding: 16
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700',
          textAlign: 'center', marginBottom: '8px' }}>重設密碼</h1>

        {checking ? (
          <p style={{ color:'#94a3b8', fontSize:14, textAlign:'center', marginTop:20 }}>
            驗證連結中…
          </p>
        ) : !ready ? (
          <div style={{ textAlign:'center', marginTop:20 }}>
            <p style={{ color:'#fca5a5', fontSize:14, marginBottom:16 }}>
              這個連結已失效或過期，請重新申請重設密碼。
            </p>
            <button onClick={() => navigate('/')}
              style={{ width:'100%', padding:'12px', borderRadius:'8px', border:'none',
                background:'#3b82f6', color:'#fff', fontSize:'15px',
                fontWeight:'600', cursor:'pointer' }}>
              回到登入頁
            </button>
          </div>
        ) : (
          <>
            <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', marginBottom:24 }}>
              請輸入你的新密碼
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>新密碼</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="至少 6 個字元" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>確認新密碼</label>
              <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
                placeholder="再輸入一次" style={inputStyle} />
            </div>

            {message && (
              <div style={{
                padding:'10px 12px', borderRadius:'8px', marginBottom:16,
                background: message.includes('更新') ? '#166534' : '#7f1d1d',
                color: message.includes('更新') ? '#86efac' : '#fca5a5',
                fontSize: 13
              }}>{message}</div>
            )}

            <button onClick={handleReset} disabled={loading}
              style={{ width:'100%', padding:'12px', borderRadius:'8px', border:'none',
                background: loading ? '#334155' : '#3b82f6', color:'#ffffff',
                fontSize:'15px', fontWeight:'600', cursor: loading?'not-allowed':'pointer' }}>
              {loading ? '更新中…' : '更新密碼'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
