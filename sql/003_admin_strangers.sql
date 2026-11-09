-- 一起種田吧：營運後台、陌生人偷菜、鑽石欄位
-- （不含 drop / revoke，避免被確認機制擋下）

-- ========== A. 資料表 ==========
alter table public.players add column if not exists banned boolean not null default false;
alter table public.players add column if not exists ban_reason text;
alter table public.players add column if not exists last_seen timestamptz;
alter table public.players add column if not exists gems int not null default 0;
alter table public.players add column if not exists steal_day date;
alter table public.players add column if not exists steal_cnt int not null default 0;

create table if not exists public.admins(user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table if not exists public.settings(key text primary key, value jsonb not null, note text, updated_at timestamptz not null default now());
create table if not exists public.notices(id bigserial primary key, title text not null, body text not null, active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.changelog(id bigserial primary key, title text not null, body text not null, created_at timestamptz not null default now());
create table if not exists public.admin_log(id bigserial primary key, admin uuid, action text not null, detail jsonb, created_at timestamptz not null default now());
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.notices enable row level security;
alter table public.changelog enable row level security;
alter table public.admin_log enable row level security;

insert into public.admins(user_id) values ('5c015be5-b8fa-4b6c-bf75-2ed4f5d97362') on conflict do nothing;
insert into public.settings(key, value, note) values
 ('steal_ratio', '0.4', '每塊地最多被偷走的比例'),
 ('newbie_lv', '3', '新手保護：這個等級以下不會被陌生人偷或惡作劇'),
 ('stranger_steal_daily', '30', '每天最多偷陌生人幾次'),
 ('prank_daily', '10', '每天惡作劇次數')
on conflict (key) do nothing;
create index if not exists steals_created_idx on public.steals(created_at);

-- ========== B. 工具函式 ==========
create or replace function public._cfg(k text, d numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from settings where key = k), d)
$$;
create or replace function public._is_admin(u uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists(select 1 from admins where user_id = u) $$;
create or replace function public._guard(u uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare b boolean; r text;
begin
  select banned, ban_reason into b, r from players where id = u;
  if b then raise exception '帳號已被停權%', coalesce('：' || r, ''); end if;
end $$;
create or replace function public._cap(c crops, w int, b int) returns int
language sql stable security definer set search_path = public as $$
  select floor(greatest(ceil(c.yield*0.6), c.yield - w - b) * _cfg('steal_ratio', 0.4))::int
$$;
create or replace function public._prank_left(p public.players) returns int
language sql stable set search_path = public as $$
  select case when p.prank_day = (now() at time zone 'Asia/Taipei')::date then greatest(0, _cfg('prank_daily',10)::int - p.prank_cnt) else _cfg('prank_daily',10)::int end
$$;
create or replace function public._steal_left(p public.players) returns int
language sql stable set search_path = public as $$
  select case when p.steal_day = (now() at time zone 'Asia/Taipei')::date then greatest(0, _cfg('stranger_steal_daily',30)::int - p.steal_cnt) else _cfg('stranger_steal_daily',30)::int end
$$;

create or replace function public._plots_json(p_owner uuid, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'i', p.idx, 's', p.state, 'c', p.crop, 'g', p.grown,
      'wu', _ms(p.wet_until), 't', _ms(p.last_tick), 'w', p.weeds, 'b', p.bugs, 'st', p.stolen,
      'mine', case when p_viewer is null then false else exists(select 1 from steals s where s.owner=p.owner and s.idx=p.idx and s.thief=p_viewer and s.planted_at=p.planted_at) end,
      'cap', case when p.state='grow' then _cap(c, p.weeds, p.bugs) else 0 end
    ) order by p.idx), '[]'::jsonb)
  from plots p left join crops c on c.id = p.crop
  where p.owner = p_owner
$$;

create or replace function public._state(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'now', _ms(now()),
    'me', jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv, 'exp', p.exp, 'gold', p.gold, 'gems', p.gems,
                             'seeds', p.seeds, 'crops', p.crops, 'prank_left', _prank_left(p), 'steal_left', _steal_left(p),
                             'admin', _is_admin(p.id)),
    'plots', _plots_json(p.id, null))
  from players p where p.id = p_uid
$$;

-- ========== C. 玩家函式 ==========
create or replace function public.farm_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if not exists(select 1 from players where id = uid) then return null; end if;
  perform _guard(uid);
  update players set last_seen = now() where id = uid and (last_seen is null or last_seen < now() - interval '1 minute');
  perform _tick(uid);
  return _state(uid);
end $$;

create or replace function public.farm_act(p_action text, p_idx int default null, p_crop text default null, p_n int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me players; p plots; c crops; ld land;
  amt int := 0; xp int := 0; base int; oldlv int; cost int; v int;
begin
  if uid is null then raise exception '請先登入'; end if;
  select * into me from players where id = uid for update;
  if not found then raise exception '找不到玩家資料'; end if;
  perform _guard(uid);
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
    select * into ld from land where idx = p_idx;
    if not found then raise exception '這塊地不能開墾'; end if;
    if me.lv < ld.lv then raise exception '需要 Lv% 才能開墾', ld.lv; end if;
    if me.gold < ld.cost then raise exception '金幣不夠喔'; end if;
    update players set gold = gold - ld.cost where id = uid;
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

create or replace function public.farm_notices() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'at', _ms(created_at)) order by id desc), '[]'::jsonb)
  from notices where active
$$;

create or replace function public.farm_visit(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o players; fr boolean;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into o from players where id = p_owner;
  if not found then raise exception '找不到這位玩家'; end if;
  if p_owner = uid then raise exception '這是你自己的農場'; end if;
  fr := _is_friend(uid, p_owner);
  perform _tick(p_owner);
  return jsonb_build_object('now', _ms(now()),
    'owner', jsonb_build_object('id', o.id, 'nickname', o.nickname, 'lv', o.lv),
    'friend', fr,
    'protected', (not fr) and o.lv <= _cfg('newbie_lv',3),
    'plots', _plots_json(p_owner, uid));
end $$;

create or replace function public.farm_friend_act(p_owner uuid, p_action text, p_idx int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me players; o players; p plots; c crops;
  cap int; q int := 0; xp int := 0; oldlv int; fr boolean; prot boolean; today date := (now() at time zone 'Asia/Taipei')::date;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  if p_owner = uid then raise exception '這是你自己的農場'; end if;
  select * into o from players where id = p_owner;
  if not found then raise exception '找不到這位玩家'; end if;
  fr := _is_friend(uid, p_owner);
  prot := (not fr) and o.lv <= _cfg('newbie_lv',3);
  select * into me from players where id = uid for update;
  oldlv := me.lv;
  perform _tick(p_owner);
  select * into p from plots where owner = p_owner and idx = p_idx for update;
  if not found then raise exception '找不到這塊地'; end if;
  if p.state = 'grow' then select * into c from crops where id = p.crop; end if;

  if p_action in ('help_weed','help_bug','help_water') and not fr then raise exception '只有好友才能幫忙'; end if;
  if p_action in ('steal','prank_weed','prank_bug') and prot then raise exception '對方還在新手保護中（Lv%以下），不能偷菜或惡作劇', _cfg('newbie_lv',3)::int; end if;

  if p_action = 'steal' then
    if p.state <> 'grow' or p.grown < c.grow_sec then raise exception '還沒有成熟的作物可以偷'; end if;
    if exists(select 1 from steals where owner=p_owner and idx=p_idx and thief=uid and planted_at=p.planted_at) then
      raise exception '這塊地你已經偷過了'; end if;
    if not fr and _steal_left(me) < 1 then raise exception '今天偷陌生人的次數用完了，明天再來'; end if;
    cap := _cap(c, p.weeds, p.bugs);
    if p.stolen >= cap then raise exception '這塊地已經被偷光了，留點給主人吧'; end if;
    q := least(cap - p.stolen, 1 + floor(random()*2)::int);
    update plots set stolen = stolen + q where owner=p_owner and idx=p_idx;
    insert into steals(owner, idx, thief, planted_at, qty) values (p_owner, p_idx, uid, p.planted_at, q);
    update players set crops = jsonb_set(crops, array[c.id], to_jsonb(coalesce((crops->>c.id)::int,0) + q)) where id = uid;
    if not fr then
      update players set steal_cnt = case when steal_day = today then steal_cnt + 1 else 1 end, steal_day = today where id = uid;
    end if;
    insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, uid, me.nickname, 'steal', c.id, q);
    xp := 1;
  elsif p_action in ('help_weed','help_bug','help_water') then
    if p.state <> 'grow' then raise exception '這塊地沒有作物'; end if;
    if p_action = 'help_weed' then
      if p.weeds < 1 then raise exception '這裡沒有雜草'; end if;
      update plots set weeds = weeds - 1 where owner=p_owner and idx=p_idx;
    elsif p_action = 'help_bug' then
      if p.bugs < 1 then raise exception '這裡沒有蟲'; end if;
      update plots set bugs = bugs - 1 where owner=p_owner and idx=p_idx;
    else
      if p.grown >= c.grow_sec then raise exception '已經成熟了，不用澆水'; end if;
      if p.wet_until > now() then raise exception '土壤還很濕潤'; end if;
      update plots set wet_until = now() + make_interval(secs => _wetdur(c.grow_sec)) where owner=p_owner and idx=p_idx;
    end if;
    insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, p_action, p.crop);
    xp := case when p_action = 'help_water' then 1 else 2 end;
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
    update players set prank_cnt = case when prank_day = today then prank_cnt + 1 else 1 end, prank_day = today where id = uid;
    insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, p_action, p.crop);
  else
    raise exception '未知的動作';
  end if;

  if xp > 0 then perform _add_exp(uid, xp); end if;
  return jsonb_build_object('qty', q, 'xp', xp, 'lvup', (select lv from players where id = uid) > oldlv,
    'state', _state(uid), 'visit', farm_visit(p_owner));
end $$;

create or replace function public.farm_neighbors() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; ids uuid[];
begin
  if uid is null then raise exception '請先登入'; end if;
  ids := array(select p.id from players p where p.id <> uid and not p.banned and p.lv > _cfg('newbie_lv',3)
               and exists(select 1 from plots pl where pl.owner = p.id and pl.state = 'grow')
               order by random() limit 25);
  foreach cid in array ids loop perform _tick(cid); end loop;
  return coalesce((select jsonb_agg(x order by (x->>'ripe')::int desc) from (
    select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv, 'friend', _is_friend(uid, p.id),
      'ripe', (select count(*) from plots pl join crops c on c.id = pl.crop
               where pl.owner = p.id and pl.state = 'grow' and pl.grown >= c.grow_sec and pl.stolen < _cap(c, pl.weeds, pl.bugs)
                 and not exists(select 1 from steals s where s.owner=pl.owner and s.idx=pl.idx and s.thief=uid and s.planted_at=pl.planted_at))) x
    from players p where p.id = any(ids) limit 10) t), '[]'::jsonb);
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
                 where pl.owner=p.id and pl.state='grow' and pl.grown >= c.grow_sec and pl.stolen < _cap(c, pl.weeds, pl.bugs)
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

create or replace function public.farm_rank() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  return (
    with r as (
      select id, nickname, lv, exp, rank() over (order by lv desc, exp desc) rk from players where not banned
    ), fr as (
      select case when from_id = uid then to_id else from_id end fid
      from friends where status = 'accepted' and (from_id = uid or to_id = uid)
    )
    select jsonb_build_object(
      'top', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'rk', rk, 'nickname', nickname, 'lv', lv, 'exp', exp, 'me', id = uid) order by rk, nickname)
                       from (select * from r order by rk, nickname limit 50) t), '[]'::jsonb),
      'friends', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'lv', lv, 'exp', exp, 'me', id = uid) order by lv desc, exp desc, nickname)
                           from r where id = uid or id in (select fid from fr)), '[]'::jsonb),
      'my_rank', (select rk from r where id = uid),
      'total', (select count(*) from r)
    )
  );
end $$;

grant execute on function public.farm_notices(), public.farm_neighbors() to authenticated;
