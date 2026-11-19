// 只給 t_send_handler 用：把 Supabase 和 web-push 換成假的，不會真的連資料庫、真的送通知
import { register } from 'node:module'
register('./stub-hooks.mjs', import.meta.url)
