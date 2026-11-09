-- 010: 田地 18 → 20 塊（已於線上套用）。新的兩塊放在第 1、2 號（穀倉右邊、農田上方），原本的往後移 2 號。
update plots set idx = idx + 100 where idx between 0 and 17;  update plots set idx = idx - 98 where idx >= 100;
update steals set idx = idx + 100 where idx between 0 and 17; update steals set idx = idx - 98 where idx >= 100;
update land set idx = idx + 100 where idx between 0 and 17;   update land set idx = idx - 98 where idx >= 100;
insert into plots(owner, idx, state) select id, i, 'empty' from players, generate_series(0,1) i on conflict do nothing;
-- farm_create：generate_series(0,19)，i >= 6 才是荒地
-- 010b: 再改成 22 塊：第 0～3 塊（穀倉右邊 2×2）一開始就有；第 4～21 塊是 3 排 × 6 的大田，全部要開墾
-- update plots/steals/land set idx=idx+2 where idx between 2 and 19；新增 idx 2,3 空地；land 4～21 重新設定 Lv/費用；farm_create generate_series(0,21)、i>=4 為荒地
