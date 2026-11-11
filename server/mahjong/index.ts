// 麻將連線版 Edge Function：讀牌桌 → 動作／推進 → 存回（版本號防同時寫入）→ 更新每位玩家的畫面
import { createClient } from 'npm:@supabase/supabase-js@2';
import MJ from './mj_engine.mjs';
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

// 讀 → 改 → 存（版本衝突就重來）
async function mutate(id: number, fn: (T: any, now: number) => Promise<any> | any) {
  for (let k = 0; k < 6; k++) {
    const T = await load(id); if (!T) throw new Fail('牌桌不存在');
    const now = NOW(), before = T.ver;
    const r = await fn(T, now);
    let out = C.advance(T, now, null);
    if (out.needGold) { const g = await golds(C.humans(T).concat((T.state.pending || []).map((p: any) => p.uid))); out = { ...C.advance(T, now, g), settle: out.settle || null }; }
    const nh = C.humans(T).length;
    const { data: upd } = await sb.from('mj_tables').update({ state: T.state, status: T.status, host: T.host, ver: before + 1, nh, updated_at: new Date().toISOString() }).eq('id', id).eq('ver', before).select('id');
    if (!upd || !upd.length) { await new Promise(r => setTimeout(r, 40 + Math.random() * 80)); continue; }
    T.ver = before + 1;
    if (out.settle) await sb.rpc('mj_settle', { p_tid: id, p_hand: out.settle.hand, p_delta: out.settle.delta });
    await pushViews(T, now, out.kicked || []);
    return { T, r };
  }
  throw new Fail('太多人同時操作，請再試一次');
}
async function pushViews(T: any, now: number, kicked: string[]) {
  const rows = C.humans(T).map(u => ({ uid: u, table_id: T.status === 'closed' ? null : T.id, view: C.viewFor(T, u, now), seq: T.ver, updated_at: new Date().toISOString() }));
  for (const u of kicked) rows.push({ uid: u, table_id: null, view: { status: 'kicked', msg: '金幣不夠，已經離開牌桌', tid: T.id }, seq: T.ver, updated_at: new Date().toISOString() });
  if (rows.length) await sb.from('mj_views').upsert(rows);
}
const viewOf = (T: any, uid: string) => C.viewFor(T, uid, NOW());

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
    const cur = await myTableId(uid);
    if (cur) { const T = await load(cur); if (T && T.status !== 'closed' && C.humans(T).includes(uid)) return { view: viewOf(T, uid) }; }
    const p = await me(uid);
    if (a === 'join') {
      const { data: L } = await sb.from('mj_tables').select('id,lvl').eq('code', String(b.code || '')).in('status', ['wait', 'play']).limit(1);
      if (!L || !L.length) throw new Fail('找不到這個房號');
      if (p.gold < MJ.TABLES[L[0].lvl].min) throw new Fail(`這桌要 ${MJ.TABLES[L[0].lvl].min.toLocaleString()} 金幣才能坐`);
      const { T } = await mutate(L[0].id, (T: any, now: number) => C.addPlayer(T, { uid, name: p.name, av: p.av }, now));
      return { view: viewOf(T, uid) };
    }
    const lvl = b.lvl; if (!MJ.TABLES[lvl]) throw new Fail('沒有這種桌');
    if (p.gold < MJ.TABLES[lvl].min) throw new Fail(`這桌要 ${MJ.TABLES[lvl].min.toLocaleString()} 金幣才能坐`);
    if (a === 'quick') {
      const { data: L } = await sb.from('mj_tables').select('id,status,nh').eq('lvl', lvl).eq('priv', false).in('status', ['wait', 'play']).lt('nh', 4).gt('nh', 0)
        .gt('updated_at', new Date(Date.now() - 120e3).toISOString()).order('status', { ascending: false }).order('nh', { ascending: false }).limit(5);
      for (const t of (L || [])) {
        try { const { T } = await mutate(t.id, (T: any, now: number) => C.addPlayer(T, { uid, name: p.name, av: p.av }, now)); return { view: viewOf(T, uid) }; } catch (e) { if (!(e instanceof Fail) && !(e instanceof Error)) throw e; }
      }
    }
    const now = NOW(), priv = a === 'create';
    let code = null;
    if (priv) for (let k = 0; k < 20; k++) { const c = String(1000 + Math.floor(Math.random() * 9000)); const { data: ex } = await sb.from('mj_tables').select('id').eq('code', c).in('status', ['wait', 'play']).limit(1); if (!ex || !ex.length) { code = c; break; } }
    const T = C.newTable(lvl, priv, uid, { uid, name: p.name, av: p.av }, now);
    const { data: ins, error } = await sb.from('mj_tables').insert({ lvl, priv, code, host: uid, status: T.status, state: T.state, nh: 1 }).select('*').single();
    if (error) throw new Fail('開桌失敗');
    await pushViews(ins, now, []);
    return { view: viewOf(ins, uid) };
  }
  const tid = await myTableId(uid); if (!tid) throw new Fail('你不在牌桌上');
  if (a === 'leave') {
    const { T } = await mutate(tid, (T: any, now: number) => C.leave(T, uid, now));
    await sb.from('mj_views').upsert({ uid, table_id: null, view: null, seq: T.ver });
    return { view: null, gold: (await golds([uid]))[uid] };
  }
  if (a === 'start') { const { T } = await mutate(tid, (T: any, now: number) => { if (T.status !== 'wait' || T.host !== uid) throw new Fail('只有房主可以開始'); T.state.wait.startAt = now; }); return { view: viewOf(T, uid) }; }
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
    if (tk) { const { data } = await sb.from('push_config').select('v').eq('k', 'mj_test_key').maybeSingle(); if (data && data.v && tk === data.v) uid = b.as; }
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
