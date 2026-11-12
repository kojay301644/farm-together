// 沒有真人在玩的時候：愛賭博的農場電腦在背景自己湊桌打幾局（直接算出結果，不開牌桌畫面）
import MJ from './mj_engine.mjs';
import B2 from './b2_engine.mjs';
import BC from './bc_engine.mjs';

const pick = (L, n) => { const a = L.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return out; };

// 麻將／大老二：4 個電腦打 hands 局。回傳每局 { pay: {id: 輸贏}, rake }
export function playCards(game, lvl, bots, hands) {
  const E = game === 'b2' ? B2 : MJ;
  const G = E.newGame(bots.map(b => ({ id: b.id, name: b.name, av: b.av, bot: true, gold: b.gold })), { table: lvl, dealer: Math.floor(Math.random() * 4) });
  const out = [];
  for (let h = 0; h < hands; h++) {
    if (h > 0) E.nextHand(G);
    for (let k = 0; k < 3000 && G.phase !== 'end'; k++) {
      const w = E.waitingOn(G); if (!w.length) break;
      E.autoAct(G, w[0], true);
    }
    if (G.phase !== 'end' || !G.result) break;
    const pay = {}; G.seats.forEach((s, j) => { const x = (G.result.pay || [])[j] || 0; if (x) pay[s.id] = x; });
    out.push({ pay, rake: G.result.rake || 0 });
    if (G.seats.some(s => s.gold < E.TABLES[lvl].min)) break;   // 有人輸到不夠坐這桌就散
  }
  return out;
}

// 百家樂：幾個電腦一起押 rounds 局
export function playBaccarat(bots, rounds) {
  let shoe = BC.newShoe(); const hist = [], out = [];
  const gold = Object.fromEntries(bots.map(b => [b.id, b.gold]));
  for (let r = 0; r < rounds; r++) {
    if (shoe.length < 60) shoe = BC.newShoe();
    const res = BC.deal(shoe), last = hist[hist.length - 1], pay = {};
    for (const b of bots) {
      if (gold[b.id] < 1000 || Math.random() < 0.15) continue;
      const unit = [100, 500, 1000, 5000].filter(c => c <= gold[b.id] * 0.05).pop() || 100;
      const side = last && Math.random() < 0.6 ? last : (Math.random() < 0.5 ? 'p' : 'b');
      const bets = { [side]: unit * (1 + Math.floor(Math.random() * 3)) };
      if (Math.random() < 0.15) bets.t = Math.min(unit, 500);
      if (Math.random() < 0.1) bets[Math.random() < 0.5 ? 'pp' : 'bp'] = Math.min(unit, 500);
      const w = BC.payout(bets, res); if (w) { pay[b.id] = w; gold[b.id] = Math.max(0, gold[b.id] + w); }
    }
    hist.push(res.win === 't' ? last : res.win);
    out.push({ pay, house: -Object.values(pay).reduce((a, x) => a + x, 0) });
  }
  return out;
}

// 這一輪要開哪些局：從沒在牌桌上的電腦裡挑（愛賭博的優先）
export function plan(pool) {
  const gam = pool.filter(b => b.style === 'gambler'), others = pool.filter(b => b.style !== 'gambler');
  const sessions = [];
  const take = (min, n) => {
    const G = gam.filter(b => b.gold >= min), O = others.filter(b => b.gold >= min);
    if (G.length + O.length < n) return null;
    const g = pick(G, Math.min(n, G.length, Math.random() < 0.3 ? n - 1 : n));
    const rest = pick(O, n - g.length); const all = g.concat(rest);
    if (all.length < n) return null;
    all.forEach(b => { [gam, others].forEach(L => { const i = L.indexOf(b); if (i >= 0) L.splice(i, 1); }); });
    return all;
  };
  if (Math.random() < 0.7) {   // 麻將或大老二一桌
    const game = Math.random() < 0.6 ? 'mj' : 'b2', E = game === 'b2' ? B2 : MJ;
    const lvls = Object.keys(E.TABLES).filter(k => k !== 'r').reverse();   // 從高的桌開始找湊得到人的
    for (const lvl of lvls) { if (Math.random() < 0.5 && lvl !== 'n') continue; const b = take(E.TABLES[lvl].min, 4); if (b) { sessions.push({ game, lvl, bots: b, n: 3 + Math.floor(Math.random() * 4) }); break; } }
  }
  if (Math.random() < 0.5) {   // 百家樂 2～4 個
    const G = gam.filter(b => b.gold >= 3000);
    if (G.length >= 2) sessions.push({ game: 'bc', lvl: 'n', bots: pick(G, 2 + Math.floor(Math.random() * 3)), n: 6 + Math.floor(Math.random() * 7) });
  }
  return sessions;
}
