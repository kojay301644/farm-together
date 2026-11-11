/* ================= 台灣 16 張麻將規則引擎 =================
   純邏輯，不碰畫面；之後伺服器（Edge Function）也用同一份。
   牌編碼：萬 11-19、筒 21-29、條 31-39、東南西北 41-44、中發白 45-47、花 51-58（春夏秋冬 梅蘭竹菊） */
const MJ = (() => {
  const RESERVE = 16;                       // 海底留 16 張不摸
  const KINDS = []; for (let s = 1; s <= 3; s++) for (let n = 1; n <= 9; n++) KINDS.push(s * 10 + n); for (let h = 41; h <= 47; h++) KINDS.push(h);
  const isFlower = t => t > 50, isHonor = t => t > 40 && t < 50, suitOf = t => Math.floor(t / 10);
  const NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const HON = { 41: '東', 42: '南', 43: '西', 44: '北', 45: '中', 46: '發', 47: '白' };
  const FLW = { 51: '春', 52: '夏', 53: '秋', 54: '冬', 55: '梅', 56: '蘭', 57: '竹', 58: '菊' };
  const WIND = ['東', '南', '西', '北'];
  function name(t) { if (isFlower(t)) return FLW[t]; if (isHonor(t)) return HON[t]; return NUM[t % 10] + ['', '萬', '筒', '條'][suitOf(t)]; }

  /* ---------- 小工具 ---------- */
  const cnt = arr => { const c = new Array(60).fill(0); arr.forEach(t => c[t]++); return c; };
  const sortT = arr => arr.sort((a, b) => a - b);
  function removeN(arr, t, n = 1) { for (let k = 0; k < n; k++) { const i = arr.indexOf(t); if (i < 0) throw new Error('沒有這張牌'); arr.splice(i, 1); } }
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- 胡牌判斷與拆解 ---------- */
  function canWin(hand) {                    // hand: 手上暗牌（張數 3n+2）
    if (hand.length % 3 !== 2) return false;
    const c = cnt(hand);
    for (const p of KINDS) if (c[p] >= 2) { c[p] -= 2; const ok = allSets(c); c[p] += 2; if (ok) return true; }
    return false;
  }
  function allSets(c) {
    let i = 0; while (i < 50 && !c[i]) i++; if (i >= 50) return true;
    if (c[i] >= 3) { c[i] -= 3; const ok = allSets(c); c[i] += 3; if (ok) return true; }
    if (!isHonor(i) && i % 10 <= 7 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; const ok = allSets(c); c[i]++; c[i + 1]++; c[i + 2]++; if (ok) return true; }
    return false;
  }
  function decomps(hand) {                   // 列出所有拆法：{pair, sets:[{k:'chi'|'pon', t}]}
    const out = [], c = cnt(hand);
    for (const p of KINDS) if (c[p] >= 2) { c[p] -= 2; walk(c, [], s => out.push({ pair: p, sets: s })); c[p] += 2; }
    return out;
  }
  function walk(c, acc, emit) {
    let i = 0; while (i < 50 && !c[i]) i++; if (i >= 50) return emit(acc.slice());
    if (c[i] >= 3) { c[i] -= 3; acc.push({ k: 'pon', t: i }); walk(c, acc, emit); acc.pop(); c[i] += 3; }
    if (!isHonor(i) && i % 10 <= 7 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; acc.push({ k: 'chi', t: i }); walk(c, acc, emit); acc.pop(); c[i]++; c[i + 1]++; c[i + 2]++; }
  }
  function waits(hand) { return KINDS.filter(t => canWin(hand.concat([t]))); }   // hand: 3n+1 張
  // 輪到出牌時：打哪張會聽牌、聽什麼 → { 牌: [聽的牌…] }
  function tingTiles(s) {
    if (s.hand.length % 3 !== 2) return null;
    const out = {};
    for (const t of new Set(s.hand)) { const h = s.hand.slice(); removeN(h, t); const w = waits(h); if (w.length) out[t] = w; }
    return Object.keys(out).length ? out : null;
  }

  /* ---------- 向聽數（電腦玩家用） ---------- */
  const memo = new Map();
  function groupOpts(arr, chi) {             // arr: 9 或 7 格的張數，回傳 [m,t,p] 的組合
    const key = (chi ? 'c' : 'h') + arr.join('');
    if (memo.has(key)) return memo.get(key);
    const res = new Map();
    const add = (m, t, p) => { const k = m + ',' + t + ',' + p; if (!res.has(k)) res.set(k, [m, t, p]); };
    (function dfs(a, i, m, t, p) {
      while (i < a.length && !a[i]) i++;
      if (i >= a.length) return add(m, t, p);
      if (a[i] >= 3) { a[i] -= 3; dfs(a, i, m + 1, t, p); a[i] += 3; }
      if (chi && i <= 6 && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; dfs(a, i, m + 1, t, p); a[i]++; a[i + 1]++; a[i + 2]++; }
      if (a[i] >= 2) { a[i] -= 2; if (!p) dfs(a, i, m, t, 1); dfs(a, i, m, t + 1, p); a[i] += 2; }
      if (chi && i <= 7 && a[i + 1]) { a[i]--; a[i + 1]--; dfs(a, i, m, t + 1, p); a[i]++; a[i + 1]++; }
      if (chi && i <= 6 && a[i + 2]) { a[i]--; a[i + 2]--; dfs(a, i, m, t + 1, p); a[i]++; a[i + 2]++; }
      a[i]--; dfs(a, i, m, t, p); a[i]++;
    })(arr.slice(), 0, 0, 0, 0);
    // 只留下不被其他組合完全壓過的
    const all = [...res.values()];
    const keep = all.filter(x => !all.some(y => y !== x && y[0] >= x[0] && y[1] >= x[1] && y[2] >= x[2] && (y[0] + y[1] + y[2] > x[0] + x[1] + x[2])));
    memo.set(key, keep); if (memo.size > 20000) memo.clear();
    return keep;
  }
  function shanten(hand, meldsN) {           // -1 = 已胡
    const N = 5 - meldsN, c = cnt(hand);
    const g = [1, 2, 3].map(s => groupOpts(c.slice(s * 10 + 1, s * 10 + 10), true)).concat([groupOpts(c.slice(41, 48), false)]);
    let best = 99;
    for (const a of g[0]) for (const b of g[1]) for (const d of g[2]) for (const e of g[3]) {
      const m = a[0] + b[0] + d[0] + e[0]; let t = a[1] + b[1] + d[1] + e[1]; const ps = a[2] + b[2] + d[2] + e[2];
      const p = ps > 0 ? 1 : 0; t += Math.max(0, ps - 1);
      const mm = Math.min(m, N), tt = Math.min(t, N - mm);
      const sh = 2 * (N - mm) - tt - p;
      if (sh < best) best = sh;
    }
    return best;
  }

  /* ---------- 牌局建立 ---------- */
  const TABLES = {
    n: { name: '新手桌', base: 100, tai: 20, min: 2000 },
    m: { name: '中級桌', base: 500, tai: 100, min: 10000 },
    h: { name: '高手桌', base: 2000, tai: 400, min: 40000 },
  };
  const RAKE = 0.05;
  function newGame(players, opt = {}) {      // players: [{id,name,av,bot,gold}] ×4
    const G = {
      table: opt.table || 'n', seats: players.map(p => ({ id: p.id, name: p.name, av: p.av, bot: !!p.bot, gold: p.gold || 0, auto: false })),
      dealer: opt.dealer || 0, firstDealer: opt.dealer || 0, lian: 0, wind: 0, handNo: 0, seq: 0, log: [], history: [],
    };
    startHand(G, opt.rnd);
    return G;
  }
  function startHand(G, rnd = Math.random) {
    const w = []; KINDS.forEach(t => { for (let k = 0; k < 4; k++) w.push(t); }); for (let f = 51; f <= 58; f++) w.push(f);
    G.wall = shuffle(w, rnd); G.handNo++; G.dice = [1,2,3].map(() => 1 + Math.floor(rnd() * 6)); G.result = null; G.last = null; G.pend = null; G.drawn = null; G.kakan = null;
    G.afterKan = false; G.anyClaim = false; G.log = [];
    G.seats.forEach(s => { s.hand = []; s.melds = []; s.flowers = []; s.river = []; s.firstGo = true; s.ting = false; });
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const s = G.seats[(G.dealer + k) % 4]; for (let j = 0; j < 4; j++) s.hand.push(G.wall.shift()); }
    // 開局補花（從莊家開始）
    for (let k = 0; k < 4; k++) { const si = (G.dealer + k) % 4; replaceFlowers(G, si); }
    G.seats.forEach(s => sortT(s.hand));
    G.phase = 'play'; G.turn = G.dealer;
    drawTile(G, G.dealer, false);            // 莊家摸第 17 張
    G.seq++;
  }
  function replaceFlowers(G, si) {
    const s = G.seats[si];
    for (;;) { const f = s.hand.filter(isFlower); if (!f.length) return;
      f.forEach(t => { removeN(s.hand, t); s.flowers.push(t); s.hand.push(G.wall.pop()); G.log.push({ k: 'flower', s: si, t }); }); }
  }
  function drawTile(G, si, fromBack) {
    const s = G.seats[si];
    for (;;) {
      if (G.wall.length <= RESERVE) return endDraw(G);
      const t = fromBack ? G.wall.pop() : G.wall.shift();
      if (isFlower(t)) { s.flowers.push(t); G.log.push({ k: 'flower', s: si, t }); fromBack = true; continue; }
      s.hand.push(t); G.drawn = t; G.turn = si; G.phase = 'play'; G.log.push({ k: 'draw', s: si });
      return;
    }
  }

  /* ---------- 可以做什麼 ---------- */
  function options(G, si) {
    const s = G.seats[si], o = {};
    if (G.phase === 'play' && G.turn === si) {
      o.discard = true;
      if (G.drawn != null && canWin(s.hand)) o.zimo = true;
      if (!s.ting) o.ting = tingTiles(s);
      if (G.drawn != null && G.wall.length > RESERVE && !s.ting) {
        const c = cnt(s.hand);
        const an = KINDS.filter(t => c[t] === 4); if (an.length) o.ankan = an;
        const ka = s.melds.filter(m => m.k === 'pon' && c[m.t]).map(m => m.t); if (ka.length) o.kakan = ka;
      }
    } else if (G.phase === 'claim' && G.pend && G.pend[si] && G.pend[si].pick == null) {
      return G.pend[si].opts;
    }
    return o;
  }
  function claimOpts(G, si, t, from, kakanOnly) {
    const s = G.seats[si], o = {}, c = cnt(s.hand);
    if (canWin(s.hand.concat([t]))) o.hu = true;
    if (kakanOnly || s.ting) return o;
    if (c[t] >= 2) o.pon = true;
    if (c[t] >= 3 && G.wall.length > RESERVE) o.kan = true;
    if (si === (from + 1) % 4 && !isHonor(t)) {
      const n = t % 10, ch = [];
      if (n >= 3 && c[t - 2] && c[t - 1]) ch.push([t - 2, t - 1]);
      if (n >= 2 && n <= 8 && c[t - 1] && c[t + 1]) ch.push([t - 1, t + 1]);
      if (n <= 7 && c[t + 1] && c[t + 2]) ch.push([t + 1, t + 2]);
      if (ch.length) o.chi = ch;
    }
    return o;
  }

  /* ---------- 動作 ---------- */
  function canTing(G, si) {
    const s = G.seats[si];
    return !s.ting && G.phase !== 'end' && s.hand.length % 3 === 1 && !(G.phase === 'play' && G.turn === si) && waits(s.hand).length > 0;
  }
  function act(G, si, a) {
    if (G.phase === 'end') throw new Error('這局已經結束');
    const s = G.seats[si];
    // 報聽：打出牌之後、還沒輪到自己摸牌前，聽牌了就可以按
    if (a.a === 'ting') {
      if (!canTing(G, si)) throw new Error('現在不能報聽');
      s.ting = true; G.log.push({ k: 'ting', s: si }); G.seq++;
      if (G.phase === 'claim' && G.pend && G.pend[si] && G.pend[si].pick == null) {
        const o = G.pend[si].opts;
        if (o.hu) { G.pend[si].pick = { a: 'hu' }; return resolveClaims(G); }
        G.pend[si].opts = {}; G.pend[si].pick = { a: 'pass' }; return resolveClaims(G);
      }
      return;
    }
    if (G.phase === 'play') {
      if (G.turn !== si) throw new Error('還沒輪到你');
      const o = options(G, si);
      if (a.a === 'zimo') { if (!o.zimo) throw new Error('還不能胡'); return win(G, si, G.drawn, null, { self: true }); }
      if (a.a === 'ankan') {
        if (!(o.ankan || []).includes(a.t)) throw new Error('不能暗槓');
        removeN(s.hand, a.t, 4); s.melds.push({ k: 'ankan', t: a.t }); G.log.push({ k: 'ankan', s: si, t: a.t });
        G.drawn = null; G.afterKan = true; drawTile(G, si, true); G.seq++; return;
      }
      if (a.a === 'kakan') {
        if (!(o.kakan || []).includes(a.t)) throw new Error('不能加槓');
        removeN(s.hand, a.t); G.drawn = null;
        // 先看有沒有人搶槓
        const pend = {}; let any = false;
        for (let k = 1; k < 4; k++) { const j = (si + k) % 4, co = claimOpts(G, j, a.t, si, true); if (co.hu) { pend[j] = { opts: co, pick: G.seats[j].ting ? { a: 'hu' } : null }; any = true; } }
        if (any) { G.phase = 'claim'; G.pend = pend; G.last = { t: a.t, from: si }; G.kakan = { s: si, t: a.t }; G.seq++; if (Object.values(pend).some(p => p.pick)) return resolveClaims(G); return; }
        return doKakan(G, si, a.t);
      }
      if (a.a === 'discard') {
        if (!s.hand.includes(a.t)) throw new Error('沒有這張牌');
        if (s.ting && G.drawn != null && a.t !== G.drawn) throw new Error('報聽後只能打摸到的牌');
        if (a.ting && !s.ting) { const h = s.hand.slice(); removeN(h, a.t); if (!waits(h).length) throw new Error('打這張不會聽牌'); s.ting = true; G.log.push({ k: 'ting', s: si }); }
        removeN(s.hand, a.t); sortT(s.hand); s.river.push(a.t); s.firstGo = false;
        G.drawn = null; G.afterKan = false; G.last = { t: a.t, from: si }; G.log.push({ k: 'discard', s: si, t: a.t });
        return openClaims(G, si, a.t);
      }
      throw new Error('現在要打牌');
    }
    if (G.phase === 'claim') {
      const p = G.pend && G.pend[si]; if (!p || p.pick != null) throw new Error('現在不能動作');
      if (a.a === 'pass') p.pick = { a: 'pass' };
      else if (a.a === 'hu' && p.opts.hu) p.pick = { a: 'hu' };
      else if (a.a === 'pon' && p.opts.pon) p.pick = { a: 'pon' };
      else if (a.a === 'kan' && p.opts.kan) p.pick = { a: 'kan' };
      else if (a.a === 'chi' && p.opts.chi && p.opts.chi.some(c => c[0] === a.use[0] && c[1] === a.use[1])) p.pick = { a: 'chi', use: a.use };
      else throw new Error('不能這樣做');
      return resolveClaims(G);
    }
  }
  function doKakan(G, si, t) {
    const s = G.seats[si], m = s.melds.find(x => x.k === 'pon' && x.t === t);
    m.k = 'kan'; G.log.push({ k: 'kakan', s: si, t }); G.kakan = null; G.afterKan = true;
    drawTile(G, si, true); G.seq++;
  }
  function openClaims(G, from, t) {
    const pend = {}; let any = false;
    for (let k = 1; k < 4; k++) { const j = (from + k) % 4, co = claimOpts(G, j, t, from); if (Object.keys(co).length) { pend[j] = { opts: co, pick: G.seats[j].ting && co.hu ? { a: 'hu' } : null }; any = true; } }
    if (!any) { G.pend = null; drawTile(G, (from + 1) % 4, false); G.seq++; return; }
    G.phase = 'claim'; G.pend = pend; G.seq++;
    if (Object.values(pend).some(p => p.pick)) return resolveClaims(G);
  }
  function resolveClaims(G) {
    const P = G.pend, from = G.last.from, t = G.last.t, order = [1, 2, 3].map(k => (from + k) % 4).filter(j => P[j]);
    // 胡最大（截胡：離放槍的人最近的先）；有人還沒決定、而且他可能比目前最好的選擇優先，就要等
    const rank = x => !x ? 0 : x.a === 'hu' ? 3 : (x.a === 'pon' || x.a === 'kan') ? 2 : x.a === 'chi' ? 1 : 0;
    const maxRank = o => o.hu ? 3 : (o.pon || o.kan) ? 2 : o.chi ? 1 : 0;
    let best = null, bestJ = -1;
    for (const j of order) { const r = rank(P[j].pick); if (r > rank(best)) { best = P[j].pick; bestJ = j; } }
    for (const j of order) if (P[j].pick == null) {
      const mr = maxRank(P[j].opts);
      if (mr > rank(best) || (mr === 3 && rank(best) === 3 && order.indexOf(j) < order.indexOf(bestJ))) return void G.seq++;
    }
    G.pend = null;
    if (G.kakan) {                           // 搶槓
      if (best && best.a === 'hu') { const ks = G.kakan.s; const m = G.seats[ks].melds.find(x => x.k === 'pon' && x.t === t); G.kakan = null; return win(G, bestJ, t, ks, { rob: true }); }
      return doKakan(G, G.kakan.s, t);
    }
    if (!best || best.a === 'pass') { G.phase = 'play'; drawTile(G, (from + 1) % 4, false); G.seq++; return; }
    if (best.a === 'hu') return win(G, bestJ, t, from, {});
    const s = G.seats[bestJ], fr = G.seats[from]; fr.river.pop(); G.anyClaim = true;
    G.seats.forEach(x => x.firstGo = false);
    if (best.a === 'pon') { removeN(s.hand, t, 2); s.melds.push({ k: 'pon', t, from }); G.log.push({ k: 'pon', s: bestJ, t }); G.phase = 'play'; G.turn = bestJ; G.drawn = null; G.seq++; return; }
    if (best.a === 'kan') { removeN(s.hand, t, 3); s.melds.push({ k: 'kan', t, from }); G.log.push({ k: 'kan', s: bestJ, t }); G.afterKan = true; drawTile(G, bestJ, true); G.seq++; return; }
    if (best.a === 'chi') { best.use.forEach(u => removeN(s.hand, u)); const lo = Math.min(t, ...best.use); s.melds.push({ k: 'chi', t: lo, got: t, from }); G.log.push({ k: 'chi', s: bestJ, t }); G.phase = 'play'; G.turn = bestJ; G.drawn = null; G.seq++; return; }
  }

  /* ---------- 算台 ---------- */
  function score(G, si, winTile, flags) {
    const s = G.seats[si], seatWind = (si - G.dealer + 4) % 4, hand = s.hand.slice();
    if (!flags.self) hand.push(winTile);
    const melds = s.melds, open = melds.filter(m => m.k !== 'ankan');
    const before = hand.slice(); removeN(before, winTile); const wt = waits(before);
    const allTiles = hand.concat(...melds.map(m => m.k === 'chi' ? [m.t, m.t + 1, m.t + 2] : [m.t, m.t, m.t]));
    const suits = new Set(allTiles.filter(t => !isHonor(t)).map(suitOf)), hasHonor = allTiles.some(isHonor);
    let best = null;
    for (const d of decomps(hand)) {
      const L = [], add = (n, v) => L.push([n, v]);
      const pons = d.sets.filter(x => x.k === 'pon').map(x => x.t).concat(melds.filter(m => m.k !== 'chi').map(m => m.t));
      const chis = d.sets.filter(x => x.k === 'chi').length + melds.filter(m => m.k === 'chi').length;
      // 暗刻：手上的刻子＋暗槓；放槍胡、而且那張只能湊成刻子時，那組不算暗刻
      let an = d.sets.filter(x => x.k === 'pon').length + melds.filter(m => m.k === 'ankan').length;
      if (!flags.self && d.sets.some(x => x.k === 'pon' && x.t === winTile) && !d.sets.some(x => x.k === 'chi' && winTile >= x.t && winTile <= x.t + 2) && d.pair !== winTile) an--;
      const menqing = open.length === 0;
      if (flags.tian) add('天胡', 16); else if (flags.di) add('地胡', 16);
      if (s.ting) add('報聽', 1);
      if (menqing && flags.self) add('門清自摸', 3); else { if (menqing) add('門清', 1); if (flags.self) add('自摸', 1); }
      if (open.length === 5 && !flags.self) add('全求人', 2);
      if (!flags.self && !hasHonor && !s.flowers.length && chis === 5 && wt.length >= 2 && menqing) add('平胡', 2);
      if (chis === 0) add('碰碰胡', 4);
      if (an >= 5) add('五暗刻', 8); else if (an === 4) add('四暗刻', 5); else if (an === 3) add('三暗刻', 2);
      if (!hasHonor && suits.size === 1) add('清一色', 8); else if (hasHonor && suits.size === 1) add('混一色', 4); else if (suits.size === 0) add('字一色', 16);
      const dr = pons.filter(t => t >= 45).length, drP = d.pair >= 45;
      if (dr === 3) add('大三元', 8); else if (dr === 2 && drP) add('小三元', 4); else for (const t of pons) if (t >= 45) add(HON[t], 1);
      const wd = pons.filter(t => t >= 41 && t <= 44).length, wdP = d.pair >= 41 && d.pair <= 44;
      if (wd === 4) add('大四喜', 16); else if (wd === 3 && wdP) add('小四喜', 8);
      else { if (pons.includes(41 + G.wind)) add('圈風' + WIND[G.wind], 1); if (pons.includes(41 + seatWind)) add('門風' + WIND[seatWind], 1); }
      const fl = s.flowers;
      [[51, 54, '春夏秋冬'], [55, 58, '梅蘭竹菊']].forEach(([a, b, nm]) => {
        if ([0, 1, 2, 3].every(k => fl.includes(a + k))) add('花槓 ' + nm, 2);
        else if (fl.includes(a + seatWind)) add('正花 ' + FLW[a + seatWind], 1);
      });
      if (G.wall.length <= RESERVE) add(flags.self ? '海底撈月' : '河底撈魚', 1);
      if (flags.self && G.afterKan) add('槓上開花', 1);
      if (flags.rob) add('搶槓', 1);
      if (wt.length === 1 && !(open.length === 5)) add('獨聽', 1);
      const total = L.reduce((a, x) => a + x[1], 0);
      if (!best || total > best.total) best = { list: L, total };
    }
    return best;
  }
  function win(G, si, t, from, flags) {
    const s = G.seats[si];
    if (flags.self && G.anyClaim === false && s.firstGo && si === G.dealer && s.river.length === 0) flags.tian = true;
    else if (flags.self && G.anyClaim === false && s.firstGo && s.river.length === 0) flags.di = true;
    const sc = score(G, si, t, flags);
    if (!flags.self) s.hand.push(t);
    if (!flags.self && from != null && !flags.rob) G.seats[from].river.pop();
    const T = TABLES[G.table], pay = [0, 0, 0, 0];
    const payers = flags.self ? [0, 1, 2, 3].filter(j => j !== si) : [from];
    const lines = [];
    for (const j of payers) {
      const dealerIn = (si === G.dealer || j === G.dealer);
      const tai = sc.total + (dealerIn ? 1 + 2 * G.lian : 0);
      const want = T.base + tai * T.tai, got = Math.max(0, Math.min(want, G.seats[j].gold));
      pay[j] -= got; pay[si] += got; lines.push({ s: j, tai, amt: got, short: got < want });
    }
    const rake = Math.floor(pay[si] * RAKE); pay[si] -= rake;
    pay.forEach((v, j) => G.seats[j].gold += v);
    const dealerTai = (G.lian ? `連${G.lian}拉${G.lian}` : '');
    G.result = { win: si, from: flags.self ? null : from, self: !!flags.self, t, tai: sc.list, total: sc.total, dealer: G.dealer, lian: G.lian, dealerTai, lines, pay, rake,
      hands: G.seats.map(x => sortT(x.hand.slice())) };
    G.log.push({ k: flags.self ? 'zimo' : 'hu', s: si, t });
    G.phase = 'end'; G.pend = null; G.seq++;
    G.history.push({ n: G.handNo, win: si, total: sc.total, pay });
  }
  function endDraw(G) {
    G.result = { draw: true, pay: [0, 0, 0, 0], dealer: G.dealer, lian: G.lian, hands: G.seats.map(x => sortT(x.hand.slice())) };
    G.log.push({ k: 'drawgame' }); G.phase = 'end'; G.pend = null; G.drawn = null; G.seq++;
    G.history.push({ n: G.handNo, draw: true });
  }
  function nextHand(G, rnd) {                // 莊家胡或流局 → 連莊；否則下莊
    const r = G.result;
    if (r && (r.draw || r.win === G.dealer)) G.lian++;
    else { G.dealer = (G.dealer + 1) % 4; G.lian = 0; if (G.dealer === G.firstDealer) G.wind = (G.wind + 1) % 4; }
    startHand(G, rnd);
  }

  /* ---------- 電腦玩家 ---------- */
  function bestDiscard(s) {
    const N = s.melds.length, cand = [...new Set(s.hand)];
    let best = null;
    for (const t of cand) {
      const h = s.hand.slice(); removeN(h, t); const sh = shanten(h, N);
      // 同向聽：比有效牌種類，再優先丟字牌、么九
      let uk = 0; if (!best || sh <= best.sh) { for (const k of KINDS) { if (shanten(h.concat([k]), N) < sh) uk++; } }
      const lone = isHonor(t) ? 2 : (t % 10 === 1 || t % 10 === 9) ? 1 : 0;
      const v = { t, sh, uk, lone };
      if (!best || sh < best.sh || (sh === best.sh && (uk > best.uk || (uk === best.uk && lone > best.lone)))) best = v;
    }
    return best;
  }
  function botDecide(G, si) {
    const s = G.seats[si];
    if (G.phase === 'play' && G.turn === si) {
      const o = options(G, si);
      if (o.zimo) return { a: 'zimo' };
      if (s.ting) return { a: 'discard', t: G.drawn != null ? G.drawn : s.hand[s.hand.length - 1] };
      if (o.ankan) return { a: 'ankan', t: o.ankan[0] };
      if (o.kakan) return { a: 'kakan', t: o.kakan[0] };
      const bd = bestDiscard(s);
      return { a: 'discard', t: bd.t, ting: bd.sh === 0 };
    }
    if (G.phase === 'claim' && G.pend && G.pend[si] && G.pend[si].pick == null) {
      const o = G.pend[si].opts, t = G.last.t, N = s.melds.length;
      if (o.hu) return { a: 'hu' };
      const sh0 = shanten(s.hand, N);
      const after = (h) => bestDiscard({ hand: h, melds: new Array(N + 1) }).sh;
      if (o.kan) { const h = s.hand.slice(); removeN(h, t, 3); if (shanten(h, N + 1) <= sh0) return { a: 'kan' }; }
      if (o.pon) { const h = s.hand.slice(); removeN(h, t, 2); const sh1 = after(h); const yaku = t >= 45 || t === 41 + G.wind || t === 41 + (si - G.dealer + 4) % 4;
        if (sh1 < sh0 || (yaku && sh1 <= sh0)) return { a: 'pon' }; }
      if (o.chi) for (const u of o.chi) { const h = s.hand.slice(); u.forEach(x => removeN(h, x)); if (after(h) < sh0) return { a: 'chi', use: u }; }
      return { a: 'pass' };
    }
    return null;
  }
  // 讓某個座位自動動作（電腦或超時代打）；回傳有沒有動
  function autoAct(G, si, smart) {
    if (G.seats[si].ting) smart = true;   // 報聽的人：一律照規則自動處理
    if (smart) { const d = botDecide(G, si); if (d) { act(G, si, d); return true; } return false; }
    // 超時代打：沒報聽的人不幫他胡（胡不胡要自己選），直接打掉摸到的牌／當作不要
    if (G.phase === 'play' && G.turn === si) { act(G, si, { a: 'discard', t: G.drawn != null ? G.drawn : G.seats[si].hand[G.seats[si].hand.length - 1] }); return true; }
    if (G.phase === 'claim' && G.pend && G.pend[si] && G.pend[si].pick == null) { act(G, si, { a: 'pass' }); return true; }
    return false;
  }
  function waitingOn(G) {                    // 目前在等誰
    if (G.phase === 'play') return [G.turn];
    if (G.phase === 'claim' && G.pend) return Object.keys(G.pend).map(Number).filter(j => G.pend[j].pick == null);
    return [];
  }

  /* ---------- 給某個座位看的畫面資料（藏起別人的牌） ---------- */
  function view(G, me) {
    const end = G.phase === 'end';
    return {
      me, table: G.table, phase: G.phase, firstDealer: G.firstDealer, turn: G.turn, dealer: G.dealer, lian: G.lian, wind: G.wind, handNo: G.handNo, seq: G.seq,
      left: Math.max(0, G.wall.length - RESERVE), last: G.last, dice: G.dice,
      seats: G.seats.map((s, j) => ({ name: s.name, av: s.av, bot: s.bot, gold: s.gold, auto: s.auto, ting: !!s.ting, n: s.hand.length, melds: s.melds, flowers: s.flowers, river: s.river,
        hand: (j === me || end) ? sortT(s.hand.slice()) : null, wind: (j - G.dealer + 4) % 4 })),
      drawn: G.turn === me ? G.drawn : null, opts: Object.assign({}, options(G, me), (me >= 0 && G.seats[me] && canTing(G, me)) ? { canTing: true } : {}), waiting: waitingOn(G), result: G.result, log: G.log.slice(-6),
    };
  }

  return { RESERVE, KINDS, TABLES, RAKE, WIND, name, isFlower, isHonor, suitOf, canWin, waits, tingTiles, canTing, shanten, decomps, newGame, nextHand, act, options, botDecide, autoAct, waitingOn, view, score };
})();
export default MJ;
