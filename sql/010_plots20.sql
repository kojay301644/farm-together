-- 010: 田地 18 → 20 塊（已於線上套用）。新的兩塊放在第 1、2 號（穀倉右邊、農田上方），原本的往後移 2 號。
update plots set idx = idx + 100 where idx between 0 and 17;  update plots set idx = idx - 98 where idx >= 100;
update steals set idx = idx + 100 where idx between 0 and 17; update steals set idx = idx - 98 where idx >= 100;
update land set idx = idx + 100 where idx between 0 and 17;   update land set idx = idx - 98 where idx >= 100;
insert into plots(owner, idx, state) select id, i, 'empty' from players, generate_series(0,1) i on conflict do nothing;
-- farm_create：generate_series(0,19)，i >= 6 才是荒地
