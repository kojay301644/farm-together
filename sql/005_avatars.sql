-- 005: 頭像（已於線上套用）
alter table players add column if not exists avatar int not null default 11;
create or replace function farm_set_avatar(p_n integer) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if p_n < 1 or p_n > 30 then raise exception '沒有這個頭像'; end if;
  update players set avatar = p_n where id = uid;
  return _state(uid);
end $function$;
grant execute on function farm_set_avatar(integer) to authenticated;
-- _state / farm_friends / farm_neighbors / farm_visit / farm_rank / adm_players / adm_player
-- 已透過 pg_get_functiondef 修補加入 avatar 欄位
