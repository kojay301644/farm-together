-- 008: 萌獸裝備（1 格）＝ 8 種自動化功能 × 4 級；萌獸進化 Lv10 / Lv20（取代 007 的萌獸能力）
create table if not exists gear(
  id text primary key, name text not null, func text not null, tier int not null, val numeric not null,
  icon text not null, gold int, gems int, lv int not null default 1, sort int not null default 0);
alter table gear enable row level security;

alter table players add column if not exists gear jsonb not null default '{}'::jsonb;
alter table players add column if not exists equip text;
alter table players add column if not exists auto_seed text;
alter table players add column if not exists gift_lv int not null default 1;

insert into settings(key, value, note) values
  ('gear_drop', to_jsonb(0.03), '手動收成時掉出裝備寶箱的機率（0.03＝3%）')
on conflict (key) do nothing;

insert into gear(id, name, func, tier, val, icon, gold, gems, lv, sort) values
 ('plant1','銅鈴鐺','plant',1,6,'q_basic_bell',1000,null,3,11),('plant2','肉球護符','plant',2,10,'q_basic_charm',5000,null,8,12),
 ('plant3','皮項圈','plant',3,14,'q_basic_collar',null,60,1,13),('plant4','農夫草帽','plant',4,18,'q_basic_hat',null,150,1,14),
 ('water1','冰霜鈴鐺','water',1,6,'q_ice_bell',1000,null,3,21),('water2','冰晶護符','water',2,10,'q_ice_charm',5000,null,8,22),
 ('water3','雪花項圈','water',3,14,'q_ice_collar',null,60,1,23),('water4','毛線帽','water',4,18,'q_ice_hat',null,150,1,24),
 ('dog1','守護鈴鐺','dog',1,0.15,'q_guard_bell',1000,null,3,31),('dog2','盾之護符','dog',2,0.25,'q_guard_charm',5000,null,8,32),
 ('dog3','守衛項圈','dog',3,0.35,'q_guard_collar',null,60,1,33),('dog4','騎士頭盔','dog',4,0.5,'q_guard_hat',null,150,1,34),
 ('bug1','雷鳴鈴鐺','bug',1,0.4,'q_elec_bell',1000,null,3,41),('bug2','雷光護符','bug',2,0.6,'q_elec_charm',5000,null,8,42),
 ('bug3','閃電項圈','bug',3,0.8,'q_elec_collar',null,60,1,43),('bug4','閃電帽','bug',4,1,'q_elec_hat',null,150,1,44),
 ('weed1','風之鈴鐺','weed',1,0.4,'q_wind_bell',1000,null,3,51),('weed2','風靈護符','weed',2,0.6,'q_wind_charm',5000,null,8,52),
 ('weed3','羽風項圈','weed',3,0.8,'q_wind_collar',null,60,1,53),('weed4','羽毛帽','weed',4,1,'q_wind_hat',null,150,1,54),
 ('clear1','烈焰鈴鐺','clear',1,6,'q_fire_bell',1000,null,3,61),('clear2','火焰護符','clear',2,10,'q_fire_charm',5000,null,8,62),
 ('clear3','火紋項圈','clear',3,14,'q_fire_collar',null,60,1,63),('clear4','火焰帽','clear',4,18,'q_fire_hat',null,150,1,64),
 ('harvest1','獵王鈴鐺','harvest',1,60,'q_hunt_bell',1500,null,3,71),('harvest2','獵眼護符','harvest',2,30,'q_hunt_charm',8000,null,8,72),
 ('harvest3','獠牙項圈','harvest',3,15,'q_hunt_collar',null,90,1,73),('harvest4','獵王之冠','harvest',4,5,'q_hunt_hat',null,200,1,74),
 ('scare1','鋼鐵鈴鐺','scare',1,0.25,'q_siege_bell',1000,null,3,81),('scare2','齒輪護符','scare',2,0.45,'q_siege_charm',5000,null,8,82),
 ('scare3','尖刺項圈','scare',3,0.65,'q_siege_collar',null,60,1,83),('scare4','維京盔','scare',4,0.85,'q_siege_hat',null,150,1,84)
on conflict (id) do nothing;

-- 萌獸能力取消：_ab 一律 0（保留函式避免舊程式出錯）
create or replace function _ab(p players, sp text, a numeric, b numeric, c numeric) returns numeric
language sql stable security definer set search_path to 'public' as $$ select 0::numeric $$;

-- 裝備數值（沒有裝或功能不同 → 0）
create or replace function _gv(p players, f text) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select g.val from gear g where g.id = p.equip and g.func = f and coalesce((p.gear->>g.id)::int,0) > 0), 0) $$;

create or replace function _give_gear(p_uid uuid, p_id text) returns void
language sql security definer set search_path to 'public' as $$
  update players set gear = jsonb_set(gear, array[p_id], to_jsonb(coalesce((gear->>p_id)::int,0) + 1)) where id = p_uid $$;

-- 隨機裝備（I 60%、II 30%、III 9%、IV 1%，可限定最高或指定級數）
create or replace function _rand_gear(p_min int, p_max int) returns gear
language sql volatile security definer set search_path to 'public' as $$
  select * from gear where tier between p_min and p_max
  order by -ln(greatest(random(),1e-9)) / case tier when 1 then 60 when 2 then 30 when 3 then 9 else 1 end limit 1 $$;

-- 升級獎勵：Lv5 I級、Lv10 II級、Lv15 II級、Lv20 III級
create or replace function _lv_gifts(p_uid uuid) returns text
language plpgsql security definer set search_path to 'public' as $function$
declare me players; g gear; msg text := null; t int; lvl int;
begin
  select * into me from players where id = p_uid for update;
  foreach lvl in array array[5,10,15,20] loop
    if me.lv >= lvl and me.gift_lv < lvl then
      t := case lvl when 5 then 1 when 10 then 2 when 15 then 2 else 3 end;
      g := _rand_gear(t, t);
      perform _give_gear(p_uid, g.id);
      update players set gift_lv = lvl where id = p_uid;
      msg := coalesce(msg || '、', '') || 'Lv' || lvl || ' 升級禮物：' || g.name;
    end if;
  end loop;
  return msg;
end $function$;

create or replace function _prank_left(p players) returns integer
language sql stable set search_path to 'public' as $function$
  select case when p.prank_day = (now() at time zone 'Asia/Taipei')::date then greatest(0, _cfg('prank_daily',10)::int - p.prank_cnt) else _cfg('prank_daily',10)::int end
$function$;
create or replace function _steal_left(p players) returns integer
language sql stable set search_path to 'public' as $function$
  select case when p.steal_day = (now() at time zone 'Asia/Taipei')::date then greatest(0, _cfg('stranger_steal_daily',30)::int - p.steal_cnt) else _cfg('stranger_steal_daily',30)::int end
$function$;

-- 生長＋自動化裝備
create or replace function _tick(p_owner uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r record; c record; op players; nowt timestamptz := now();
  el double precision; wet double precision; dry double precision; gu double precision; g double precision;
  frac double precision; eff double precision; chunk double precision; ivl double precision;
  n int; k int; w int; b int; gw numeric; gb numeric; gwd numeric; amt int; v int; xp int := 0;
begin
  select * into op from players where id = p_owner;
  if not found then return; end if;
  gw := _gv(op,'water'); gb := _gv(op,'bug'); gwd := _gv(op,'weed');
  for r in select * from plots where owner = p_owner and state = 'grow' for update loop
    select * into c from crops where id = r.crop;
    if r.grown >= c.grow_sec or r.last_tick is null then
      update plots set last_tick = nowt, ripe_at = coalesce(ripe_at, case when r.grown >= c.grow_sec then nowt end) where owner = p_owner and idx = r.idx;
      continue;
    end if;
    el := greatest(0, extract(epoch from nowt - r.last_tick));
    wet := least(el, greatest(0, extract(epoch from coalesce(r.wet_until, r.last_tick) - r.last_tick)));
    if gw > 0 and r.idx < gw then wet := el; end if;            -- 自動澆水：一乾就澆
    dry := el - wet;
    gu := r.grown + wet + dry * 0.5;
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
          if random() < 0.5 then
            if not (gwd > 0 and random() < gwd) then w := least(3, w + 1); end if;   -- 自動除草
          else
            if not (gb > 0 and random() < gb) then b := least(3, b + 1); end if;     -- 自動除蟲
          end if;
        end if;
      end loop;
    end if;
    update plots set grown = g, weeds = w, bugs = b, last_tick = nowt,
      wet_until = case when gw > 0 and r.idx < gw and g < c.grow_sec and coalesce(wet_until, nowt) <= nowt then nowt + make_interval(secs => _wetdur(c.grow_sec)) else wet_until end,
      ripe_at = case when g >= c.grow_sec then coalesce(ripe_at, nowt) else null end
      where owner = p_owner and idx = r.idx;
  end loop;

  -- 自動收成：成熟後 N 分鐘
  if _gv(op,'harvest') > 0 then
    for r in select * from plots where owner = p_owner and state = 'grow' and ripe_at is not null
             and ripe_at + make_interval(mins => _gv(op,'harvest')::int) <= nowt for update loop
      select * into c from crops where id = r.crop;
      amt := greatest(1, greatest(ceil(c.yield*0.6)::int, c.yield - r.weeds - r.bugs) - r.stolen);
      update players set crops = jsonb_set(crops, array[c.id], to_jsonb(coalesce((crops->>c.id)::int,0) + amt)) where id = p_owner;
      update plots set state='dead', weeds=0, bugs=0, wet_until=null, ripe_at=null where owner=p_owner and idx=r.idx;
      insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, p_owner, '你的萌獸', 'auto_harvest', c.id, amt);
      xp := xp + c.exp;
    end loop;
    if xp > 0 then perform _add_exp(p_owner, xp); end if;
  end if;
  -- 自動剷除
  if _gv(op,'clear') > 0 then
    update plots set state='empty', crop=null, grown=0, stolen=0, planted_at=null, ripe_at=null
      where owner = p_owner and state = 'dead' and idx < _gv(op,'clear');
  end if;
  -- 自動播種（用背包裡指定的種子）
  if _gv(op,'plant') > 0 and op.auto_seed is not null then
    select * into c from crops where id = op.auto_seed;
    if found then
      for r in select * from plots where owner = p_owner and state = 'empty' and idx < _gv(op,'plant') order by idx for update loop
        select coalesce((seeds->>c.id)::int,0) into v from players where id = p_owner;
        exit when v < 1;
        update players set seeds = case when v-1 > 0 then jsonb_set(seeds, array[c.id], to_jsonb(v-1)) else seeds - c.id end where id = p_owner;
        update plots set state='grow', crop=c.id, grown=0, wet_until=nowt + make_interval(secs => _wetdur(c.grow_sec)),
          last_tick=nowt, weeds=0, bugs=0, stolen=0, planted_at=nowt, ripe_at=null where owner=p_owner and idx=r.idx;
      end loop;
    end if;
  end if;
end $function$;

create or replace function farm_act(p_action text, p_idx integer default null, p_crop text default null, p_n integer default 1)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid(); me players; p plots; c crops; ld land; gg gear;
  amt int := 0; xp int := 0; base int; oldlv int; cost int; v int; gift text := null;
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
    select coalesce((seeds->>p_crop)::int, 0) into v from players where id = uid;
    if v < 1 then raise exception '沒有%的種子', c.name; end if;
    update players set seeds = case when v-1 > 0 then jsonb_set(seeds, array[p_crop], to_jsonb(v-1)) else seeds - p_crop end where id = uid;
    update plots set state='grow', crop=p_crop, grown=0, wet_until=now() + make_interval(secs => _wetdur(c.grow_sec)),
      last_tick=now(), weeds=0, bugs=0, stolen=0, planted_at=now(), ripe_at=null where owner=uid and idx=p_idx;
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
    update plots set state='dead', weeds=0, bugs=0, wet_until=null, ripe_at=null where owner=uid and idx=p_idx;
    xp := c.exp;
    if random() < _cfg('gear_drop', 0.03) then                     -- 裝備寶箱
      gg := _rand_gear(1, 4); perform _give_gear(uid, gg.id); gift := '寶箱：' || gg.name;
    end if;
  elsif p_action = 'clear' then
    if p.state <> 'dead' then raise exception '沒有需要剷除的作物'; end if;
    update plots set state='empty', crop=null, grown=0, stolen=0, planted_at=null, ripe_at=null where owner=uid and idx=p_idx; xp := 1;
  elsif p_action = 'dig' then
    if p.state <> 'grow' then raise exception '這塊地沒有作物'; end if;
    update plots set state='empty', crop=null, grown=0, stolen=0, weeds=0, bugs=0, planted_at=null, wet_until=null, ripe_at=null where owner=uid and idx=p_idx;
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
    select gold into v from players where id = uid;
    if v < cost then raise exception '金幣不夠喔'; end if;
    update players set gold = gold - cost,
      seeds = jsonb_set(seeds, array[c.id], to_jsonb(coalesce((seeds->>c.id)::int,0) + p_n)) where id = uid;
    amt := p_n;
  elsif p_action = 'sell' then
    select * into c from crops where id = p_crop;
    select coalesce((crops->>p_crop)::int, 0) into v from players where id = uid;
    if v < 1 or c.id is null then raise exception '沒有可以賣的作物'; end if;
    amt := v * c.price;
    update players set gold = gold + amt, crops = crops - p_crop where id = uid;
  elsif p_action = 'sell_all' then
    select coalesce(sum((e.value)::int * cr.price), 0) into amt from players pl cross join lateral jsonb_each_text(pl.crops) e join crops cr on cr.id = e.key where pl.id = uid;
    update players set gold = gold + amt, crops = '{}'::jsonb where id = uid;
  else
    raise exception '未知的動作';
  end if;

  if xp > 0 then perform _add_exp(uid, xp); end if;
  gift := concat_ws('、', gift, _lv_gifts(uid));
  if gift = '' then gift := null; end if;
  return jsonb_build_object('amt', amt, 'xp', xp, 'gift', gift, 'lvup', (select lv from players where id = uid) > oldlv, 'state', _state(uid));
end $function$;

create or replace function farm_friend_act(p_owner uuid, p_action text, p_idx integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid(); me players; o players; p plots; c crops;
  cap int; q int := 0; xp int := 0; oldlv int; fr boolean; prot boolean; ab text := null; gift text;
  today date := (now() at time zone 'Asia/Taipei')::date;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  if p_owner = uid then raise exception '這是你自己的農場'; end if;
  fr := _is_friend(uid, p_owner);
  select * into me from players where id = uid for update;
  oldlv := me.lv;
  perform _tick(p_owner);
  select * into o from players where id = p_owner;
  if not found then raise exception '找不到這位玩家'; end if;
  prot := (not fr) and o.lv <= _cfg('newbie_lv',3);
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
    if not fr then
      update players set steal_cnt = case when steal_day = today then steal_cnt + 1 else 1 end, steal_day = today where id = uid;
    end if;
    if random() < _gv(o,'dog') then                                         -- 看門狗
      insert into steals(owner, idx, thief, planted_at, qty) values (p_owner, p_idx, uid, p.planted_at, 0);
      insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, uid, me.nickname, 'dog', c.id, 0);
      ab := 'dog';
    else
      q := least(cap - p.stolen, 1 + floor(random()*2)::int);
      update plots set stolen = stolen + q where owner=p_owner and idx=p_idx;
      insert into steals(owner, idx, thief, planted_at, qty) values (p_owner, p_idx, uid, p.planted_at, q);
      update players set crops = jsonb_set(crops, array[c.id], to_jsonb(coalesce((crops->>c.id)::int,0) + q)) where id = uid;
      insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, uid, me.nickname, 'steal', c.id, q);
      xp := 1;
    end if;
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
    else
      if p.bugs >= 3 then raise exception '這裡的蟲已經夠多了'; end if;
    end if;
    update players set prank_cnt = case when prank_day = today then prank_cnt + 1 else 1 end, prank_day = today where id = uid;
    if random() < _gv(o,'scare') then                                       -- 稻草人
      insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, 'scare', p.crop);
      ab := 'scare';
    else
      if p_action = 'prank_weed' then update plots set weeds = weeds + 1 where owner=p_owner and idx=p_idx;
      else update plots set bugs = bugs + 1 where owner=p_owner and idx=p_idx; end if;
      insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, p_action, p.crop);
    end if;
  else
    raise exception '未知的動作';
  end if;

  if xp > 0 then perform _add_exp(uid, xp); end if;
  gift := _lv_gifts(uid);
  return jsonb_build_object('qty', q, 'xp', xp, 'ab', ab, 'gift', gift, 'lvup', (select lv from players where id = uid) > oldlv,
    'state', _state(uid), 'visit', farm_visit(p_owner));
end $function$;

-- 買裝備（金幣或鑽石）
create or replace function farm_buy_gear(p_id text) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); me players; g gear;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into me from players where id = uid for update;
  select * into g from gear where id = p_id;
  if not found then raise exception '沒有這件裝備'; end if;
  if g.gold is not null then
    if me.lv < g.lv then raise exception '需要 Lv% 才能買%', g.lv, g.name; end if;
    if me.gold < g.gold then raise exception '金幣不夠喔'; end if;
    update players set gold = gold - g.gold where id = uid;
  elsif g.gems is not null then
    if me.gems < g.gems then raise exception '鑽石不夠喔'; end if;
    update players set gems = gems - g.gems where id = uid;
  else
    raise exception '這件裝備不能購買';
  end if;
  perform _give_gear(uid, g.id);
  return _state(uid);
end $function$;

-- 穿上／卸下（p_id = null 卸下）
create or replace function farm_equip(p_id text) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); me players;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into me from players where id = uid for update;
  if p_id is not null and coalesce((me.gear->>p_id)::int,0) < 1 then raise exception '你沒有這件裝備'; end if;
  perform _tick(uid);
  update players set equip = p_id where id = uid;
  return _state(uid);
end $function$;

create or replace function farm_set_auto_seed(p_crop text) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if p_crop is not null and not exists(select 1 from crops where id = p_crop) then raise exception '沒有這種作物'; end if;
  update players set auto_seed = p_crop where id = uid;
  return _state(uid);
end $function$;

grant execute on function farm_buy_gear(text) to authenticated;
grant execute on function farm_equip(text) to authenticated;
grant execute on function farm_set_auto_seed(text) to authenticated;

-- 後台：調整裝備
create or replace function adm_gear_save(p_id text, p_name text, p_val numeric, p_gold integer, p_gems integer, p_lv integer) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare a uuid := _adm(); old jsonb;
begin
  select to_jsonb(g) into old from gear g where id = p_id;
  if not found then raise exception '沒有這件裝備'; end if;
  if p_val < 0 or coalesce(p_gold,0) < 0 or coalesce(p_gems,0) < 0 or p_lv < 1 or coalesce(p_name,'') = '' then raise exception '數值不合理'; end if;
  update gear set name = p_name, val = p_val, gold = p_gold, gems = p_gems, lv = p_lv where id = p_id;
  perform _adm_log(a, 'gear', jsonb_build_object('id', p_id, 'from', old, 'to', jsonb_build_object('name', p_name, 'val', p_val, 'gold', p_gold, 'gems', p_gems, 'lv', p_lv)));
  return adm_config();
end $function$;
grant execute on function adm_gear_save(text,text,numeric,integer,integer,integer) to authenticated;

create or replace function adm_config() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare a uuid := _adm();
begin
  return jsonb_build_object(
    'settings', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'value', value, 'note', note) order by key) from settings), '[]'::jsonb),
    'crops', coalesce((select jsonb_agg(to_jsonb(c) order by sort) from crops c), '[]'::jsonb),
    'land', coalesce((select jsonb_agg(to_jsonb(l) order by idx) from land l), '[]'::jsonb),
    'gear', coalesce((select jsonb_agg(to_jsonb(g) order by sort) from gear g), '[]'::jsonb));
end $function$;

create or replace function farm_config() returns jsonb
language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'crops', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'lv', lv, 'seed', seed, 'time', grow_sec, 'yield', yield, 'price', price, 'exp', exp) order by sort) from crops), '[]'::jsonb),
    'land', coalesce((select jsonb_agg(jsonb_build_object('idx', idx, 'lv', lv, 'cost', cost) order by idx) from land), '[]'::jsonb),
    'gear', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'func', func, 'tier', tier, 'val', val, 'icon', icon, 'gold', gold, 'gems', gems, 'lv', lv) order by sort) from gear), '[]'::jsonb),
    'settings', coalesce((select jsonb_object_agg(key, value) from settings), '{}'::jsonb))
$function$;

create or replace function _state(p_uid uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'now', _ms(now()),
    'me', jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar', p.avatar, 'chara', p.chara, 'lv', p.lv, 'exp', p.exp, 'gold', p.gold, 'gems', p.gems,
                             'seeds', p.seeds, 'crops', p.crops, 'prank_left', _prank_left(p), 'steal_left', _steal_left(p),
                             'gear', p.gear, 'equip', p.equip, 'auto_seed', p.auto_seed,
                             'admin', _is_admin(p.id)),
    'plots', _plots_json(p.id, null))
  from players p where p.id = p_uid
$function$;

do $$ declare d text; begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname='farm_visit' and p.pronamespace='public'::regnamespace;
  if position('''equip''' in d)=0 then d := replace(d, '''chara'', o.chara,', '''chara'', o.chara, ''equip'', o.equip,'); execute d; end if;
end $$;

-- 已經超過的等級禮物不追溯（避免老玩家一次領很多）：把 gift_lv 設成目前等級
update players set gift_lv = lv where gift_lv < lv;
