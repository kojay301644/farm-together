// 麻將連線版 Edge Function：讀牌桌 → 動作／推進 → 存回（版本號防同時寫入）→ 更新每位玩家的畫面
import { createClient } from 'npm:@supabase/supabase-js@2';
import MJ from './mj_engine.mjs';
import B2 from './b2_engine.mjs';
import BC from './bc_engine.mjs';
import TH from './th_engine.mjs';
const ENG = (g: string) => (g === 'b2' ? B2 : g === 'bc' ? BC : g === 'th' ? TH : MJ);
// 德州撲克：帶入籌碼先扣金幣、離桌換回金幣
async function thBuyin(uid: string, amt: number) { const { error } = await sb.rpc('th_buyin', { p_uid: uid, p_amt: amt }); if (error) throw new Fail(error.message.includes('gold') ? '金幣不夠' : '金幣不夠'); }
async function thBank(d: Record<string, number>) { const k = Object.keys(d).filter(u => d[u] > 0); if (!k.length) return; const o: Record<string, number> = {}; k.forEach(u => o[u] = Math.floor(d[u])); await sb.rpc('th_bank', { p_delta: o }); }
const thAmt = (lvl: string, x: any) => { const T = TH.TABLES[lvl]; const n = Math.floor(+x || T.buyMax); if (n < T.buyMin || n > T.buyMax) throw new Fail(`帶入籌碼要在 ${T.buyMin.toLocaleString()}～${T.buyMax.toLocaleString()} 之間`); return n; };
import * as C from './core.mjs';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mj-test', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
class Fail extends Error {}
let OFF = 0; const NOW = () => Date.now() + OFF;   // OFF 只在測試模擬時使用

async function me(uid: string) {
  const { data } = await sb.from('players').select('id,nickname,avatar,gold,banned').eq('id', uid).maybeSingle();
  if (!data) throw new Fail('找不到玩家資料');
  if (data.banned) throw new Fail('帳號已停權');
  return { uid, name: data.nickname || '玩家', av: data.avatar || 11, gold: data.gold || 0 };
}
async function golds(uids: string[]) {
  if (!uids.length) return {};
  const { data } = await sb.from('players').select('id,gold').in('id', uids);
  const g: Record<string, number> = {}; (data || []).forEach((p: any) => g[p.id] = p.gold || 0); return g;
}
async function load(id: number) { const { data } = await sb.from('mj_tables').select('*').eq('id', id).maybeSingle(); return data; }
async function myTableId(uid: string) { const { data } = await sb.from('mj_views').select('table_id').eq('uid', uid).maybeSingle(); return data?.table_id || null; }

// 農場電腦名單（會種菜的那些）：金幣是農場的真金幣；正坐在別桌的不能再上桌。快取 15 秒
let POOLC: { at: number, list: any[], busy: Record<string, number> } = { at: 0, list: [], busy: {} };
async function botPool(tid: number) {
  if (Date.now() - POOLC.at > 15000) {
    const { data: B } = await sb.from('bots').select('id,style').eq('active', true);
    const sty: Record<string, string> = {}; (B || []).forEach((b: any) => sty[b.id] = b.style);
    const ids = (B || []).map((b: any) => b.id);
    const { data: P } = ids.length ? await sb.from('players').select('id,nickname,avatar,gold').in('id', ids) : { data: [] as any[] };
    const { data: L } = await sb.from('mj_tables').select('id,game,state').in('status', ['wait', 'play']).in('game', ['mj', 'b2', 'th', 'bc']);
    const busy: Record<string, number> = {};
    for (const t of L || []) for (const id of C.botIds({ ...t, status: 'play' })) busy[id] = t.id;
    POOLC = { at: Date.now(), busy, list: (P || []).map((p: any) => ({ id: p.id, name: p.nickname || '農夫', av: p.avatar || 11, gold: p.gold || 0, style: sty[p.id] })) };
  }
  return POOLC.list.filter(b => !POOLC.busy[b.id] || POOLC.busy[b.id] === tid).map(b => ({ ...b }));
}

// 讀 → 改 → 存（版本衝突就重來）
async function mutate(id: number, fn: (T: any, now: number) => Promise<any> | any) {
  for (let k = 0; k < 6; k++) {
    const T = await load(id); if (!T) throw new Fail('牌桌不存在');
    const now = NOW(), before = T.ver;
    try { C.setBots(await botPool(id)); } catch { C.setBots([]); }
    const r = await fn(T, now);
    let out = C.advance(T, now, null);
    if (out.needGold) { const g = await golds(C.humans(T).concat((T.state.pending || []).map((p: any) => p.uid), C.botIds(T))); out = { ...C.advance(T, now, g), settle: out.settle || null, botBank: out.botBank }; }
    const nh = C.humans(T).length;
    const { data: upd } = await sb.from('mj_tables').update({ state: T.state, status: T.status, host: T.host, ver: before + 1, nh, updated_at: new Date().toISOString() }).eq('id', id).eq('ver', before).select('id');
    if (!upd || !upd.length) { await new Promise(r => setTimeout(r, 40 + Math.random() * 80)); continue; }
    T.ver = before + 1;
    // 結算一定要先做完；推畫面給其他人改成回覆後在背景做，自己的回覆比較快
    if (out.bank) await thBank(out.bank);
    if (out.botBank && Object.keys(out.botBank).length) { await sb.rpc('mj_bot_gold', { p_delta: out.botBank }); POOLC.at = 0; }   // 農場電腦德州帶入／換回
    for (const b of C.botIds(T)) POOLC.busy[b] = T.id;   // 剛坐下的電腦先記著，別桌不要再拉他
    if (out.log) await sb.rpc('th_log', { p_tid: id, p_hand: out.log.hand, p_pay: out.log.delta, p_house: Math.round(out.log.house || 0) });
    if (out.settle) await sb.rpc('mj_settle2', { p_tid: id, p_hand: out.settle.hand, p_delta: out.settle.delta, p_game: T.game || 'mj', p_house: Math.round(out.settle.house || 0) });
    const push = pushViews(T, now, out.kicked || []);
    try { (globalThis as any).EdgeRuntime?.waitUntil ? (globalThis as any).EdgeRuntime.waitUntil(push) : await push; } catch { await push; }
    return { T, r };
  }
  throw new Fail('太多人同時操作，請再試一次');
}
async function pushViews(T: any, now: number, kicked: string[]) {
  const gone = (T.state && T.state.leaving) || [];   // 已經按離開的人：不要再把他拉回這桌
  const rows = C.humans(T).map(u => ({ uid: u, table_id: T.status === 'closed' || gone.includes(u) ? null : T.id, view: C.viewFor(T, u, now), seq: T.ver, updated_at: new Date().toISOString() }));
  for (const k of kicked as any[]) rows.push({ uid: k.uid, table_id: null, view: { status: 'kicked', msg: k.msg, broke: !!k.broke, tid: T.id }, seq: T.ver, updated_at: new Date().toISOString() });
  if (rows.length) await sb.from('mj_views').upsert(rows);
}
const viewOf = (T: any, uid: string) => C.viewFor(T, uid, NOW());

async function joinTable(uid: string, a: string, b: any) {
  const cur = await myTableId(uid);
  if (cur) { const T = await load(cur); if (T && T.status !== 'closed' && C.humans(T).includes(uid)) return { view: viewOf(T, uid) }; }
  const p = await me(uid);
  if (a === 'join') {
    const { data: L } = await sb.from('mj_tables').select('id,lvl,game').eq('code', String(b.code || '')).in('status', ['wait', 'play']).limit(1);
    if (!L || !L.length) throw new Fail('找不到這個房號');
    const TB = ENG(L[0].game).TABLES[L[0].lvl];
    if (p.gold < TB.min) throw new Fail(`這桌要 ${TB.min.toLocaleString()} 金幣才能坐`);
    if (L[0].game === 'th') {
      const amt = thAmt(L[0].lvl, b.buyin); await thBuyin(uid, amt);
      try { const { T } = await mutate(L[0].id, (T: any, now: number) => C.addPlayer(T, { uid, name: p.name, av: p.av, buyin: amt }, now)); return { view: viewOf(T, uid) }; }
      catch (e) { await thBank({ [uid]: amt }); throw e; }
    }
    const { T } = await mutate(L[0].id, (T: any, now: number) => C.addPlayer(T, { uid, name: p.name, av: p.av }, now));
    return { view: viewOf(T, uid) };
  }
  const game = ['b2', 'bc', 'th'].includes(b.game) ? b.game : 'mj', lvl = b.lvl;
  if (game === 'bc' && a === 'create') throw new Fail('百家樂不能開房，請直接進入牌桌'); const TB = ENG(game).TABLES[lvl]; if (!TB) throw new Fail('沒有這種桌');
  if (p.gold < TB.min) throw new Fail(`這桌要 ${TB.min.toLocaleString()} 金幣才能坐`);
  if (a === 'quick') {
    // 百家樂：系統桌一直開著（就算沒人），先進最早開的那桌
    const q0 = sb.from('mj_tables').select('id,status,nh').eq('game', game).eq('lvl', lvl).eq('priv', false).in('status', ['wait', 'play']).lt('nh', game === 'bc' ? BC.MAXP : game === 'th' ? TH.SEATS : 4);
    const { data: L } = game === 'bc' ? await q0.order('id', { ascending: true }).limit(5)
      : await q0.gt('nh', 0).gt('updated_at', new Date(Date.now() - 120e3).toISOString()).order('status', { ascending: false }).order('nh', { ascending: false }).limit(5);
    const amt0 = game === 'th' ? thAmt(lvl, b.buyin) : 0;
    if (game === 'th') await thBuyin(uid, amt0);
    for (const t of (L || [])) {
      try { const { T } = await mutate(t.id, (T: any, now: number) => C.addPlayer(T, { uid, name: p.name, av: p.av, buyin: amt0 }, now)); return { view: viewOf(T, uid) }; } catch (e) { if (!(e instanceof Fail) && !(e instanceof Error)) throw e; }
    }
    if (game === 'th') await thBank({ [uid]: amt0 });   // 沒找到桌：先退回，下面開新桌再扣
  }
  const now = NOW(), priv = a === 'create';
  let code = null;
  if (priv) for (let k = 0; k < 20; k++) { const c = String(1000 + Math.floor(Math.random() * 9000)); const { data: ex } = await sb.from('mj_tables').select('id').eq('code', c).in('status', ['wait', 'play']).limit(1); if (!ex || !ex.length) { code = c; break; } }
  const buyin = game === 'th' ? thAmt(lvl, b.buyin) : 0;
  if (game === 'th') await thBuyin(uid, buyin);
  const T = C.newTable(lvl, priv, uid, { uid, name: p.name, av: p.av, buyin }, now, game);
  const { data: ins, error } = await sb.from('mj_tables').insert({ game, lvl, priv, code, host: uid, status: T.status, state: T.state, nh: 1 }).select('*').single();
  if (error) { if (game === 'th') await thBank({ [uid]: buyin }); throw new Fail('開桌失敗'); }
  await pushViews(ins, now, []);
  return { view: viewOf(ins, uid) };
}

// 排程每分鐘呼叫：麻將／大老二的桌子超過 2 分鐘都沒動（代表桌上沒有真人在線上，不會有人推進），
// 就把桌上的真人都當作離開，讓電腦把這局打完、結算、散桌。不然會卡到有人回來才繼續打
async function sweep() {
  const cut = new Date(Date.now() - 120000).toISOString();
  const { data: L } = await sb.from('mj_tables').select('id').eq('status', 'play').in('game', ['mj', 'b2']).lt('updated_at', cut).limit(20);
  const done: number[] = [];
  for (const r of L || []) {
    try {
      await mutate(r.id, (T: any, now: number) => { for (const u of C.humans(T)) C.leave(T, u, now); });
      done.push(r.id);
    } catch (e) { console.error('sweep', r.id, e); }
  }
  return { swept: done };
}

async function handle(uid: string, b: any, test = false) {
  const a = b.a;
  if (a === 'sim' && test) {   // 測試：把時間快轉到下一個事件，連跑 n 步
    const tid = await myTableId(uid); if (!tid) throw new Fail('no table');
    const log: any[] = [];
    for (let k = 0; k < Math.min(400, b.steps || 50); k++) {
      const T0 = await load(tid); if (!T0 || T0.status === 'closed') break;
      const due = C.dueAt(T0); if (due != null && due > NOW()) OFF += due - NOW() + 1;
      const { T } = await mutate(tid, () => {});
      if (T.status === 'play' && T.state.phase === 'end' && !log.some(x => x.hand === T.state.handNo)) log.push({ hand: T.state.handNo, pay: T.state.result.pay, uids: T.state.uids, draw: !!T.state.result.draw });
    }
    OFF = 0; const T = await load(tid);
    return { log, gold: await golds([uid]), view: viewOf(T, uid), ver: T.ver };
  }
  if (a === 'state' || a === 'tick') {
    const tid = await myTableId(uid); if (!tid) return { view: null };
    const T0 = await load(tid); if (!T0 || T0.status === 'closed') { await sb.from('mj_views').upsert({ uid, table_id: null, view: null, seq: 0 }); return { view: null }; }
    const due = C.dueAt(T0);
    if (a === 'state' && (due == null || due > NOW())) return { view: viewOf(T0, uid) };
    const { T } = await mutate(tid, () => {}); return { view: viewOf(T, uid) };
  }
  if (a === 'quick' || a === 'create' || a === 'join') {
    // 連點兩下：第二下要等第一下做完，避免同時坐進兩桌（德州撲克會被扣兩次帶入籌碼）
    const { data: okLock } = await sb.rpc('mj_join_lock', { p_uid: uid });
    if (!okLock) throw new Fail('正在進入牌桌，請稍等');
    try { return await joinTable(uid, a, b); } finally { await sb.rpc('mj_join_unlock', { p_uid: uid }); }
  }
  const tid = await myTableId(uid); if (!tid) throw new Fail('你不在牌桌上');
  if (a === 'leave') {
    const { T } = await mutate(tid, (T: any, now: number) => C.leave(T, uid, now));
    await sb.from('mj_views').upsert({ uid, table_id: null, view: null, seq: T.ver });
    return { view: null, gold: (await golds([uid]))[uid] };
  }
  if (a === 'start') { const { T } = await mutate(tid, (T: any, now: number) => { if (T.status !== 'wait' || T.host !== uid) throw new Fail('只有房主可以開始'); T.state.wait.startAt = now; }); return { view: viewOf(T, uid) }; }
  if (a === 'act' && b.act && b.act.a === 'rebuy') {   // 德州撲克補籌碼
    const T0 = await load(tid); if (!T0 || T0.game !== 'th') throw new Fail('不支援的動作');
    const TB = TH.TABLES[T0.lvl], me0 = (T0.state.seats || []).find((x: any) => x && x.uid === uid);
    if (!me0) throw new Fail('你不在座位上');
    const room = TB.buyMax - me0.stack - (me0.rebuy || 0), amt = Math.min(room, Math.floor(+b.act.amt || 0));
    if (amt < TB.bb) throw new Fail('籌碼已經是上限了');
    await thBuyin(uid, amt);
    try { const { T } = await mutate(tid, (T: any, now: number) => C.playerAct(T, uid, { a: 'rebuy', amt }, now)); return { view: viewOf(T, uid), gold: (await golds([uid]))[uid] }; }
    catch (e) { await thBank({ [uid]: amt }); throw e; }
  }
  if (a === 'act' || a === 'ready' || a === 'auto') {
    const act = a === 'act' ? b.act : a === 'ready' ? { a: 'ready' } : { a: 'auto', on: !!b.on };
    const { T } = await mutate(tid, (T: any, now: number) => { try { C.playerAct(T, uid, act, now); } catch (e) { throw new Fail((e as Error).message); } });
    return { view: viewOf(T, uid) };
  }
  throw new Fail('不支援的動作');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    let uid: string | null = null;
    const tk = req.headers.get('x-mj-test');
    if (tk) { const { data } = await sb.from('push_config').select('v').eq('k', 'mj_test_key').maybeSingle(); if (data && data.v && tk === data.v) { if (b.a === 'sweep') return J(await sweep()); uid = b.as; } }
    if (!uid) { const token = (req.headers.get('Authorization') || '').replace('Bearer ', ''); const { data } = await sb.auth.getUser(token); uid = data?.user?.id || null; }
    if (!uid) return J({ error: '請先登入' }, 401);
    const { data: on } = await sb.from('settings').select('value').eq('key', 'mj_on').maybeSingle();
    if (on && String(on.value) === '0') return J({ error: '麻將維護中，等等再來' }, 200);
    return J(await handle(uid, b, !!tk && b.as === uid));
  } catch (e) {
    if (e instanceof Fail) return J({ error: e.message });
    console.error(e); return J({ error: (e as Error).message || '伺服器錯誤' });
  }
});
