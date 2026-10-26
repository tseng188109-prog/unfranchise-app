// socialModal.jsx — 「前往回應」：跟 App 其他列表一致的列式選項
import { IconMessageCircle, IconUsersGroup, IconMessageCircle2, IconChevronRight } from '@tabler/icons-react'
import { CloseBtn } from './ui'

const OPTIONS = [
  { name: '臉書 IDEA 社團', sub: '回應夥伴的貼文', url: 'https://www.facebook.com/groups/710836659091767/', Icon: IconUsersGroup, bg: 'var(--primary-soft)', color: 'var(--primary)' },
  { name: 'LINE', sub: '回覆訊息與群組', url: 'https://line.me', Icon: IconMessageCircle2, bg: 'var(--green-soft)', color: 'var(--green-text)' },
]

export default function SocialModal({ onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'var(--overlay)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'var(--card)', borderRadius:'22px 22px 0 0', padding:'18px 18px 28px', width:'100%', maxWidth:430 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text)', margin:0, display:'flex', alignItems:'center', gap:6 }}>
            <IconMessageCircle size={17} stroke={1.9} color="var(--primary)" /> 前往回應
          </h3>
          <CloseBtn onClick={onClose} />
        </div>
        {OPTIONS.map(o => (
          <button key={o.name} onClick={() => { window.open(o.url, '_blank'); onClose() }}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 14px', marginBottom:8,
              borderRadius:14, border:'1px solid var(--border)', background:'var(--card)', cursor:'pointer', textAlign:'left' }}>
            <span style={{ width:38, height:38, borderRadius:10, background:o.bg, color:o.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <o.Icon size={21} stroke={1.8} />
            </span>
            <span style={{ flex:1 }}>
              <span style={{ display:'block', fontSize:14, fontWeight:600, color:'var(--text)' }}>{o.name}</span>
              <span style={{ display:'block', fontSize:12, color:'var(--text2)' }}>{o.sub}</span>
            </span>
            <IconChevronRight size={16} stroke={1.9} color="var(--muted)" />
          </button>
        ))}
      </div>
    </div>
  )
}
