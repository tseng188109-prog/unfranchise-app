// 用管理員給的臨時密碼登入後，一定要先換成自己的密碼才能用 App。
// 換好後呼叫 finish_password_change() 把「要先換密碼」的標記清掉。
import { useState } from 'react'
import { supabase } from '../supabase'
import { RADIUS } from './designTokens'
import { clearPasswordChangeFlag } from './passwordFlag'

export default function ForcePassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setMsg('')
    if (pw.length < 6) { setMsg('密碼至少 6 個字'); return }
    if (pw !== pw2) { setMsg('兩次打的不一樣'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      setSaving(false)
      setMsg(/different from the old/i.test(error.message || '') ? '新密碼不能跟臨時密碼一樣' : '沒換成功，再按一次試試')
      return
    }
    await clearPasswordChangeFlag()
    setSaving(false)
    onDone()
  }

  const input = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: RADIUS.md,
    border: '1px solid var(--border)', fontSize: 15, outline: 'none', margin: '6px 0 14px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: RADIUS.xl, padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>換一組你自己的密碼</div>
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>你剛才用的是臨時密碼，換好就可以開始用了。</div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>新密碼</label>
        <input type="password" autoComplete="new-password" value={pw} onChange={e => { setPw(e.target.value); setMsg('') }} placeholder="至少 6 個字" style={input} />
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>再打一次</label>
        <input type="password" autoComplete="new-password" value={pw2} onChange={e => { setPw2(e.target.value); setMsg('') }} placeholder="再打一次新密碼" style={input} />
        {msg && <div style={{ color: 'var(--danger-text)', fontSize: 13, margin: '-6px 0 10px' }}>{msg}</div>}
        <button onClick={save} disabled={saving}
          style={{ width: '100%', padding: 13, border: 'none', borderRadius: RADIUS.lg, background: 'var(--primary)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? '換密碼中…' : '換好了，開始使用'}
        </button>
        <button onClick={() => supabase.auth.signOut()}
          style={{ width: '100%', marginTop: 10, padding: 10, border: 'none', background: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>先登出</button>
      </div>
    </div>
  )
}
