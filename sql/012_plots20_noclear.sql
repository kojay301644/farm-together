-- 012（請在 Supabase → SQL Editor 整段貼上執行一次）：田改 20 塊、收成直接變空地（拿掉剷除）、裝備調整（自動剷除→自動餵食、自動收成含牧場）
do $mig$
declare d text;
begin
  -- 1) 起始田拿掉 idx 1、3
  -- idx1 上還在長的作物，挪到同一位玩家空著的 idx0
  delete from plots p where p.idx = 0 and p.state = 'empty' and exists (select 1 from plots q where q.owner = p.owner and q.idx = 1 and q.state = 'grow');
  update plots p set idx = 0 where p.idx = 1 and p.state = 'grow' and not exists (select 1 from plots q where q.owner = p.owner and q.idx = 0);
  delete from plots where idx in (1,3);
  update plots set idx = idx + 100 where idx >= 0;
  update plots set idx = case when idx = 100 then 0 when idx = 102 then 1 else idx - 102 end where idx >= 100;
  update land set idx = idx + 100 where idx >= 0;
  update land set idx = idx - 102 where idx >= 100;

  -- 2) 枯萎的田直接清空
  update plots set state = 'empty', crop = null, grown = 0, stolen = 0, weeds = 0, bugs = 0, planted_at = null, ripe_at = null, wet_until = null
    where state = 'dead';

  -- 3) 裝備
  update gear set func = 'feed', val = case tier when 1 then 2 when 2 then 4 when 3 then 6 else 8 end where func = 'clear';
  update gear set val = case tier when 1 then 5 when 2 then 10 when 3 then 15 else 20 end where func in ('plant','water');

  -- 4) 新玩家 20 塊田
  d := pg_get_functiondef('public.farm_create(text)'::regprocedure);
  if position('generate_series(0,21)' in d) = 0 then raise exception 'farm_create 找不到'; end if;
  execute replace(replace(d, 'generate_series(0,21)', 'generate_series(0,19)'), 'i >= 4', 'i >= 2');

  -- 5) 收成後直接變空地
  d := pg_get_functiondef('public.farm_act(text,integer,text,integer)'::regprocedure);
  if position($s$update plots set state='dead', weeds=0, bugs=0, wet_until=null, ripe_at=null where owner=uid and idx=p_idx;$s$ in d) = 0 then raise exception 'farm_act 找不到'; end if;
  execute replace(d, $s$update plots set state='dead', weeds=0, bugs=0, wet_until=null, ripe_at=null where owner=uid and idx=p_idx;$s$,
    $s$update plots set state='empty', crop=null, grown=0, stolen=0, weeds=0, bugs=0, planted_at=null, wet_until=null, ripe_at=null where owner=uid and idx=p_idx;$s$);

  -- 6) 牧場自動化
  execute $f$
create or replace function public._ranch_auto(p_owner uuid) returns void
language plpgsql security definer set search_path to 'public' as $b$
declare op players; r record; a animals; amt int; xp int := 0; hv numeric; fv numeric;
begin
  select * into op from players where id = p_owner;
  if not found then return; end if;
  hv := _gv(op,'harvest'); fv := _gv(op,'feed');
  if hv > 0 then
    for r in select * from ranch where owner = p_owner and ready_at is not null
             and ready_at + make_interval(mins => hv::int) <= now() for update loop
      select * into a from animals where id = r.kind;
      amt := greatest(1, _ranch_yield(r) - r.stolen);
      update players set goods = jsonb_set(goods, array[a.good], to_jsonb(coalesce((goods->>a.good)::int,0) + amt)) where id = p_owner;
      update ranch set fed_at = null, ready_at = null, flies = 0, stolen = 0, thieves = '{}' where owner = p_owner and slot = r.slot;
      insert into farm_logs(owner, actor, actor_name, kind, crop, qty) values (p_owner, p_owner, '你的寵物', 'auto_collect', a.good, amt);
      xp := xp + a.exp;
    end loop;
  end if;
  if fv > 0 then
    for r in select * from ranch where owner = p_owner and ready_at is null and slot < fv order by slot for update loop
      select * into a from animals where id = r.kind;
      exit when not _feed_take(p_owner, a.feed);
      update ranch set fed_at = now(), ready_at = now() + make_interval(secs => a.prod_sec), flies = 0, stolen = 0, thieves = '{}'
        where owner = p_owner and slot = r.slot;
    end loop;
  end if;
  if xp > 0 then perform _add_exp(p_owner, xp); end if;
end $b$;
$f$;

  d := pg_get_functiondef('public._tick(uuid)'::regprocedure);
  if position($s$update plots set state='dead', weeds=0, bugs=0, wet_until=null, ripe_at=null where owner=p_owner and idx=r.idx;$s$ in d) = 0 then raise exception '_tick 收成找不到'; end if;
  d := replace(d, $s$update plots set state='dead', weeds=0, bugs=0, wet_until=null, ripe_at=null where owner=p_owner and idx=r.idx;$s$,
    $s$update plots set state='empty', crop=null, grown=0, stolen=0, weeds=0, bugs=0, planted_at=null, wet_until=null, ripe_at=null where owner=p_owner and idx=r.idx;$s$);
  d := replace(d, $a$  if _gv(op,'clear') > 0 then
    update plots set state='empty', crop=null, grown=0, stolen=0, planted_at=null, ripe_at=null
      where owner = p_owner and state = 'dead' and idx < _gv(op,'clear');
  end if;$a$, $a$  perform _ranch_auto(p_owner);$a$);
  if position('_ranch_auto' in d) = 0 then raise exception '_tick clear 取代失敗'; end if;
  d := replace(d, $s$'你的萌獸'$s$, $s$'你的寵物'$s$);
  execute d;

  d := pg_get_functiondef('public.farm_ranch_act(text,integer,text)'::regprocedure);
  if position('  oldlv := me.lv;' in d) = 0 then raise exception 'farm_ranch_act 找不到'; end if;
  execute replace(d, '  oldlv := me.lv;', E'  oldlv := me.lv;\n  perform _tick(uid);');

  -- 7) 「萌獸」改叫「寵物」
  execute replace(pg_get_functiondef('public.farm_buy_beast'::regproc), '萌獸', '寵物');
  execute replace(pg_get_functiondef('public.adm_beast_save'::regproc), '萌獸', '寵物');
  execute replace(pg_get_functiondef('public.farm_set_party'::regproc), '萌獸', '寵物');
  update settings set note = replace(note, '萌獸', '寵物') where note like '%萌獸%';
  update notices set title = replace(title, '萌獸', '寵物'), body = replace(body, '萌獸', '寵物') where title like '%萌獸%' or body like '%萌獸%';
  update changelog set title = replace(title, '萌獸', '寵物'), body = replace(body, '萌獸', '寵物') where title like '%萌獸%' or body like '%萌獸%';
  update farm_logs set actor_name = '你的寵物' where actor_name = '你的萌獸';

  -- 8) 更新紀錄
  insert into changelog(title, body) values ('田地調整＋寵物＋背包 🎒',
    '起始田改成 2 塊，全部共 20 塊田；收成後田會直接變回空地，不用再整地就能馬上種（剷除還在，可以鏟掉種錯的作物）。「萌獸」改名叫「寵物」，寵物價格調整為一般 5,000 金、稀有 💎100。裝備調整：自動剷除改成「自動餵食」幫牧場動物餵飼料，自動收成也會幫你收牧場產品，自動播種／澆水依等級照顧 5／10／15／20 塊田。「我的家」新增「背包」，商店買到的裝備、裝飾、建築外觀、城鎮色調都分類放在裡面。');
end $mig$;
