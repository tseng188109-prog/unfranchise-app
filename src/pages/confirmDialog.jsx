// confirmDialog.jsx — App 自己的確認視窗，取代手機系統內建的 confirm()/alert()
// 用法：if (!(await askConfirm({ title:'封存「小美」？', message:'…', okText:'封存', danger:true }))) return
import { createRoot } from 'react-dom/client'

function ConfirmSheet({ title, message, okText, cancelText, danger, hideCancel, onDone }) {
  const btn = { flex:1, padding:'13px 8px', borderRadius:12, border:'none', fontSize:15, fontWeight:600, cursor:'pointer' }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onDone(false) }}
      style={{ position:'fixed', inset:0, background:'var(--overlay)', zIndex:2000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'var(--card)', borderRadius:'22px 22px 0 0', padding:'20px 18px 28px', width:'100%', maxWidth:430, textAlign:'center', boxSizing:'border-box' }}>
        <div style={{ fontSize:16, fontWeight:600, color:'var(--text)' }}>{title}</div>
        {message && <div style={{ fontSize:13, color:'var(--text2)', marginTop:6, lineHeight:1.6 }}>{message}</div>}
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          {!hideCancel && <button onClick={() => onDone(false)} style={{ ...btn, background:'var(--sub2)', color:'var(--text)' }}>{cancelText}</button>}
          <button onClick={() => onDone(true)} style={{ ...btn, background: danger ? '#E0454A' : 'var(--primary)', color:'#fff' }}>{okText}</button>
        </div>
      </div>
    </div>
  )
}

export function askConfirm({ title, message = '', okText = '確定', cancelText = '取消', danger = false, hideCancel = false }) {
  return new Promise(resolve => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const done = (v) => { root.unmount(); host.remove(); resolve(v) }
    root.render(<ConfirmSheet title={title} message={message} okText={okText} cancelText={cancelText} danger={danger} hideCancel={hideCancel} onDone={done} />)
  })
}
