import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconArchive } from '@tabler/icons-react'

const PRIMARY = '#1668E3'
const PRIMARY_SOFT = '#EEF3FB'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const ACCENT_YELLOW_SOFT = '#FFF7E6'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const DANGER = '#E0454A'
const DANGER_SOFT = '#FDE2E2'
const BORDER = '#F0F1F4'

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
        style={{ flex:1,padding:'11px 8px',borderRadius:12,border:`1px solid ${BORDER}`,
          fontSize:14,background:'#fff',outline:'none',
          color:mm?TEXT_MAIN:TEXT_MUTED,appearance:'none',WebkitAppearance:'none' }}>
        <option value=''>月份</option>
        {months.map(m => <option key={m} value={m}>{Number(m)} 月</option>)}
      </select>
      <select value={dd} onChange={e => handleChange(mm, e.target.value)}
        style={{ flex:1,padding:'11px 8px',borderRadius:12,border:`1px solid ${BORDER}`,
          fontSize:14,background:'#fff',outline:'none',
          color:dd?TEXT_MAIN:TEXT_MUTED,appearance:'none',WebkitAppearance:'none' }}>
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
  const [archiving, setArchiving] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
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
    setErrors(e => ({ ...e, [key]: '', _ref: '' }))
  }

  async function handleSave() {
    const errs = {}
    if (!form.name.trim()) errs.name = '姓名為必填'
    if (!form.phone.trim() && !form.birthday.trim() && !form.occupation.trim()) {
      errs._ref = '請至少填寫手機、生日或職業其中一項，以便日後識別顧客'
    }
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const { error } = await supabase.from('customers').update({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      occupation: form.occupation.trim() || null,
      birthday: form.birthday || null,
      carrier: form.carrier.trim() || null,
      address: form.address.trim() || null,
      email: form.email.trim() || null,
    }).eq('id', id)
    setSaving(false)
    if (!error) navigate(`/customers/${id}`)
    else console.error('儲存失敗', error)
  }

  // 「刪除」改成「封存」：不再直接從資料庫移除，永久刪除只從顧客檔案的「封存名單」進行
  async function handleArchive() {
    setArchiving(true)
    await supabase.from('customers').update({ is_archived: true }).eq('id', id)
    setArchiving(false)
    navigate('/customers')
  }

  if (!form) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:TEXT_MUTED }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div style={{ background:'#fff', padding:'52px 0 16px',
        borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px', display:'flex', alignItems:'center',
        justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_SECONDARY,display:'flex' }}><IconArrowLeft size={22} stroke={1.9} /></button>
          <h1 style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,margin:0 }}>編輯顧客</h1>
        </div>
        <button onClick={() => setShowArchiveConfirm(true)}
          style={{ display:'flex', alignItems:'center', gap:6, background:DANGER_SOFT, border:'none', borderRadius:10,
            padding:'6px 12px', fontSize:13, cursor:'pointer', color:DANGER, fontWeight:600 }}>
          <IconArchive size={14} stroke={1.9} /> 封存
        </button>
      </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px 100px' }}>

        {/* 參照提示 */}
        <div style={{ background:PRIMARY_SOFT, borderRadius:12, padding:'10px 14px',
          marginBottom:16 }}>
          <p style={{ fontSize:12, color:PRIMARY, margin:0, lineHeight:1.6 }}>
            除姓名外，請至少填寫 <strong>手機、生日、職業</strong> 其中一項，方便日後區分同名顧客
          </p>
        </div>

        {/* 姓名 */}
        <div style={fw}>
          <label style={lb}>姓名 <span style={{ color:DANGER }}>*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="輸入姓名..."
            style={{ ...inp, borderColor: errors.name ? DANGER : BORDER }} />
          {errors.name && <p style={err}>{errors.name}</p>}
        </div>

        {/* 手機 */}
        <div style={fw}>
          <label style={lb}>
            手機
            <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:99,
              background: form.phone.trim() ? ACCENT_GREEN_SOFT : ACCENT_YELLOW_SOFT,
              color: form.phone.trim() ? ACCENT_GREEN_TEXT : ACCENT_YELLOW_TEXT, fontWeight:600 }}>識別用</span>
          </label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="輸入手機（選填）..." style={inp} />
        </div>

        {/* 生日 */}
        <div style={fw}>
          <label style={lb}>
            生日
            <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:99,
              background: form.birthday.trim() ? ACCENT_GREEN_SOFT : ACCENT_YELLOW_SOFT,
              color: form.birthday.trim() ? ACCENT_GREEN_TEXT : ACCENT_YELLOW_TEXT, fontWeight:600 }}>識別用</span>
          </label>
          <BirthdayPicker value={form.birthday} onChange={v => set('birthday', v)} />
          <p style={{ fontSize:11,color:TEXT_MUTED,margin:'4px 0 0' }}>只記月份和日期，每年都能提醒</p>
        </div>

        {/* 職業 */}
        <div style={fw}>
          <label style={lb}>
            職業
            <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:99,
              background: form.occupation.trim() ? ACCENT_GREEN_SOFT : ACCENT_YELLOW_SOFT,
              color: form.occupation.trim() ? ACCENT_GREEN_TEXT : ACCENT_YELLOW_TEXT, fontWeight:600 }}>識別用</span>
          </label>
          <input value={form.occupation} onChange={e => set('occupation', e.target.value)}
            placeholder="輸入職業（選填）..." style={inp} />
        </div>

        {/* 參照錯誤 */}
        {errors._ref && (
          <div style={{ background:DANGER_SOFT, borderRadius:12, padding:'10px 14px',
            marginBottom:16 }}>
            <p style={{ fontSize:13, color:DANGER, margin:0 }}>{errors._ref}</p>
          </div>
        )}

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
          style={{ width:'100%',padding:'14px',borderRadius:14,border:'none',
            background:saving?'#9BBBF2':PRIMARY,color:'#fff',
            fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>

      {showArchiveConfirm && (
        <div style={{ position:'fixed',inset:0,background:'rgba(19,42,77,0.5)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20 }}>
          <div style={{ background:'#fff',borderRadius:18,padding:24,width:'100%',maxWidth:340 }}>
            <p style={{ fontSize:16,fontWeight:700,color:TEXT_MAIN,margin:'0 0 8px' }}>確定要封存這位顧客嗎？</p>
            <p style={{ fontSize:13,color:TEXT_MUTED,margin:'0 0 20px' }}>
              封存後可以到顧客檔案的「封存名單」找到並復原，或永久刪除。
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowArchiveConfirm(false)}
                style={{ flex:1,padding:'12px',borderRadius:12,border:`1px solid ${BORDER}`,
                  background:'#fff',fontSize:14,cursor:'pointer',color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleArchive} disabled={archiving}
                style={{ flex:1,padding:'12px',borderRadius:12,border:'none',
                  background:DANGER,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                {archiving?'封存中…':'確定封存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const fw = { marginBottom:16 }
const lb = { fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'flex',alignItems:'center',gap:4,marginBottom:6 }
const inp = { width:'100%',padding:'11px 12px',borderRadius:12,border:`1px solid ${BORDER}`,
  fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:TEXT_MAIN }
const err = { fontSize:12,color:DANGER,margin:'4px 0 0' }
