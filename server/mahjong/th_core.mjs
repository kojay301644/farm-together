// 德州撲克：牌桌狀態機（純邏輯，不碰資料庫）
// 金幣：坐下時先從金幣扣「帶入籌碼」（index.ts 做），離桌時剩下的籌碼換回金幣（out.bank）；每局輸贏只記錄（out.log）
import TH from './th_engine.mjs';

export const TT = { TURN: 15000, BOT: 1100, SHOW: 5500, IDLE: 3000, START: 2500 };
const BOTS = [{ name: '小兔', av: 3 }, { name: '阿熊', av: 7 }, { name: '狐狸妹', av: 15 }, { name: '企鵝哥', av: 21 }, { name: '水獺', av: 24 }, { name: '小鼠', av: 9 }, { name: '刺蝟', av: 5 }, { name: '浣熊', av: 13 }];
const BOT_TOTAL = 4;   // 人不夠時，電腦補到 4 人

const inHand = (G) => ['pre', 'flop', 'turn', 'river'].includes(G.street);
const humansIn = (G) => G.seats.filter(p => p && p.uid).length;
function addBot(G) {
  const used = G.seats.filter(Boolean).map(p => p.name), L = BOTS.filter(b => !used.includes(b.name)), b = L[Math.floor(Math.random() * L.length)] || BOTS[0];
  const i = G.seats.findIndex(p => !p); if (i < 0) return;
  const T = TH.TABLES[G.table];
  G.seats[i] = { uid: null, bot: true, name: b.name, av: b.av, stack: T.buyMax, sitOut: true, auto: false, miss: 0 };   // 下一局才加入
}
// 電腦數量：真人越多，電腦越少（總共補到 4 人）；多的電腦這局結束就離開
function balanceBots(G) {
  const want = Math.max(0, BOT_TOTAL - humansIn(G) - (G.queue || []).length);
  let bots = G.seats.map((p, i) => (p && p.bot && !p.leaving ? i : -1)).filter(i => i >= 0);
  while (bots.length > want) { const i = bots.pop(); G.seats[i].leaving = true; }
  while (bots.length < want && G.seats.some(p => !p)) { addBot(G); bots = G.seats.map((p, i) => (p && p.bot && !p.leaving ? i : -1)).filter(i => i >= 0); }
}

export function newTable(lvl, priv, host, me, now) {
  const G = TH.newTable(lvl); G.queue = []; G.tAct = now; G.tWait = now; G.nextAt = now + TT.START; G.wKey = '';
  G.seats[0] = { uid: me.uid, name: me.name, av: me.av, stack: me.buyin, sitOut: true, auto: false, miss: 0 };
  balanceBots(G);
  return { lvl, priv, host, game: 'th', status: 'play', state: G };
}
export function humans(T) { return T.status === 'play' ? T.state.seats.filter(p => p && p.uid).map(p => p.uid).concat((T.state.queue || []).map(q => q.uid)) : []; }
export function addPlayer(T, me, now) {
  const G = T.state;
  if (G.seats.some(p => p && p.uid === me.uid) || (G.queue || []).some(q => q.uid === me.uid)) throw new Error('你已經在這桌了');
  if (humansIn(G) + G.queue.length >= TH.SEATS) throw new Error('這桌滿了');
  const i = G.seats.findIndex(p => !p);
  if (i >= 0) G.seats[i] = { uid: me.uid, name: me.name, av: me.av, stack: me.buyin, sitOut: true, auto: false, miss: 0 };   // 下一局開始發牌
  else G.queue.push({ uid: me.uid, name: me.name, av: me.av, stack: me.buyin });                                         // 坐滿：等電腦退位
  balanceBots(G);
  if (!inHand(G)) cleanup(G, now, { bank: {} });
}
// 一局結束（或還沒開局）時：離開的人換回金幣、電腦退位、排隊的人坐下
function cleanup(G, now, out) {
  G.seats.forEach((p, i) => {
    if (!p) return;
    if (p.leaving) { if (p.uid) out.bank[p.uid] = (out.bank[p.uid] || 0) + p.stack + (p.rebuy || 0); G.seats[i] = null; return; }
    if (p.rebuy) { p.stack += p.rebuy; p.rebuy = 0; }
    p.sitOut = p.stack <= 0;   // 沒籌碼：坐著等補籌碼
    if (p.bot && p.stack < TH.TABLES[G.table].bb * 10) p.stack = TH.TABLES[G.table].buyMax;
  });
  while (G.queue.length && G.seats.some(p => !p)) { const q = G.queue.shift(), i = G.seats.findIndex(p => !p); G.seats[i] = { uid: q.uid, name: q.name, av: q.av, stack: q.stack, sitOut: false, auto: false, miss: 0 }; }
  balanceBots(G);
  G.seats.forEach(p => { if (p && !p.leaving && p.stack > 0) p.sitOut = false; });
}
export function advance(T, now) {
  const out = { settle: null, kicked: [], bank: {}, log: null };
  const G = T.state;
  // 剛才的動作已經結束這局／有人離桌：把紀錄和要換回的金幣交給 index.ts
  if (G.pendingLog) { out.log = G.pendingLog; G.pendingLog = null; }
  if (G.refund) { for (const [u, x] of Object.entries(G.refund)) out.bank[u] = (out.bank[u] || 0) + x; G.refund = null; }
  for (let k = 0; k < 60; k++) {
    if (T.status !== 'play') break;
    if (!inHand(G)) {
      if (now < G.nextAt) break;
      cleanup(G, now, out);
      if (!humansIn(G) && !G.queue.length) { T.status = 'closed'; break; }
      if (!TH.canStart(G)) { G.nextAt = now + TT.IDLE; break; }
      G.seats.forEach(p => { if (p) p.startStack = p.stack; });
      TH.startHand(G); G.tAct = G.tWait = now; G.wKey = '';
      if (G.street === 'show') endHand(G, now, out);
      continue;
    }
    const key = G.handNo + ':' + G.log.length;
    if (key !== G.wKey) { G.wKey = key; G.tWait = now; }
    const j = G.turn, p = G.seats[j]; if (j < 0 || !p) break;
    const bot = !p.uid || p.auto || p.leaving;
    const due = bot ? G.tAct + TT.BOT : G.tWait + TT.TURN;
    if (now < due) break;
    if (bot) TH.autoAct(G, j, !p.uid);
    else { TH.autoAct(G, j, false); p.miss = (p.miss || 0) + 1; if (p.miss >= 2) p.auto = true; }
    G.tAct = now;
    if (G.street === 'show') endHand(G, now, out);
  }
  return out;
}
function endHand(G, now, out) {
  // 這局每個真人贏輸多少（只記錄，金幣在離桌時才換）；娛樂廳抽成
  const d = {}; G.seats.forEach(p => { if (p && p.uid && p.startStack != null) { const x = p.stack - p.startStack; if (x) d[p.uid] = x; } });
  out.log = { hand: G.handNo, delta: d, house: G.result ? G.result.rake : 0 };
  G.nextAt = now + TT.SHOW;
}
export function dueAt(T) {
  if (T.status !== 'play') return null;
  const G = T.state;
  if (!inHand(G)) return G.nextAt;
  const p = G.seats[G.turn]; if (!p) return G.nextAt;
  return (!p.uid || p.auto || p.leaving) ? G.tAct + TT.BOT : G.tWait + TT.TURN;
}
export function playerAct(T, uid, a, now) {
  const G = T.state, i = G.seats.findIndex(p => p && p.uid === uid), p = G.seats[i];
  if (!p) throw new Error('你不在座位上');
  if (a.a === 'auto') { p.auto = !!a.on; p.miss = 0; if (!a.on) G.tWait = Math.max(G.tWait, now); return; }
  if (a.a === 'rebuy') {   // index.ts 已經先扣金幣；下一局開始前加進籌碼
    p.rebuy = (p.rebuy || 0) + Math.floor(+a.amt || 0);
    if (!inHand(G) || !p.inHand) { p.stack += p.rebuy; p.rebuy = 0; p.sitOut = p.stack <= 0; }
    return;
  }
  TH.act(G, i, a); p.miss = 0; G.tAct = now;
  if (G.street === 'show') { const out = { bank: {} }; endHand(G, now, out); G.pendingLog = out.log; }
}
export function leave(T, uid, now) {
  const G = T.state;
  const qi = (G.queue || []).findIndex(q => q.uid === uid);
  if (qi >= 0) { const q = G.queue.splice(qi, 1)[0]; G.refund = G.refund || {}; G.refund[uid] = (G.refund[uid] || 0) + q.stack; balanceBots(G); return; }
  const p = G.seats.find(x => x && x.uid === uid); if (!p) return;
  p.leaving = true; p.auto = true;
  // 沒參加這局（或還沒開局）：馬上離開、換回金幣。正在打（含已棄牌，下注還在底池裡）：這局結束才離開
  if (!inHand(G) || !p.inHand) {
    const i = G.seats.indexOf(p); G.refund = G.refund || {}; G.refund[uid] = (G.refund[uid] || 0) + p.stack + (p.rebuy || 0);
    G.seats[i] = null; balanceBots(G);
  }
}
export function viewFor(T, uid, now) {
  const base = { tid: T.id, ver: T.ver || 0, game: 'th', lvl: T.lvl, priv: T.priv, code: T.priv ? T.code : null, host: T.host === uid, status: T.status, now, due: dueAt(T) };
  if (T.status !== 'play') return base;
  const G = T.state, me = G.seats.findIndex(p => p && p.uid === uid), queued = (G.queue || []).some(q => q.uid === uid);
  if (me < 0 && !queued) return base;
  const show = G.street === 'show' && G.result && G.result.show;
  const opts = me >= 0 ? TH.options(G, me) : null;
  return { ...base, street: G.street, handNo: G.handNo, board: G.board, button: G.button, turn: G.turn, me, queued, curBet: G.curBet || 0,
    pot: G.seats.reduce((a, p) => a + (p && p.inHand ? p.put : 0), 0),
    seats: G.seats.map((p, i) => p && { name: p.name, av: p.av, bot: !!p.bot, stack: p.stack, bet: p.bet || 0, put: p.put || 0, inHand: !!p.inHand, folded: !!p.folded, allin: !!p.allin, last: p.last, sitOut: !!p.sitOut, auto: !!p.auto, leaving: !!p.leaving, rebuy: p.rebuy || 0,
      hole: (i === me || (show && p.shown)) ? p.hole : (p.inHand && !p.folded ? [null, null] : []), me: i === me }),
    opts, deadline: opts && G.seats[me] && !G.seats[me].auto ? G.tWait + TT.TURN : null,
    result: G.street === 'show' ? G.result : null, nextAt: G.nextAt, ticker: G.seats.findIndex(p => p && p.uid) === me, waiting: [], log: G.log.slice(-10), logN: G.log.length };
}
// 牌桌被清掉時，每個真人還在桌上的籌碼（含這局已經下注的）
export function refunds(T) {
  const G = T.state, r = {};
  (G.seats || []).forEach(p => { if (p && p.uid) r[p.uid] = (r[p.uid] || 0) + (p.stack || 0) + (p.put || 0) * (['pre', 'flop', 'turn', 'river'].includes(G.street) ? 1 : 0) + (p.rebuy || 0); });
  (G.queue || []).forEach(q => { r[q.uid] = (r[q.uid] || 0) + q.stack; });
  return r;
}
