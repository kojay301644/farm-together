-- 玩家每次連線心跳（farm_session_ping）不再順便跑電腦玩家：電腦玩家多了以後一輪要十幾秒，
-- 會讓玩家的請求逾時（而且逾時就回滾，下一個人又再跑一次，整個卡住）。電腦玩家只靠排程 farm-bots 每 3 分鐘跑
do $$
declare d text;
begin
  d := pg_get_functiondef('public.farm_session_ping(uuid)'::regprocedure);
  if position('perform _bot_run();' in d) > 0 then
    d := replace(d, E'\n  begin perform _bot_run(); exception when others then null; end;', '');
    execute d;
  end if;
end $$;
