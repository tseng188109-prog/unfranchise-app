#!/usr/bin/env bash
# 資料庫權限測試：在一個本機的 PostgreSQL 16 上，建一份跟 Supabase 一樣的表和權限，
# 用不同身分（沒登入、一般帳號、後台）去讀寫，確認該擋的都擋住。
# 需要：PostgreSQL 16，用 socket /tmp/pg、port 5544（見 README）。
cd "$(dirname "$0")"
P="psql -h /tmp/pg -p 5544 -U postgres -v ON_ERROR_STOP=1 -q -d t"
bash reset.sh >/dev/null 2>&1 || { echo "✗ 連不到測試用的 PostgreSQL（見 README）"; exit 1; }
$P -c "alter table auth.users add column if not exists last_sign_in_at timestamptz; create table if not exists auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, created_at timestamptz default now(), updated_at timestamptz, user_agent text); alter table contact_logs add column if not exists note text;" >/dev/null
for f in migrations/*.sql; do $P -f "$f" >/dev/null 2>/tmp/db_err.txt || { echo "✗ 套用 $f 失敗"; head -3 /tmp/db_err.txt; exit 1; }; done
out=$(bash rls_test.sh 2>&1); p=$(echo "$out" | grep -c '^PASS'); f=$(echo "$out" | grep -c '^FAIL')
if [ $f -gt 0 ]; then echo "✗ 權限測試（通過 $p、失敗 $f）"; echo "$out" | grep '^FAIL' | head -5; exit 1; fi
echo "✓ 權限測試（通過 $p）"
# 夥伴頁的罐子數字：資料庫算的要跟 App 算的一樣（同一天、同一份名單，用 unit/t_jar_parity 算 App 那邊）
$P -f rand2.sql >/dev/null 2>&1 || { echo "✗ 載入 400 筆模擬名單失敗"; exit 1; }
got=$(./as.sh authenticated 11111111-0000-0000-0000-000000000001 "select * from get_partner_jar('11111111-0000-0000-0000-000000000001')" | tail -1)
app=$(node ../unit/t_jar_parity.mjs --value)
[ -n "$app" ] && [ "$got" = "$app" ] && echo "✓ 罐子數字 App 和資料庫一致（$got）" || { echo "✗ 罐子數字對不上：資料庫 $got，App $app"; exit 1; }
# deliver-74：登入紀錄、出錯紀錄、管理用函式
bash reset.sh >/dev/null 2>&1
$P -c "alter table auth.users add column if not exists last_sign_in_at timestamptz; create table if not exists auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, created_at timestamptz default now(), updated_at timestamptz, user_agent text); alter table contact_logs add column if not exists note text;" >/dev/null
for f in migrations/*.sql; do $P -f "$f" >/dev/null 2>&1; done
out=$(bash t74.sh 2>&1)
bad=0
echo "$out" | grep -q "row-level security policy" || bad=1          # 記別人的登入要被擋
echo "$out" | grep -q "^首頁|boom|2|" || bad=1                      # 同人同天只算一次
[ $(echo "$out" | grep -c "permission denied for function admin_") -eq 3 ] || bad=1
echo "$out" | grep -q "剩 0，別人還在 1" || bad=1
echo "$out" | grep -q "只留 10 筆: 10 筆" || bad=1
[ $bad -eq 0 ] && echo "✓ 登入紀錄、出錯紀錄、管理函式" || { echo "✗ deliver-74 檢查沒過"; echo "$out" | tail -20; exit 1; }
# deliver-76：打氣、好消息、鼓掌、搭檔連勝
bash reset.sh >/dev/null 2>&1
$P -c "alter table auth.users add column if not exists last_sign_in_at timestamptz; create table if not exists auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, created_at timestamptz default now(), updated_at timestamptz, user_agent text); alter table contact_logs add column if not exists note text;" >/dev/null
for f in migrations/*.sql; do $P -f "$f" >/dev/null 2>&1; done
out=$(bash t76.sh 2>&1) && echo "✓ 打氣、好消息、鼓掌、搭檔連勝（$(echo "$out" | tail -1)）" || { echo "✗ deliver-76 檢查沒過"; echo "$out" | grep '^FAIL' | head -10; exit 1; }
