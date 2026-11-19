-- deliver-68：系統管理 + 權限收緊
-- 整段一次跑。全部包在一個交易裡：中間任何一步出錯，整段都不會生效。

begin;

-- ───────── 1. 新的表 ─────────

-- 管理員名單：只有後台程式能寫，任何人都不能從 App 把自己加進來
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid,
  created_at timestamptz default now()
);
alter table admins enable row level security;

-- 管理紀錄：誰在什麼時候對誰做了什麼
create table if not exists admin_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_id uuid,
  target_name text,
  detail text,
  created_at timestamptz default now()
);
alter table admin_logs enable row level security;

-- 帳號狀態：停用時間、是不是要先換密碼。本人只能讀，不能改
create table if not exists account_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  deactivated_at timestamptz,
  must_change_password boolean not null default false
);
alter table account_status enable row level security;
drop policy if exists "account_status 讀自己" on account_status;
create policy "account_status 讀自己" on account_status for select to authenticated using (user_id = auth.uid());

-- 這三張表一般使用者只能「讀自己的帳號狀態」，其他一律不能碰
revoke all on admins, admin_logs, account_status from anon, authenticated;
grant select on account_status to authenticated;

-- 回報：加「已處理」
alter table feedback add column if not exists handled_at timestamptz;
alter table feedback add column if not exists handled_by uuid;

-- ───────── 2. 判斷用的小函式 ─────────

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- 我底下所有夥伴（我推薦的，再往下推薦的…）
create or replace function public.my_downline()
returns table(id uuid, depth int) language sql stable security definer set search_path = public as $$
  with recursive d(id, depth) as (
    select u.id, 1 from users u where u.referrer_id = auth.uid() and u.id <> auth.uid()
    union
    select u.id, d.depth + 1 from users u join d on u.referrer_id = d.id where d.depth < 30
  )
  select id, min(depth) from d where id <> auth.uid() group by id
$$;

create or replace function public.in_my_downline(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.my_downline() d where d.id = p)
$$;

-- 看得到對方「打卡、業績數字」的人：自己、自己底下的夥伴、同戰隊隊友（跟原本戰隊功能一樣）
create or replace function public.can_view_member(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p = auth.uid()
      or public.in_my_downline(p)
      or p in (select public.get_my_teammates())
$$;

-- 看得到對方「本月 BV、IBV」的人：只有自己、和他的推薦人（我的夥伴頁原本就這樣顯示）
create or replace function public.can_view_bv(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p = auth.uid() or exists (select 1 from users where id = p and referrer_id = auth.uid())
$$;

-- ───────── 3. 給畫面用的專用查詢（只回名字、加入日、推薦人） ─────────

-- 我推薦的（＋往下全部），depth=1 是我直接推薦的
create or replace function public.get_partner_tree()
returns table(id uuid, name text, created_at timestamptz, referrer_id uuid, depth int, referred_count int)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.created_at, u.referrer_id, d.depth,
    (select count(*)::int from users k where k.referrer_id = u.id)
  from public.my_downline() d join users u on u.id = d.id
  left join account_status s on s.user_id = u.id
  where s.deactivated_at is null
  order by d.depth, u.created_at
$$;

-- 推薦人 Email 填我、還沒確認的人
create or replace function public.get_pending_partners()
returns table(id uuid, name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.created_at from users u
  where u.referrer_id is null and u.referrer_email_pending is not null
    and lower(trim(u.referrer_email_pending)) = lower((select email from auth.users where id = auth.uid()))
$$;

-- 確認夥伴：只能接「推薦人 Email 填我」的人，而且只改推薦人這一格
create or replace function public.confirm_partner(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update users set referrer_id = auth.uid(), referrer_email_pending = null
  where id = p_id and id <> auth.uid() and referrer_id is null
    and lower(trim(referrer_email_pending)) = lower((select email from auth.users where id = auth.uid()));
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- 名字查詢：只回「自己、我的推薦人、我底下的夥伴、同戰隊隊友」的名字
create or replace function public.get_people_names(p_ids uuid[])
returns table(id uuid, name text)
language sql stable security definer set search_path = public as $$
  select u.id, u.name from users u
  where u.id = any(p_ids)
    and ( u.id = auth.uid()
       or u.id = (select referrer_id from users where id = auth.uid())
       or public.in_my_downline(u.id)
       or u.id in (select public.get_my_teammates()) )
$$;

-- 我是不是要先換密碼（用臨時密碼登入的人）→ 換好後清掉
create or replace function public.finish_password_change()
returns void language sql security definer set search_path = public as $$
  update account_status set must_change_password = false where user_id = auth.uid()
$$;

-- ───────── 4. 原本的「看夥伴」查詢加上檢查（原本只要知道編號就查得到） ─────────

create or replace function public.get_partner_monthly_bv(partner_id uuid, month_start date)
returns table(bv numeric, ibv numeric) language sql security definer set search_path = public as $$
  select
    coalesce(sum(case when type='BV' then points else 0 end), 0) as bv,
    coalesce(sum(case when type='IBV' then points else 0 end), 0) as ibv
  from public.transactions
  where user_id = partner_id and date >= month_start
    and public.can_view_bv(partner_id);
$$;

create or replace function public.get_partner_daily_checkins(partner_id uuid, month_start date)
returns table(checkin_date date, task_key text, is_done boolean) language sql security definer set search_path = public as $$
  select date as checkin_date, task_key, is_done
  from daily_checkins
  where user_id = partner_id
    and date >= month_start
    and date < (month_start + interval '1 month')::date
    and public.can_view_member(partner_id)
  order by date, task_key;
$$;

create or replace function public.get_partner_checkin_rate(partner_id uuid, month_start date, today_day integer)
returns numeric language sql security definer set search_path = public as $$
  select case when today_day = 0 or not public.can_view_member(partner_id) then 0
    else round(count(distinct date)::numeric / today_day * 100) end
  from public.daily_checkins
  where user_id = partner_id and date >= month_start and is_done = true;
$$;

-- ───────── 5. 管理員專用（只有後台程式能呼叫） ─────────

create or replace function public.admin_last_seen()
returns table(user_id uuid, last_day date) language sql stable security definer set search_path = public as $$
  select user_id, max(day) from usage_events group by user_id
$$;

-- 永久刪除前，清掉資料庫不會自動跟著刪的部分
create or replace function public.admin_purge_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare up uuid;
begin
  select referrer_id into up from users where id = p_user_id;
  update users set referrer_id = up where referrer_id = p_user_id;
  update profiles set referrer_id = (select referrer_id from profiles where id = p_user_id) where referrer_id = p_user_id;
  delete from contact_logs where user_id = p_user_id;
  delete from events where owner_id = p_user_id;
  delete from usage_events where user_id = p_user_id;
  delete from push_subscriptions where user_id = p_user_id;
  delete from team_members where user_id = p_user_id;
  delete from admins where user_id = p_user_id;
  delete from users where id = p_user_id;
  delete from profiles where id = p_user_id;
end $$;

revoke all on function public.admin_last_seen() from public, anon, authenticated;
revoke all on function public.admin_purge_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_last_seen() to service_role;
grant execute on function public.admin_purge_user(uuid) to service_role;

-- ───────── 6. 收緊 users：除了自己，別人一律讀不到整列 ─────────

drop policy if exists "service role 可讀 users" on users;
drop policy if exists "查看相關使用者" on users;
drop policy if exists "推薦人可確認串聯" on users;
-- 留下：「users: own row」「users 讀取自己」「users 更新自己」（都只限本人）

-- 推薦人看夥伴打卡：原本靠讀 users 表判斷，users 收緊後要改用函式
drop policy if exists "推薦人可讀取夥伴打卡" on daily_checkins;
create policy "推薦人可讀取夥伴打卡" on daily_checkins for select
  using (user_id = auth.uid() or public.in_my_downline(user_id));

-- 戰隊隊友原本可以直接讀到彼此的每一筆業績紀錄（含顧客名字）。畫面上沒有用到，收掉
drop policy if exists "戰隊成員可互相讀取業績" on transactions;

-- ───────── 7. 公告、公共連結、戰隊 ─────────

drop policy if exists "announcements 寫入" on announcements;
create policy "announcements 寫入" on announcements for insert
  with check (auth.uid() = author_id and public.is_admin());
drop policy if exists "announcements 刪除" on announcements;
create policy "announcements 刪除" on announcements for delete using (public.is_admin());

drop policy if exists "公共連結寫入" on resource_links;
create policy "公共連結寫入" on resource_links for insert with check (scope = 'public' and public.is_admin());
drop policy if exists "公共連結更新" on resource_links;
create policy "公共連結更新" on resource_links for update using (scope = 'public' and public.is_admin()) with check (scope = 'public' and public.is_admin());
drop policy if exists "公共連結刪除" on resource_links;
create policy "公共連結刪除" on resource_links for delete using (scope = 'public' and public.is_admin());

drop policy if exists "成員可查看自己的戰隊" on teams;
create policy "成員可查看自己的戰隊" on teams for select
  using (creator_id = auth.uid() or id in (select team_id from team_members where user_id = auth.uid()));

-- 試用品追蹤的「跟進紀錄」：原本這張表沒有任何權限，所以一直存不進去。補上「只能讀寫自己的」
drop policy if exists "跟進紀錄讀寫自己" on sample_followup_logs;
create policy "跟進紀錄讀寫自己" on sample_followup_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── 8. 第一位管理員：你 ─────────

insert into admins (user_id)
select id from auth.users
where id = '2a59a0ae-9877-45dd-b26b-66f8ed6dff74' or lower(email) = 'admin2@x.com'
on conflict (user_id) do nothing;

commit;

-- ───────── 跑完後的檢查（只看，不改東西） ─────────
select '管理員' as item, string_agg(coalesce(nullif(u.name,''), '（沒名字）') || '（' || au.email || '）', '、') as result
from admins a left join users u on u.id = a.user_id left join auth.users au on au.id = a.user_id
union all
select 'users 剩下的權限', string_agg(policyname, '、') from pg_policies where schemaname='public' and tablename='users'
union all
select '新的專用查詢', count(*)::text || ' 個' from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('is_admin','can_view_bv','my_downline','in_my_downline','can_view_member','get_partner_tree','get_pending_partners','confirm_partner','get_people_names','finish_password_change','admin_last_seen','admin_purge_user');
