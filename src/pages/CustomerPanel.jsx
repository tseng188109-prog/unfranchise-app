import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconPencil, IconX, IconGift, IconPhone, IconMail,
  IconMapPin, IconCalendarEvent, IconId, IconBell, IconTrash, IconCheck,
} from '@tabler/icons-react'

const PRIMARY = '#1668E3'
const TEXT_MAIN = '#132A4D'
const TEXT_MUTED = '#9FAEC2'
const TEXT_SECONDARY = '#7C8CA3'
const ACCENT_YELLOW = '#FFD166'
const ACCENT_YELLOW_TEXT = '#9A6A16'
const ACCENT_GREEN_SOFT = '#E8F9F1'
const ACCENT_GREEN_TEXT = '#2C9C6A'
const DANGER = '#E0454A'
const BORDER = '#F0F1F4'
const SUBCARD_BG = '#F5F8FC'

function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}
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
  padding:'8px 10px', borderRadius:8, border:`1px solid ${BORDER}`, fontSize:13,
  outline:'none', color:TEXT_MAIN, background:'#fff', boxSizing:'border-box',
}

// props:
// id        — customer id (required)
// embedded  — true when rendered inside the desktop right-side panel
// onBack    — called when back arrow pressed (mobile/full-page mode only); defaults to navigate(-1)
// onChanged — called after any data change (transaction added/edited/deleted, reminder saved) so a parent list can refetch
export default function CustomerPanel({ id, embedded=false, onBack, onChanged }) {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tx') // tx | info

  const [editReminder, setEditReminder] = useState(false)
  const [reminderDate, setReminderDate] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => { if (id) fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    setTab('tx')
    setShowForm(false)
    const { data: c } = await supabase.from('customers').select('*').eq('id', id).single()
    if (c) { setCustomer(c); setReminderDate(c.repurchase_reminder || '') }
    const { data: tx } = await supabase.from('transactions')
      .select('*').eq('customer_id', id).order('date', { ascending: false })
    if (tx) setTransactions(tx)
    setLoading(false)
  }

  async function saveReminder() {
    await supabase.from('customers').update({ repurchase_reminder: reminderDate || null }).eq('id', id)
    setCustomer(p => ({ ...p, repurchase_reminder: reminderDate }))
    setEditReminder(false)
    onChanged?.()
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }
  function openEdit(tx) {
    setForm({
      date: tx.date || today(), product_name: tx.product_name || '', type: tx.type || 'BV',
      points: tx.points != null ? String(tx.points) : '',
      amount: tx.amount != null ? String(tx.amount) : '',
      cost: tx.cost != null ? String(tx.cost) : '', is_gift: !!tx.is_gift,
    })
    setEditId(tx.id)
    setShowForm(true)
  }

  async function saveTx() {
    if (!form.product_name.trim() || !form.points) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      user_id: user.id, customer_id: id, customer_name: customer.name, customer_phone: customer.phone || null,
      date: form.date, product_name: form.product_name.trim(), type: form.type,
      points: parseFloat(form.points) || 0, amount: parseFloat(form.amount) || 0,
      cost: parseFloat(form.cost) || 0, is_gift: form.is_gift,
    }
    if (editId) await supabase.from('transactions').update(payload).eq('id', editId)
    else await supabase.from('transactions').insert(payload)
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

  function setF(key, val) { setForm(p => ({ ...p, [key]: val })) }
  const canSave = form.product_name.trim() && form.points !== ''

  if (loading) {
    return <div style={{ padding:60, textAlign:'center', color:TEXT_MUTED, fontSize:14 }}>載入中…</div>
  }
  if (!customer) return null

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
    <div style={{ background:'#fff', minHeight: embedded ? 'auto' : '100vh', paddingBottom: embedded ? 0 : 40 }}>

      {/* Header */}
      <div style={{ padding: embedded ? '18px 20px 0' : '52px 16px 0', borderBottom:`1px solid ${BORDER}` }}>
        {!embedded && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <button onClick={onBack || (() => navigate(-1))}
              style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_SECONDARY, display:'flex' }}>
              <IconArrowLeft size={22} stroke={1.9} />
            </button>
            <button onClick={() => navigate(`/customers/${id}/edit`)}
              style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:`1px solid ${BORDER}`, borderRadius:10,
                padding:'6px 12px', fontSize:13, cursor:'pointer', color:TEXT_SECONDARY }}>
              <IconPencil size={14} stroke={1.9} /> 編輯
            </button>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:16, flexWrap:'wrap' }}>
          <div style={{ width: embedded?48:56, height: embedded?48:56, borderRadius:'50%', background:avatarBg(customer.name),
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700,
            fontSize: embedded?19:22, flexShrink:0 }}>
            {customer.name[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize: embedded?17:20, fontWeight:700, color:TEXT_MAIN }}>{customer.name}</span>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'2px 0 0' }}>
              {customer.occupation||''}{customer.occupation&&customer.phone?' · ':''}{customer.phone||''}
            </p>
          </div>
          {embedded && (
            <button onClick={() => navigate(`/customers/${id}/edit`)}
              style={{ width:32, height:32, borderRadius:9, border:`1px solid ${BORDER}`, background:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TEXT_SECONDARY, flexShrink:0 }}>
              <IconPencil size={15} stroke={1.9} />
            </button>
          )}
        </div>
        <div style={{ display:'flex', gap:20 }}>
          {[{ key:'tx', label:'消費紀錄' }, { key:'info', label:'資料' }].map(t => (
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
              <div style={{ flex:1, background:'#FFF7E6', borderRadius:12, padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:10, fontWeight:700, color:ACCENT_YELLOW_TEXT, margin:'0 0 2px' }}>BV</p>
                <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:0 }}>{totalBV.toFixed(0)}</p>
              </div>
              <div style={{ flex:1, background:'#EEF3FB', borderRadius:12, padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:10, fontWeight:700, color:PRIMARY, margin:'0 0 2px' }}>IBV</p>
                <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:0 }}>{totalIBV.toFixed(0)}</p>
              </div>
              <div style={{ flex:1, background:ACCENT_GREEN_SOFT, borderRadius:12, padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:10, fontWeight:700, color:ACCENT_GREEN_TEXT, margin:'0 0 2px' }}>獲利</p>
                <p style={{ fontSize:14, fontWeight:700, color:ACCENT_GREEN_TEXT, margin:0 }}>NT${totalProfit.toLocaleString()}</p>
              </div>
            </div>

            {!showForm ? (
              <button onClick={openAdd}
                style={{ width:'100%', padding:'10px', borderRadius:10, border:`1px dashed ${PRIMARY}`,
                  background:'#EEF3FB', color:PRIMARY, fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:16 }}>
                + 新增消費紀錄
              </button>
            ) : (
              <div style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:14, marginBottom:16, background:SUBCARD_BG }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN }}>{editId?'編輯消費紀錄':'新增消費紀錄'}</span>
                  <button onClick={() => setShowForm(false)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED, display:'flex' }}>
                    <IconX size={18} />
                  </button>
                </div>
                <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                  <input type="date" value={form.date} onChange={e => setF('date', e.target.value)}
                    style={{ ...formInput, flex:1, minWidth:130 }} />
                  <div style={{ display:'flex', gap:6 }}>
                    {['BV','IBV'].map(type => (
                      <button key={type} onClick={() => setF('type', type)}
                        style={{ padding:'0 12px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', border:'none',
                          background: form.type===type?(type==='BV'?ACCENT_YELLOW:PRIMARY):'#fff',
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
                  style={{ width:'100%', padding:'10px', borderRadius:10, border:'none',
                    background: canSave ? PRIMARY : '#D8DCE8', color:'#fff', fontSize:13, fontWeight:700,
                    cursor: canSave ? 'pointer' : 'not-allowed' }}>
                  {saving ? '儲存中…' : editId ? '儲存修改' : '確認新增'}
                </button>
              </div>
            )}

            {transactions.length === 0 ? (
              <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'20px 0' }}>還沒有消費紀錄</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column' }}>
                {transactions.map((t, i) => (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0',
                    borderBottom: i < transactions.length-1 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:14, fontWeight:600, color:TEXT_MAIN }}>{t.product_name}</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, fontWeight:700,
                          background: t.type==='BV'?'#FFF7E6':'#EEF3FB', color: t.type==='BV'?ACCENT_YELLOW_TEXT:PRIMARY }}>
                          {t.type}
                        </span>
                        {t.is_gift && (
                          <span style={{ fontSize:10, color:TEXT_MUTED, fontWeight:600, display:'flex', alignItems:'center', gap:2 }}>
                            <IconGift size={11} stroke={1.9} /> 贈品
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize:12, color:TEXT_MUTED, margin:'2px 0 0' }}>{formatDate(t.date)}</p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:13, fontWeight:700, color:TEXT_MAIN, margin:0 }}>{Number(t.points).toFixed(0)} 點</p>
                      <p style={{ fontSize:12, color: t.is_gift?TEXT_MUTED:ACCENT_GREEN_TEXT, margin:'2px 0 0' }}>
                        {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${((t.amount||0)-(t.cost||0)).toLocaleString()}`}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={() => openEdit(t)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:TEXT_MUTED, display:'flex' }}>
                        <IconPencil size={13} stroke={1.9} />
                      </button>
                      <button onClick={() => setDeleteConfirm(t.id)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:DANGER, display:'flex' }}>
                        <IconTrash size={13} stroke={1.9} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
              background:SUBCARD_BG, borderRadius:10, padding:'10px 12px', gap:8 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <IconBell size={16} stroke={1.8} color={TEXT_SECONDARY} style={{ marginTop:1, flexShrink:0 }} />
                <div>
                  <p style={{ fontSize:11, color:TEXT_MUTED, margin:'0 0 2px' }}>回購提醒</p>
                  {editReminder ? (
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                        style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${BORDER}`, fontSize:12, outline:'none' }} />
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
                style={{ fontSize:12, color:PRIMARY, background:'none', border:'none', cursor:'pointer', fontWeight:700, flexShrink:0 }}>
                {editReminder ? '取消' : '設定'}
              </button>
            </div>

            {infoRows.length === 0 ? (
              <p style={{ fontSize:13, color:TEXT_MUTED, textAlign:'center', padding:'12px 0' }}>還沒有補充資料</p>
            ) : infoRows.map(r => (
              <div key={r.label} style={{ display:'flex', alignItems:'flex-start', gap:10,
                background:SUBCARD_BG, borderRadius:10, padding:'10px 12px' }}>
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
        <div style={{ position:'fixed', inset:0, background:'rgba(19,42,77,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
          onClick={e => { if (e.target===e.currentTarget) setDeleteConfirm(null) }}>
          <div style={{ background:'#fff', borderRadius:18, padding:24, width:'100%', maxWidth:320 }}>
            <p style={{ fontSize:16, fontWeight:700, color:TEXT_MAIN, margin:'0 0 8px', textAlign:'center' }}>確定要刪除？</p>
            <p style={{ fontSize:13, color:TEXT_MUTED, margin:'0 0 20px', textAlign:'center' }}>這筆消費紀錄將永久刪除，無法復原</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex:1, padding:'12px', borderRadius:12, border:`1px solid ${BORDER}`, background:'#fff',
                  fontSize:14, fontWeight:600, cursor:'pointer', color:TEXT_SECONDARY }}>
                取消
              </button>
              <button onClick={() => deleteTx(deleteConfirm)}
                style={{ flex:1, padding:'12px', borderRadius:12, border:'none', background:DANGER, color:'#fff',
                  fontSize:14, fontWeight:700, cursor:'pointer' }}>
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
