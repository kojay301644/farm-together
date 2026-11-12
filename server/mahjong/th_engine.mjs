/* 德州撲克引擎（無限注）：前端、伺服器共用
   牌的代號跟大老二一樣：c = 點數 × 4 + 花色；大老二點數 0..12 = 3..2，這裡換成撲克大小 v = 0..12 = 2..A */
const HOLD = (() => {
  const TABLES = {
    n: { name: '新手桌', sb: 10, bb: 20, min: 400 },
    m: { name: '中級桌', sb: 50, bb: 100, min: 2000 },
    h: { name: '高手桌', sb: 200, bb: 400, min: 8000 },
    r: { name: '土豪桌', sb: 500, bb: 1000, min: 20000 },
  };
  Object.values(TABLES).forEach(t => { t.buyMin = t.bb * 20; t.buyMax = t.bb * 100; });
  const SEATS = 6, RAKE = 0.05, RAKE_CAP_BB = 3;
  const HAND = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '鐵支', '同花順'];
  const v = c => { const r = c >> 2; return r === 12 ? 0 : r + 1; };   // 2..A → 0..12
  const su = c => c & 3;

  // ---------- 牌力 ----------
  function eval5(cs) {
    const vs = cs.map(v).sort((a, b) => b - a), flush = cs.every(c => su(c) === su(cs[0]));
    const cnt = {}; vs.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    const g = Object.entries(cnt).map(([x, n]) => [+x, n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    let st = -1; const u = [...new Set(vs)];
    if (u.length === 5) { if (u[0] - u[4] === 4) st = u[0]; else if (u.join() === '12,3,2,1,0') st = 3; }   // A-2-3-4-5 算 5 最大
    if (st >= 0 && flush) return [8, st];
    if (g[0][1] === 4) return [7, g[0][0], g[1][0]];
    if (g[0][1] === 3 && g[1][1] === 2) return [6, g[0][0], g[1][0]];
    if (flush) return [5, ...vs];
    if (st >= 0) return [4, st];
    if (g[0][1] === 3) return [3, g[0][0], ...g.slice(1).map(x => x[0])];
    if (g[0][1] === 2 && g[1][1] === 2) return [2, g[0][0], g[1][0], g[2][0]];
    if (g[0][1] === 2) return [1, g[0][0], ...g.slice(1).map(x => x[0])];
    return [0, ...vs];
  }
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d; } return 0; };
  function best(cards) {   // 5～7 張裡挑最好的 5 張
    let top = null, hand = null; const n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const h = [cards[a], cards[b], cards[c], cards[d], cards[e]], s = eval5(h);
      if (!top || cmp(s, top) > 0) { top = s; hand = h; }
    }
    return { score: top, cards: hand, name: HAND[top[0]] };
  }

  // ---------- 牌局 ----------
  function shuffle() { const d = Array.from({ length: 52 }, (_, i) => i); for (let i = 51; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
  function newTable(lvl) { return { table: lvl, seats: Array(SEATS).fill(null), button: -1, street: 'idle', board: [], handNo: 0, log: [], result: null, turn: -1 }; }
  const live = (G, i) => { const p = G.seats[i]; return p && p.inHand && !p.folded; };
  const canAct = (G, i) => live(G, i) && !G.seats[i].allin;
  function nextFrom(G, i, ok) { for (let k = 1; k <= SEATS; k++) { const j = (i + k) % SEATS; if (ok(j)) return j; } return -1; }
  function pay(G, i, amt) { const p = G.seats[i], x = Math.min(amt, p.stack); p.stack -= x; p.bet += x; p.put += x; if (p.stack === 0) p.allin = true; return x; }

  function canStart(G) { return G.seats.filter(p => p && !p.sitOut && p.stack > 0).length >= 2; }
  function startHand(G) {
    G.tc = Object.assign({}, TABLES[G.table], { rake: API.RAKE, cap: API.RAKE_CAP_BB });   // 這一手用的數值（後台中途改了也不影響這一手）
    const T = G.tc;
    G.seats.forEach(p => { if (!p) return; Object.assign(p, { inHand: !p.sitOut && p.stack > 0, folded: false, allin: false, bet: 0, put: 0, hole: [], acted: false, last: null, start: p.stack, shown: false }); });
    const inn = i => G.seats[i] && G.seats[i].inHand;
    G.handNo++; G.board = []; G.result = null; G.deck = shuffle(); G.log = [{ k: 'hand' }];
    G.button = nextFrom(G, G.button < 0 ? SEATS - 1 : G.button, inn);
    const n = G.seats.filter((p, i) => inn(i)).length;
    const sb = n === 2 ? G.button : nextFrom(G, G.button, inn), bb = nextFrom(G, sb, inn);
    G.sbSeat = sb; G.bbSeat = bb;
    pay(G, sb, T.sb); G.seats[sb].last = '小盲'; pay(G, bb, T.bb); G.seats[bb].last = '大盲';
    for (let r = 0; r < 2; r++) for (let k = 0; k < SEATS; k++) { const i = (G.button + 1 + k) % SEATS; if (inn(i)) G.seats[i].hole.push(G.deck.pop()); }
    G.street = 'pre'; G.curBet = T.bb; G.minRaise = T.bb;
    G.turn = nextFrom(G, bb, i => canAct(G, i));
    if (G.turn < 0 || roundDone(G)) return nextStreet(G);
  }
  function roundDone(G) {
    const act = G.seats.map((p, i) => i).filter(i => canAct(G, i));
    if (act.length === 0) return true;
    if (act.length === 1 && G.seats[act[0]].bet >= G.curBet) return true;
    return act.every(i => G.seats[i].acted && G.seats[i].bet === G.curBet);
  }
  function nextStreet(G) {
    G.seats.forEach(p => { if (p) { p.bet = 0; p.acted = false; if (p.inHand && !p.folded && !p.allin) p.last = null; } });
    G.curBet = 0; G.minRaise = thT(G).bb;
    const deal = n => { for (let k = 0; k < n; k++) G.board.push(G.deck.pop()); };
    if (G.street === 'pre') { deal(3); G.street = 'flop'; }
    else if (G.street === 'flop') { deal(1); G.street = 'turn'; }
    else if (G.street === 'turn') { deal(1); G.street = 'river'; }
    else return showdown(G);
    G.log.push({ k: 'street', st: G.street });
    // 只剩一個人（或沒人）能下注：直接把公牌發完攤牌
    const act = G.seats.map((p, i) => i).filter(i => canAct(G, i));
    if (act.length <= 1) return nextStreet(G);
    G.turn = nextFrom(G, G.button, i => canAct(G, i));
  }
  function act(G, si, a) {
    if (!['pre', 'flop', 'turn', 'river'].includes(G.street)) throw new Error('這局還沒開始');
    if (G.turn !== si) throw new Error('還沒輪到你');
    const p = G.seats[si], toCall = G.curBet - p.bet;
    if (a.a === 'fold') { p.folded = true; p.last = '棄牌'; }
    else if (a.a === 'check') { if (toCall > 0) throw new Error('要跟注或棄牌'); p.last = '過牌'; }
    else if (a.a === 'call') { if (toCall <= 0) { p.last = '過牌'; } else { pay(G, si, toCall); p.last = p.allin ? '全下' : '跟注'; } }
    else if (a.a === 'raise') {
      const to = Math.floor(+a.to || 0), maxTo = p.bet + p.stack;
      if (to > maxTo) throw new Error('籌碼不夠');
      if (to < G.curBet + G.minRaise && to < maxTo) throw new Error(`最少要加到 ${(G.curBet + G.minRaise).toLocaleString()}`);
      if (to <= G.curBet) throw new Error('要比目前的注大');
      const prev = G.curBet, raise = to - G.curBet;
      pay(G, si, to - p.bet);
      if (raise >= G.minRaise) G.minRaise = raise;
      G.curBet = to;
      G.seats.forEach((q, i) => { if (i !== si && canAct(G, i)) q.acted = false; });
      p.last = p.allin ? '全下' : prev === 0 ? '下注' : '加注';
    } else throw new Error('不支援的動作');
    p.acted = true;
    G.log.push({ k: 'act', s: si, a: p.last, amt: p.bet });
    const alive = G.seats.map((q, i) => i).filter(i => live(G, i));
    if (alive.length === 1) return finish(G, [{ s: alive[0] }], false);
    if (roundDone(G)) return nextStreet(G);
    G.turn = nextFrom(G, si, i => canAct(G, i));
  }
  // 抽成：看過翻牌才抽，底池 5%，最多 3 個大盲
  function thT(G) { return G.tc || Object.assign({}, TABLES[G.table], { rake: API.RAKE, cap: API.RAKE_CAP_BB }); }
  function rakeOf(G, total) { const T = thT(G); return G.board.length >= 3 ? Math.min(Math.floor(total * T.rake), T.bb * T.cap) : 0; }
  function showdown(G) {
    while (G.board.length < 5) G.board.push(G.deck.pop());
    const alive = G.seats.map((p, i) => i).filter(i => live(G, i));
    const ev = {}; alive.forEach(i => { ev[i] = best(G.seats[i].hole.concat(G.board)); G.seats[i].shown = true; });
    finish(G, alive.map(i => ({ s: i, ev: ev[i] })), true);
  }
  function finish(G, cands, show) {
    const puts = G.seats.map(p => (p && p.inHand ? p.put : 0)), total = puts.reduce((a, b) => a + b, 0);
    const rake = rakeOf(G, total);
    const win = Array(SEATS).fill(0);
    if (!show) win[cands[0].s] = total - rake;
    else {
      // 邊池：照每個人投入的多少分層
      const levels = [...new Set(puts.filter(x => x > 0))].sort((a, b) => a - b);
      let prev = 0, rakeLeft = rake;
      for (const L of levels) {
        let pot = puts.reduce((a, x) => a + Math.max(0, Math.min(x, L) - prev), 0);
        const take = Math.min(rakeLeft, pot); pot -= take; rakeLeft -= take;
        const el = cands.filter(c => puts[c.s] >= L);
        if (el.length) {
          let top = null; el.forEach(c => { if (!top || cmp(c.ev.score, top) > 0) top = c.ev.score; });
          const ws = el.filter(c => cmp(c.ev.score, top) === 0).map(c => c.s).sort((a, b) => ((a - G.button + SEATS) % SEATS) - ((b - G.button + SEATS) % SEATS));
          const each = Math.floor(pot / ws.length); ws.forEach(s => win[s] += each); win[ws[0]] += pot - each * ws.length;
        } else { const back = G.seats.findIndex((p, i) => puts[i] >= L); if (back >= 0) win[back] += pot; }   // 沒人能拿就退回
        prev = L;
      }
    }
    G.seats.forEach((p, i) => { if (p) { p.stack += win[i]; p.bet = 0; } });
    G.result = { show, rake, total, win, hands: show ? Object.fromEntries(cands.map(c => [c.s, { name: c.ev.name, cards: c.ev.cards }])) : {} };
    G.street = 'show'; G.turn = -1; G.log.push({ k: 'win' });
  }
  function options(G, si) {
    if (G.turn !== si || !['pre', 'flop', 'turn', 'river'].includes(G.street)) return null;
    const p = G.seats[si], toCall = Math.max(0, G.curBet - p.bet), maxTo = p.bet + p.stack;
    return { toCall: Math.min(toCall, p.stack), canCheck: toCall === 0, minTo: Math.min(G.curBet + G.minRaise, maxTo), maxTo, canRaise: maxTo > G.curBet,
      pot: G.seats.reduce((a, q) => a + (q && q.inHand ? q.put || 0 : 0), 0) };
  }

  // ---------- 電腦：看自己的牌和公牌決定 ----------
  function preScore(h) {
    const [a, b] = h.map(v).sort((x, y) => y - x), suited = su(h[0]) === su(h[1]);
    let s = a + b * 0.6;
    if (a === b) s += 10 + a; if (suited) s += 2; if (a - b === 1) s += 1.5; else if (a - b === 2) s += 0.8;
    return s;   // 大約 1～32
  }
  // 勝率估算：隨機發對手的牌和剩下的公牌，模擬 N 次（只用看得到的牌）
  function equity(hole, board, nOpp, N) {
    const used = new Set(hole.concat(board)), deck = []; for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
    let win = 0;
    for (let t = 0; t < N; t++) {
      for (let i = deck.length - 1; i > deck.length - 1 - (nOpp * 2 + 5 - board.length) && i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      let k = deck.length - 1; const bd = board.slice(); while (bd.length < 5) bd.push(deck[k--]);
      const me = best(hole.concat(bd)).score; let res = 1;
      for (let o = 0; o < nOpp && res > 0; o++) { const sc = best([deck[k--], deck[k--]].concat(bd)).score, c = cmp(me, sc); if (c < 0) res = 0; else if (c === 0) res = Math.min(res, 0.5); }
      win += res;
    }
    return win / N;
  }
  function botDecide(G, si) {
    const o = options(G, si); if (!o) return null;
    const p = G.seats[si], T = thT(G), r = Math.random(), bb = T.bb;
    const opp = G.seats.filter((q, i) => i !== si && q && q.inHand && !q.folded).length;
    const nIn = G.seats.filter(q => q && q.inHand).length;
    const posLate = ((si - G.button + SEATS) % SEATS) === 0 || ((si - G.button + SEATS) % SEATS) >= nIn - 1;   // 莊家位或最後幾個：可以玩鬆一點
    const roundTo = x => Math.max(o.minTo, Math.min(o.maxTo, Math.round(x / bb) * bb));
    const potAfter = o.pot + o.toCall, odds = o.toCall / Math.max(1, potAfter);
    if (G.street === 'pre') {
      const sc = preScore(p.hole) + (posLate ? 2 : 0), facing = G.curBet / bb;   // 前面加注幾個大盲
      if (sc >= 24 || (sc >= 20 && facing <= 3)) {                                 // 好牌：加注
        if (o.canRaise && (facing <= 4 || sc >= 26) && r < 0.85) return { a: 'raise', to: roundTo(facing <= 1 ? 3 * bb : G.curBet * 3) };
        return { a: o.canCheck ? 'check' : 'call' };
      }
      if (o.canCheck) return { a: 'check' };
      if (sc >= 15 && facing <= 3) return { a: 'call' };
      if (sc >= 12 && facing <= 1.01 && r < 0.6) return { a: 'call' };            // 便宜進場
      if (sc >= 19 && facing <= 8) return { a: 'call' };
      return { a: 'fold' };
    }
    const eq = equity(p.hole, G.board, Math.max(1, opp), 160);
    const bet = f => roundTo(G.curBet + f * potAfter);
    if (o.canCheck) {
      if (eq > 0.72 && o.canRaise) return { a: 'raise', to: bet(0.55 + r * 0.3) };   // 牌好：下注拿價值
      if (eq > 0.55 && o.canRaise && r < 0.5) return { a: 'raise', to: bet(0.4) };
      if (eq < 0.3 && opp === 1 && G.street !== 'flop' && r < 0.12 && o.canRaise) return { a: 'raise', to: bet(0.5) };   // 偶爾詐唬
      return { a: 'check' };
    }
    if (eq > 0.8 && o.canRaise && r < 0.7) return { a: 'raise', to: roundTo(G.curBet * 2.5 + o.pot * 0.3) };
    if (eq > odds + 0.08 || (o.toCall <= bb && eq > odds)) return { a: 'call' };
    return { a: 'fold' };
  }
  function autoAct(G, si, smart) {
    if (G.turn !== si) return false;
    if (smart) { act(G, si, botDecide(G, si)); return true; }
    const o = options(G, si); act(G, si, { a: o && o.canCheck ? 'check' : 'fold' }); return true;   // 超時：能過牌就過，不然棄牌
  }
  function waitingOn(G) { return G.turn >= 0 && ['pre', 'flop', 'turn', 'river'].includes(G.street) ? [G.turn] : []; }
  // 後台調整（娛樂廳頁）：o = { rake, cap, tables: { n: { sb, bb, min }, ... } }；帶入籌碼範圍跟著大盲算（20～100 個大盲）
  function setCfg(o) {
    if (!o) return;
    if (+o.rake >= 0 && +o.rake < 0.5) API.RAKE = +o.rake;
    if (+o.cap > 0) API.RAKE_CAP_BB = +o.cap;
    for (const k in (o.tables || {})) if (TABLES[k]) for (const f of ['sb','bb','min']) { const v = Math.floor(+o.tables[k][f]); if (v > 0) TABLES[k][f] = v; }
    Object.values(TABLES).forEach(t => { t.buyMin = t.bb * 20; t.buyMax = t.bb * 100; });
  }
  const API = { setCfg, RAKE, RAKE_CAP_BB, TABLES, SEATS, HAND, v, su, eval5, best, cmp, newTable, canStart, startHand, act, options, botDecide, autoAct, waitingOn };
  return API;
})();
export default TH;
