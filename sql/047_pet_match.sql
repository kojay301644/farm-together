-- 寵物消消樂（休閒手感）：限時 60 秒，分數換成農場金幣（每天上限），每週分數排行，上週前 3 名發獎勵＋稱號
create table if not exists public.match_sess(id uuid primary key default gen_random_uuid(), uid uuid not null, started timestamptz not null default now(), done boolean not null default false);
create index if not exists match_sess_uid on public.match_sess(uid, started);
create table if not exists public.match_best(uid uuid not null, week date not null, score int not null, at timestamptz not null default now(), primary key(uid, week));
create table if not exists public.match_awards(week date primary key, at timestamptz not null default now(), winners jsonb);
alter table public.match_sess enable row level security;
alter table public.match_best enable row level security;
alter table public.match_awards enable row level security;

insert into settings(key, value, note) values
  ('match_gold_per100', '10', '寵物消消樂：每 100 分換多少農場金幣'),
  ('match_daily_gold', '2000', '寵物消消樂：每天最多換到多少農場金幣'),
  ('match_week_rw', '[{"gold":10000,"gems":50},{"gold":6000,"gems":30},{"gold":3000,"gems":20}]', '寵物消消樂：每週全服前 3 名的獎勵（另外送一週稱號）')
on conflict (key) do nothing;

insert into cosmetics(id, kind, name, gems, days, ach, sort, gold) values
  ('r_mt1', 'title', '消除冠軍', null, 7, 'match', 920, null),
  ('r_mt2', 'title', '消除亞軍', null, 7, 'match', 921, null),
  ('r_mt3', 'title', '消除季軍', null, 7, 'match', 922, null)
on conflict (id) do nothing;

-- 玩 t 秒最多能拿幾分（一局 60 秒；每秒最多 260 分＋一點緩衝），用來擋假成績
create or replace function public._match_max(t numeric) returns numeric language sql immutable as $$
  select least(t, 65) * 260 + 400 $$;

create or replace function public.farm_match_start() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); s uuid;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  perform _guard(v_uid);
  update match_sess set done = true where match_sess.uid = v_uid and not done;
  insert into match_sess(uid) values (v_uid) returning id into s;
  return jsonb_build_object('id', s);
end $$;

create or replace function public.farm_match_end(p_id uuid, p_score int) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); se match_sess; me players; el numeric; v_gold int := 0; want int; cap int; left_ int; wk date := _run_week(); old int; rk int;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  perform _guard(v_uid);
  select * into se from match_sess where id = p_id and match_sess.uid = auth.uid() for update;
  if not found or se.done then raise exception '這一場已經結算過了'; end if;
  update match_sess set done = true where id = p_id;
  el := extract(epoch from clock_timestamp() - se.started);
  if el > 1800 then raise exception '這一場玩太久了，不算'; end if;
  if p_score < 0 or p_score > _match_max(el) then raise exception '成績怪怪的，這一場不算'; end if;
  select * into me from players where id = v_uid for update;
  cap := _cfg('match_daily_gold', 2000)::int;
  want := (p_score * _cfg('match_gold_per100', 10) / 100)::int;
  left_ := greatest(0, cap - _daily_n(me, 'match_gold'));
  v_gold := least(left_, want);
  if v_gold > 0 then
    update players set gold = players.gold + v_gold where id = v_uid;
    perform _daily_inc(v_uid, 'match_gold', v_gold);
  end if;
  select score into old from match_best where match_best.uid = auth.uid() and week = wk;
  insert into match_best(uid, week, score) values (v_uid, wk, p_score)
    on conflict (uid, week) do update set score = greatest(match_best.score, excluded.score),
      at = case when excluded.score > match_best.score then now() else match_best.at end;
  select count(*) + 1 into rk from match_best b join players p on p.id = b.uid where b.week = wk and not p.banned and b.score > greatest(p_score, coalesce(old, 0));
  return jsonb_build_object('gold', v_gold, 'capped', v_gold < want, 'today', _daily_n(me, 'match_gold') + v_gold, 'cap', cap,
    'best', greatest(p_score, coalesce(old, 0)), 'newbest', p_score > coalesce(old, 0) and p_score > 0, 'rank', rk, 'state', _state(v_uid));
end $$;

create or replace function public.farm_match_info() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); me players; wk date := _run_week();
begin
  if v_uid is null then raise exception '請先登入'; end if;
  select * into me from players where id = v_uid;
  return jsonb_build_object(
    'best', (select score from match_best where match_best.uid = auth.uid() and week = wk),
    'rank', (select count(*) + 1 from match_best b join players p on p.id = b.uid where b.week = wk and not p.banned
             and b.score > coalesce((select score from match_best where match_best.uid = auth.uid() and week = wk), -1)),
    'today', _daily_n(me, 'match_gold'), 'cap', _cfg('match_daily_gold', 2000)::int, 'rate', _cfg('match_gold_per100', 10),
    'rw', (select value from settings where key = 'match_week_rw'),
    'top', (select coalesce(jsonb_agg(x order by (x->>'rk')::int), '[]') from (
              select jsonb_build_object('rk', rank() over (order by b.score desc), 'nickname', p.nickname, 'avatar', p.avatar, 'score', b.score, 'me', p.id = auth.uid()) x
              from match_best b join players p on p.id = b.uid where b.week = wk and not p.banned order by b.score desc limit 30) t),
    'friends', (select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'avatar', p.avatar, 'score', b.score, 'me', p.id = auth.uid()) order by b.score desc), '[]')
              from match_best b join players p on p.id = b.uid where b.week = wk and (p.id = auth.uid() or _is_friend(auth.uid(), p.id))),
    'last', (select winners from match_awards where week = wk - 7),
    'ends', _ms(((wk + 7)::timestamp at time zone 'Asia/Taipei')));
end $$;

create or replace function public._match_award() returns void language plpgsql security definer set search_path to 'public' as $$
declare wk date := _run_week() - 7; r record; i int := 0; rw jsonb; w jsonb := '[]'::jsonb; t text[] := array['冠軍','亞軍','季軍'];
begin
  if exists(select 1 from match_awards where week = wk) then return; end if;
  for r in select b.uid, p.nickname, b.score from match_best b join players p on p.id = b.uid
           where b.week = wk and not p.banned and b.score > 0 order by b.score desc, b.at limit 3 loop
    i := i + 1;
    rw := coalesce((select value -> (i - 1) from settings where key = 'match_week_rw'), '{}'::jsonb) || jsonb_build_object('cos', jsonb_build_object('r_mt' || i, 7));
    insert into gifts(title, body, reward, target, expires_at)
      values ('🐾 寵物消消樂週' || t[i], '上週寵物消消樂全服第 ' || i || ' 名（' || r.score || ' 分），恭喜！稱號「消除' || t[i] || '」可以戴一週', rw, r.uid, now() + interval '14 days');
    w := w || jsonb_build_array(jsonb_build_object('rk', i, 'nickname', r.nickname, 'score', r.score));
  end loop;
  insert into match_awards(week, winners) values (wk, w);
end $$;

grant execute on function public.farm_match_start() to authenticated;
grant execute on function public.farm_match_end(uuid, int) to authenticated;
grant execute on function public.farm_match_info() to authenticated;
select cron.schedule('farm-match-award', '7 16 * * 0', 'select public._match_award()');
