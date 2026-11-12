/* 大富翁（農場版）規則引擎：前端、伺服器共用
   4 人輪流擲骰子繞一圈 28 格；買菜園收過路費、同色買齊過路費加倍、蓋溫室；每人走 ROUNDS 輪後比總資產。
   報名費進獎池（娛樂廳抽 RAKE），第 1 名拿 70%、第 2 名拿 30%。遊戲裡的錢是大富翁幣，跟農場金幣分開 */
const MF = (() => {
  const TABLES = {
    n: { name: '新手桌', fee: 2000, min: 2000 },
    m: { name: '中級桌', fee: 5000, min: 5000 },
    h: { name: '高手桌', fee: 10000, min: 10000 },
  };
  const RAKE = 0.05, START_CASH = 15000, PASS_GO = 2000, ROUNDS = 20, SPLIT = [0.7, 0.3, 0, 0];
  const COLORS = ['#B7895B', '#59B7E8', '#E86FA8', '#F29B38', '#E84B4B', '#F2C230', '#3BB273'];
  // 格子：k = go 起點 / p 菜園 / chance 機會 / fate 命運 / tax 菜市場 / rest 休息站 / park 免費停車 / barn 穀倉 / storm 颱風
  const B = [
    { k: 'go', n: '起點' },
    { k: 'p', n: '白蘿蔔田', crop: 'radish', g: 0, price: 600 },
    { k: 'chance', n: '機會' },
    { k: 'p', n: '紅蘿蔔田', crop: 'carrot', g: 0, price: 700 },
    { k: 'tax', n: '菜市場', amt: 1000 },
    { k: 'p', n: '高麗菜園', crop: 'cabbage', g: 1, price: 1000 },
    { k: 'p', n: '玉米田', crop: 'corn', g: 1, price: 1000 },
    { k: 'rest', n: '休息站' },
    { k: 'p', n: '番茄園', crop: 'tomato', g: 1, price: 1200 },
    { k: 'p', n: '茄子園', crop: 'eggplant', g: 2, price: 1400 },
    { k: 'fate', n: '命運' },
    { k: 'p', n: '草莓園', crop: 'strawberry', g: 2, price: 1400 },
    { k: 'p', n: '南瓜田', crop: 'pumpkin', g: 2, price: 1600 },
    { k: 'barn', n: '穀倉', amt: 1000 },
    { k: 'park', n: '免費停車' },
    { k: 'p', n: '西瓜田', crop: 'watermelon', g: 3, price: 1800 },
    { k: 'p', n: '葡萄園', crop: 'grape', g: 3, price: 1800 },
    { k: 'chance', n: '機會' },
    { k: 'p', n: '鳳梨田', crop: 'pineapple', g: 3, price: 2000 },
    { k: 'p', n: '桃子園', crop: 'peach', g: 4, price: 2200 },
    { k: 'p', n: '火龍果園', crop: 'dragonfruit', g: 4, price: 2200 },
    { k: 'storm', n: '颱風', amt: 300 },
    { k: 'p', n: '哈密瓜園', crop: 'melon', g: 4, price: 2400 },
    { k: 'fate', n: '命運' },
    { k: 'p', n: '芒果園', crop: 'mango', g: 5, price: 2800 },
    { k: 'p', n: '金蘋果園', crop: 'gapple', g: 5, price: 3000 },
    { k: 'p', n: '彩虹玉米田', crop: 'rcorn', g: 6, price: 3500 },
    { k: 'p', n: '鑽石草莓園', crop: 'dberry', g: 6, price: 4000 },
  ];
  const N = B.length, MAXH = 3, HMUL = [1, 5, 12, 25];
  const houseCost = i => Math.round(B[i].price * 0.5 / 100) * 100;
  const group = g => B.map((b, i) => i).filter(i => B[i].k === 'p' && B[i].g === g);
  const CARDS = [
    { t: '颱風過後菜價大漲，領 1,500', f: 'gain', v: 1500 },
    { t: '豐收祭！每位玩家給你 300', f: 'collect', v: 300 },
    { t: '偷菜被抓到，罰 800', f: 'pay', v: 800 },
    { t: '田鼠偷吃了你的菜，損失 500', f: 'pay', v: 500 },
    { t: '搭順風車回到起點，領 2,000', f: 'go' },
    { t: '被看門狗咬了，休息一回合', f: 'rest' },
    { t: '刮刮樂中獎，領 800', f: 'gain', v: 800 },
    { t: '幫大家除草，付每位玩家 200', f: 'payall', v: 200 },
    { t: '騎腳踏車往前 3 格', f: 'move', v: 3 },
    { t: '走錯路，往後 3 格', f: 'move', v: -3 },
    { t: '鄰居送你一籃水果，領 600', f: 'gain', v: 600 },
    { t: '溫室要修理，每間付 400', f: 'repair', v: 400 },
  ];

  function freshState(G) {
    G.cash = G.seats.map(() => START_CASH);
    G.pos = G.seats.map(() => 0);
    G.own = B.map(() => -1); G.hs = B.map(() => 0); G.mort = B.map(() => false);
    G.rest = G.seats.map(() => false); G.bk = G.seats.map(() => false); G.brokeAt = G.seats.map(() => 0);
    G.round = 1; G.stage = 'roll'; G.dice = null; G.card = null; G.phase = 'play'; G.result = null; G.log = [];
    G.turn = G.first = Math.floor(Math.random() * 4);
    G.log.push({ k: 'start', s: G.turn });
  }
  function newGame(players, opt = {}) {
    const G = { table: opt.table || 'n', seats: players.map(p => ({ id: p.id, name: p.name, av: p.av, bot: !!p.bot, gold: p.gold || 0, auto: false })), handNo: 1, firstDealer: 0, dealer: 0, wind: 0, lian: 0 };
    freshState(G); G.dealer = G.firstDealer = G.turn;
    return G;
  }
  function nextHand(G) { G.handNo++; freshState(G); G.dealer = G.turn; }
  function waitingOn(G) { return G.phase === 'play' ? [G.turn] : []; }

  const rentOf = (G, i) => {
    const b = B[i], o = G.own[i]; if (o < 0 || G.mort[i]) return 0;
    const base = Math.round(b.price / 10), full = group(b.g).every(x => G.own[x] === o);
    return G.hs[i] > 0 ? base * HMUL[G.hs[i]] : base * (full ? 2 : 1);
  };
  const worth = (G, j) => G.cash[j] + B.reduce((a, b, i) => a + (G.own[i] === j ? (G.mort[i] ? b.price / 2 : b.price) + G.hs[i] * houseCost(i) : 0), 0);
  const canBuild = (G, j, i) => B[i].k === 'p' && G.own[i] === j && !G.mort[i] && G.hs[i] < MAXH && group(B[i].g).every(x => G.own[x] === j && !G.mort[x]) && G.cash[j] >= houseCost(i);
  const builds = (G, j) => B.map((b, i) => i).filter(i => canBuild(G, j, i));
  const alive = G => G.seats.map((s, j) => j).filter(j => !G.bk[j]);

  // 付錢：不夠就先賣溫室、再抵押地；還是不夠就破產（地還給銀行）
  function pay(G, j, amt, to) {
    if (amt <= 0) return;
    raise(G, j, amt);
    const got = Math.min(amt, Math.max(0, G.cash[j]));
    G.cash[j] -= amt;
    if (to != null && to >= 0) G.cash[to] += got;
    if (G.cash[j] < 0) bankrupt(G, j);
  }
  function raise(G, j, need) {
    const mine = () => B.map((b, i) => i).filter(i => G.own[i] === j);
    for (const i of mine().sort((a, b) => B[b].price - B[a].price)) { while (G.cash[j] < need && G.hs[i] > 0) { G.hs[i]--; G.cash[j] += houseCost(i) / 2; G.log.push({ k: 'sellh', s: j, p: i }); } }
    for (const i of mine().sort((a, b) => B[a].price - B[b].price)) { if (G.cash[j] >= need) break; if (!G.mort[i] && G.hs[i] === 0) { G.mort[i] = true; G.cash[j] += B[i].price / 2; G.log.push({ k: 'mort', s: j, p: i }); } }
  }
  function bankrupt(G, j) {
    G.bk[j] = true; G.brokeAt[j] = Date.now(); G.cash[j] = 0;
    B.forEach((b, i) => { if (G.own[i] === j) { G.own[i] = -1; G.hs[i] = 0; G.mort[i] = false; } });
    G.log.push({ k: 'bk', s: j });
  }

  function moveTo(G, j, to, passGo) {
    if (passGo && to < G.pos[j]) { G.cash[j] += PASS_GO; G.log.push({ k: 'go', s: j }); }
    G.pos[j] = (to + N) % N;
    land(G, j);
  }
  function land(G, j) {
    const i = G.pos[j], b = B[i];
    G.card = null;
    if (b.k === 'p') {
      if (G.own[i] < 0) { G.stage = G.cash[j] >= b.price ? 'buy' : 'manage'; return; }
      if (G.own[i] !== j) { const r = rentOf(G, i); if (r > 0) { pay(G, j, r, G.own[i]); G.log.push({ k: 'rent', s: j, to: G.own[i], p: i, amt: r }); } }
    } else if (b.k === 'tax') { pay(G, j, b.amt, -1); G.log.push({ k: 'tax', s: j, amt: b.amt }); }
    else if (b.k === 'barn') { G.cash[j] += b.amt; G.log.push({ k: 'barn', s: j, amt: b.amt }); }
    else if (b.k === 'rest') { G.rest[j] = true; G.log.push({ k: 'rest', s: j }); }
    else if (b.k === 'storm') { const n = B.reduce((a, x, k) => a + (G.own[k] === j ? G.hs[k] : 0), 0); if (n) { pay(G, j, n * b.amt, -1); G.log.push({ k: 'storm', s: j, amt: n * b.amt }); } else G.log.push({ k: 'storm0', s: j }); }
    else if (b.k === 'chance' || b.k === 'fate') { drawCard(G, j); if (G.stage === 'buy') return; }
    G.stage = 'manage';
  }
  function drawCard(G, j) {
    const c = CARDS[Math.floor(Math.random() * CARDS.length)];
    G.card = { t: c.t, s: j }; G.log.push({ k: 'card', s: j, t: c.t });
    const others = alive(G).filter(x => x !== j);
    if (c.f === 'gain') G.cash[j] += c.v;
    else if (c.f === 'pay') pay(G, j, c.v, -1);
    else if (c.f === 'collect') others.forEach(x => pay(G, x, c.v, j));
    else if (c.f === 'payall') others.forEach(x => { if (!G.bk[j]) pay(G, j, c.v, x); });
    else if (c.f === 'go') { G.cash[j] += PASS_GO; G.pos[j] = 0; }
    else if (c.f === 'rest') G.rest[j] = true;
    else if (c.f === 'repair') { const n = B.reduce((a, x, k) => a + (G.own[k] === j ? G.hs[k] : 0), 0); pay(G, j, n * c.v, -1); }
    else if (c.f === 'move') { const keep = G.card; G.pos[j] = (G.pos[j] + c.v + N) % N; if (B[G.pos[j]].k !== 'chance' && B[G.pos[j]].k !== 'fate') land(G, j); G.card = keep; }
  }

  function endTurn(G) {
    if (alive(G).length <= 1) return finish(G);
    let nx = G.turn;
    for (let k = 0; k < 4; k++) {
      nx = (nx + 1) % 4;
      if (nx === G.first) { G.round++; if (G.round > ROUNDS) return finish(G); }
      if (!G.bk[nx]) break;
    }
    G.turn = nx; G.stage = 'roll'; G.dice = null; G.card = null;
    if (G.rest[nx]) { G.rest[nx] = false; G.stage = 'skip'; }   // 休息：這一輪只能按「略過」
  }

  function act(G, si, a) {
    if (G.phase !== 'play') throw new Error('這局已經結束');
    if (G.turn !== si) throw new Error('還沒輪到你');
    if (G.bk[si]) throw new Error('你已經破產了');
    G.mvMs = 0;   // 棋子走路的時間：電腦要等走完才做下一步
    if (a.a === 'roll') {
      if (G.stage === 'skip') { G.log.push({ k: 'skip', s: si }); return endTurn(G); }
      if (G.stage !== 'roll') throw new Error('已經擲過骰子了');
      const d = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      G.dice = d; G.log.push({ k: 'roll', s: si, d }); G.mvMs = (d[0] + d[1]) * 260;
      const to = (G.pos[si] + d[0] + d[1]) % N;
      moveTo(G, si, to, true);
      if (G.bk[si]) return endTurn(G);
      return;
    }
    if (a.a === 'buy') {
      if (G.stage !== 'buy') throw new Error('現在不能買');
      const i = G.pos[si]; if (G.own[i] >= 0 || G.cash[si] < B[i].price) throw new Error('買不了');
      G.cash[si] -= B[i].price; G.own[i] = si; G.log.push({ k: 'buy', s: si, p: i }); G.stage = 'manage'; return;
    }
    if (a.a === 'skip') { if (G.stage !== 'buy') throw new Error('現在不能這樣做'); G.stage = 'manage'; return; }
    if (a.a === 'build') {
      if (G.stage !== 'manage') throw new Error('現在不能蓋');
      const i = +a.p; if (!canBuild(G, si, i)) throw new Error('這塊地不能蓋溫室');
      G.cash[si] -= houseCost(i); G.hs[i]++; G.log.push({ k: 'build', s: si, p: i }); return;
    }
    if (a.a === 'unmort') {
      const i = +a.p; if (G.own[i] !== si || !G.mort[i]) throw new Error('這塊地沒有抵押');
      const c = Math.round(B[i].price * 0.55); if (G.cash[si] < c) throw new Error('錢不夠贖回');
      G.cash[si] -= c; G.mort[i] = false; G.log.push({ k: 'unmort', s: si, p: i }); return;
    }
    if (a.a === 'end') { if (G.stage === 'roll' || G.stage === 'skip') throw new Error('先擲骰子'); if (G.stage === 'buy') G.stage = 'manage'; return endTurn(G); }
    throw new Error('不支援的動作');
  }

  function finish(G) {
    const T = TABLES[G.table], order = G.seats.map((s, j) => j).sort((a, b) => (G.bk[a] - G.bk[b]) || (G.bk[a] ? G.brokeAt[b] - G.brokeAt[a] : worth(G, b) - worth(G, a)));
    const fee = G.seats.map(s => Math.min(T.fee, Math.max(0, s.gold)));
    const pool = fee.reduce((a, x) => a + x, 0), rake = Math.floor(pool * RAKE), net = pool - rake;
    const prize = [0, 0, 0, 0]; order.forEach((j, r) => { prize[j] = Math.floor(net * SPLIT[r]); });
    const pay = G.seats.map((s, j) => prize[j] - fee[j]);
    G.seats.forEach((s, j) => s.gold += pay[j]);
    G.result = { order, worth: G.seats.map((s, j) => Math.round(worth(G, j))), pay, rake, pool, fee: T.fee };
    G.phase = 'end'; G.turn = -1; G.stage = null; G.log.push({ k: 'end' });
  }

  // 電腦：有錢就買（留一點現金）、同色齊了就蓋溫室
  function botDecide(G, si) {
    const c = G.cash[si], i = G.pos[si];
    if (G.stage === 'roll' || G.stage === 'skip') return { a: 'roll' };
    if (G.stage === 'buy') return c - B[i].price >= 1200 || (c - B[i].price >= 300 && group(B[i].g).some(x => G.own[x] === si)) ? { a: 'buy' } : { a: 'skip' };
    const mort = B.map((b, k) => k).find(k => G.own[k] === si && G.mort[k] && c - B[k].price * 0.55 > 4000);
    if (mort != null) return { a: 'unmort', p: mort };
    const bl = builds(G, si).filter(k => c - houseCost(k) >= 2500).sort((a, b) => G.hs[a] - G.hs[b]);
    if (bl.length) return { a: 'build', p: bl[0] };
    return { a: 'end' };
  }
  function autoAct(G, si, smart) {
    if (G.phase !== 'play' || G.turn !== si) return false;
    if (smart) { act(G, si, botDecide(G, si)); return true; }
    // 超時代打：擲骰子；空地不買；其他直接結束這回合
    if (G.stage === 'roll' || G.stage === 'skip') act(G, si, { a: 'roll' });
    else if (G.stage === 'buy') act(G, si, { a: 'skip' });
    else act(G, si, { a: 'end' });
    return true;
  }
  function options(G, si) {
    if (G.phase !== 'play' || G.turn !== si) return {};
    return { stage: G.stage, builds: G.stage === 'manage' ? builds(G, si) : [], price: G.stage === 'buy' ? B[G.pos[si]].price : null };
  }
  function view(G, si) {
    return {
      game: 'mf', table: G.table, phase: G.phase, turn: G.turn, me: si, handNo: G.handNo, dealer: G.dealer, firstDealer: G.firstDealer, wind: 0, lian: 0,
      waiting: waitingOn(G), stage: G.stage, round: G.round, rounds: ROUNDS, dice: G.dice, card: G.card,
      cash: G.cash.slice(), pos: G.pos.slice(), own: G.own.slice(), hs: G.hs.slice(), mort: G.mort.slice(), rest: G.rest.slice(), bk: G.bk.slice(),
      worth: G.seats.map((s, j) => Math.round(worth(G, j))), rent: B.map((b, i) => rentOf(G, i)),
      seats: G.seats.map(s => ({ name: s.name, av: s.av, gold: s.gold, bot: s.bot, auto: s.auto })),
      log: G.log.slice(-12), logN: G.log.length, opts: options(G, si), result: G.result, left: 0,
    };
  }
  return { TABLES, RAKE, START_CASH, PASS_GO, ROUNDS, SPLIT, COLORS, B, N, MAXH, HMUL, houseCost, group, newGame, nextHand, act, options, botDecide, autoAct, waitingOn, view, rentOf, worth };
})();
if (typeof module !== 'undefined') module.exports = MF;
