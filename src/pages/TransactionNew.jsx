import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import OrderForm from './OrderForm'
import { saveDraft, loadDraft } from './formDraft'
import {
  TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, DANGER, BORDER, RADIUS } from './designTokens'

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
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState(() => loadDraft('txNew')?.customerSearch || '')
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickBirthday, setQuickBirthday] = useState('')
  const [quickOccupation, setQuickOccupation] = useState('')
  const [quickError, setQuickError] = useState('')

  const [form, setForm] = useState(() => {
    const d = loadDraft('txNew')?.form
    return { customer_id: d?.customer_id || '', customer_name: d?.customer_name || '' }
  })
  const [errors, setErrors] = useState({})

  // 填到一半 App 關掉重開，草稿自動補回來（單人 App，不用比對資料有沒被別人改過）
  useEffect(() => { saveDraft('txNew', { form, customerSearch }) }, [form, customerSearch])

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

  return (
    <div style={{ background:'var(--page)',minHeight:'100vh', overflowX:'hidden', maxWidth:'100vw', boxSizing:'border-box' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:'var(--card)', padding:'52px 0 16px',
        borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_SECONDARY,display:'flex' }}><IconArrowLeft size={22} stroke={1.9} /></button>
        <h1 style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,margin:0 }}>新增業績</h1>
      </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px 100px' }}>

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
                background:'var(--card)', border:`1px solid ${BORDER}`, borderRadius:RADIUS.md,
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
          <div style={{ background:ACCENT_GREEN_SOFT, borderRadius:RADIUS.lg, padding:14, marginBottom:16 }}>
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
                style={{ flex:1, padding:'9px', borderRadius:RADIUS.sm, border:'none',
                  background:ACCENT_GREEN_TEXT, color:'#fff', fontWeight:700,
                  cursor:'pointer', fontSize:13 }}>
                建檔並繼續
              </button>
              <button onClick={() => {
                setShowQuickCreate(false)
                setQuickName(''); setQuickPhone('')
                setQuickBirthday(''); setQuickOccupation('')
                setQuickError('')
              }} style={{ flex:1, padding:'9px', borderRadius:RADIUS.sm,
                border:`1px solid ${BORDER}`, background:'var(--card)',
                cursor:'pointer', fontSize:13, color:TEXT_SECONDARY }}>取消</button>
            </div>
          </div>
        )}

        {/* 訂單（選了顧客才出現） */}
        {form.customer_id && user ? (
          <OrderForm
            key={form.customer_id}
            userId={user.id}
            customerId={form.customer_id}
            customerName={form.customer_name}
            onDone={() => navigate('/transactions')}
          />
        ) : (
          <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'20px 0' }}>
            先選顧客，產品欄位就會出現
          </p>
        )}
      </div>
    </div>
  )
}

const fw = { marginBottom: 16 }
const lb = { fontSize:13, fontWeight:600, color:TEXT_MAIN, display:'block', marginBottom:6 }
const req = { color:DANGER }
const inp = { width:'100%', padding:'11px 12px', borderRadius:RADIUS.md, border:`1px solid ${BORDER}`,
  fontSize:14, background:'var(--card)', boxSizing:'border-box', outline:'none', color:TEXT_MAIN }
const err = { fontSize:12, color:DANGER, margin:'4px 0 0' }
