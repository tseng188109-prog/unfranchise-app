import { useState, useEffect } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { CloseBtn } from './ui'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconPin, IconLink, IconX, IconStar, IconChevronRight,
  IconBooks, IconBook, IconFlame, IconVideo, IconHeadphones, IconFileText, IconChartBar,
  IconHeart, IconRadio, IconMusic, IconBulb,
} from '@tabler/icons-react'

const PRIMARY = 'var(--primary)'
const TEXT_MAIN = 'var(--text)'
const TEXT_MUTED = 'var(--muted)'
const TEXT_SECONDARY = 'var(--text2)'
const DANGER = '#E0454A'
const BORDER = 'var(--border)'

const ADMIN_EMAIL = 'tseng980725@hotmail.com'

// 圖示：用跟 App 其他地方同一套線條圖示（資料庫的 emoji 欄位存 'ti:名稱'；舊的表情符號會自動對應）
const ICONS = {
  books:      { Icon: IconBooks,      bg: 'var(--primary-soft)', color: 'var(--primary)' },
  book:       { Icon: IconBook,       bg: 'var(--primary-soft)', color: 'var(--primary)' },
  flame:      { Icon: IconFlame,      bg: 'var(--orange-soft)',  color: 'var(--orange-text)' },
  video:      { Icon: IconVideo,      bg: 'var(--pink-soft)',    color: 'var(--pink-text)' },
  headphones: { Icon: IconHeadphones, bg: 'var(--green-soft)',   color: 'var(--green-text)' },
  radio:      { Icon: IconRadio,      bg: 'var(--green-soft)',   color: 'var(--green-text)' },
  music:      { Icon: IconMusic,      bg: 'var(--green-soft)',   color: 'var(--green-text)' },
  filetext:   { Icon: IconFileText,   bg: 'var(--yellow-soft)',  color: 'var(--yellow-text)' },
  link:       { Icon: IconLink,       bg: 'var(--sub2)',         color: 'var(--text2)' },
  chartbar:   { Icon: IconChartBar,   bg: 'var(--primary-soft)', color: 'var(--primary)' },
  heart:      { Icon: IconHeart,      bg: 'var(--pink-soft)',    color: 'var(--pink-text)' },
  bulb:       { Icon: IconBulb,       bg: 'var(--yellow-soft)',  color: 'var(--yellow-text)' },
  star:       { Icon: IconStar,       bg: 'var(--yellow-soft)',  color: 'var(--yellow-text)' },
  pin:        { Icon: IconPin,        bg: 'var(--sub2)',         color: 'var(--text2)' },
}
const ICON_KEYS = ['books','flame','video','headphones','filetext','link','chartbar','heart','book','radio','music','bulb']
const EMOJI_TO_KEY = {
  '🎧':'headphones','📻':'radio','🎵':'music','📖':'book','📚':'books','⭐':'star',
  '🔗':'link','📝':'filetext','🎬':'video','💡':'bulb','🔥':'flame','📌':'pin',
}
function iconKeyOf(v) {
  if (typeof v === 'string' && v.startsWith('ti:') && ICONS[v.slice(3)]) return v.slice(3)
  return EMOJI_TO_KEY[v] || 'link'
}
function ResIcon({ value, size = 38 }) {
  const it = ICONS[iconKeyOf(value)]
  const I = it.Icon
  return (
    <span style={{ width:size, height:size, borderRadius:10, background:it.bg, color:it.color,
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <I size={Math.round(size*0.55)} stroke={1.8} />
    </span>
  )
}

export default function ResourceLinks({ type, title, icon }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [publicLinks, setPublicLinks] = useState([])
  const [personalLinks, setPersonalLinks] = useState([])
  const [loading, setLoading] = useState(true)

  // 新增/編輯 Modal
  const [modal, setModal] = useState(null) // null | { scope, editId }
  const [formName, setFormName] = useState('')
  const [formEmoji, setFormEmoji] = useState('ti:link')
  const [formUrl, setFormUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [formMsg, setFormMsg] = useState('')

  // 刪除確認
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setIsAdmin(user?.email === ADMIN_EMAIL)
    })
  }, [])

  useEffect(() => { if (user) fetchLinks() }, [user])

  async function fetchLinks() {
    setLoading(true)
    const { data } = await supabase.from('resource_links')
      .select('*').eq('type', type)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) {
      setPublicLinks(data.filter(l => l.scope === 'public'))
      setPersonalLinks(data.filter(l => l.scope === 'personal' && l.user_id === user.id))
    }
    setLoading(false)
  }

  function openAdd(scope) {
    setModal({ scope, editId: null })
    setFormName(''); setFormEmoji('ti:headphones'); setFormUrl(''); setFormMsg('')
  }

  function openEdit(link) {
    setModal({ scope: link.scope, editId: link.id })
    setFormName(link.name); setFormEmoji('ti:' + iconKeyOf(link.emoji)); setFormUrl(link.url); setFormMsg('')
  }

  async function handleSave() {
    setFormMsg('')
    if (!formName.trim()) { setFormMsg('請輸入名稱'); return }
    if (!formUrl.trim()) { setFormMsg('請輸入連結網址'); return }
    if (!formUrl.startsWith('http')) { setFormMsg('網址請以 http 或 https 開頭'); return }

    setSaving(true)
    const payload = {
      type,
      scope: modal.scope,
      user_id: modal.scope === 'personal' ? user.id : null,
      name: formName.trim(),
      emoji: formEmoji,
      url: formUrl.trim(),
    }

    if (modal.editId) {
      await supabase.from('resource_links').update(payload).eq('id', modal.editId)
    } else {
      await supabase.from('resource_links').insert(payload)
    }
    setSaving(false)
    setModal(null)
    fetchLinks()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('resource_links').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    fetchLinks()
  }

  function openLink(url) {
    window.open(url, '_blank')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ background:'var(--page)',minHeight:'100vh',paddingBottom:80 }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:'var(--hero)',
        padding:'52px 0 24px' }}>
        <div className="dash-container" style={{ padding:'0 20px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <button onClick={() => navigate(-1)}
              style={{ background:'none',border:'none',color:'#fff',cursor:'pointer',padding:0,display:'flex' }}><IconArrowLeft size={22} stroke={1.9} /></button>
            <h1 style={{ fontSize:20,fontWeight:600,color:'#fff',margin:0,display:'flex',alignItems:'center',gap:8 }}>
              {(() => { const I = ICONS[iconKeyOf(icon)].Icon; return <I size={22} stroke={1.9} /> })()} {title}
            </h1>
          </div>
          <p style={{ fontSize:13,color:'rgba(255,255,255,0.75)',margin:'6px 0 0 34px' }}>
            點按鈕直接開啟連結
          </p>
        </div>
      </div>

      <div className="dash-container" style={{ padding:'16px',display:'flex',flexDirection:'column',gap:12 }}>

        {/* 公共連結區塊 */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'flex',alignItems:'center',gap:6 }}>
              <IconPin size={15} stroke={1.9} color={PRIMARY} /> 公共資源
            </span>
            {isAdmin && (
              <button onClick={() => openAdd('public')}
                style={{ fontSize:12,color:PRIMARY,background:'none',border:'none',
                  cursor:'pointer',fontWeight:600 }}>+ 新增</button>
            )}
          </div>

          {publicLinks.length === 0 ? (
            <p style={{ fontSize:13,color:TEXT_MUTED,margin:0 }}>
              {isAdmin ? '還沒有公共連結，點「+ 新增」來新增' : '目前沒有公共資源'}
            </p>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {publicLinks.map(link => (
                <div key={link.id} style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <button onClick={() => openLink(link.url)}
                    style={{ flex:1,display:'flex',alignItems:'center',gap:12,
                      padding:'12px 14px',borderRadius:14,border:`1px solid ${BORDER}`,
                      background:'var(--card)',cursor:'pointer',textAlign:'left' }}>
                    <ResIcon value={link.emoji} />
                    <span style={{ fontSize:14,fontWeight:600,color:TEXT_MAIN,flex:1 }}>{link.name}</span>
                    <IconChevronRight size={16} stroke={1.9} color={TEXT_MUTED} />
                  </button>
                  {isAdmin && (
                    <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
                      <button onClick={() => openEdit(link)}
                        style={{ fontSize:13,color:PRIMARY,background:'none',border:'none',cursor:'pointer',padding:'8px 6px' }}>編輯</button>
                      <button onClick={() => setDeleteTarget(link)}
                        style={{ fontSize:13,color:DANGER,background:'none',border:'none',cursor:'pointer',padding:'8px 6px' }}>刪除</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 個人連結區塊 */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={{ fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'flex',alignItems:'center',gap:6 }}>
              <IconStar size={15} stroke={1.9} color="#F45DA8" /> 我的收藏
            </span>
            <button onClick={() => openAdd('personal')}
              style={{ fontSize:12,color:PRIMARY,background:'none',border:'none',
                cursor:'pointer',fontWeight:600 }}>+ 新增</button>
          </div>

          {personalLinks.length === 0 ? (
            <p style={{ fontSize:13,color:TEXT_MUTED,margin:0 }}>
              還沒有個人連結，點「+ 新增」來新增自己的播放清單
            </p>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {personalLinks.map(link => (
                <div key={link.id} style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <button onClick={() => openLink(link.url)}
                    style={{ flex:1,display:'flex',alignItems:'center',gap:12,
                      padding:'12px 14px',borderRadius:14,border:`1px solid ${BORDER}`,
                      background:'var(--card)',cursor:'pointer',textAlign:'left' }}>
                    <ResIcon value={link.emoji} />
                    <span style={{ fontSize:14,fontWeight:600,color:TEXT_MAIN,flex:1 }}>{link.name}</span>
                    <IconChevronRight size={16} stroke={1.9} color={TEXT_MUTED} />
                  </button>
                  <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
                    <button onClick={() => openEdit(link)}
                      style={{ fontSize:13,color:PRIMARY,background:'none',border:'none',cursor:'pointer',padding:'8px 6px' }}>編輯</button>
                    <button onClick={() => setDeleteTarget(link)}
                      style={{ fontSize:13,color:DANGER,background:'none',border:'none',cursor:'pointer',padding:'8px 6px' }}>刪除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 新增/編輯 Modal */}
      {modal && (
        <div style={overlayStyle} onClick={e => { if (e.target===e.currentTarget) setModal(null) }}>
          <div style={{ background:'var(--card)',borderRadius:'22px 22px 0 0',padding:24,
            width:'100%',maxWidth:430,maxHeight:'85vh',overflowY:'auto' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontSize:16,fontWeight:600,color:TEXT_MAIN,margin:0 }}>
                {modal.editId ? '編輯連結' : `新增${modal.scope === 'public' ? '公共' : '個人'}連結`}
              </h3>
              <CloseBtn onClick={() => setModal(null)} />
            </div>

            {/* Emoji 選擇 */}
            <div style={{ marginBottom:14 }}>
              <label style={lb}>圖示</label>
              <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                {ICON_KEYS.map(k => {
                  const I = ICONS[k].Icon
                  const on = formEmoji === 'ti:' + k
                  return (
                    <button key={k} onClick={() => setFormEmoji('ti:' + k)}
                      style={{ width:44,height:44,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                        border: on ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                        background: on ? 'var(--primary-soft)' : 'var(--sub)',
                        color: on ? PRIMARY : TEXT_SECONDARY }}>
                      <I size={22} stroke={1.8} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 名稱 */}
            <div style={{ marginBottom:14 }}>
              <label style={lb}>名稱 <span style={{ color:DANGER }}>必填</span></label>
              <input value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="例：6月官方錄音清單" style={inputStyle} />
            </div>

            {/* URL */}
            <div style={{ marginBottom:20 }}>
              <label style={lb}>連結網址 <span style={{ color:DANGER }}>必填</span></label>
              <input value={formUrl} onChange={e => setFormUrl(e.target.value)}
                placeholder="https://..." style={inputStyle} />
            </div>

            {formMsg && <p style={{ fontSize:12,color:DANGER,margin:'0 0 12px' }}>{formMsg}</p>}

            <button onClick={handleSave} disabled={saving}
              style={{ width:'100%',padding:'14px',borderRadius:14,border:'none',
                background:PRIMARY,color:'#fff',fontSize:15,fontWeight:600,cursor:'pointer' }}>
              {saving ? '儲存中…' : modal.editId ? '儲存修改' : '確認新增'}
            </button>
          </div>
        </div>
      )}

      {/* 刪除確認 */}
      {deleteTarget && (
        <div style={overlayStyle} onClick={() => setDeleteTarget(null)}>
          <div style={{ background:'var(--card)',borderRadius:18,padding:24,width:'100%',maxWidth:320,margin:'0 20px' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:16,fontWeight:600,color:TEXT_MAIN,margin:'0 0 8px',textAlign:'center' }}>
              確定要刪除？
            </p>
            <p style={{ fontSize:13,color:TEXT_MUTED,margin:'0 0 20px',textAlign:'center' }}>
              「{deleteTarget.name}」將永久刪除
            </p>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex:1,padding:'12px',borderRadius:12,border:`1px solid ${BORDER}`,
                  background:'var(--card)',fontSize:14,cursor:'pointer',color:TEXT_SECONDARY }}>取消</button>
              <button onClick={handleDelete}
                style={{ flex:1,padding:'12px',borderRadius:12,border:'none',
                  background:DANGER,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer' }}>刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card = { background:'var(--card)',borderRadius:18,padding:16,border:`1px solid ${BORDER}` }
const lb = { fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'block',marginBottom:6 }
const inputStyle = {
  width:'100%',padding:'10px 12px',borderRadius:12,
  border:`1px solid ${BORDER}`,fontSize:14,boxSizing:'border-box',
  outline:'none',color:TEXT_MAIN,
}
const overlayStyle = {
  position:'fixed',inset:0,background:'var(--overlay)',
  display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000,
}
