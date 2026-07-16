import { useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

export default function CustomerNew() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', occupation: '',
    birthday: '', carrier: '', address: '', email: '',
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setForm(p => ({ ...p, [key]: val }))
    setErrors(e => ({ ...e, [key]: '', _ref: '' }))
  }

  async function handleSave() {
    const errs = {}
    if (!form.name.trim()) errs.name = '姓名為必填'

    // 手機、生日、職業至少填一個
    if (!form.phone.trim() && !form.birthday.trim() && !form.occupation.trim()) {
      errs._ref = '請至少填寫手機、生日或職業其中一項，以便日後識別顧客'
    }

    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('customers').insert({
      user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      occupation: form.occupation.trim() || null,
      birthday: form.birthday.trim() || null,
      carrier: form.carrier.trim() || null,
      address: form.address.trim() || null,
      email: form.email.trim() || null,
    })
    setSaving(false)
    if (!error) navigate('/customers')
  }

  const fields = [
    { key:'name',       label:'姓名',         req: true,  placeholder:'輸入姓名...' },
    { key:'phone',      label:'手機',         ref: true,  placeholder:'輸入手機...' },
    { key:'birthday',   label:'生日',         ref: true,  type:'text', placeholder:'MM-DD，例如 03-15' },
    { key:'occupation', label:'職業',         ref: true,  placeholder:'輸入職業...' },
    { key:'carrier',    label:'電子發票載具',              placeholder:'輸入載具...' },
    { key:'address',    label:'地址',                      placeholder:'輸入地址...' },
    { key:'email',      label:'Email',        type:'email', placeholder:'輸入 Email...' },
  ]

  const hasRef = form.phone.trim() || form.birthday.trim() || form.occupation.trim()

  return (
    <div style={{ background:'#F8FAFC', minHeight:'100vh' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div style={{ background:'#fff', padding:'52px 0 16px',
        borderBottom:'1px solid #F3F4F6' }}>
      <div className="dash-container" style={{ padding:'0 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#374151' }}>←</button>
        <h1 style={{ fontSize:18, fontWeight:800, color:'#111827', margin:0 }}>新增顧客</h1>
      </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px 100px' }}>

        {/* 參照欄位提示 */}
        <div style={{ background:'#EFF6FF', borderRadius:10, padding:'10px 14px',
          marginBottom:16, border:'1px solid #BFDBFE' }}>
          <p style={{ fontSize:12, color:'#1D4ED8', margin:0, lineHeight:1.6 }}>
            📌 除姓名外，請至少填寫 <strong>手機、生日、職業</strong> 其中一項，方便日後區分同名顧客
          </p>
        </div>

        {fields.map(f => (
          <div key={f.key} style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, fontWeight:600, color:'#374151',
              display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
              {f.label}
              {f.req && <span style={{ color:'#EF4444' }}>*</span>}
              {f.ref && (
                <span style={{
                  fontSize:10, padding:'1px 6px', borderRadius:99,
                  background: hasRef && (
                    (f.key==='phone' && form.phone.trim()) ||
                    (f.key==='birthday' && form.birthday.trim()) ||
                    (f.key==='occupation' && form.occupation.trim())
                  ) ? '#DCFCE7' : '#FEF9C3',
                  color: hasRef && (
                    (f.key==='phone' && form.phone.trim()) ||
                    (f.key==='birthday' && form.birthday.trim()) ||
                    (f.key==='occupation' && form.occupation.trim())
                  ) ? '#16A34A' : '#CA8A04',
                  fontWeight:600,
                }}>識別用</span>
              )}
            </label>
            <input
              type={f.type || 'text'}
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder || ''}
              style={{ width:'100%', padding:'11px 12px', borderRadius:10,
                border:`1px solid ${errors[f.key] ? '#EF4444' : '#E5E7EB'}`,
                fontSize:14, background:'#fff', boxSizing:'border-box',
                outline:'none', color:'#111827' }}
            />
            {errors[f.key] && (
              <p style={{ fontSize:12, color:'#EF4444', margin:'4px 0 0' }}>{errors[f.key]}</p>
            )}
          </div>
        ))}

        {/* 參照欄位錯誤提示 */}
        {errors._ref && (
          <div style={{ background:'#FEF2F2', borderRadius:10, padding:'10px 14px',
            marginBottom:16, border:'1px solid #FECACA' }}>
            <p style={{ fontSize:13, color:'#DC2626', margin:0 }}>⚠️ {errors._ref}</p>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%', padding:'14px', borderRadius:12, border:'none',
            background:saving ? '#93C5FD' : '#2563EB', color:'#fff',
            fontSize:16, fontWeight:700, cursor:'pointer', marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  )
}
