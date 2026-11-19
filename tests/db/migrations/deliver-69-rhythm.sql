-- deliver-69：推薦人看夥伴「這週的行動數字」
-- 只回數字，不回任何名字或內容；只有他的推薦人拿得到（跟看本月 BV 同一個規則）。
create or replace function public.get_partner_week_stats(partner_id uuid, week_start date)
returns table(
  contacts_total int, contacts_new int, top10_filled int, top10_touched int,
  talk int, invites int, invite_yes int, invite_no int, invite_wait int, met int, upcoming int
)
language sql stable security definer set search_path = public as $$
  with
  lg as (
    select contact_id, date, kind from contact_logs
    where user_id = partner_id and date between week_start and week_start + 6
  ),
  mt as (
    select contact_id, date, planned_date, note from counter_logs
    where user_id = partner_id and counter_key = 'meetup' and is_done = true and date between week_start and week_start + 6
  ),
  ct as (
    select id, is_top10, is_archived, is_muted, source, added_date, created_at, next_plan_date from contacts where user_id = partner_id
  ),
  tw as (select (now() at time zone 'Asia/Taipei')::date as d)
  select
    (select count(*) from ct where coalesce(is_archived, false) = false)::int,
    (select count(*) from ct where source is null and (
       (added_date between week_start and week_start + 6) or
       (added_date is null and (created_at at time zone 'Asia/Taipei')::date between week_start and week_start + 6)))::int,
    (select count(*) from ct where is_top10 = true and coalesce(is_archived, false) = false)::int,
    (select count(distinct ct.id) from ct join lg on lg.contact_id = ct.id where ct.is_top10 = true)::int,
    (select count(distinct (contact_id, date)) from lg)::int,
    ((select count(*) from lg where kind in ('meet_plan', 'invite_no', 'invite_wait'))
      + (select count(*) from mt where contact_id is not null and note is null and planned_date = date))::int,
    (select count(*) from lg where kind = 'meet_plan')::int,
    (select count(*) from lg where kind = 'invite_no')::int,
    (select count(*) from lg where kind = 'invite_wait')::int,
    (select count(*) from mt)::int,
    (select count(*) from ct, tw where coalesce(is_archived, false) = false and coalesce(is_muted, false) = false
       and next_plan_date between tw.d and tw.d + 6)::int
  where public.can_view_bv(partner_id)
$$;

-- 檢查（只看，不改東西）：應該回 1
select count(*) as 新查詢 from pg_proc where proname = 'get_partner_week_stats';
