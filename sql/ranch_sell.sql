-- 一起種田吧：牧場動物可以賣掉（退原價一半，格子空出來再買新的）
-- 貼到 Supabase 後台 → SQL Editor → Run，執行一次就好

insert into public.settings(key, value, note)
values ('ranch_sell_ratio', '0.5'::jsonb, '牧場：賣掉動物退回原價的幾成（0.5 = 一半）')
on conflict (key) do nothing;

create or replace function public.farm_ranch_sell(p_slot integer)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare uid uuid := auth.uid(); me players; r ranch; a animals; refund int; got int := 0;
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  select * into me from players where id = uid for update;
  select * into r from ranch where owner = uid and slot = p_slot for update;
  if not found then raise exception '這格沒有動物'; end if;
  select * into a from animals where id = r.kind;
  -- 產品已經好了：先收進倉庫，不會損失
  if r.ready_at is not null and r.ready_at <= now() then
    got := greatest(1, _ranch_yield(r) - r.stolen);
    update players set goods = jsonb_set(coalesce(goods,'{}'::jsonb), array[a.good], to_jsonb(coalesce((goods->>a.good)::int, 0) + got)) where id = uid;
  end if;
  refund := floor(a.price * _cfg('ranch_sell_ratio', 0.5))::int;
  delete from ranch where owner = uid and slot = p_slot;
  update players set gold = gold + refund where id = uid;
  return jsonb_build_object('refund', refund, 'got', got, 'good', a.good, 'state', _state(uid));
end $function$;

revoke execute on function public.farm_ranch_sell(integer) from public, anon;
grant execute on function public.farm_ranch_sell(integer) to authenticated;
