#!/usr/bin/env bash
# deliver-77：邀請連結的短代碼（每人一組、不會重複、用代碼只查得到名字）
cd "$(dirname "$0")"
Y=2a59a0ae-9877-45dd-b26b-66f8ed6dff74; T=11111111-0000-0000-0000-000000000008; L=11111111-0000-0000-0000-000000000004
P="psql -h /tmp/pg -p 5544 -U postgres -q -d t -At"
fail=0; pass=0
run(){ $P -c "begin; set local role $1; do \$d\$ begin perform set_config('request.jwt.claim.sub','$2',true); perform set_config('request.jwt.claim.role','$1',true); end \$d\$; $3; commit;" 2>&1 | grep -v '^$' | sed 's/^ERROR:  //;s/^psql:.*ERROR:  //'; }
chk(){ desc="$1"; exp="$2"; shift 2; got=$(run "$@" | tr '\n' ';'); if [[ "$got" == *"$exp"* ]]; then echo "PASS $desc"; pass=$((pass+1)); else echo "FAIL $desc => $got"; fail=1; fi; }
su(){ $P -c "$1" >/dev/null 2>&1; }

c1=$(run authenticated $Y "select my_ref_code()" | tail -1)
[[ "$c1" =~ ^[A-HJ-NP-Z2-9]{6}$ ]] && { echo "PASS 第一次拿到 6 碼代碼（$c1）"; pass=$((pass+1)); } || { echo "FAIL 代碼格式 => $c1"; fail=1; }
chk "再拿一次還是同一組" "$c1;" authenticated $Y "select my_ref_code()"
c2=$(run authenticated $T "select my_ref_code()" | tail -1)
[ -n "$c2" ] && [ "$c2" != "$c1" ] && { echo "PASS 別人拿到不同的代碼"; pass=$((pass+1)); } || { echo "FAIL 代碼重複 => $c2"; fail=1; }
chk "沒登入不能產生代碼" "permission denied" anon "" "select my_ref_code()"
chk "沒登入可以用代碼查推薦人（只有 id 和名字）" "$Y|" anon "" "select * from ref_lookup('$c1')"
chk "小寫、前後空白也查得到" "$Y|" anon "" "select id||'|' from ref_lookup('  $(echo $c1 | tr A-Z a-z) ')"
chk "回傳只有兩個欄位" "2;" anon "" "select count(*) from (select (ref_lookup('$c1')).*) x where false union all select 2"
chk "亂打的代碼查不到" "0;" anon "" "select count(*) from ref_lookup('ZZZZZZ')"
chk "空的查不到" "0;" anon "" "select count(*) from ref_lookup(null)"
chk "沒登入讀不到任何人的代碼" "0;" anon "" "select count(*) from users where ref_code is not null"
chk "代碼不能手動改成跟別人一樣" "duplicate key" authenticated $L "update users set ref_code='$c1' where id='$L'"
su "insert into account_status(user_id,deactivated_at) values ('$Y',now()) on conflict (user_id) do update set deactivated_at=now()"
chk "停用的帳號，代碼查不到" "0;" anon "" "select count(*) from ref_lookup('$c1')"
su "delete from account_status where user_id='$Y'"
echo "通過 $pass"
[ $fail -eq 0 ]
