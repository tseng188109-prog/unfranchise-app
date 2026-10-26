// goalModal.jsx — 目標宣言：平常是「朗讀模式」，按「編輯宣言」才進輸入狀態，避免唸的時候誤按儲存
import { useState, useRef, useEffect } from 'react'
import { IconTarget, IconX } from '@tabler/icons-react'

export default function GoalModal({ text, setText, saving, saved, onSave, onRead, onClose }) {
  const [editing, setEditing] = useState(false)
  const [orig, setOrig] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [editing])

  function startEdit() { setOrig(text); setEditing(true) }
  function cancelEdit() { setText(orig); setEditing(false) }
  async function save() { await onSave(); setEditing(false) }

  const closeBtn = (
    <button onClick={editing ? cancelEdit : onClose} aria-label="關閉"
      style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'var(--sub2)', color:'var(--text2)',
        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
      <IconX size={22} stroke={1.9} />
    </button>
  )
  const bigBtn = { width:'100%', padding:'15px', borderRadius:16, border:'none', color:'#fff', fontSize:16, fontWeight:600, cursor:'pointer', marginTop:12 }

  return (
    <div style={{ position:'fixed', inset:0, background:'var(--overlay)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000 }}
      onClick={e => { if (e.target === e.currentTarget && !editing) onClose() }}>
      <div style={{ background:'var(--card)', borderRadius:'22px 22px 0 0', padding:'20px 20px 28px', width:'100%', maxWidth:430, maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text)', margin:0, display:'flex', alignItems:'center', gap:6 }}>
            <IconTarget size={17} stroke={1.9} color="var(--primary)" /> {editing ? '編輯目標宣言' : '我的目標宣言'}
          </h3>
          {closeBtn}
        </div>

        {editing ? (
          <>
            <textarea ref={ref} value={text} autoFocus
              onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              placeholder="寫下你的目標宣言，每天提醒自己為什麼出發..." rows={4}
              style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid var(--primary)', fontSize:15, boxSizing:'border-box', outline:'none', resize:'none', lineHeight:1.8, display:'block' }} />
            <button onClick={save} disabled={saving}
              style={{ ...bigBtn, background: saved ? '#3ECF8E' : 'var(--primary)' }}>
              {saved ? '✓ 已儲存' : saving ? '儲存中…' : '儲存'}
            </button>
            <button onClick={cancelEdit}
              style={{ width:'100%', background:'none', border:'none', color:'var(--text2)', fontSize:14, padding:'14px 0 0', cursor:'pointer' }}>
              取消，不改了
            </button>
          </>
        ) : (
          <>
            <div style={{ border:'1px solid var(--border)', borderRadius:14, padding:'12px 14px', fontSize:15, lineHeight:1.9, color:'var(--text)', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
              {text || <span style={{ color:'var(--muted)' }}>還沒寫目標宣言，點下面「編輯宣言」來寫。</span>}
            </div>
            <button onClick={onRead} style={{ ...bigBtn, background:'var(--primary)' }}>唸完了</button>
            <button onClick={startEdit}
              style={{ width:'100%', background:'none', border:'none', color:'var(--text2)', fontSize:14, padding:'14px 0 0', cursor:'pointer' }}>
              編輯宣言
            </button>
          </>
        )}
      </div>
    </div>
  )
}
