import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'
import { saveDraft, loadDraft, clearDraft } from './formDraft'

import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_GREEN_SOFT, ACCENT_GREEN_TEXT, DANGER, BORDER, RADIUS,
  getEggColor, getEggBg,
} from './designTokens'

const EGG_TYPES = [
  { value:'生雞蛋', desc:'不熟' },
  { value:'荷包蛋', desc:'半熟' },
  { value:'茶葉蛋', desc:'很熟' },
]
const NEED_LEVELS = [
  { value:'大一', desc:'沒需求' },
  { value:'大二', desc:'小抱怨' },
  { value:'大三', desc:'想改變' },
  { value:'大四', desc:'有行動' },
]
const PLATFORMS = ['IG', 'FB', 'LINE', '其他']

const ACTION_MAP = {
  '茶葉蛋': { '大一':'軟性活動','大二':'商機講座','大三':'直接法','大四':'直接法' },
  '荷包蛋': { '大一':'輕鬆互動','大二':'軟性活動','大三':'商機講座','大四':'直接法' },
  '生雞蛋': { '大一':'輕鬆互動','大二':'輕鬆互動','大三':'軟性活動','大四':'商機講座' },
}
const DAYS_MAP = { '輕鬆互動':30,'軟性活動':14,'商機講座':5,'直接法':5 }

const EMPTY_FORM = {
  name: '', platform: '', platform_account: '',
  egg_type: '', need_level: '', action_type: '',
  occupation: '', region: '', note: '', pain_point: '', asked_products: '',
}

function getAction(egg, need) {
  return ACTION_MAP[egg]?.[need] || ''
}

export default function ContactNew() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const nameInputRef = useRef(null)

  const [form, setForm] = useState(() => loadDraft('contactNew') || EMPTY_FORM)
  const [errors, setErrors] = useState({})

  // 填到一半 App 關掉重開，草稿自動補回來；存成功或按取消才清掉
  useEffect(() => { saveDraft('contactNew', form) }, [form])

  function set(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'egg_type' || key === 'need_level') {
        const egg = key === 'egg_type' ? val : prev.egg_type
        const need = key === 'need_level' ? val : prev.need_level
        if (egg && need) next.action_type = getAction(egg, need)
      }
      return next
    })
    setErrors(e => ({ ...e, [key]: '' }))
  }

  async function handleSave(continueAdding) {
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
    if (error) return
    clearDraft('contactNew')

    if (continueAdding) {
      setSavedCount(c => c + 1)
      setForm(EMPTY_FORM)
      setErrors({})
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
      nameInputRef.current?.focus()
    } else {
      navigate('/contacts')
    }
  }

  return (
    <div style={{ background:'#fff',minHeight:'100vh' }}>
      <style>{`
        .cn-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .cn-container { max-width: 900px; margin: 0; }
          .cn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; align-items: start; }
          .cn-full { grid-column: 1 / -1; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 0 16px',
        borderBottom:`1px solid ${BORDER}` }}>
        <div className="cn-container" style={{ padding:'0 16px',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:12 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <button onClick={() => navigate(-1)}
              style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_SECONDARY,display:'flex' }}><IconArrowLeft size={22} stroke={1.9} /></button>
            <h1 style={{ fontSize:18,fontWeight:700,color:TEXT_MAIN,margin:0 }}>新增聯絡人</h1>
          </div>
          {savedCount > 0 && (
            <span style={{ fontSize:12,color:ACCENT_GREEN_TEXT,fontWeight:700,
              background:ACCENT_GREEN_SOFT,padding:'4px 10px',borderRadius:RADIUS.pill }}>
              本次已新增 {savedCount} 位
            </span>
          )}
        </div>
      </div>

      <div className="cn-container" style={{ padding:'16px 16px 100px' }}>

        {justSaved && (
          <div style={{ display:'flex',alignItems:'center',gap:8,background:ACCENT_GREEN_SOFT,
            borderRadius:RADIUS.md,padding:'10px 14px',marginBottom:16 }}>
            <IconCheck size={16} stroke={2.4} color={ACCENT_GREEN_TEXT} />
            <span style={{ fontSize:13,color:ACCENT_GREEN_TEXT,fontWeight:600 }}>已新增，可以繼續輸入下一位</span>
          </div>
        )}

        <div className="cn-grid">

          {/* 姓名 */}
          <div className="cn-full" style={styles.fieldWrap}>
            <label style={styles.label}>姓名 <span style={{ color:DANGER }}>*</span></label>
            <input ref={nameInputRef} value={form.name} onChange={e=>set('name',e.target.value)}
              placeholder="輸入姓名..."
              style={{ ...styles.input, borderColor: errors.name ? DANGER : BORDER }} />
            {errors.name && <p style={styles.errorMsg}>{errors.name}</p>}
          </div>

          {/* 社群平台 */}
          <div className="cn-full" style={styles.fieldWrap}>
            <label style={styles.label}>社群平台 <span style={styles.suggest}>建議填</span></label>
            <div style={{ display:'flex',gap:8 }}>
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => set('platform', form.platform===p?'':p)}
                  style={{ ...styles.chipBtn, background:form.platform===p?PRIMARY:'#F5F8FC',
                    color:form.platform===p?'#fff':TEXT_SECONDARY }}>{p}</button>
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
              {EGG_TYPES.map(e => {
                const selected = form.egg_type === e.value
                const color = getEggColor(e.value)
                const bg = getEggBg(e.value)
                return (
                  <button key={e.value} onClick={() => set('egg_type', selected ? '' : e.value)}
                    style={{ flex:1,padding:'10px 8px',borderRadius:RADIUS.md,border:`2px solid ${selected?color:BORDER}`,
                      background: selected ? bg : '#F5F8FC',
                      cursor:'pointer',textAlign:'center',transition:'all 0.15s' }}>
                    <div style={{ fontSize:13,fontWeight:700,color: selected?color:TEXT_MAIN }}>{e.value}</div>
                    <div style={{ fontSize:11,color: selected?color:TEXT_MUTED,marginTop:2 }}>{e.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 需求度 */}
          <div style={styles.fieldWrap}>
            <label style={styles.label}>需求度 <span style={styles.suggest}>建議填</span></label>
            <div style={{ display:'flex',gap:8 }}>
              {NEED_LEVELS.map(n => {
                const selected = form.need_level === n.value
                return (
                  <button key={n.value} onClick={() => set('need_level', selected ? '' : n.value)}
                    style={{ flex:1,padding:'10px 8px',borderRadius:RADIUS.md,
                      border:`2px solid ${selected?PRIMARY:BORDER}`,
                      background: selected?PRIMARY_SOFT:'#F5F8FC',
                      cursor:'pointer',textAlign:'center',transition:'all 0.15s' }}>
                    <div style={{ fontSize:13,fontWeight:700,color: selected?PRIMARY:TEXT_MAIN }}>{n.value}</div>
                    <div style={{ fontSize:11,color: selected?PRIMARY:TEXT_MUTED,marginTop:2 }}>{n.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 建議行動（自動帶入） */}
          {form.action_type && (
            <div className="cn-full" style={{ ...styles.fieldWrap, background:PRIMARY_SOFT,borderRadius:RADIUS.md,padding:12 }}>
              <p style={{ margin:0,fontSize:13,color:PRIMARY,fontWeight:700 }}>
                建議行動：{form.action_type}
              </p>
            </div>
          )}

          {/* 展開更多 */}
          <button onClick={() => setShowMore(v=>!v)} className="cn-full"
            style={{ width:'100%',padding:'10px',background:'none',border:`1px dashed ${BORDER}`,
              borderRadius:RADIUS.md,color:TEXT_SECONDARY,fontSize:13,cursor:'pointer',marginTop:4 }}>
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
              <div className="cn-full" style={styles.fieldWrap}>
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

          {/* 儲存按鈕 */}
          <div className="cn-full" style={{ display:'flex',gap:10,marginTop:16 }}>
            <button onClick={() => handleSave(true)} disabled={saving}
              style={{ flex:1,padding:'14px',borderRadius:RADIUS.lg,border:'none',
                background:saving?'#9BBBF2':PRIMARY,color:'#fff',
                fontSize:15,fontWeight:700,cursor:'pointer' }}>
              {saving ? '儲存中…' : '儲存並新增下一位'}
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              style={{ flex:1,padding:'14px',borderRadius:RADIUS.lg,border:`1.5px solid ${PRIMARY}`,
                background:'#fff',color:PRIMARY,
                fontSize:15,fontWeight:700,cursor:'pointer' }}>
              儲存並返回列表
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

const styles = {
  fieldWrap: { marginBottom: 16 },
  label: { fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'block',marginBottom:6 },
  suggest: { fontSize:11,color:PRIMARY,fontWeight:500,marginLeft:4 },
  input: { width:'100%',padding:'11px 12px',borderRadius:RADIUS.md,border:`1px solid ${BORDER}`,
    fontSize:14,background:'#fff',boxSizing:'border-box',outline:'none',color:TEXT_MAIN },
  chipBtn: { padding:'7px 14px',borderRadius:RADIUS.sm,border:'none',fontSize:13,
    fontWeight:600,cursor:'pointer' },
  errorMsg: { fontSize:12,color:DANGER,margin:'4px 0 0' },
}
