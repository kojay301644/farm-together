-- 一起種田吧：資料表、權限、遊戲邏輯
-- 所有遊戲動作都走伺服器函式（security definer），資料表本身不開放直接讀寫

-- ========== 作物表（參考資料） ==========
create table public.crops(
  id text primary key,
  name text not null,
  lv int not null,
  seed int not null,
  grow_sec int not null,
  yield int not null,
  price int not null,
  exp int not null,
  sort int not null
);
insert into public.crops values
 ('radish','白蘿蔔',1,10,120,8,3,4,1),
 ('carrot','紅蘿蔔',1,16,300,10,3,6,2),
 ('cabbage','高麗菜',2,30,900,10,6,10,3),
 ('corn','玉米',3,50,1800,12,7,16,4),
 ('tomato','番茄',4,80,3600,14,9,24,5),
 ('eggplant','茄子',5,110,7200,14,12,32,6),
 ('strawberry','草莓',6,160,10800,16,15,45,7),
 ('pumpkin','南瓜',7,220,14400,12,28,60,8),
 ('watermelon','西瓜',8,300,21600,10,48,80,9),
 ('grape','葡萄',9,400,28800,16,38,110,10);

-- ========== 1. 玩家 ==========
create table public.players(
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 10),
  lv int not null default 1,
  exp int not null default 0,
  gold int not null default 300 check (gold >= 0),
  seeds jsonb not null default '{"radish":4}'::jsonb,
  crops jsonb not null default '{}'::jsonb,
  prank_day date,
  prank_cnt int not null default 0,
  created_at timestamptz not null default now()
);
create unique index players_nick_uq on public.players (lower(nickname));

-- ========== 2. 田地 ==========
create table public.plots(
  owner uuid not null references public.players(id) on delete cascade,
  idx int not null,
  state text not null default 'empty' check (state in ('wild','empty','grow','dead')),
  crop text references public.crops(id),
  grown real not null default 0,
  wet_until timestamptz,
  last_tick timestamptz,
  weeds int not null default 0,
  bugs int not null default 0,
  stolen int not null default 0,
  planted_at timestamptz,
  primary key (owner, idx)
);

-- ========== 3. 好友 ==========
create table public.friends(
  from_id uuid not null references public.players(id) on delete cascade,
  to_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index friends_to_idx on public.friends(to_id);

-- ========== 4. 農場動態 ==========
create table public.farm_logs(
  id bigserial primary key,
  owner uuid not null references public.players(id) on delete cascade,
  actor uuid,
  actor_name text,
  kind text not null,
  crop text,
  qty int,
  created_at timestamptz not null default now()
);
create index farm_logs_owner_idx on public.farm_logs(owner, created_at desc);

-- ========== 5. 偷菜紀錄（每塊地每輪每人限一次） ==========
create table public.steals(
  owner uuid not null references public.players(id) on delete cascade,
  idx int not null,
  thief uuid not null references public.players(id) on delete cascade,
  planted_at timestamptz not null,
  qty int not null,
  created_at timestamptz not null default now(),
  primary key (owner, idx, thief, planted_at)
);
create index steals_thief_idx on public.steals(thief);

-- ========== 權限：全部開 RLS，只有作物表可讀 ==========
alter table public.crops enable row level security;
alter table public.players enable row level security;
alter table public.plots enable row level security;
alter table public.friends enable row level security;
alter table public.farm_logs enable row level security;
alter table public.steals enable row level security;
create policy crops_read on public.crops for select to anon, authenticated using (true);
revoke insert, update, delete on public.crops from anon, authenticated;
revoke all on public.players, public.plots, public.friends, public.farm_logs, public.steals from anon, authenticated;

-- ========== 內部工具函式 ==========
create or replace function public._wetdur(sec int) returns double precision
language sql immutable set search_path = public as $$ select least(3600, greatest(45, sec*0.3))::double precision $$;

create or replace function public._is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from friends where status='accepted' and ((from_id=a and to_id=b) or (from_id=b and to_id=a)))
$$;

-- 依伺服器時間推進某位玩家所有田地的生長，並隨機長草長蟲
create or replace function public._tick(p_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record; c record; nowt timestamptz := now();
  el double precision; wet double precision; dry double precision; gu double precision; g double precision;
  frac double precision; eff double precision; chunk double precision; ivl double precision;
  n int; k int; w int; b int;
begin
  for r in select * from plots where owner = p_owner and state = 'grow' for update loop
    select * into c from crops where id = r.crop;
    if r.grown >= c.grow_sec or r.last_tick is null then
      update plots set last_tick = nowt where owner = p_owner and idx = r.idx;
      continue;
    end if;
    el := greatest(0, extract(epoch from nowt - r.last_tick));
    wet := least(el, greatest(0, extract(epoch from coalesce(r.wet_until, r.last_tick) - r.last_tick)));
    dry := el - wet;
    gu := r.grown + wet + dry * 0.5;              -- 缺水時生長速度減半
    g := least(c.grow_sec, gu);
    w := r.weeds; b := r.bugs;
    if g / c.grow_sec >= 0.1 and el > 0 then
      frac := case when gu > c.grow_sec then (c.grow_sec - r.grown) / (gu - r.grown) else 1 end;
      eff := el * frac;
      ivl := greatest(90, c.grow_sec / 3.0);
      n := least(200, greatest(1, ceil(eff / 30)::int));
      chunk := eff / n;
      for k in 1..n loop
        if random() < chunk / ivl then
          if random() < 0.5 then w := least(3, w + 1); else b := least(3, b + 1); end if;
        end if;
      end loop;
    end if;
    update plots set grown = g, weeds = w, bugs = b, last_tick = nowt where owner = p_owner and idx = r.idx;
  end loop;
end $$;

create or replace function public._add_exp(p_uid uuid, p_n int) returns void
language plpgsql security definer set search_path = public as $$
declare l int; e int;
begin
  update players set exp = exp + p_n where id = p_uid returning lv, exp into l, e;
  while l < 30 and e >= 30*l*l loop e := e - 30*l*l; l := l + 1; end loop;
  update players set lv = l, exp = e where id = p_uid;
end $$;

create or replace function public._ms(t timestamptz) returns bigint
language sql immutable set search_path = public as $$ select (extract(epoch from t)*1000)::bigint $$;

create or replace function public._prank_left(p public.players) returns int
language sql stable set search_path = public as $$
  select case when p.prank_day = (now() at time zone 'Asia/Taipei')::date then greatest(0, 10 - p.prank_cnt) else 10 end
$$;

-- 田地 JSON（viewer 不為 null 時標記「我是否已偷過」與可偷數）
create or replace function public._plots_json(p_owner uuid, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'i', p.idx, 's', p.state, 'c', p.crop, 'g', p.grown,
      'wu', _ms(p.wet_until), 't', _ms(p.last_tick), 'w', p.weeds, 'b', p.bugs, 'st', p.stolen,
      'mine', case when p_viewer is null then false else exists(select 1 from steals s where s.owner=p.owner and s.idx=p.idx and s.thief=p_viewer and s.planted_at=p.planted_at) end,
      'cap', case when p.state='grow' then floor(greatest(ceil(c.yield*0.6), c.yield-p.weeds-p.bugs)*0.4)::int else 0 end
    ) order by p.idx), '[]'::jsonb)
  from plots p left join crops c on c.id = p.crop
  where p.owner = p_owner
$$;

create or replace function public._state(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'now', _ms(now()),
    'me', jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv, 'exp', p.exp, 'gold', p.gold,
                             'seeds', p.seeds, 'crops', p.crops, 'prank_left', _prank_left(p)),
    'plots', _plots_json(p.id, null))
  from players p where p.id = p_uid
$$;

-- ========== 玩家可呼叫的函式 ==========
create or replace function public.farm_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if not exists(select 1 from players where id = uid) then return null; end if;
  perform _tick(uid);
  return _state(uid);
end $$;

create or replace function public.farm_create(p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nick text := btrim(p_nick);
begin
  if uid is null then raise exception '請先登入'; end if;
  if exists(select 1 from players where id = uid) then return _state(uid); end if;
  if char_length(nick) < 1 or char_length(nick) > 10 then raise exception '暱稱要 1～10 個字'; end if;
  if nick ~ '[<>&"]' then raise exception '暱稱不能包含特殊符號'; end if;
  if exists(select 1 from players where lower(nickname) = lower(nick)) then raise exception '這個暱稱已經有人用了'; end if;
  insert into players(id, nickname) values (uid, nick);
  insert into plots(owner, idx, state) select uid, i, case when i >= 4 then 'wild' else 'empty' end from generate_series(0,5) i;
  return _state(uid);
end $$;

-- 自己農場的所有動作
create or replace function public.farm_act(p_action text, p_idx int default null, p_crop text default null, p_n int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me players; p plots; c crops;
  amt int := 0; xp int := 0; base int; oldlv int; cost int; v int;
  wild_cost int[] := array[0,0,0,0,100,300]; wild_lv int[] := array[1,1,1,1,1,2];
begin
  if uid is null then raise exception '請先登入'; end if;
  select * into me from players where id = uid for update;
  if not found then raise exception '找不到玩家資料'; end if;
  oldlv := me.lv;
  perform _tick(uid);

  if p_action in ('plant','water','weed','bug','harvest','clear','till','dig') then
    select * into p from plots where owner = uid and idx = p_idx for update;
    if not found then raise exception '找不到這塊地'; end if;
    if p.state = 'grow' then select * into c from crops where id = p.crop; end if;
  end if;

  if p_action = 'plant' then
    if p.state <> 'empty' then raise exception '這塊地不能播種'; end if;
    select * into c from crops where id = p_crop;
    if not found then raise exception '沒有這種作物'; end if;
    v := coalesce((me.seeds->>p_crop)::int, 0);
    if v < 1 then raise exception '沒有%的種子', c.name; end if;
    update players set seeds = case when v-1 > 0 then jsonb_set(seeds, array[p_crop], to_jsonb(v-1)) else seeds - p_crop end where id = uid;
    update plots set state='grow', crop=p_crop, grown=0, wet_until=now() + make_interval(secs => _wetdur(c.grow_sec)),
      last_tick=now(), weeds=0, bugs=0, stolen=0, planted_at=now() where owner=uid and idx=p_idx;

  elsif p_action = 'water' then
    if p.state <> 'grow' or p.grown >= c.grow_sec then raise exception '這塊地不需要澆水'; end if;
    if p.wet_until > now() then raise exception '土壤還很濕潤，晚點再澆'; end if;
    update plots set wet_until = now() + make_interval(secs => _wetdur(c.grow_sec)) where owner=uid and idx=p_idx;
    xp := 1;

  elsif p_action = 'weed' then
    if p.state <> 'grow' or p.weeds < 1 then raise exception '這裡沒有雜草'; end if;
    update plots set weeds = weeds - 1 where owner=uid and idx=p_idx; xp := 2;

  elsif p_action = 'bug' then
    if p.state <> 'grow' or p.bugs < 1 then raise exception '這裡沒有蟲'; end if;
    update plots set bugs = bugs - 1 where owner=uid and idx=p_idx; xp := 2;

  elsif p_action = 'harvest' then
    if p.state <> 'grow' or p.grown < c.grow_sec then raise exception '作物還沒成熟'; end if;
    base := greatest(ceil(c.yield*0.6)::int, c.yield - p.weeds - p.bugs);
    amt := greatest(1, base - p.stolen);
    update players set crops = jsonb_set(crops, array[c.id], to_jsonb(coalesce((crops->>c.id)::int,0) + amt)) where id = uid;
    update plots set state='dead', weeds=0, bugs=0, wet_until=null where owner=uid and idx=p_idx;
    xp := c.exp;

  elsif p_action = 'clear' then
    if p.state <> 'dead' then raise exception '沒有需要剷除的作物'; end if;
    update plots set state='empty', crop=null, grown=0, stolen=0, planted_at=null where owner=uid and idx=p_idx; xp := 1;

  elsif p_action = 'dig' then
    if p.state <> 'grow' then raise exception '這塊地沒有作物'; end if;
    update plots set state='empty', crop=null, grown=0, stolen=0, weeds=0, bugs=0, planted_at=null, wet_until=null where owner=uid and idx=p_idx;

  elsif p_action = 'till' then
    if p.state <> 'wild' then raise exception '這塊地不是荒地'; end if;
    if me.lv < wild_lv[p_idx+1] then raise exception '需要 Lv% 才能開墾', wild_lv[p_idx+1]; end if;
    cost := wild_cost[p_idx+1];
    if me.gold < cost then raise exception '金幣不夠喔'; end if;
    update players set gold = gold - cost where id = uid;
    update plots set state='empty' where owner=uid and idx=p_idx; xp := 5;

  elsif p_action = 'buy' then
    select * into c from crops where id = p_crop;
    if not found then raise exception '沒有這種作物'; end if;
    if me.lv < c.lv then raise exception '需要 Lv% 才能買%', c.lv, c.name; end if;
    if p_n is null or p_n < 1 or p_n > 99 then raise exception '數量不正確'; end if;
    cost := c.seed * p_n;
    if me.gold < cost then raise exception '金幣不夠喔'; end if;
    update players set gold = gold - cost,
      seeds = jsonb_set(seeds, array[c.id], to_jsonb(coalesce((seeds->>c.id)::int,0) + p_n)) where id = uid;
    amt := p_n;

  elsif p_action = 'sell' then
    select * into c from crops where id = p_crop;
    v := coalesce((me.crops->>p_crop)::int, 0);
    if v < 1 or c.id is null then raise exception '沒有可以賣的作物'; end if;
    amt := v * c.price;
    update players set gold = gold + amt, crops = crops - p_crop where id = uid;

  elsif p_action = 'sell_all' then
    select coalesce(sum((e.value)::int * cr.price), 0) into amt from jsonb_each_text(me.crops) e join crops cr on cr.id = e.key;
    update players set gold = gold + amt, crops = '{}'::jsonb where id = uid;

  else
    raise exception '未知的動作';
  end if;

  if xp > 0 then perform _add_exp(uid, xp); end if;
  return jsonb_build_object('amt', amt, 'xp', xp, 'lvup', (select lv from players where id = uid) > oldlv, 'state', _state(uid));
end $$;

-- ========== 好友 ==========
create or replace function public.farm_friend_request(p_nick text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t players; f friends;
begin
  if uid is null then raise exception '請先登入'; end if;
  select * into t from players where lower(nickname) = lower(btrim(p_nick));
  if not found then raise exception '找不到這位玩家'; end if;
  if t.id = uid then raise exception '不能加自己為好友'; end if;
  select * into f from friends where (from_id=uid and to_id=t.id) or (from_id=t.id and to_id=uid) limit 1;
  if found then
    if f.status = 'accepted' then return '你們已經是好友了'; end if;
    if f.from_id = t.id then
      update friends set status='accepted' where from_id=t.id and to_id=uid;
      return '你們成為好友了！';
    end if;
    return '已經送出邀請，等對方確認';
  end if;
  if (select count(*) from friends where from_id=uid and status='pending') >= 50 then raise exception '送出的邀請太多了'; end if;
  insert into friends(from_id, to_id) values (uid, t.id);
  return '已送出好友邀請給 ' || t.nickname;
end $$;

create or replace function public.farm_friend_respond(p_from uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if p_accept then
    update friends set status='accepted' where from_id=p_from and to_id=uid and status='pending';
    if not found then raise exception '找不到這個邀請'; end if;
    return '你們成為好友了！';
  else
    delete from friends where from_id=p_from and to_id=uid and status='pending';
    return '已拒絕邀請';
  end if;
end $$;

create or replace function public.farm_friend_remove(p_other uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  delete from friends where (from_id=uid and to_id=p_other) or (from_id=p_other and to_id=uid);
  return '已移除好友';
end $$;

create or replace function public.farm_friends() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); fid uuid;
begin
  if uid is null then raise exception '請先登入'; end if;
  for fid in select case when from_id=uid then to_id else from_id end from friends
             where status='accepted' and (from_id=uid or to_id=uid) loop
    perform _tick(fid);
  end loop;
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv,
        'ripe', (select count(*) from plots pl join crops c on c.id=pl.crop
                 where pl.owner=p.id and pl.state='grow' and pl.grown >= c.grow_sec
                   and pl.stolen < floor(greatest(ceil(c.yield*0.6), c.yield-pl.weeds-pl.bugs)*0.4)
                   and not exists(select 1 from steals s where s.owner=pl.owner and s.idx=pl.idx and s.thief=uid and s.planted_at=pl.planted_at)),
        'issues', (select coalesce(sum(pl.weeds+pl.bugs),0) from plots pl where pl.owner=p.id and pl.state='grow'))
      order by p.lv desc, p.nickname)
      from players p where p.id in (select case when from_id=uid then to_id else from_id end from friends
                                    where status='accepted' and (from_id=uid or to_id=uid))), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv))
      from friends f join players p on p.id=f.from_id where f.to_id=uid and f.status='pending'), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv))
      from friends f join players p on p.id=f.to_id where f.from_id=uid and f.status='pending'), '[]'::jsonb)
  );
end $$;

-- ========== 拜訪好友農場 ==========
create or replace function public.farm_visit(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if not _is_friend(uid, p_owner) then raise exception '你們還不是好友'; end if;
  perform _tick(p_owner);
  return jsonb_build_object('now', _ms(now()),
    'owner', (select jsonb_build_object('id', id, 'nickname', nickname, 'lv', lv) from players where id = p_owner),
    'plots', _plots_json(p_owner, uid));
end $$;

create or replace function public.farm_friend_act(p_owner uuid, p_action text, p_idx int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me players; p plots; c crops;
  base int; cap int; q int := 0; xp int := 0; oldlv int;
begin
  if uid is null then raise exception '請先登入'; end if;
  if not _is_friend(uid, p_owner) then raise exception '你們還不是好友'; end if;
  select * into me from players where id = uid for update;
  oldlv := me.lv;
  perform _tick(p_owner);
  select * into p from plots where owner = p_owner and idx = p_idx for update;
  if not found then raise exception '找不到這塊地'; end if;
  if p.state = 'grow' then select * into c from crops where id = p.crop; end if;

  if p_action = 'steal' then
    if p.state <> 'grow' or p.grown < c.grow_sec then raise exception '還沒有成熟的作物可以偷'; end if;
    if exists(select 1 from steals where owner=p_owner and idx=p_idx and thief=uid and planted_at=p.planted_at) then
      raise exception '這塊地你已經偷過了'; end if;
    base := greatest(ceil(c.yield*0.6)::int, c.yield - p.weeds - p.bugs);
    cap := floor(base*0.4)::int;
    if p.stolen >= cap then raise exception '這塊地已經被偷光了，留點給主人吧'; end if;
    q := least(cap - p.stolen, 1 + floor(random()*2)::int);
    update plots set stolen = stolen + q where owner=p_owner and idx=p_idx;
    insert into steals(owner, idx, thief, planted_at, qty) values (p_owner, p_idx, uid, p.planted_at, q);
    update players set crops = jsonb_set(crops, array[c.id], to_jsonb(coalesce((crops->>c.id)::int,0) + q)) where id = uid;
    insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, uid, me.nickname, 'steal', c.id, q);
    xp := 1;

  elsif p_action in ('help_weed','help_bug') then
    if p.state <> 'grow' then raise exception '這塊地沒有作物'; end if;
    if p_action = 'help_weed' then
      if p.weeds < 1 then raise exception '這裡沒有雜草'; end if;
      update plots set weeds = weeds - 1 where owner=p_owner and idx=p_idx;
    else
      if p.bugs < 1 then raise exception '這裡沒有蟲'; end if;
      update plots set bugs = bugs - 1 where owner=p_owner and idx=p_idx;
    end if;
    insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, p_action, p.crop);
    xp := 2;

  elsif p_action in ('prank_weed','prank_bug') then
    if p.state <> 'grow' or p.grown >= c.grow_sec then raise exception '只能在還沒成熟的作物上惡作劇'; end if;
    if _prank_left(me) < 1 then raise exception '今天的惡作劇次數用完了'; end if;
    if p_action = 'prank_weed' then
      if p.weeds >= 3 then raise exception '這裡的草已經夠多了'; end if;
      update plots set weeds = weeds + 1 where owner=p_owner and idx=p_idx;
    else
      if p.bugs >= 3 then raise exception '這裡的蟲已經夠多了'; end if;
      update plots set bugs = bugs + 1 where owner=p_owner and idx=p_idx;
    end if;
    update players set prank_cnt = case when prank_day = (now() at time zone 'Asia/Taipei')::date then prank_cnt + 1 else 1 end,
                       prank_day = (now() at time zone 'Asia/Taipei')::date where id = uid;
    insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, p_action, p.crop);
  else
    raise exception '未知的動作';
  end if;

  if xp > 0 then perform _add_exp(uid, xp); end if;
  return jsonb_build_object('qty', q, 'xp', xp, 'lvup', (select lv from players where id = uid) > oldlv,
    'state', _state(uid),
    'visit', jsonb_build_object('now', _ms(now()),
      'owner', (select jsonb_build_object('id', id, 'nickname', nickname, 'lv', lv) from players where id = p_owner),
      'plots', _plots_json(p_owner, uid)));
end $$;

create or replace function public.farm_logs_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('who', actor_name, 'kind', kind, 'crop', crop, 'qty', qty, 'at', _ms(created_at)) x
    from farm_logs where owner = uid order by created_at desc limit 40) s), '[]'::jsonb);
end $$;

-- ========== 函式權限 ==========
revoke execute on all functions in schema public from public, anon;
grant execute on function public.farm_me(), public.farm_create(text), public.farm_act(text,int,text,int),
  public.farm_friend_request(text), public.farm_friend_respond(uuid,boolean), public.farm_friend_remove(uuid),
  public.farm_friends(), public.farm_visit(uuid), public.farm_friend_act(uuid,text,int), public.farm_logs_get()
  to authenticated;
revoke execute on function public._tick(uuid), public._add_exp(uuid,int), public._state(uuid),
  public._plots_json(uuid,uuid), public._is_friend(uuid,uuid) from authenticated;
