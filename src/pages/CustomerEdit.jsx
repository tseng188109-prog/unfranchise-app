import { useState, useEffect } from 'react'
import { BirthdayPicker } from './pickers'
import LoadingSpinner from './LoadingSpinner'
import { supabase } from '../supabase'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { goBackOr, SaveError, SAVE_FAIL } from './navBack'
import { askConfirm } from './confirmDialog'
import { IconArrowLeft, IconArchive } from '@tabler/icons-react'
import { archiveContactOfCustomer } from './customerLink'
import { saveDraft, loadDraft, clearDraft } from './formDraft'
import { ContactLinkField, SameNameHint, DraftNotice } from './customerFormParts'
import { useMyCustomers } from './myCustomers'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, ACCENT_YELLOW_SOFT, ACCENT_YELLOW_TEXT,
  DANGER, DANGER_SOFT, BORDER, RADIUS } from './designTokens'

export default function CustomerEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // 從顧客自己的頁面按進來（手機）才是 列表→顧客頁→編輯；桌機是從列表右側直接進來
  const fromDetail = !!(location.state && location.state.fromDetail)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})

  // 連結互動名單（選填）
  const [contacts, setContacts] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [linkedContactId, setLinkedContactId] = useState(null)
  const [linkedContactName, setLinkedContactName] = useState('')
  const [restored, setRestored] = useState(false)
  const customers = useMyCustomers()

  useEffect(() => { fetchCustomer() }, [id])

  useEffect(() => {
    async function fetchContacts() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('contacts')
        .select('id,name,occupation').eq('user_id', user.id).eq('is_archived', false).order('name')
      setContacts(data || [])
    }
    fetchContacts()
  }, [])

  async function fetchCustomer(ignoreDraft = false) {
    const { data } = await supabase.from('customers').select('*').eq('id', id).single()
    if (data) {
      const base = {
        name: data.name || '',
        phone: data.phone || '',
        occupation: data.occupation || '',
        birthday: data.birthday || '',
        carrier: data.carrier || '',
        address: data.address || '',
        email: data.email || '',
      }
      // 填到一半 App 關掉重開，草稿自動補回來（單人 App，不用比對資料有沒被別人改過）
      const draft = ignoreDraft ? null : loadDraft(`customerEdit:${id}`)
      setForm(draft?.form || base)
      // 補回的內容跟資料庫裡的不一樣，才提醒「這是上次改到一半的」
      const changed = !!draft && (JSON.stringify(draft.form || {}) !== JSON.stringify(base) || (draft.linkedContactId || null) !== (data.contact_id || null))
      setRestored(changed)
      if (draft) {
        setContactSearch(draft.contactSearch || '')
        setLinkedContactId(draft.linkedContactId || null)
        setLinkedContactName(draft.linkedContactName || '')
      } else {
        setContactSearch('')
        setLinkedContactId(null)
        setLinkedContactName('')
      }
      if (!draft && data.contact_id) {
        setLinkedContactId(data.contact_id)
        const { data: linkedContact } = await supabase.from('contacts')
          .select('name').eq('id', data.contact_id).single()
        if (linkedContact) setLinkedContactName(linkedContact.name)
      }
    }
  }

  useEffect(() => {
    if (form) saveDraft(`customerEdit:${id}`, { form, contactSearch, linkedContactId, linkedContactName })
  }, [form, contactSearch, linkedContactId, linkedContactName, id])

  function selectContact(c) {
    setLinkedContactId(c.id)
    setLinkedContactName(c.name)
    setContactSearch(c.name)
  }

  function clearLinkedContact() {
    setLinkedContactId(null)
    setLinkedContactName('')
    setContactSearch('')
  }

  // 放棄改到一半的內容，回到資料庫裡存的樣子
  async function discardDraft() {
    clearDraft(`customerEdit:${id}`)
    setErrors({})
    await fetchCustomer(true)
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
    setSaveErr('')
    const { error } = await supabase.from('customers').update({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      occupation: form.occupation.trim() || null,
      birthday: form.birthday || null,
      carrier: form.carrier.trim() || null,
      address: form.address.trim() || null,
      email: form.email.trim() || null,
      contact_id: linkedContactId || null,
    }).eq('id', id)
    setSaving(false)
    if (!error) { clearDraft(`customerEdit:${id}`); goBackOr(navigate, `/customers/${id}`) }
    else { console.error('儲存失敗', error); setSaveErr(SAVE_FAIL) }
  }

  // 「刪除」改成「封存」：不再直接從資料庫移除，永久刪除只從顧客檔案的「封存名單」進行
  async function handleArchive() {
    if (archiving) return
    if (!(await askConfirm({ title:`封存「${form.name}」？`, message:'封存後可以在顧客檔案的「封存名單」找到並復原，或永久刪除。', okText:'封存', danger:true }))) return
    setArchiving(true)
    await supabase.from('customers').update({ is_archived: true }).eq('id', id)
    await archiveContactOfCustomer(supabase, id)
    clearDraft(`customerEdit:${id}`)
    setArchiving(false)
    // 封存了就不要再回到他的頁面：手機退兩頁（跳過顧客頁）回列表，桌機退一頁就是列表
    goBackOr(navigate, '/customers', fromDetail ? 2 : 1)
  }

  if (!form) return <LoadingSpinner />

  return (
    <div style={{ background:'var(--page)',minHeight:'100vh', overflowX:'hidden', maxWidth:'100vw', boxSizing:'border-box' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div style={{ background:'var(--card)', padding:'52px 0 16px',
        borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px', display:'flex', alignItems:'center',
        justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_SECONDARY,display:'flex' }}><IconArrowLeft size={22} stroke={1.9} /></button>
          <h1 style={{ fontSize:18,fontWeight:600,color:TEXT_MAIN,margin:0 }}>編輯顧客</h1>
        </div>
        <button onClick={handleArchive}
          style={{ display:'flex', alignItems:'center', gap:6, background:DANGER_SOFT, border:'none', borderRadius:RADIUS.sm,
            padding:'6px 12px', fontSize:13, cursor:'pointer', color:DANGER, fontWeight:600 }}>
          <IconArchive size={14} stroke={1.9} /> 封存
        </button>
      </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px 100px' }}>

        {restored && (
          <DraftNotice text="這是你上次改到一半還沒存的內容，已經幫你補回來了。" actionText="放棄修改" onAction={discardDraft} />
        )}

        {/* 參照提示 */}
        <div style={{ background:PRIMARY_SOFT, borderRadius:RADIUS.md, padding:'10px 14px',
          marginBottom:16 }}>
          <p style={{ fontSize:12, color:PRIMARY, margin:0, lineHeight:1.6 }}>
            除姓名外，請至少填寫 <strong>手機、生日、職業</strong> 其中一項，方便日後區分同名顧客
          </p>
        </div>

        {/* 連結互動名單（選填） */}
        <ContactLinkField mode="edit" contacts={contacts} customers={customers} selfId={id}
          linkedId={linkedContactId} linkedName={linkedContactName}
          search={contactSearch} setSearch={setContactSearch}
          onSelect={selectContact} onClear={clearLinkedContact} />

        {/* 姓名 */}
        <div style={fw}>
          <label style={lb}>姓名 <span style={{ color:DANGER }}>*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="輸入姓名..."
            style={{ ...inp, borderColor: errors.name ? DANGER : BORDER }} />
          {errors.name && <p style={err}>{errors.name}</p>}
          <SameNameHint name={form.name} customers={customers} selfId={id}
            skipId={(customers.find(k => linkedContactId && k.contact_id === linkedContactId && k.id !== id) || {}).id} />
        </div>

        {/* 手機 */}
        <div style={fw}>
          <label style={lb}>
            手機
            <span style={{ marginLeft:6, fontSize:11, padding:'1px 6px', borderRadius:RADIUS.pill,
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
            <span style={{ marginLeft:6, fontSize:11, padding:'1px 6px', borderRadius:RADIUS.pill,
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
            <span style={{ marginLeft:6, fontSize:11, padding:'1px 6px', borderRadius:RADIUS.pill,
              background: form.occupation.trim() ? ACCENT_GREEN_SOFT : ACCENT_YELLOW_SOFT,
              color: form.occupation.trim() ? ACCENT_GREEN_TEXT : ACCENT_YELLOW_TEXT, fontWeight:600 }}>識別用</span>
          </label>
          <input value={form.occupation} onChange={e => set('occupation', e.target.value)}
            placeholder="輸入職業（選填）..." style={inp} />
        </div>

        {/* 參照錯誤 */}
        {errors._ref && (
          <div style={{ background:DANGER_SOFT, borderRadius:RADIUS.md, padding:'10px 14px',
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
          style={{ width:'100%',padding:'14px',borderRadius:RADIUS.lg,border:'none',
            background:saving?'#9BBBF2':PRIMARY,color:'#fff',
            fontSize:16,fontWeight:600,cursor:'pointer',marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
        <SaveError msg={saveErr} />
      </div>

    </div>
  )
}

const fw = { marginBottom:16 }
const lb = { fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'flex',alignItems:'center',gap:4,marginBottom:6 }
const inp = { width:'100%',padding:'11px 12px',borderRadius:RADIUS.md,border:`1px solid ${BORDER}`,
  fontSize:14,background:'var(--card)',boxSizing:'border-box',outline:'none',color:TEXT_MAIN }
const err = { fontSize:12,color:DANGER,margin:'4px 0 0' }
