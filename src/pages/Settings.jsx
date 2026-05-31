import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      fetchProfile(user.id)
    })
  }, [])

  async function fetchProfile(uid) {
    const { data } = await supabase.from('users').select('name').eq('id', uid).single()
    if (data) setName(data.name)
  }

  async function handleSaveName() {
    setSaving(true)
    await supabase.from('users').update({ name }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      {/* Header */}
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

        {/* 其他功能入口 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:700,color:'#6B7280',margin:'0 0 8px' }}>功能</p>
          {[
  { label:'📋 互動名單', path:'/contacts' },
  { label:'📊 業績紀錄', path:'/transactions' },
  { label:'👥 顧客檔案', path:'/customers' },
  { label:'🧪 試用品追蹤', path:'/samples' },
  { label:'🤝 我的夥伴', path:'/partners' },
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