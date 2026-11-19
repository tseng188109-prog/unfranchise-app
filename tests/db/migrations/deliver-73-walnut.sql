-- deliver-73：核桃只算「答應聽說明」的約成（一對一會談、二對一會談、三方通話、說明會）
-- 約吃飯、聚餐、體驗產品、逛網站、線上影片只是見面，不算核桃。推薦人看夥伴的罐子數字跟 App 同一套規則。
create or replace function public.get_partner_jar(partner_id uuid)
returns table(beans int, walnuts int, cooling int)
language sql stable security definer set search_path = public as $$
  with
  tw as (select (now() at time zone 'Asia/Taipei')::date as d),
  mp as (
    select contact_id, max(date) as plan_d from contact_logs
    where user_id = partner_id and kind = 'meet_plan'
      and coalesce(note, '') ~ '一對一會談|二對一會談|三方通話|說明會'
    group by contact_id
  ),
  c as (
    select ct.need_level, ct.interest_level, ct.walnut_sunk_at, mp.plan_d,
      coalesce(ct.last_contact_date, (ct.last_interacted_at at time zone 'Asia/Taipei')::date) as last_d
    from contacts ct left join mp on mp.contact_id = ct.id
    where ct.user_id = partner_id
      and coalesce(ct.is_archived, false) = false
      and coalesce(ct.source, '') <> 'customer'
      and coalesce(ct.referral_stage, '') not in ('已簽約', '起步中', '穩定經營中')
  ),
  w as (
    select c.* from c, tw
    where coalesce(c.interest_level, '') <> '沒興趣'
      and (c.last_d is null or c.last_d >= tw.d - 90)
      and (c.plan_d is not null or c.need_level = '大四' or c.interest_level in ('很有興趣', '有點興趣'))
      and (c.walnut_sunk_at is null or (c.plan_d is not null and c.plan_d > (c.walnut_sunk_at at time zone 'Asia/Taipei')::date))
  )
  select
    (select count(*) from c)::int,
    (select count(*) from w)::int,
    (select count(*) from w, tw where w.last_d is null or w.last_d < tw.d - 14)::int
  where public.can_view_bv(partner_id)
$$;

-- 檢查（只看，不改東西）：應該是 1
select count(*) as 新規則 from pg_proc where proname = 'get_partner_jar' and prosrc like '%說明會%';
