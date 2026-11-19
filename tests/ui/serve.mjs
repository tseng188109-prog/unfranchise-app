// 很小的網頁伺服器：任何網址都回 index.html（App 用的是網址路由），js/css 照檔案給
// 用法：node tests/ui/serve.mjs <資料夾> <port>
import http from 'http'
import fs from 'fs'
import path from 'path'
const [dir, port] = [process.argv[2], Number(process.argv[3] || 8765)]
const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' }
http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]))
  const f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dir, 'index.html')
  res.writeHead(200, { 'Content-Type': type[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
}).listen(port, '127.0.0.1')
