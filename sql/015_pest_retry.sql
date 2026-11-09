-- 015（請在 Supabase → SQL Editor 整段貼上執行一次）：除草／除蟲裝備會定時重試，清掉漏網的草和蟲
do $T$ declare d text; begin
insert into settings(key, value, note) values ('pest_retry_min', '10', '除草／除蟲裝備每隔幾分鐘對田裡已經有的草和蟲再試一次（0＝不重試）') on conflict (key) do nothing;
d := pg_get_functiondef('public._tick(uuid)'::regprocedure);
if position('pest_retry_min' in d) = 0 then
  if position('    update plots set grown = g, weeds = w, bugs = b, last_tick = nowt,' in d) = 0 then raise exception '_tick 找不到'; end if;
  d := replace(d, '    update plots set grown = g, weeds = w, bugs = b, last_tick = nowt,',
'    -- 除草／除蟲裝備：每隔一段時間對已經有的草和蟲再試一次
    if (gwd > 0 or gb > 0) and _cfg(''pest_retry_min'',10) > 0 and (w > 0 or b > 0) and el > 0 then
      chunk := el / (_cfg(''pest_retry_min'',10) * 60);
      n := least(20, floor(chunk)::int + (random() < chunk - floor(chunk))::int);
      for k in 1..n loop
        if w > 0 and gwd > 0 and random() < gwd then w := w - 1; end if;
        if b > 0 and gb > 0 and random() < gb then b := b - 1; end if;
      end loop;
    end if;
    update plots set grown = g, weeds = w, bugs = b, last_tick = nowt,');
  execute d;
end if;
insert into changelog(title, body) values ('除草除蟲裝備加強 🐛', '除草、除蟲裝備現在每 10 分鐘會對田裡已經長出來的草和蟲再試一次，漏網的也會慢慢被清掉，長時間的作物不怕一直被蟲吃了。');
end $T$;
