-- 新增 30 個農場電腦（15 個愛賭博），愛賭博的：種菜比較懶、收成就賣
do $$
declare
  nm text[] := array['賭神阿發','梭哈小王子','好運來來','翻倍姐','押莊不押閒','今晚必贏','一把翻身','發財樹下','幸運七七','全押哥',
                     '莊家剋星','牌桌老江湖','手氣正旺','金蟾蜍','賭聖星仔',
                     '早起的鳥','菜園小幫手','番茄炒蛋','地瓜葉','小農阿伯','綠手指','西瓜甜不甜','高麗菜妹','玉米鬚','稻草人',
                     '偷吃步','月光下的賊','蘿蔔蹲','熱心阿姨','路邊攤老闆'];
  sty text[] := array['gambler','gambler','gambler','gambler','gambler','gambler','gambler','gambler','gambler','gambler',
                      'gambler','gambler','gambler','gambler','gambler',
                      'busy','busy','busy','casual','casual','casual','normal','normal','normal','helper',
                      'thief','thief','thief','helper','helper'];
  lvs int[] := array[6,9,12,14,17,20,8,11,15,22,10,18,13,16,24, 2,3,4,5,6,7,8,9,10,12,13,15,18,21,25];
  i int; u uuid; s0 int;
begin
  if exists(select 1 from players where lower(nickname) = lower(nm[1])) then return; end if;   -- 跑過了
  select coalesce(max(sort),0) into s0 from bots;
  for i in 1..30 loop
    if exists(select 1 from players where lower(nickname) = lower(nm[i])) then continue; end if;
    u := gen_random_uuid();
    insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'farmer' || lpad((s0+i)::text, 2, '0') || '@npc.farm-together.invalid',
      crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now() - make_interval(days => floor(random()*20)::int), now(),
      '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', false, false);
    insert into players(id, nickname, created_at) values (u, nm[i], now() - make_interval(days => floor(random()*20)::int));
    insert into bots(id, sort, start_lv, style) values (u, s0 + i, lvs[i], sty[i]);
    perform _bot_setup(u, lvs[i]);
  end loop;
  -- 電腦變多：每輪多處理幾隻，每隻動的頻率維持跟以前差不多
  update settings set value = to_jsonb(17) where key = 'bot_batch';
end $$;

-- 愛賭博的電腦：收成、照顧作物比較隨便；收成的菜和牧場產品幾乎馬上賣掉換金幣
do $$
declare d text;
begin
  d := pg_get_functiondef('public._bot_act(bots)'::regprocedure);
  if position('gam boolean' in d) > 0 then return; end if;
  d := replace(d, 'is_real boolean;', 'is_real boolean; gam boolean := b.style = ''gambler'';');
  d := replace(d, 'if busy or random() < 0.35 then', 'if busy or random() < (case when gam then 0.2 else 0.35 end) then');
  d := replace(d, 'if coalesce(r.wet_until, now()) <= now() and random() < 0.6 then', 'if coalesce(r.wet_until, now()) <= now() and random() < (case when gam then 0.3 else 0.6 end) then');
  d := replace(d, 'if r.weeds > 0 and random() < 0.5 then', 'if r.weeds > 0 and random() < (case when gam then 0.25 else 0.5 end) then');
  d := replace(d, 'if r.bugs > 0 and random() < 0.5 then', 'if r.bugs > 0 and random() < (case when gam then 0.25 else 0.5 end) then');
  d := replace(d, 'if random() < 0.4 then begin perform farm_ranch_act(''sell_goods'');', 'if random() < (case when gam then 0.9 else 0.4 end) then begin perform farm_ranch_act(''sell_goods'');');
  d := replace(d, 'if tot > 12 and random() < 0.6 then', 'if (tot > 12 and random() < 0.6) or (gam and tot > 0 and random() < 0.95) then');
  if (length(d) - length(replace(d, 'gam ', ''))) / 4 < 7 then raise exception '_bot_act 改寫不完整'; end if;
  execute d;
end $$;
