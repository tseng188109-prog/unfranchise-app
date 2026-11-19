# 系統管理那一包（deliver-74）的資料庫檢查：登入紀錄、出錯紀錄、管理用函式的權限
# 由 run.sh 叫，資料庫已經 reset 並套好 migrations
P="psql -h /tmp/pg -p 5544 -U postgres -v ON_ERROR_STOP=1 -q -d t"
U1=11111111-0000-0000-0000-000000000001; U2=11111111-0000-0000-0000-000000000002
$P -c "insert into auth.sessions(user_id,created_at,updated_at,user_agent) values ('$U1',now()-interval '3 day',now()-interval '1 hour','Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)'),('$U1',now()-interval '9 day',null,'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),('$U2',now(),null,'x'); update auth.users set last_sign_in_at=now() where id='$U1';"
echo "--- 記自己的登入"; bash as.sh authenticated $U1 "insert into login_events(user_id,device) values ('$U1','iPhone')"
echo "--- 記別人的登入（要擋）"; bash as.sh authenticated $U1 "insert into login_events(user_id,device) values ('$U2','iPhone')"
echo "--- 一般帳號讀登入紀錄（要 0）"; bash as.sh authenticated $U1 "select count(*) from login_events"
for i in $(seq 1 13); do $P -c "insert into login_events(user_id,device,at) values ('$U1','d$i', now() + ($i||' minute')::interval)"; done
echo "--- 只留 10 筆: $($P -At -c "select count(*)||' 筆, 最舊 '||min(at)::time::text from login_events where user_id='$U1'")"
bash asc.sh authenticated $U1 "select report_app_error('首頁','boom','iPhone'); select report_app_error('首頁','boom','iPhone'); select report_app_error('首頁','other','Android')" >/dev/null
bash asc.sh authenticated $U2 "select report_app_error('首頁','boom','電腦')" >/dev/null
echo "--- 出錯紀錄（boom 應該 2 次）:"; $P -At -c "select page,message,count,device from app_errors order by id"
echo "--- 一般帳號讀出錯紀錄（要 0）"; bash as.sh authenticated $U1 "select count(*) from app_errors"
echo "--- 沒登入的人記錯誤（要擋）"; bash as.sh anon 00000000-0000-0000-0000-000000000000 "select report_app_error('首頁','x','x')"
$P -c "update app_errors set handled_at=now() where message='boom'"; bash asc.sh authenticated $U1 "select report_app_error('首頁','boom','iPhone')" >/dev/null
echo "--- 修好後又出現 → 新的一筆:"; $P -At -c "select message,count,(handled_at is null) as open from app_errors order by id"
echo "--- 一般帳號叫管理函式（要擋）"; bash as.sh authenticated $U1 "select * from admin_sessions('$U1')"; bash as.sh authenticated $U1 "select admin_signout_all('$U2')"; bash as.sh authenticated $U1 "select * from admin_onboarding()"
echo "--- 後台：裝置"; bash as.sh service_role 00000000-0000-0000-0000-000000000000 "select user_agent from admin_sessions('$U1')"
echo "--- 後台：起步"; bash as.sh service_role 00000000-0000-0000-0000-000000000000 "select * from admin_onboarding() where user_id in ('$U1','$U2')"
echo "--- 後台：登出全部 → $(bash asc.sh service_role 00000000-0000-0000-0000-000000000000 "select admin_signout_all('$U1')" | tail -1) 台, 剩 $($P -At -c "select count(*) from auth.sessions where user_id='$U1'")，別人還在 $($P -At -c "select count(*) from auth.sessions where user_id='$U2'")"
