-- 菜價行情：作物、牧場產品的收購價每小時變動（基本價的 50%～200%），有趨勢、賣壓、自動突發事件；倉庫有上限，滿了多的照現價賣掉
alter table public.players add column if not exists barn_lv int not null default 0;

create table if not exists public.market(
  kind text not null, id text not null,
  mult numeric not null default 1, trend numeric not null default 0, press numeric not null default 0,
  ev_mult numeric not null default 1, ev_until timestamptz, vol numeric not null default 0.06,
  primary key(kind, id));
create table if not exists public.market_hist(kind text not null, id text not null, at timestamptz not null default now(), mult numeric not null);
create index if not exists market_hist_i on public.market_hist(kind, id, at);
create table if not exists public.market_events(id bigserial primary key, typ text, title text, items jsonb, mult numeric, starts timestamptz not null default now(), ends timestamptz);
alter table public.market enable row level security;
alter table public.market_hist enable row level security;
alter table public.market_events enable row level security;

insert into settings(key, value, note) values
  ('mkt_lo', '0.5', '菜價行情：最低是基本價的幾倍'),
  ('mkt_hi', '2', '菜價行情：最高是基本價的幾倍'),
  ('mkt_events', '1', '菜價行情：自動突發事件（1＝開、0＝關）'),
  ('mkt_event_rate', '0.12', '菜價行情：沒有事件時，每小時發生事件的機率'),
  ('mkt_press', '0.02', '菜價行情：一小時內全服每賣 100 個，價格往下壓多少（0.02＝2%）'),
  ('barn_base', '200', '倉庫：一開始可以放幾個（作物＋牧場產品）'),
  ('barn_step', '100', '倉庫：每升一級多幾格'),
  ('barn_max', '1000', '倉庫：最多幾格'),
  ('barn_cost', '5000', '倉庫：第一次升級的費用（之後每次加倍）')
on conflict (key) do nothing;

create or replace function public._jsum(j jsonb) returns int language sql immutable as $$
  select coalesce(sum((value)::int), 0)::int from jsonb_each_text(coalesce(j, '{}'::jsonb)) $$;

create or replace function public._barn_cap(p_lv int) returns int language sql stable set search_path to 'public' as $$
  select least(_cfg('barn_max',1000), _cfg('barn_base',200) + coalesce(p_lv,0) * _cfg('barn_step',100))::int $$;

create or replace function public._mkt_base(p_kind text, p_id text) returns numeric language sql stable set search_path to 'public' as $$
  select case when p_kind = 'c' then (select price from crops where id = p_id)::numeric
              else (select max(good_price) from animals where good = p_id)::numeric end $$;

create or replace function public._mkt_mult(p_kind text, p_id text) returns numeric language sql stable set search_path to 'public' as $$
  select coalesce((select least(_cfg('mkt_hi',2), greatest(_cfg('mkt_lo',0.5), m.mult * case when m.ev_until > now() then m.ev_mult else 1 end))
                   from market m where m.kind = p_kind and m.id = p_id), 1) $$;

create or replace function public._mkt_price(p_kind text, p_id text) returns numeric language sql stable set search_path to 'public' as $$
  select coalesce(_mkt_base(p_kind, p_id), 0) * _mkt_mult(p_kind, p_id) $$;

create or replace function public._mkt_sync() returns void language sql security definer set search_path to 'public' as $$
  insert into market(kind, id) select 'c', id from crops on conflict do nothing;
  insert into market(kind, id) select distinct 'g', good from animals where good is not null on conflict do nothing;
$$;

create or replace function public._mkt_sold(p_kind text, p_id text, p_q int) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(p_q, 0) <= 0 then return; end if;
  insert into market(kind, id, press) values (p_kind, p_id, p_q) on conflict (kind, id) do update set press = market.press + excluded.press;
end $$;

-- 玩家手上作物＋產品的平均行情（照價值加權），電腦玩家判斷要不要賣用
create or replace function public._mkt_avg(p_uid uuid) returns numeric language sql stable set search_path to 'public' as $$
  select coalesce(sum(q * b * m) / nullif(sum(q * b), 0), 1) from (
    select (e.value)::int q, _mkt_base('c', e.key) b, _mkt_mult('c', e.key) m from players p, jsonb_each_text(p.crops) e where p.id = p_uid
    union all
    select (e.value)::int, _mkt_base('g', e.key), _mkt_mult('g', e.key) from players p, jsonb_each_text(coalesce(p.goods,'{}')) e where p.id = p_uid) x
  where b is not null $$;

-- 突發事件（p_typ 空白＝隨機）
create or replace function public._mkt_event(p_typ text default null) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare typ text := p_typ; mon int := extract(month from now() at time zone 'Asia/Taipei'); items jsonb; title text; mult numeric; dur interval; nm text; ev market_events;
  veg text[] := array['radish','carrot','cabbage','corn','tomato','eggplant'];
  fruit text[] := array['strawberry','watermelon','grape','pineapple','peach','dragonfruit','melon','mango','pumpkin'];
  pick text[];
begin
  perform _mkt_sync();
  if typ is null then
    typ := (array['typhoon','harvest','shortage','breakfast'] || case when mon in (1,2) then array['newyear'] else '{}'::text[] end
                                                              || case when mon in (9,10) then array['midautumn'] else '{}'::text[] end)[1 + floor(random() * (4 + (mon in (1,2))::int + (mon in (9,10))::int))::int];
  end if;
  dur := make_interval(mins => (120 + floor(random() * 121))::int);
  if typ = 'typhoon' then
    items := (select jsonb_agg(jsonb_build_object('k','c','id',x)) from unnest(veg) x where exists(select 1 from crops where id = x));
    mult := 2; title := '🌀 颱風來襲！蔬菜收購價大漲';
  elsif typ = 'harvest' then
    select x into nm from unnest(fruit) x where exists(select 1 from crops where id = x) order by random() limit 1;
    items := jsonb_build_array(jsonb_build_object('k','c','id',nm)); mult := 0.5;
    title := '🧺 ' || (select name from crops where id = nm) || '大豐收，收購價腰斬';
  elsif typ = 'shortage' then
    pick := array(select id from crops where id <> all(array['gapple','rcorn','dberry','swmelon']) order by random() limit 2);
    items := (select jsonb_agg(jsonb_build_object('k','c','id',x)) from unnest(pick) x); mult := 1.8;
    title := '🛒 市場缺貨：' || (select string_agg(name, '、') from crops where id = any(pick)) || ' 收購價大漲';
  elsif typ = 'breakfast' then
    items := (select jsonb_agg(jsonb_build_object('k','g','id',x)) from unnest(array['egg','duck_egg','milk']) x where exists(select 1 from animals where good = x));
    mult := 1.8; title := '🥚 早餐店搶貨！蛋和牛奶收購價大漲';
  elsif typ = 'newyear' then
    items := (select jsonb_agg(jsonb_build_object('k','c','id',x)) from unnest(fruit) x where exists(select 1 from crops where id = x));
    mult := 1.6; title := '🧧 過年辦年貨，水果收購價上漲';
  elsif typ = 'midautumn' then
    items := (select jsonb_agg(jsonb_build_object('k','c','id',x)) from unnest(array['corn','eggplant','pumpkin']) x where exists(select 1 from crops where id = x));
    mult := 1.8; title := '🌕 中秋烤肉季，玉米、茄子、南瓜收購價大漲';
  else raise exception '沒有這種事件'; end if;
  if items is null then return null; end if;
  update market m set ev_mult = mult, ev_until = now() + dur
   where exists(select 1 from jsonb_array_elements(items) i where i->>'k' = m.kind and i->>'id' = m.id);
  insert into market_events(typ, title, items, mult, ends) values (typ, title, items, mult, now() + dur) returning * into ev;
  return to_jsonb(ev);
end $$;

-- 每小時：價格變動、記走勢、清賣壓、可能發生事件
create or replace function public._mkt_tick() returns void language plpgsql security definer set search_path to 'public' as $$
declare m market; t numeric; x numeric; lo numeric := _cfg('mkt_lo',0.5); hi numeric := _cfg('mkt_hi',2);
begin
  if not pg_try_advisory_xact_lock(771204) then return; end if;
  perform _mkt_sync();
  for m in select * from market for update loop
    t := m.trend * 0.75 + (random() - 0.5) * 2 * m.vol;                      -- 有趨勢：延續上一小時的走向，再加一點隨機
    x := m.mult * (1 + t);
    x := x + (1 - x) * 0.04;                                                -- 慢慢回到原價
    x := x * (1 - least(0.25, m.press / 100.0 * _cfg('mkt_press',0.02)));    -- 賣壓：大家都在賣就往下壓
    if x >= hi then x := hi; t := -abs(t) * 0.5; elsif x <= lo then x := lo; t := abs(t) * 0.5; end if;
    update market set mult = x, trend = t, press = 0,
      ev_mult = case when ev_until is null or ev_until <= now() then 1 else ev_mult end,
      ev_until = case when ev_until <= now() then null else ev_until end
     where kind = m.kind and id = m.id;
  end loop;
  insert into market_hist(kind, id, mult) select kind, id, _mkt_mult(kind, id) from market;
  delete from market_hist where at < now() - interval '48 hours';
  if _cfg('mkt_events',1) = 1 and not exists(select 1 from market_events where ends > now()) and random() < _cfg('mkt_event_rate',0.12) then
    perform _mkt_event(null);
  end if;
end $$;

-- 玩家看的行情：現價、漲跌、24 小時走勢、進行中的事件、倉庫資訊
create or replace function public.farm_market() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'items', (select coalesce(jsonb_agg(jsonb_build_object('k', m.kind, 'id', m.id, 'base', _mkt_base(m.kind, m.id), 'mult', round(_mkt_mult(m.kind, m.id), 3),
               'prev', (select round(h.mult, 3) from market_hist h where h.kind = m.kind and h.id = m.id and h.at < now() - interval '50 minutes' order by h.at desc limit 1),
               'hist', (select coalesce(jsonb_agg(round(h.mult, 3) order by h.at), '[]') from market_hist h where h.kind = m.kind and h.id = m.id and h.at > now() - interval '24 hours'),
               'ev', m.ev_until > now())), '[]') from market m where _mkt_base(m.kind, m.id) is not null),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'ends', _ms(e.ends)) order by e.starts desc), '[]') from market_events e where e.ends > now()),
    'barn', jsonb_build_object('lv', coalesce((select barn_lv from players where id = auth.uid()), 0),
                               'cap', _barn_cap((select barn_lv from players where id = auth.uid())),
                               'max', _cfg('barn_max',1000)::int,
                               'cost', (_cfg('barn_cost',5000) * power(2, coalesce((select barn_lv from players where id = auth.uid()), 0)))::bigint),
    'lo', _cfg('mkt_lo',0.5), 'hi', _cfg('mkt_hi',2))
$$;
grant execute on function public.farm_market() to authenticated, anon;

create or replace function public.farm_barn_upgrade() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); p players; cost bigint;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into p from players where id = uid for update;
  if _barn_cap(p.barn_lv) >= _cfg('barn_max',1000) then raise exception '倉庫已經升到最大了'; end if;
  cost := (_cfg('barn_cost',5000) * power(2, p.barn_lv))::bigint;
  if p.gold < cost then raise exception '金幣不夠，升級要 % 金', cost; end if;
  update players set gold = gold - cost, barn_lv = barn_lv + 1 where id = uid;
  return jsonb_build_object('cap', _barn_cap(p.barn_lv + 1), 'cost', cost, 'state', _state(uid));
end $$;
revoke all on function public.farm_barn_upgrade() from public, anon;
grant execute on function public.farm_barn_upgrade() to authenticated;

-- 倉庫上限：作物＋牧場產品變多、超過上限時，這次多出來的照現價自動賣掉（原本就超過的舊庫存不動）
create or replace function public._barn_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare tot int; old_tot int; cap int; over int; e record; q int; sold int := 0; got numeric := 0; prev jsonb;
begin
  tot := _jsum(new.crops) + _jsum(new.goods); old_tot := _jsum(old.crops) + _jsum(old.goods);
  if tot <= old_tot then return new; end if;
  cap := _barn_cap(new.barn_lv);
  over := tot - greatest(cap, old_tot);
  if over <= 0 then return new; end if;
  for e in select 'c' k, key, (value)::int nv, coalesce((old.crops->>key)::int, 0) ov from jsonb_each_text(coalesce(new.crops,'{}'))
           union all
           select 'g', key, (value)::int, coalesce((old.goods->>key)::int, 0) from jsonb_each_text(coalesce(new.goods,'{}')) loop
    exit when over <= 0;
    continue when e.nv <= e.ov;
    q := least(over, e.nv - e.ov);
    got := got + q * _mkt_price(e.k, e.key);
    if e.k = 'c' then new.crops := case when e.nv - q > 0 then jsonb_set(new.crops, array[e.key], to_jsonb(e.nv - q)) else new.crops - e.key end;
    else new.goods := case when e.nv - q > 0 then jsonb_set(new.goods, array[e.key], to_jsonb(e.nv - q)) else new.goods - e.key end; end if;
    perform _mkt_sold(e.k, e.key, q);
    over := over - q; sold := sold + q;
  end loop;
  if sold > 0 then
    new.gold := new.gold + ceil(got)::int;
    prev := coalesce(nullif(current_setting('farm.ovf', true), '')::jsonb, '{"n":0,"g":0}');
    perform set_config('farm.ovf', jsonb_build_object('n', (prev->>'n')::int + sold, 'g', (prev->>'g')::int + ceil(got)::int)::text, true);
  end if;
  return new;
end $$;
drop trigger if exists barn_guard on public.players;
create trigger barn_guard before update of crops, goods on public.players for each row execute function public._barn_guard();

-- 收購改照現價，並記賣壓
do $$
declare d text;
begin
  d := pg_get_functiondef('public.farm_act(text,integer,text,integer)'::regprocedure);
  if position('_mkt_price' in d) = 0 then
    if position('amt := ceil(v * c.price * _ev(''ev_gold''))::int;' in d) = 0 then raise exception 'farm_act sell 找不到'; end if;
    d := replace(d, 'amt := ceil(v * c.price * _ev(''ev_gold''))::int;',
                    'amt := ceil(v * _mkt_price(''c'', p_crop) * _ev(''ev_gold''))::int; perform _mkt_sold(''c'', p_crop, v);');
    if position('select coalesce(sum((e.value)::int * cr.price), 0) into amt from players pl cross join lateral jsonb_each_text(pl.crops) e join crops cr on cr.id = e.key where pl.id = uid;' in d) = 0 then raise exception 'farm_act sell_all 找不到'; end if;
    d := replace(d, 'select coalesce(sum((e.value)::int * cr.price), 0) into amt from players pl cross join lateral jsonb_each_text(pl.crops) e join crops cr on cr.id = e.key where pl.id = uid;',
                    'select coalesce(sum((e.value)::int * _mkt_price(''c'', cr.id)), 0) into amt from players pl cross join lateral jsonb_each_text(pl.crops) e join crops cr on cr.id = e.key where pl.id = uid;
    perform _mkt_sold(''c'', e.key, (e.value)::int) from players pl cross join lateral jsonb_each_text(pl.crops) e where pl.id = uid;');
    execute d;
  end if;
  d := pg_get_functiondef('public.farm_ranch_act(text,integer,text)'::regprocedure);
  if position('_mkt_price' in d) = 0 then
    if position('select coalesce(sum((e.value)::int * an.good_price), 0) into amt from players pl cross join lateral jsonb_each_text(pl.goods) e join animals an on an.good = e.key where pl.id = uid;' in d) = 0 then raise exception 'sell_goods 找不到'; end if;
    d := replace(d, 'select coalesce(sum((e.value)::int * an.good_price), 0) into amt from players pl cross join lateral jsonb_each_text(pl.goods) e join animals an on an.good = e.key where pl.id = uid;',
                    'select coalesce(sum((e.value)::int * _mkt_price(''g'', e.key)), 0) into amt from players pl cross join lateral jsonb_each_text(pl.goods) e where pl.id = uid and _mkt_base(''g'', e.key) is not null;
    perform _mkt_sold(''g'', e.key, (e.value)::int) from players pl cross join lateral jsonb_each_text(pl.goods) e where pl.id = uid;');
    execute d;
  end if;
  -- 電腦玩家：行情好就賣、行情差先囤（愛賭博的照樣收成就賣）；倉庫快滿了一定賣
  d := pg_get_functiondef('public._bot_act(bots)'::regprocedure);
  if position('_mkt_avg' in d) = 0 then
    if position('if (tot > 12 and random() < 0.6) or (gam and tot > 0 and random() < 0.95) then' in d) = 0 then raise exception '_bot_act 賣菜找不到'; end if;
    d := replace(d, 'if (tot > 12 and random() < 0.6) or (gam and tot > 0 and random() < 0.95) then',
                    'if (gam and tot > 0 and random() < 0.95) or (tot > 12 and random() < (case when _mkt_avg(b.id) >= 1.15 then 0.9 when _mkt_avg(b.id) <= 0.85 then 0.15 else 0.5 end)) or tot > _barn_cap(me.barn_lv) * 0.85 then');
    execute d;
  end if;
  -- 狀態加上倉庫資訊；這次動作有多出來被自動賣掉的話也帶回去
  d := pg_get_functiondef('public._state(uuid)'::regprocedure);
  if position('barn_cap' in d) = 0 then
    if position('''nick_changes'', p.nick_changes)' in d) = 0 then raise exception '_state 找不到'; end if;
    d := replace(d, '''nick_changes'', p.nick_changes)',
      '''nick_changes'', p.nick_changes) || jsonb_build_object(''barn_lv'', p.barn_lv, ''barn_cap'', _barn_cap(p.barn_lv), ''ovf'', nullif(current_setting(''farm.ovf'', true), '''')::jsonb)');
    execute d;
  end if;
  -- 跑馬燈加上行情事件
  d := pg_get_functiondef('public.farm_ticker()'::regprocedure);
  if position('market_events' in d) = 0 then
    d := replace(d, '    union all
    (select jsonb_build_object(''t'', _ms(s.created_at), ''k'', ''shout''',
      '    union all
    (select jsonb_build_object(''t'', _ms(e.starts), ''k'', ''mkt'', ''m'', e.title) from market_events e where e.ends > now() order by e.starts desc limit 3)
    union all
    (select jsonb_build_object(''t'', _ms(s.created_at), ''k'', ''shout''');
    if position('market_events' in d) = 0 then raise exception 'farm_ticker 改寫失敗'; end if;
    execute d;
  end if;
end $$;

-- 後台
create or replace function public.adm_market() returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  perform _adm();
  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(jsonb_build_object('k', m.kind, 'id', m.id,
               'name', coalesce((select name from crops where id = m.id and m.kind = 'c'), (select max(good_name) from animals where good = m.id and m.kind = 'g'), m.id),
               'base', _mkt_base(m.kind, m.id), 'mult', round(_mkt_mult(m.kind, m.id), 3), 'vol', m.vol, 'ev', m.ev_until > now(),
               'hist', (select coalesce(jsonb_agg(round(h.mult, 3) order by h.at), '[]') from market_hist h where h.kind = m.kind and h.id = m.id and h.at > now() - interval '48 hours'))
               order by m.kind, _mkt_base(m.kind, m.id)), '[]') from market m where _mkt_base(m.kind, m.id) is not null),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'starts', _ms(e.starts), 'ends', _ms(e.ends)) order by e.starts desc), '[]')
               from (select * from market_events order by starts desc limit 10) e));
end $$;
create or replace function public.adm_market_vol(p_kind text, p_id text, p_vol numeric) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  update market set vol = least(0.5, greatest(0, p_vol)) where kind = p_kind and id = p_id;
  perform _adm_log(a, 'market_vol', jsonb_build_object('k', p_kind, 'id', p_id, 'vol', p_vol));
  return adm_market();
end $$;
create or replace function public.adm_market_event(p_typ text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  update market set ev_mult = 1, ev_until = null where ev_until > now();
  update market_events set ends = now() where ends > now();
  if p_typ is not null and p_typ <> 'stop' then perform _mkt_event(p_typ); end if;
  perform _adm_log(a, 'market_event', jsonb_build_object('typ', p_typ));
  return adm_market();
end $$;

-- 開始：建好每種東西的行情，先記一筆走勢
select public._mkt_sync();
insert into market_hist(kind, id, mult) select kind, id, 1 from market;
