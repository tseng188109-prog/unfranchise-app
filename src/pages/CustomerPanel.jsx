import { useState, useEffect } from 'react'
import { DateField } from './pickers'
import { askConfirm } from './confirmDialog'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconPencil, IconX, IconGift, IconPhone, IconMail,
  IconMapPin, IconCalendarEvent, IconId, IconBell, IconTrash, IconCheck, IconArchive, IconHeart,
} from '@tabler/icons-react'
import LoadingSpinner from './LoadingSpinner'
import SampleSection from './SampleSection'
import OrderForm from './OrderForm'
import OrderCard from './OrderCard'
import { groupPurchases } from './orderUtils'
import { saveDraft, loadDraft, clearDraft } from './formDraft'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_YELLOW, ACCENT_YELLOW_TEXT, ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT,
  DANGER, BORDER, SUBCARD_BG, RADIUS, getEggColor, getEggBg, avatarBg, PAGE_BG } from './designTokens'

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}
function formatBirthday(mmdd) {
  if (!mmdd) return ''
  const parts = mmdd.split('-')
  if (parts.length !== 2) return mmdd
  return `${Number(parts[0])} 月 ${Number(parts[1])} 日`
}
function toDateStr(d) { return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) }
function today() { return toDateStr(new Date()) }

const EMPTY_FORM = {
  date: today(), product_name: '', type: 'BV', points: '', amount: '', cost: '', is_gift: false,
}

const formInput = {
  padding:'8px 10px', borderRadius:RADIUS.xs, border:`1px solid ${BORDER}`, fontSize:13,
  outline:'none', color:TEXT_MAIN, background:'var(--card)', boxSizing:'border-box',
}

// props:
// id        — customer id (required)
// embedded  — true when rendered inside the desktop right-side panel
// onBack    — called when back arrow pressed (mobile/full-page mode only); defaults to navigate(-1)
// onChanged — called after any data change (transaction added/edited/deleted, reminder saved) so a parent list can refetch
export default function CustomerPanel({ id, embedded=false, onBack, onChanged, onArchived }) {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [orders, setOrders] = useState([])
  const [showOrder, setShowOrder] = useState(false) // false | { orderId: null | 訂單 id }
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info') // info | tx | sample — 先看「這個人」，不是先看帳本

  const [editReminder, setEditReminder] = useState(false)
  const [reminderDate, setReminderDate] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [linkedContact, setLinkedContact] = useState(null)
  // 同名建議：顧客還沒連到互動名單、但互動名單裡剛好有唯一一位同名的人時，問使用者是不是同一位。
  // 只是「建議」，連不連由使用者自己按（標注不自動推導）。
  const [sameNameContact, setSameNameContact] = useState(null)
  const [careSaving, setCareSaving] = useState(false)

  useEffect(() => { if (id) fetchData() }, [id])

  function suggestionDismissKey() { return `linkSuggestDismissed:${id}` }
  function isSuggestionDismissed() {
    try { return localStorage.getItem(suggestionDismissKey()) === '1' } catch { return false }
  }
  function dismissSuggestion() {
    try { localStorage.setItem(suggestionDismissKey(), '1') } catch {}
    setSameNameContact(null)
  }

  async function fetchData() {
    setLoading(true)
    setTab('info')
    setShowForm(false)
    setLinkedContact(null)
    setSameNameContact(null)
    setShowOrder(false)
    const { data: c }= await supabase.from('customers').select('*').eq('id', id).single()
    if (c) {
      setCustomer(c)
      setReminderDate(c.repurchase_reminder || '')
      if (c.contact_id) {
        const { data: ct } = await supabase.from('contacts')
          .select('id,name,egg_type,need_level,action_type,occupation')
          .eq('id', c.contact_id).single()
        if (ct) setLinkedContact(ct)
      } else if (c.name && !isSuggestionDismissed()) {
        const { data: sameName } = await supabase.from('contacts')
          .select('id,name,occupation')
          .eq('user_id', c.user_id).eq('name', c.name).eq('is_archived', false).limit(2)
        if (sameName && sameName.length === 1) setSameNameContact(sameName[0])
      }
    }
    const { data: tx } = await supabase.from('transactions')
      .select('*').eq('customer_id', id).order('date', { ascending: false })
    if (tx) setTransactions(tx)
    const { data: ord } = await supabase.from('orders').select('*').eq('customer_id', id)
    setOrders(ord || [])
    setLoading(false)
  }

  async function saveReminder() {
    await supabase.from('customers').update({ repurchase_reminder: reminderDate || null }).eq('id', id)
    setCustomer(p => ({ ...p, repurchase_reminder: reminderDate }))
    setEditReminder(false)
    onChanged?.()
  }

  async function linkSameNameContact() {
    if (!sameNameContact) return
    await supabase.from('customers').update({ contact_id: sameNameContact.id }).eq('id', id)
    onChanged?.()
    fetchData()
  }

  // 「我關心過了」：不用連到互動名單也能記下最近一次關心，首頁顧客關心卡會參考這個時間
  async function markCared() {
    if (careSaving) return
    setCareSaving(true)
    const nowIso = new Date().toISOString()
    await supabase.from('customers').update({ last_cared_at: nowIso, care_snoozed_until: null }).eq('id', id)
    setCustomer(p => ({ ...p, last_cared_at: nowIso, care_snoozed_until: null }))
    setCareSaving(false)
    onChanged?.()
  }

  async function handleArchive() {
    if (!(await askConfirm({ title:`封存「${customer.name}」？`, message:'封存後可以在顧客檔案的「封存名單」找到並復原。', okText:'封存', danger:true }))) return
    await supabase.from('customers').update({ is_archived: true }).eq('id', id)
    onChanged?.()
    if (onArchived) onArchived()
    else navigate('/customers')
  }

  function openAdd() {
    setShowForm(false)
    setEditId(null)
    setShowOrder({ orderId: null })
  }
  function openEditOrder(orderId) {
    setShowForm(false)
    setEditId(null)
    setShowOrder({ orderId })
  }
  function openEdit(tx) {
    const base = {
      date: tx.date || today(), product_name: tx.product_name || '', type: tx.type || 'BV',
      points: tx.points != null ? String(tx.points) : '',
      amount: tx.amount != null ? String(tx.amount) : '',
      cost: tx.cost != null ? String(tx.cost) : '', is_gift: !!tx.is_gift,
    }
    setForm(loadDraft(`customerTxEdit:${tx.id}`) || base)
    setEditId(tx.id)
    setShowOrder(false)
    setShowForm(true)
  }

  // 填到一半 App 關掉重開，草稿自動補回來（單人 App，不用比對資料有沒被別人改過）
  useEffect(() => {
    if (!showForm) return
    saveDraft(editId ? `customerTxEdit:${editId}` : `customerTxNew:${id}`, form)
  }, [form, showForm, editId, id])

  async function saveTx() {
    if (!form.product_name.trim() || !form.points) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      user_id: user.id, customer_id: id,
      date: form.date, product_name: form.product_name.trim(), type: form.type,
      points: parseFloat(form.points) || 0, amount: parseFloat(form.amount) || 0,
      cost: parseFloat(form.cost) || 0, is_gift: form.is_gift,
    }
    if (editId) await supabase.from('transactions').update(payload).eq('id', editId)
    else await supabase.from('transactions').insert(payload)
    clearDraft(editId ? `customerTxEdit:${editId}` : `customerTxNew:${id}`)
    setSaving(false)
    setShowForm(false)
    fetchData()
    onChanged?.()
  }

  async function deleteTx(txId) {
    await supabase.from('transactions').delete().eq('id', txId)
    setDeleteConfirm(null)
    fetchData()
    onChanged?.()
  }
  async function deleteOrder(orderId) {
    await supabase.from('transactions').delete().eq('order_id', orderId)
    await supabase.from('orders').delete().eq('id', orderId)
    setDeleteConfirm(null)
    fetchData()
    onChanged?.()
  }

  function setF(key, val) { setForm(p => ({ ...p, [key]: val })) }
  const canSave = form.product_name.trim() && form.points !== ''

  if (loading) {
    return <LoadingSpinner fullPage={false} />
  }
  if (!customer) return null

  const purchaseGroups = groupPurchases(transactions, orders)
  const totalBV = transactions.filter(t=>t.type==='BV').reduce((s,t) => s + Number(t.points), 0)
  const totalIBV = transactions.filter(t=>t.type==='IBV').reduce((s,t) => s + Number(t.points), 0)
  const totalProfit = transactions.reduce((s,t) => s + ((t.amount||0)-(t.cost||0)), 0)

  const infoRows = [
    { icon: IconPhone, label:'電話', value: customer.phone },
    { icon: IconCalendarEvent, label:'生日', value: formatBirthday(customer.birthday) },
    { icon: IconMapPin, label:'地址', value: customer.address },
    { icon: IconMail, label:'Email', value: customer.email },
    { icon: IconId, label:'載具', value: customer.carrier },
  ].filter(r => r.value)

  return (
    <div style={{ background:PAGE_BG, minHeight: embedded ? 'auto' : '100vh', paddingBottom: embedded ? 0 : 40,
      overflowX:'hidden', maxWidth:'100vw', boxSizing:'border-box' }}>

      {/* Header */}
      <div style={{ background:'var(--card)', padding: embedded ? '18px 20px 0' : '52px 16px 0', borderBottom:`1px solid ${BORDER}` }}>
        {!embedded && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <button onClick={onBack || (() => navigate(-1))}
              style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_SECONDARY, display:'flex' }}>
              <IconArrowLeft size={22} stroke={1.9} />
            </button>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => navigate(`/customers/${id}/edit`)}
                style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:`1px solid ${BORDER}`, borderRadius:RADIUS.sm,
                  padding:'6px 12px', fontSize:13, cursor:'pointer', color:TEXT_SECONDARY }}>
                <IconPencil size={14} stroke={1.9} /> 編輯
              </button>
              <button onClick={handleArchive}
                style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:`1px solid ${BORDER}`, borderRadius:RADIUS.sm,
                  padding:'6px 12px', fontSize:13, cursor:'pointer', color:TEXT_MUTED }}>
                <IconArchive size={14} stroke={1.9} /> 封存
              </button>
            </div>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:16, flexWrap:'wrap' }}>
          <div style={{ width: embedded?48:56, height: embedded?48:56, borderRadius:'50%', background:avatarBg(customer.name),
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600,
            fontSize: embedded?19:22, flexShrink:0 }}>
            {customer.name[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize: embedded?17:20, fontWeight:600, color:TEXT_MAIN }}>{customer.name}</span>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'2px 0 0' }}>
              {customer.occupation||''}{customer.occupation&&customer.phone?' · ':''}{customer.phone||''}
            </p>
          </div>
          {embedded && (
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button onClick={() => navigate(`/customers/${id}/edit`)}
                style={{ width:32, height:32, borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`, background:'var(--card)',
                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TEXT_SECONDARY }}>
                <IconPencil size={15} stroke={1.9} />
              </button>
              <button onClick={handleArchive}
                style={{ width:32, height:32, borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`, background:'var(--card)',
                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TEXT_MUTED }}>
                <IconArchive size={15} stroke={1.9} />
              </button>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:20 }}>
          {[{ key:'info', label:'認識這個人' }, { key:'tx', label:'消費紀錄' }, { key:'sample', label:'試用品' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background:'none', border:'none', cursor:'pointer', padding:'0 0 10px',
                fontSize:13, fontWeight:600, color: tab===t.key ? PRIMARY : TEXT_MUTED,
                borderBottom: tab===t.key ? `2px solid ${PRIMARY}` : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: embedded ? '16px 20px 24px' : '16px' }}>

        {tab === 'tx' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <div style={{ flex:1, background:'var(--yellow-soft)', borderRadius:RADIUS.md, padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:11, fontWeight:600, color:ACCENT_YELLOW_TEXT, margin:'0 0 2px' }}>BV</p>
                <p style={{ fontSize:16, fontWeight:600, color:TEXT_MAIN, margin:0 }}>{totalBV.toFixed(0)}</p>
              </div>
              <div style={{ flex:1, background:'var(--primary-soft)', borderRadius:RADIUS.md, padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:11, fontWeight:600, color:PRIMARY, margin:'0 0 2px' }}>IBV</p>
                <p style={{ fontSize:16, fontWeight:600, color:TEXT_MAIN, margin:0 }}>{totalIBV.toFixed(0)}</p>
              </div>
              <div style={{ flex:1, background:ACCENT_GREEN_SOFT, borderRadius:RADIUS.md, padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:11, fontWeight:600, color:ACCENT_GREEN_TEXT, margin:'0 0 2px' }}>獲利</p>
                <p style={{ fontSize:14, fontWeight:600, color:ACCENT_GREEN_TEXT, margin:0 }}>NT${totalProfit.toLocaleString()}</p>
              </div>
            </div>

            {showOrder ? (
              <div style={{ border:`1px solid ${BORDER}`, borderRadius:RADIUS.md, padding:12, marginBottom:16, background:SUBCARD_BG }}>
                <OrderForm
                  key={showOrder.orderId || 'new'}
                  userId={customer.user_id}
                  customerId={id}
                  customerName={customer.name}
                  orderId={showOrder.orderId}
                  onDone={() => { setShowOrder(false); fetchData(); onChanged?.() }}
                  onCancel={() => setShowOrder(false)}
                />
              </div>
            ) : !showForm ? (
              <button onClick={openAdd}
                style={{ width:'100%', padding:'10px', borderRadius:RADIUS.sm, border:`1px dashed ${PRIMARY}`,
                  background:'var(--primary-soft)', color:PRIMARY, fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:16 }}>
                + 新增消費紀錄
              </button>
            ) : (
              <div style={{ border:`1px solid ${BORDER}`, borderRadius:RADIUS.md, padding:14, marginBottom:16, background:SUBCARD_BG }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:TEXT_MAIN }}>{editId?'編輯消費紀錄':'新增消費紀錄'}</span>
                  <button onClick={() => setShowForm(false)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED, display:'flex' }}>
                    <IconX size={18} />
                  </button>
                </div>
                <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                  <DateField value={form.date} onChange={e => setF('date', e.target.value)}
                    style={{ ...formInput, flex:1, minWidth:130 }} />
                  <div style={{ display:'flex', gap:6 }}>
                    {['BV','IBV'].map(type => (
                      <button key={type} onClick={() => setF('type', type)}
                        style={{ padding:'0 12px', borderRadius:RADIUS.sm, fontSize:13, fontWeight:600, cursor:'pointer', border:'none',
                          background: form.type===type?(type==='BV'?ACCENT_YELLOW:PRIMARY):'var(--card)',
                          color: form.type===type?(type==='BV'?'#5B3200':'#fff'):TEXT_SECONDARY }}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <input placeholder="產品名稱" value={form.product_name}
                  onChange={e => setF('product_name', e.target.value)} style={{ ...formInput, width:'100%', marginBottom:8 }} />
                <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                  <input type="number" placeholder="點數" value={form.points}
                    onChange={e => setF('points', e.target.value)} style={{ ...formInput, flex:1, minWidth:80 }} />
                  <input type="number" placeholder="售價 NT$" value={form.amount}
                    onChange={e => setF('amount', e.target.value)} style={{ ...formInput, flex:1, minWidth:80 }} />
                  <input type="number" placeholder="成本 NT$" value={form.cost}
                    onChange={e => setF('cost', e.target.value)} style={{ ...formInput, flex:1, minWidth:80 }} />
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:TEXT_MAIN, marginBottom:12, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.is_gift} onChange={e => setF('is_gift', e.target.checked)} />
                  這是贈品（不計入獲利）
                </label>
                <button onClick={saveTx} disabled={saving || !canSave}
                  style={{ width:'100%', padding:'10px', borderRadius:RADIUS.sm, border:'none',
                    background: canSave ? PRIMARY : 'var(--border2)', color:'#fff', fontSize:13, fontWeight:600,
                    cursor: canSave ? 'pointer' : 'not-allowed' }}>
                  {saving ? '儲存中…' : editId ? '儲存修改' : '確認新增'}
                </button>
              </div>
            )}

            {transactions.length === 0 ? (
              <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'20px 0' }}>還沒有消費紀錄</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column' }}>
                {purchaseGroups.map((g, i) => g.orderId ? (
                  <OrderCard key={g.key} group={g} customerName={customer.name}
                    onEdit={openEditOrder} onDelete={(oid) => setDeleteConfirm({ kind:'order', id:oid })} />
                ) : (() => { const t = g.lines[0]; return (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0',
                    borderBottom: i < purchaseGroups.length-1 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:14, fontWeight:600, color:TEXT_MAIN }}>{t.product_name}</span>
                        <span style={{ fontSize:11, padding:'1px 6px', borderRadius:RADIUS.pill, fontWeight:600,
                          background: t.type==='BV'?'var(--yellow-soft)':'var(--primary-soft)', color: t.type==='BV'?ACCENT_YELLOW_TEXT:PRIMARY }}>
                          {t.type}
                        </span>
                        {t.is_gift && (
                          <span style={{ fontSize:11, color:TEXT_MUTED, fontWeight:600, display:'flex', alignItems:'center', gap:2 }}>
                            <IconGift size={11} stroke={1.9} /> 贈品
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize:12, color:TEXT_MUTED, margin:'2px 0 0' }}>{formatDate(t.date)}</p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:TEXT_MAIN, margin:0 }}>{Number(t.points).toFixed(0)} 點</p>
                      <p style={{ fontSize:12, color: t.is_gift?TEXT_MUTED:ACCENT_GREEN_TEXT, margin:'2px 0 0' }}>
                        {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${((t.amount||0)-(t.cost||0)).toLocaleString()}`}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={() => openEdit(t)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED, display:'flex' }}>
                        <IconPencil size={13} stroke={1.9} />
                      </button>
                      <button onClick={() => setDeleteConfirm({ kind:'tx', id:t.id })}
                        style={{ background:'none', border:'none', cursor:'pointer', color:DANGER, display:'flex' }}>
                        <IconTrash size={13} stroke={1.9} />
                      </button>
                    </div>
                  </div>
                ) })())}
              </div>
            )}
          </>
        )}

        {tab === 'sample' && (
          <SampleSection key={id} contactId={customer?.contact_id || null} customerId={id} onChanged={onChanged} />
        )}

        {tab === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {!linkedContact && sameNameContact && (
              <div style={{ background:PRIMARY_SOFT, borderRadius:RADIUS.sm, padding:'10px 12px' }}>
                <p style={{ fontSize:12, color:TEXT_MAIN, margin:'0 0 8px', lineHeight:1.6, wordBreak:'break-word', overflowWrap:'anywhere' }}>
                  互動名單裡也有一位叫「{sameNameContact.name}」{sameNameContact.occupation ? `（${sameNameContact.occupation}）` : ''}，是同一位嗎？
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={linkSameNameContact}
                    style={{ fontSize:12, color:PRIMARY, background:'var(--card)', border:`1px solid ${BORDER}`,
                      borderRadius:RADIUS.xs, padding:'6px 12px', cursor:'pointer', fontWeight:600 }}>是，連起來</button>
                  <button onClick={dismissSuggestion}
                    style={{ fontSize:12, color:TEXT_MUTED, background:'none', border:'none', cursor:'pointer' }}>不是同一位</button>
                </div>
              </div>
            )}

            {linkedContact && (
              <div style={{ display:'flex', alignItems:'center', gap:10,
                background:PRIMARY_SOFT, borderRadius:RADIUS.sm, padding:'10px 12px' }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:11, color:TEXT_SECONDARY, margin:'0 0 4px', fontWeight:600 }}>互動名單關係</p>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    {linkedContact.egg_type && (
                      <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:RADIUS.xs,
                        background:getEggBg(linkedContact.egg_type), color:getEggColor(linkedContact.egg_type) }}>
                        {linkedContact.egg_type}
                      </span>
                    )}
                    {linkedContact.need_level && (
                      <span style={{ fontSize:12, color:TEXT_MAIN }}>{linkedContact.need_level}</span>
                    )}
                    {linkedContact.action_type && (
                      <span style={{ fontSize:12, color:TEXT_MUTED }}>· {linkedContact.action_type}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => navigate(`/contacts/${linkedContact.id}`)}
                  style={{ fontSize:12, color:PRIMARY, background:'var(--card)', border:`1px solid ${BORDER}`,
                    borderRadius:RADIUS.xs, padding:'6px 12px', cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                  查看互動名單
                </button>
              </div>
            )}

            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
              background:'var(--card)', border:`1px solid ${BORDER}`, borderRadius:RADIUS.card, padding:'12px 14px', gap:8 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <IconBell size={16} stroke={1.8} color={TEXT_SECONDARY} style={{ marginTop:1, flexShrink:0 }} />
                <div>
                  <p style={{ fontSize:11, color:TEXT_MUTED, margin:'0 0 2px' }}>回購提醒</p>
                  {editReminder ? (
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <DateField value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                        style={{ padding:'5px 8px', borderRadius:RADIUS.xs, border:`1px solid ${BORDER}`, fontSize:12, outline:'none' }} />
                      <button onClick={saveReminder}
                        style={{ background:'none', border:'none', cursor:'pointer', color:ACCENT_GREEN_TEXT, display:'flex' }}>
                        <IconCheck size={16} stroke={2} />
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize:13, color: customer.repurchase_reminder?TEXT_MAIN:TEXT_MUTED, margin:0 }}>
                      {customer.repurchase_reminder ? formatDate(customer.repurchase_reminder) : '尚未設定'}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setEditReminder(v => !v)}
                style={{ fontSize:12, color:PRIMARY, background:'none', border:'none', cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                {editReminder ? '取消' : '設定'}
              </button>
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'var(--card)', border:`1px solid ${BORDER}`, borderRadius:RADIUS.card, padding:'12px 14px', gap:8 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <IconHeart size={16} stroke={1.8} color={TEXT_SECONDARY} style={{ marginTop:1, flexShrink:0 }} />
                <div>
                  <p style={{ fontSize:11, color:TEXT_MUTED, margin:'0 0 2px' }}>最近一次關心</p>
                  <p style={{ fontSize:13, color: customer.last_cared_at ? TEXT_MAIN : TEXT_MUTED, margin:0 }}>
                    {customer.last_cared_at ? formatDate(toDateStr(new Date(customer.last_cared_at))) : '還沒記錄'}
                  </p>
                </div>
              </div>
              <button onClick={markCared} disabled={careSaving}
                style={{ fontSize:12, color:PRIMARY, background:'none', border:'none', cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                我關心過了
              </button>
            </div>

            {infoRows.length === 0 ? (
              <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'12px 0' }}>還不太了解這個人，之後想到什麼可以補在編輯裡</p>
            ) : infoRows.map(r => (
              <div key={r.label} style={{ display:'flex', alignItems:'flex-start', gap:10,
                background:'var(--card)', border:`1px solid ${BORDER}`, borderRadius:RADIUS.card, padding:'12px 14px' }}>
                <r.icon size={16} stroke={1.8} color={TEXT_SECONDARY} style={{ marginTop:1, flexShrink:0 }} />
                <div>
                  <p style={{ fontSize:11, color:TEXT_MUTED, margin:'0 0 2px' }}>{r.label}</p>
                  <p style={{ fontSize:13, color:TEXT_MAIN, margin:0 }}>{r.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'var(--overlay)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
          onClick={e => { if (e.target===e.currentTarget) setDeleteConfirm(null) }}>
          <div style={{ background:'var(--card)', borderRadius:RADIUS.xl, padding:24, width:'100%', maxWidth:320 }}>
            <p style={{ fontSize:16, fontWeight:600, color:TEXT_MAIN, margin:'0 0 8px', textAlign:'center' }}>確定要刪除？</p>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'0 0 20px', textAlign:'center' }}>
              {deleteConfirm.kind === 'order' ? '這張訂單和裡面所有產品的紀錄將永久刪除，無法復原' : '這筆消費紀錄將永久刪除，無法復原'}
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex:1, padding:'12px', borderRadius:RADIUS.md, border:`1px solid ${BORDER}`, background:'var(--card)',
                  fontSize:14, fontWeight:600, cursor:'pointer', color:TEXT_SECONDARY }}>
                取消
              </button>
              <button onClick={() => (deleteConfirm.kind === 'order' ? deleteOrder(deleteConfirm.id) : deleteTx(deleteConfirm.id))}
                style={{ flex:1, padding:'12px', borderRadius:RADIUS.md, border:'none', background:DANGER, color:'#fff',
                  fontSize:14, fontWeight:600, cursor:'pointer' }}>
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
