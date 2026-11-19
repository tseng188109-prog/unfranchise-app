#!/usr/bin/env bash
# 畫面測試：用假的資料庫，打開模擬手機，照真的操作一步一步點。
# 需要：Node、esbuild、playwright（Claude 的工作環境都有；自己電腦要先 npm i --no-save esbuild playwright）
cd "$(dirname "$0")"
mkdir -p shots
fail=0
group() { # group <入口編號> <port> [--prod] -- 測試...
  local n=$1 port=$2; shift 2; local prod=""; if [ "$1" = "--prod" ]; then prod="--prod"; shift; fi; shift
  node build.mjs $n $prod >/dev/null || { echo "打包 entry$n 失敗"; fail=1; return; }
  local dir=".build/$n${prod:+-prod}"
  node serve.mjs "$dir" $port & local pid=$!; sleep 0.5
  for t in "$@"; do
    local out; out=$(timeout 600 node $t.cjs 2>&1); local code=$?
    local p=$(echo "$out" | grep -c '^PASS'); local f=$(echo "$out" | grep -c '^FAIL')
    # t16–t26 是早期的「觀察型」測試：印出畫面上的數值給人看，不會自己判斷對錯。
    # 這裡只檢查它們跑完、沒有頁面錯誤（ERR [] 以外的都算錯）；數值要看 $t 的輸出。
    local errs=$(echo "$out" | grep '^ERR' | grep -v '^ERR \[\]$' | head -3)
    if [ $code -ne 0 ] || [ $f -gt 0 ] || [ -n "$errs" ]; then echo "✗ $t（通過 $p、失敗 $f）"; echo "$out" | grep -E '^FAIL|Error|^ERR' | head -5; fail=1
    elif [ $p -eq 0 ]; then echo "✓ $t（觀察型：跑完沒有頁面錯誤）"
    else echo "✓ $t（通過 $p）"; fi
  done
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
}
group 15 8765 -- t16 t17 t18 t19 t20 t21 t22 t23 t24 t25 t26
group 16 8765 -- t27 t33 t34 t35
group 16 8765 --prod -- t34b
group 18 8765 -- t28
group 19 8765 -- t29
group 20 8766 -- t30 t31 t32
exit $fail
