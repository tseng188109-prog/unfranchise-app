#!/usr/bin/env bash
# 純計算的測試：不用瀏覽器、不用資料庫，幾秒就跑完。
cd "$(dirname "$0")"
fail=0
for t in t_rhythm t_jar t_jar_parity t_meet t_admin t_admin2 t_rem2 t_send_handler t_buddy t_cheer_api t_buddy_push t_search t_results; do
  if [ $t = t_send_handler ] || [ $t = t_buddy ] || [ $t = t_cheer_api ] || [ $t = t_buddy_push ]; then out=$(CRON_SECRET=s node --import ./stub-loader.mjs $t.mjs 2>&1); else out=$(node $t.mjs 2>&1); fi; code=$?
  p=$(echo "$out" | grep -c '^PASS'); f=$(echo "$out" | grep -cE '^FAIL|FAIL [1-9]')
  if [ $code -ne 0 ] || [ $f -gt 0 ]; then echo "✗ $t"; echo "$out" | grep -E '^FAIL|FAIL [1-9]|Error' | head -5; fail=1
  else s=$(echo "$out" | grep -oE 'PASS [0-9]+ FAIL 0' | tail -1); echo "✓ $t（${s:-通過 $p}）"; fi
done
exit $fail
