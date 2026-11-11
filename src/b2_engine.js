/* 大老二規則引擎（台灣玩法）：前端、伺服器共用
   牌的代號 c = 點數 × 4 + 花色；點數 0..12 = 3 4 5 6 7 8 9 10 J Q K A 2；花色 0..3 = ♣ ♦ ♥ ♠（代號越大越大） */
const B2 = (() => {
  const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  const SUITS = ['♣','♦','♥','♠'];
  const TABLES = {
    n: { name: '新手桌', per: 20, min: 2000 },
    m: { name: '中級桌', per: 100, min: 10000 },
    h: { name: '高手桌', per: 400, min: 40000 },
    r: { name: '土豪桌', per: 1000, min: 100000 },
  };
  const RAKE = 0.05;
  const PETS = ['armad','bear','bunny','deer','dragon','ferret','fox','lizard','marten','mole','moth','mouse','otter','owl','pango','penguin','phoenix','seal'];
  const KIND = ['', '順子', '同花', '葫蘆', '鐵支', '同花順'];
  const rk = c => c >> 2, st = c => c & 3;
  const name = c => SUITS[st(c)] + RANKS[rk(c)];

  // 判斷牌型：{ ty:'single'|'pair'|'five', kind(五張才有), key(比大小用) } 或 null
  function classify(cards) {
    const cs = cards.slice().sort((a, b) => a - b), n = cs.length;
    if (n === 1) return { ty: 'single', key: cs[0] };
    if (n === 2) return rk(cs[0]) === rk(cs[1]) ? { ty: 'pair', key: cs[1] } : null;
    if (n !== 5) return null;
    const rs = cs.map(rk), cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
    const groups = Object.entries(cnt).map(([r, k]) => [+r, k]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = cs.every(c => st(c) === st(cs[0]));
    let straight = false;
    if (groups.length === 5) {
      const f = rs.map(r => r + 3).sort((a, b) => a - b);   // 3..15（14 = A，15 = 2）
      const s = f.join(',');
      straight = (f[4] - f[0] === 4 && f[4] <= 14) || s === '3,4,5,14,15' || s === '3,4,5,6,15';
    }
    const top = cs[4];
    if (straight && flush) return { ty: 'five', kind: 5, key: top };
    if (groups[0][1] === 4) return { ty: 'five', kind: 4, key: groups[0][0] };
    if (groups[0][1] === 3 && groups[1][1] === 2) return { ty: 'five', kind: 3, key: groups[0][0] };
    if (flush) return { ty: 'five', kind: 2, key: top };
    if (straight) return { ty: 'five', kind: 1, key: top };
    return null;
  }
  function beats(a, b) {   // a 能不能壓過 b
    if (!a) return false; if (!b) return true;
    if (a.ty !== b.ty) return false;
    // 五張牌型：只能壓同一種（順子壓順子…），鐵支、同花順例外，可以壓比它小的任何五張牌型
    if (a.ty === 'five' && a.kind !== b.kind) return a.kind >= 4 && a.kind > b.kind;
    return a.key > b.key;
  }
  function comboName(cb) { return !cb ? '' : cb.ty === 'single' ? '單張' : cb.ty === 'pair' ? '對子' : KIND[cb.kind]; }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function deal(G, starter) {
    const deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
    G.seats.forEach((s, j) => { s.hand = deck.slice(j * 13, j * 13 + 13).sort((a, b) => a - b); s.last = null; });
    G.phase = 'play'; G.cur = null; G.result = null; G.log = []; G.logBase = 0;
    G.pet = PETS[Math.floor(Math.random() * PETS.length)];
    if (starter == null) { starter = G.seats.findIndex(s => s.hand.includes(0)); G.must = 0; } else G.must = null;   // 第一局：拿梅花 3 的人先出，而且要出到梅花 3
    G.turn = starter; G.lead = starter;
    G.log.push({ k: 'deal', s: starter });
  }
  function newGame(players, opt = {}) {
    const G = { table: opt.table || 'n', seats: players.map(p => ({ id: p.id, name: p.name, av: p.av, bot: !!p.bot, gold: p.gold || 0, auto: false, hand: [], last: null })),
      handNo: 1, firstDealer: 0, dealer: 0, wind: 0, lian: 0 };
    deal(G, null); G.dealer = G.firstDealer = G.turn;
    return G;
  }
  function nextHand(G) {
    const w = G.result ? G.result.winner : null;
    G.handNo++; deal(G, w); G.dealer = G.turn;
  }
  const isLead = (G, si) => !G.cur || G.cur.by === si;
  function waitingOn(G) { return G.phase === 'play' ? [G.turn] : []; }

  function act(G, si, a) {
    if (G.phase !== 'play') throw new Error('這局已經結束');
    if (G.turn !== si) throw new Error('還沒輪到你');
    const s = G.seats[si];
    if (a.a === 'pass') {
      if (isLead(G, si)) throw new Error('這輪由你先出，不能過');
      s.last = 'pass'; G.log.push({ k: 'pass', s: si });
      let nx = (si + 1) % 4;
      G.turn = nx;
      if (nx === G.cur.by) { G.cur = null; G.seats.forEach(p => p.last = null); G.lead = nx; G.log.push({ k: 'round', s: nx }); }
      return;
    }
    if (a.a !== 'play') throw new Error('不支援的動作');
    const cards = (a.cards || []).map(Number);
    if (!cards.length || new Set(cards).size !== cards.length || !cards.every(c => s.hand.includes(c))) throw new Error('選的牌不對');
    const cb = classify(cards); if (!cb) throw new Error('這不是能出的牌型');
    if (G.must != null && !cards.includes(G.must)) throw new Error('第一手要出到梅花 3');
    if (!isLead(G, si) && !beats(cb, G.cur.cb)) throw new Error(G.cur.cb.ty !== cb.ty ? `要出${G.cur.cb.ty === 'five' ? '五張牌型' : comboName(G.cur.cb)}` : cb.ty === 'five' && cb.kind !== G.cur.cb.kind && cb.kind < 4 ? `要出${comboName(G.cur.cb)}（或鐵支、同花順）` : '要比上一手大');
    s.hand = s.hand.filter(c => !cards.includes(c));
    const sorted = cards.slice().sort((x, y) => x - y);
    G.cur = { cards: sorted, cb, by: si }; s.last = sorted; G.must = null;
    G.log.push({ k: 'play', s: si, cards: sorted, ty: comboName(cb) });
    if (!s.hand.length) return finish(G, si);
    G.turn = (si + 1) % 4;
  }
  function finish(G, w) {
    const T = TABLES[G.table], pay = [0, 0, 0, 0], lines = [];
    G.seats.forEach((s, j) => {
      if (j === w) return;
      const n = s.hand.length, twos = s.hand.filter(c => rk(c) === 12).length;
      const mult = n === 13 ? 3 : n >= 10 ? 2 : 1;   // 剩 10 張以上加倍，一張都沒出 3 倍
      const units = (n + twos) * mult;                 // 手上的 2 每張多算一張
      const want = units * T.per, got = Math.max(0, Math.min(want, s.gold));
      pay[j] -= got; pay[w] += got; lines.push({ s: j, n, twos, mult, units, amt: got, short: got < want });
    });
    const rake = Math.floor(pay[w] * RAKE); pay[w] -= rake;
    G.seats.forEach((s, j) => s.gold += pay[j]);
    G.result = { winner: w, pay, rake, lines, hands: G.seats.map(s => s.hand.slice()) };
    G.phase = 'end'; G.turn = -1; G.log.push({ k: 'win', s: w });
  }

  // ---------- 找出手上能組的牌型 ----------
  function combos(hand) {
    const byR = {}, byS = [[], [], [], []];
    hand.forEach(c => { (byR[rk(c)] = byR[rk(c)] || []).push(c); byS[st(c)].push(c); });
    const out = [];
    hand.forEach(c => out.push([c]));
    Object.values(byR).forEach(L => { for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) out.push([L[i], L[j]]); });
    const fives = [];
    // 順子（每個點數挑一張，最多試 64 種）
    const wins = []; for (let f = 3; f <= 10; f++) wins.push([f, f + 1, f + 2, f + 3, f + 4]); wins.push([14, 15, 3, 4, 5], [15, 3, 4, 5, 6]);
    wins.forEach(w => { const Ls = w.map(f => byR[f - 3]); if (Ls.some(x => !x)) return;
      let acc = [[]]; for (const L of Ls) { const nx = []; for (const a of acc) for (const c of L) nx.push(a.concat([c])); acc = nx.slice(0, 64); } fives.push(...acc); });
    // 同花
    byS.forEach(L => { if (L.length < 5) return; const n = L.length;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) fives.push([L[a], L[b], L[c], L[d], L[e]]); });
    // 葫蘆、鐵支
    const R = Object.keys(byR).map(Number);
    R.forEach(r => { const L = byR[r];
      if (L.length >= 3) R.forEach(q => { if (q !== r && byR[q].length >= 2) fives.push(L.slice(0, 3).concat(byR[q].slice(0, 2))); });
      if (L.length === 4) { const k = hand.find(c => rk(c) !== r); if (k != null) fives.push(L.concat([k])); } });
    const seen = new Set();
    fives.forEach(f => { const k = f.slice().sort((a, b) => a - b).join(','); if (seen.has(k)) return; seen.add(k); if (classify(f)) out.push(f); });
    return out.map(cs => ({ cards: cs.slice().sort((a, b) => a - b), cb: classify(cs) })).filter(x => x.cb);
  }
  // 電腦：只看自己的手牌和桌上出過的牌
  function botDecide(G, si) {
    if (G.phase !== 'play' || G.turn !== si) return null;
    const s = G.seats[si], all = combos(s.hand);
    const opp = G.seats.filter((p, j) => j !== si).map(p => p.hand.length), danger = Math.min(...opp);
    const nextN = G.seats[(si + 1) % 4].hand.length;
    const win = all.find(x => x.cards.length === s.hand.length);
    const lead = isLead(G, si);
    let cand = lead ? all : all.filter(x => beats(x.cb, G.cur.cb));
    if (G.must != null) cand = cand.filter(x => x.cards.includes(G.must));
    if (win && cand.includes(win)) return { a: 'play', cards: win.cards };
    if (!cand.length) return lead ? { a: 'play', cards: [s.hand[0]] } : { a: 'pass' };
    // 一張牌被拆掉的代價：拆對子、拆葫蘆／順子、用掉 2
    const cntR = {}; s.hand.forEach(c => cntR[rk(c)] = (cntR[rk(c)] || 0) + 1);
    const inFive = new Set(); all.filter(x => x.cb.ty === 'five' && x.cb.kind <= 3).slice(0, 1).forEach(x => x.cards.forEach(c => inFive.add(c)));
    const cost = x => {
      let p = 0; const n = x.cards.length;
      x.cards.forEach(c => { const r = rk(c);
        if (n < cntR[r] && x.cb.ty !== 'five') p += 2.5;          // 拆對子／三條
        if (n === 1 && inFive.has(c)) p += 1.5;                    // 拆五張牌型
        if (r === 12 && danger > 3 && s.hand.length > 5) p += 4;   // 2 留到後面
        if (r === 11 && danger > 5 && s.hand.length > 7) p += 1.2;
      });
      return p;
    };
    if (lead) {
      // 先出：有人只剩 1 張就不要出小單張；其他時候把最小的牌帶出去（能組五張或對子就一起出）
      const lo = s.hand[0];
      if (danger === 1) { const multi = cand.filter(x => x.cards.length > 1).sort((a, b) => b.cards.length - a.cards.length || a.cb.key - b.cb.key);
        if (multi.length) return { a: 'play', cards: multi[0].cards };
        return { a: 'play', cards: [s.hand[s.hand.length - 1]] }; }
      const withLo = cand.filter(x => x.cards.includes(lo));
      const pick = withLo.sort((a, b) => b.cards.length - a.cards.length || cost(a) - cost(b) || a.cb.key - b.cb.key)[0] || cand[0];
      return { a: 'play', cards: pick.cards };
    }
    // 跟牌：挑能壓過、代價最小、最小的那手；下一家只剩 1 張又是單張時，出最大的
    if (G.cur.cb.ty === 'single' && nextN === 1) { const big = cand.sort((a, b) => b.cb.key - a.cb.key)[0]; return { a: 'play', cards: big.cards }; }
    const best = cand.map(x => ({ x, c: cost(x) })).sort((a, b) => a.c - b.c || (a.x.cb.kind || 0) - (b.x.cb.kind || 0) || a.x.cb.key - b.x.cb.key)[0];
    if (best.c >= 4 && danger > 2 && s.hand.length > 4) return { a: 'pass' };   // 代價太大（拆牌、用 2）又不急：先過
    return { a: 'play', cards: best.x.cards };
  }
  function autoAct(G, si, smart) {
    if (G.phase !== 'play' || G.turn !== si) return false;
    if (smart) { act(G, si, botDecide(G, si)); return true; }
    // 超時代打：要先出就出最小的一張（第一手出梅花 3），不然就過
    if (isLead(G, si)) act(G, si, { a: 'play', cards: [G.must != null ? G.must : G.seats[si].hand[0]] });
    else act(G, si, { a: 'pass' });
    return true;
  }
  function options(G, si) {
    if (G.phase !== 'play' || G.turn !== si) return {};
    return { play: true, pass: !isLead(G, si), must: G.must };
  }
  function view(G, si) {
    const end = G.phase === 'end';
    return {
      game: 'b2', table: G.table, phase: G.phase, turn: G.turn, me: si, handNo: G.handNo, pet: G.pet, dealer: G.dealer, firstDealer: G.firstDealer, wind: 0, lian: 0,
      waiting: waitingOn(G), must: G.must,
      cur: G.cur ? { cards: G.cur.cards, by: G.cur.by, ty: comboName(G.cur.cb) } : null,
      seats: G.seats.map((s, j) => ({ name: s.name, av: s.av, gold: s.gold, bot: s.bot, auto: s.auto, n: s.hand.length, last: s.last,
        hand: j === si || end ? s.hand.slice() : null })),
      log: G.log.slice(-12), logN: G.log.length,
      opts: options(G, si), result: G.result, left: 0,
    };
  }
  return { RANKS, SUITS, TABLES, RAKE, PETS, rk, st, name, classify, beats, comboName, combos, newGame, nextHand, act, options, botDecide, autoAct, waitingOn, view };
})();
if (typeof module !== 'undefined') module.exports = B2;
