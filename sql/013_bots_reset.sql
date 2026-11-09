-- 013（請在 Supabase → SQL Editor 整段貼上執行一次）：電腦玩家 20 隻＋後台電腦玩家管理＋一鍵全部重玩
-- 田地、裝備、寵物改名那部分已經直接更新到伺服器了，這份只剩電腦玩家和重玩功能
-- ================= 電腦玩家（跟真人一樣玩，畫面上不區分） =================
create table if not exists public.bots(
  id uuid primary key references public.players(id) on delete cascade,
  sort int, start_lv int not null default 5, style text not null default 'normal',
  active boolean not null default true, steal_day date, steal_n int not null default 0, last_act timestamptz);
alter table public.bots enable row level security;
insert into public.settings(key, value, note) values
  ('bot_real_steal_daily', '2', '每隻電腦玩家每天最多偷真人玩家幾次'),
  ('bot_every_min', '3', '電腦玩家每隔幾分鐘動一輪（有玩家在線時才會跑）'),
  ('bot_batch', '7', '每一輪處理幾隻電腦玩家')
on conflict (key) do nothing;

-- 把一隻電腦玩家設成起始狀態（等級、田、牧場、寵物、外觀、裝飾）
create or replace function public._bot_setup(p_id uuid, p_lv int) returns void
language plpgsql security definer set search_path to 'public' as $$
declare sp text[]; n int; i int; c crops; cr text; pos jsonb := '[{"x":12.99,"y":20.44},{"x":10.94,"y":21.69},{"x":9.12,"y":24.17},{"x":8.46,"y":20.54},{"x":10.61,"y":19.38},{"x":6.64,"y":23.35},{"x":12.27,"y":17.73},{"x":8.13,"y":25.83}]';
  dinv jsonb := '{}'; dpl jsonb := '[]'; d text; sk record; v_skins jsonb := '{}'; v_skon jsonb := '{}'; tn text; v_party jsonb := '[]'; v_bst jsonb := '{}'; a animals; rd double precision;
begin
  -- 寵物夥伴
  sp := array(select id from beasts order by random());
  n := least(_party_cap(p_lv), 1 + floor(random()*3)::int);
  for i in 1..n loop v_party := v_party || jsonb_build_array(jsonb_build_object('s', sp[i], 'g', null)); v_bst := v_bst || jsonb_build_object(sp[i], (extract(epoch from now())*1000)::bigint); end loop;
  -- 建築外觀 0～2 套
  for sk in select * from skins order by random() limit floor(random()*3)::int loop
    if not v_skon ? sk.bld then v_skins := v_skins || jsonb_build_object(sk.id, true); v_skon := v_skon || jsonb_build_object(sk.bld, sk.style); end if;
  end loop;
  tn := case when random() < 0.45 then (select id from tones where id <> 'spring' order by random() limit 1) else 'spring' end;
  -- 裝飾 3～7 個
  for i in 0..(2 + floor(random()*5)::int) loop
    d := (select id from decor order by random() limit 1);
    dinv := jsonb_set(dinv, array[d], to_jsonb(coalesce((dinv->>d)::int,0) + 1));
    dpl := dpl || jsonb_build_array(jsonb_build_object('i', d, 'x', (pos->i->>'x')::numeric, 'y', (pos->i->>'y')::numeric));
  end loop;
  update players set lv = p_lv, exp = floor(random()*30*p_lv*p_lv*0.6)::int, gold = 300 + p_lv*p_lv*60 + floor(random()*2000)::int, gems = 0,
    seeds = '{}', crops = '{}', goods = '{}', gear = '{}', equip = null, auto_seed = null, gift_lv = p_lv,
    avatar = 1 + floor(random()*30)::int, chara = sp[1] || '1', beasts = v_bst, party = v_party,
    skins = v_skins, skin_on = v_skon, tones = case when tn = 'spring' then '{}'::jsonb else jsonb_build_object(tn, true) end, tone = tn,
    decor_inv = dinv, decor_place = dpl, prank_cnt = 0, steal_cnt = 0, last_seen = now() - make_interval(mins => floor(random()*300)::int)
    where id = p_id;
  delete from plots where owner = p_id;
  delete from ranch where owner = p_id;
  for i in 0..19 loop
    if i >= 2 and coalesce((select lv from land where idx = i), 99) > p_lv then
      insert into plots(owner, idx, state) values (p_id, i, 'wild');
    elsif random() < 0.75 then
      select * into c from crops where lv <= p_lv order by random() limit 1;
      rd := random();
      if rd < 0.3 then  -- 已經成熟
        insert into plots(owner, idx, state, crop, grown, last_tick, weeds, bugs, stolen, planted_at, ripe_at)
          values (p_id, i, 'grow', c.id, c.grow_sec, now(), 0, 0, 0, now() - make_interval(secs => c.grow_sec + floor(random()*1800)::int), now() - make_interval(mins => floor(random()*40)::int));
      else
        insert into plots(owner, idx, state, crop, grown, last_tick, wet_until, weeds, bugs, stolen, planted_at)
          values (p_id, i, 'grow', c.id, c.grow_sec * rd * 0.9, now(), case when random() < 0.5 then now() + interval '20 minutes' end,
            (random() < 0.2)::int, (random() < 0.2)::int, 0, now() - make_interval(secs => (c.grow_sec * rd)::int));
      end if;
    else
      insert into plots(owner, idx, state) values (p_id, i, 'empty');
    end if;
  end loop;
  if p_lv >= _cfg('ranch_lv',3) then
    for i in 0..(least(_ranch_cap(p_lv), 1 + floor(random()*_ranch_cap(p_lv))::int) - 1) loop
      select * into a from animals where lv <= p_lv order by random() limit 1;
      insert into ranch(owner, slot, kind, fed_at, ready_at) values (p_id, i, a.id,
        case when random() < 0.7 then now() - make_interval(secs => floor(random()*a.prod_sec)::int) end, null);
      update ranch set ready_at = fed_at + make_interval(secs => a.prod_sec) where owner = p_id and slot = i and fed_at is not null;
    end loop;
  end if;
end $$;

-- 建立 20 個電腦玩家（已經有就略過）
do $$
declare nm text[] := array['阿喵不睡覺','布丁大隊長','小熊愛吃蜜','炸雞配可樂','夜貓子阿哲','珍奶少冰','一隻小企鵝','曬太陽的龍','山頂洞人','拿鐵不加糖',
                           '肥宅快樂水','今天也要加油','跳跳虎','火鍋第一名','雨天的狐狸','雲端漫步','黑糖饅頭','路過的勇者','鳳梨酥','滷肉飯大師'];
  lvs int[] := array[3,4,5,5,6,7,8,8,9,10,11,12,13,14,15,16,18,20,22,25];
  sty text[] := array['busy','casual','thief','helper','normal'];
  i int; u uuid;
begin
  if exists(select 1 from bots) then return; end if;
  for i in 1..20 loop
    if exists(select 1 from players where lower(nickname) = lower(nm[i])) then continue; end if;
    u := gen_random_uuid();
    insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'farmer' || lpad(i::text, 2, '0') || '@npc.farm-together.invalid',
      crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now() - make_interval(days => floor(random()*20)::int), now(),
      '{"provider":"email","providers":["email"]}', '{}', '', '', '', '', false, false);
    insert into players(id, nickname, created_at) values (u, nm[i], now() - make_interval(days => floor(random()*20)::int));
    insert into bots(id, sort, start_lv, style) values (u, i, lvs[i], sty[1 + (i % 5)]);
    perform _bot_setup(u, lvs[i]);
  end loop;
end $$;

-- 一隻電腦玩家做一輪事（用牠的身分呼叫跟真人一樣的動作）
create or replace function public._bot_act(b bots) returns void
language plpgsql security definer set search_path to 'public' as $$
declare me players; r record; n int; cr text; tot int; busy boolean := b.style in ('busy','thief'); today date := (now() at time zone 'Asia/Taipei')::date; is_real boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b.id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b.id::text, true);
  perform set_config('request.headers', '{}', true);
  perform _tick(b.id);
  -- 好友邀請：過一下子自動接受
  for r in select from_id from friends where to_id = b.id and status = 'pending' and created_at < now() - interval '2 minutes' loop
    begin perform farm_friend_respond(r.from_id, true); exception when others then null; end;
  end loop;
  -- 收成
  for r in select pl.idx from plots pl join crops c on c.id = pl.crop where pl.owner = b.id and pl.state = 'grow' and pl.grown >= c.grow_sec loop
    if busy or random() < 0.35 then begin perform farm_act('harvest', r.idx); exception when others then null; end; end if;
  end loop;
  -- 照顧作物
  for r in select pl.idx, pl.weeds, pl.bugs, pl.wet_until from plots pl join crops c on c.id = pl.crop where pl.owner = b.id and pl.state = 'grow' and pl.grown < c.grow_sec loop
    if coalesce(r.wet_until, now()) <= now() and random() < 0.6 then begin perform farm_act('water', r.idx); exception when others then null; end; end if;
    if r.weeds > 0 and random() < 0.5 then begin perform farm_act('weed', r.idx); exception when others then null; end; end if;
    if r.bugs > 0 and random() < 0.5 then begin perform farm_act('bug', r.idx); exception when others then null; end; end if;
  end loop;
  -- 牧場
  select * into me from players where id = b.id;
  if me.lv >= _cfg('ranch_lv',3) then
    for r in select slot, ready_at from ranch where owner = b.id loop
      if r.ready_at is not null and r.ready_at <= now() and (busy or random() < 0.4) then begin perform farm_ranch_act('collect', r.slot); exception when others then null; end;
      elsif r.ready_at is null and random() < 0.7 then begin perform farm_ranch_act('feed', r.slot); exception when others then null; end; end if;
    end loop;
    select count(*) into n from ranch where owner = b.id;
    if n < _ranch_cap(me.lv) and random() < 0.15 then
      select id into cr from animals where lv <= me.lv and price * 3 <= me.gold order by random() limit 1;
      if cr is not null then begin perform farm_ranch_act('buy', null, cr); exception when others then null; end; end if;
    end if;
    if random() < 0.4 then begin perform farm_ranch_act('sell_goods'); exception when others then null; end; end if;
  end if;
  -- 賣菜（留一點當飼料）
  select coalesce(sum((v)::int),0) into tot from players pl, jsonb_each_text(pl.crops) e(k,v) where pl.id = b.id;
  if tot > 12 and random() < 0.6 then begin perform farm_act('sell_all'); exception when others then null; end; end if;
  -- 開墾
  select * into me from players where id = b.id;
  select pl.idx into n from plots pl join land l on l.idx = pl.idx where pl.owner = b.id and pl.state = 'wild' and l.lv <= me.lv and l.cost * 2 <= me.gold order by pl.idx limit 1;
  if n is not null and random() < 0.5 then begin perform farm_act('till', n); exception when others then null; end; end if;
  -- 播種
  select count(*) into n from plots where owner = b.id and state = 'empty';
  if n > 0 then
    select * into me from players where id = b.id;
    select id into cr from (select id, seed from crops where lv <= me.lv order by lv desc limit 4) x where seed * n <= me.gold order by random() limit 1;
    if cr is null then cr := 'radish'; n := least(n, floor(me.gold / 10)::int); end if;
    if n > 0 then
      begin perform farm_act('buy', null, cr, least(n, 99)); exception when others then n := 0; end;
      for r in select idx from plots where owner = b.id and state = 'empty' order by idx limit n loop
        begin perform farm_act('plant', r.idx, cr); exception when others then null; end;
      end loop;
    end if;
  end if;
  -- 社交：偷菜、幫忙、惡作劇
  if random() < case b.style when 'thief' then 0.6 when 'helper' then 0.15 else 0.3 end then
    for r in select pl.owner, pl.idx from plots pl join crops c on c.id = pl.crop join players o on o.id = pl.owner
             where pl.owner <> b.id and pl.state = 'grow' and pl.grown >= c.grow_sec and pl.stolen < _cap(c, pl.weeds, pl.bugs) and not o.banned
               and (o.lv > _cfg('newbie_lv',3) or _is_friend(b.id, o.id))
               and not exists(select 1 from steals s where s.owner = pl.owner and s.idx = pl.idx and s.thief = b.id and s.planted_at = pl.planted_at)
             order by random() limit 2 loop
      is_real := not exists(select 1 from bots where id = r.owner);
      if is_real then
        select * into b from bots where id = b.id;
        if b.steal_day is distinct from today then update bots set steal_day = today, steal_n = 0 where id = b.id; b.steal_n := 0; end if;
        continue when b.steal_n >= _cfg('bot_real_steal_daily',2);
      end if;
      begin
        perform farm_friend_act(r.owner, 'steal', r.idx);
        if is_real then update bots set steal_n = steal_n + 1, steal_day = today where id = b.id; end if;
      exception when others then null; end;
    end loop;
  end if;
  if random() < case b.style when 'helper' then 0.6 else 0.2 end then
    for r in select pl.owner, pl.idx, pl.weeds, pl.bugs from plots pl
             where pl.owner <> b.id and pl.state = 'grow' and (pl.weeds > 0 or pl.bugs > 0) and _is_friend(b.id, pl.owner) order by random() limit 2 loop
      begin perform farm_friend_act(r.owner, case when r.weeds > 0 then 'help_weed' else 'help_bug' end, r.idx); exception when others then null; end;
    end loop;
  end if;
  if random() < case b.style when 'thief' then 0.12 else 0.04 end then
    for r in select pl.owner, pl.idx from plots pl join crops c on c.id = pl.crop join players o on o.id = pl.owner
             where pl.owner <> b.id and pl.state = 'grow' and pl.grown < c.grow_sec and o.lv > _cfg('newbie_lv',3) order by random() limit 1 loop
      begin perform farm_friend_act(r.owner, case when random() < 0.5 then 'prank_weed' else 'prank_bug' end, r.idx); exception when others then null; end;
    end loop;
  end if;
  update players set last_seen = now() where id = b.id;
end $$;

-- 有玩家在線時，每隔幾分鐘讓一批電腦玩家動一輪
create or replace function public._bot_run() returns void
language plpgsql security definer set search_path to 'public' as $$
declare oc text := current_setting('request.jwt.claims', true); os text := current_setting('request.jwt.claim.sub', true); oh text := current_setting('request.headers', true);
  b bots; v_last numeric;
begin
  if not pg_try_advisory_xact_lock(771203) then return; end if;
  v_last := coalesce((select (value #>> '{}')::numeric from settings where key = 'bot_last_run'), 0);
  if extract(epoch from now()) - v_last < _cfg('bot_every_min',3) * 60 then return; end if;
  insert into settings(key, value, note) values ('bot_last_run', to_jsonb(extract(epoch from now())), '電腦玩家上次動的時間（自動）')
    on conflict (key) do update set value = excluded.value;
  for b in select * from bots where active order by last_act nulls first limit _cfg('bot_batch',7)::int loop
    begin perform _bot_act(b); exception when others then null; end;
    update bots set last_act = now() where id = b.id;
  end loop;
  perform set_config('request.jwt.claims', coalesce(oc, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(os, ''), true);
  perform set_config('request.headers', coalesce(oh, ''), true);
end $$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.farm_session_ping(uuid)'::regprocedure);
  if position('_bot_run' in d) = 0 then
    d := replace(d, '  if u is null then return jsonb_build_object(''ok'', true); end if;',
      E'  if u is null then return jsonb_build_object(''ok'', true); end if;\n  begin perform _bot_run(); exception when others then null; end;');
    if position('_bot_run' in d) = 0 then raise exception 'farm_session_ping 找不到'; end if;
    execute d;
  end if;
end $$;

-- ================= 後台：電腦玩家管理、一鍵全部重玩 =================
create or replace function public.adm_bots() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform _adm();
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv, 'gold', p.gold, 'start_lv', b.start_lv, 'style', b.style,
      'active', b.active, 'last_act', _ms(b.last_act), 'steal_n', case when b.steal_day = (now() at time zone 'Asia/Taipei')::date then b.steal_n else 0 end,
      'friends', (select count(*) from friends f where f.status = 'accepted' and (f.from_id = p.id or f.to_id = p.id))) order by b.sort)
    from bots b join players p on p.id = b.id), '[]'::jsonb);
end $$;

create or replace function public.adm_bot_save(p_id uuid, p_nick text, p_active boolean, p_lv int) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); n text := btrim(p_nick);
begin
  if not exists(select 1 from bots where id = p_id) then raise exception '找不到這個電腦玩家'; end if;
  if char_length(n) < 1 or char_length(n) > 10 then raise exception '暱稱要 1～10 個字'; end if;
  if exists(select 1 from players where lower(nickname) = lower(n) and id <> p_id) then raise exception '這個暱稱已經有人用了'; end if;
  update players set nickname = n where id = p_id;
  update bots set active = coalesce(p_active, active), start_lv = least(30, greatest(1, coalesce(p_lv, start_lv))) where id = p_id;
  perform _adm_log(a, 'bot_save', jsonb_build_object('bot', p_id, 'nick', n, 'active', p_active, 'lv', p_lv));
  return adm_bots();
end $$;

-- p_id 留空 = 全部電腦玩家重玩（回到起始等級）
create or replace function public.adm_bot_reset(p_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); b bots; n int := 0;
begin
  for b in select * from bots where p_id is null or id = p_id loop
    delete from steals where thief = b.id or owner = b.id;
    delete from farm_logs where owner = b.id;
    perform _bot_setup(b.id, b.start_lv);
    update bots set steal_n = 0, last_act = null where id = b.id;
    n := n + 1;
  end loop;
  perform _adm_log(a, 'bot_reset', jsonb_build_object('bot', p_id, 'n', n));
  return adm_bots();
end $$;

-- 一鍵全部重玩：所有玩家（含電腦）等級、金幣、鑽石、田、牧場、寵物、裝備、裝飾、外觀全部回到新手狀態；保留帳號、暱稱、頭像、好友
create or replace function public.adm_reset_all(p_confirm text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); n int; b bots;
begin
  if p_confirm is distinct from '全部重玩' then raise exception '請輸入「全部重玩」確認'; end if;
  delete from steals where true;
  delete from farm_logs where true;
  delete from ranch where true;
  delete from plots where true;
  update players set lv = 1, exp = 0, gold = default, gems = 0, seeds = default, crops = default, goods = default,
    prank_day = null, prank_cnt = 0, steal_day = null, steal_cnt = 0, song_day = null, gear = default, equip = null, auto_seed = null,
    gift_lv = 1, skins = default, skin_on = default, decor_inv = default, decor_place = default, beasts = default, party = default,
    tones = default, tone = default, chara = default where true;
  get diagnostics n = row_count;
  insert into plots(owner, idx, state) select p.id, i, case when i >= 2 then 'wild' else 'empty' end from players p, generate_series(0,19) i;
  for b in select * from bots loop
    perform _bot_setup(b.id, b.start_lv);
    update bots set steal_n = 0, last_act = null where id = b.id;
  end loop;
  perform _adm_log(a, 'reset_all', jsonb_build_object('players', n));
  return jsonb_build_object('players', n);
end $$;

revoke all on function public._bot_setup(uuid,int), public._bot_act(bots), public._bot_run() from public, anon, authenticated;
grant execute on function public.adm_bots(), public.adm_bot_save(uuid,text,boolean,int), public.adm_bot_reset(uuid), public.adm_reset_all(text) to authenticated;
