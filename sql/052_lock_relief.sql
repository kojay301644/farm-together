-- 052：改善伺服器卡頓（2026-11-13）
-- 1. 電腦玩家：每 1 分鐘動 6 個（原本每 3 分鐘動 17 個），每次鎖資料的時間變短
update settings set value = '6' where key = 'bot_batch';
update settings set value = '0.9' where key = 'bot_every_min';
select cron.alter_job((select jobid from cron.job where jobname='farm-bots'), schedule := '* * * * *');
-- 2. 幫別人結算田地時不等鎖：別人正在操作就先跳過（避免互卡、死結）
create or replace function public._tick_try(p_uid uuid) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('lock_timeout', '200ms', true);
  begin
    perform _tick(p_uid);
  exception when lock_not_available or deadlock_detected then
    null;
  end;
  perform set_config('lock_timeout', '0', true);
end $$;
revoke execute on function public._tick_try(uuid) from public, anon, authenticated;
-- farm_neighbors / farm_friends / _tick_all 內的 _tick(其他玩家) 改成 _tick_try(...)
-- _bot_run 開頭加 set_config('lock_timeout','300ms',true)
