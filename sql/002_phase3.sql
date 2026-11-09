-- 一起種田吧：第三階段（擴地到 18 塊、排行榜、澆水至少 3 分鐘、5 種新作物）

-- ========== 新作物 ==========
insert into public.crops values
 ('pineapple','鳳梨',10,480,36000,12,58,135,11),
 ('peach','桃子',11,560,43200,18,44,160,12),
 ('dragonfruit','火龍果',12,650,50400,14,65,190,13),
 ('melon','哈密瓜',13,760,57600,10,105,220,14),
 ('mango','芒果',14,880,64800,16,75,255,15)
on conflict (id) do nothing;

-- ========== 開墾條件表（第 0～3 塊一開始就有） ==========
create table if not exists public.land(
  idx int primary key,
  lv int not null,
  cost int not null
);
insert into public.land values
 (4,1,100),(5,2,300),(6,3,500),(7,4,800),(8,5,1200),(9,6,1600),(10,7,2000),
 (11,8,2500),(12,9,3000),(13,10,4000),(14,11,5000),(15,12,6500),(16,13,8000),(17,14,10000)
on conflict (idx) do nothing;
alter table public.land enable row level security;
create policy land_read on public.land for select to anon, authenticated using (true);
-- land 只開放讀取（沒有寫入的 RLS 規則，玩家無法修改）

-- 既有玩家補上第 7～18 塊荒地
insert into public.plots(owner, idx, state)
select p.id, i, 'wild' from public.players p cross join generate_series(6,17) i
on conflict (owner, idx) do nothing;

-- ========== 澆水：至少維持 3 分鐘，最多 1 小時 ==========
create or replace function public._wetdur(sec int) returns double precision
language sql immutable set search_path = public as $$ select least(3600, greatest(180, sec*0.3))::double precision $$;

-- ========== 新玩家一開始就有 18 塊（4 塊空地＋14 塊荒地） ==========
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
  insert into plots(owner, idx, state) select uid, i, case when i >= 4 then 'wild' else 'empty' end from generate_series(0,17) i;
  return _state(uid);
end $$;

-- ========== 開墾改查開墾條件表（其餘動作與原本相同） ==========
create or replace function public.farm_act(p_action text, p_idx int default null, p_crop text default null, p_n int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me players; p plots; c crops; ld land;
  amt int := 0; xp int := 0; base int; oldlv int; cost int; v int;
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

-- ========== 排行榜 ==========
create index if not exists players_rank_idx on public.players (lv desc, exp desc);

create or replace function public.farm_rank() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  return (
    with r as (
      select id, nickname, lv, exp, rank() over (order by lv desc, exp desc) rk from players
    ), fr as (
      select case when from_id = uid then to_id else from_id end fid
      from friends where status = 'accepted' and (from_id = uid or to_id = uid)
    )
    select jsonb_build_object(
      'top', coalesce((select jsonb_agg(jsonb_build_object('rk', rk, 'nickname', nickname, 'lv', lv, 'exp', exp, 'me', id = uid) order by rk, nickname)
                       from (select * from r order by rk, nickname limit 50) t), '[]'::jsonb),
      'friends', coalesce((select jsonb_agg(jsonb_build_object('nickname', nickname, 'lv', lv, 'exp', exp, 'me', id = uid) order by lv desc, exp desc, nickname)
                           from r where id = uid or id in (select fid from fr)), '[]'::jsonb),
      'my_rank', (select rk from r where id = uid),
      'total', (select count(*) from players)
    )
  );
end $$;

-- 沒登入呼叫會直接回「請先登入」
grant execute on function public.farm_rank() to authenticated;
