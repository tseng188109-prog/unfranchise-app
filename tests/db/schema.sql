do $$ begin if not exists (select 1 from pg_roles where rolname=$q$anon$q$) then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

create table public.users(id uuid primary key references auth.users(id) on delete cascade, name text, referrer_id uuid references public.users(id), referrer_email_pending text, created_at timestamptz default now(), why_here text, goal_declaration text, tag_settings jsonb, onboarding_done boolean);
create table public.profiles(id uuid primary key references public.users(id) on delete cascade, name text, email text, referrer_id uuid references public.profiles(id));
create table public.contacts(id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade, name text, is_top10 boolean default false, is_archived boolean default false, is_muted boolean default false, source text, added_date date, created_at timestamptz default now(), next_plan_date date, need_level text, interest_level text, referral_stage text, last_contact_date date, last_interacted_at timestamptz, egg_type text);
create table public.counter_logs(id serial primary key, user_id uuid references public.profiles(id) on delete cascade, contact_id uuid, counter_key text, is_done boolean, date date, planned_date date, note text);
create table public.contact_logs(id uuid primary key default gen_random_uuid(), contact_id uuid references public.contacts(id) on delete cascade, user_id uuid references public.users(id), date date default current_date, kind text);
create table public.daily_checkins(id serial primary key, user_id uuid references public.profiles(id) on delete cascade, date date, task_key text, is_done boolean);
create table public.transactions(id serial primary key, user_id uuid references public.profiles(id) on delete cascade, type text, points numeric, date date);
create table public.teams(id uuid primary key default gen_random_uuid(), name text, invite_code text, creator_id uuid references public.users(id), created_at timestamptz default now());
create table public.team_members(id uuid primary key default gen_random_uuid(), team_id uuid references public.teams(id) on delete cascade, user_id uuid references public.users(id) on delete cascade, joined_at timestamptz default now(), unique(user_id));
create table public.announcements(id uuid primary key default gen_random_uuid(), author_id uuid references public.users(id) on delete cascade, title text, content text, is_pinned boolean, created_at timestamptz default now());
create table public.resource_links(id serial primary key, scope text, user_id uuid references public.users(id) on delete cascade, title text);
create table public.feedback(id bigserial primary key, user_id uuid default auth.uid(), kind text, message text, page text, device text, created_at timestamptz default now());
create table public.usage_events(id bigserial primary key, user_id uuid, event text, day date, created_at timestamptz default now(), unique(user_id,event,day));
create table public.push_subscriptions(id serial primary key, user_id uuid references public.users(id) on delete cascade, endpoint text);
create table public.events(id serial primary key, owner_id uuid, team_id uuid references public.teams(id) on delete cascade);

do $$ declare t text; begin for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security', t);
 execute format('grant all on public.%I to anon, authenticated, service_role', t); end loop; end $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- existing functions
CREATE FUNCTION public.get_my_team_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $f$ select team_id from public.team_members where user_id = auth.uid() limit 1 $f$;
CREATE FUNCTION public.get_my_teammates() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $f$ select tm.user_id from public.team_members tm where tm.team_id = public.get_my_team_id() $f$;
CREATE FUNCTION public.get_partner_monthly_bv(partner_id uuid, month_start date) RETURNS TABLE(bv numeric, ibv numeric) LANGUAGE sql SECURITY DEFINER AS $f$ select coalesce(sum(case when type='BV' then points else 0 end), 0), coalesce(sum(case when type='IBV' then points else 0 end), 0) from public.transactions where user_id = partner_id and date >= month_start; $f$;
CREATE FUNCTION public.get_partner_daily_checkins(partner_id uuid, month_start date) RETURNS TABLE(checkin_date date, task_key text, is_done boolean) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $f$ select date, task_key, is_done from daily_checkins where user_id = partner_id and date >= month_start and date < (month_start + interval '1 month')::date order by date, task_key; $f$;
CREATE FUNCTION public.get_partner_checkin_rate(partner_id uuid, month_start date, today_day integer) RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $f$ select case when today_day = 0 then 0 else round(count(distinct date)::numeric / today_day * 100) end from public.daily_checkins where user_id = partner_id and date >= month_start and is_done = true; $f$;

-- existing policies (from her dump)
create policy "service role 可讀 users" on users for select using (true);
create policy "users 更新自己" on users for update using (auth.uid() = id);
create policy "users 讀取自己" on users for select using (auth.uid() = id);
create policy "users: own row" on users for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "推薦人可確認串聯" on users for update using (true) with check ((referrer_id = auth.uid()) OR (auth.uid() = id));
create policy "查看相關使用者" on users for select using ((id = auth.uid()) OR (referrer_id = auth.uid()) OR (referrer_email_pending = (( SELECT users_1.email FROM auth.users users_1 WHERE (users_1.id = auth.uid())))::text));
create policy "profiles own" on profiles for all using (auth.uid() = id);
create policy "contacts own" on contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "互動紀錄讀寫" on contact_logs for all using (auth.uid() = user_id);
create policy "戰隊成員可互相讀取打卡" on daily_checkins for select using ((user_id = auth.uid()) OR (user_id IN ( SELECT get_my_teammates())));
create policy "打卡讀寫" on daily_checkins for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "推薦人可讀取夥伴打卡" on daily_checkins for select using ((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = daily_checkins.user_id) AND (users.referrer_id = auth.uid())))));
create policy "transactions own" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "戰隊成員可互相讀取業績" on transactions for select using ((user_id = auth.uid()) OR (user_id IN ( SELECT get_my_teammates())));
create policy "announcements 刪除" on announcements for delete using (auth.uid() = author_id);
create policy "announcements 寫入" on announcements for insert with check (auth.uid() = author_id);
create policy "announcements 讀取" on announcements for select using (auth.role() = 'authenticated');
create policy "feedback insert own" on feedback for insert with check (auth.uid() = user_id);
create policy "usage insert own" on usage_events for insert with check (auth.uid() = user_id);
create policy "usage select own" on usage_events for select using (auth.uid() = user_id);
create policy "使用者可加入戰隊" on team_members for insert with check (user_id = auth.uid());
create policy "使用者可退出戰隊或管理者可踢人" on team_members for delete using ((user_id = auth.uid()) OR (team_id IN ( SELECT teams.id FROM teams WHERE (teams.creator_id = auth.uid()))));
create policy "可查看同隊成員" on team_members for select using (team_id = get_my_team_id());
create policy "creator can update own team" on teams for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "任何人可建立戰隊" on teams for insert with check (creator_id = auth.uid());
create policy "成員可查看自己的戰隊" on teams for select using ((id IN ( SELECT team_members.team_id FROM team_members WHERE (team_members.user_id = auth.uid()))) OR true);
create policy "管理者可解散戰隊" on teams for delete using (creator_id = auth.uid());
create policy "個人連結刪除" on resource_links for delete using ((scope = 'personal') AND (user_id = auth.uid()));
create policy "個人連結讀寫" on resource_links for insert with check ((scope = 'personal') AND (user_id = auth.uid()));
create policy "公共連結刪除" on resource_links for delete using (scope = 'public');
create policy "公共連結寫入" on resource_links for insert with check (scope = 'public');
create policy "公共連結更新" on resource_links for update using (scope = 'public');
create policy "所有人可看公共連結" on resource_links for select using ((scope = 'public') OR ((scope = 'personal') AND (user_id = auth.uid())));
create policy "push own" on push_subscriptions for all using (auth.uid() = user_id);
create policy "events_select" on events for select using ((owner_id = auth.uid()) OR ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM team_members tm WHERE ((tm.team_id = events.team_id) AND (tm.user_id = auth.uid()))))));
create table public.sample_followup_logs(id serial primary key, sample_id int, user_id uuid references public.users(id) on delete cascade, date date, note text);
alter table public.sample_followup_logs enable row level security; grant all on public.sample_followup_logs to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
