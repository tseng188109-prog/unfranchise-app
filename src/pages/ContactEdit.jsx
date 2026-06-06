import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useParams } from 'react-router-dom'

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

export default function ContactEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [form, setForm] = useState(null)
  const [birthdayError, setBirthdayError] = useState('')

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
        birthday: data.birthday || '',   // MM-DD 格式
      })
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
    if (key === 'birthday') setBirthdayError('')
  }

  async function handleSave() {
    if (!form.name.trim()) return

    // 驗證生日格式
    if (form.birthday && !/^\d{2}-\d{2}$/.test(form.birthday)) {
      setBirthdayError('格式需為 MM-DD，例：03-15')
      setShowMore(true)
      return
    }

    setSaving(true)

    let next_contact_date = undefined
    if (form.action_type) {
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
      <p style={{ color:'#9CA3AF' }}>載入中…</p>
    </div>
  )

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh' }}>
      <div style={{ background:'#fff',padding:'52px 16px 16px',
        borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151' }}>←</button>
        <h1 style={{ fontSize:18,fontWeight:800,color:'#111827',margin:0 }}>編輯聯絡人</h1>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>

        <div style={fw}>
          <label style={lb}>姓名 <span style={{ color:'#EF4444' }}>*</span></label>
          <input value={form.name} onChange={e=>set('name',e.target.value)} style={inp} />
        </div>

        <div style={fw}>
          <label style={lb}>社群平台</label>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => set('platform', form.platform===p?'':p)}
                style={{ ...chip, background:form.platform===p?'#2563EB':'#F3F4F6',
                  color:form.platform===p?'#fff':'#374151' }}>{p}</button>
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
                  background:form.egg_type===e?'#2563EB':'#F3F4F6',
                  color:form.egg_type===e?'#fff':'#374151' }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={fw}>
          <label style={lb}>需求度</label>
          <div style={{ display:'flex',gap:8 }}>
            {NEED_LEVELS.map(n => (
              <button key={n} onClick={() => set('need_level', form.need_level===n?'':n)}
                style={{ ...chip, flex:1,
                  background:form.need_level===n?'#2563EB':'#F3F4F6',
                  color:form.need_level===n?'#fff':'#374151' }}>{n}</button>
            ))}
          </div>
        </div>

        <div style={fw}>
          <label style={lb}>行動類型</label>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
            {ACTION_TYPES.map(a => (
              <button key={a} onClick={() => set('action_type', a)}
                style={{ ...chip,
                  background:form.action_type===a?'#2563EB':'#F3F4F6',
                  color:form.action_type===a?'#fff':'#374151' }}>{a}</button>
            ))}
          </div>
        </div>

        <button onClick={() => setShowMore(v=>!v)}
          style={{ width:'100%',padding:'10px',background:'none',border:'1px dashed #D1D5DB',
            borderRadius:10,color:'#6B7280',fontSize:13,cursor:'pointer',marginBottom:16 }}>
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

            {/* 生日 */}
            <div style={fw}>
              <label style={lb}>生日</label>
              <input
                value={form.birthday}
                onChange={e => set('birthday', e.target.value)}
                placeholder="MM-DD，例：03-15"
                style={{ ...inp, border:`1px solid ${birthdayError?'#EF4444':'#E5E7EB'}` }}
              />
              {birthdayError
                ? <p style={{ fontSize:12,color:'#EF4444',margin:'4px 0 0' }}>{birthdayError}</p>
                : <p style={{ fontSize:11,color:'#9CA3AF',margin:'4px 0 0' }}>只填月份和日期，不需要年份</p>
              }
            </div>
          </>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
            background:saving?'#93C5FD':'#2563EB',color:'#fff',
            fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  )
}

const fw = { marginBottom: 16 }
const lb = { fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:6 }
const inp = { width:'100%',padding:'11px 12px',borderRadius:10,border:'1px solid #E5E7EB',
  fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:'#111827' }
const chip = { padding:'7px 14px',borderRadius:8,border:'none',fontSize:13,fontWeight:600,cursor:'pointer' }
