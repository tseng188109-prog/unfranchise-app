import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [referrerName, setReferrerName] = useState('')
  const [referrerPending, setReferrerPending] = useState('')
  const [editingReferrer, setEditingReferrer] = useState(false)
  const [newReferrerEmail, setNewReferrerEmail] = useState('')
  const [referrerMsg, setReferrerMsg] = useState('')

  // 密碼修改
  const [editingPassword, setEditingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      fetchProfile(user.id)
    })
  }, [])

  async function fetchProfile(uid) {
    const { data } = await supabase.from('users')
      .select('name,referrer_id,referrer_email_pending').eq('id', uid).single()
    if (!data) return
    setName(data.name)
    setReferrerPending(data.referrer_email_pending || '')
    if (data.referrer_id) {
      const { data: ref } = await supabase.from('users')
        .select('name').eq('id', data.referrer_id).single()
      if (ref) setReferrerName(ref.name)
    }
  }

  async function handleSaveName() {
    setSaving(true)
    await supabase.from('users').update({ name }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSaveReferrer() {
    setReferrerMsg('')
    if (!newReferrerEmail) { setReferrerMsg('請輸入推薦人 Email'); return }
    if (newReferrerEmail.toLowerCase() === user.email.toLowerCase()) {
      setReferrerMsg('不能填自己的 Email'); return
    }
    await supabase.from('users').update({
      referrer_email_pending: newReferrerEmail,
      referrer_id: null,
    }).eq('id', user.id)
    setReferrerPending(newReferrerEmail)
    setReferrerName('')
    setEditingReferrer(false)
    setReferrerMsg('')
    setNewReferrerEmail('')
  }

  async function handleSavePassword() {
    setPasswordMsg('')
    if (!newPassword) { setPasswordMsg('請輸入新密碼'); return }
    if (newPassword.length < 6) { setPasswordMsg('密碼至少 6 個字元'); return }
    if (newPassword !== confirmPassword) { setPasswordMsg('兩次密碼不一致'); return }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordMsg('修改失敗，請重新登入後再試')
    } else {
      setPasswordSaved(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setPasswordSaved(false)
        setEditingPassword(false)
      }, 2000)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2563EB)',
        padding:'52px 20px 24px' }}>
        <h1 style={{ fontSize:20,fontWeight:800,color:'#fff',margin:0 }}>設定</h1>
      </div>

      <div style={{ padding:'16px 16px',display:'flex',flexDirection:'column',gap:12 }}>

        {/* 帳號資訊 */}
        <div style={card}>
          <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:16 }}>
            <div style={{ width:52,height:52,borderRadius:'50%',background:'#2563EB',
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'#fff',fontWeight:800,fontSize:20 }}>
              {name?name[0]:user?.email?.[0]?.toUpperCase()||'U'}
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:'#111827',margin:0 }}>{name||'未設定名稱'}</p>
              <p style={{ fontSize:13,color:'#9CA3AF',margin:'2px 0 0' }}>{user?.email}</p>
            </div>
          </div>

          <label style={lb}>顯示名稱</label>
          <div style={{ display:'flex',gap:8 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="輸入名稱..."
              style={{ flex:1,padding:'10px 12px',borderRadius:10,border:'1px solid #E5E7EB',
                fontSize:14,outline:'none',color:'#111827' }} />
            <button onClick={handleSaveName} disabled={saving}
              style={{ padding:'10px 16px',borderRadius:10,border:'none',
                background:saved?'#22C55E':'#2563EB',color:'#fff',
                fontWeight:700,fontSize:13,cursor:'pointer' }}>
              {saved?'✓ 已存':'儲存'}
            </button>
          </div>
        </div>

        {/* 密碼修改 */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom: editingPassword?12:0 }}>
            <p style={{ fontSize:13,fontWeight:700,color:'#6B7280',margin:0 }}>帳號安全</p>
            <button onClick={() => { setEditingPassword(!editingPassword); setPasswordMsg(''); setNewPassword(''); setConfirmPassword('') }}
              style={{ fontSize:13,color:'#2563EB',background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
              {editingPassword ? '取消' : '修改密碼'}
            </button>
          </div>

          {editingPassword && (
            <div>
              <div style={{ marginBottom:12 }}>
                <label style={lb}>新密碼</label>
                <input
                  type="password"
                  placeholder="至少 6 個字元"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lb}>確認新密碼</label>
                <input
                  type="password"
                  placeholder="再輸入一次"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              {passwordMsg && (
                <p style={{ fontSize:12,color:'#EF4444',margin:'0 0 8px' }}>{passwordMsg}</p>
              )}
              <button onClick={handleSavePassword} disabled={passwordSaving}
                style={{ width:'100%',padding:'11px',borderRadius:10,border:'none',
                  background: passwordSaved?'#22C55E':passwordSaving?'#93C5FD':'#2563EB',
                  color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {passwordSaved ? '✓ 密碼已更新' : passwordSaving ? '更新中…' : '確認修改'}
              </button>
            </div>
          )}
        </div>

        {/* 推薦關係 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:700,color:'#6B7280',margin:'0 0 12px' }}>推薦關係</p>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
            <span style={{ fontSize:14,color:'#374151' }}>推薦人</span>
            <button onClick={() => { setEditingReferrer(!editingReferrer); setReferrerMsg('') }}
              style={{ fontSize:13,color:'#2563EB',background:'none',border:'none',
                cursor:'pointer',fontWeight:600 }}>
              {editingReferrer ? '取消' : '修改'}
            </button>
          </div>
          {!editingReferrer ? (
            <p style={{ fontSize:14,color: referrerName?'#111827':referrerPending?'#F59E0B':'#9CA3AF',
              margin:'4px 0 0',fontWeight: referrerName?600:400 }}>
              {referrerName || (referrerPending ? `待確認：${referrerPending}` : '尚未設定')}
            </p>
          ) : (
            <div style={{ marginTop:8 }}>
              <input type="email" placeholder="輸入推薦人 Email..."
                value={newReferrerEmail} onChange={e => setNewReferrerEmail(e.target.value)}
                style={{ ...inputStyle, marginBottom:8 }} />
              {referrerMsg && <p style={{ fontSize:12,color:'#EF4444',margin:'0 0 8px' }}>{referrerMsg}</p>}
              <p style={{ fontSize:11,color:'#9CA3AF',margin:'0 0 8px' }}>
                推薦人尚未註冊也沒關係，對方日後建立帳號後會自動串聯
              </p>
              <button onClick={handleSaveReferrer}
                style={{ width:'100%',padding:'10px',borderRadius:10,border:'none',
                  background:'#2563EB',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                儲存推薦人
              </button>
            </div>
          )}
        </div>

        {/* 其他功能入口 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:700,color:'#6B7280',margin:'0 0 8px' }}>功能</p>
          {[
            { label:'📋 互動名單', path:'/contacts' },
            { label:'📊 業績紀錄', path:'/transactions' },
            { label:'👥 顧客檔案', path:'/customers' },
            { label:'🧪 試用品追蹤', path:'/samples' },
            { label:'🤝 我的夥伴', path:'/partners' },
            { label:'🚀 戰隊', path:'/team' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ width:'100%',display:'flex',justifyContent:'space-between',
                alignItems:'center',padding:'12px 0',background:'none',border:'none',
                borderBottom:'1px solid #F3F4F6',cursor:'pointer',textAlign:'left' }}>
              <span style={{ fontSize:14,color:'#374151' }}>{item.label}</span>
              <span style={{ color:'#9CA3AF' }}>›</span>
            </button>
          ))}
        </div>

        {/* 登出 */}
        <button onClick={handleSignOut}
          style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
            background:'#FEF2F2',color:'#DC2626',fontSize:15,fontWeight:700,cursor:'pointer' }}>
          登出
        </button>

      </div>
    </div>
  )
}

const card = { background:'#fff',borderRadius:16,padding:16,boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }
const lb = { fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }
const inputStyle = {
  width:'100%',padding:'10px 12px',borderRadius:10,
  border:'1px solid #D1D5DB',fontSize:14,boxSizing:'border-box',
  outline:'none',color:'#111827',
}
