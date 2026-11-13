-- 055：好友邀請碼
alter table public.players add column if not exists ref_code text, add column if not exists ref_by uuid, add column if not exists ref_at timestamptz;
create unique index if not exists players_ref_code on players(ref_code) where ref_code is not null;
create table if not exists public.ref_log(invitee uuid not null, stage int not null, inviter uuid, at timestamptz not null default now(), primary key (invitee, stage));
alter table public.ref_log enable row level security;

insert into cosmetics(id, kind, name, gems, days, ach, sort, gold) values
  ('a_ref3', 'title', '招募農夫', null, null, 'ref3', 37, null),
  ('a_ref20', 'title', '傳奇村長', null, null, 'ref20', 38, null),
  ('f_ref', 'frame', '招募之星框', null, null, 'ref10', 6, null)
on conflict (id) do nothing;

create or replace function public._ref_gen() returns text language plpgsql as $$
declare c text; ab text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(ab, 1 + floor(random() * length(ab))::int, 1); end loop;
    exit when not exists (select 1 from players where ref_code = c);
  end loop;
  return c;
end $$;

create or replace function public._ref_gift(p_uid uuid, p_title text, p_body text, p_rw jsonb) returns void language sql security definer set search_path to 'public' as $$
  insert into gifts(title, body, reward, target, from_uid, expires_at) values (p_title, p_body, p_rw, p_uid, p_uid, now() + interval '30 days')
$$;

-- 升級時檢查邀請獎勵（_lv_gifts 會呼叫）
create or replace function public._ref_check(p_uid uuid) returns void language plpgsql security definer set search_path to 'public' as $$
declare me players; inv players; capped boolean; n int;
begin
  select * into me from players where id = p_uid;
  if me.ref_by is null then return; end if;
  select * into inv from players where id = me.ref_by;
  if inv.id is null then return; end if;
  capped := (select count(*) from ref_log r where r.inviter = inv.id and r.stage = 1 and r.at <= coalesce((select at from ref_log where invitee = p_uid and stage = 1), now())) > 30;
  if me.lv >= 5 and not exists (select 1 from ref_log where invitee = p_uid and stage in (2, 12)) then
    insert into ref_log(invitee, stage, inviter) values (p_uid, 2, inv.id);
    perform _ref_gift(p_uid, '🌱 邀請任務：升到 Lv5', '恭喜升到 Lv5！這是邀請你來玩的好友送你的獎勵～', '{"items":{"harvest":2}}');
    if not capped then perform _ref_gift(inv.id, '💌 邀請獎勵：' || me.nickname || ' 升到 Lv5', '你邀請的 ' || me.nickname || ' 升到 Lv5 了，謝謝你帶朋友來種田！', '{"gems":50}'); end if;
    n := (select count(*) from ref_log where inviter = inv.id and stage = 2);
    if n = 3 then perform _ref_gift(inv.id, '🏅 邀請成就：3 位好友', '你邀請的好友已經有 3 位升到 Lv5！送你永久稱號「招募農夫」', '{"cos":{"a_ref3":0}}'); end if;
    if n = 10 then perform _ref_gift(inv.id, '🏅 邀請成就：10 位好友', '你邀請的好友已經有 10 位升到 Lv5！送你永久頭像框「招募之星框」', '{"cos":{"f_ref":0}}'); end if;
    if n = 20 then perform _ref_gift(inv.id, '🏅 邀請成就：20 位好友', '你邀請的好友已經有 20 位升到 Lv5！送你永久稱號「傳奇村長」和 💎300', '{"cos":{"a_ref20":0},"gems":300}'); end if;
  end if;
  if me.lv >= 10 and not exists (select 1 from ref_log where invitee = p_uid and stage in (3, 13)) then
    insert into ref_log(invitee, stage, inviter) values (p_uid, 3, inv.id);
    perform _ref_gift(p_uid, '🌾 邀請任務：升到 Lv10', '恭喜升到 Lv10！這是邀請你來玩的好友送你的獎勵～', '{"gems":50}');
    if not capped then perform _ref_gift(inv.id, '💌 邀請獎勵：' || me.nickname || ' 升到 Lv10', '你邀請的 ' || me.nickname || ' 升到 Lv10 了！', '{"gems":100,"seeds":{"rcorn":3}}'); end if;
  end if;
end $$;
revoke execute on function public._ref_check(uuid), public._ref_gift(uuid, text, text, jsonb), public._ref_gen() from public, anon, authenticated;

create or replace function public.farm_ref_info() returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); me players; anon boolean;
begin
  if uid is null then raise exception '請先登入'; end if;
  select * into me from players where id = uid;
  if me.id is null then raise exception '請先登入'; end if;
  if me.ref_code is null then update players set ref_code = _ref_gen() where id = uid returning * into me; end if;
  select coalesce(is_anonymous, false) into anon from auth.users where id = uid;
  return jsonb_build_object('code', me.ref_code, 'anon', anon,
    'can_use', me.ref_by is null and me.created_at > now() - interval '7 days',
    'used_by', (select nickname from players where id = me.ref_by),
    'list', coalesce((select jsonb_agg(jsonb_build_object('name', p.nickname, 'lv', p.lv, 'at', p.ref_at,
        's2', exists (select 1 from ref_log r where r.invitee = p.id and r.stage in (2, 12)), 's3', exists (select 1 from ref_log r where r.invitee = p.id and r.stage in (3, 13))) order by p.ref_at desc)
      from players p where p.ref_by = uid), '[]'::jsonb),
    'lv5', (select count(*) from ref_log where inviter = uid and stage = 2));
end $$;

create or replace function public.farm_ref_use(p_code text) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); me players; inv players; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then raise exception '請先登入'; end if;
  perform _guard(uid);
  if exists (select 1 from auth.users where id = uid and is_anonymous) then raise exception '試玩帳號不能填邀請碼，請先到「設定」綁定帳號'; end if;
  select * into me from players where id = uid for update;
  if me.ref_by is not null then raise exception '你已經填過邀請碼了'; end if;
  if me.created_at < now() - interval '7 days' then raise exception '邀請碼只能在註冊 7 天內填寫'; end if;
  select * into inv from players where ref_code = c;
  if inv.id is null then raise exception '找不到這個邀請碼，請再確認一次'; end if;
  if inv.id = uid then raise exception '不能填自己的邀請碼喔'; end if;
  if inv.ref_by = uid then raise exception '你們已經互相邀請過了'; end if;
  update players set ref_by = inv.id, ref_at = now() where id = uid;
  insert into ref_log(invitee, stage, inviter) values (uid, 1, inv.id) on conflict do nothing;
  update friends set status = 'accepted' where (from_id = uid and to_id = inv.id) or (from_id = inv.id and to_id = uid);
  if not found then insert into friends(from_id, to_id, status) values (inv.id, uid, 'accepted') on conflict do nothing; end if;
  perform _ref_gift(uid, '🎁 新人見面禮', '你填了 ' || inv.nickname || ' 的邀請碼，你們已經自動成為好友！升到 Lv5、Lv10 還有更多獎勵～', '{"gems":30,"seeds":{"gapple":3}}');
  if (select count(*) from ref_log where inviter = inv.id and stage = 1) <= 30 then
    perform _ref_gift(inv.id, '💌 有朋友填了你的邀請碼', me.nickname || ' 填了你的邀請碼，你們已經是好友了！他升到 Lv5、Lv10 時你還會再拿到獎勵～', '{"gems":20}');
  end if;
  -- 填碼前就已經達到的等級不補發（避免老帳號洗獎勵）
  if me.lv >= 5 then insert into ref_log(invitee, stage, inviter) values (uid, 12, inv.id) on conflict do nothing; end if;
  if me.lv >= 10 then insert into ref_log(invitee, stage, inviter) values (uid, 13, inv.id) on conflict do nothing; end if;
  perform _ref_check(uid);
  return jsonb_build_object('ok', true, 'name', inv.nickname);
end $$;
grant execute on function public.farm_ref_info(), public.farm_ref_use(text) to authenticated;

-- 掛到升級流程
do $do$
declare d text;
begin
  select pg_get_functiondef('public._lv_gifts'::regproc) into d;
  if d !~ '_ref_check' then
    d := replace(d, E'select * into me from players where id = p_uid for update;', E'begin perform _ref_check(p_uid); exception when others then null; end;\n  select * into me from players where id = p_uid for update;');
    execute d;
  end if;
end $do$;
