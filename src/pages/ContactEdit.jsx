import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'

import { PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, DANGER, BORDER, RADIUS } from './designTokens'

const EGG_TYPES = ['茶葉蛋', '荷包蛋', '生雞蛋']
const NEED_LEVELS = ['大一', '大二', '大三', '大四']
const PLATFORMS = ['IG', 'FB', 'LINE', '其他']
const ACTION_TYPES = ['輕鬆互動', '軟性活動', '商機講座', '直接法']

const ACTION_MAP = {
  '茶葉蛋':{'大一':'軟性活動','大二':'商機講座','大三':'直接法','大四':'直接法'},
  '荷包蛋':{'大一':'輕鬆互動','大二':'軟性活動','大三':'商機講座','大四':'直接法'},
  '生雞蛋':{'大一':'輕鬆互動','大二':'輕鬆互動','大三':'軟性活動','大四':'商機講座'},
}
const DAYS_MAP = {'輕鬆互動':30,'軟性活動':14,'商機講座':5,'直接法':5}

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
        style={{ flex:1,padding:'11px 8px',borderRadius:RADIUS.md,border:`1px solid ${BORDER}`,
          fontSize:14,background:'#fff',outline:'none',
          color:mm?TEXT_MAIN:TEXT_MUTED,appearance:'none',WebkitAppearance:'none' }}>
        <option value=''>月份</option>
        {months.map(m => <option key={m} value={m}>{Number(m)} 月</option>)}
      </select>
      <select value={dd} onChange={e => handleChange(mm, e.target.value)}
        style={{ flex:1,padding:'11px 8px',borderRadius:RADIUS.md,border:`1px solid ${BORDER}`,
          fontSize:14,background:'#fff',outline:'none',
          color:dd?TEXT_MAIN:TEXT_MUTED,appearance:'none',WebkitAppearance:'none' }}>
        <option value=''>日期</option>
        {days.map(d => <option key={d} value={d}>{Number(d)} 日</option>)}
      </select>
    </div>
  )
}

export default function ContactEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [form, setForm] = useState(null)
  // 記住剛載入時的 action_type，存檔時只有「真的被改過」才重算跟進日，
  // 不然單純改職業/地區這種無關欄位也會意外把跟進日往後推
  const [originalActionType, setOriginalActionType] = useState(null)

  useEffect(() => { fetchContact() }, [id])

  async function fetchContact() {
    const { data } = await supabase.from('contacts').select('*').eq('id', id).single()
    if (data) {
      setForm({
        name: data.name || '',
        platform: data.platform || '',
        platform_account: data.platform_account || '',
        egg_type: data.egg_type || '',
        need_level: data.need_level || '',
        action_type: data.action_type || '',
        occupation: data.occupation || '',
        region: data.region || '',
        note: data.note || '',
        pain_point: data.pain_point || '',
        asked_products: data.asked_products || '',
        birthday: data.birthday || '',
      })
      setOriginalActionType(data.action_type || '')
      if (data.occupation || data.region || data.note || data.pain_point || data.asked_products || data.birthday) {
        setShowMore(true)
      }
    }
  }

  function set(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'egg_type' || key === 'need_level') {
        const egg = key === 'egg_type' ? val : prev.egg_type
        const need = key === 'need_level' ? val : prev.need_level
        if (egg && need) next.action_type = ACTION_MAP[egg]?.[need] || prev.action_type
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)

    // 只有 action_type 真的跟原本不一樣時，才重新計算跟進日；
    // 單純編輯其他欄位不應該動到跟進倒數
    let next_contact_date = undefined
    if (form.action_type && form.action_type !== originalActionType) {
      const d = new Date()
      d.setDate(d.getDate() + (DAYS_MAP[form.action_type] || 30))
      next_contact_date = d.toISOString().split('T')[0]
    }

    const update = {
      name: form.name.trim(),
      platform: form.platform || null,
      platform_account: form.platform_account || null,
      egg_type: form.egg_type || null,
      need_level: form.need_level || null,
      action_type: form.action_type || null,
      occupation: form.occupation || null,
      region: form.region || null,
      note: form.note || null,
      pain_point: form.pain_point || null,
      asked_products: form.asked_products || null,
      birthday: form.birthday || null,
    }
    if (next_contact_date) update.next_contact_date = next_contact_date

    await supabase.from('contacts').update(update).eq('id', id)
    setSaving(false)
    navigate(`/contacts/${id}`)
  }

  if (!form) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:TEXT_MUTED }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:'#fff',minHeight:'100vh' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div style={{ background:'#fff',padding:'52px 0 16px',
        borderBottom:`1px solid ${BORDER}` }}>
      <div className="dash-container" style={{ padding:'0 16px',display:'flex',alignItems:'center',gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_SECONDARY,display:'flex' }}><IconArrowLeft size={22} stroke={1.9} /></button>
        <h1 style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,margin:0 }}>編輯聯絡人</h1>
      </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px 100px' }}>

        <div style={fw}>
          <label style={lb}>姓名 <span style={{ color:DANGER }}>*</span></label>
          <input value={form.name} onChange={e=>set('name',e.target.value)} style={inp} />
        </div>

        <div style={fw}>
          <label style={lb}>社群平台</label>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => set('platform', form.platform===p?'':p)}
                style={{ ...chip, background:form.platform===p?PRIMARY:'#F5F8FC',
                  color:form.platform===p?'#fff':TEXT_SECONDARY }}>{p}</button>
            ))}
          </div>
          {form.platform && (
            <input value={form.platform_account} onChange={e=>set('platform_account',e.target.value)}
              placeholder="@username..." style={{ ...inp, marginTop:8 }} />
          )}
        </div>

        <div style={fw}>
          <label style={lb}>蛋型</label>
          <div style={{ display:'flex',gap:8 }}>
            {EGG_TYPES.map(e => (
              <button key={e} onClick={() => set('egg_type', form.egg_type===e?'':e)}
                style={{ ...chip, flex:1,
                  background:form.egg_type===e?PRIMARY:'#F5F8FC',
                  color:form.egg_type===e?'#fff':TEXT_SECONDARY }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={fw}>
          <label style={lb}>需求度</label>
          <div style={{ display:'flex',gap:8 }}>
            {NEED_LEVELS.map(n => (
              <button key={n} onClick={() => set('need_level', form.need_level===n?'':n)}
                style={{ ...chip, flex:1,
                  background:form.need_level===n?PRIMARY:'#F5F8FC',
                  color:form.need_level===n?'#fff':TEXT_SECONDARY }}>{n}</button>
            ))}
          </div>
        </div>

        <div style={fw}>
          <label style={lb}>行動類型</label>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            {ACTION_TYPES.map(a => (
              <button key={a} onClick={() => set('action_type', a)}
                style={{ ...chip,
                  background:form.action_type===a?PRIMARY:'#F5F8FC',
                  color:form.action_type===a?'#fff':TEXT_SECONDARY }}>{a}</button>
            ))}
          </div>
          {form.action_type !== originalActionType && (
            <p style={{ fontSize:11,color:PRIMARY,margin:'6px 0 0' }}>
              行動類型已變更，儲存後會依新類型重新計算下次跟進日
            </p>
          )}
        </div>

        <button onClick={() => setShowMore(v=>!v)}
          style={{ width:'100%',padding:'10px',background:'none',border:`1px dashed ${BORDER}`,
            borderRadius:RADIUS.md,color:TEXT_SECONDARY,fontSize:13,cursor:'pointer',marginBottom:16 }}>
          {showMore ? '收起 ▲' : '展開更多 ▼'}
        </button>

        {showMore && (
          <>
            {[
              { key:'occupation', label:'職業', placeholder:'輸入職業...' },
              { key:'region', label:'居住地區', placeholder:'例：高雄市左營區' },
              { key:'note', label:'認識管道／備註', placeholder:'例：福氣教會' },
              { key:'pain_point', label:'痛點／現況', placeholder:'關鍵字...' },
              { key:'asked_products', label:'詢問過的產品', placeholder:'例：益生十菌' },
            ].map(f => (
              <div key={f.key} style={fw}>
                <label style={lb}>{f.label}</label>
                <input value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
                  placeholder={f.placeholder} style={inp} />
              </div>
            ))}

            <div style={fw}>
              <label style={lb}>生日</label>
              <BirthdayPicker value={form.birthday} onChange={v => set('birthday', v)} />
              <p style={{ fontSize:11,color:TEXT_MUTED,margin:'4px 0 0' }}>只記月份和日期，每年都能提醒</p>
            </div>
          </>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%',padding:'14px',borderRadius:RADIUS.lg,border:'none',
            background:saving?'#9BBBF2':PRIMARY,color:'#fff',
            fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  )
}

const fw = { marginBottom: 16 }
const lb = { fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'block',marginBottom:6 }
const inp = { width:'100%',padding:'11px 12px',borderRadius:RADIUS.md,border:`1px solid ${BORDER}`,
  fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:TEXT_MAIN }
const chip = { padding:'7px 14px',borderRadius:RADIUS.sm,border:'none',fontSize:13,fontWeight:600,cursor:'pointer' }
