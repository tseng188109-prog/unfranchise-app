#!/usr/bin/env bash
# 一次跑完全部：計算 → 畫面 → 資料庫（資料庫那段要有測試用的 PostgreSQL，沒有就跳過）
cd "$(dirname "$0")"
fail=0
echo "── 計算"; bash unit/run.sh || fail=1
echo "── 畫面"; bash ui/run.sh || fail=1
echo "── 資料庫"; if [ -S /tmp/pg/.s.PGSQL.5544 ]; then bash db/run.sh || fail=1; else echo "（跳過：沒有測試用的 PostgreSQL）"; fi
[ $fail -eq 0 ] && echo "全部通過" || echo "有失敗，看上面 ✗ 的地方"
exit $fail
