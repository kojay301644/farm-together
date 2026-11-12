-- 娛樂廳排程（已上線，這裡留紀錄；可重複執行）
-- 每分鐘：麻將／大老二／德州撲克超過 2 分鐘沒動的牌桌（沒有真人在線上），由電腦打完、結算、關桌
create or replace function public._mj_sweep() returns void language sql security definer set search_path=public as $$
  select net.http_post(url:='https://qnxnuyfvkrvhnaewvrik.supabase.co/functions/v1/mahjong',
    headers:=jsonb_build_object('content-type','application/json','x-mj-test',(select v from push_config where k='mj_test_key')),
    body:='{"a":"sweep"}'::jsonb, timeout_milliseconds:=20000);
$$;
-- 每 10 分鐘：沒在牌桌上的農場電腦在背景自己湊桌打幾局（愛賭博的優先）
create or replace function public._mj_botplay() returns void language sql security definer set search_path=public as $$
  select net.http_post(url:='https://qnxnuyfvkrvhnaewvrik.supabase.co/functions/v1/mahjong',
    headers:=jsonb_build_object('content-type','application/json','x-mj-test',(select v from push_config where k='mj_test_key')),
    body:='{"a":"botplay"}'::jsonb, timeout_milliseconds:=30000);
$$;
select cron.schedule('farm-mj-sweep', '* * * * *', 'select public._mj_sweep()');
select cron.schedule('farm-mj-botplay', '*/10 * * * *', 'select public._mj_botplay()');
