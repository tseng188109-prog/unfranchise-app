// sfx.js — 音效和震動（用程式合成，不用音檔：沒有版權問題，也不佔空間）
// 只在按了東西之後響（瀏覽器不讓網頁自己出聲）；手機切靜音時 iPhone 不會響。
// 震動只有 Android 有，iPhone 的網頁 App 蘋果不開放。
// 設定 → 外觀 →「音效和震動」可以關掉（存在這支手機上）。
const KEY = 'ufa_sfx_off'

export function sfxOn() {
  try { return localStorage.getItem(KEY) !== '1' } catch { return true }
}
export function setSfxOn(on) {
  try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, '1') } catch { /* ignore */ }
}

let ctx = null
function audio() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) { try { ctx = new AC() } catch { return null } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// 手機要「使用者先點過畫面」才准出聲；聲音常在存檔之後才響（那時已經不算點擊），
// 所以第一次點畫面時先把聲音打開備用。
export function unlockAudioOnTouch() {
  if (typeof document === 'undefined') return
  const go = () => {
    if (!sfxOn()) return
    const ac = audio()
    // 每次點都檢查一下：App 切到背景再回來，手機會把聲音關掉，要重新打開
    if (ac && ac.state !== 'running') {
      try { const b = ac.createBuffer(1, 1, 22050); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0) } catch { /* ignore */ }
    }
  }
  document.addEventListener('pointerdown', go, true)
  document.addEventListener('touchend', go, true)
}

// 一個音：頻率、開始時間（秒）、長度、音量、波形
function tone(ac, freq, at, dur, vol = 0.18, type = 'sine', slideTo = null) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  const t0 = ac.currentTime + at
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g); g.connect(ac.destination)
  o.start(t0); o.stop(t0 + dur + 0.02)
}

const SOUNDS = {
  // 火焰亮起來：「叮」往上揚
  ignite: ac => { tone(ac, 660, 0, 0.18, 0.16, 'triangle'); tone(ac, 990, 0.09, 0.32, 0.16, 'triangle') },
  // 做完今天：三個音往上
  done: ac => { [523, 659, 784].forEach((f, i) => tone(ac, f, i * 0.11, 0.3, 0.15, 'triangle')); tone(ac, 1047, 0.33, 0.5, 0.13, 'sine') },
  // 大日子：比較長的慶祝
  big: ac => {
    [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, i * 0.12, 0.28, 0.14, 'triangle'))
    tone(ac, 784, 0.52, 0.2, 0.12, 'triangle'); tone(ac, 1047, 0.64, 0.7, 0.15, 'sine'); tone(ac, 1319, 0.64, 0.7, 0.08, 'sine')
  },
  // 鼓掌：輕輕「啵」
  pop: ac => { tone(ac, 520, 0, 0.09, 0.2, 'sine', 900) },
  // 送出打氣：輕快的「咻」
  send: ac => { tone(ac, 420, 0, 0.22, 0.12, 'sine', 1300) },
}
const BUZZ = { ignite: 30, done: [30, 60, 30], big: [60, 80, 120], pop: 15 }

export function play(name) {
  if (!sfxOn()) return
  try {
    const ac = audio()
    if (ac && SOUNDS[name]) SOUNDS[name](ac)
  } catch { /* 出不了聲就算了 */ }
  try {
    if (BUZZ[name] && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(BUZZ[name])
  } catch { /* 不能震就算了 */ }
}
