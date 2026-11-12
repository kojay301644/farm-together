// 百家樂：牌桌狀態機（純邏輯，不碰資料庫）。跟系統對賭；愛賭博的農場電腦會來一起押
import BC from './bc_engine.mjs';

export const BT = { BET: 15000, DEAL: 7000, END: 4500, SHUFFLE: 3500, SLIDE: 900 };
// 開牌動畫要多久：4 張各 0.7 秒，補牌各 1 秒，再停 1.2 秒看結果
const dealMs = (r) => BT.SLIDE + 4 * 700 + (r.p.length - 2 + r.b.length - 2) * 1500 + 1500;   // 先滑牌出來，再一張一張翻

// 愛賭博的農場電腦：有真人在桌上時，1～3 個會坐下來押（用自己農場的金幣）
let POOL = [];
export function setBots(list) { POOL = list || []; }
const CH = [100, 500, 1000, 5000];
function manageBots(G) {
  G.bots = G.bots || [];
  const humans = G.players.length;
  if (!humans) { G.bots = []; G.botWant = 0; return; }
  if (!G.botWant || Math.random() < 0.1) G.botWant = 1 + Math.floor(Math.random() * 3);
  const cap = Math.max(0, Math.min(G.botWant, BC.MAXP - humans));
  G.bots = G.bots.filter((b, i) => b.gold >= 1000 && Math.random() > 0.08 && i < cap);   // 輸太多、或玩膩了就走
  const used = G.bots.map(b => b.bid), names = G.players.map(p => p.name);
  const F = POOL.filter(b => b.style === 'gambler' && b.gold >= 3000 && !used.includes(b.id) && !names.includes(b.name));
  while (G.bots.length < cap && F.length) {
    const b = F.splice(Math.floor(Math.random() * F.length), 1)[0];
    G.bots.push({ bid: b.id, name: b.name, av: b.av, gold: b.gold, bets: {}, win: 0, plan: [] });
  }
}
// 每局開始時先想好要押什麼，下注時間內分幾次押下去
function planBets(G, now) {
  const t0 = Math.max(now, G.shufUntil || 0) + 1500, t1 = G.tEnd - 1500;
  const at = () => Math.floor(t0 + Math.random() * Math.max(500, t1 - t0));
  const last = (G.hist[G.hist.length - 1] || '')[0];
  for (const b of G.bots) {
    b.bets = {}; b.win = 0; b.plan = [];
    if (Math.random() < 0.12) continue;   // 這局看看就好
    const unit = CH.filter(c => c <= b.gold * 0.05).pop() || 100;
    const side = (last === 'p' || last === 'b') && Math.random() < 0.6 ? last : (Math.random() < 0.5 ? 'p' : 'b');   // 跟路或隨便押
    const k = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < k; i++) b.plan.push({ k: side, amt: unit, at: at() });
    if (Math.random() < 0.15) b.plan.push({ k: 't', amt: Math.min(unit, 500), at: at() });
    if (Math.random() < 0.1) b.plan.push({ k: Math.random() < 0.5 ? 'pp' : 'bp', amt: Math.min(unit, 500), at: at() });
    b.plan.sort((x, y) => x.at - y.at);
  }
}
function applyPlans(G, now) {
  for (const b of G.bots || []) {
    while (b.plan.length && b.plan[0].at <= now) {
      const x = b.plan.shift(), tot = Object.values(b.bets).reduce((a, v) => a + v, 0);
      if ((b.bets[x.k] || 0) + x.amt > BC.BOT_LIMIT[x.k] || tot + x.amt > b.gold) continue;
      b.bets[x.k] = (b.bets[x.k] || 0) + x.amt;
    }
  }
}
const nextPlan = (G) => Math.min(...(G.bots || []).map(b => (b.plan[0] ? b.plan[0].at : Infinity)));

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
  manageBots(G); planBets(G, now);
}
// 推進：下注時間到 → 開牌 → 結算 → 下一局
export function advance(T, now, gold) {
  const out = { settle: null, kicked: [] };
  const G = T.state;
  // 系統桌一直在發牌：沒人看的時候不會有人推進，有人進來時把這段時間該開的局一次補上（照樣用同一副牌靴、記進牌路）
  const ROUND = BT.BET + 7500 + BT.END;
  const noBets = G.players.filter(p => p.gold != null).every(p => !Object.values(p.bets || {}).some(Boolean));
  if (G.phase !== 'start' && noBets && now - G.tEnd > 30000) {
    const n = Math.min(80, Math.floor((now - G.tEnd) / ROUND));
    for (let k = 0; k < n; k++) {
      if (G.shoe.length < 60) { G.shoe = BC.newShoe(); G.hist = []; }
      const r = BC.deal(G.shoe); G.round++;
      G.hist.push(r.win + (r.pp ? 'P' : '') + (r.bp ? 'B' : '')); if (G.hist.length > 60) G.hist.splice(0, G.hist.length - 60);
    }
    G.phase = 'end'; G.tEnd = now; G.result = null; G.cards = null; G.bots = [];
    // 這段時間沒人推進＝桌上的人都已經不在了：請他們離桌（剛進來的人金幣還沒讀到，留著）
    G.players = G.players.filter(p => { if (p.gold == null) return true; out.kicked.push({ uid: p.uid, msg: '太久沒動作，已離開百家樂', broke: false }); return false; });
  }
  for (let i = 0; i < 10; i++) {
    if (T.status !== 'play') break;
    // 新來的人、或每局開始前：先拿到最新金幣
    if (G.players.some(p => p.gold == null) || G.phase === 'start' || (G.phase === 'end' && now >= G.tEnd)) {
      if (!gold) { out.needGold = true; break; }
      G.players.forEach(p => { if (gold[p.uid] != null) p.gold = gold[p.uid]; });
      (G.bots || []).forEach(b => { if (gold[b.bid] != null) b.gold = gold[b.bid]; });
    }
    if (G.phase === 'start') { startRound(G, now); continue; }
    if (G.phase === 'bet') {
      applyPlans(G, Math.min(now, G.tEnd));
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
      (G.bots || []).forEach(b => { const w = BC.payout(b.bets, r); b.win = w; if (w) { d[b.bid] = w; b.gold = Math.max(0, b.gold + w); } });
      out.settle = { hand: G.round, delta: d, house: -Object.values(d).reduce((a, b) => a + b, 0) };   // 娛樂廳（莊家）這局賺賠
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
        if (p.gold != null && p.gold <= 0) { out.kicked.push({ uid: p.uid, msg: BROKE, broke: true }); return false; }
        return true;
      });
      G.leaving = [];
      // 沒人也不關桌：系統桌一直開著，牌靴和牌路接著用
      if (G.players.length && !G.players.some(p => p.uid === T.host)) T.host = G.players[0].uid;
      startRound(G, now); continue;
    }
    break;
  }
  return out;
}
export function dueAt(T) {
  if (T.status !== 'play') return null;
  const G = T.state; if (G.phase === 'start') return 0;
  if (G.phase === 'bet') return Math.min(G.tEnd, nextPlan(G));   // 電腦要押注的時間也要推進
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
  if (G.phase === 'bet' || G.phase === 'start' || !has) { G.players = G.players.filter(p => p.uid !== uid); if (G.players.length && T.host === uid) T.host = G.players[0].uid; return; }
  if (!G.leaving.includes(uid)) G.leaving.push(uid);
}
export function viewFor(T, uid, now) {
  const base = { tid: T.id, ver: T.ver || 0, game: 'bc', lvl: T.lvl, priv: T.priv, code: T.priv ? T.code : null, host: T.host === uid, status: T.status, now, due: dueAt(T) };
  if (T.status !== 'play') return base;
  const G = T.state, me = G.players.find(p => p.uid === uid);
  if (!me) return base;
  const tot = {}; G.players.concat(G.bots || []).forEach(p => Object.entries(p.bets || {}).forEach(([k, a]) => tot[k] = (tot[k] || 0) + a));
  const showCards = G.phase === 'deal' || G.phase === 'end';
  return { ...base, lim: Object.fromEntries(Object.entries(BC.LIMIT).map(([k, v]) => [k, isFinite(v) ? v : 0])), phase: G.phase, round: G.round, tEnd: G.tEnd, dealAt: G.dealAt, shufUntil: G.shufUntil || 0, shoeLeft: G.shoe.length, pet: G.pet, hist: G.hist,
    me: G.players.indexOf(me), myGold: me.gold, myBets: me.bets, myWin: G.phase === 'end' ? me.win : null, totals: tot,
    players: G.players.concat(G.bots || []).map(p => ({ name: p.name, av: p.av, gold: p.gold, bet: Object.values(p.bets || {}).reduce((s, x) => s + x, 0), win: G.phase === 'end' ? p.win : null, me: !!p.uid && p.uid === uid })),
    cards: showCards ? G.cards : null, result: G.phase === 'end' ? { win: G.result.win, pt: G.result.pt, bt: G.result.bt, pp: G.result.pp, bp: G.result.bp } : null,
    ticker: G.players[0] && G.players[0].uid === uid, waiting: [], seats: null };
}
