#!/usr/bin/env bash
# deliver-76：打氣、好消息、鼓掌、搭檔連勝的權限和規則
# 先 reset，再套全部 migrations（run.sh 會做），這裡只跑檢查。
cd "$(dirname "$0")"
Y=2a59a0ae-9877-45dd-b26b-66f8ed6dff74; T=11111111-0000-0000-0000-000000000008; L=11111111-0000-0000-0000-000000000004
S=11111111-0000-0000-0000-000000000007; A=11111111-0000-0000-0000-000000000005; C=11111111-0000-0000-0000-000000000003
P="psql -h /tmp/pg -p 5544 -U postgres -q -d t -At"
fail=0; pass=0
# 用某個身分跑 SQL，會 commit；錯誤訊息也印出來（方便比對）
run(){ $P -c "begin; set local role $1; do \$d\$ begin perform set_config('request.jwt.claim.sub','$2',true); perform set_config('request.jwt.claim.role','$1',true); end \$d\$; $3; commit;" 2>&1 | grep -v '^$' | sed 's/^ERROR:  //;s/^psql:.*ERROR:  //'; }
chk(){ desc="$1"; exp="$2"; shift 2; got=$(run "$@" | tr '\n' ';'); if [[ "$got" == *"$exp"* ]]; then echo "PASS $desc"; pass=$((pass+1)); else echo "FAIL $desc => $got"; fail=1; fi; }
su(){ $P -c "$1" >/dev/null 2>&1; }

# 測試用的資料：Lisa 也加入 Yu 的戰隊（隊 B：Yu、隊友T、Lisa），交易表補上顧客欄位
su "alter table transactions add column if not exists customer_id uuid; alter table transactions add column if not exists is_gift boolean default false;"
su "insert into team_members(team_id,user_id) values ('22222222-0000-0000-0000-000000000002','$L') on conflict do nothing"
su "delete from daily_checkins; delete from contact_logs; delete from transactions"

# ── 句子包 ──
chk "登入的人讀得到 72 句" "72;" authenticated $Y "select count(*) from active_phrases()"
chk "沒登入讀不到句子" "permission denied" anon "" "select count(*) from active_phrases()"
su "insert into app_phrases(grp,sort,text,pack,starts_on,ends_on) values ('quote',1,'聖誕快樂，一起衝','聖誕',current_date-1,current_date+1)"
chk "有排日期的那組，期間內只用新的" "1;聖誕快樂，一起衝;" authenticated $Y "select count(*) from active_phrases() where grp='quote'; select text from active_phrases() where grp='quote'"
chk "別組不受影響" "10;" authenticated $Y "select count(*) from active_phrases() where grp='start'"
su "delete from app_phrases where pack='聖誕'"

# ── 打氣 ──
chk "送給同隊隊友" "1;" authenticated $Y "select count(*) from (select send_cheer('$T','欸，你今天很猛欸')) x"
chk "同一天不能再送同一位" "今天已經給他打過氣了" authenticated $Y "select send_cheer('$T','太強了吧，掌聲給你')"
chk "不能送給別隊的人" "只能打氣給同一個戰隊的隊友" authenticated $Y "select send_cheer('$A','欸，你今天很猛欸')"
chk "不能送給自己" "不能打氣給自己" authenticated $Y "select send_cheer('$Y','欸，你今天很猛欸')"
chk "不能自己打字" "這句話不在句子包裡" authenticated $Y "select send_cheer('$L','我自己亂打的')"
chk "完成後的自誇句不能拿來送" "這句話不在句子包裡" authenticated $Y "select send_cheer('$L','不愧是我！')"
su "update users set tag_settings = jsonb_build_object('notify', jsonb_build_object('cheer', false)) where id='$L'"
chk "對方關掉就送不了" "對方目前沒有開放隊友打氣" authenticated $Y "select send_cheer('$L','欸，你今天很猛欸')"
chk "狀態：Lisa 關掉、T 今天打過了" "$L|f|f|f;$T|t|t|f;" authenticated $Y "select user_id, can_cheer, cheered_today, has_push from team_cheer_status() order by 1"
su "update users set tag_settings = null where id='$L'"
chk "收到的人看得到" "1;" authenticated $T "select count(*) from cheers"
chk "送的人看得到" "1;" authenticated $Y "select count(*) from cheers"
chk "別人看不到" "0;" authenticated $L "select count(*) from cheers"
chk "不能直接寫進打氣表" "row-level security" authenticated $Y "insert into cheers(from_id,to_id,text) values ('$Y','$L','x')"
chk "不能直接改打氣表" "0;" authenticated $T "with x as (update cheers set text='改掉' returning 1) select count(*) from x"
chk "全隊這週打氣次數" "1;" authenticated $L "select team_cheer_count(current_date - 7)"
chk "別隊看不到這隊的次數" "0;" authenticated $C "select team_cheer_count(current_date - 7)"
chk "收到的人標記看過" "1;" authenticated $T "select mark_cheers_seen()"
chk "再標記一次沒有新的" "0;" authenticated $T "select mark_cheers_seen()"

# ── 好消息：自動產生 ──
su "insert into contacts(id,user_id,name) values ('33333333-0000-0000-0000-000000000001','$Y','朋友甲') on conflict do nothing"
run authenticated $Y "insert into contact_logs(contact_id,user_id,date,kind) values ('33333333-0000-0000-0000-000000000001','$Y',current_date,'meet_plan')" >/dev/null
chk "約到人 → 好消息" "meet;" authenticated $T "select kind from team_news where user_id='$Y'"
chk "別隊看不到" "0;" authenticated $C "select count(*) from team_news"
run authenticated $Y "insert into contact_logs(contact_id,user_id,date,kind) values ('33333333-0000-0000-0000-000000000001','$Y',current_date - 10,'meet_plan')" >/dev/null
chk "10 天前補記的約不上好消息" "1;" authenticated $T "select count(*) from team_news where kind='meet'"
run authenticated $Y "insert into contact_logs(contact_id,user_id,date,kind) values ('33333333-0000-0000-0000-000000000001','$Y',current_date,'invite_no')" >/dev/null
chk "沒約成不上好消息" "1;" authenticated $T "select count(*) from team_news"
run authenticated $Y "delete from contact_logs where kind='meet_plan' and date=current_date" >/dev/null
chk "刪掉那筆約，好消息跟著拿掉" "0;" authenticated $T "select count(*) from team_news where kind='meet'"
run authenticated $Y "insert into transactions(user_id,type,points,date,customer_id,is_gift) values ('$Y','BV',50,current_date,'44444444-0000-0000-0000-000000000001',false),('$Y','IBV',5,current_date,'44444444-0000-0000-0000-000000000001',false)" >/dev/null
chk "成交零售 → 一則（同一位顧客同一天只算一則）" "1;" authenticated $T "select count(*) from team_news where kind='retail'"
run authenticated $Y "insert into transactions(user_id,type,points,date,customer_id,is_gift) values ('$Y','BV',50,current_date,'44444444-0000-0000-0000-000000000002',true)" >/dev/null
run authenticated $Y "insert into transactions(user_id,type,points,date) values ('$Y','BV',50,current_date)" >/dev/null
chk "送禮、自己買的不算零售" "1;" authenticated $T "select count(*) from team_news where kind='retail'"
chk "好消息不記顧客是誰、買什麼" "0;" authenticated $T "select count(*) from team_news where ref like '%44444444%' and kind='retail'"
su "update users set referrer_id='$Y' where id='$S'"
chk "推薦了新夥伴 → 好消息" "partner;" authenticated $T "select kind from team_news where user_id='$Y' and kind='partner'"
run authenticated $T "insert into daily_checkins(user_id,date,task_key,is_done) values ('$T',current_date,'daily_3_contacts',true)" >/dev/null
chk "第一次做滿一天 → 好消息（帶他的節奏，新帳號是 1-1-2）" "first312|1-1-2;" authenticated $Y "select kind, label from team_news where user_id='$T'"
run authenticated $T "insert into daily_checkins(user_id,date,task_key,is_done) values ('$T',current_date - 1,'daily_3_contacts',true)" >/dev/null
chk "第二次不會再上" "1;" authenticated $Y "select count(*) from team_news where user_id='$T' and kind='first312'"
su "insert into daily_checkins(user_id,date,task_key,is_done) values ('$C',current_date - 30,'daily_3_contacts',true)"
run authenticated $C "insert into daily_checkins(user_id,date,task_key,is_done) values ('$C',current_date,'daily_3_contacts',true)" >/dev/null
chk "以前做滿過的，不補發" "0;" authenticated $C "select count(*) from team_news where kind='first312'"
chk "沒加入戰隊的人，約到人也不會產生" "0;" postgres "" "select count(*) from team_news where user_id='$S'"

# ── 鼓掌 ──
chk "替隊友鼓掌" "1;" authenticated $T "with n as (select id from team_news where user_id='$Y' and kind='retail') insert into news_claps(news_id) select id from n returning 1"
chk "不能替自己鼓掌" "row-level security" authenticated $Y "insert into news_claps(news_id) select id from team_news where user_id='$Y' and kind='retail'"
chk "同一則不能拍兩次" "duplicate key" authenticated $T "insert into news_claps(news_id) select id from team_news where user_id='$Y' and kind='retail'"
chk "本人看得到誰拍的" "$T;" authenticated $Y "select c.user_id from news_claps c join team_news n on n.id=c.news_id where n.kind='retail'"
chk "別隊看不到鼓掌" "0;" authenticated $C "select count(*) from news_claps"
chk "收回自己的鼓掌" "1;" authenticated $T "with x as (delete from news_claps returning 1) select count(*) from x"

# ── App 自己加的好消息 ──
chk "連續 7 天上好消息" "t;" authenticated $Y "select add_team_news('streak',7,null,current_date - 6)"
chk "連續 5 天不上" "f;" authenticated $Y "select add_team_news('streak',5,null,current_date - 4)"
chk "同一段連勝不重複" "1;" authenticated $Y "select add_team_news('streak',7,null,current_date - 6); select count(*) from team_news where kind='streak'"
chk "不是搭檔不能加搭檔好消息" "f;" authenticated $Y "select add_team_news('buddy',7,'$T',current_date - 6)"

# ── 搭檔 ──
chk "邀同隊隊友當搭檔" "1;" authenticated $Y "select count(*) from (select buddy_invite('$T')) x"
chk "不能重複邀" "你們已經是搭檔，或邀請還在等回覆" authenticated $Y "select buddy_invite('$T')"
chk "對方也不能反過來再邀" "你們已經是搭檔，或邀請還在等回覆" authenticated $T "select buddy_invite('$Y')"
chk "不能邀別隊的人" "只能邀同一個戰隊的隊友" authenticated $Y "select buddy_invite('$A')"
chk "別人看不到這個邀請" "0;" authenticated $L "select count(*) from buddies"
chk "只有被邀的人能接受" "這個邀請已經過期或取消了" authenticated $Y "select buddy_accept(id) from buddies limit 1"
chk "被邀的人接受" "t;" authenticated $T "select buddy_accept(id) from buddies where to_id='$T'"
chk "開始日是今天" "active|t;" authenticated $Y "select status, start_day = tw_today() from buddies"
chk "搭檔好消息（7 天）" "t;" authenticated $T "select add_team_news('buddy',7,'$Y',current_date - 6)"
chk "另一位再加一次也只有一則" "1;" authenticated $Y "select add_team_news('buddy',7,'$T',current_date - 6); select count(*) from team_news where kind='buddy'"
chk "搭檔好消息兩個人都不能自己鼓掌" "row-level security" authenticated $T "insert into news_claps(news_id) select id from team_news where kind='buddy'"
chk "隊友可以替他們鼓掌" "1;" authenticated $L "with x as (insert into news_claps(news_id) select id from team_news where kind='buddy' returning 1) select count(*) from x"
su "insert into buddies(from_id,to_id,status,created_at) values ('$L','$Y','pending',now() - interval '8 days')"
chk "超過 7 天的邀請不能接受" "這個邀請已經過期或取消了" authenticated $Y "select buddy_accept(id) from buddies where from_id='$L'"
chk "過期後可以重新邀" "1;" authenticated $L "select count(*) from (select buddy_invite('$Y')) x"
chk "收回自己送出的邀請" "t;" authenticated $L "select buddy_end(id) from buddies where from_id='$L' and status='pending'"
su "insert into auth.users values ('55555555-0000-0000-0000-000000000001','p1@x.com'),('55555555-0000-0000-0000-000000000002','p2@x.com'),('55555555-0000-0000-0000-000000000003','p3@x.com') on conflict do nothing"
su "insert into users(id,name) values ('55555555-0000-0000-0000-000000000001','p1'),('55555555-0000-0000-0000-000000000002','p2'),('55555555-0000-0000-0000-000000000003','p3') on conflict do nothing"
su "insert into team_members(team_id,user_id) select '22222222-0000-0000-0000-000000000002', id from users where name in ('p1','p2','p3') on conflict do nothing"
run authenticated $Y "select buddy_invite('55555555-0000-0000-0000-000000000001'); select buddy_invite('55555555-0000-0000-0000-000000000002')" >/dev/null
chk "最多 3 位（含等回覆的邀請）" "你已經有 3 位搭檔（或邀請還在等回覆）" authenticated $Y "select buddy_invite('55555555-0000-0000-0000-000000000003')"
chk "不想要可以拒絕（對方不會收到通知）" "t;" authenticated 55555555-0000-0000-0000-000000000002 "select buddy_decline(id) from buddies where to_id='55555555-0000-0000-0000-000000000002'"
chk "拒絕後空出位置" "1;" authenticated $Y "select count(*) from (select buddy_invite('55555555-0000-0000-0000-000000000003')) x"
su "delete from team_members where user_id='$T'"
chk "退出戰隊，搭檔跟著結束" "ended;" authenticated $Y "select status from buddies where to_id='$T' or from_id='$T'"
chk "退出的人的好消息，隊友看不到了" "0;" authenticated $L "select count(*) from team_news where user_id='$T' or other_id='$T'"
chk "退出的人看不到原本戰隊的好消息" "0;" authenticated $T "select count(*) from team_news"
chk "慶祝記號只看得到自己的" "1;" authenticated $Y "insert into buddy_marks(key) values ('b:1:7:x'); select count(*) from buddy_marks"
chk "別人看不到我的慶祝記號" "0;" authenticated $L "select count(*) from buddy_marks"

# 好消息出問題時，原本的記錄照樣存得進去
su "alter table team_news rename to team_news_x"
chk "好消息表壞掉也不會擋到記約" "1;" authenticated $Y "insert into contact_logs(contact_id,user_id,date,kind) values ('33333333-0000-0000-0000-000000000001','$Y',current_date,'meet_plan'); select count(*) from contact_logs where kind='meet_plan' and date=current_date"
chk "好消息表壞掉也不會擋到記業績" "1;" authenticated $Y "insert into transactions(user_id,type,points,date,customer_id) values ('$Y','BV',9,current_date,'44444444-0000-0000-0000-000000000009'); select count(*) from transactions where points=9"
su "alter table team_news_x rename to team_news"
echo "通過 $pass"
[ $fail -eq 0 ]
