-- 娛樂廳各遊戲的調整（後台「🎰 娛樂廳」頁）：桌子數值、抽成、大富翁規則、百家樂籌碼。牌桌伺服器每次都會讀，新開的那一局生效
insert into settings(key, value, note) values ('casino_cfg', '{
  "mj": {"rake": 0.05, "tables": {"n": {"base": 100, "tai": 20, "min": 2000}, "m": {"base": 500, "tai": 100, "min": 10000}, "h": {"base": 2000, "tai": 400, "min": 40000}, "r": {"base": 5000, "tai": 1000, "min": 100000}}},
  "b2": {"rake": 0.05, "tables": {"n": {"per": 20, "min": 2000}, "m": {"per": 100, "min": 10000}, "h": {"per": 400, "min": 40000}, "r": {"per": 1000, "min": 100000}}},
  "th": {"rake": 0.05, "cap": 3, "tables": {"n": {"sb": 10, "bb": 20, "min": 400}, "m": {"sb": 50, "bb": 100, "min": 2000}, "h": {"sb": 200, "bb": 400, "min": 8000}, "r": {"sb": 500, "bb": 1000, "min": 20000}}},
  "mf": {"rake": 0.05, "start": 15000, "go": 2000, "rounds": 20, "split": [0.7, 0.3], "tables": {"n": {"fee": 2000}, "m": {"fee": 5000}, "h": {"fee": 10000}}},
  "bc": {"min": 100, "chips": [100, 500, 1000, 5000, 10000]}
}'::jsonb, '娛樂廳各遊戲的調整（在後台娛樂廳頁改）') on conflict (key) do nothing;

-- 玩家端讀（大廳顯示桌子數值、規則用）
create or replace function public.farm_casino_cfg() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select value from settings where key = 'casino_cfg'), '{}'::jsonb) $$;
grant execute on function public.farm_casino_cfg() to authenticated;
