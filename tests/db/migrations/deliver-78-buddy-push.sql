-- deliver-78：搭檔邀請、答應邀請時跳手機通知
-- 記下什麼時候答應、通知送過了沒（同一次只送一次）。可以重複執行

alter table public.buddies add column if not exists accepted_at timestamptz;
alter table public.buddies add column if not exists invite_pushed_at timestamptz;
alter table public.buddies add column if not exists accept_pushed_at timestamptz;

-- 答應邀請：多記一個答應的時間（其他規則跟原本一樣）
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
  update buddies set status = 'active', start_day = tw_today(), accepted_at = now() where id = p_id;
  return true;
end $$;
revoke all on function public.buddy_accept(bigint) from public, anon;
grant execute on function public.buddy_accept(bigint) to authenticated;
