-- deliver-76：戰隊打氣、這週的好消息（可以鼓掌）、搭檔連勝
-- 好消息只記「發生了什麼」（約到一位朋友、成交一筆零售…），不記對方是誰、買了什麼、多少錢。
-- 打氣只有收到的人看得到；搭檔連勝只有兩個人看得到。

-- ───────── 0. 小工具 ─────────
create or replace function public.tw_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Taipei')::date $$;

-- 這個人有沒有開放隊友打氣（設定 → 手機提醒 →「隊友給我打氣」，預設開）
create or replace function public.cheer_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (u.tag_settings -> 'notify' ->> 'cheer') is distinct from 'false' from users u where u.id = p_user), false)
$$;

-- ───────── 1. 句子包（打氣的 6 組、今天的一句話、完成後的按鈕） ─────────
-- 換一整組：新增同一個 grp、填 starts_on / ends_on 的句子，那段日期內就只用新的；過了自動換回沒填日期的那組。
create table if not exists app_phrases (
  id bigint generated always as identity primary key,
  grp text not null check (grp in ('start','courage','clap','miss','now','quote','self')),
  text text not null,
  sort int not null default 0,
  pack text not null default '基本',
  starts_on date,
  ends_on date
);
alter table app_phrases enable row level security;
drop policy if exists "app_phrases 登入可讀" on app_phrases;
create policy "app_phrases 登入可讀" on app_phrases for select to authenticated using (true);

insert into app_phrases(grp, sort, text)
select v.grp, v.sort, v.text from (values
  ('start',1,'欸，今天一起來做312啊'),('start',2,'我準備開始了，你也一起吧'),('start',3,'來啦，今天一起衝一波'),
  ('start',4,'今天先找個朋友聊聊吧'),('start',5,'走啊，一起把今天的目標完成'),('start',6,'手機拿起來，我們一起開工'),
  ('start',7,'換我們出動啦，今天加油'),('start',8,'先從一個訊息開始，走起'),('start',9,'約好一起努力，今天也算我一份'),
  ('start',10,'剛好想到你，一起來挑戰吧'),
  ('courage',1,'相信你可以，開口聊聊吧'),('courage',2,'就像平常聊天，自然就好'),('courage',3,'你的分享說不定正好幫到朋友'),
  ('courage',4,'來吧，這次換你主動邀約'),('courage',5,'我看好你，今天試著約一個'),('courage',6,'有好消息記得回來分享啊'),
  ('courage',7,'聊天是你的強項，發揮一下'),('courage',8,'機會就在對話裡，聊起來'),('courage',9,'你很可以啦，直接傳出去吧'),
  ('courage',10,'相信自己的分享，衝一波'),
  ('clap',1,'欸，你今天很猛欸'),('clap',2,'312完成了喔，讚啦'),('clap',3,'這個執行力真的可以耶'),
  ('clap',4,'今天有做到，替你開心'),('clap',5,'太強了吧，掌聲給你'),('clap',6,'說到做到，真的很讚'),
  ('clap',7,'每個行動都算數，今天很棒'),('clap',8,'看到你完成，我也更有動力了'),('clap',9,'恭喜收工，今天值得開心一下'),
  ('miss',1,'欸，找天一起來做312啊'),('miss',2,'之前聊的目標，我還記得欸'),('miss',3,'下次一起挑戰，算你一份喔'),
  ('miss',4,'有你一起做，感覺更有動力'),('miss',5,'來啦，我們再一起努力'),('miss',6,'想到之前一起衝的感覺了'),
  ('miss',7,'我們再來約個時間一起做吧'),('miss',8,'下一次的312，一起完成啊'),('miss',9,'你的目標我有記得，一起加油'),
  ('miss',10,'期待再跟你一起挑戰新目標'),
  ('now',1,'就是現在，傳個訊息出去'),('now',2,'手機拿起來，約一個朋友吧'),('now',3,'今天的第一個邀約，現在開始'),
  ('now',4,'想到誰了？直接聊起來'),('now',5,'趁現在有動力，馬上行動'),('now',6,'一個訊息，就是一個新的開始'),
  ('now',7,'先傳出去，機會才會出現'),('now',8,'來吧，今天的312開跑'),('now',9,'現在就找一個朋友聊聊'),
  ('now',10,'說做就做，這次換我們出發'),
  ('quote',1,'成功與失敗的差別，成功者只是做了失敗者沒有做或不願做的事'),('quote',2,'成功是一種習慣，失敗也是一種習慣'),
  ('quote',3,'你得先有夢想，才能使夢想成真'),('quote',4,'夢想要大，因為你永遠不會比你的夢想更大'),
  ('quote',5,'團隊合作精神確實能使夢想成真'),('quote',6,'不管做什麼，成功的關鍵永遠在跟進'),
  ('quote',7,'永遠不要停止相信'),('quote',8,'Keep growing. I believe in you.　繼續成長，我相信你。'),
  ('self',1,'我真棒！！'),('self',2,'我好棒喔！'),('self',3,'耶！我做到了'),('self',4,'今天也很棒！'),
  ('self',5,'給自己拍拍手'),('self',6,'我真的可以耶'),('self',7,'嘿嘿，完成了'),('self',8,'不愧是我！'),
  ('self',9,'我也太讚了吧'),('self',10,'今天表現不錯'),('self',11,'好耶！完成啦'),('self',12,'我有進步耶！'),
  ('self',13,'值得鼓勵一下'),('self',14,'越來越上手了'),('self',15,'今天也有做到')
) as v(grp, sort, text)
where not exists (select 1 from app_phrases p where p.pack = '基本');

-- 今天要用的句子：某一組在今天有排日期的句子，就只用那些；沒有就用沒填日期的
create or replace function public.active_phrases()
returns table(grp text, text text, sort int)
language sql stable security definer set search_path = public as $$
  with d as (
    select p.grp, p.text, p.sort from app_phrases p
    where p.starts_on is not null and tw_today() between p.starts_on and coalesce(p.ends_on, p.starts_on)
  )
  select d.grp, d.text, d.sort from d
  union all
  select p.grp, p.text, p.sort from app_phrases p
  where p.starts_on is null and p.grp not in (select d.grp from d)
  order by 1, 3
$$;
revoke all on function public.active_phrases() from public, anon;
grant execute on function public.active_phrases() to authenticated;

-- ───────── 2. 打氣（只有收到的人和送的人看得到） ─────────
create table if not exists cheers (
  id bigint generated always as identity primary key,
  from_id uuid not null references users(id) on delete cascade,
  to_id uuid not null references users(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  grp text,
  text text not null,
  day date not null default tw_today(),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  pushed_at timestamptz,
  unique (from_id, to_id, day)
);
create index if not exists cheers_to_at on cheers(to_id, created_at desc);
create index if not exists cheers_team_day on cheers(team_id, day);
alter table cheers enable row level security;
drop policy if exists "cheers 送的人和收到的人看得到" on cheers;
create policy "cheers 送的人和收到的人看得到" on cheers for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
-- 沒有新增、修改的權限：一律經過下面的函式

-- 送一句打氣：同一個戰隊、不能給自己、對方有開放、句子要是句子包裡的、每人每天一次
create or replace function public.send_cheer(p_to uuid, p_text text) returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid; g text; cid bigint;
begin
  if me is null then raise exception '請先登入'; end if;
  if p_to = me then raise exception '不能打氣給自己'; end if;
  select team_id into t from team_members where user_id = me;
  if t is null or not exists (select 1 from team_members where user_id = p_to and team_id = t) then
    raise exception '只能打氣給同一個戰隊的隊友';
  end if;
  if not cheer_allowed(p_to) then raise exception '對方目前沒有開放隊友打氣'; end if;
  select a.grp into g from active_phrases() a where a.text = p_text and a.grp <> 'self' limit 1;
  if g is null then raise exception '這句話不在句子包裡'; end if;
  insert into cheers(from_id, to_id, team_id, grp, text) values (me, p_to, t, g, p_text)
    on conflict (from_id, to_id, day) do nothing
    returning id into cid;
  if cid is null then raise exception '今天已經給他打過氣了'; end if;
  delete from cheers where created_at < now() - interval '90 days';
  return cid;
end $$;

-- 收到的人看過了
create or replace function public.mark_cheers_seen() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update cheers set seen_at = now() where to_id = auth.uid() and seen_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- 戰隊頁：每位隊友能不能打氣、我今天打過了沒、他有沒有開通知（不含自己）
create or replace function public.team_cheer_status()
returns table(user_id uuid, can_cheer boolean, cheered_today boolean, has_push boolean)
language sql stable security definer set search_path = public as $$
  select tm.user_id,
    cheer_allowed(tm.user_id),
    exists (select 1 from cheers c where c.from_id = auth.uid() and c.to_id = tm.user_id and c.day = tw_today()),
    exists (select 1 from push_subscriptions p where p.user_id = tm.user_id)
  from team_members tm
  where tm.team_id = get_my_team_id() and tm.user_id <> auth.uid()
$$;

-- 這週全隊互相打氣幾次（只有總數，不看誰送誰）
create or replace function public.team_cheer_count(p_since date) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from cheers where team_id = get_my_team_id() and day >= p_since
$$;

revoke all on function public.send_cheer(uuid, text) from public, anon;
revoke all on function public.mark_cheers_seen() from public, anon;
revoke all on function public.team_cheer_status() from public, anon;
revoke all on function public.team_cheer_count(date) from public, anon;
grant execute on function public.send_cheer(uuid, text) to authenticated;
grant execute on function public.mark_cheers_seen() to authenticated;
grant execute on function public.team_cheer_status() to authenticated;
grant execute on function public.team_cheer_count(date) to authenticated;

-- ───────── 3. 這週的好消息、鼓掌 ─────────
create table if not exists team_news (
  id bigint generated always as identity primary key,
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  other_id uuid references users(id) on delete cascade,
  kind text not null check (kind in ('meet','retail','partner','first312','streak','buddy')),
  n int,
  label text,
  day date not null default tw_today(),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index if not exists team_news_team_day on team_news(team_id, day desc);
create index if not exists team_news_created on team_news(created_at);
alter table team_news enable row level security;
drop policy if exists "team_news 同隊看得到" on team_news;
create policy "team_news 同隊看得到" on team_news for select to authenticated
  using (team_id = get_my_team_id()
    and user_id in (select get_my_teammates())
    and (other_id is null or other_id in (select get_my_teammates())));

create table if not exists news_claps (
  news_id bigint not null references team_news(id) on delete cascade,
  user_id uuid not null default auth.uid() references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, user_id)
);
alter table news_claps enable row level security;
drop policy if exists "news_claps 同隊看得到" on news_claps;
drop policy if exists "news_claps 替別人鼓掌" on news_claps;
drop policy if exists "news_claps 收回自己的" on news_claps;
create policy "news_claps 同隊看得到" on news_claps for select to authenticated
  using (news_id in (select id from team_news));
create policy "news_claps 替別人鼓掌" on news_claps for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from team_news n where n.id = news_id and n.user_id <> auth.uid()
      and (n.other_id is null or n.other_id <> auth.uid())));
create policy "news_claps 收回自己的" on news_claps for delete to authenticated
  using (user_id = auth.uid());

-- 誰在哪個戰隊
create or replace function public.team_of(p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from team_members where user_id = p_user limit 1
$$;

-- 自動產生的好消息：約到人、成交零售、推薦新夥伴、第一次做滿一天
-- 都包在 exception 裡：好消息寫不進去，也絕對不會擋到原本的記錄
create or replace function public.news_on_contact_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; t uuid; u uuid; d date; refk text;
begin
  begin
    if tg_op = 'INSERT' then r := to_jsonb(new); else r := to_jsonb(old); end if;
    if r ->> 'kind' is distinct from 'meet_plan' then return null; end if;
    u := (r ->> 'user_id')::uuid; d := coalesce((r ->> 'date')::date, tw_today());
    refk := 'c:' || md5(coalesce(r ->> 'contact_id', '')) || ':' || d;
    if tg_op = 'INSERT' then
      if d < tw_today() - 6 or d > tw_today() then return null; end if;
      t := team_of(u);
      if t is null then return null; end if;
      insert into team_news(team_id, user_id, kind, day, ref) values (t, u, 'meet', d, refk) on conflict do nothing;
      delete from team_news where created_at < now() - interval '90 days';
    else
      if not exists (select 1 from contact_logs l where l.user_id = u and l.kind = 'meet_plan'
          and l.contact_id::text = coalesce(r ->> 'contact_id', '') and l.date = d) then
        delete from team_news where user_id = u and kind = 'meet' and ref = refk;
      end if;
    end if;
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists news_on_contact_log on contact_logs;
create trigger news_on_contact_log after insert or delete on contact_logs
  for each row execute function public.news_on_contact_log();

create or replace function public.news_on_transaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; t uuid; u uuid; d date; refk text;
begin
  begin
    if tg_op = 'INSERT' then r := to_jsonb(new); else r := to_jsonb(old); end if;
    if r ->> 'customer_id' is null or coalesce((r ->> 'is_gift')::boolean, false) then return null; end if;
    u := (r ->> 'user_id')::uuid; d := coalesce((r ->> 'date')::date, tw_today());
    refk := 'k:' || md5(r ->> 'customer_id') || ':' || d;
    if tg_op = 'INSERT' then
      if d < tw_today() - 6 or d > tw_today() then return null; end if;
      t := team_of(u);
      if t is null then return null; end if;
      insert into team_news(team_id, user_id, kind, day, ref) values (t, u, 'retail', d, refk) on conflict do nothing;
    else
      if not exists (select 1 from transactions x where x.user_id = u and x.customer_id::text = (r ->> 'customer_id')
          and x.date = d and coalesce((to_jsonb(x) ->> 'is_gift')::boolean, false) = false) then
        delete from team_news where user_id = u and kind = 'retail' and ref = refk;
      end if;
    end if;
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists news_on_transaction on transactions;
create trigger news_on_transaction after insert or delete on transactions
  for each row execute function public.news_on_transaction();

create or replace function public.news_on_referral() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  begin
    if new.referrer_id is not null and (tg_op = 'INSERT' or old.referrer_id is distinct from new.referrer_id) then
      t := team_of(new.referrer_id);
      if t is not null then
        insert into team_news(team_id, user_id, kind, ref) values (t, new.referrer_id, 'partner', 'u:' || md5(new.id::text)) on conflict do nothing;
      end if;
    end if;
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists news_on_referral on users;
create trigger news_on_referral after insert or update of referrer_id on users
  for each row execute function public.news_on_referral();

create or replace function public.news_on_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid; m text; cr timestamptz; lbl text;
begin
  begin
    if new.task_key <> 'daily_3_contacts' or new.is_done is not true then return null; end if;
    if new.date < tw_today() - 6 or new.date > tw_today() then return null; end if;
    if exists (select 1 from daily_checkins c where c.user_id = new.user_id and c.task_key = 'daily_3_contacts'
        and c.is_done and c.id <> new.id) then return null; end if;
    t := team_of(new.user_id);
    if t is null then return null; end if;
    select u.tag_settings ->> 'daily_mode', u.created_at into m, cr from users u where u.id = new.user_id;
    lbl := case m when 'start' then '1-1-2' when 'std' then '3-1-2' when 'fast' then '10-3-2'
      else case when cr > now() - interval '14 days' then '1-1-2' else '3-1-2' end end;
    insert into team_news(team_id, user_id, kind, label, day, ref) values (t, new.user_id, 'first312', lbl, new.date, 'first')
      on conflict do nothing;
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists news_on_checkin on daily_checkins;
create trigger news_on_checkin after insert or update on daily_checkins
  for each row execute function public.news_on_checkin();

-- App 自己加的好消息：連續行動 7、30、100、365 天；搭檔到 7、14、30、50、100 天
create or replace function public.add_team_news(p_kind text, p_n int, p_other uuid, p_since date) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid; a uuid; b uuid; bid bigint;
begin
  if me is null then return false; end if;
  t := team_of(me);
  if t is null then return false; end if;
  if p_kind = 'streak' then
    if p_n not in (7, 30, 100, 365) then return false; end if;
    insert into team_news(team_id, user_id, kind, n, ref)
      values (t, me, 'streak', p_n, 'streak:' || p_n || ':' || coalesce(p_since::text, '')) on conflict do nothing;
    return true;
  elsif p_kind = 'buddy' then
    if p_n not in (7, 14, 30, 50, 100) or p_other is null then return false; end if;
    select id into bid from buddies where status = 'active'
      and ((from_id = me and to_id = p_other) or (from_id = p_other and to_id = me)) limit 1;
    if bid is null or team_of(p_other) is distinct from t then return false; end if;
    a := least(me, p_other); b := greatest(me, p_other);
    insert into team_news(team_id, user_id, other_id, kind, n, ref)
      values (t, a, b, 'buddy', p_n, 'buddy:' || bid || ':' || p_n || ':' || coalesce(p_since::text, '')) on conflict do nothing;
    return true;
  end if;
  return false;
end $$;
revoke all on function public.add_team_news(text, int, uuid, date) from public, anon;
grant execute on function public.add_team_news(text, int, uuid, date) to authenticated;
revoke all on function public.team_of(uuid) from public, anon, authenticated;

-- ───────── 4. 搭檔連勝 ─────────
create table if not exists buddies (
  id bigint generated always as identity primary key,
  from_id uuid not null references users(id) on delete cascade,
  to_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','ended','declined')),
  created_at timestamptz not null default now(),
  start_day date,
  ended_at timestamptz
);
create unique index if not exists buddies_pair_open on buddies (least(from_id, to_id), greatest(from_id, to_id))
  where status in ('pending', 'active');
alter table buddies enable row level security;
drop policy if exists "buddies 兩個人看得到" on buddies;
create policy "buddies 兩個人看得到" on buddies for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

-- 誰看過哪一次慶祝（同一次不重複跳）
create table if not exists buddy_marks (
  user_id uuid not null default auth.uid() references users(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table buddy_marks enable row level security;
drop policy if exists "buddy_marks 自己的" on buddy_marks;
create policy "buddy_marks 自己的" on buddy_marks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7 天沒回覆的邀請自動取消
create or replace function public.buddies_expire() returns void
language sql security definer set search_path = public as $$
  update buddies set status = 'ended', ended_at = now()
  where status = 'pending' and created_at < now() - interval '7 days'
$$;

-- 一個人佔了幾個位置：搭檔中的，加上自己送出、還在等回覆的邀請
create or replace function public.buddy_slots(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from buddies
  where (status = 'active' and (from_id = p_user or to_id = p_user))
     or (status = 'pending' and from_id = p_user)
$$;
create or replace function public.buddy_active_count(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from buddies where status = 'active' and (from_id = p_user or to_id = p_user)
$$;

create or replace function public.buddy_invite(p_to uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bid bigint;
begin
  if me is null then raise exception '請先登入'; end if;
  perform buddies_expire();
  if p_to = me then raise exception '不能邀自己'; end if;
  if team_of(me) is null or team_of(me) is distinct from team_of(p_to) then raise exception '只能邀同一個戰隊的隊友'; end if;
  if buddy_slots(me) >= 3 then raise exception '你已經有 3 位搭檔（或邀請還在等回覆）'; end if;
  if buddy_active_count(p_to) >= 3 then raise exception '他已經有 3 位搭檔了'; end if;
  begin
    insert into buddies(from_id, to_id) values (me, p_to) returning id into bid;
  exception when unique_violation then
    raise exception '你們已經是搭檔，或邀請還在等回覆';
  end;
  return bid;
end $$;

create or replace function public.buddy_accept(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b buddies;
begin
  perform buddies_expire();
  select * into b from buddies where id = p_id and to_id = me and status = 'pending';
  if b.id is null then raise exception '這個邀請已經過期或取消了'; end if;
  if team_of(b.from_id) is distinct from team_of(me) then raise exception '對方已經不在你的戰隊了'; end if;
  if buddy_active_count(me) >= 3 then raise exception '你已經有 3 位搭檔了'; end if;
  if buddy_active_count(b.from_id) >= 3 then raise exception '對方已經有 3 位搭檔了'; end if;
  update buddies set status = 'active', start_day = tw_today() where id = p_id;
  return true;
end $$;

create or replace function public.buddy_decline(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update buddies set status = 'declined', ended_at = now() where id = p_id and to_id = auth.uid() and status = 'pending';
  return found;
end $$;

-- 結束搭檔（或收回自己送出的邀請）：對方不會收到通知
create or replace function public.buddy_end(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update buddies set status = 'ended', ended_at = now()
  where id = p_id and status in ('pending', 'active') and (from_id = auth.uid() or to_id = auth.uid());
  return found;
end $$;

revoke all on function public.buddies_expire() from public, anon, authenticated;
revoke all on function public.buddy_slots(uuid) from public, anon;
revoke all on function public.buddy_active_count(uuid) from public, anon;
revoke all on function public.buddy_invite(uuid) from public, anon;
revoke all on function public.buddy_accept(bigint) from public, anon;
revoke all on function public.buddy_decline(bigint) from public, anon;
revoke all on function public.buddy_end(bigint) from public, anon;
grant execute on function public.buddy_invite(uuid) to authenticated;
grant execute on function public.buddy_accept(bigint) to authenticated;
grant execute on function public.buddy_decline(bigint) to authenticated;
grant execute on function public.buddy_end(bigint) to authenticated;

-- 退出戰隊、被踢出：搭檔關係跟著結束
create or replace function public.buddies_on_leave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update buddies set status = 'ended', ended_at = now()
  where status in ('pending', 'active') and (from_id = old.user_id or to_id = old.user_id);
  return null;
end $$;
drop trigger if exists buddies_on_leave on team_members;
create trigger buddies_on_leave after delete on team_members
  for each row execute function public.buddies_on_leave();

-- 檢查（只看，不改東西）：應該是 6、72
select
  (select count(*) from pg_tables where schemaname = 'public'
     and tablename in ('app_phrases','cheers','team_news','news_claps','buddies','buddy_marks')) as 新表,
  (select count(*) from app_phrases where pack = '基本') as 句子;
