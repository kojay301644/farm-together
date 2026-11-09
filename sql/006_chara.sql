-- 006: 玩家角色（萌獸），已於線上套用
alter table players add column if not exists chara text not null default 'bunny1';
create or replace function farm_set_chara(p_c text) returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '請先登入'; end if;
  if p_c is null or p_c !~ '^(bunny|mouse|mole|puffer|owl|lizard|deer|moth|armad|seal|marten|phoenix|fox|otter|penguin|pango|ferret|whale|bear|dragon)[1-3]$' then raise exception '沒有這個角色'; end if;
  update players set chara = p_c where id = uid;
  return _state(uid);
end $function$;
grant execute on function farm_set_chara(text) to authenticated;
-- _state 的 me 與 farm_visit 的 owner 已用 pg_get_functiondef 修補加入 'chara'
