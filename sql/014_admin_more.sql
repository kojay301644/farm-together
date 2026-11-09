-- 014（請在 Supabase → SQL Editor 整段貼上執行一次）：後台加強
--   玩家管理加強、全服發獎＋兌換碼、活動加倍＋維護模式、更多遊戲數值、更新紀錄可編輯

-- ================= 新的設定值 =================
insert into public.settings(key, value, note) values
  ('new_gold', '300', '新玩家起始金幣'),
  ('new_radish', '4', '新玩家起始白蘿蔔種子數'),
  ('dry_speed', '0.5', '作物缺水時的生長速度（0.5＝一半速度）'),
  ('pest_rate', '1', '雜草和蟲出現的頻率倍數（1＝正常、2＝兩倍多、0＝不會出現）'),
  ('lvgift_5', '1', 'Lv5 升級禮物裝備等級（0＝不送、1～4＝I～IV）'),
  ('lvgift_10', '2', 'Lv10 升級禮物裝備等級（0＝不送）'),
  ('lvgift_15', '2', 'Lv15 升級禮物裝備等級（0＝不送）'),
  ('lvgift_20', '3', 'Lv20 升級禮物裝備等級（0＝不送）'),
  ('ticker_on', '1', '跑馬燈（1＝顯示、0＝關閉）'),
  ('ev_exp', '1', '活動：經驗倍數'),
  ('ev_yield', '1', '活動：收成數量倍數'),
  ('ev_gold', '1', '活動：賣東西金幣倍數'),
  ('ev_start', '0', '活動開始時間（自動）'),
  ('ev_end', '0', '活動結束時間（自動）'),
  ('ev_name', '""', '活動名稱（自動）'),
  ('maint_on', '0', '維護模式（自動）'),
  ('maint_msg', '""', '維護公告（自動）')
on conflict (key) do nothing;

-- 文字或任意值的設定（活動名稱、維護公告用）
create or replace function public.adm_setting_put(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); old jsonb;
begin
  select value into old from settings where key = p_key;
  if not found then raise exception '沒有這個設定'; end if;
  update settings set value = p_value, updated_at = now() where key = p_key;
  perform _adm_log(a, 'setting', jsonb_build_object('key', p_key, 'from', old, 'to', p_value));
  return adm_config();
end $$;

-- 活動倍數：在活動時間內才生效
create or replace function public._ev(k text) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select case when extract(epoch from now()) between _cfg('ev_start',0) and _cfg('ev_end',0) then greatest(0, _cfg(k,1)) else 1 end
$$;

-- ================= 維護模式：管理員以外都擋下 =================
create or replace function public._guard(u uuid) returns void
language plpgsql stable security definer set search_path to 'public' as $$
declare b boolean; r text; s uuid := _sid();
begin
  if _cfg('maint_on',0) = 1 and not _is_admin(u) then
    raise exception '維護中：%', coalesce(nullif((select value #>> '{}' from settings where key = 'maint_msg'), ''), '伺服器維護中，請稍後再來');
  end if;
  select banned, ban_reason into b, r from players where id = u;
  if b then raise exception '帳號已被停權%', coalesce('：' || r, ''); end if;
  if s is not null and exists(select 1 from farm_sessions where uid = u and sid <> s) then raise exception 'KICKED'; end if;
end $$;

-- ================= 升級禮物可調 =================
create or replace function public._lv_gifts(p_uid uuid) returns text
language plpgsql security definer set search_path to 'public' as $$
declare me players; g gear; msg text := null; t int; lvl int;
begin
  select * into me from players where id = p_uid for update;
  foreach lvl in array array[5,10,15,20] loop
    if me.lv >= lvl and me.gift_lv < lvl then
      t := least(4, greatest(0, _cfg('lvgift_' || lvl, case lvl when 5 then 1 when 10 then 2 when 15 then 2 else 3 end)::int));
      if t > 0 then
        g := _rand_gear(t, t);
        perform _give_gear(p_uid, g.id);
        msg := coalesce(msg || '、', '') || 'Lv' || lvl || ' 升級禮物：' || g.name;
      end if;
      update players set gift_lv = lvl where id = p_uid;
    end if;
  end loop;
  return msg;
end $$;

-- ================= 把活動倍數、起始資源、缺水速度、蟲草頻率接進原本的功能 =================
do $mig$
declare d text;
begin
  -- 經驗
  d := pg_get_functiondef('public._add_exp(uuid,integer)'::regprocedure);
  if position('_ev(' in d) = 0 then
    if position('update players set exp = exp + p_n where id = p_uid' in d) = 0 then raise exception '_add_exp 找不到'; end if;
    execute replace(d, 'update players set exp = exp + p_n where id = p_uid', 'update players set exp = exp + ceil(p_n * _ev(''ev_exp''))::int where id = p_uid');
  end if;

  -- 手動收成、賣東西
  d := pg_get_functiondef('public.farm_act(text,integer,text,integer)'::regprocedure);
  if position('_ev(' in d) = 0 then
    if position('amt := greatest(1, base - p.stolen);' in d) = 0 then raise exception 'farm_act 收成找不到'; end if;
    d := replace(d, 'amt := greatest(1, base - p.stolen);', 'amt := greatest(1, ceil((base - p.stolen) * _ev(''ev_yield''))::int);');
    if position('amt := v * c.price;' in d) = 0 then raise exception 'farm_act 賣出找不到'; end if;
    d := replace(d, 'amt := v * c.price;', 'amt := ceil(v * c.price * _ev(''ev_gold''))::int;');
    if position($s$update players set gold = gold + amt, crops = '{}'::jsonb where id = uid;$s$ in d) = 0 then raise exception 'farm_act 全部賣出找不到'; end if;
    d := replace(d, $s$update players set gold = gold + amt, crops = '{}'::jsonb where id = uid;$s$, $s$amt := ceil(amt * _ev('ev_gold'))::int; update players set gold = gold + amt, crops = '{}'::jsonb where id = uid;$s$);
    execute d;
  end if;

  -- 牧場賣產品
  d := pg_get_functiondef('public.farm_ranch_act(text,integer,text)'::regprocedure);
  if position('_ev(' in d) = 0 then
    if position($s$update players set gold = gold + amt, goods = '{}'::jsonb where id = uid;$s$ in d) = 0 then raise exception 'farm_ranch_act 找不到'; end if;
    execute replace(d, $s$update players set gold = gold + amt, goods = '{}'::jsonb where id = uid;$s$, $s$amt := ceil(amt * _ev('ev_gold'))::int; update players set gold = gold + amt, goods = '{}'::jsonb where id = uid;$s$);
  end if;

  -- 自動收成、缺水速度、蟲草頻率
  d := pg_get_functiondef('public._tick(uuid)'::regprocedure);
  if position('dry_speed' in d) = 0 then
    if position('gu := r.grown + wet + dry * 0.5;' in d) = 0 then raise exception '_tick 缺水找不到'; end if;
    d := replace(d, 'gu := r.grown + wet + dry * 0.5;', 'gu := r.grown + wet + dry * _cfg(''dry_speed'',0.5);');
    if position('if random() < chunk / ivl then' in d) = 0 then raise exception '_tick 蟲草找不到'; end if;
    d := replace(d, 'if random() < chunk / ivl then', 'if random() < chunk / ivl * _cfg(''pest_rate'',1) then');
    if position('amt := greatest(1, greatest(ceil(c.yield*0.6)::int, c.yield - r.weeds - r.bugs) - r.stolen);' in d) = 0 then raise exception '_tick 自動收成找不到'; end if;
    d := replace(d, 'amt := greatest(1, greatest(ceil(c.yield*0.6)::int, c.yield - r.weeds - r.bugs) - r.stolen);',
      'amt := greatest(1, ceil((greatest(ceil(c.yield*0.6)::int, c.yield - r.weeds - r.bugs) - r.stolen) * _ev(''ev_yield''))::int);');
    execute d;
  end if;

  -- 新玩家起始金幣、種子
  d := pg_get_functiondef('public.farm_create(text)'::regprocedure);
  if position('new_gold' in d) = 0 then
    if position('insert into players(id, nickname) values (uid, nick);' in d) = 0 then raise exception 'farm_create 找不到'; end if;
    execute replace(d, 'insert into players(id, nickname) values (uid, nick);',
      'insert into players(id, nickname) values (uid, nick); update players set gold = _cfg(''new_gold'',300)::int, seeds = case when _cfg(''new_radish'',4) > 0 then jsonb_build_object(''radish'', _cfg(''new_radish'',4)::int) else ''{}''::jsonb end where id = uid;');
  end if;

  -- 跑馬燈開關
  d := pg_get_functiondef('public.farm_ticker()'::regprocedure);
  if position('ticker_on' in d) = 0 then
    execute replace(d, $s$where l.kind in ('steal','r_steal','dog')$s$, $s$where _cfg('ticker_on',1) = 1 and l.kind in ('steal','r_steal','dog')$s$);
  end if;
end $mig$;

-- ================= 發東西給玩家（全服發獎、兌換碼、後台補發共用） =================
-- reward 格式：{"gold":100,"gems":10,"exp":50,"seeds":{"radish":5},"crops":{"corn":3},"gear":{"dog1":1},"decor":{"flower":1},"beasts":["fox"],"tones":["snow"],"skins":["home_bb"]}
create or replace function public._grant(p_uid uuid, rw jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
declare e record; x text;
begin
  if rw is null then return; end if;
  update players set gold = greatest(0, gold + coalesce((rw->>'gold')::int, 0)), gems = greatest(0, gems + coalesce((rw->>'gems')::int, 0)) where id = p_uid;
  if coalesce((rw->>'exp')::int, 0) > 0 then perform _add_exp(p_uid, (rw->>'exp')::int); end if;
  for e in select key, (value #>> '{}')::int n from jsonb_each(coalesce(rw->'seeds','{}')) loop
    if exists(select 1 from crops where id = e.key) then
      update players set seeds = jsonb_set(seeds, array[e.key], to_jsonb(greatest(0, coalesce((seeds->>e.key)::int,0) + e.n))) where id = p_uid; end if;
  end loop;
  for e in select key, (value #>> '{}')::int n from jsonb_each(coalesce(rw->'crops','{}')) loop
    if exists(select 1 from crops where id = e.key) then
      update players set crops = jsonb_set(crops, array[e.key], to_jsonb(greatest(0, coalesce((crops->>e.key)::int,0) + e.n))) where id = p_uid; end if;
  end loop;
  for e in select key, (value #>> '{}')::int n from jsonb_each(coalesce(rw->'gear','{}')) loop
    if exists(select 1 from gear where id = e.key) then
      update players set gear = jsonb_set(coalesce(gear,'{}'), array[e.key], to_jsonb(greatest(0, coalesce((gear->>e.key)::int,0) + e.n))) where id = p_uid; end if;
  end loop;
  for e in select key, (value #>> '{}')::int n from jsonb_each(coalesce(rw->'decor','{}')) loop
    if exists(select 1 from decor where id = e.key) then
      update players set decor_inv = jsonb_set(coalesce(decor_inv,'{}'), array[e.key], to_jsonb(greatest(0, coalesce((decor_inv->>e.key)::int,0) + e.n))) where id = p_uid; end if;
  end loop;
  for x in select jsonb_array_elements_text(coalesce(rw->'beasts','[]')) loop
    if exists(select 1 from beasts where id = x) then
      update players set beasts = coalesce(beasts,'{}') || jsonb_build_object(x, (extract(epoch from now())*1000)::bigint) where id = p_uid and not coalesce(beasts,'{}') ? x; end if;
  end loop;
  for x in select jsonb_array_elements_text(coalesce(rw->'tones','[]')) loop
    if exists(select 1 from tones where id = x) then update players set tones = coalesce(tones,'{}') || jsonb_build_object(x, true) where id = p_uid; end if;
  end loop;
  for x in select jsonb_array_elements_text(coalesce(rw->'skins','[]')) loop
    if exists(select 1 from skins where id = x) then update players set skins = coalesce(skins,'{}') || jsonb_build_object(x, true) where id = p_uid; end if;
  end loop;
end $$;

-- 全服發獎（禮物信箱）
create table if not exists public.gifts(
  id bigserial primary key, title text not null, body text, reward jsonb not null default '{}',
  target uuid references public.players(id) on delete cascade, created_at timestamptz not null default now(), expires_at timestamptz);
create table if not exists public.gift_claims(
  gift_id bigint references public.gifts(id) on delete cascade, uid uuid references public.players(id) on delete cascade,
  claimed_at timestamptz not null default now(), primary key (gift_id, uid));
alter table public.gifts enable row level security;
alter table public.gift_claims enable row level security;

create or replace function public.farm_gifts() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'body', g.body, 'reward', g.reward, 'at', _ms(g.created_at)) order by g.created_at)
    from gifts g where (g.target is null or g.target = uid) and (g.expires_at is null or g.expires_at > now())
      and not exists(select 1 from gift_claims c where c.gift_id = g.id and c.uid = uid)), '[]'::jsonb);
end $$;

create or replace function public.farm_gift_claim(p_id bigint) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); g gifts;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into g from gifts where id = p_id and (target is null or target = uid) and (expires_at is null or expires_at > now());
  if not found then raise exception '這個禮物已經過期了'; end if;
  insert into gift_claims(gift_id, uid) values (p_id, uid) on conflict do nothing;
  if not found then raise exception '已經領過了'; end if;
  perform _grant(uid, g.reward);
  return jsonb_build_object('reward', g.reward, 'gift', _lv_gifts(uid), 'state', _state(uid));
end $$;

-- 兌換碼
create table if not exists public.codes(
  code text primary key, reward jsonb not null default '{}', max_uses int not null default 0, used int not null default 0,
  expires_at timestamptz, active boolean not null default true, note text, created_at timestamptz not null default now());
create table if not exists public.code_claims(
  code text references public.codes(code) on delete cascade, uid uuid references public.players(id) on delete cascade,
  claimed_at timestamptz not null default now(), primary key (code, uid));
alter table public.codes enable row level security;
alter table public.code_claims enable row level security;

create or replace function public.farm_redeem(p_code text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); c codes; k text := upper(btrim(coalesce(p_code,'')));
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into c from codes where code = k for update;
  if not found or not c.active then raise exception '沒有這個兌換碼'; end if;
  if c.expires_at is not null and c.expires_at <= now() then raise exception '這個兌換碼已經過期了'; end if;
  if c.max_uses > 0 and c.used >= c.max_uses then raise exception '這個兌換碼已經被領完了'; end if;
  insert into code_claims(code, uid) values (k, uid) on conflict do nothing;
  if not found then raise exception '你已經兌換過這個碼了'; end if;
  update codes set used = used + 1 where code = k;
  perform _grant(uid, c.reward);
  return jsonb_build_object('reward', c.reward, 'gift', _lv_gifts(uid), 'state', _state(uid));
end $$;

-- ================= 後台：發獎、兌換碼 =================
create or replace function public.adm_gifts() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform _adm();
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'body', g.body, 'reward', g.reward, 'at', _ms(g.created_at), 'exp', _ms(g.expires_at),
      'target', (select nickname from players where id = g.target), 'claimed', (select count(*) from gift_claims c where c.gift_id = g.id)) order by g.created_at desc)
    from (select * from gifts order by created_at desc limit 50) g), '[]'::jsonb);
end $$;

create or replace function public.adm_gift_send(p_title text, p_body text, p_reward jsonb, p_target uuid, p_days int) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); i bigint;
begin
  if coalesce(btrim(p_title),'') = '' then raise exception '請填標題'; end if;
  if p_reward is null or p_reward = '{}'::jsonb then raise exception '請設定獎勵'; end if;
  insert into gifts(title, body, reward, target, expires_at) values (btrim(p_title), p_body, p_reward, p_target,
    case when coalesce(p_days,0) > 0 then now() + make_interval(days => p_days) end) returning id into i;
  perform _adm_log(a, 'gift', jsonb_build_object('id', i, 'title', p_title, 'reward', p_reward, 'target', p_target));
  return adm_gifts();
end $$;

create or replace function public.adm_gift_stop(p_id bigint) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  update gifts set expires_at = now() where id = p_id;
  perform _adm_log(a, 'gift_stop', jsonb_build_object('id', p_id));
  return adm_gifts();
end $$;

create or replace function public.adm_codes() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform _adm();
  return coalesce((select jsonb_agg(jsonb_build_object('code', code, 'reward', reward, 'max', max_uses, 'used', used, 'exp', _ms(expires_at), 'active', active, 'note', note, 'at', _ms(created_at)) order by created_at desc) from codes), '[]'::jsonb);
end $$;

create or replace function public.adm_code_save(p_code text, p_reward jsonb, p_max int, p_days int, p_active boolean, p_note text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); k text := upper(btrim(coalesce(p_code,'')));
begin
  if k !~ '^[A-Z0-9]{4,20}$' then raise exception '兌換碼要 4～20 個英文或數字'; end if;
  if exists(select 1 from codes where code = k) then
    update codes set active = coalesce(p_active, active), note = coalesce(p_note, note),
      max_uses = coalesce(p_max, max_uses), reward = coalesce(nullif(p_reward, '{}'::jsonb), reward),
      expires_at = case when p_days is null then expires_at when p_days > 0 then now() + make_interval(days => p_days) else null end where code = k;
  else
    if p_reward is null or p_reward = '{}'::jsonb then raise exception '請設定獎勵'; end if;
    insert into codes(code, reward, max_uses, expires_at, active, note) values (k, p_reward, greatest(0, coalesce(p_max,0)),
      case when coalesce(p_days,0) > 0 then now() + make_interval(days => p_days) end, coalesce(p_active, true), p_note);
  end if;
  perform _adm_log(a, 'code', jsonb_build_object('code', k, 'reward', p_reward, 'max', p_max, 'active', p_active));
  return adm_codes();
end $$;

-- ================= 後台：玩家管理加強 =================
do $mig$
declare d text;
begin
  d := pg_get_functiondef('public.adm_player(uuid)'::regprocedure);
  if position('decor_inv' in d) = 0 then
    if position($s$'plots', _plots_json(p.id, null),$s$ in d) = 0 then raise exception 'adm_player 找不到'; end if;
    execute replace(d, $s$'plots', _plots_json(p.id, null),$s$,
      $s$'plots', _plots_json(p.id, null), 'ranch', _ranch_json(p.id, null), 'goods', p.goods, 'gear', p.gear, 'party', p.party, 'beasts', p.beasts,
      'decor_inv', p.decor_inv, 'skins', p.skins, 'tones', p.tones, 'tone', p.tone, 'is_bot', exists(select 1 from bots b where b.id = p.id),$s$);
  end if;
end $mig$;

create or replace function public.adm_player_set(p_id uuid, p_nick text, p_lv int, p_exp int, p_gold int, p_gems int) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); n text := btrim(coalesce(p_nick,''));
begin
  if not exists(select 1 from players where id = p_id) then raise exception '找不到玩家'; end if;
  if char_length(n) < 1 or char_length(n) > 10 then raise exception '暱稱要 1～10 個字'; end if;
  if exists(select 1 from players where lower(nickname) = lower(n) and id <> p_id) then raise exception '這個暱稱已經有人用了'; end if;
  update players set nickname = n, lv = least(30, greatest(1, coalesce(p_lv, lv))), exp = greatest(0, coalesce(p_exp, exp)),
    gold = greatest(0, coalesce(p_gold, gold)), gems = greatest(0, coalesce(p_gems, gems)) where id = p_id;
  perform _adm_log(a, 'player_set', jsonb_build_object('player', p_id, 'nick', n, 'lv', p_lv, 'exp', p_exp, 'gold', p_gold, 'gems', p_gems));
  return adm_player(p_id);
end $$;

create or replace function public.adm_player_grant(p_id uuid, p_reward jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  if not exists(select 1 from players where id = p_id) then raise exception '找不到玩家'; end if;
  perform _grant(p_id, p_reward);
  perform _adm_log(a, 'player_grant', jsonb_build_object('player', p_id, 'reward', p_reward, 'reason', p_reason));
  return adm_player(p_id);
end $$;

-- 單一玩家重玩（保留帳號、暱稱、頭像、好友）
create or replace function public.adm_player_reset(p_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); b bots;
begin
  if not exists(select 1 from players where id = p_id) then raise exception '找不到玩家'; end if;
  select * into b from bots where id = p_id;
  if found then perform adm_bot_reset(p_id); return adm_player(p_id); end if;
  delete from steals where owner = p_id or thief = p_id;
  delete from farm_logs where owner = p_id;
  delete from ranch where owner = p_id;
  delete from plots where owner = p_id;
  update players set lv = 1, exp = 0, gold = _cfg('new_gold',300)::int, gems = 0,
    seeds = case when _cfg('new_radish',4) > 0 then jsonb_build_object('radish', _cfg('new_radish',4)::int) else '{}'::jsonb end,
    crops = default, goods = default, prank_day = null, prank_cnt = 0, steal_day = null, steal_cnt = 0, gear = default, equip = null,
    auto_seed = null, auto_feed = null, gift_lv = 1, skins = default, skin_on = default, decor_inv = default, decor_place = default,
    beasts = default, party = default, tones = default, tone = default, chara = default where id = p_id;
  insert into plots(owner, idx, state) select p_id, i, case when i >= 2 then 'wild' else 'empty' end from generate_series(0,19) i;
  perform _adm_log(a, 'player_reset', jsonb_build_object('player', p_id));
  return adm_player(p_id);
end $$;

-- ================= 後台：更新紀錄可編輯、刪除 =================
create or replace function public.adm_changelog_save(p_id bigint, p_title text, p_body text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  if coalesce(btrim(p_title),'') = '' then raise exception '請填標題'; end if;
  if p_id is null then insert into changelog(title, body) values (btrim(p_title), p_body);
  else update changelog set title = btrim(p_title), body = p_body where id = p_id; end if;
  perform _adm_log(a, 'changelog', jsonb_build_object('id', p_id, 'title', p_title));
  return adm_changelog();
end $$;

create or replace function public.adm_changelog_del(p_id bigint) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  delete from changelog where id = p_id;
  perform _adm_log(a, 'changelog_del', jsonb_build_object('id', p_id));
  return adm_changelog();
end $$;

revoke all on function public._grant(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.farm_gifts(), public.farm_gift_claim(bigint), public.farm_redeem(text),
  public.adm_setting_put(text,jsonb), public.adm_gifts(), public.adm_gift_send(text,text,jsonb,uuid,int), public.adm_gift_stop(bigint),
  public.adm_codes(), public.adm_code_save(text,jsonb,int,int,boolean,text),
  public.adm_player_set(uuid,text,int,int,int,int), public.adm_player_grant(uuid,jsonb,text), public.adm_player_reset(uuid),
  public.adm_changelog_save(bigint,text,text), public.adm_changelog_del(bigint) to authenticated;

insert into changelog(title, body) values ('禮物信箱＋兌換碼 🎁', '新增「禮物信箱」：營運發的禮物會在登入時跳出來，按一下就能領。設定頁新增「兌換碼」，輸入活動兌換碼可以領獎勵。之後也會不定期舉辦經驗、收成、金幣加倍活動！');
