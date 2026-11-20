// 把一個測試入口（entryNN.jsx）打包成可以在瀏覽器打開的小網站：tests/ui/.build/<名字>/
// App 的 src/supabase.js 換成假的資料庫（fake-supabase.js），不會連到真的 Supabase。
// 用法：node tests/ui/build.mjs 16 [--prod]
import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const n = process.argv[2]
const prod = process.argv.includes('--prod')
const out = path.join(here, '.build', n + (prod ? '-prod' : ''))
fs.mkdirSync(out, { recursive: true })

const fakeDb = {
  name: 'fake-supabase',
  setup(b) {
    // App 裡 import '../supabase' 或 './supabase' → 換成假的
    b.onResolve({ filter: /(^|\/)supabase(\.js)?$/ }, args => {
      const p = path.resolve(args.resolveDir, args.path)
      if (p === path.join(root, 'src', 'supabase') || p === path.join(root, 'src', 'supabase.js')) return { path: path.join(here, 'fake-supabase.js') }
      return undefined
    })
    // 後台程式 api/admin.js 用到的 Supabase 套件 → 空殼（測試時直接把假資料庫傳給 handle）
    b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: path.join(here, 'supabase-js-stub.js') }))
  },
}

await build({
  entryPoints: [path.join(here, `entry${n}.jsx`)],
  bundle: true, outdir: out, entryNames: 'out7', jsx: 'automatic',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  nodePaths: [path.join(root, 'node_modules')],
  plugins: [fakeDb], logLevel: 'error',
  ...(prod ? { minify: true, define: { 'process.env.NODE_ENV': '"production"' } } : {}),
})
fs.copyFileSync(path.join(here, 'index.html'), path.join(out, 'index.html'))
// App 圖示（登入頁、QR Code 中間要用）
for (const f of fs.readdirSync(path.join(root, 'public'))) if (f.endsWith('.png')) fs.copyFileSync(path.join(root, 'public', f), path.join(out, f))
console.log('built', path.relative(root, out))
