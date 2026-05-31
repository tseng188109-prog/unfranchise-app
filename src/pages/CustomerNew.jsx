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
    setErrors(e => ({ ...e, [key]: '' }))
  }

  async function handleSave() {
    const errs = {}
    if (!form.name.trim()) errs.name = '姓名為必填'
    if (!form.phone.trim()) errs.phone = '電話為必填'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('customers').insert({
      user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      occupation: form.occupation || null,
      birthday: form.birthday || null,
      carrier: form.carrier || null,
      address: form.address || null,
      email: form.email || null,
    })
    setSaving(false)
    if (!error) navigate('/customers')
    else if (error.code === '23505') setErrors({ phone: '此姓名+電話已存在' })
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh' }}>
      <div style={{ background:'#fff',padding:'52px 16px 16px',
        borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151' }}>←</button>
        <h1 style={{ fontSize:18,fontWeight:800,color:'#111827',margin:0 }}>新增顧客</h1>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>
        {[
          { key:'name', label:'姓名', req:true, placeholder:'輸入姓名...' },
          { key:'phone', label:'電話', req:true, placeholder:'輸入電話...' },
          { key:'occupation', label:'職業', placeholder:'輸入職業...' },
          { key:'birthday', label:'生日', type:'date' },
          { key:'carrier', label:'電子發票載具', placeholder:'輸入載具...' },
          { key:'address', label:'地址', placeholder:'輸入地址...' },
          { key:'email', label:'Email', type:'email', placeholder:'輸入 Email...' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom:16 }}>
            <label style={{ fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }}>
              {f.label} {f.req && <span style={{ color:'#EF4444' }}>*</span>}
            </label>
            <input type={f.type||'text'} value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder||''}
              style={{ width:'100%',padding:'11px 12px',borderRadius:10,
                border:`1px solid ${errors[f.key]?'#EF4444':'#E5E7EB'}`,
                fontSize:14,background:'#fff',boxSizing:'border-box',
                outline:'none',color:'#111827' }} />
            {errors[f.key] && <p style={{ fontSize:12,color:'#EF4444',margin:'4px 0 0' }}>{errors[f.key]}</p>}
          </div>
        ))}

        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
            background:saving?'#93C5FD':'#2563EB',color:'#fff',
            fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  )
}