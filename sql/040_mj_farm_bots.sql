-- 牌桌電腦改用農場電腦：德州撲克帶入／換回的金幣（可正可負，最低扣到 0）
create or replace function public.mj_bot_gold(p_delta jsonb) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'forbidden'; end if;
  update players p set gold = greatest(0, p.gold + (p_delta->>p.id::text)::int)
   where p.id::text in (select jsonb_object_keys(p_delta)) and p.id in (select id from bots);
end $$;
revoke all on function public.mj_bot_gold(jsonb) from public, anon, authenticated;

-- 清掉太久沒動的牌桌：德州桌上農場電腦（bid）的籌碼也換回金幣
create or replace function public.mj_cleanup() returns void
language plpgsql security definer set search_path to 'public' as $function$
declare t record; s jsonb; q jsonb; live boolean; keep bigint; who text;
begin
  select min(id) into keep from mj_tables where game = 'bc' and priv = false and status = 'play';
  for t in select id, state, game from mj_tables where status in ('wait','play') and updated_at < now() - interval '30 minutes' and id is distinct from keep for update loop
    if t.game = 'th' then
      live := coalesce(t.state->>'street','') in ('pre','flop','turn','river');
      for s in select * from jsonb_array_elements(coalesce(t.state->'seats','[]'::jsonb)) loop
        if s is not null and jsonb_typeof(s) = 'object' then
          who := coalesce(nullif(s->>'uid',''), nullif(s->>'bid',''));
          if who is not null then
            update players set gold = gold + coalesce((s->>'stack')::int,0) + coalesce((s->>'rebuy')::int,0) + case when live then coalesce((s->>'put')::int,0) else 0 end
             where id = who::uuid;
          end if;
        end if;
      end loop;
      for q in select * from jsonb_array_elements(coalesce(t.state->'queue','[]'::jsonb)) loop
        update players set gold = gold + coalesce((q->>'stack')::int,0) where id = (q->>'uid')::uuid;
      end loop;
    end if;
    update mj_tables set status = 'closed' where id = t.id;
  end loop;
  update mj_views set table_id = null, view = null where table_id is not null and table_id in (select id from mj_tables where status = 'closed');
end $function$;
