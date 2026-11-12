-- 寵物跑酷（休閒手感）：撿到的金幣換成農場金幣（每天上限），每週距離排行，上週前 3 名發獎勵＋稱號
create table if not exists public.run_sess(id uuid primary key default gen_random_uuid(), uid uuid not null, started timestamptz not null default now(), done boolean not null default false);
create index if not exists run_sess_uid on public.run_sess(uid, started);
create table if not exists public.run_best(uid uuid not null, week date not null, dist int not null, coins int not null default 0, at timestamptz not null default now(), primary key(uid, week));
create table if not exists public.run_awards(week date primary key, at timestamptz not null default now(), winners jsonb);
alter table public.run_sess enable row level security;
alter table public.run_best enable row level security;
alter table public.run_awards enable row level security;

insert into settings(key, value, note) values
  ('run_coin_gold', '2', '寵物跑酷：撿到 1 枚金幣換多少農場金幣'),
  ('run_daily_gold', '2000', '寵物跑酷：每天最多換到多少農場金幣'),
  ('run_week_rw', '[{"gold":10000,"gems":50},{"gold":6000,"gems":30},{"gold":3000,"gems":20}]', '寵物跑酷：每週全服前 3 名的獎勵（另外送一週稱號）')
on conflict (key) do nothing;

insert into cosmetics(id, kind, name, gems, days, ach, sort, gold) values
  ('r_run1', 'title', '跑酷冠軍', null, 7, 'run', 900, null),
  ('r_run2', 'title', '跑酷亞軍', null, 7, 'run', 901, null),
  ('r_run3', 'title', '跑酷季軍', null, 7, 'run', 902, null)
on conflict (id) do nothing;

-- 這週（週一開始，台灣時間）
create or replace function public._run_week() returns date language sql stable as $$
  select date_trunc('week', now() at time zone 'Asia/Taipei')::date $$;

-- 跑 t 秒最多能跑幾公尺（起跑 260、每秒加速 6、最快 650 像素／秒；40 像素＝1 公尺），用來擋假成績
create or replace function public._run_maxm(t numeric) returns numeric language sql immutable as $$
  select (case when t <= 65 then 260 * t + 3 * t * t else 260 * 65 + 3 * 65 * 65 + 650 * (t - 65) end) / 40.0 $$;

create or replace function public.farm_run_start() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); s uuid;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  perform _guard(v_uid);
  update run_sess set done = true where run_sess.uid = v_uid and not done;   -- 之前沒跑完的作廢
  insert into run_sess(uid) values (v_uid) returning id into s;
  return jsonb_build_object('id', s);
end $$;

create or replace function public.farm_run_end(p_id uuid, p_dist int, p_coins int) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); se run_sess; me players; el numeric; v_gold int := 0; cap int; left_ int; wk date := _run_week(); old int; rk int;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  perform _guard(v_uid);
  select * into se from run_sess where id = p_id and run_sess.uid = auth.uid() for update;
  if not found or se.done then raise exception '這一場已經結算過了'; end if;
  update run_sess set done = true where id = p_id;
  el := extract(epoch from clock_timestamp() - se.started);
  if el > 1800 then raise exception '這一場跑太久了，不算'; end if;
  if p_dist < 0 or p_coins < 0 or p_dist > _run_maxm(el) * 1.08 + 15 or p_coins > p_dist * 1.5 + 10 then
    raise exception '成績怪怪的，這一場不算';
  end if;
  select * into me from players where id = v_uid for update;
  cap := _cfg('run_daily_gold', 2000)::int;
  left_ := greatest(0, cap - _daily_n(me, 'run_gold'));
  v_gold := least(left_, (p_coins * _cfg('run_coin_gold', 2))::int);
  if v_gold > 0 then
    update players set gold = players.gold + v_gold where id = v_uid;
    perform _daily_inc(v_uid, 'run_gold', v_gold);
  end if;
  select dist into old from run_best where run_best.uid = auth.uid() and week = wk;
  insert into run_best(uid, week, dist, coins) values (v_uid, wk, p_dist, p_coins)
    on conflict (uid, week) do update set dist = greatest(run_best.dist, excluded.dist),
      coins = case when excluded.dist > run_best.dist then excluded.coins else run_best.coins end,
      at = case when excluded.dist > run_best.dist then now() else run_best.at end;
  select count(*) + 1 into rk from run_best b join players p on p.id = b.uid where b.week = wk and not p.banned and b.dist > greatest(p_dist, coalesce(old, 0));
  return jsonb_build_object('gold', v_gold, 'capped', v_gold < (p_coins * _cfg('run_coin_gold', 2))::int, 'today', _daily_n(me, 'run_gold') + v_gold, 'cap', cap,
    'best', greatest(p_dist, coalesce(old, 0)), 'newbest', p_dist > coalesce(old, 0) and p_dist > 0, 'rank', rk, 'state', _state(v_uid));
end $$;

-- 大廳資訊＋排行榜（本週全服前 30、好友、上週前 3 名）
create or replace function public.farm_run_info() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); me players; wk date := _run_week();
begin
  if v_uid is null then raise exception '請先登入'; end if;
  select * into me from players where id = v_uid;
  return jsonb_build_object(
    'best', (select dist from run_best where run_best.uid = auth.uid() and week = wk),
    'rank', (select count(*) + 1 from run_best b join players p on p.id = b.uid where b.week = wk and not p.banned
             and b.dist > coalesce((select dist from run_best where run_best.uid = auth.uid() and week = wk), -1)),
    'today', _daily_n(me, 'run_gold'), 'cap', _cfg('run_daily_gold', 2000)::int, 'rate', _cfg('run_coin_gold', 2),
    'rw', (select value from settings where key = 'run_week_rw'),
    'top', (select coalesce(jsonb_agg(x order by (x->>'rk')::int), '[]') from (
              select jsonb_build_object('rk', rank() over (order by b.dist desc), 'nickname', p.nickname, 'avatar', p.avatar, 'dist', b.dist, 'me', p.id = auth.uid()) x
              from run_best b join players p on p.id = b.uid where b.week = wk and not p.banned order by b.dist desc limit 30) t),
    'friends', (select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'avatar', p.avatar, 'dist', b.dist, 'me', p.id = auth.uid()) order by b.dist desc), '[]')
              from run_best b join players p on p.id = b.uid where b.week = wk and (p.id = auth.uid() or _is_friend(auth.uid(), p.id))),
    'last', (select winners from run_awards where week = wk - 7),
    'ends', _ms(((wk + 7)::timestamp at time zone 'Asia/Taipei')));
end $$;

-- 每週一 00:05（台灣時間）：上週前 3 名發獎勵（禮物信箱）＋一週稱號
create or replace function public._run_award() returns void language plpgsql security definer set search_path to 'public' as $$
declare wk date := _run_week() - 7; r record; i int := 0; rw jsonb; w jsonb := '[]'::jsonb; t text[] := array['冠軍','亞軍','季軍'];
begin
  if exists(select 1 from run_awards where week = wk) then return; end if;
  for r in select b.uid, p.nickname, b.dist from run_best b join players p on p.id = b.uid
           where b.week = wk and not p.banned and b.dist > 0 order by b.dist desc, b.at limit 3 loop
    i := i + 1;
    rw := coalesce((select value -> (i - 1) from settings where key = 'run_week_rw'), '{}'::jsonb) || jsonb_build_object('cos', jsonb_build_object('r_run' || i, 7));
    insert into gifts(title, body, reward, target, expires_at)
      values ('🏃 寵物跑酷週' || t[i], '上週寵物跑酷全服第 ' || i || ' 名（' || r.dist || ' 公尺），恭喜！稱號「跑酷' || t[i] || '」可以戴一週', rw, r.uid, now() + interval '14 days');
    w := w || jsonb_build_array(jsonb_build_object('rk', i, 'nickname', r.nickname, 'dist', r.dist));
  end loop;
  insert into run_awards(week, winners) values (wk, w);
end $$;

grant execute on function public.farm_run_start() to authenticated;
grant execute on function public.farm_run_end(uuid, int, int) to authenticated;
grant execute on function public.farm_run_info() to authenticated;
select cron.schedule('farm-run-award', '5 16 * * 0', 'select public._run_award()');
