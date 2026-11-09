-- 一起種田吧：營運後台函式（只有 admins 表裡的帳號能呼叫）

create or replace function public._adm() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not _is_admin(uid) then raise exception '沒有管理員權限'; end if;
  return uid;
end $$;

create or replace function public._adm_log(a uuid, act text, d jsonb) returns void
language sql security definer set search_path = public as $$ insert into admin_log(admin, action, detail) values (a, act, d) $$;

create or replace function public.adm_check() returns boolean
language sql stable security definer set search_path = public as $$ select _is_admin(auth.uid()) $$;

create or replace function public.adm_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := _adm(); t0 timestamptz := ((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei';
begin
  return jsonb_build_object(
    'players', (select count(*) from players),
    'new_today', (select count(*) from players where created_at >= t0),
    'active_today', (select count(*) from players where last_seen >= t0),
    'active_7d', (select count(*) from players where last_seen >= now() - interval '7 days'),
    'steals_today', (select count(*) from steals where created_at >= t0),
    'banned', (select count(*) from players where banned),
    'friendships', (select count(*) from friends where status='accepted'),
    'lv_dist', coalesce((select jsonb_agg(jsonb_build_object('lv', lv, 'n', n) order by lv) from (select lv, count(*) n from players group by lv) x), '[]'::jsonb),
    'gold_total', (select coalesce(sum(gold),0) from players),
    'gems_total', (select coalesce(sum(gems),0) from players)
  );
end $$;

create or replace function public.adm_players(q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := _adm();
begin
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv, 'gold', p.gold, 'gems', p.gems, 'banned', p.banned,
      'email', u.email, 'provider', u.raw_app_meta_data->>'provider', 'created', _ms(p.created_at), 'seen', _ms(p.last_seen)) x
    from players p join auth.users u on u.id = p.id
    where coalesce(q,'') = '' or p.nickname ilike '%'||q||'%' or u.email ilike '%'||q||'%'
    order by p.last_seen desc nulls last, p.created_at desc limit 50) t), '[]'::jsonb);
end $$;

create or replace function public.adm_player(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := _adm();
begin
  perform _tick(p_id);
  return (select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'lv', p.lv, 'exp', p.exp, 'gold', p.gold, 'gems', p.gems,
      'seeds', p.seeds, 'crops', p.crops, 'banned', p.banned, 'ban_reason', p.ban_reason, 'email', u.email,
      'created', _ms(p.created_at), 'seen', _ms(p.last_seen),
      'plots', _plots_json(p.id, null),
      'friends', (select count(*) from friends where status='accepted' and (from_id=p.id or to_id=p.id)),
      'stolen_by_me', (select coalesce(sum(qty),0) from steals where thief = p.id),
      'logs', coalesce((select jsonb_agg(jsonb_build_object('who', actor_name, 'kind', kind, 'crop', crop, 'qty', qty, 'at', _ms(created_at)) order by created_at desc)
                        from (select * from farm_logs where owner = p.id order by created_at desc limit 20) l), '[]'::jsonb))
    from players p join auth.users u on u.id = p.id where p.id = p_id);
end $$;

-- 補發（數字可以是負的，用來扣回）
create or replace function public.adm_give(p_id uuid, p_gold int default 0, p_exp int default 0, p_gems int default 0, p_crop text default null, p_seeds int default 0, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := _adm();
begin
  if not exists(select 1 from players where id = p_id) then raise exception '找不到玩家'; end if;
  update players set gold = greatest(0, gold + coalesce(p_gold,0)), gems = greatest(0, gems + coalesce(p_gems,0)) where id = p_id;
  if coalesce(p_exp,0) > 0 then perform _add_exp(p_id, p_exp); end if;
  if p_crop is not null and coalesce(p_seeds,0) <> 0 then
    if not exists(select 1 from crops where id = p_crop) then raise exception '沒有這種作物'; end if;
    update players set seeds = jsonb_set(seeds, array[p_crop], to_jsonb(greatest(0, coalesce((seeds->>p_crop)::int,0) + p_seeds))) where id = p_id;
  end if;
  perform _adm_log(a, 'give', jsonb_build_object('player', p_id, 'gold', p_gold, 'exp', p_exp, 'gems', p_gems, 'crop', p_crop, 'seeds', p_seeds, 'reason', p_reason));
  return adm_player(p_id);
end $$;

create or replace function public.adm_ban(p_id uuid, p_ban boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := _adm();
begin
  if p_id = a then raise exception '不能停權自己'; end if;
  update players set banned = p_ban, ban_reason = case when p_ban then p_reason else null end where id = p_id;
  perform _adm_log(a, case when p_ban then 'ban' else 'unban' end, jsonb_build_object('player', p_id, 'reason', p_reason));
  return adm_player(p_id);
end $$;

create or replace function public.adm_notices() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := _adm();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'active', active, 'at', _ms(created_at)) order by id desc) from notices), '[]'::jsonb);
end $$;

create or replace function public.adm_notice_save(p_id bigint, p_title text, p_body text, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := _adm();
begin
  if coalesce(btrim(p_title),'') = '' then raise exception '請輸入標題'; end if;
  if p_id is null then insert into notices(title, body, active) values (p_title, coalesce(p_body,''), coalesce(p_active,true));
  else update notices set title = p_title, body = coalesce(p_body,''), active = coalesce(p_active,true) where id = p_id; end if;
  perform _adm_log(a, 'notice', jsonb_build_object('id', p_id, 'title', p_title, 'active', p_active));
  return adm_notices();
end $$;

create or replace function public.adm_config() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := _adm();
begin
  return jsonb_build_object(
    'settings', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'value', value, 'note', note) order by key) from settings), '[]'::jsonb),
    'crops', coalesce((select jsonb_agg(to_jsonb(c) order by sort) from crops c), '[]'::jsonb),
    'land', coalesce((select jsonb_agg(to_jsonb(l) order by idx) from land l), '[]'::jsonb));
end $$;

create or replace function public.adm_setting_set(p_key text, p_value numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := _adm(); old jsonb;
begin
  select value into old from settings where key = p_key;
  if not found then raise exception '沒有這個設定'; end if;
  update settings set value = to_jsonb(p_value), updated_at = now() where key = p_key;
  perform _adm_log(a, 'setting', jsonb_build_object('key', p_key, 'from', old, 'to', p_value));
  return adm_config();
end $$;

create or replace function public.adm_crop_save(p_id text, p_seed int, p_grow_sec int, p_yield int, p_price int, p_exp int, p_lv int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := _adm(); old jsonb;
begin
  select to_jsonb(c) into old from crops c where id = p_id;
  if not found then raise exception '沒有這種作物'; end if;
  if p_seed < 0 or p_grow_sec < 10 or p_yield < 1 or p_price < 0 or p_exp < 0 or p_lv < 1 then raise exception '數值不合理'; end if;
  update crops set seed = p_seed, grow_sec = p_grow_sec, yield = p_yield, price = p_price, exp = p_exp, lv = p_lv where id = p_id;
  perform _adm_log(a, 'crop', jsonb_build_object('id', p_id, 'from', old, 'to', jsonb_build_object('seed', p_seed, 'grow_sec', p_grow_sec, 'yield', p_yield, 'price', p_price, 'exp', p_exp, 'lv', p_lv)));
  return adm_config();
end $$;

create or replace function public.adm_land_save(p_idx int, p_lv int, p_cost int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := _adm();
begin
  if p_lv < 1 or p_cost < 0 then raise exception '數值不合理'; end if;
  update land set lv = p_lv, cost = p_cost where idx = p_idx;
  if not found then raise exception '沒有這塊地'; end if;
  perform _adm_log(a, 'land', jsonb_build_object('idx', p_idx, 'lv', p_lv, 'cost', p_cost));
  return adm_config();
end $$;

create or replace function public.adm_changelog() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := _adm();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'at', _ms(created_at)) order by created_at desc, id desc) from changelog), '[]'::jsonb);
end $$;

create or replace function public.adm_logs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := _adm();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'action', l.action, 'detail', l.detail, 'admin', p.nickname, 'at', _ms(l.created_at)) order by l.id desc)
    from (select * from admin_log order by id desc limit 100) l left join players p on p.id = l.admin), '[]'::jsonb);
end $$;

grant execute on function public.adm_check(), public.adm_overview(), public.adm_players(text), public.adm_player(uuid),
  public.adm_give(uuid,int,int,int,text,int,text), public.adm_ban(uuid,boolean,text), public.adm_notices(),
  public.adm_notice_save(bigint,text,text,boolean), public.adm_config(), public.adm_setting_set(text,numeric),
  public.adm_crop_save(text,int,int,int,int,int,int), public.adm_land_save(int,int,int), public.adm_changelog(), public.adm_logs()
  to authenticated;

-- 遊戲端讀作物與開墾表（讓後台改數值後，遊戲畫面也同步）
create or replace function public.farm_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'crops', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'lv', lv, 'seed', seed, 'time', grow_sec, 'yield', yield, 'price', price, 'exp', exp) order by sort) from crops), '[]'::jsonb),
    'land', coalesce((select jsonb_agg(jsonb_build_object('idx', idx, 'lv', lv, 'cost', cost) order by idx) from land), '[]'::jsonb),
    'settings', coalesce((select jsonb_object_agg(key, value) from settings), '{}'::jsonb))
$$;
grant execute on function public.farm_config() to authenticated;
