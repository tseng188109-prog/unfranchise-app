-- deliver-77：邀請連結（每個人一組短代碼，朋友點連結註冊時自動帶入推薦人）
-- 可以重複執行

alter table public.users add column if not exists ref_code text;
create unique index if not exists users_ref_code on public.users(ref_code);

-- 拿我的邀請代碼（沒有就產生一組 6 碼，不含容易看錯的 0 O 1 I）
create or replace function public.my_ref_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if auth.uid() is null then
    raise exception '請先登入';
  end if;
  select ref_code into v from users where id = auth.uid();
  if v is not null then
    return v;
  end if;
  loop
    v := '';
    for i in 1..6 loop
      v := v || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    begin
      update users set ref_code = v where id = auth.uid() and ref_code is null;
      exit;
    exception when unique_violation then
      -- 撞號就再抽一次
    end;
  end loop;
  select ref_code into v from users where id = auth.uid();
  return v;
end;
$$;
revoke all on function public.my_ref_code() from public, anon;
grant execute on function public.my_ref_code() to authenticated;

-- 用代碼查推薦人：只回 id 和名字，不回 Email 或其他資料
create or replace function public.ref_lookup(p_code text)
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name
  from users u
  where p_code is not null
    and length(p_code) between 4 and 12
    and u.ref_code = upper(trim(p_code))
    and not exists (select 1 from account_status s where s.user_id = u.id and s.deactivated_at is not null)
  limit 1;
$$;
revoke all on function public.ref_lookup(text) from public;
grant execute on function public.ref_lookup(text) to anon, authenticated;
