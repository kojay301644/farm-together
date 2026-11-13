-- 054：回流統計＋玩家每日活動
create table if not exists public.farm_days(
  uid uuid not null, d date not null, first_at timestamptz not null default now(), last_at timestamptz not null default now(),
  opens int not null default 0, acts jsonb not null default '{}'::jsonb, primary key (uid, d));
create index if not exists farm_days_d on farm_days(d);
alter table public.farm_days enable row level security;

create or replace function public._tpe_day(t timestamptz default now()) returns date language sql immutable as $$ select (t at time zone 'Asia/Taipei')::date $$;

-- 記一筆：k 為 null 只記上線；不記電腦玩家
create or replace function public._day_mark(p_uid uuid, k text, n int default 1, p_at timestamptz default now()) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_uid is null or exists (select 1 from bots where id = p_uid) then return; end if;
  insert into farm_days(uid, d, first_at, last_at, opens, acts)
    values (p_uid, _tpe_day(p_at), p_at, p_at, case when k is null then 1 else 0 end, case when k is null then '{}'::jsonb else jsonb_build_object(k, n) end)
  on conflict (uid, d) do update set
    last_at = greatest(farm_days.last_at, excluded.last_at),
    first_at = least(farm_days.first_at, excluded.first_at),
    opens = farm_days.opens + case when k is null and (farm_days.opens = 0 or farm_days.last_at < p_at - interval '30 minutes') then 1 else 0 end,
    acts = case when k is null then farm_days.acts else jsonb_set(farm_days.acts, array[k], to_jsonb(coalesce((farm_days.acts->>k)::int, 0) + n)) end;
end $$;
revoke execute on function public._day_mark(uuid, text, int, timestamptz) from public, anon, authenticated;

-- 上線（farm_me 呼叫，1 分鐘最多記一次）
create or replace function public._day_seen(p_uid uuid) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from farm_days f where f.uid = p_uid and f.d = _tpe_day() and f.last_at > now() - interval '1 minute' and f.opens > 0) then return; end if;
  perform _day_mark(p_uid, null);
end $$;
revoke execute on function public._day_seen(uuid) from public, anon, authenticated;
do $do$
declare d text;
begin
  select pg_get_functiondef('public.farm_me'::regproc) into d;
  if d !~ '_day_seen' then
    d := replace(d, 'begin perform _month_claim(uid); exception when others then null; end;', 'begin perform _month_claim(uid); exception when others then null; end; begin perform _day_seen(uid); exception when others then null; end;');
    execute d;
  end if;
end $do$;

-- 所有統計動作順便記到當天
create or replace function public._stat_add(p_uid uuid, k text, n integer) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update players set stats = jsonb_set(coalesce(stats,'{}'), array[k], to_jsonb(coalesce((stats->>k)::int,0) + n)) where id = p_uid;
  begin perform _day_mark(p_uid, k, n); exception when others then null; end;
end $$;

-- 小遊戲、娛樂廳
create or replace function public._day_sess_trg() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  begin perform _day_mark(new.uid, 'g_' || split_part(TG_TABLE_NAME, '_', 1), 1, coalesce(new.started, now())); exception when others then null; end;
  return new;
end $$;
drop trigger if exists day_mark on stair_sess; create trigger day_mark after insert on stair_sess for each row execute function _day_sess_trg();
drop trigger if exists day_mark on run_sess;   create trigger day_mark after insert on run_sess   for each row execute function _day_sess_trg();
drop trigger if exists day_mark on match_sess; create trigger day_mark after insert on match_sess for each row execute function _day_sess_trg();
create or replace function public._day_mj_trg() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare k text;
begin
  for k in select jsonb_object_keys(coalesce(new.pay, '{}'::jsonb)) loop
    begin perform _day_mark(k::uuid, 'c_' || coalesce(new.game, 'mj'), 1, coalesce(new.created_at, now())); exception when others then null; end;
  end loop;
  return new;
end $$;
drop trigger if exists day_mark on mj_log; create trigger day_mark after insert on mj_log for each row execute function _day_mj_trg();

-- 回填（舊資料能找到的部分）
insert into farm_days(uid, d, first_at, last_at, opens)
  select p.id, _tpe_day(p.last_seen), p.last_seen, p.last_seen, 1 from players p
  where p.last_seen is not null and not exists (select 1 from bots b where b.id = p.id) on conflict do nothing;
insert into farm_days(uid, d, first_at, last_at, opens)
  select p.id, _tpe_day(p.created_at), p.created_at, p.created_at, 1 from players p
  where not exists (select 1 from bots b where b.id = p.id) on conflict do nothing;
select _day_mark(uid, 'g_stair', 1, started) from stair_sess;
select _day_mark(uid, 'g_run', 1, started) from run_sess;
select _day_mark(uid, 'g_match', 1, started) from match_sess;
select _day_mark(k::uuid, 'c_' || coalesce(game,'mj'), 1, created_at) from mj_log, jsonb_object_keys(coalesce(pay,'{}'::jsonb)) k where k ~ '^[0-9a-f-]{36}$';
select _day_mark(thief, 'steal', 1, created_at) from steals;
select _day_mark(actor, kind, 1, created_at) from farm_logs where actor is not null;

-- 後台：回流總覽（最近 p_days 天）
create or replace function public.adm_retention(p_days int default 14) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); today date := _tpe_day();
begin
  return jsonb_build_object(
    'days', coalesce((select jsonb_agg(x order by x.d desc) from (
      select dd::date d,
        (select count(*) from farm_days f where f.d = dd) dau,
        (select count(*) from players p where _tpe_day(p.created_at) = dd and not exists (select 1 from bots b where b.id = p.id)) new_users,
        (select count(*) from farm_days f join players p on p.id = f.uid where f.d = dd and _tpe_day(p.created_at) < dd
           and not exists (select 1 from farm_days g where g.uid = f.uid and g.d between dd - 3 and dd - 1)) back3,
        (select count(*) from farm_days f join players p on p.id = f.uid where f.d = dd and _tpe_day(p.created_at) < dd
           and exists (select 1 from farm_days g where g.uid = f.uid and g.d = dd - 1)) stay,
        (select coalesce(sum(nt), 0) from pay_orders o where o.credited and _tpe_day(o.paid_at) = dd) revenue
      from generate_series(today - (p_days - 1), today, interval '1 day') dd) x), '[]'::jsonb),
    'cohorts', coalesce((select jsonb_agg(c order by c.d desc) from (
      select cd d, count(*) n,
        count(*) filter (where exists (select 1 from farm_days f where f.uid = p.id and f.d = cd + 1)) d1,
        count(*) filter (where exists (select 1 from farm_days f where f.uid = p.id and f.d = cd + 3)) d3,
        count(*) filter (where exists (select 1 from farm_days f where f.uid = p.id and f.d = cd + 7)) d7,
        today - cd age
      from (select p.*, _tpe_day(p.created_at) cd from players p where not exists (select 1 from bots b where b.id = p.id)) p
      where cd > today - p_days group by cd) c), '[]'::jsonb));
end $$;

-- 後台：某一天每位玩家玩了什麼
create or replace function public.adm_day_players(p_day date default null) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); dd date := coalesce(p_day, _tpe_day());
begin
  return coalesce((select jsonb_agg(x order by x.last_at desc) from (
    select f.uid, p.nickname, p.lv, f.first_at, f.last_at, f.opens, f.acts, _tpe_day(p.created_at) = dd is_new,
      (select max(g.d) from farm_days g where g.uid = f.uid and g.d < dd) prev_day,
      (select coalesce(sum(nt), 0) from pay_orders o where o.uid = f.uid and o.credited and _tpe_day(o.paid_at) = dd) paid
    from farm_days f join players p on p.id = f.uid where f.d = dd) x), '[]'::jsonb);
end $$;
grant execute on function public.adm_retention(int), public.adm_day_players(date) to authenticated;
