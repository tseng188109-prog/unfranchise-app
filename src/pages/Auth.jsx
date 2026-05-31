import { useState } from 'react'
import { supabase } from '../supabase'

export default function Auth() {
  const [mode, setMode] = useState('login') // login | register | forgot
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referrerEmail, setReferrerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin() {
    setLoading(true); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setLoading(false)
  }

  async function handleRegister() {
    setLoading(true); setMessage('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, referrer_email: referrerEmail } }
    })
    if (error) setMessage(error.message)
    else setMessage('註冊成功！請確認您的信箱後登入。')
    setLoading(false)
  }

  async function handleForgot() {
    setLoading(true); setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setMessage(error.message)
    else setMessage('重設密碼連結已寄出，請檢查信箱！')
    setLoading(false)
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
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700',
          textAlign: 'center', marginBottom: '8px' }}>超連鎖行動計畫</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center',
          marginBottom: '32px' }}>Unfranchise Daily Work App</p>

        {/* 登入 / 註冊 切換（忘記密碼時隱藏） */}
        {mode !== 'forgot' && (
          <div style={{ display:'flex', background:'#0f172a', borderRadius:'8px',
            padding:'4px', marginBottom:'24px' }}>
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setMessage('') }}
                style={{ flex:1, padding:'8px', borderRadius:'6px', border:'none',
                  background: mode===m ? '#3b82f6' : 'transparent',
                  color: mode===m ? '#ffffff' : '#94a3b8',
                  fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>
                {m === 'login' ? '登入' : '註冊'}
              </button>
            ))}
          </div>
        )}

        {/* 忘記密碼標題 */}
        {mode === 'forgot' && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ color:'#fff', fontWeight:700, fontSize:16, margin:'0 0 4px' }}>重設密碼</p>
            <p style={{ color:'#94a3b8', fontSize:13, margin:0 }}>輸入你的 Email，我們會寄重設連結給你</p>
          </div>
        )}

        {/* 姓名（只有註冊） */}
        {mode === 'register' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>姓名 <span style={{ color:'#ef4444' }}>必填</span></label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)}
              placeholder="輸入姓名" style={inputStyle} />
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email <span style={{ color:'#ef4444' }}>必填</span></label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="輸入 Email" style={inputStyle} />
        </div>

        {/* 密碼（忘記密碼時隱藏） */}
        {mode !== 'forgot' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>密碼 <span style={{ color:'#ef4444' }}>必填</span></label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="輸入密碼" style={inputStyle} />
          </div>
        )}

        {/* 推薦人（只有註冊） */}
        {mode === 'register' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>推薦人 Email <span style={{ color:'#64748b' }}>選填</span></label>
            <input type="email" value={referrerEmail} onChange={e=>setReferrerEmail(e.target.value)}
              placeholder="輸入推薦人 Email" style={inputStyle} />
          </div>
        )}

        {/* 忘記密碼連結（只有登入） */}
        {mode === 'login' && (
          <div style={{ textAlign:'right', marginBottom: 16, marginTop: -8 }}>
            <button onClick={() => { setMode('forgot'); setMessage('') }}
              style={{ background:'none', border:'none', color:'#3b82f6',
                fontSize:13, cursor:'pointer', padding:0 }}>
              忘記密碼？
            </button>
          </div>
        )}

        {/* 訊息 */}
        {message && (
          <div style={{
            padding:'10px 12px', borderRadius:'8px', marginBottom:16,
            background: message.includes('成功') || message.includes('寄出') ? '#166534' : '#7f1d1d',
            color: message.includes('成功') || message.includes('寄出') ? '#86efac' : '#fca5a5',
            fontSize: 13
          }}>{message}</div>
        )}

        {/* 主按鈕 */}
        <button
          onClick={mode==='login'?handleLogin:mode==='register'?handleRegister:handleForgot}
          disabled={loading}
          style={{ width:'100%', padding:'12px', borderRadius:'8px', border:'none',
            background: loading ? '#334155' : '#3b82f6', color:'#ffffff',
            fontSize:'15px', fontWeight:'600', cursor: loading?'not-allowed':'pointer' }}>
          {loading ? '處理中...' : mode==='login' ? '登入' : mode==='register' ? '註冊' : '寄出重設連結'}
        </button>

        {/* 返回登入（忘記密碼時） */}
        {mode === 'forgot' && (
          <button onClick={() => { setMode('login'); setMessage('') }}
            style={{ width:'100%', marginTop:12, padding:'10px', borderRadius:'8px',
              border:'1px solid #334155', background:'none', color:'#94a3b8',
              fontSize:14, cursor:'pointer' }}>
            返回登入
          </button>
        )}
      </div>
    </div>
  )
}