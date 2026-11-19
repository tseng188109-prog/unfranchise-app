-- deliver-74：系統管理多四樣：登入中的裝置／登入紀錄、改名字、卡在哪一步、App 出錯紀錄
-- 一樣看不到任何人的名單、顧客、業績內容。

-- ───────── 1. 登入紀錄（Supabase 不留歷史，由 App 每次登入成功時自己記一筆） ─────────
create table if not exists login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  device text
);
create index if not exists login_events_user_at on login_events(user_id, at desc);
alter table login_events enable row level security;
drop policy if exists "login_events 自己新增" on login_events;
create policy "login_events 自己新增" on login_events for insert to authenticated with check (user_id = auth.uid());
-- 沒有讀的權限：只有管理頁（後台）讀得到

-- 每人只留最近 10 筆
create or replace function public.login_events_keep10() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from login_events where user_id = new.user_id
    and id not in (select id from login_events where user_id = new.user_id order by at desc, id desc limit 10);
  return null;
end $$;
drop trigger if exists login_events_keep10 on login_events;
create trigger login_events_keep10 after insert on login_events for each row execute function public.login_events_keep10();

-- ───────── 2. App 出錯紀錄 ─────────
create table if not exists app_errors (
  id bigint generated always as identity primary key,
  page text not null,
  message text not null,
  device text,
  count int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid
);
create unique index if not exists app_errors_open_sig on app_errors(page, message) where handled_at is null;
create table if not exists app_error_hits (
  error_id bigint not null references app_errors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (error_id, user_id, day)
);
alter table app_errors enable row level security;
alter table app_error_hits enable row level security;
-- 兩張表都沒有開放給一般帳號直接讀寫，只能透過下面的函式記錄

-- 記一筆出錯：同一個錯誤、同一個人、同一天只算一次
create or replace function public.report_app_error(p_page text, p_message text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pg text := left(coalesce(nullif(trim(p_page), ''), '（不明頁面）'), 100);
  msg text := left(coalesce(nullif(trim(p_message), ''), '（沒有訊息）'), 300);
  dv text := left(coalesce(p_device, ''), 30);
  eid bigint;
  d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if uid is null then return; end if;
  insert into app_errors(page, message, device) values (pg, msg, dv)
    on conflict (page, message) where handled_at is null do nothing
    returning id into eid;
  if eid is null then
    select id into eid from app_errors where page = pg and message = msg and handled_at is null;
    insert into app_error_hits(error_id, user_id, day) values (eid, uid, d) on conflict do nothing;
    if found then
      update app_errors set count = count + 1, last_at = now(), device = dv where id = eid;
    end if;
  else
    insert into app_error_hits(error_id, user_id, day) values (eid, uid, d) on conflict do nothing;
  end if;
end $$;
revoke all on function public.report_app_error(text, text, text) from public, anon;
grant execute on function public.report_app_error(text, text, text) to authenticated;

-- ───────── 3. 管理頁用：登入中的裝置、登出所有裝置、起步進度（只有後台能呼叫） ─────────
create or replace function public.admin_sessions(p_user_id uuid)
returns table(created_at timestamptz, last_at timestamptz, user_agent text)
language sql stable security definer set search_path = public, auth as $$
  select s.created_at, coalesce(s.updated_at, s.created_at), s.user_agent
  from auth.sessions s where s.user_id = p_user_id
  order by coalesce(s.updated_at, s.created_at) desc
$$;

create or replace function public.admin_signout_all(p_user_id uuid)
returns int language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_onboarding()
returns table(user_id uuid, signed_in boolean, has_contacts boolean, has_logs boolean)
language sql stable security definer set search_path = public, auth as $$
  select u.id,
    (au.last_sign_in_at is not null),
    exists (select 1 from contacts c where c.user_id = u.id),
    exists (select 1 from contact_logs l where l.user_id = u.id)
  from users u left join auth.users au on au.id = u.id
$$;

revoke all on function public.admin_sessions(uuid) from public, anon, authenticated;
revoke all on function public.admin_signout_all(uuid) from public, anon, authenticated;
revoke all on function public.admin_onboarding() from public, anon, authenticated;
grant execute on function public.admin_sessions(uuid) to service_role;
grant execute on function public.admin_signout_all(uuid) to service_role;
grant execute on function public.admin_onboarding() to service_role;

-- 永久刪除帳號時，出錯紀錄裡的「誰遇到」跟著清（login_events、app_error_hits 已經跟著帳號一起刪）

-- 檢查（只看，不改東西）：應該是 3、3
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename in ('login_events', 'app_errors', 'app_error_hits')) as 新表,
  (select count(*) from pg_proc where proname in ('admin_sessions', 'admin_signout_all', 'admin_onboarding')) as 新函式;
