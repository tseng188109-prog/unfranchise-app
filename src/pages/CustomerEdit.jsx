import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'

export default function CustomerEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => { fetchCustomer() }, [id])

  async function fetchCustomer() {
    const { data } = await supabase.from('customers').select('*').eq('id', id).single()
    if (data) setForm({
      name: data.name || '',
      phone: data.phone || '',
      occupation: data.occupation || '',
      birthday: data.birthday || '',   // MM-DD 格式
      carrier: data.carrier || '',
      address: data.address || '',
      email: data.email || '',
    })
  }

  function set(key, val) {
    setForm(p => ({ ...p, [key]: val }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  function validateBirthday(val) {
    if (!val) return true
    return /^\d{2}-\d{2}$/.test(val)
  }

  async function handleSave() {
    const errs = {}
    if (!form.name.trim()) errs.name = '姓名為必填'
    if (!form.phone.trim()) errs.phone = '電話為必填'
    if (form.birthday && !validateBirthday(form.birthday)) errs.birthday = '格式需為 MM-DD，例：03-15'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const { error } = await supabase.from('customers').update({
      name: form.name.trim(),
      phone: form.phone.trim(),
      occupation: form.occupation || null,
      birthday: form.birthday || null,
      carrier: form.carrier || null,
      address: form.address || null,
      email: form.email || null,
    }).eq('id', id)
    setSaving(false)
    if (!error) navigate(`/customers/${id}`)
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('customers').delete().eq('id', id)
    setDeleting(false)
    navigate('/customers')
  }

  if (!form) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:'#9CA3AF' }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh' }}>
      <div style={{ background:'#fff',padding:'52px 16px 16px',
        borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',
        justifyContent:'space-between' }}>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151' }}>←</button>
          <h1 style={{ fontSize:18,fontWeight:800,color:'#111827',margin:0 }}>編輯顧客</h1>
        </div>
        <button onClick={() => setShowDelete(true)}
          style={{ background:'none',border:'1px solid #FCA5A5',borderRadius:8,
            padding:'6px 12px',fontSize:13,cursor:'pointer',color:'#DC2626' }}>刪除</button>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>
        {[
          { key:'name', label:'姓名', req:true, placeholder:'輸入姓名...' },
          { key:'phone', label:'電話', req:true, placeholder:'輸入電話...' },
          { key:'occupation', label:'職業', placeholder:'輸入職業...' },
          { key:'birthday', label:'生日', placeholder:'MM-DD，例：03-15', hint:'只填月份和日期，不需要年份' },
          { key:'carrier', label:'電子發票載具', placeholder:'輸入載具...' },
          { key:'address', label:'地址', placeholder:'輸入地址...' },
          { key:'email', label:'Email', type:'email', placeholder:'輸入 Email...' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom:16 }}>
            <label style={{ fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }}>
              {f.label} {f.req && <span style={{ color:'#EF4444' }}>*</span>}
            </label>
            <input
              type={f.type || 'text'}
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder || ''}
              style={{ width:'100%',padding:'11px 12px',borderRadius:10,
                border:`1px solid ${errors[f.key]?'#EF4444':'#E5E7EB'}`,
                fontSize:14,background:'#fff',boxSizing:'border-box',
                outline:'none',color:'#111827' }}
            />
            {f.hint && !errors[f.key] && (
              <p style={{ fontSize:11,color:'#9CA3AF',margin:'4px 0 0' }}>{f.hint}</p>
            )}
            {errors[f.key] && (
              <p style={{ fontSize:12,color:'#EF4444',margin:'4px 0 0' }}>{errors[f.key]}</p>
            )}
          </div>
        ))}

        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
            background:saving?'#93C5FD':'#2563EB',color:'#fff',
            fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>

      {/* 刪除確認 Modal */}
      {showDelete && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20 }}>
          <div style={{ background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:340 }}>
            <p style={{ fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 8px' }}>確定要刪除嗎？</p>
            <p style={{ fontSize:13,color:'#6B7280',margin:'0 0 20px' }}>
              刪除後無法復原，但相關業績紀錄仍會保留。
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowDelete(false)}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'1px solid #E5E7EB',
                  background:'#fff',fontSize:14,cursor:'pointer' }}>取消</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex:1,padding:'12px',borderRadius:10,border:'none',
                  background:'#DC2626',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {deleting?'刪除中…':'確定刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
