-- 儲值（跟萌獸星球同一套）：
--   郵局轉帳：玩家填轉出帳號末 5 碼建單 → 轉到中華郵政帳戶 → 讀 Gmail 入帳通知的程式呼叫 post_notify → 自動對帳發鑽石
--   超商代碼：pay 函式向金流平台（tw148）取得代碼 → 付款後 paycb 收通知並主動查證才入帳；每分鐘補查
--   後台：訂單查詢、向金流補查、✋手動入帳（要填原因）、郵局入帳通知手動對單
create table if not exists public.pay_cfg(k text primary key, v text);
alter table public.pay_cfg enable row level security;   -- 沒有任何 policy：只有伺服器函式讀得到
insert into pay_cfg(k, v) values
  ('pay_open', 'true'),
  ('cvs_on', 'false'),   -- 金流金鑰設定好之後改成 true
  ('pay_secret', encode(gen_random_bytes(32), 'hex')),
  ('post_key', encode(gen_random_bytes(24), 'hex')),
  ('post_bank', '700'), ('post_bank_name', '中華郵政'), ('post_acct', '214380560664')
on conflict (k) do nothing;

create table if not exists public.pay_orders(
  id text primary key, uid uuid not null, pkg text not null, nt int not null, g int not null default 0,
  method text not null, status text not null default 'new', serial text, info jsonb, payer text, err text,
  created timestamptz not null default now(), paid_at timestamptz, credited boolean not null default false,
  bonus int, first boolean, paid_amt int, last_check timestamptz, raw jsonb);
create index if not exists pay_orders_uid on pay_orders(uid, created desc);
create index if not exists pay_orders_wait on pay_orders(status) where status = 'wait';
alter table public.pay_orders enable row level security;
create table if not exists public.pay_first(uid uuid not null, pkg text not null, primary key(uid, pkg));
alter table public.pay_first enable row level security;
create table if not exists public.bank_mail(no text primary key, amt int, at timestamptz, last5 text, bank text, order_id text,
  status text not null default 'new', note text, created timestamptz not null default now());
alter table public.bank_mail enable row level security;

-- 只給不機密的設定；金鑰（pay_secret、post_key）一律在函式裡直接查表
create or replace function public.pay_cfgv(p_k text) returns text language sql stable security definer set search_path to 'public' as $$
  select v from pay_cfg where k = p_k and k in ('pay_open', 'cvs_on', 'post_bank', 'post_bank_name', 'post_acct') $$;

-- 只准伺服器內部呼叫：金流函式（service_role）、排程（沒有登入身分），或其他函式先 set_config('pay.int','1') 再呼叫
create or replace function public._pay_guard() returns void language plpgsql stable as $$
begin
  if coalesce(auth.role(), '') not in ('service_role', '') and coalesce(current_setting('pay.int', true), '') <> '1' then raise exception 'forbidden'; end if;
end $$;

-- 方案：鑽石（每個方案第一次買鑽石加倍）、月卡、新手禮包（禮包內容在 packs 表，後台可改）
create or replace function public.pay_pkg(p_pkg text) returns jsonb language sql stable set search_path to 'public' as $$
  select case p_pkg
    when 'g100'   then '{"nt":100,"g":200,"name":"小袋鑽石"}'::jsonb
    when 'g290'   then '{"nt":290,"g":640,"name":"中袋鑽石"}'::jsonb
    when 'g490'   then '{"nt":490,"g":1150,"name":"大袋鑽石"}'::jsonb
    when 'g990'   then '{"nt":990,"g":2500,"name":"超值鑽石"}'::jsonb
    when 'month'  then (select jsonb_build_object('nt', price_twd, 'g', 0, 'name', name, 'pack', true) from packs where id = 'month')
    when 'newbie' then (select jsonb_build_object('nt', price_twd, 'g', 0, 'name', name, 'pack', true) from packs where id = 'newbie')
  end $$;

create or replace function public._pay_check(p_uid uuid, p_pkg text) returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare P jsonb := pay_pkg(p_pkg);
begin
  if coalesce(pay_cfgv('pay_open'), 'false') <> 'true' and not _is_admin(p_uid) then raise exception '儲值即將開放，敬請期待'; end if;
  if P is null or coalesce((P->>'nt')::int, 0) <= 0 then raise exception '這個方案目前沒有販售'; end if;
  if exists (select 1 from auth.users u where u.id = p_uid and u.is_anonymous) then raise exception '試玩帳號不能儲值，請先到「設定」綁定帳號'; end if;
  if exists (select 1 from players where id = p_uid and banned) then raise exception '帳號已停權'; end if;
  if p_pkg = 'newbie' then
    if exists (select 1 from players where id = p_uid and coalesce((packs->>'newbie')::int, 0) > 0) then raise exception '新手禮包限購一次，你已經買過了'; end if;
    if not exists (select 1 from players where id = p_uid and created_at > now() - interval '7 days') then raise exception '新手禮包只在註冊後 7 天內販售'; end if;
  end if;
  if (select count(*) from pay_orders o where o.uid = p_uid and o.created > now() - interval '10 minutes') >= 6 then raise exception '建立訂單太頻繁，請稍後再試'; end if;
  return P;
end $$;

-- 超商代碼建單（pay 函式呼叫）
create or replace function public.pay_new(p_uid uuid, p_pkg text, p_method text, p_payer text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare P jsonb; oid text; v_nt int;
begin
  perform _pay_guard();
  if p_method <> 'cvs' then raise exception '付款方式不正確'; end if;
  if coalesce(pay_cfgv('cvs_on'), 'false') <> 'true' then raise exception '超商代碼尚未開放，請先用郵局轉帳'; end if;
  P := _pay_check(p_uid, p_pkg); v_nt := (P->>'nt')::int;
  if v_nt < 100 then raise exception '超商代碼最低 NT$100，這個方案請用郵局轉帳'; end if;
  if v_nt > 20000 then raise exception '超商代碼最高 NT$20,000'; end if;
  if p_payer is null or length(trim(p_payer)) not between 1 and 32 then raise exception '請填寫繳費人姓名'; end if;
  oid := 'FB' || to_char(now() at time zone 'Asia/Taipei', 'YYMMDDHH24MISS') || lpad(floor(random() * 100000)::text, 5, '0');
  insert into pay_orders(id, uid, pkg, nt, g, method, payer) values (oid, p_uid, p_pkg, v_nt, (P->>'g')::int, 'cvs', trim(p_payer));
  return jsonb_build_object('id', oid, 'nt', v_nt, 'g', (P->>'g')::int);
end $$;

create or replace function public.pay_set(p_id text, p_status text, p_serial text default null, p_info jsonb default null, p_err text default null) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform _pay_guard();
  update pay_orders set status = case when credited then status else p_status end, serial = coalesce(p_serial, serial), info = coalesce(p_info, info), err = coalesce(p_err, err), last_check = now() where id = p_id;
end $$;

-- 郵局轉帳建單（玩家呼叫）：30 分鐘內轉帳，系統用「末 5 碼＋金額＋時間」自動對帳
create or replace function public.pay_post_new(p_pkg text, p_last5 text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); P jsonb; oid text; v_nt int; l5 text := regexp_replace(coalesce(p_last5, ''), '\D', '', 'g'); o pay_orders; inf jsonb;
begin
  if u is null then raise exception '請先登入'; end if;
  if length(l5) <> 5 then raise exception '請填你要轉出的帳號「末 5 碼」'; end if;
  select * into o from pay_orders x where x.uid = u and x.method = 'post' and not x.credited and x.status = 'wait' and x.pkg = p_pkg and x.payer = l5 and x.created > now() - interval '30 minutes' order by x.created desc limit 1;
  if o.id is not null then return jsonb_build_object('id', o.id, 'nt', o.nt, 'g', o.g, 'info', o.info, 'created', o.created); end if;
  P := _pay_check(u, p_pkg); v_nt := (P->>'nt')::int;
  oid := 'FP' || to_char(now() at time zone 'Asia/Taipei', 'YYMMDDHH24MISS') || lpad(floor(random() * 100000)::text, 5, '0');
  inf := jsonb_build_object('BankNumber', pay_cfgv('post_bank'), 'BankName', pay_cfgv('post_bank_name'), 'AccountNumber', pay_cfgv('post_acct'), 'TransactionAmount', v_nt, 'PayerTail', l5, 'ExpireMin', 30);
  insert into pay_orders(id, uid, pkg, nt, g, method, payer, status, info) values (oid, u, p_pkg, v_nt, (P->>'g')::int, 'post', l5, 'wait', inf);
  return jsonb_build_object('id', oid, 'nt', v_nt, 'g', (P->>'g')::int, 'info', inf, 'created', now());
end $$;

create or replace function public.pay_post_expire() returns int language sql security definer set search_path to 'public' as $$
  select _pay_guard();
  with u as (update pay_orders set status = 'expired', err = '逾時取消', last_check = now()
    where method = 'post' and status = 'wait' and not credited and created < now() - interval '30 minutes' returning 1)
  select count(*)::int from u $$;

-- 入帳：金額要夠；鑽石方案第一次買加倍；人生第一次儲值另送首儲禮包；寄信通知
create or replace function public.pay_credit(p_id text, p_amt int, p_raw jsonb default null) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare o pay_orders; P jsonb; pk packs; b int := 0; fst boolean := false; first_ever boolean; gem int; msg text;
begin
  perform _pay_guard();
  select * into o from pay_orders where id = p_id for update;
  if o.id is null then return jsonb_build_object('ok', false, 'why', 'no order'); end if;
  if o.credited then return jsonb_build_object('ok', true, 'dup', true); end if;
  if coalesce(p_amt, 0) < o.nt then
    update pay_orders set status = 'short', paid_amt = p_amt, raw = p_raw, last_check = now() where id = p_id;
    return jsonb_build_object('ok', false, 'why', 'short');
  end if;
  P := pay_pkg(o.pkg);
  first_ever := not exists (select 1 from pay_orders x where x.uid = o.uid and x.credited);
  if coalesce((P->>'pack')::boolean, false) then
    select * into pk from packs where id = o.pkg;
    perform _grant(o.uid, pk.reward);
    update players set packs = coalesce(packs, '{}') || jsonb_build_object(pk.id, coalesce((packs->>pk.id)::int, 0) + 1) where id = o.uid;
    msg := '「' || pk.name || '」已送達：' || coalesce(pk.descr, '');
  else
    insert into pay_first(uid, pkg) values (o.uid, o.pkg) on conflict do nothing; fst := found;
    perform _grant(o.uid, jsonb_build_object('gems', o.g + b));
    msg := '💎' || (o.g + b) || ' 已存入你的帳號';
  end if;
  if first_ever then
    select * into pk from packs where id = 'first';
    if pk.id is not null then
      perform _grant(o.uid, pk.reward);
      update players set packs = coalesce(packs, '{}') || jsonb_build_object('first', coalesce((packs->>'first')::int, 0) + 1) where id = o.uid;
      msg := msg || '；另外送你「' || pk.name || '」';
    end if;
  end if;
  update pay_orders set credited = true, status = 'paid', paid_at = now(), paid_amt = p_amt, bonus = b, first = fst, raw = p_raw, last_check = now() where id = p_id;
  insert into gifts(title, body, reward, target, from_uid, expires_at)
    values ('💎 儲值到帳', '訂單 ' || o.id || '（NT$' || o.nt || '）已付款成功，' || msg || '。謝謝支持！', '{}'::jsonb, o.uid, o.uid, now() + interval '30 days');
  select gems into gem from players where id = o.uid;
  return jsonb_build_object('ok', true, 'gem', gem, 'bonus', b, 'first', fst);
end $$;

-- 玩家看自己的訂單
create or replace function public.pay_mine() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('cvs', coalesce(pay_cfgv('cvs_on'), 'false') = 'true', 'open', coalesce(pay_cfgv('pay_open'), 'false') = 'true',
    'firsts', coalesce((select jsonb_agg(pkg) from pay_first where uid = auth.uid()), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(x order by x.created desc) from (select id, pkg, nt, g, method, status, info, created, paid_at, credited, bonus, first
      from pay_orders where uid = auth.uid() order by created desc limit 20) x), '[]'::jsonb)) $$;

-- 讀 Gmail 郵局入帳通知的程式呼叫（要帶 post_key）
create or replace function public.post_notify(p_key text, p_no text, p_amt int, p_at timestamptz, p_last5 text, p_bank text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare k text := (select v from pay_cfg where pay_cfg.k = 'post_key'); l5 text := right(regexp_replace(coalesce(p_last5, ''), '\D', '', 'g'), 5); n int; oid text; r jsonb; nu int; u uuid; why text;
begin
  if k is null or coalesce(p_key, '') <> k then raise exception 'bad key'; end if;
  if p_no is null or p_amt is null or p_at is null then raise exception 'bad data'; end if;
  perform set_config('pay.int', '1', true);
  insert into bank_mail(no, amt, at, last5, bank) values (p_no, p_amt, p_at, l5, left(coalesce(p_bank, ''), 40)) on conflict (no) do nothing;
  if not found then return jsonb_build_object('ok', true, 'dup', true); end if;
  select count(*), min(id) into n, oid from pay_orders
    where method = 'post' and not credited and status in ('wait', 'expired') and payer = l5 and nt = p_amt
      and created <= p_at + interval '2 minutes' and created >= p_at - interval '35 minutes';
  if n = 1 then
    r := pay_credit(oid, p_amt, jsonb_build_object('post_no', p_no, 'at', p_at, 'bank', p_bank));
    update bank_mail set order_id = oid, status = case when (r->>'ok')::boolean then 'paid' else 'manual' end, note = r::text where no = p_no;
    return jsonb_build_object('ok', true, 'matched', oid, 'r', r);
  end if;
  why := case when n = 0 then '找不到對應訂單' else '有 ' || n || ' 張訂單都對得上' end;
  if length(l5) = 5 then
    select count(distinct x.uid), min(x.uid::text)::uuid into nu, u from pay_orders x
      where x.method = 'post' and x.payer = l5 and x.created >= p_at - interval '3 days' and x.created <= p_at + interval '2 minutes';
    if nu = 1 then
      insert into gifts(title, body, reward, target, from_uid, expires_at) values ('🏧 已收到你的轉帳',
        '我們已收到你 NT$' || p_amt || ' 的轉帳（轉出帳號末 5 碼 ' || l5 || '），但系統無法自動對上訂單（可能超過 30 分鐘或金額不符），目前改由客服人工確認。確認後鑽石會自動入帳並再寄信通知你，請稍候，不用重複轉帳喔！',
        '{}'::jsonb, u, u, now() + interval '30 days');
      why := why || '｜已通知玩家';
    end if;
  end if;
  update bank_mail set status = 'manual', note = why where no = p_no;
  return jsonb_build_object('ok', true, 'matched', null, 'n', n, 'notified', nu = 1);
end $$;

-- 每分鐘：超商代碼補查、過期
create or replace function public.farm_pay_sweep() returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform _pay_guard();
  update pay_orders set status = 'expired' where status = 'wait' and method = 'cvs' and created < now() - interval '3 days';
  if exists (select 1 from pay_orders where status = 'wait' and method = 'cvs') then
    perform net.http_post(url := 'https://qnxnuyfvkrvhnaewvrik.supabase.co/functions/v1/paycb', body := '{"sweep":true}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-pay-secret', (select v from pay_cfg where k = 'pay_secret')));
  end if;
end $$;

/* ---------- 後台 ---------- */
create or replace function public.adm_pay_orders(p_q text default null) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  return coalesce((select jsonb_agg(x order by x.created desc) from (
    select o.id, o.uid, o.pkg, o.nt, o.g, o.bonus, o.method, o.status, o.credited, o.serial, o.err, o.paid_amt, o.created, o.paid_at, o.payer, coalesce(p.nickname, '?') name,
      coalesce((o.raw->>'manual')::boolean, false) manual, o.raw->>'note' mnote
    from pay_orders o left join players p on p.id = o.uid
    where p_q is null or p_q = '' or o.id ilike '%' || p_q || '%' or p.nickname ilike '%' || p_q || '%' or o.serial ilike '%' || p_q || '%' or o.payer = p_q
    order by o.created desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.adm_pay_recheck(p_id text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); o pay_orders;
begin
  select * into o from pay_orders where id = p_id;
  if o.id is null then raise exception '找不到這張訂單'; end if;
  if o.method <> 'cvs' then raise exception '郵局轉帳沒有金流可以補查：請對照郵局入帳通知，用「手動對單」或「手動入帳」'; end if;
  update pay_orders set last_check = null, status = case when status in ('expired', 'cancel') then 'wait' else status end where id = p_id and not credited;
  perform net.http_post(url := 'https://qnxnuyfvkrvhnaewvrik.supabase.co/functions/v1/paycb', body := jsonb_build_object('one', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pay-secret', (select v from pay_cfg where k = 'pay_secret')));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.adm_pay_manual(p_id text, p_note text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); o pay_orders; r jsonb;
begin
  if coalesce(length(trim(p_note)), 0) < 2 then raise exception '請填寫入帳原因（例如：郵局入帳通知 11/13 末5碼 12345）'; end if;
  select * into o from pay_orders where id = p_id;
  if o.id is null then raise exception '找不到這張訂單'; end if;
  if o.credited then raise exception '這張訂單已經入帳過了'; end if;
  perform set_config('pay.int', '1', true);
  r := pay_credit(p_id, o.nt, jsonb_build_object('manual', true, 'by', a, 'at', now(), 'note', left(trim(p_note), 200), 'prev', o.status));
  if not coalesce((r->>'ok')::boolean, false) then raise exception '入帳失敗：%', r::text; end if;
  perform _adm_log(a, 'pay_manual', jsonb_build_object('order', p_id, 'note', left(trim(p_note), 200)));
  return r;
end $$;

create or replace function public.adm_post_list() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  return coalesce((select jsonb_agg(x order by x.at desc) from (select no, amt, at, last5, bank, order_id, status, note from bank_mail order by at desc limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.adm_post_match(p_no text, p_order text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm(); m bank_mail; r jsonb;
begin
  select * into m from bank_mail where no = p_no for update;
  if m.no is null then raise exception '找不到這筆入帳通知'; end if;
  if m.status = 'paid' then raise exception '這筆已經入帳過了'; end if;
  perform set_config('pay.int', '1', true);
  r := pay_credit(p_order, m.amt, jsonb_build_object('post_no', m.no, 'at', m.at, 'manual', true, 'by', a, 'note', '郵局通知手動對單'));
  if not coalesce((r->>'ok')::boolean, false) then raise exception '入帳失敗：%', r::text; end if;
  update bank_mail set order_id = p_order, status = 'paid', note = '手動對單' where no = p_no;
  perform _adm_log(a, 'post_match', jsonb_build_object('no', p_no, 'order', p_order));
  return r;
end $$;

-- 後台開關（儲值、超商代碼）
create or replace function public.adm_pay_cfg(p_open boolean default null, p_cvs boolean default null) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a uuid := _adm();
begin
  if p_open is not null then update pay_cfg set v = p_open::text where k = 'pay_open'; perform _adm_log(a, 'pay_open', jsonb_build_object('on', p_open)); end if;
  if p_cvs is not null then update pay_cfg set v = p_cvs::text where k = 'cvs_on'; perform _adm_log(a, 'cvs_on', jsonb_build_object('on', p_cvs)); end if;
  return jsonb_build_object('open', pay_cfgv('pay_open') = 'true', 'cvs', pay_cfgv('cvs_on') = 'true', 'acct', pay_cfgv('post_bank_name') || ' ' || pay_cfgv('post_bank') || '-' || pay_cfgv('post_acct'));
end $$;

grant execute on function public.pay_post_new(text, text), public.pay_mine() to authenticated;
grant execute on function public.post_notify(text, text, int, timestamptz, text, text) to anon, authenticated;
grant execute on function public.adm_pay_orders(text), public.adm_pay_recheck(text), public.adm_pay_manual(text, text), public.adm_post_list(), public.adm_post_match(text, text), public.adm_pay_cfg(boolean, boolean) to authenticated;
select cron.schedule('farm-pay-sweep', '* * * * *', 'select public.farm_pay_sweep()');
select cron.schedule('farm-pay-post-expire', '*/5 * * * *', 'select public.pay_post_expire()');
