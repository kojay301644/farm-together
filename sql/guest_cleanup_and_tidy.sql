-- 一起種田吧：試玩帳號自動清除＋清掉用不到的舊程式
-- 貼到 Supabase 後台 → SQL Editor → Run，執行一次就好

-- 1. 每天凌晨 4:17（台灣時間 12:17）清除：30 天沒上線、等級 Lv3 以下的試玩帳號
create or replace function public._guest_cleanup()
 returns integer language plpgsql security definer set search_path to 'public', 'auth'
as $function$
declare n int;
begin
  -- 大聲公紀錄沒有連動刪除，先清掉
  delete from public.shouts s using auth.users u, public.players p
   where s.uid = u.id and p.id = u.id and u.is_anonymous and p.lv <= 3
     and coalesce(p.last_seen, p.created_at) < now() - interval '30 days';
  with gone as (
    delete from auth.users u using public.players p
     where p.id = u.id and u.is_anonymous and p.lv <= 3
       and coalesce(p.last_seen, p.created_at) < now() - interval '30 days'
    returning u.id)
  select count(*) into n from gone;
  -- 按了試玩但沒取暱稱就離開的空帳號
  delete from auth.users u
   where u.is_anonymous and u.created_at < now() - interval '30 days'
     and not exists (select 1 from public.players p where p.id = u.id);
  return n;
end $function$;
revoke execute on function public._guest_cleanup() from public, anon, authenticated;
select cron.schedule('farm-guest-cleanup', '17 4 * * *', 'select public._guest_cleanup()');

-- 2. 清掉今天取消的「自動買種子」和舊版頭像框後台設定（已經停用，不影響遊戲）
drop function if exists public.farm_set_auto_buy(boolean);
drop function if exists public.adm_cos_save(text, text, integer, integer);
alter table public.players drop column if exists auto_buy;
