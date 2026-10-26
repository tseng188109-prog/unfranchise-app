// 日夜主題：白天＝暖紙色，夜晚＝暖石墨。
// 所有頁面的顏色都寫成 CSS 變數（var(--card) 之類），這裡負責定義兩套數值、
// 並依「跟隨手機／永遠白天／永遠夜晚」切換。main.jsx 會在畫面出現之前先載入這個檔案，所以不會閃白。
const KEY = 'ufa_theme' // 'system' | 'light' | 'dark'

const LIGHT = `
  --page:#F7F5F1; --card:#FFFFFF; --sub:#FAF8F4; --sub2:#F1EEE8;
  --border:#ECE8E1; --border2:#DDD8CF;
  --text:#1F2430; --text2:#6D6F78; --muted:#A5A29A;
  --primary:#2457D6; --primary-soft:#E3EAF6;
  --orange-soft:#F6E4D6; --orange-text:#A9561F; --orange-border:#EBCDB6;
  --green-soft:#DFEFE5; --green-text:#2F7A52; --green-border:#BFDCCB;
  --yellow-soft:#F6ECCD; --yellow-text:#86600F; --yellow-border:#E8D6A2;
  --pink-soft:#F5E2E9; --pink-text:#A8456E; --pink-border:#E6C4D2;
  --danger-soft:#F7DFDD; --danger-text:#B3322F; --danger-border:#E9B7B4;
  --hero:#1E2A44; --hero-border:#1E2A44;
  --shadow:0 1px 2px rgba(31,36,48,.04);
  --overlay:rgba(31,36,48,.42);
`
const DARK = `
  --page:#1A1917; --card:#232220; --sub:#2A2823; --sub2:#2F2D28;
  --border:#33312D; --border2:#45423B;
  --text:#ECE8E1; --text2:#A39E94; --muted:#77726A;
  --primary:#5B8DEF; --primary-soft:#222C40;
  --orange-soft:#3B291C; --orange-text:#E8A06B; --orange-border:#5A3F2A;
  --green-soft:#20332A; --green-text:#8FCBA8; --green-border:#2F5242;
  --yellow-soft:#3A3320; --yellow-text:#E5C77A; --yellow-border:#5A4E2C;
  --pink-soft:#3A2530; --pink-text:#E4A3BE; --pink-border:#5A3A48;
  --danger-soft:#3D2422; --danger-text:#F0A09C; --danger-border:#6A3B38;
  --hero:#2A2823; --hero-border:#3A3731;
  --shadow:none;
  --overlay:rgba(0,0,0,.6);
`

const CSS = `
:root{${LIGHT} color-scheme: light;}
:root[data-theme="dark"]{${DARK} color-scheme: dark;}
html,body{background:var(--page); color:var(--text);}
input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select{background:var(--card); color:var(--text); font-family:inherit;}
input::placeholder,textarea::placeholder{color:var(--muted);}
@keyframes ufa-pop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
.ufa-pop{animation:ufa-pop .28s ease-out;}
`

let mode = 'system'
try { mode = localStorage.getItem(KEY) || 'system' } catch { /* ignore */ }

function systemIsDark() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
}

export function resolveTheme() {
  return mode === 'dark' || (mode === 'system' && systemIsDark()) ? 'dark' : 'light'
}

export function applyTheme() {
  const t = resolveTheme()
  document.documentElement.setAttribute('data-theme', t)
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', t === 'dark' ? '#1A1917' : '#F7F5F1')
}

export function getThemeMode() { return mode }

export function setThemeMode(m) {
  mode = m
  try { localStorage.setItem(KEY, m) } catch { /* ignore */ }
  applyTheme()
}

if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.setAttribute('data-ufa-theme', '1')
  style.textContent = CSS
  document.head.appendChild(style)
  applyTheme()
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (mode === 'system') applyTheme()
    })
  } catch { /* ignore */ }
}
