import { useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

const EGG_TYPES = ['茶葉蛋', '荷包蛋', '生雞蛋']
const NEED_LEVELS = ['大一', '大二', '大三', '大四']
const PLATFORMS = ['IG', 'FB', 'LINE', '其他']

const ACTION_MAP = {
  '茶葉蛋': { '大一':'軟性活動','大二':'商機講座','大三':'直接法','大四':'直接法' },
  '荷包蛋': { '大一':'輕鬆互動','大二':'軟性活動','大三':'商機講座','大四':'直接法' },
  '生雞蛋': { '大一':'輕鬆互動','大二':'輕鬆互動','大三':'軟性活動','大四':'商機講座' },
}
const DAYS_MAP = { '輕鬆互動':30,'軟性活動':14,'商機講座':5,'直接法':5 }

function getAction(egg, need) {
  return ACTION_MAP[egg]?.[need] || ''
}

export default function ContactNew() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const [form, setForm] = useState({
    name: '', platform: '', platform_account: '',
    egg_type: '', need_level: '', action_type: '',
    occupation: '', region: '', note: '', pain_point: '', asked_products: '',
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      // 自動帶入建議行動
      if (key === 'egg_type' || key === 'need_level') {
        const egg = key === 'egg_type' ? val : prev.egg_type
        const need = key === 'need_level' ? val : prev.need_level
        if (egg && need) next.action_type = getAction(egg, need)
      }
      return next
    })
    setErrors(e => ({ ...e, [key]: '' }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setErrors({ name: '姓名為必填' })
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    let next_contact_date = null
    if (form.action_type) {
      const d = new Date()
      d.setDate(d.getDate() + (DAYS_MAP[form.action_type] || 30))
      next_contact_date = d.toISOString().split('T')[0]
    }

    const { error } = await supabase.from('contacts').insert({
      user_id: user.id,
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
      next_contact_date,
    })

    setSaving(false)
    if (!error) navigate('/contacts')
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 16px 16px',
        borderBottom:'1px solid #F3F4F6',
        display:'flex',alignItems:'center',gap:12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#374151' }}>←</button>
        <h1 style={{ fontSize:18,fontWeight:800,color:'#111827',margin:0 }}>新增聯絡人</h1>
      </div>

      <div style={{ padding:'16px 16px 100px' }}>

        {/* 姓名 */}
        <div style={styles.fieldWrap}>
          <label style={styles.label}>姓名 <span style={{ color:'#EF4444' }}>*</span></label>
          <input value={form.name} onChange={e=>set('name',e.target.value)}
            placeholder="輸入姓名..."
            style={{ ...styles.input, borderColor: errors.name ? '#EF4444' : '#E5E7EB' }} />
          {errors.name && <p style={styles.errorMsg}>{errors.name}</p>}
        </div>

        {/* 社群平台 */}
        <div style={styles.fieldWrap}>
          <label style={styles.label}>社群平台 <span style={styles.suggest}>建議填</span></label>
          <div style={{ display:'flex',gap:8 }}>
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => set('platform', form.platform===p?'':p)}
                style={{ ...styles.chipBtn, background:form.platform===p?'#2563EB':'#F3F4F6',
                  color:form.platform===p?'#fff':'#374151' }}>{p}</button>
            ))}
          </div>
          {form.platform && (
            <input value={form.platform_account} onChange={e=>set('platform_account',e.target.value)}
              placeholder="@username..."
              style={{ ...styles.input, marginTop:8 }} />
          )}
        </div>

        {/* 蛋型 */}
        <div style={styles.fieldWrap}>
          <label style={styles.label}>關係（蛋型）<span style={styles.suggest}>建議填</span></label>
          <div style={{ display:'flex',gap:8 }}>
            {EGG_TYPES.map(e => (
              <button key={e} onClick={() => set('egg_type', form.egg_type===e?'':e)}
                style={{ ...styles.chipBtn, flex:1,
                  background:form.egg_type===e?'#2563EB':'#F3F4F6',
                  color:form.egg_type===e?'#fff':'#374151' }}>{e}</button>
            ))}
          </div>
        </div>

        {/* 需求度 */}
        <div style={styles.fieldWrap}>
          <label style={styles.label}>需求度 <span style={styles.suggest}>建議填</span></label>
          <div style={{ display:'flex',gap:8 }}>
            {NEED_LEVELS.map(n => (
              <button key={n} onClick={() => set('need_level', form.need_level===n?'':n)}
                style={{ ...styles.chipBtn, flex:1,
                  background:form.need_level===n?'#2563EB':'#F3F4F6',
                  color:form.need_level===n?'#fff':'#374151' }}>{n}</button>
            ))}
          </div>
        </div>

        {/* 建議行動（自動帶入） */}
        {form.action_type && (
          <div style={{ ...styles.fieldWrap, background:'#EFF6FF',borderRadius:10,padding:12 }}>
            <p style={{ margin:0,fontSize:13,color:'#2563EB',fontWeight:600 }}>
              建議行動：{form.action_type}
            </p>
          </div>
        )}

        {/* 展開更多 */}
        <button onClick={() => setShowMore(v=>!v)}
          style={{ width:'100%',padding:'10px',background:'none',border:'1px dashed #D1D5DB',
            borderRadius:10,color:'#6B7280',fontSize:13,cursor:'pointer',marginTop:4 }}>
          {showMore ? '收起 ▲' : '展開更多（職業、地區、備註）▼'}
        </button>

        {showMore && (
          <>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>職業</label>
              <input value={form.occupation} onChange={e=>set('occupation',e.target.value)}
                placeholder="輸入職業..." style={styles.input} />
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>居住地區</label>
              <input value={form.region} onChange={e=>set('region',e.target.value)}
                placeholder="例：高雄市左營區" style={styles.input} />
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>認識管道／備註</label>
              <input value={form.note} onChange={e=>set('note',e.target.value)}
                placeholder="例：福氣教會" style={styles.input} />
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>痛點／現況</label>
              <input value={form.pain_point} onChange={e=>set('pain_point',e.target.value)}
                placeholder="關鍵字..." style={styles.input} />
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>詢問過的產品</label>
              <input value={form.asked_products} onChange={e=>set('asked_products',e.target.value)}
                placeholder="例：益生十菌、蘆薈粉" style={styles.input} />
            </div>
          </>
        )}

        {/* 儲存 */}
        <button onClick={handleSave} disabled={saving}
          style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',
            background:saving?'#93C5FD':'#2563EB',color:'#fff',
            fontSize:16,fontWeight:700,cursor:'pointer',marginTop:16 }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  fieldWrap: { marginBottom: 16 },
  label: { fontSize:13,fontWeight:600,color:'#374151',display:'block',marginBottom:6 },
  suggest: { fontSize:11,color:'#3B82F6',fontWeight:500,marginLeft:4 },
input: { width:'100%',padding:'11px 12px',borderRadius:10,border:'1px solid #E5E7EB',
    fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:'#111827' },
  chipBtn: { padding:'7px 14px',borderRadius:8,border:'none',fontSize:13,
    fontWeight:600,cursor:'pointer' },
  errorMsg: { fontSize:12,color:'#EF4444',margin:'4px 0 0' },
}