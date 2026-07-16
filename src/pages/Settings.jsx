import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconClipboardList, IconChartBar, IconUsers, IconFlask, IconUsersGroup,
  IconFlag, IconChevronRight, IconCheck,
} from '@tabler/icons-react'

const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_GREEN = '#3ECF8E'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const ACCENT_YELLOW_SOFT = '#FFF7E6'
const DANGER = '#E0454A'
const DANGER_SOFT = '#FDE2E2'
const BORDER = '#F0F1F4'

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

  const FUNCTION_ITEMS = [
    { label:'互動名單', path:'/contacts', Icon: IconClipboardList },
    { label:'業績紀錄', path:'/transactions', Icon: IconChartBar },
    { label:'顧客檔案', path:'/customers', Icon: IconUsers },
    { label:'試用品追蹤', path:'/samples', Icon: IconFlask },
    { label:'我的夥伴', path:'/partners', Icon: IconUsersGroup },
    { label:'戰隊', path:'/team', Icon: IconFlag },
  ]

  return (
    <div style={{ background:'#fff',minHeight:'100vh',paddingBottom:80 }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div style={{ background:'linear-gradient(135deg,#1668E3,#2E8FEA)',
        padding:'52px 0 24px' }}>
        <div className="dash-container" style={{ padding:'0 20px' }}>
          <h1 style={{ fontSize:20,fontWeight:700,color:'#fff',margin:0 }}>設定</h1>
        </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px',display:'flex',flexDirection:'column',gap:12 }}>

        {/* 帳號資訊 */}
        <div style={card}>
          <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:16 }}>
            <div style={{ width:52,height:52,borderRadius:'50%',background:PRIMARY,
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'#fff',fontWeight:700,fontSize:20 }}>
              {name?name[0]:user?.email?.[0]?.toUpperCase()||'U'}
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:0 }}>{name||'未設定名稱'}</p>
              <p style={{ fontSize:13,color:TEXT_MUTED,margin:'2px 0 0' }}>{user?.email}</p>
            </div>
          </div>

          <label style={lb}>顯示名稱</label>
          <div style={{ display:'flex',gap:8 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="輸入名稱..."
              style={{ flex:1,padding:'10px 12px',borderRadius:12,border:`1px solid ${BORDER}`,
                fontSize:14,outline:'none',color:TEXT_MAIN }} />
            <button onClick={handleSaveName} disabled={saving}
              style={{ display:'flex',alignItems:'center',gap:4,padding:'10px 16px',borderRadius:12,border:'none',
                background:saved?ACCENT_GREEN:PRIMARY,color:'#fff',
                fontWeight:700,fontSize:13,cursor:'pointer' }}>
              {saved && <IconCheck size={14} stroke={2.4} />} {saved?'已存':'儲存'}
            </button>
          </div>
        </div>

        {/* 密碼修改 */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom: editingPassword?12:0 }}>
            <p style={{ fontSize:13,fontWeight:700,color:TEXT_SECONDARY,margin:0 }}>帳號安全</p>
            <button onClick={() => { setEditingPassword(!editingPassword); setPasswordMsg(''); setNewPassword(''); setConfirmPassword('') }}
              style={{ fontSize:13,color:PRIMARY,background:'none',border:'none',cursor:'pointer',fontWeight:700 }}>
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
                <p style={{ fontSize:12,color:DANGER,margin:'0 0 8px' }}>{passwordMsg}</p>
              )}
              <button onClick={handleSavePassword} disabled={passwordSaving}
                style={{ width:'100%',padding:'11px',borderRadius:12,border:'none',
                  background: passwordSaved?ACCENT_GREEN:passwordSaving?'#9BBBF2':PRIMARY,
                  color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {passwordSaved ? '✓ 密碼已更新' : passwordSaving ? '更新中…' : '確認修改'}
              </button>
            </div>
          )}
        </div>

        {/* 推薦關係 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:700,color:TEXT_SECONDARY,margin:'0 0 12px' }}>推薦關係</p>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
            <span style={{ fontSize:14,color:TEXT_MAIN }}>推薦人</span>
            <button onClick={() => { setEditingReferrer(!editingReferrer); setReferrerMsg('') }}
              style={{ fontSize:13,color:PRIMARY,background:'none',border:'none',
                cursor:'pointer',fontWeight:700 }}>
              {editingReferrer ? '取消' : '修改'}
            </button>
          </div>
          {!editingReferrer ? (
            <p style={{ fontSize:14,color: referrerName?TEXT_MAIN:referrerPending?ACCENT_YELLOW_TEXT:TEXT_MUTED,
              margin:'4px 0 0',fontWeight: referrerName?600:400 }}>
              {referrerName || (referrerPending ? `待確認：${referrerPending}` : '尚未設定')}
            </p>
          ) : (
            <div style={{ marginTop:8 }}>
              <input type="email" placeholder="輸入推薦人 Email..."
                value={newReferrerEmail} onChange={e => setNewReferrerEmail(e.target.value)}
                style={{ ...inputStyle, marginBottom:8 }} />
              {referrerMsg && <p style={{ fontSize:12,color:DANGER,margin:'0 0 8px' }}>{referrerMsg}</p>}
              <p style={{ fontSize:11,color:TEXT_MUTED,margin:'0 0 8px' }}>
                推薦人尚未註冊也沒關係，對方日後建立帳號後會自動串聯
              </p>
              <button onClick={handleSaveReferrer}
                style={{ width:'100%',padding:'10px',borderRadius:12,border:'none',
                  background:PRIMARY,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                儲存推薦人
              </button>
            </div>
          )}
        </div>

        {/* 其他功能入口 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:700,color:TEXT_SECONDARY,margin:'0 0 8px' }}>功能</p>
          {FUNCTION_ITEMS.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ width:'100%',display:'flex',alignItems:'center',gap:10,
                padding:'12px 0',background:'none',border:'none',
                borderBottom:`1px solid ${BORDER}`,cursor:'pointer',textAlign:'left' }}>
              <item.Icon size={17} stroke={1.9} color={PRIMARY} />
              <span style={{ fontSize:14,color:TEXT_MAIN,flex:1 }}>{item.label}</span>
              <IconChevronRight size={16} stroke={1.9} color={TEXT_MUTED} />
            </button>
          ))}
        </div>

        {/* 登出 */}
        <button onClick={handleSignOut}
          style={{ width:'100%',padding:'14px',borderRadius:14,border:'none',
            background:DANGER_SOFT,color:DANGER,fontSize:15,fontWeight:700,cursor:'pointer' }}>
          登出
        </button>

      </div>
    </div>
  )
}

const card = { background:'#fff',borderRadius:18,padding:16,border:`1px solid ${BORDER}` }
const lb = { fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'block',marginBottom:6 }
const inputStyle = {
  width:'100%',padding:'10px 12px',borderRadius:12,
  border:`1px solid ${BORDER}`,fontSize:14,boxSizing:'border-box',
  outline:'none',color:TEXT_MAIN,
}
