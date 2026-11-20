#!/usr/bin/env bash
# deliver-78：搭檔答應時記下時間；通知送過的記號只有後台能改
cd "$(dirname "$0")"
Y=2a59a0ae-9877-45dd-b26b-66f8ed6dff74; T=11111111-0000-0000-0000-000000000008; L=11111111-0000-0000-0000-000000000004
P="psql -h /tmp/pg -p 5544 -U postgres -q -d t -At"
fail=0; pass=0
run(){ $P -c "begin; set local role $1; do \$d\$ begin perform set_config('request.jwt.claim.sub','$2',true); perform set_config('request.jwt.claim.role','$1',true); end \$d\$; $3; commit;" 2>&1 | grep -v '^$' | sed 's/^ERROR:  //;s/^psql:.*ERROR:  //'; }
chk(){ desc="$1"; exp="$2"; shift 2; got=$(run "$@" | tr '\n' ';'); if [[ "$got" == *"$exp"* ]]; then echo "PASS $desc"; pass=$((pass+1)); else echo "FAIL $desc => $got"; fail=1; fi; }
bid=$(run authenticated $Y "select buddy_invite('$T')" | tail -1)
[ -n "$bid" ] && { echo "PASS Yu 邀隊友T（$bid）"; pass=$((pass+1)); } || { echo "FAIL 邀請失敗"; fail=1; }
chk "剛邀請：還沒有答應時間" "|pending;" authenticated $Y "select coalesce(accepted_at::text,'')||'|'||status from buddies where id=$bid"
chk "隊友T 答應" "t;" authenticated $T "select buddy_accept($bid)"
chk "答應後記下答應時間" "true|active;" authenticated $T "select (accepted_at > now() - interval '1 minute')::text||'|'||status from buddies where id=$bid"
chk "自己不能改通知記號" "0;" authenticated $Y "with x as (update buddies set invite_pushed_at=now() where id=$bid returning 1) select count(*) from x"
chk "其他規則照舊：不能重複邀" "你們已經是搭檔" authenticated $Y "select buddy_invite('$T')"
echo "通過 $pass"
[ $fail -eq 0 ]
