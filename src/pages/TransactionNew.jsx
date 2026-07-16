import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

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
    <div style={{ background:'#F8FAFC', minHeight:'100vh' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:'#fff', padding:'52px 0 16px',
        borderBottom:'1px solid #F3F4F6' }}>
      <div className="dash-container" style={{ padding:'0 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151' }}>←</button>
        <h1 style={{ fontSize:18,fontWeight:800,color:'#111827',margin:0 }}>新增業績</h1>
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
              style={{ ...inp, borderColor: errors.customer ? '#EF4444' : '#E5E7EB' }} />
            {showCustomerList && customerSearch && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0,
                background:'#fff', border:'1px solid #E5E7EB', borderRadius:10,
                zIndex:50, maxHeight:200, overflowY:'auto',
                boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => {
                    set('customer_id', c.id)
                    set('customer_name', c.name)
                    setCustomerSearch(customerLabel(c))
                    setShowCustomerList(false)
                  }} style={{ width:'100%', padding:'10px 12px', background:'none', border:'none',
                    borderBottom:'1px solid #F3F4F6', textAlign:'left', cursor:'pointer' }}>
                    <span style={{ fontSize:14, color:'#111827' }}>{c.name}</span>
                    {(c.phone || c.birthday || c.occupation) && (
                      <span style={{ fontSize:12, color:'#9CA3AF', marginLeft:6 }}>
                        {c.phone || (c.birthday ? `生日 ${c.birthday}` : c.occupation)}
                      </span>
                    )}
                  </button>
                ))}
                <button onClick={() => {
                  setShowCustomerList(false)
                  setShowQuickCreate(true)
                  setQuickName(customerSearch)
                }} style={{ width:'100%', padding:'10px 12px', background:'#F0FDF4', border:'none',
                  textAlign:'left', cursor:'pointer', fontSize:13, color:'#16A34A', fontWeight:600 }}>
                  + 快速建檔「{customerSearch}」
                </button>
              </div>
            )}
          </div>
          {errors.customer && <p style={err}>{errors.customer}</p>}
        </div>

        {/* 快速建檔 */}
        {showQuickCreate && (
          <div style={{ background:'#F0FDF4', borderRadius:12, padding:14, marginBottom:16,
            border:'1px solid #BBF7D0' }}>
            <p style={{ fontSize:13, fontWeight:700, color:'#16A34A', margin:'0 0 4px' }}>
              快速建檔
            </p>
            <p style={{ fontSize:11, color:'#6B7280', margin:'0 0 10px' }}>
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
              <p style={{ fontSize:12, color:'#DC2626', margin:'0 0 8px' }}>⚠️ {quickError}</p>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleQuickCreate}
                style={{ flex:1, padding:'9px', borderRadius:9, border:'none',
                  background:'#16A34A', color:'#fff', fontWeight:700,
                  cursor:'pointer', fontSize:13 }}>
                建檔並繼續
              </button>
              <button onClick={() => {
                setShowQuickCreate(false)
                setQuickName(''); setQuickPhone('')
                setQuickBirthday(''); setQuickOccupation('')
                setQuickError('')
              }} style={{ flex:1, padding:'9px', borderRadius:9,
                border:'1px solid #E5E7EB', background:'#fff',
                cursor:'pointer', fontSize:13 }}>取消</button>
            </div>
          </div>
        )}

        {/* BV / IBV */}
        <div style={fw}>
          <label style={lb}>類型</label>
          <div style={{ display:'flex', gap:8 }}>
            {['BV','IBV'].map(t => (
              <button key={t} onClick={() => set('type', t)}
                style={{ flex:1, padding:'10px', borderRadius:10, border:'none', fontWeight:700,
                  background:form.type===t?'#2563EB':'#F3F4F6',
                  color:form.type===t?'#fff':'#374151', cursor:'pointer', fontSize:14 }}>{t}</button>
            ))}
          </div>
        </div>

        {/* 點數 */}
        <div style={fw}>
          <label style={lb}>點數 <span style={req}>*</span></label>
          <input type="number" value={form.points} onChange={e => set('points', e.target.value)}
            placeholder="輸入點數..."
            style={{ ...inp, borderColor: errors.points ? '#EF4444' : '#E5E7EB' }} />
          {errors.points && <p style={err}>{errors.points}</p>}
        </div>

        {/* 品項 */}
        <div style={fw}>
          <label style={lb}>品項 <span style={req}>*</span></label>
          <input value={form.product_name} onChange={e => set('product_name', e.target.value)}
            placeholder="輸入或選擇產品..."
            style={{ ...inp, borderColor: errors.product_name ? '#EF4444' : '#E5E7EB' }} />
          {errors.product_name && <p style={err}>{errors.product_name}</p>}
        </div>

        {/* 贈品切換 */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16,
          padding:'12px', background:'#FFF7ED', borderRadius:10 }}>
          <button onClick={() => set('is_gift', !form.is_gift)}
            style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background:form.is_gift?'#F97316':'#D1D5DB', position:'relative', transition:'all 0.2s' }}>
            <div style={{ width:20, height:20, borderRadius:'50%', background:'#fff',
              position:'absolute', top:2, transition:'all 0.2s',
              left:form.is_gift?22:2 }} />
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:'#F97316' }}>贈品（成本記入，消費歸零）</span>
        </div>

        {/* 消費金額 */}
        {!form.is_gift && (
          <div style={fw}>
            <label style={lb}>消費金額 <span style={req}>*</span></label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
                color:'#9CA3AF', fontSize:14 }}>NT$</span>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0"
                style={{ ...inp, paddingLeft:44, borderColor: errors.amount ? '#EF4444' : '#E5E7EB' }} />
            </div>
            {errors.amount && <p style={err}>{errors.amount}</p>}
          </div>
        )}

        {/* 成本 */}
        <div style={fw}>
          <label style={lb}>成本 <span style={{ fontSize:11, color:'#9CA3AF' }}>選填，可事後補填</span></label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
              color:'#9CA3AF', fontSize:14 }}>NT$</span>
            <input type="number" value={form.cost} onChange={e => set('cost', e.target.value)}
              placeholder="0" style={{ ...inp, paddingLeft:44 }} />
          </div>
          {form.amount && form.cost && (
            <p style={{ fontSize:13, color:'#16A34A', margin:'6px 0 0', fontWeight:600 }}>
              價差：NT${(Number(form.amount)-Number(form.cost)).toLocaleString()}
            </p>
          )}
        </div>

        {/* 儲存 */}
        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%', padding:'14px', borderRadius:12, border:'none',
            background:saving?'#93C5FD':'#2563EB', color:'#fff',
            fontSize:16, fontWeight:700, cursor:'pointer', marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  )
}

const fw = { marginBottom: 16 }
const lb = { fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }
const req = { color:'#EF4444' }
const inp = { width:'100%', padding:'11px 12px', borderRadius:10, border:'1px solid #E5E7EB',
  fontSize:14, background:'#fff', boxSizing:'border-box', outline:'none', color:'#111827' }
const err = { fontSize:12, color:'#EF4444', margin:'4px 0 0' }
