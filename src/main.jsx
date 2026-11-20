import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './pages/theme.jsx'
import './pages/errorReport.js' // 畫面出錯時自動記給系統管理
import App from './App.jsx'
import { setupUpdates } from './pages/appUpdate'
import { unlockAudioOnTouch } from './lib/sfx'

setupUpdates()        // 有新版就自動換上（正在打字時改成跳提示）
unlockAudioOnTouch()  // 手機要先點過畫面才准出聲

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
