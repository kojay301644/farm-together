-- 寵物下樓梯（休閒手感）：下的層數換成農場金幣（每天上限），每週層數排行，上週前 3 名發獎勵＋稱號
create table if not exists public.stair_sess(id uuid primary key default gen_random_uuid(), uid uuid not null, started timestamptz not null default now(), done boolean not null default false);
create index if not exists stair_sess_uid on public.stair_sess(uid, started);
create table if not exists public.stair_best(uid uuid not null, week date not null, floors int not null, at timestamptz not null default now(), primary key(uid, week));
create table if not exists public.stair_awards(week date primary key, at timestamptz not null default now(), winners jsonb);
alter table public.stair_sess enable row level security;
alter table public.stair_best enable row level security;
alter table public.stair_awards enable row level security;

insert into settings(key, value, note) values
  ('stair_floor_gold', '3', '寵物下樓梯：每下 1 層換多少農場金幣'),
  ('stair_daily_gold', '2000', '寵物下樓梯：每天最多換到多少農場金幣'),
  ('stair_week_rw', '[{"gold":10000,"gems":50},{"gold":6000,"gems":30},{"gold":3000,"gems":20}]', '寵物下樓梯：每週全服前 3 名的獎勵（另外送一週稱號）')
on conflict (key) do nothing;

insert into cosmetics(id, kind, name, gems, days, ach, sort, gold) values
  ('r_st1', 'title', '下樓冠軍', null, 7, 'stair', 910, null),
  ('r_st2', 'title', '下樓亞軍', null, 7, 'stair', 911, null),
  ('r_st3', 'title', '下樓季軍', null, 7, 'stair', 912, null)
on conflict (id) do nothing;

-- 玩 t 秒最多能下幾層（捲動起速 60、每秒加速 1.6、最快 170 像素／秒；70 像素＝1 層），用來擋假成績
create or replace function public._stair_max(t numeric) returns numeric language sql immutable as $$
  select (case when t <= 68.75 then 60 * t + 0.8 * t * t else 60 * 68.75 + 0.8 * 68.75 * 68.75 + 170 * (t - 68.75) end) / 70.0 $$;

create or replace function public.farm_stair_start() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); s uuid;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  perform _guard(v_uid);
  update stair_sess set done = true where stair_sess.uid = v_uid and not done;
  insert into stair_sess(uid) values (v_uid) returning id into s;
  return jsonb_build_object('id', s);
end $$;

create or replace function public.farm_stair_end(p_id uuid, p_floors int) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); se stair_sess; me players; el numeric; v_gold int := 0; want int; cap int; left_ int; wk date := _run_week(); old int; rk int;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  perform _guard(v_uid);
  select * into se from stair_sess where id = p_id and stair_sess.uid = auth.uid() for update;
  if not found or se.done then raise exception '這一場已經結算過了'; end if;
  update stair_sess set done = true where id = p_id;
  el := extract(epoch from clock_timestamp() - se.started);
  if el > 1800 then raise exception '這一場玩太久了，不算'; end if;
  if p_floors < 0 or p_floors > _stair_max(el) * 1.08 + 3 then raise exception '成績怪怪的，這一場不算'; end if;
  select * into me from players where id = v_uid for update;
  cap := _cfg('stair_daily_gold', 2000)::int;
  want := (p_floors * _cfg('stair_floor_gold', 3))::int;
  left_ := greatest(0, cap - _daily_n(me, 'stair_gold'));
  v_gold := least(left_, want);
  if v_gold > 0 then
    update players set gold = players.gold + v_gold where id = v_uid;
    perform _daily_inc(v_uid, 'stair_gold', v_gold);
  end if;
  select floors into old from stair_best where stair_best.uid = auth.uid() and week = wk;
  insert into stair_best(uid, week, floors) values (v_uid, wk, p_floors)
    on conflict (uid, week) do update set floors = greatest(stair_best.floors, excluded.floors),
      at = case when excluded.floors > stair_best.floors then now() else stair_best.at end;
  select count(*) + 1 into rk from stair_best b join players p on p.id = b.uid where b.week = wk and not p.banned and b.floors > greatest(p_floors, coalesce(old, 0));
  return jsonb_build_object('gold', v_gold, 'capped', v_gold < want, 'today', _daily_n(me, 'stair_gold') + v_gold, 'cap', cap,
    'best', greatest(p_floors, coalesce(old, 0)), 'newbest', p_floors > coalesce(old, 0) and p_floors > 0, 'rank', rk, 'state', _state(v_uid));
end $$;

create or replace function public.farm_stair_info() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); me players; wk date := _run_week();
begin
  if v_uid is null then raise exception '請先登入'; end if;
  select * into me from players where id = v_uid;
  return jsonb_build_object(
    'best', (select floors from stair_best where stair_best.uid = auth.uid() and week = wk),
    'rank', (select count(*) + 1 from stair_best b join players p on p.id = b.uid where b.week = wk and not p.banned
             and b.floors > coalesce((select floors from stair_best where stair_best.uid = auth.uid() and week = wk), -1)),
    'today', _daily_n(me, 'stair_gold'), 'cap', _cfg('stair_daily_gold', 2000)::int, 'rate', _cfg('stair_floor_gold', 3),
    'rw', (select value from settings where key = 'stair_week_rw'),
    'top', (select coalesce(jsonb_agg(x order by (x->>'rk')::int), '[]') from (
              select jsonb_build_object('rk', rank() over (order by b.floors desc), 'nickname', p.nickname, 'avatar', p.avatar, 'floors', b.floors, 'me', p.id = auth.uid()) x
              from stair_best b join players p on p.id = b.uid where b.week = wk and not p.banned order by b.floors desc limit 30) t),
    'friends', (select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'avatar', p.avatar, 'floors', b.floors, 'me', p.id = auth.uid()) order by b.floors desc), '[]')
              from stair_best b join players p on p.id = b.uid where b.week = wk and (p.id = auth.uid() or _is_friend(auth.uid(), p.id))),
    'last', (select winners from stair_awards where week = wk - 7),
    'ends', _ms(((wk + 7)::timestamp at time zone 'Asia/Taipei')));
end $$;

create or replace function public._stair_award() returns void language plpgsql security definer set search_path to 'public' as $$
declare wk date := _run_week() - 7; r record; i int := 0; rw jsonb; w jsonb := '[]'::jsonb; t text[] := array['冠軍','亞軍','季軍'];
begin
  if exists(select 1 from stair_awards where week = wk) then return; end if;
  for r in select b.uid, p.nickname, b.floors from stair_best b join players p on p.id = b.uid
           where b.week = wk and not p.banned and b.floors > 0 order by b.floors desc, b.at limit 3 loop
    i := i + 1;
    rw := coalesce((select value -> (i - 1) from settings where key = 'stair_week_rw'), '{}'::jsonb) || jsonb_build_object('cos', jsonb_build_object('r_st' || i, 7));
    insert into gifts(title, body, reward, target, expires_at)
      values ('🪜 寵物下樓梯週' || t[i], '上週寵物下樓梯全服第 ' || i || ' 名（' || r.floors || ' 層），恭喜！稱號「下樓' || t[i] || '」可以戴一週', rw, r.uid, now() + interval '14 days');
    w := w || jsonb_build_array(jsonb_build_object('rk', i, 'nickname', r.nickname, 'floors', r.floors));
  end loop;
  insert into stair_awards(week, winners) values (wk, w);
end $$;

grant execute on function public.farm_stair_start() to authenticated;
grant execute on function public.farm_stair_end(uuid, int) to authenticated;
grant execute on function public.farm_stair_info() to authenticated;
select cron.schedule('farm-stair-award', '6 16 * * 0', 'select public._stair_award()');
