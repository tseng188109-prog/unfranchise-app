import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { getThemeMode, setThemeMode } from './theme'
import { useNavigate } from 'react-router-dom'
import { TagManager } from './meetingFlow'
import { PushSetting } from './pushNotify'
import { DAILY_MODE_LIST, resolveMode, saveDailyMode, resolveFavProducts, saveTagSetting } from './dailyMode'
import {
  IconClipboardList, IconChartBar, IconUsers, IconFlask, IconUsersGroup,
  IconFlag, IconChevronRight, IconCheck, IconHelpCircle,
} from '@tabler/icons-react'
import {
  PRIMARY, PRIMARY_SOFT, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY,
  ACCENT_GREEN, ACCENT_YELLOW_TEXT, ACCENT_YELLOW_SOFT, DANGER, DANGER_SOFT, BORDER, RADIUS } from './designTokens'

export default function Settings() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [modeKey, setModeKey] = useState('')
  const [favs, setFavs] = useState([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [referrerName, setReferrerName] = useState('')
  const [referrerPending, setReferrerPending] = useState('')
  const [editingReferrer, setEditingReferrer] = useState(false)
  const [newReferrerEmail, setNewReferrerEmail] = useState('')
  const [themeMode, setThemeModeState] = useState(getThemeMode())
  const [referrerMsg, setReferrerMsg] = useState('')

  // 我為什麼留在這裡（獨立欄位 users.why_here，跟 Daily.jsx 的目標宣言 goal_declaration 分開）
  const WHY_HERE_MAX = 50
  const WHY_STARTERS = ['因為', '不做這件事，我會後悔', '我想讓']
  const [whyHere, setWhyHere] = useState('')
  const [editingWhy, setEditingWhy] = useState(false)
  const [whyDraft, setWhyDraft] = useState('')
  const [whySaving, setWhySaving] = useState(false)

  // 密碼修改
  const [editingPassword, setEditingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      fetchProfile(user.id)
    })
  }, [])

  async function fetchProfile(uid) {
    const { data } = await supabase.from('users')
      .select('name,referrer_id,referrer_email_pending,why_here,tag_settings,created_at').eq('id', uid).single()
    if (!data) return
    setModeKey(resolveMode(data.tag_settings, data.created_at).key)
    setFavs(resolveFavProducts(data.tag_settings))
    setName(data.name)
    setReferrerPending(data.referrer_email_pending || '')
    setWhyHere(data.why_here || '')
    if (data.referrer_id) {
      const { data: ref } = await supabase.from('users')
        .select('name').eq('id', data.referrer_id).single()
      if (ref) setReferrerName(ref.name)
    }
  }

  async function chooseMode(key) {
    setModeKey(key)
    if (user) await saveDailyMode(user.id, key)
  }

  function saveFavs(list) {
    if (!user) return
    const clean = list.map(f => ({ name: (f.name || '').trim(), note: (f.note || '').trim() })).filter(f => f.name).slice(0, 2)
    saveTagSetting(user.id, { fav_products: clean })
  }
  function setFav(i, patch) {
    setFavs(list => list.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  }
  function removeFav(i) {
    const next = favs.filter((_, j) => j !== i)
    setFavs(next)
    saveFavs(next)
  }

  function fillWhyStarter(prefix) {
    setWhyDraft(prefix)
  }

  function openEditWhy() {
    setWhyDraft(whyHere)
    setEditingWhy(true)
  }

  async function saveWhy() {
    const text = whyDraft.trim()
    if (!text) return
    setWhySaving(true)
    await supabase.from('users').update({ why_here: text }).eq('id', user.id)
    setWhyHere(text)
    setWhySaving(false)
    setEditingWhy(false)
  }

  async function handleSaveName() {
    setSaving(true)
    await supabase.from('users').update({ name }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSaveReferrer() {
    setReferrerMsg('')
    if (!newReferrerEmail) { setReferrerMsg('請輸入推薦人 Email'); return }
    if (newReferrerEmail.toLowerCase() === user.email.toLowerCase()) {
      setReferrerMsg('不能填自己的 Email'); return
    }
    await supabase.from('users').update({
      referrer_email_pending: newReferrerEmail,
      referrer_id: null,
    }).eq('id', user.id)
    setReferrerPending(newReferrerEmail)
    setReferrerName('')
    setEditingReferrer(false)
    setReferrerMsg('')
    setNewReferrerEmail('')
  }

  async function handleSavePassword() {
    setPasswordMsg('')
    if (!newPassword) { setPasswordMsg('請輸入新密碼'); return }
    if (newPassword.length < 6) { setPasswordMsg('密碼至少 6 個字元'); return }
    if (newPassword !== confirmPassword) { setPasswordMsg('兩次密碼不一致'); return }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordMsg('修改失敗，請重新登入後再試')
    } else {
      setPasswordSaved(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setPasswordSaved(false)
        setEditingPassword(false)
      }, 2000)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const FUNCTION_ITEMS = [
    { label:'互動名單', path:'/contacts', Icon: IconClipboardList },
    { label:'業績紀錄', path:'/transactions', Icon: IconChartBar },
    { label:'顧客檔案', path:'/customers', Icon: IconUsers },
    { label:'試用品追蹤', path:'/samples', Icon: IconFlask },
    { label:'我的夥伴', path:'/partners', Icon: IconUsersGroup },
    { label:'戰隊', path:'/team', Icon: IconFlag },
    { label:'使用說明', path:'/help', Icon: IconHelpCircle },
  ]

  return (
    <div style={{ background:'var(--page)',minHeight:'100vh',paddingBottom:80,overflowX:'hidden',maxWidth:'100vw',boxSizing:'border-box' }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>

      <div style={{ background:'var(--hero)',
        padding:'52px 0 24px' }}>
        <div className="dash-container" style={{ padding:'0 20px' }}>
          <h1 style={{ fontSize:20,fontWeight:600,color:'#fff',margin:0 }}>設定</h1>
        </div>
      </div>

      <div className="dash-container" style={{ padding:'16px 16px',display:'flex',flexDirection:'column',gap:12 }}>

        {/* 我為什麼留在這裡：打開個人頁第一眼看到的東西，不是一般設定欄位。
            獨立欄位 why_here，跟目標聲明 goal_declaration 分開──目標聲明是要達成的成果，
            這裡是私密的、寫給自己看的一句話，不對外，也不追求量化。 */}
        <div style={{ background:PRIMARY_SOFT, borderRadius:RADIUS.xl, padding:'18px 20px',
          borderLeft:`4px solid ${PRIMARY}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <p style={{ fontSize:12, fontWeight:600, color:PRIMARY, margin:0, letterSpacing:0.5 }}>我為什麼留在這裡</p>
            {!editingWhy && (
              <button onClick={openEditWhy}
                style={{ fontSize:12, color:PRIMARY, background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                {whyHere ? '編輯' : '寫下初衷'}
              </button>
            )}
          </div>

          {!editingWhy ? (
            whyHere ? (
              <p style={{ fontSize:19, fontStyle:'italic', color:TEXT_MAIN, margin:0, lineHeight:1.6 }}>
                「{whyHere}」
              </p>
            ) : (
              <p style={{ fontSize:13, color:TEXT_SECONDARY, margin:0, lineHeight:1.6 }}>
                用一句話，是什麼讓你留在這裡？
              </p>
            )
          ) : (
            <div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                {WHY_STARTERS.map(s => (
                  <button key={s} onClick={() => fillWhyStarter(s)}
                    style={{ padding:'5px 12px', borderRadius:RADIUS.pill, border:`1px solid var(--border2)`,
                      background:'var(--card)', color:PRIMARY, fontSize:12, cursor:'pointer' }}>
                    {s}＿
                  </button>
                ))}
              </div>
              <input value={whyDraft} maxLength={WHY_HERE_MAX}
                onChange={e => setWhyDraft(e.target.value)}
                placeholder="用一句話，是什麼讓你留在這裡？"
                style={{ width:'100%', padding:'10px 12px', borderRadius:RADIUS.md, border:`1px solid ${BORDER}`,
                  fontSize:14, boxSizing:'border-box', outline:'none', color:TEXT_MAIN,
                  background:'var(--card)', marginBottom:6 }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:TEXT_MUTED }}>還可以打 {WHY_HERE_MAX - whyDraft.length} 字</span>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setEditingWhy(false)}
                    style={{ padding:'7px 14px', borderRadius:RADIUS.sm, border:`1px solid ${BORDER}`,
                      background:'var(--card)', color:TEXT_SECONDARY, fontSize:12, cursor:'pointer' }}>取消</button>
                  <button onClick={saveWhy} disabled={whySaving || !whyDraft.trim()}
                    style={{ padding:'7px 16px', borderRadius:RADIUS.sm, border:'none',
                      background: whySaving ? '#9BBBF2' : PRIMARY, color:'#fff',
                      fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    {whySaving ? '儲存中…' : '儲存'}
                </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 帳號資訊 */}
        <div style={card}>
          <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:16 }}>
            <div style={{ width:52,height:52,borderRadius:'50%',background:PRIMARY,
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'#fff',fontWeight:600,fontSize:20 }}>
              {name?name[0]:user?.email?.[0]?.toUpperCase()||'U'}
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:600,color:TEXT_MAIN,margin:0 }}>{name||'未設定名稱'}</p>
              <p style={{ fontSize:13,color:TEXT_MUTED,margin:'2px 0 0' }}>{user?.email}</p>
            </div>
          </div>

          <label style={lb}>顯示名稱</label>
          <div style={{ display:'flex',gap:8 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="輸入名稱..."
              style={{ flex:1,padding:'10px 12px',borderRadius:RADIUS.md,border:`1px solid ${BORDER}`,
                fontSize:14,outline:'none',color:TEXT_MAIN }} />
            <button onClick={handleSaveName} disabled={saving}
              style={{ display:'flex',alignItems:'center',gap:4,padding:'10px 16px',borderRadius:RADIUS.md,border:'none',
                background:saved?ACCENT_GREEN:PRIMARY,color:'#fff',
                fontWeight:600,fontSize:13,cursor:'pointer' }}>
              {saved && <IconCheck size={14} stroke={2.4} />} {saved?'已存':'儲存'}
            </button>
          </div>
        </div>

        {/* 外觀：跟隨手機／永遠白天／永遠夜晚 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:600,color:TEXT_SECONDARY,margin:'0 0 10px' }}>外觀</p>
          <div style={{ display:'flex',gap:4,padding:4,background:'var(--sub2)',borderRadius:RADIUS.md }}>
            {[['system','跟隨手機'],['light','白天'],['dark','夜晚']].map(([k,label]) => (
              <button key={k} onClick={() => { setThemeMode(k); setThemeModeState(k) }}
                style={{ flex:1,padding:'8px 0',border:'none',borderRadius:RADIUS.sm,cursor:'pointer',
                  fontSize:13,fontWeight:themeMode===k?600:500,
                  background:themeMode===k?'var(--card)':'transparent',
                  color:themeMode===k?TEXT_MAIN:TEXT_SECONDARY,
                  boxShadow:themeMode===k?'0 1px 2px rgba(0,0,0,0.12)':'none' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {user && <TagManager userId={user.id} cardStyle={card} />}

        {/* 密碼修改 */}
        <div style={card}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom: editingPassword?12:0 }}>
            <p style={{ fontSize:13,fontWeight:600,color:TEXT_SECONDARY,margin:0 }}>帳號安全</p>
            <button onClick={() => { setEditingPassword(!editingPassword); setPasswordMsg(''); setNewPassword(''); setConfirmPassword('') }}
              style={{ fontSize:13,color:PRIMARY,background:'none',border:'none',cursor:'pointer',fontWeight:600 }}>
              {editingPassword ? '取消' : '修改密碼'}
            </button>
          </div>

          {editingPassword && (
            <div>
              <div style={{ marginBottom:12 }}>
                <label style={lb}>新密碼</label>
                <input
                  type="password"
                  placeholder="至少 6 個字元"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lb}>確認新密碼</label>
                <input
                  type="password"
                  placeholder="再輸入一次"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              {passwordMsg && (
                <p style={{ fontSize:12,color:DANGER,margin:'0 0 8px' }}>{passwordMsg}</p>
              )}
              <button onClick={handleSavePassword} disabled={passwordSaving}
                style={{ width:'100%',padding:'11px',borderRadius:RADIUS.md,border:'none',
                  background: passwordSaved?ACCENT_GREEN:passwordSaving?'#9BBBF2':PRIMARY,
                  color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer' }}>
                {passwordSaved ? '✓ 密碼已更新' : passwordSaving ? '更新中…' : '確認修改'}
              </button>
            </div>
          )}
        </div>

        {/* 推薦關係 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:600,color:TEXT_SECONDARY,margin:'0 0 12px' }}>推薦關係</p>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
            <span style={{ fontSize:14,color:TEXT_MAIN }}>推薦人</span>
            <button onClick={() => { setEditingReferrer(!editingReferrer); setReferrerMsg('') }}
              style={{ fontSize:13,color:PRIMARY,background:'none',border:'none',
                cursor:'pointer',fontWeight:600 }}>
              {editingReferrer ? '取消' : '修改'}
            </button>
          </div>
          {!editingReferrer ? (
            <p style={{ fontSize:14,color: referrerName?TEXT_MAIN:referrerPending?ACCENT_YELLOW_TEXT:TEXT_MUTED,
              margin:'4px 0 0',fontWeight: referrerName?600:400 }}>
              {referrerName || (referrerPending ? `待確認：${referrerPending}` : '尚未設定')}
            </p>
          ) : (
            <div style={{ marginTop:8 }}>
              <input type="email" placeholder="輸入推薦人 Email..."
                value={newReferrerEmail} onChange={e => setNewReferrerEmail(e.target.value)}
                style={{ ...inputStyle, marginBottom:8 }} />
              {referrerMsg && <p style={{ fontSize:12,color:DANGER,margin:'0 0 8px' }}>{referrerMsg}</p>}
              <p style={{ fontSize:11,color:TEXT_MUTED,margin:'0 0 8px' }}>
                推薦人尚未註冊也沒關係，對方日後建立帳號後會自動串聯
              </p>
              <button onClick={handleSaveReferrer}
                style={{ width:'100%',padding:'10px',borderRadius:RADIUS.md,border:'none',
                  background:PRIMARY,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer' }}>
                儲存推薦人
              </button>
            </div>
          )}
        </div>

        {/* 每日節奏：起步 / 標準 / 加速，只改首頁的目標數字，已經記的紀錄不變 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:600,color:TEXT_SECONDARY,margin:'0 0 10px' }}>每日節奏</p>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {DAILY_MODE_LIST.map(m => {
              const on = modeKey === m.key
              return (
                <button key={m.key} onClick={() => chooseMode(m.key)}
                  style={{ textAlign:'left',cursor:'pointer',padding:'12px 14px',borderRadius:RADIUS.lg,
                    border: on ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                    background: on ? PRIMARY_SOFT : 'transparent' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <span style={{ fontSize:15,fontWeight:600,color: on ? PRIMARY : TEXT_MAIN }}>{m.title}</span>
                    {on && <IconCheck size={18} stroke={2} color={PRIMARY} />}
                  </div>
                  <div style={{ fontSize:13,color: on ? PRIMARY : TEXT_SECONDARY,marginTop:2,lineHeight:1.6 }}>{m.desc}</div>
                </button>
              )
            })}
          </div>
          <p style={{ fontSize:12,color:TEXT_MUTED,margin:'10px 0 0' }}>隨時可以換，已經記的紀錄不會變。</p>
        </div>

        {/* 我的首選產品：自己先用的 1–2 款，見面提示會帶出來 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:600,color:TEXT_SECONDARY,margin:'0 0 4px' }}>我的首選產品</p>
          <p style={{ fontSize:12,color:TEXT_MUTED,margin:'0 0 10px',lineHeight:1.6 }}>
            填 1–2 款你自己在用、有感覺的產品。約見面時會提醒你分享自己的使用心得。
          </p>
          {favs.map((f, i) => (
            <div key={i} style={{ padding:'12px',borderRadius:RADIUS.lg,border:`1px solid ${BORDER}`,marginBottom:8 }}>
              <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                <input value={f.name} onChange={e => setFav(i, { name: e.target.value })} onBlur={() => saveFavs(favs)}
                  placeholder="產品名稱，例如 愛尚它®綜合維生素粉末"
                  style={{ flex:1,minWidth:0,boxSizing:'border-box',padding:'8px 10px',borderRadius:RADIUS.sm,border:`1px solid ${BORDER}`,fontSize:14,outline:'none',background:'transparent',color:TEXT_MAIN }} />
                <button onClick={() => removeFav(i)} aria-label="移除這一款"
                  style={{ width:44,height:44,border:'none',background:'none',cursor:'pointer',color:TEXT_MUTED,fontSize:20 }}>×</button>
              </div>
              <input value={f.note || ''} onChange={e => setFav(i, { note: e.target.value })} onBlur={() => saveFavs(favs)}
                placeholder="一句心得，例如 喝了兩週，下午比較不累"
                style={{ width:'100%',boxSizing:'border-box',marginTop:8,padding:'8px 10px',borderRadius:RADIUS.sm,border:`1px solid ${BORDER}`,fontSize:13,outline:'none',background:'transparent',color:TEXT_MAIN }} />
            </div>
          ))}
          {favs.length < 2 && (
            <button onClick={() => setFavs(list => [...list, { name: '', note: '' }])}
              style={{ width:'100%',padding:'12px',borderRadius:RADIUS.lg,border:`1px dashed ${BORDER}`,background:'none',color:TEXT_SECONDARY,fontSize:14,cursor:'pointer' }}>
              ＋ {favs.length === 0 ? '加一款' : '再加一款（最多 2 款）'}
            </button>
          )}
        </div>

        {/* 其他功能入口 */}
        <div style={card}>
          <p style={{ fontSize:13,fontWeight:600,color:TEXT_SECONDARY,margin:'0 0 8px' }}>功能</p>
          {FUNCTION_ITEMS.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ width:'100%',display:'flex',alignItems:'center',gap:10,
                padding:'12px 0',background:'none',border:'none',
                borderBottom:`1px solid ${BORDER}`,cursor:'pointer',textAlign:'left' }}>
              <item.Icon size={17} stroke={1.9} color={PRIMARY} />
              <span style={{ fontSize:14,color:TEXT_MAIN,flex:1 }}>{item.label}</span>
              <IconChevronRight size={16} stroke={1.9} color={TEXT_MUTED} />
            </button>
          ))}
        </div>

        {user && <PushSetting userId={user.id} />}

        {/* 登出 */}
        <button onClick={handleSignOut}
          style={{ width:'100%',padding:'14px',borderRadius:RADIUS.lg,border:'none',
            background:DANGER_SOFT,color:DANGER,fontSize:15,fontWeight:600,cursor:'pointer' }}>
          登出
        </button>

      </div>
    </div>
  )
}

const card = { background:'var(--card)',borderRadius:RADIUS.xl,padding:16,border:`1px solid ${BORDER}` }
const lb = { fontSize:13,fontWeight:600,color:TEXT_MAIN,display:'block',marginBottom:6 }
const inputStyle = {
  width:'100%',padding:'10px 12px',borderRadius:RADIUS.md,
  border:`1px solid ${BORDER}`,fontSize:14,boxSizing:'border-box',
  outline:'none',color:TEXT_MAIN,
}
