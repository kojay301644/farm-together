-- 005: 頭像（已於線上套用）
alter table players add column if not exists avatar int not null default 11;
create or replace function farm_set_avatar(p_av int) returns json
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  if p_av < 1 or p_av > 30 then raise exception 'bad_avatar'; end if;
  update players set avatar=p_av where id=auth.uid();
  return json_build_object('avatar',p_av);
end $$;
grant execute on function farm_set_avatar(int) to authenticated;
-- _state / farm_friends / farm_neighbors / farm_visit / farm_rank / adm_players / adm_player
-- 已透過 pg_get_functiondef 修補加入 avatar 欄位
