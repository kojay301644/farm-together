-- 011: 牧場（第四階段）
create table if not exists animals(
  id text primary key, name text not null, lv int not null, price int not null, feed int not null,
  prod_sec int not null, good text not null, good_name text not null, yield int not null, good_price int not null, exp int not null, sort int not null default 0);
alter table animals enable row level security;

create table if not exists ranch(
  owner uuid not null references players(id) on delete cascade, slot int not null, kind text not null references animals(id),
  fed_at timestamptz, ready_at timestamptz, flies int not null default 0, stolen int not null default 0, thieves uuid[] not null default '{}',
  primary key(owner, slot));
alter table ranch enable row level security;

alter table players add column if not exists goods jsonb not null default '{}'::jsonb;

insert into settings(key, value, note) values
  ('ranch_lv', to_jsonb(3), '牧場開放等級'),
  ('ranch_base', to_jsonb(2), '牧場基本格數'),
  ('ranch_per_lv', to_jsonb(4), '每幾級多 1 格牧場'),
  ('ranch_max', to_jsonb(8), '牧場最多幾格')
on conflict (key) do nothing;

insert into animals(id,name,lv,price,feed,prod_sec,good,good_name,yield,good_price,exp,sort) values
 ('chicken','小雞',3,500,3,7200,'egg','雞蛋',3,30,10,1),
 ('duck','小鴨',6,1500,4,14400,'duck_egg','鴨蛋',3,60,18,2),
 ('sheep','綿羊',9,4000,6,21600,'wool','羊毛',2,180,30,3),
 ('cow','乳牛',12,9000,8,28800,'milk','牛奶',3,200,45,4),
 ('pig','小豬',16,20000,10,43200,'truffle','松露',2,600,70,5)
on conflict (id) do nothing;

create or replace function _ranch_cap(lv int) returns int language sql stable security definer set search_path to 'public' as $$
  select case when lv < _cfg('ranch_lv',3) then 0 else least(_cfg('ranch_max',8)::int, _cfg('ranch_base',2)::int + floor(lv / _cfg('ranch_per_lv',4))::int) end $$;

-- 這次產量（蚊子每隻 -1，最少 1）
create or replace function _ranch_yield(r ranch) returns int language sql stable security definer set search_path to 'public' as $$
  select greatest(1, a.yield - r.flies) from animals a where a.id = r.kind $$;
create or replace function _ranch_cap_steal(r ranch) returns int language sql stable security definer set search_path to 'public' as $$
  select floor(_ranch_yield(r) * _cfg('steal_ratio', 0.4))::int $$;

create or replace function _ranch_json(p_owner uuid, p_viewer uuid) returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('slot', r.slot, 'k', r.kind, 'fa', _ms(r.fed_at), 'ra', _ms(r.ready_at), 'f', r.flies, 'st', r.stolen,
    'y', _ranch_yield(r), 'cap', _ranch_cap_steal(r), 'mine', p_viewer is not null and p_viewer = any(r.thieves)) order by r.slot), '[]'::jsonb)
  from ranch r where r.owner = p_owner $$;

-- 餵飼料：用倉庫裡的作物，從最便宜的開始扣
create or replace function _feed_take(p_uid uuid, n int) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare r record; need int := n; take int; cr jsonb;
begin
  select crops into cr from players where id = p_uid for update;
  if (select coalesce(sum((v)::int),0) from jsonb_each_text(cr) e(k,v)) < n then return false; end if;
  for r in select e.key k, (e.value)::int v from jsonb_each_text(cr) e left join crops c on c.id = e.key order by coalesce(c.price, 0), e.key loop
    exit when need <= 0;
    take := least(need, r.v); need := need - take;
    cr := case when r.v - take > 0 then jsonb_set(cr, array[r.k], to_jsonb(r.v - take)) else cr - r.k end;
  end loop;
  update players set crops = cr where id = p_uid;
  return true;
end $$;

create or replace function farm_ranch_act(p_action text, p_slot int default null, p_kind text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); me players; a animals; r ranch; n int; s int; xp int := 0; amt int := 0; oldlv int;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into me from players where id = uid for update;
  oldlv := me.lv;
  if p_action = 'buy' then
    select * into a from animals where id = p_kind;
    if not found then raise exception '沒有這種動物'; end if;
    if me.lv < _cfg('ranch_lv',3) then raise exception '牧場 Lv% 開放', _cfg('ranch_lv',3)::int; end if;
    if me.lv < a.lv then raise exception '需要 Lv% 才能買%', a.lv, a.name; end if;
    select count(*) into n from ranch where owner = uid;
    if n >= _ranch_cap(me.lv) then raise exception '牧場滿了（目前 % 格，升級可以擴充）', _ranch_cap(me.lv); end if;
    if me.gold < a.price then raise exception '金幣不夠喔'; end if;
    select coalesce(min(g), 0) into s from generate_series(0, 20) g where g not in (select slot from ranch where owner = uid);
    update players set gold = gold - a.price where id = uid;
    insert into ranch(owner, slot, kind) values (uid, s, a.id);
    xp := 5;
  elsif p_action in ('feed','collect','swat') then
    select * into r from ranch where owner = uid and slot = p_slot for update;
    if not found then raise exception '找不到這隻動物'; end if;
    select * into a from animals where id = r.kind;
    if p_action = 'feed' then
      if r.ready_at is not null then raise exception '牠已經吃飽了'; end if;
      if not _feed_take(uid, a.feed) then raise exception '倉庫的作物不夠，需要 % 個作物當飼料', a.feed; end if;
      update ranch set fed_at = now(), ready_at = now() + make_interval(secs => a.prod_sec), flies = 0, stolen = 0, thieves = '{}' where owner = uid and slot = p_slot;
      xp := 1;
    elsif p_action = 'collect' then
      if r.ready_at is null or r.ready_at > now() then raise exception '還沒有東西可以收'; end if;
      amt := greatest(1, _ranch_yield(r) - r.stolen);
      update players set goods = jsonb_set(goods, array[a.good], to_jsonb(coalesce((goods->>a.good)::int,0) + amt)) where id = uid;
      update ranch set fed_at = null, ready_at = null, flies = 0, stolen = 0, thieves = '{}' where owner = uid and slot = p_slot;
      xp := a.exp;
    elsif p_action = 'swat' then
      if r.flies < 1 then raise exception '這裡沒有蚊子'; end if;
      update ranch set flies = flies - 1 where owner = uid and slot = p_slot; xp := 2;
    end if;
  elsif p_action = 'sell_goods' then
    select coalesce(sum((e.value)::int * an.good_price), 0) into amt from players pl cross join lateral jsonb_each_text(pl.goods) e join animals an on an.good = e.key where pl.id = uid;
    if amt <= 0 then raise exception '沒有可以賣的牧場產品'; end if;
    update players set gold = gold + amt, goods = '{}'::jsonb where id = uid;
  else
    raise exception '未知的動作';
  end if;
  if xp > 0 then perform _add_exp(uid, xp); end if;
  return jsonb_build_object('amt', amt, 'xp', xp, 'lvup', (select lv from players where id = uid) > oldlv, 'state', _state(uid));
end $function$;

create or replace function farm_ranch_friend(p_owner uuid, p_action text, p_slot int) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); me players; o players; a animals; r ranch; fr boolean; prot boolean; q int := 0; xp int := 0; cap int; oldlv int; ab text;
  today date := (now() at time zone 'Asia/Taipei')::date;
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
  select * into r from ranch where owner = p_owner and slot = p_slot for update;
  if not found then raise exception '找不到這隻動物'; end if;
  select * into a from animals where id = r.kind;
  if p_action in ('help_feed','help_swat') and not fr then raise exception '只有好友才能幫忙'; end if;
  if p_action in ('steal','prank') and prot then raise exception '對方還在新手保護中，不能偷或惡作劇'; end if;

  if p_action = 'steal' then
    if r.ready_at is null or r.ready_at > now() then raise exception '還沒有東西可以偷'; end if;
    if uid = any(r.thieves) then raise exception '這隻你已經偷過了'; end if;
    if not fr and _steal_left(me) < 1 then raise exception '今天偷陌生人的次數用完了，明天再來'; end if;
    cap := _ranch_cap_steal(r);
    if r.stolen >= cap then raise exception '已經被偷光了，留點給主人吧'; end if;
    if not fr then update players set steal_cnt = case when steal_day = today then steal_cnt + 1 else 1 end, steal_day = today where id = uid; end if;
    if random() < _gv(o,'dog') then
      update ranch set thieves = thieves || uid where owner = p_owner and slot = p_slot;
      insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, uid, me.nickname, 'dog', a.good, 0);
      ab := 'dog';
    else
      q := least(cap - r.stolen, 1);
      update ranch set stolen = stolen + q, thieves = thieves || uid where owner = p_owner and slot = p_slot;
      update players set goods = jsonb_set(goods, array[a.good], to_jsonb(coalesce((goods->>a.good)::int,0) + q)) where id = uid;
      insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, uid, me.nickname, 'r_steal', a.good, q);
      xp := 1;
    end if;
  elsif p_action = 'help_feed' then
    if r.ready_at is not null then raise exception '牠已經吃飽了'; end if;
    if not _feed_take(uid, a.feed) then raise exception '你的倉庫作物不夠，需要 % 個作物當飼料', a.feed; end if;
    update ranch set fed_at = now(), ready_at = now() + make_interval(secs => a.prod_sec), flies = 0, stolen = 0, thieves = '{}' where owner = p_owner and slot = p_slot;
    insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, 'r_feed', a.id);
    xp := 3;
  elsif p_action = 'help_swat' then
    if r.flies < 1 then raise exception '這裡沒有蚊子'; end if;
    update ranch set flies = flies - 1 where owner = p_owner and slot = p_slot;
    insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, 'r_swat', a.id);
    xp := 2;
  elsif p_action = 'prank' then
    if r.ready_at is null or r.ready_at <= now() then raise exception '只能對正在生產的動物惡作劇'; end if;
    if r.flies >= 2 then raise exception '這裡的蚊子已經夠多了'; end if;
    if _prank_left(me) < 1 then raise exception '今天的惡作劇次數用完了'; end if;
    update players set prank_cnt = case when prank_day = today then prank_cnt + 1 else 1 end, prank_day = today where id = uid;
    if random() < _gv(o,'scare') then
      insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, 'scare', a.id);
      ab := 'scare';
    else
      update ranch set flies = flies + 1 where owner = p_owner and slot = p_slot;
      insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, 'r_prank', a.id);
    end if;
  else
    raise exception '未知的動作';
  end if;
  if xp > 0 then perform _add_exp(uid, xp); end if;
  return jsonb_build_object('qty', q, 'xp', xp, 'ab', ab, 'gift', _lv_gifts(uid), 'lvup', (select lv from players where id = uid) > oldlv,
    'state', _state(uid), 'visit', farm_visit(p_owner));
end $function$;

grant execute on function farm_ranch_act(text,int,text) to authenticated;
grant execute on function farm_ranch_friend(uuid,text,int) to authenticated;

-- 後台：動物數值
create or replace function adm_animal_save(p_id text, p_lv int, p_price int, p_feed int, p_prod_sec int, p_yield int, p_good_price int, p_exp int) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare a uuid := _adm(); old jsonb;
begin
  select to_jsonb(x) into old from animals x where id = p_id;
  if not found then raise exception '沒有這種動物'; end if;
  if p_lv < 1 or p_price < 0 or p_feed < 0 or p_prod_sec < 10 or p_yield < 1 or p_good_price < 0 or p_exp < 0 then raise exception '數值不合理'; end if;
  update animals set lv=p_lv, price=p_price, feed=p_feed, prod_sec=p_prod_sec, yield=p_yield, good_price=p_good_price, exp=p_exp where id = p_id;
  perform _adm_log(a, 'animal', jsonb_build_object('id', p_id, 'from', old));
  return adm_config();
end $function$;
grant execute on function adm_animal_save(text,int,int,int,int,int,int,int) to authenticated;
