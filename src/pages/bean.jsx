// bean.jsx — 豆豆（App 的小角色）和小火焰
// 奶茶色的豆子，頭上一株嫩芽：每天往罐子裡放豆子，豆子會發芽長大。
// mood：happy 完成今天／cheer 連續天數加油／worry 晚上提醒／sleep 休息日
// 動畫只用 CSS transform，手機「減少動態效果」打開時自動不動。

const STYLE = `
@keyframes bean-hop { 0%,100% { transform: translateY(0) } 30% { transform: translateY(-14px) } 55% { transform: translateY(0) } 70% { transform: translateY(-5px) } }
@keyframes bean-sway { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@keyframes bean-flicker { 0%,100% { transform: scale(1) rotate(0) } 50% { transform: scale(1.06,0.95) rotate(-3deg) } }
@keyframes bean-pop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
@keyframes bean-twinkle { 0%,100% { opacity: .2; transform: scale(.7) } 50% { opacity: 1; transform: scale(1) } }
.bean-hop { animation: bean-hop 1.1s ease-in-out 2; transform-origin: 50% 100% }
.bean-sway { animation: bean-sway 2.6s ease-in-out infinite; transform-origin: 50% 90% }
.bean-flicker { animation: bean-flicker 1.2s ease-in-out infinite; transform-origin: 50% 100%; transform-box: fill-box }
.bean-pop { animation: bean-pop .45s ease-out both }
.bean-twinkle { animation: bean-twinkle 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
@media (prefers-reduced-motion: reduce) { .bean-hop,.bean-sway,.bean-flicker,.bean-pop,.bean-twinkle { animation: none } }
`

export function BeanStyle() { return <style>{STYLE}</style> }

function Body() {
  return (
    <g>
      <ellipse cx="0" cy="62" rx="40" ry="7" fill="#000" opacity="0.06" />
      <path d="M-6,-52 C26,-56 48,-30 46,4 C44,38 22,58 -4,58 C-32,58 -48,36 -46,8 C-45,-10 -34,-14 -30,-28 C-26,-42 -20,-50 -6,-52 Z" fill="#F4D6AE" />
      <path d="M-38,20 C-34,42 -18,54 -2,55 C20,56 38,42 43,18 C34,40 18,48 -2,48 C-20,48 -32,38 -38,20 Z" fill="#E8BE8A" />
      <path d="M-26,-34 C-20,-44 -10,-47 0,-47" stroke="#FFF1DC" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M2,-52 C2,-62 6,-70 12,-74" stroke="#7DB36A" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M12,-74 C24,-82 36,-76 36,-66 C26,-62 16,-64 12,-74 Z" fill="#9BCB7F" />
      <path d="M4,-64 C-6,-74 -18,-70 -18,-62 C-10,-58 -2,-60 4,-64 Z" fill="#8CC07A" />
    </g>
  )
}

export function Flame({ size = 22, animate = false }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="-20 -28 40 46" aria-hidden="true" style={{ display: 'block' }}>
      <g className={animate ? 'bean-flicker' : undefined}>
        <path d="M0,-26 C8,-14 18,-8 18,6 a18,18 0 0 1 -36,0 c0,-8 5,-12 9,-15 0,5 3,8 5,8 C-6,-10 -3,-18 0,-26z" fill="#F08A3C" />
        <path d="M0,-2 c4,4 8,7 8,12 a8,8 0 0 1 -16,0 c0,-5 4,-8 8,-12z" fill="#FCE3B0" />
      </g>
    </svg>
  )
}

export function Bean({ mood = 'happy', size = 120, animate = true }) {
  const anim = animate ? (mood === 'happy' ? 'bean-hop' : mood === 'cheer' ? 'bean-sway' : '') : ''
  const tilt = mood === 'happy' ? -6 : mood === 'sleep' ? 8 : 0
  return (
    <div style={{ width: size, height: size, margin: '0 auto' }} aria-hidden="true">
      <style>{STYLE}</style>
      <svg width={size} height={size} viewBox="-90 -100 180 180" style={{ overflow: 'visible' }}>
        <g className={anim}>
          <g transform={`rotate(${tilt})`}>
            <Body />
            {mood === 'happy' && <>
              <path d="M-24,-2 q6,-8 12,0" stroke="#3A2E2A" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M10,-2 q6,-8 12,0" stroke="#3A2E2A" strokeWidth="4" fill="none" strokeLinecap="round" />
              <ellipse cx="-26" cy="12" rx="7" ry="4.5" fill="#F4A7A0" /><ellipse cx="26" cy="12" rx="7" ry="4.5" fill="#F4A7A0" />
              <path d="M-9,10 q9,14 18,0 z" fill="#C2564A" />
              <path d="M-44,-4 q-14,-14 -10,-30" stroke="#E8BE8A" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M44,-4 q14,-14 10,-30" stroke="#E8BE8A" strokeWidth="8" fill="none" strokeLinecap="round" />
            </>}
            {mood === 'cheer' && <>
              <ellipse cx="-17" cy="-2" rx="7" ry="8.5" fill="#3A2E2A" /><ellipse cx="17" cy="-2" rx="7" ry="8.5" fill="#3A2E2A" />
              <circle cx="-14.5" cy="-5.5" r="2.6" fill="#fff" /><circle cx="19.5" cy="-5.5" r="2.6" fill="#fff" />
              <ellipse cx="-27" cy="13" rx="7" ry="4.5" fill="#F4A7A0" /><ellipse cx="27" cy="13" rx="7" ry="4.5" fill="#F4A7A0" />
              <path d="M-7,12 q7,7 14,0" stroke="#3A2E2A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path d="M44,10 q16,-6 18,-22" stroke="#E8BE8A" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M-44,14 q-10,6 -12,16" stroke="#E8BE8A" strokeWidth="8" fill="none" strokeLinecap="round" />
            </>}
            {mood === 'worry' && <>
              <path d="M-26,-14 l10,4" stroke="#3A2E2A" strokeWidth="3" strokeLinecap="round" /><path d="M26,-14 l-10,4" stroke="#3A2E2A" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="-17" cy="0" rx="6.5" ry="7.5" fill="#3A2E2A" /><ellipse cx="17" cy="0" rx="6.5" ry="7.5" fill="#3A2E2A" />
              <circle cx="-15" cy="-3" r="2.4" fill="#fff" /><circle cx="19" cy="-3" r="2.4" fill="#fff" />
              <ellipse cx="-27" cy="14" rx="6" ry="4" fill="#F4A7A0" /><ellipse cx="27" cy="14" rx="6" ry="4" fill="#F4A7A0" />
              <path d="M-7,18 q7,-6 14,0" stroke="#3A2E2A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path d="M36,-18 c4,6 4,10 0,12 c-4,-2 -4,-6 0,-12z" fill="#8FC3EB" />
              <path d="M-44,8 q-12,8 -6,22" stroke="#E8BE8A" strokeWidth="8" fill="none" strokeLinecap="round" />
            </>}
            {mood === 'sleep' && <>
              <path d="M-24,0 q6,6 12,0" stroke="#3A2E2A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path d="M10,0 q6,6 12,0" stroke="#3A2E2A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <ellipse cx="-26" cy="14" rx="6" ry="4" fill="#F4A7A0" /><ellipse cx="26" cy="14" rx="6" ry="4" fill="#F4A7A0" />
              <ellipse cx="0" cy="17" rx="4" ry="3" fill="#C2564A" />
            </>}
          </g>
        </g>
        {mood === 'happy' && <>
          <path className="bean-twinkle" d="M-62,-70 l4,9 9,4 -9,4 -4,9 -4,-9 -9,-4 9,-4z" fill="#F5B841" />
          <path className="bean-twinkle" style={{ animationDelay: '.5s' }} d="M60,-84 l3,6 6,3 -6,3 -3,6 -3,-6 -6,-3 6,-3z" fill="#F5B841" />
        </>}
        {mood === 'cheer' && (
          <g transform="translate(72,-34)"><g className={animate ? 'bean-flicker' : undefined}>
            <path d="M0,-26 C8,-14 18,-8 18,6 a18,18 0 0 1 -36,0 c0,-8 5,-12 9,-15 0,5 3,8 5,8 C-6,-10 -3,-18 0,-26z" fill="#F08A3C" />
            <path d="M0,-2 c4,4 8,7 8,12 a8,8 0 0 1 -16,0 c0,-5 4,-8 8,-12z" fill="#FCE3B0" />
          </g></g>
        )}
        {mood === 'sleep' && <>
          <text x="40" y="-40" fontSize="16" fill="#8FA6D6" fontWeight="600">z</text>
          <text x="52" y="-58" fontSize="20" fill="#8FA6D6" fontWeight="600">z</text>
          <path d="M-56,-62 a14,14 0 1 0 14,18 a11,11 0 1 1 -14,-18z" fill="#F5D77A" />
        </>}
      </svg>
    </div>
  )
}
