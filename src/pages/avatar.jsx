// avatar.jsx — 名字圓圈（名字第一個字＋固定顏色），戰隊頁、打氣、好消息、搭檔都用同一個，
// 同一個人在每個地方都是同一個顏色。
function avatarColor(name) {
  const colors = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EC4899', '#14B8A6']
  let n = 0; for (let i = 0; i < (name || '').length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

export function Avatar({ name, size = 30, ring = false, style }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: '50%', background: avatarColor(name), color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontSize: Math.round(size * 0.42), fontWeight: 600, lineHeight: 1,
      border: ring ? '2px solid var(--card)' : 'none', boxSizing: 'border-box', ...style,
    }}>{(name || '?')[0]}</span>
  )
}

// 兩三個人疊在一起（好消息的搭檔、打開 App 的打氣小卡）
export function AvatarStack({ names, size = 30 }) {
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }}>
      {names.map((n, i) => <Avatar key={i} name={n} size={size} ring style={{ marginLeft: i ? -Math.round(size / 3) : 0 }} />)}
    </span>
  )
}
