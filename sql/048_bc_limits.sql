-- 百家樂：每個押注區的單注上限，後台「玩法設定」可以改（0＝不限）
insert into settings(key, value, note) values
  ('bc_lim_p', '0', '百家樂：「閒」每局單注上限（0＝不限）'),
  ('bc_lim_b', '0', '百家樂：「莊」每局單注上限（0＝不限）'),
  ('bc_lim_t', '0', '百家樂：「和」每局單注上限（0＝不限）'),
  ('bc_lim_pp', '0', '百家樂：「閒對」每局單注上限（0＝不限）'),
  ('bc_lim_bp', '0', '百家樂：「莊對」每局單注上限（0＝不限）')
on conflict (key) do nothing;
