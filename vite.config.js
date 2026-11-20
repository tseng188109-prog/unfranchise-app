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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        importScripts: ['push-sw.js'],
        // 新版一下載好就接手（跟以前一樣），App 那邊再決定什麼時候重新整理
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: '超連鎖行動計畫',
        short_name: '超連鎖',
        description: 'Market America 超連鎖店主團隊管理工具',
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
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
