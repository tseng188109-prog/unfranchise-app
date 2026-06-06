import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'

function BirthdayPicker({ value, onChange }) {
  const months = Array.from({length:12}, (_,i) => String(i+1).padStart(2,'0'))
  const days = Array.from({length:31}, (_,i) => String(i+1).padStart(2,'0'))
  const parts = value ? value.split('-') : ['','']
  const mm = parts[0] || ''
  const dd = parts[1] || ''

  function handleChange(newMm, newDd) {
    if (newMm && newDd) onChange(`${newMm}-${newDd}`)
    else onChange('')
  }

  return (
    <div style={{ display:'flex', gap:8 }}>
      <select value={mm} onChange={e => handleChange(e.target.value, dd)}
        style={{ flex:1,padding:'11px 8px',borderRadius:10,border:'1px solid #E5E7EB',
          fontSize:14,background:'#fff',outline:'none',
          color:mm?'#111827':'#9CA3AF',appearance:'none',WebkitAppearance:'none' }}>
        <option value=''>月份</option>
        {months.map(m => <option key={m} value={m}>{Number(m)} 月</option>)}
      </select>
      <select value={dd} onChange={e => handleChange(mm, e.target.value)}
        style={{ flex:1,padding:'11px 8px',borderRadius:10,border:'1px solid #E5E7EB',
          fontSize:14,background:'#fff',outline:'none',
          color:dd?'#111827':'#9CA3AF',appearance:'none',WebkitAppearance:'none' }}>
        <option value=''>日期</option>
        {days.map(d => <option key={d} value={d}>{Number(d)} 日</option>)}
      </select>
    </div>
  )
}

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
      birthday: data.birthday || '',
      carrier: data.carrier || '',
      address: data.address || '',
      email: data.email || '',
    })
  }

  function set(key, val) {
    setForm(p => ({ ...p, [key]: val }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  async function handleSave() {
    const errs = {}
    if (!form.name.trim()) errs.name = '姓名為必填'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const { error } = await supabase.from('customers').update({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      occupation: form.occupation || null,
      birthday: form.birthday || null,
      carrier: form.carrier || null,
      address: form.address || null,
      email: form.email || null,
    }).eq('id', id)
    setSaving(false)
    if (!error) navigate(`/customers/${id}`)
    else console.error('儲存失敗', error)
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

        {/* 姓名（必填） */}
        <div style={fw}>
          <label style={lb}>姓名 <span style={{ color:'#EF4444' }}>*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="輸入姓名..."
            style={{ ...inp, borderColor: errors.name ? '#EF4444' : '#E5E7EB' }} />
          {errors.name && <p style={err}>{errors.name}</p>}
        </div>

        {/* 電話（選填） */}
        <div style={fw}>
          <label style={lb}>電話</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="輸入電話..." style={inp} />
        </div>

        {/* 職業 */}
        <div style={fw}>
          <label style={lb}>職業</label>
          <input value={form.occupation} onChange={e => set('occupation', e.target.value)}
            placeholder="輸入職業..." style={inp} />
        </div>

        {/* 生日 */}
        <div style={fw}>
          <label style={lb}>生日</label>
          <BirthdayPicker value={form.birthday} onChange={v => set('birthday', v)} />
          <p style={{ fontSize:11,color:'#9CA3AF',margin:'4px 0 0' }}>只記月份和日期，每年都能提醒</p>
        </div>

        {/* 電子發票載具 */}
        <div style={fw}>
          <label style={lb}>電子發票載具</label>
          <input value={form.carrier} onChange={e => set('carrier', e.target.value)}
            placeholder="輸入載具..." style={inp} />
        </div>

        {/* 地址 */}
        <div style={fw}>
          <label style={lb}>地址</label>
          <input value={form.address} onChange={e => set('address', e.target.value)}
            placeholder="輸入地址..." style={inp} />
        </div>

        {/* Email */}
        <div style={fw}>
          <label style={lb}>Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="輸入 Email..." style={inp} />
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
            background:saving?'#93C5FD':'#2563EB',color:'#fff',
            fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>

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

const fw = { marginBottom:16 }
const lb = { fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }
const inp = { width:'100%',padding:'11px 12px',borderRadius:10,border:'1px solid #E5E7EB',
  fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:'#111827' }
const err = { fontSize:12,color:'#EF4444',margin:'4px 0 0' }
