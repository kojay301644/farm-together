-- ⚠️ 已被 008_gear.sql 取代（萌獸能力取消，改成裝備）。保留作紀錄，不要再執行。
-- 007: 萌獸角色進化（Lv10 / Lv20，可在後台調整）＋ 20 種專屬能力（全部在伺服器端計算）
alter table players add column if not exists song_day date;
alter table plots add column if not exists ripe_at timestamptz;

insert into settings(key, value, note) values
  ('evo_lv2', to_jsonb(10), '萌獸角色進化成第二階的玩家等級'),
  ('evo_lv3', to_jsonb(20), '萌獸角色進化成第三階的玩家等級')
on conflict (key) do nothing;

-- 角色種類（去掉數字）
create or replace function _chsp(p players) returns text
language sql immutable set search_path to 'public' as $$ select regexp_replace(coalesce(p.chara,'bunny1'), '[0-9]', '', 'g') $$;

-- 角色階級（依玩家等級）
create or replace function _chst(lv int) returns int
language sql stable security definer set search_path to 'public' as $$
  select case when lv >= _cfg('evo_lv3',20) then 3 when lv >= _cfg('evo_lv2',10) then 2 else 1 end $$;

-- 能力數值：角色是 sp 才有效，依階級取 a / b / c
create or replace function _ab(p players, sp text, a numeric, b numeric, c numeric) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select case when _chsp(p) <> sp then 0 when _chst(p.lv) = 3 then c when _chst(p.lv) = 2 then b else a end $$;

-- 只能選第一階
create or replace function farm_set_chara(p_c text) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if p_c is null or p_c !~ '^(bunny|mouse|mole|puffer|owl|lizard|deer|moth|armad|seal|marten|phoenix|fox|otter|penguin|pango|ferret|whale|bear|dragon)1$' then raise exception '沒有這個角色'; end if;
  update players set chara = p_c where id = uid;
  return _state(uid);
end $function$;

-- 靜電毛球：惡作劇次數加成
create or replace function _prank_left(p players) returns integer
language sql stable set search_path to 'public' as $function$
  select case when p.prank_day = (now() at time zone 'Asia/Taipei')::date
    then greatest(0, _cfg('prank_daily',10)::int + _ab(p,'ferret',2,4,6)::int - p.prank_cnt)
    else _cfg('prank_daily',10)::int + _ab(p,'ferret',2,4,6)::int end
$function$;

-- 苔苔熊：偷陌生人次數加成
create or replace function _steal_left(p players) returns integer
language sql stable set search_path to 'public' as $function$
  select case when p.steal_day = (now() at time zone 'Asia/Taipei')::date
    then greatest(0, _cfg('stranger_steal_daily',30)::int + _ab(p,'bear',5,10,15)::int - p.steal_cnt)
    else _cfg('stranger_steal_daily',30)::int + _ab(p,'bear',5,10,15)::int end
$function$;

-- 生長：火蜥寶加速、泡泡獺減少雜草蟲、記錄成熟時間（雪糰企鵝用）
create or replace function _tick(p_owner uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  r record; c record; op players; nowt timestamptz := now();
  el double precision; wet double precision; dry double precision; gu double precision; g double precision;
  frac double precision; eff double precision; chunk double precision; ivl double precision;
  n int; k int; w int; b int; gm double precision; wf double precision;
begin
  select * into op from players where id = p_owner;
  gm := 1 + _ab(op,'lizard',.04,.07,.10);
  wf := 1 - _ab(op,'otter',.15,.25,.35);
  for r in select * from plots where owner = p_owner and state = 'grow' for update loop
    select * into c from crops where id = r.crop;
    if r.grown >= c.grow_sec or r.last_tick is null then
      update plots set last_tick = nowt, ripe_at = coalesce(ripe_at, case when r.grown >= c.grow_sec then nowt end) where owner = p_owner and idx = r.idx;
      continue;
    end if;
    el := greatest(0, extract(epoch from nowt - r.last_tick));
    wet := least(el, greatest(0, extract(epoch from coalesce(r.wet_until, r.last_tick) - r.last_tick)));
    dry := el - wet;
    gu := r.grown + (wet + dry * 0.5) * gm;      -- 缺水時生長速度減半
    g := least(c.grow_sec, gu);
    w := r.weeds; b := r.bugs;
    if g / c.grow_sec >= 0.1 and el > 0 then
      frac := case when gu > c.grow_sec then (c.grow_sec - r.grown) / (gu - r.grown) else 1 end;
      eff := el * frac;
      ivl := greatest(90, c.grow_sec / 3.0);
      n := least(200, greatest(1, ceil(eff / 30)::int));
      chunk := eff / n;
      for k in 1..n loop
        if random() < chunk / ivl * wf then
          if random() < 0.5 then w := least(3, w + 1); else b := least(3, b + 1); end if;
        end if;
      end loop;
    end if;
    update plots set grown = g, weeds = w, bugs = b, last_tick = nowt,
      ripe_at = case when g >= c.grow_sec then coalesce(ripe_at, nowt) else null end
      where owner = p_owner and idx = r.idx;
  end loop;
end $function$;

create or replace function farm_act(p_action text, p_idx integer default null, p_crop text default null, p_n integer default 1)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid(); me players; p plots; c crops; ld land; pc crops;
  amt int := 0; xp int := 0; base int; oldlv int; cost int; v int; ab text := null; bonus int; g int;
  today date := (now() at time zone 'Asia/Taipei')::date;
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
    update plots set state='grow', crop=p_crop, grown=0,
      wet_until=now() + make_interval(secs => _wetdur(c.grow_sec) * (1 + _ab(me,'puffer',.25,.40,.60))),
      last_tick=now(), weeds=0, bugs=0, stolen=0, planted_at=now(), ripe_at=null where owner=uid and idx=p_idx;
  elsif p_action = 'water' then
    if p.state <> 'grow' or p.grown >= c.grow_sec then raise exception '這塊地不需要澆水'; end if;
    if p.wet_until > now() then raise exception '土壤還很濕潤，晚點再澆'; end if;
    update plots set wet_until = now() + make_interval(secs => _wetdur(c.grow_sec) * (1 + _ab(me,'puffer',.25,.40,.60))) where owner=uid and idx=p_idx;
    xp := 1;
    if _chsp(me) = 'puffer' then ab := '保濕泡泡'; end if;
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
    -- 雷光鹿：收成數量加成（機率進位）
    if _ab(me,'deer',.05,.08,.12) > 0 then
      bonus := floor(amt * _ab(me,'deer',.05,.08,.12) + random())::int;
      if bonus > 0 then amt := amt + bonus; ab := '閃電收割 +' || bonus; end if;
    end if;
    -- 花芽蝶：授粉 ×2
    if random() < _ab(me,'moth',.10,.15,.20) then amt := amt * 2; ab := '授粉！產量×2'; end if;
    update players set crops = jsonb_set(crops, array[c.id], to_jsonb(coalesce((crops->>c.id)::int,0) + amt)) where id = uid;
    update plots set state='dead', weeds=0, bugs=0, wet_until=null, ripe_at=null where owner=uid and idx=p_idx;
    xp := ceil(c.exp * (1 + _ab(me,'mouse',.08,.12,.18)))::int;
    if _chsp(me) = 'mouse' and xp > c.exp then ab := '手腳俐落 經驗+' || (xp - c.exp); end if;
    -- 蘑菇兔：多得種子
    if random() < _ab(me,'bunny',.08,.12,.18) then
      update players set seeds = jsonb_set(seeds, array[c.id], to_jsonb(coalesce((seeds->>c.id)::int,0) + 1)) where id = uid;
      ab := '種子回收 +1 ' || c.name || '種子';
    end if;
    -- 小鯨鈴：每天第一次收成
    if _ab(me,'whale',50,120,250) > 0 and me.song_day is distinct from today then
      g := _ab(me,'whale',50,120,250)::int;
      update players set gold = gold + g, song_day = today where id = uid;
      ab := '豐收之歌 +' || g || ' 金幣';
    end if;
    -- 星晶龍寶：掉鑽石
    if random() < _ab(me,'dragon',.03,.05,.08) then
      update players set gems = gems + 1 where id = uid; ab := '星運！掉出 1 顆鑽石';
    end if;
  elsif p_action = 'clear' then
    if p.state <> 'dead' then raise exception '沒有需要剷除的作物'; end if;
    -- 火鳥雛：退回種子錢
    if _ab(me,'phoenix',.20,.35,.50) > 0 and p.crop is not null then
      select * into pc from crops where id = p.crop;
      g := round(coalesce(pc.seed,0) * _ab(me,'phoenix',.20,.35,.50))::int;
      if g > 0 then update players set gold = gold + g where id = uid; ab := '浴火重生 +' || g || ' 金幣'; end if;
    end if;
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
    cost := ceil(c.seed * p_n * (1 - _ab(me,'pango',.05,.08,.12)))::int;   -- 小石甲：省錢
    if me.gold < cost then raise exception '金幣不夠喔'; end if;
    update players set gold = gold - cost,
      seeds = jsonb_set(seeds, array[c.id], to_jsonb(coalesce((seeds->>c.id)::int,0) + p_n)) where id = uid;
    amt := p_n;
    if cost < c.seed * p_n then ab := '省錢達人 省下 ' || (c.seed * p_n - cost) || ' 金幣'; end if;
  elsif p_action = 'sell' then
    select * into c from crops where id = p_crop;
    v := coalesce((me.crops->>p_crop)::int, 0);
    if v < 1 or c.id is null then raise exception '沒有可以賣的作物'; end if;
    amt := round(v * c.price * (1 + _ab(me,'fox',.05,.08,.12)))::int;      -- 小焰狐：賣價加成
    update players set gold = gold + amt, crops = crops - p_crop where id = uid;
    if amt > v * c.price then ab := '精明商人 多賺 ' || (amt - v * c.price) || ' 金幣'; end if;
  elsif p_action = 'sell_all' then
    select coalesce(sum((e.value)::int * cr.price), 0) into base from jsonb_each_text(me.crops) e join crops cr on cr.id = e.key;
    amt := round(base * (1 + _ab(me,'fox',.05,.08,.12)))::int;
    update players set gold = gold + amt, crops = '{}'::jsonb where id = uid;
    if amt > base then ab := '精明商人 多賺 ' || (amt - base) || ' 金幣'; end if;
  else
    raise exception '未知的動作';
  end if;

  -- 礦石鼴：剷除／開墾挖到金幣
  if p_action in ('clear','till','dig') and random() < _ab(me,'mole',.15,.20,.25) then
    g := case _chst(me.lv) when 3 then 100 when 2 then 60 else 30 end;
    update players set gold = gold + g where id = uid; ab := '挖到寶 +' || g || ' 金幣';
  end if;

  if xp > 0 then perform _add_exp(uid, xp); end if;
  return jsonb_build_object('amt', amt, 'xp', xp, 'ab', ab, 'lvup', (select lv from players where id = uid) > oldlv, 'state', _state(uid));
end $function$;

create or replace function farm_friend_act(p_owner uuid, p_action text, p_idx integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid(); me players; o players; p plots; c crops;
  cap int; q int := 0; xp int := 0; oldlv int; fr boolean; prot boolean; ab text := null;
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
  perform _tick(p_owner);
  select * into p from plots where owner = p_owner and idx = p_idx for update;
  if not found then raise exception '找不到這塊地'; end if;
  if p.state = 'grow' then select * into c from crops where id = p.crop; end if;

  if p_action in ('help_weed','help_bug','help_water') and not fr then raise exception '只有好友才能幫忙'; end if;
  if p_action in ('steal','prank_weed','prank_bug') and prot then raise exception '對方還在新手保護中（Lv%以下），不能偷菜或惡作劇', _cfg('newbie_lv',3)::int; end if;

  if p_action = 'steal' then
    if p.state <> 'grow' or p.grown < c.grow_sec then raise exception '還沒有成熟的作物可以偷'; end if;
    -- 雪糰企鵝：成熟後保鮮時間內不能偷
    if _ab(o,'penguin',5,10,15) > 0 and p.ripe_at is not null and p.ripe_at + make_interval(mins => _ab(o,'penguin',5,10,15)::int) > now() then
      raise exception '這塊地被冷藏保鮮中（主人的萌獸能力），% 分鐘內不能偷', ceil(extract(epoch from p.ripe_at + make_interval(mins => _ab(o,'penguin',5,10,15)::int) - now())/60)::int;
    end if;
    if exists(select 1 from steals where owner=p_owner and idx=p_idx and thief=uid and planted_at=p.planted_at) then
      raise exception '這塊地你已經偷過了'; end if;
    if not fr and _steal_left(me) < 1 then raise exception '今天偷陌生人的次數用完了，明天再來'; end if;
    cap := _cap(c, p.weeds, p.bugs);
    cap := floor(cap * (1 - _ab(o,'owl',.15,.25,.35)))::int;                 -- 雪絨鴞：守夜
    if p.stolen >= cap then raise exception '這塊地已經被偷光了，留點給主人吧'; end if;
    q := least(cap - p.stolen, 1 + floor(random()*2)::int);
    if random() < _ab(me,'marten',.15,.25,.35) and p.stolen + q < cap then q := q + 1; ab := '偷菜高手 多偷 1 個'; end if;  -- 影絨貂
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
      update plots set wet_until = now() + make_interval(secs => _wetdur(c.grow_sec) * (1 + _ab(o,'puffer',.25,.40,.60))) where owner=p_owner and idx=p_idx;
    end if;
    insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, p_action, p.crop);
    xp := case when p_action = 'help_water' then 1 else 2 end;
    if _ab(me,'seal',.2,.35,.5) > 0 then xp := ceil(xp * (1 + _ab(me,'seal',.2,.35,.5)))::int + case when _chst(me.lv) = 3 then 1 else 0 end; ab := '交際達人 經驗加成'; end if;  -- 雪球海豹
  elsif p_action in ('prank_weed','prank_bug') then
    if p.state <> 'grow' or p.grown >= c.grow_sec then raise exception '只能在還沒成熟的作物上惡作劇'; end if;
    if _prank_left(me) < 1 then raise exception '今天的惡作劇次數用完了'; end if;
    if p_action = 'prank_weed' then
      if p.weeds >= 3 then raise exception '這裡的草已經夠多了'; end if;
    else
      if p.bugs >= 3 then raise exception '這裡的蟲已經夠多了'; end if;
    end if;
    update players set prank_cnt = case when prank_day = today then prank_cnt + 1 else 1 end, prank_day = today where id = uid;
    if random() < _ab(o,'armad',.10,.20,.30) then                              -- 小鋼甲：鐵壁彈開
      ab := '被主人的小鋼甲彈開了！';
    else
      if p_action = 'prank_weed' then update plots set weeds = weeds + 1 where owner=p_owner and idx=p_idx;
      else update plots set bugs = bugs + 1 where owner=p_owner and idx=p_idx; end if;
      insert into farm_logs(owner, actor, actor_name, kind, crop) values (p_owner, uid, me.nickname, p_action, p.crop);
    end if;
  else
    raise exception '未知的動作';
  end if;

  if xp > 0 then perform _add_exp(uid, xp); end if;
  return jsonb_build_object('qty', q, 'xp', xp, 'ab', ab, 'lvup', (select lv from players where id = uid) > oldlv,
    'state', _state(uid), 'visit', farm_visit(p_owner));
end $function$;
