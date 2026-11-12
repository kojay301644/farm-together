-- 錢袋：用鑽石換金幣（金幣旁邊的 +）
insert into settings(key, value, note) values ('gold_bags',
  '[{"id":"s","name":"小錢袋","gems":10,"gold":5000},{"id":"m","name":"中錢袋","gems":50,"gold":30000},{"id":"l","name":"大錢袋","gems":150,"gold":100000},{"id":"xl","name":"超大錢袋","gems":400,"gold":300000}]',
  '錢袋：用鑽石換金幣的方案')
on conflict (key) do nothing;

create or replace function public.farm_goldbags() returns jsonb
language sql security definer set search_path to 'public' as $$
  select coalesce((select value from settings where key = 'gold_bags'), '[]'::jsonb);
$$;

create or replace function public.farm_buy_goldbag(p_id text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me_id uuid := auth.uid(); p players; b jsonb; cost int; amt int;
begin
  if me_id is null then raise exception '請先登入'; end if;
  perform _guard(me_id);
  select x into b from jsonb_array_elements((select value from settings where key = 'gold_bags')) x where x->>'id' = p_id;
  if b is null then raise exception '沒有這種錢袋'; end if;
  cost := (b->>'gems')::int; amt := (b->>'gold')::int;
  if cost is null or cost <= 0 or amt is null or amt <= 0 then raise exception '這個錢袋還不能買'; end if;
  select * into p from players where id = me_id for update;
  if coalesce(p.gems,0) < cost then raise exception '鑽石不夠'; end if;
  update players set gems = gems - cost, gold = gold + amt where id = me_id;
  return jsonb_build_object('gold', amt, 'gems', cost, 'state', _state(me_id));
end $$;
revoke all on function public.farm_buy_goldbag(text) from public, anon;
grant execute on function public.farm_buy_goldbag(text) to authenticated;
grant execute on function public.farm_goldbags() to authenticated, anon;
