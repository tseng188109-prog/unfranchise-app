-- Yu(Y) -> Mei(M) -> Jay(J) -> Jiao(C); M -> Lisa(L); Y -> Amy(A); Ming(N) pending email to yu; Stranger(S) unrelated; T teammate of Y (not referral)
insert into auth.users values
('2a59a0ae-9877-45dd-b26b-66f8ed6dff74','yu@x.com'),('00000000-0000-0000-0000-00000000000a','admin2@x.com'),
('11111111-0000-0000-0000-000000000001','mei@x.com'),('11111111-0000-0000-0000-000000000002','jay@x.com'),
('11111111-0000-0000-0000-000000000003','jiao@x.com'),('11111111-0000-0000-0000-000000000004','lisa@x.com'),
('11111111-0000-0000-0000-000000000005','amy@x.com'),('11111111-0000-0000-0000-000000000006','ming@x.com'),
('11111111-0000-0000-0000-000000000007','s@x.com'),('11111111-0000-0000-0000-000000000008','t@x.com');
insert into users(id,name,why_here) values ('2a59a0ae-9877-45dd-b26b-66f8ed6dff74','Yu','secretY'),('00000000-0000-0000-0000-00000000000a','Yu2',null);
insert into users(id,name,referrer_id,why_here) values
('11111111-0000-0000-0000-000000000001','小美','2a59a0ae-9877-45dd-b26b-66f8ed6dff74','secretM'),
('11111111-0000-0000-0000-000000000002','阿傑','11111111-0000-0000-0000-000000000001','secretJ'),
('11111111-0000-0000-0000-000000000003','春嬌','11111111-0000-0000-0000-000000000002','secretC'),
('11111111-0000-0000-0000-000000000004','Lisa','11111111-0000-0000-0000-000000000001',null),
('11111111-0000-0000-0000-000000000005','Amy','2a59a0ae-9877-45dd-b26b-66f8ed6dff74',null),
('11111111-0000-0000-0000-000000000007','路人',null,'secretS'),
('11111111-0000-0000-0000-000000000008','隊友T',null,null);
insert into users(id,name,referrer_email_pending) values ('11111111-0000-0000-0000-000000000006','志明','YU@x.com ');
insert into profiles(id,name,referrer_id) select id,name,null from users;
update profiles set referrer_id='11111111-0000-0000-0000-000000000002' where id='11111111-0000-0000-0000-000000000003';
insert into contacts(user_id,name) select id,'c-'||name from users;
insert into contact_logs(contact_id,user_id) select c.id,c.user_id from contacts c;
insert into daily_checkins(user_id,date,task_key,is_done) select id, current_date, 'daily_312', true from users;
insert into transactions(user_id,type,points,date) select id,'BV',100,current_date from users;
insert into teams(id,name,invite_code,creator_id) values ('22222222-0000-0000-0000-000000000001','隊A','ABC','11111111-0000-0000-0000-000000000003'),('22222222-0000-0000-0000-000000000002','隊B','XYZ','11111111-0000-0000-0000-000000000007');
insert into team_members(team_id,user_id,joined_at) values ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003',now()-interval '3 day'),('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000005',now()-interval '2 day'),('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000007',now()),('22222222-0000-0000-0000-000000000002','2a59a0ae-9877-45dd-b26b-66f8ed6dff74',now()),('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000008',now());
insert into usage_events(user_id,event,day) values ('11111111-0000-0000-0000-000000000001','page:home',current_date),('11111111-0000-0000-0000-000000000001','page:daily',current_date-3),('11111111-0000-0000-0000-000000000002','page:home',current_date-12);
insert into feedback(user_id,kind,message) values ('11111111-0000-0000-0000-000000000001','出錯了','按了沒反應');
insert into resource_links(scope,user_id,title) values ('public',null,'pub1');
insert into events(owner_id,team_id) values ('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001');
