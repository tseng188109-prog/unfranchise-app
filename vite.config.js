import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 版本：打包的時間，設定頁最下面顯示，一看就知道手機上是不是最新版
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 自己註冊（src/pages/appUpdate.js），才能在新版準備好時決定什麼時候重新整理
      injectRegister: false,
      includeAssets: ['favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png'],
      workbox: {
        importScripts: ['push-sw.js'],
        // 新版一下載好就接手（跟以前一樣），App 那邊再決定什麼時候重新整理
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'unfranchise',
        short_name: 'unfranchise',
        description: '超連鎖的每日行動夥伴：邀約、跟進、戰隊一起往夢想前進',
        theme_color: '#080d1a',
        background_color: '#080d1a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            // Android 會把圖示裁成圓形或其他形狀：這張的圖案縮在中間 80%，裁了也不會切到箭頭
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
