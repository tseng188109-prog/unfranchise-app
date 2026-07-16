import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'

const PRIMARY = '#1668E3'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_YELLOW = '#FFD166'
const ACCENT_YELLOW_SOFT = '#FFF7E6'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const DANGER = '#E0454A'
const BORDER = '#F0F1F4'

// 顯示顧客識別資訊（智慧顯示）
function customerLabel(c) {
  const refs = []
  if (c.phone) refs.push(c.phone)
  else if (c.birthday) refs.push(`生日 ${c.birthday}`)
  else if (c.occupation) refs.push(c.occupation)
  return refs.length > 0 ? `${c.name} · ${refs[0]}` : c.name
}

export default function TransactionNew() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickBirthday, setQuickBirthday] = useState('')
  const [quickOccupation, setQuickOccupation] = useState('')
  const [quickError, setQuickError] = useState('')

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    type: 'BV',
    points: '',
    product_name: '',
    amount: '',
    cost: '',
    is_gift: false,
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    if (!user) return
    fetchCustomers()
  }, [user])

  async function fetchCustomers() {
    const { data } = await supabase.from('customers')
      .select('id,name,phone,birthday,occupation')
      .eq('user_id', user.id).order('name')
    if (data) setCustomers(data)
  }

  const filteredCustomers = customers.filter(c =>
    c.name.includes(customerSearch) ||
    (c.phone||'').includes(customerSearch) ||
    (c.occupation||'').includes(customerSearch)
  )

  function set(key, val) {
    setForm(p => ({ ...p, [key]: val }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  async function handleQuickCreate() {
    if (!quickName.trim()) { setQuickError('請填寫姓名'); return }
    if (!quickPhone.trim() && !quickBirthday.trim() && !quickOccupation.trim()) {
      setQuickError('請至少填寫手機、生日或職業其中一項')
      return
    }
    setQuickError('')
    const { data, error } = await supabase.from('customers').insert({
      user_id: user.id,
      name: quickName.trim(),
      phone: quickPhone.trim() || null,
      birthday: quickBirthday.trim() || null,
      occupation: quickOccupation.trim() || null,
    }).select().single()
    if (!error && data) {
      setCustomers(p => [...p, data])
      setForm(p => ({ ...p, customer_id: data.id, customer_name: data.name }))
      setCustomerSearch(customerLabel(data))
      setShowQuickCreate(false)
      setQuickName(''); setQuickPhone(''); setQuickBirthday(''); setQuickOccupation('')
    }
  }

  async function handleSave() {
    const errs = {}
    if (!form.customer_id) errs.customer = '請選擇顧客'
    if (!form.points) errs.points = '請輸入點數'
    if (!form.product_name.trim()) errs.product_name = '請輸入品項'
    if (!form.is_gift && !form.amount) errs.amount = '請輸入消費金額'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      customer_id: form.customer_id,
      date: form.date,
      type: form.type,
      points: Number(form.points),
      product_name: form.product_name.trim(),
      amount: form.is_gift ? 0 : Number(form.amount),
      cost: form.cost ? Number(form.cost) : null,
      is_gift: form.is_gift,
    })
    setSaving(false)
    if (!error) navigate('/transactions')
  }

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:'#fff', padding:'52px 0 16px',
        borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_SECONDARY,display:'flex' }}><IconArrowLeft size={22} stroke={1.9} /></button>
        <h1 style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,margin:0 }}>新增業績</h1>
      </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px 100px' }}>

        {/* 日期 */}
        <div style={fw}>
          <label style={lb}>日期</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            style={inp} />
        </div>

        {/* 顧客 */}
        <div style={fw}>
          <label style={lb}>顧客 <span style={req}>*</span></label>
          <div style={{ position:'relative' }}>
            <input value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value)
                setShowCustomerList(true)
                set('customer_id','')
                set('customer_name','')
              }}
              onFocus={() => setShowCustomerList(true)}
              placeholder="搜尋顧客姓名、手機或職業..."
              style={{ ...inp, borderColor: errors.customer ? DANGER : BORDER }} />
            {showCustomerList && customerSearch && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0,
                background:'#fff', border:`1px solid ${BORDER}`, borderRadius:12,
                zIndex:50, maxHeight:200, overflowY:'auto',
                boxShadow:'0 4px 12px rgba(19,42,77,0.1)' }}>
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => {
                    set('customer_id', c.id)
                    set('customer_name', c.name)
                    setCustomerSearch(customerLabel(c))
                    setShowCustomerList(false)
                  }} style={{ width:'100%', padding:'10px 12px', background:'none', border:'none',
                    borderBottom:`1px solid ${BORDER}`, textAlign:'left', cursor:'pointer' }}>
                    <span style={{ fontSize:14, color:TEXT_MAIN }}>{c.name}</span>
                    {(c.phone || c.birthday || c.occupation) && (
                      <span style={{ fontSize:12, color:TEXT_MUTED, marginLeft:6 }}>
                        {c.phone || (c.birthday ? `生日 ${c.birthday}` : c.occupation)}
                      </span>
                    )}
                  </button>
                ))}
                <button onClick={() => {
                  setShowCustomerList(false)
                  setShowQuickCreate(true)
                  setQuickName(customerSearch)
                }} style={{ width:'100%', padding:'10px 12px', background:ACCENT_GREEN_SOFT, border:'none',
                  textAlign:'left', cursor:'pointer', fontSize:13, color:ACCENT_GREEN_TEXT, fontWeight:600 }}>
                  + 快速建檔「{customerSearch}」
                </button>
              </div>
            )}
          </div>
          {errors.customer && <p style={err}>{errors.customer}</p>}
        </div>

        {/* 快速建檔 */}
        {showQuickCreate && (
          <div style={{ background:ACCENT_GREEN_SOFT, borderRadius:14, padding:14, marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:700, color:ACCENT_GREEN_TEXT, margin:'0 0 4px' }}>
              快速建檔
            </p>
            <p style={{ fontSize:11, color:TEXT_SECONDARY, margin:'0 0 10px' }}>
              姓名必填，手機／生日／職業至少填一項
            </p>
            <input value={quickName} onChange={e => setQuickName(e.target.value)}
              placeholder="姓名 *"
              style={{ ...inp, marginBottom:8 }} />
            <input value={quickPhone} onChange={e => setQuickPhone(e.target.value)}
              placeholder="手機（選填）"
              style={{ ...inp, marginBottom:8 }} />
            <input value={quickBirthday} onChange={e => setQuickBirthday(e.target.value)}
              placeholder="生日 MM-DD（選填）"
              style={{ ...inp, marginBottom:8 }} />
            <input value={quickOccupation} onChange={e => setQuickOccupation(e.target.value)}
              placeholder="職業（選填）"
              style={{ ...inp, marginBottom:8 }} />
            {quickError && (
              <p style={{ fontSize:12, color:DANGER, margin:'0 0 8px' }}>{quickError}</p>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleQuickCreate}
                style={{ flex:1, padding:'9px', borderRadius:10, border:'none',
                  background:ACCENT_GREEN_TEXT, color:'#fff', fontWeight:700,
                  cursor:'pointer', fontSize:13 }}>
                建檔並繼續
              </button>
              <button onClick={() => {
                setShowQuickCreate(false)
                setQuickName(''); setQuickPhone('')
                setQuickBirthday(''); setQuickOccupation('')
                setQuickError('')
              }} style={{ flex:1, padding:'9px', borderRadius:10,
                border:`1px solid ${BORDER}`, background:'#fff',
                cursor:'pointer', fontSize:13, color:TEXT_SECONDARY }}>取消</button>
            </div>
          </div>
        )}

        {/* BV / IBV */}
        <div style={fw}>
          <label style={lb}>類型</label>
          <div style={{ display:'flex', gap:8 }}>
            {['BV','IBV'].map(t => (
              <button key={t} onClick={() => set('type', t)}
                style={{ flex:1, padding:'10px', borderRadius:12, border:'none', fontWeight:700,
                  background:form.type===t?PRIMARY:'#F5F8FC',
                  color:form.type===t?'#fff':TEXT_SECONDARY, cursor:'pointer', fontSize:14 }}>{t}</button>
            ))}
          </div>
        </div>

        {/* 點數 */}
        <div style={fw}>
          <label style={lb}>點數 <span style={req}>*</span></label>
          <input type="number" value={form.points} onChange={e => set('points', e.target.value)}
            placeholder="輸入點數..."
            style={{ ...inp, borderColor: errors.points ? DANGER : BORDER }} />
          {errors.points && <p style={err}>{errors.points}</p>}
        </div>

        {/* 品項 */}
        <div style={fw}>
          <label style={lb}>品項 <span style={req}>*</span></label>
          <input value={form.product_name} onChange={e => set('product_name', e.target.value)}
            placeholder="輸入或選擇產品..."
            style={{ ...inp, borderColor: errors.product_name ? DANGER : BORDER }} />
          {errors.product_name && <p style={err}>{errors.product_name}</p>}
        </div>

        {/* 贈品切換 */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16,
          padding:'12px', background:ACCENT_YELLOW_SOFT, borderRadius:12 }}>
          <button onClick={() => set('is_gift', !form.is_gift)}
            style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background:form.is_gift?ACCENT_YELLOW:'#D1D5DB', position:'relative', transition:'all 0.2s' }}>
            <div style={{ width:20, height:20, borderRadius:'50%', background:'#fff',
              position:'absolute', top:2, transition:'all 0.2s',
              left:form.is_gift?22:2 }} />
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:ACCENT_YELLOW_TEXT }}>贈品（成本記入，消費歸零）</span>
        </div>

        {/* 消費金額 */}
        {!form.is_gift && (
          <div style={fw}>
            <label style={lb}>消費金額 <span style={req}>*</span></label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
                color:TEXT_MUTED, fontSize:14 }}>NT$</span>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0"
                style={{ ...inp, paddingLeft:44, borderColor: errors.amount ? DANGER : BORDER }} />
            </div>
            {errors.amount && <p style={err}>{errors.amount}</p>}
          </div>
        )}

        {/* 成本 */}
        <div style={fw}>
          <label style={lb}>成本 <span style={{ fontSize:11, color:TEXT_MUTED }}>選填，可事後補填</span></label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
              color:TEXT_MUTED, fontSize:14 }}>NT$</span>
            <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)}
              placeholder="0" style={{ ...inp, paddingLeft:44 }} />
          </div>
          {form.amount && form.cost && (
            <p style={{ fontSize:13, color:ACCENT_GREEN_TEXT, margin:'6px 0 0', fontWeight:600 }}>
              價差：NT${(Number(form.amount)-Number(form.cost)).toLocaleString()}
            </p>
          )}
        </div>

        {/* 儲存 */}
        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%', padding:'14px', borderRadius:14, border:'none',
            background:saving?'#9BBBF2':PRIMARY, color:'#fff',
            fontSize:16, fontWeight:700, cursor:'pointer', marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  )
}

const fw = { marginBottom: 16 }
const lb = { fontSize:13, fontWeight:600, color:TEXT_MAIN, display:'block', marginBottom:6 }
const req = { color:DANGER }
const inp = { width:'100%', padding:'11px 12px', borderRadius:12, border:`1px solid ${BORDER}`,
  fontSize:14, background:'#fff', boxSizing:'border-box', outline:'none', color:TEXT_MAIN }
const err = { fontSize:12, color:DANGER, margin:'4px 0 0' }
