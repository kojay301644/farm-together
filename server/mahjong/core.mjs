// 麻將連線版：牌桌狀態機（純邏輯，不碰資料庫；index.ts 負責讀寫）
import MJ from './mj_engine.mjs';
import B2 from './b2_engine.mjs';
import * as BCC from './bc_core.mjs';
import * as THC from './th_core.mjs';
// 同一套牌桌流程給不同遊戲用：麻將（mj）、大老二（b2）
const E = (T) => (T.game === 'b2' ? B2 : MJ);
const turnMs = (T) => (T.game === 'b2' ? 20000 : TIME.TURN);

export const TIME = { TURN: 15000, CLAIM: 5000, BOT_PLAY: 900, BOT_CLAIM: 450, WAIT_START: 8000, NEXT_WAIT: 12000, DICE: 2300 };
const BOTS = [{ name: '小兔', av: 3 }, { name: '阿熊', av: 7 }, { name: '狐狸妹', av: 15 }, { name: '企鵝哥', av: 21 }, { name: '水獺', av: 24 }, { name: '小鼠', av: 9 }, { name: '刺蝟', av: 5 }, { name: '浣熊', av: 13 }];
const pickBot = (used) => { const L = BOTS.filter(b => !used.includes(b.name)); return L[Math.floor(Math.random() * L.length)] || BOTS[0]; };
const botGold = (T) => E(T).TABLES[T.lvl].min * 4 + Math.floor(Math.random() * E(T).TABLES[T.lvl].min * 2);

// T: { id, lvl, priv, code, host, status:'wait'|'play'|'closed', state }
function _newTable(lvl, priv, host, me, now, game) {
  return { lvl, priv, host, game: game || 'mj', status: 'wait', state: { wait: { players: [me], startAt: priv ? now + 3600e3 : now + TIME.WAIT_START } } };
}
function _humans(T) {
  const G = T.state;
  if (T.status === 'wait') return G.wait.players.map(p => p.uid);
  if (T.status !== 'play') return [];
  return [...new Set(G.uids.filter(Boolean).concat((G.pending || []).map(p => p.uid)))];
}
function _seatOf(T, uid) { return T.status === 'play' ? T.state.uids.indexOf(uid) : -1; }

function _addPlayer(T, me, now) {
  const G = T.state;
  if (_humans(T).includes(me.uid)) return;
  if (T.status === 'wait') { if (G.wait.players.length >= 4) throw new Error('這桌滿了'); G.wait.players.push(me); return; }
  if (T.status === 'play') { if (G.uids.filter(Boolean).length + (G.pending || []).length >= 4) throw new Error('這桌滿了'); (G.pending = G.pending || []).push(me); return; }
  throw new Error('這桌已經關了');
}

function startGame(T, gold, now) {
  const P = T.state.wait.players.slice().sort(() => Math.random() - 0.5);
  const used = P.map(p => p.name), list = [];
  for (let i = 0; i < 4; i++) {
    const p = P[i];
    if (p) list.push({ id: p.uid, name: p.name, av: p.av, gold: gold[p.uid] ?? 0 });
    else { const b = pickBot(used); used.push(b.name); list.push({ id: null, name: b.name, av: b.av, bot: true, gold: botGold(T) }); }
  }
  const G = E(T).newGame(list, { table: T.lvl, dealer: Math.floor(Math.random() * 4) });
  G.uids = list.map(p => p.id || null); G.miss = [0, 0, 0, 0]; G.ready = []; G.leaving = []; G.pending = [];
  G.tAct = G.tWait = now + TIME.DICE; G.wKey = '';
  T.state = G; T.status = 'play';
}

// 這局結束後：處理離開／排隊的人、檢查金幣、開下一局
function nextHandServer(T, gold, now) {
  const G = T.state, min = E(T).TABLES[T.lvl].min;
  const used = () => G.seats.map(s => s.name);
  const toBot = (j) => { const b = pickBot(used()); G.uids[j] = null; Object.assign(G.seats[j], { id: null, name: b.name, av: b.av, bot: true, auto: false, gold: botGold(T) }); G.miss[j] = 0; };
  G.kicked = [];
  const BROKE = '你輸光了……回去種田吧！';
  for (let j = 0; j < 4; j++) {
    const u = G.uids[j]; if (!u) continue;
    if (G.leaving.includes(u)) { G.kicked.push({ uid: u, msg: (G.broke || []).includes(u) ? BROKE : '已經離開牌桌', broke: (G.broke || []).includes(u) }); toBot(j); continue; }
    G.seats[j].gold = gold[u] ?? G.seats[j].gold;
    if (G.seats[j].gold <= 0) { G.kicked.push({ uid: u, msg: BROKE, broke: true }); toBot(j); }   // 已經坐下的人，金幣少於入座門檻也可以繼續打，0 元才離桌
  }
  G.leaving = [];
  for (const p of (G.pending || []).splice(0)) {
    if ((gold[p.uid] ?? 0) < min) { G.kicked.push({ uid: p.uid, msg: '金幣不夠坐這桌了', broke: false }); continue; }
    const j = G.uids.findIndex(x => !x); if (j < 0) break;
    G.uids[j] = p.uid; Object.assign(G.seats[j], { id: p.uid, name: p.name, av: p.av, bot: false, auto: false, gold: gold[p.uid] });
  }
  if (!G.uids.some(Boolean)) { T.status = 'closed'; return; }
  G.seats.forEach((s, j) => { if (!G.uids[j] && s.gold < min) s.gold = botGold(T); });
  E(T).nextHand(G); G.ready = []; G.settled = false; G.broke = []; G.miss = [0, 0, 0, 0];
  G.tAct = G.tWait = now + TIME.DICE; G.wKey = '';
}

// 推進：開局、電腦出牌、超時代打、結算、下一局。回傳 {settle:{uid:delta}|null, needGold:[uid]}
function _advance(T, now, gold) {
  const out = { settle: null, kicked: [] };
  // 桌上的真人都按了離開：沒人會再來推進這桌，直接讓電腦把這局打完、結算、散桌（不然會卡到有人回來才繼續打）
  const fast = () => T.status === 'play' && T.state.uids && T.state.uids.some(Boolean) && T.state.uids.every(u => !u || T.state.leaving.includes(u));
  for (let i = 0; i < 4000; i++) {
    if (T.status === 'wait') {
      const W = T.state.wait;
      if (!W.players.length) { T.status = 'closed'; break; }
      if (now >= W.startAt || W.players.length >= 4) { if (!gold) { out.needGold = true; break; } startGame(T, gold, now); continue; }
      break;
    }
    if (T.status !== 'play') break;
    const G = T.state;
    if (G.phase === 'end') {
      if (!G.settled) {
        G.settled = true; G.endAt = now;
        const d = {}; G.uids.forEach((u, j) => { if (u && G.result.pay[j]) d[u] = (d[u] || 0) + G.result.pay[j]; });
        out.settle = { hand: G.handNo, delta: d, house: (G.result && G.result.rake) || 0 };   // 娛樂廳這局抽了多少
        // 輸光（金幣變 0）：直接請他離桌
        G.broke = [];
        G.uids.forEach((u, j) => { if (u && G.seats[j].gold <= 0) { G.broke.push(u); if (!G.leaving.includes(u)) G.leaving.push(u); G.seats[j].auto = true; } });
      }
      const act = G.uids.map((u, j) => u && !G.leaving.includes(u) && !G.seats[j].auto ? j : -1).filter(j => j >= 0);
      const allReady = act.every(j => G.ready.includes(j));
      if (now >= G.endAt + TIME.NEXT_WAIT || allReady) {
        if (!gold) { out.needGold = true; break; }
        nextHandServer(T, gold, now); out.kicked.push(...(G.kicked || [])); continue;
      }
      break;
    }
    const key = G.handNo + ':' + G.phase + ':' + G.log.length;
    if (key !== G.wKey) { G.wKey = key; G.tWait = Math.max(G.tWait, now); }
    const w = E(T).waitingOn(G); if (!w.length) break;
    let acted = false;
    for (const j of w) {
      const s = G.seats[j], bot = !G.uids[j] || s.auto || s.ting;   // 報聽的人由系統自動處理
      const due = bot ? G.tAct + (G.phase === 'claim' ? TIME.BOT_CLAIM : TIME.BOT_PLAY) : G.tWait + (G.phase === 'claim' ? TIME.CLAIM : turnMs(T));
      if (now >= due || fast()) {
        if (bot) E(T).autoAct(G, j, !!(!G.uids[j] || s.auto || s.ting));
        else if (G.phase === 'claim') E(T).autoAct(G, j, false);   // 吃碰胡沒點：當作不要，不算超時
        else { E(T).autoAct(G, j, false); G.miss[j]++; if (G.miss[j] >= 2) s.auto = true; }
        G.tAct = now; acted = true; break;
      }
    }
    if (!acted) break;
  }
  return out;
}

function _dueAt(T) {
  if (T.status === 'wait') return T.state.wait.startAt;
  if (T.status !== 'play') return null;
  const G = T.state;
  if (G.phase === 'end') return G.settled ? G.endAt + TIME.NEXT_WAIT : 0;
  let best = Infinity;
  for (const j of E(T).waitingOn(G)) {
    const bot = !G.uids[j] || G.seats[j].auto || G.seats[j].ting;
    const due = bot ? G.tAct + (G.phase === 'claim' ? TIME.BOT_CLAIM : TIME.BOT_PLAY) : G.tWait + (G.phase === 'claim' ? TIME.CLAIM : turnMs(T));
    best = Math.min(best, due);
  }
  return best === Infinity ? null : best;
}

function _playerAct(T, uid, a, now) {
  if (T.status !== 'play') throw new Error('牌局還沒開始');
  const G = T.state, j = G.uids.indexOf(uid); if (j < 0) throw new Error('你不在這桌');
  if (a.a === 'ready') { if (!G.ready.includes(j)) G.ready.push(j); return; }
  if (a.a === 'auto') { G.seats[j].auto = !!a.on; G.miss[j] = 0; if (!a.on) G.tWait = Math.max(G.tWait, now); return; }
  E(T).act(G, j, a); G.miss[j] = 0; G.tAct = now;
}

function _leave(T, uid, now) {
  if (T.status === 'wait') { T.state.wait.players = T.state.wait.players.filter(p => p.uid !== uid); if (T.host === uid && T.priv && T.state.wait.players.length) T.host = T.state.wait.players[0].uid; return; }
  if (T.status !== 'play') return;
  const G = T.state;
  G.pending = (G.pending || []).filter(p => p.uid !== uid);
  const j = G.uids.indexOf(uid); if (j < 0) return;
  if (!G.leaving.includes(uid)) G.leaving.push(uid);
  G.seats[j].auto = true;
}

function _viewFor(T, uid, now) {
  const base = { tid: T.id, ver: T.ver || 0, game: T.game || 'mj', lvl: T.lvl, priv: T.priv, code: T.priv ? T.code : null, host: T.host === uid, status: T.status, now, due: _dueAt(T) };
  if (T.status === 'wait') return { ...base, wait: { players: T.state.wait.players.map(p => ({ name: p.name, av: p.av })), startAt: T.state.wait.startAt } };
  if (T.status !== 'play') return base;
  const G = T.state, j = G.uids.indexOf(uid);
  if (j < 0) { const pend = (G.pending || []).some(p => p.uid === uid); return { ...base, pending: pend, seatsN: G.uids.filter(Boolean).length, handNo: G.handNo, phase: G.phase }; }
  const V = E(T).view(G, j);
  const hum = G.uids.map(Boolean);
  let deadline = null;
  if (V.waiting.includes(j) && !G.seats[j].auto && !G.seats[j].ting) deadline = G.tWait + (G.phase === 'claim' ? TIME.CLAIM : turnMs(T));
  return { ...base, ...V, dice: G.dice, firstDealer: G.firstDealer, humans: hum, deadline, startAt: G.tAct > now ? G.tAct : null,
    broke: (G.broke || []).includes(uid), ready: G.ready, endAt: G.phase === 'end' ? G.endAt + TIME.NEXT_WAIT : null, leaving: G.leaving.includes(uid),
    ticker: G.uids.findIndex(Boolean) === j, pendingN: (G.pending || []).length };
}

// 依牌桌的遊戲分派：百家樂（bc）、德州撲克（th）有自己的流程，麻將／大老二共用上面這套
const X = (T) => (T && T.game === 'bc' ? BCC : T && T.game === 'th' ? THC : null);
export function newTable(lvl, priv, host, me, now, game) { return game === 'bc' ? BCC.newTable(lvl, priv, host, me, now) : game === 'th' ? THC.newTable(lvl, priv, host, me, now) : _newTable(lvl, priv, host, me, now, game); }
export function humans(T) { const x = X(T); return x ? x.humans(T) : _humans(T); }
export function seatOf(T, uid) { return X(T) ? -1 : _seatOf(T, uid); }
export function addPlayer(T, me, now) { const x = X(T); return x ? x.addPlayer(T, me, now) : _addPlayer(T, me, now); }
export function advance(T, now, gold) { const x = X(T); return x ? x.advance(T, now, gold) : _advance(T, now, gold); }
export function dueAt(T) { const x = X(T); return x ? x.dueAt(T) : _dueAt(T); }
export function playerAct(T, uid, a, now) { const x = X(T); return x ? x.playerAct(T, uid, a, now) : _playerAct(T, uid, a, now); }
export function leave(T, uid, now) { const x = X(T); return x ? x.leave(T, uid, now) : _leave(T, uid, now); }
export function viewFor(T, uid, now) { const x = X(T); return x ? x.viewFor(T, uid, now) : _viewFor(T, uid, now); }
