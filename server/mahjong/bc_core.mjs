// 百家樂：牌桌狀態機（純邏輯，不碰資料庫）。跟系統對賭，不需要電腦補位
import BC from './bc_engine.mjs';

export const BT = { BET: 10000, DEAL: 7000, END: 4500, SHUFFLE: 3500, SLIDE: 900 };
// 開牌動畫要多久：4 張各 0.7 秒，補牌各 1 秒，再停 1.2 秒看結果
const dealMs = (r) => BT.SLIDE + 4 * 700 + (r.p.length - 2 + r.b.length - 2) * 1000 + 1500;   // 先滑牌出來，再一張一張翻

export function newTable(lvl, priv, host, me, now) {
  return { lvl, priv, host, game: 'bc', status: 'play',
    state: { players: [{ ...me, gold: null, bets: {} }], phase: 'start', round: 0, tEnd: now, shoe: [], hist: [], log: [], leaving: [], pet: 'bunny' } };
}
export function humans(T) { return T.status === 'play' ? T.state.players.map(p => p.uid) : []; }
export function addPlayer(T, me, now) {
  const G = T.state;
  if (G.players.some(p => p.uid === me.uid)) return;
  if (G.players.length >= BC.MAXP) throw new Error('這桌滿了');
  G.players.push({ ...me, gold: null, bets: {} });
}
function startRound(G, now) {
  G.round++; G.phase = 'bet'; G.tEnd = now + BT.BET; G.cards = null; G.result = null; G.shufUntil = 0;
  // 牌靴快用完（或剛開桌）：換一副新洗的 8 副牌，牌路從頭開始，先播洗牌動畫再下注
  if (G.shoe.length < 60) { G.shoe = BC.newShoe(); G.hist = []; G.shufUntil = now + BT.SHUFFLE; G.tEnd += BT.SHUFFLE; }
  G.players.forEach(p => { p.bets = {}; p.win = 0; });
  G.pet = BC.PETS[Math.floor(Math.random() * BC.PETS.length)];
}
// 推進：下注時間到 → 開牌 → 結算 → 下一局
export function advance(T, now, gold) {
  const out = { settle: null, kicked: [] };
  const G = T.state;
  for (let i = 0; i < 10; i++) {
    if (T.status !== 'play') break;
    // 新來的人、或每局開始前：先拿到最新金幣
    if (G.players.some(p => p.gold == null) || G.phase === 'start' || (G.phase === 'end' && now >= G.tEnd)) {
      if (!gold) { out.needGold = true; break; }
      G.players.forEach(p => { if (gold[p.uid] != null) p.gold = gold[p.uid]; });
    }
    if (G.phase === 'start') { startRound(G, now); continue; }
    if (G.phase === 'bet') {
      if (now < G.tEnd) break;
      const r = BC.deal(G.shoe);
      G.cards = { p: r.p, b: r.b }; G.result = r; G.phase = 'deal'; G.dealAt = now; G.tEnd = now + dealMs(r);
      G.log.push({ k: 'deal', round: G.round });
      continue;
    }
    if (G.phase === 'deal') {
      if (now < G.tEnd) break;
      const r = G.result, d = {};
      G.players.forEach(p => { const w = BC.payout(p.bets, r); p.win = w; if (w) { d[p.uid] = w; p.gold = Math.max(0, p.gold + w); } });
      out.settle = { hand: G.round, delta: d };
      G.hist.push(r.win + (r.pp ? 'P' : '') + (r.bp ? 'B' : '')); if (G.hist.length > 60) G.hist.splice(0, G.hist.length - 60);
      G.phase = 'end'; G.tEnd = now + BT.END;
      continue;
    }
    if (G.phase === 'end') {
      if (now < G.tEnd) break;
      // 離開的、輸光的人請出去；沒人就關桌
      const BROKE = '你輸光了……回去種田吧！';
      G.players = G.players.filter(p => {
        if (G.leaving.includes(p.uid)) { out.kicked.push({ uid: p.uid, msg: '已經離開牌桌', broke: false }); return false; }
        if ((p.gold ?? 0) <= 0) { out.kicked.push({ uid: p.uid, msg: BROKE, broke: true }); return false; }
        return true;
      });
      G.leaving = [];
      if (!G.players.length) { T.status = 'closed'; break; }
      if (!G.players.some(p => p.uid === T.host)) T.host = G.players[0].uid;
      startRound(G, now); continue;
    }
    break;
  }
  return out;
}
export function dueAt(T) {
  if (T.status !== 'play') return null;
  const G = T.state; if (G.phase === 'start') return 0;
  return G.tEnd;
}
export function playerAct(T, uid, a, now) {
  const G = T.state, me = G.players.find(p => p.uid === uid); if (!me) throw new Error('你不在這桌');
  const TB = BC.TABLES[T.lvl];
  if (a.a === 'clear') { if (G.phase !== 'bet') throw new Error('已經停止下注'); me.bets = {}; return; }
  if (a.a === 'bet') {
    if (G.phase !== 'bet' || now >= G.tEnd) throw new Error('已經停止下注');
    const k = String(a.k), amt = Math.floor(+a.amt || 0);
    if (!BC.AREAS[k]) throw new Error('沒有這個押注區');
    if (!TB.chips.includes(amt)) throw new Error('籌碼不對');
    const total = Object.values(me.bets).reduce((s, x) => s + x, 0) + amt;
    if ((me.bets[k] || 0) + amt > BC.LIMIT[k]) throw new Error(`${BC.AREAS[k].name}每局最多押 ${BC.LIMIT[k].toLocaleString()} 金`);
    if (total > (me.gold || 0)) throw new Error('金幣不夠');
    me.bets[k] = (me.bets[k] || 0) + amt;
    G.log.push({ k: 'bet', uid, area: k, amt });
    if (G.log.length > 60) G.log.splice(0, G.log.length - 60);
    return;
  }
  throw new Error('不支援的動作');
}
export function leave(T, uid, now) {
  const G = T.state, me = G.players.find(p => p.uid === uid); if (!me) return;
  const has = Object.values(me.bets || {}).some(Boolean);
  // 還在下注、或這局沒押：直接離開（押的退回）；已經開牌而且有押：等結算完再離開
  if (G.phase === 'bet' || G.phase === 'start' || !has) { G.players = G.players.filter(p => p.uid !== uid); if (!G.players.length) T.status = 'closed'; else if (T.host === uid) T.host = G.players[0].uid; return; }
  if (!G.leaving.includes(uid)) G.leaving.push(uid);
}
export function viewFor(T, uid, now) {
  const base = { tid: T.id, ver: T.ver || 0, game: 'bc', lvl: T.lvl, priv: T.priv, code: T.priv ? T.code : null, host: T.host === uid, status: T.status, now, due: dueAt(T) };
  if (T.status !== 'play') return base;
  const G = T.state, me = G.players.find(p => p.uid === uid);
  if (!me) return base;
  const tot = {}; G.players.forEach(p => Object.entries(p.bets || {}).forEach(([k, a]) => tot[k] = (tot[k] || 0) + a));
  const showCards = G.phase === 'deal' || G.phase === 'end';
  return { ...base, phase: G.phase, round: G.round, tEnd: G.tEnd, dealAt: G.dealAt, shufUntil: G.shufUntil || 0, shoeLeft: G.shoe.length, pet: G.pet, hist: G.hist,
    me: G.players.indexOf(me), myGold: me.gold, myBets: me.bets, myWin: G.phase === 'end' ? me.win : null, totals: tot,
    players: G.players.map(p => ({ name: p.name, av: p.av, gold: p.gold, bet: Object.values(p.bets || {}).reduce((s, x) => s + x, 0), win: G.phase === 'end' ? p.win : null, me: p.uid === uid })),
    cards: showCards ? G.cards : null, result: G.phase === 'end' ? { win: G.result.win, pt: G.result.pt, bt: G.result.bt, pp: G.result.pp, bp: G.result.bp } : null,
    ticker: G.players[0] && G.players[0].uid === uid, waiting: [], seats: null };
}
