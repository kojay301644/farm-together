/* 百家樂規則引擎：前端、伺服器共用
   牌的代號跟大老二一樣：c = 點數 × 4 + 花色；點數 0..12 = 3 4 5 6 7 8 9 10 J Q K A 2 */
const BC = (() => {
  // 只有一種桌：單注最低 100；莊、閒每局最多押 2 萬，和、對子最多 1 萬
  const TABLES = { n: { name: '百家樂', min: 100, bet: 100, chips: [100, 500, 1000, 5000, 10000] } };
  const LIMIT = { p: 20000, b: 20000, t: 10000, pp: 10000, bp: 10000 };
  const AREAS = { p: { name: '閒', pay: 1 }, b: { name: '莊', pay: 0.95 }, t: { name: '和', pay: 8 }, pp: { name: '閒對', pay: 11 }, bp: { name: '莊對', pay: 11 } };
  const MAXP = 6;   // 一桌最多幾人
  const PETS = ['armad','bear','bunny','deer','dragon','ferret','fox','lizard','marten','mole','moth','mouse','otter','owl','pango','penguin','phoenix','seal'];
  const rk = c => c >> 2;
  // 點數：A=1、2～9 照數字、10 J Q K = 0
  const val = c => { const r = rk(c); return r === 11 ? 1 : r === 12 ? 2 : r <= 6 ? r + 3 : 0; };
  const pts = cs => cs.reduce((s, c) => s + val(c), 0) % 10;
  function newShoe() {   // 8 副牌
    const s = []; for (let d = 0; d < 8; d++) for (let c = 0; c < 52; c++) s.push(c);
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }
  // 發一局：照標準補牌規則
  function deal(shoe) {
    const p = [shoe.pop(), shoe.pop()], b = [shoe.pop(), shoe.pop()];
    [p[1], b[0]] = [b[0], p[1]];   // 發牌順序：閒、莊、閒、莊
    let pt = pts(p), bt = pts(b);
    if (pt < 8 && bt < 8) {        // 有天牌（8、9）就不補
      let p3 = null;
      if (pt <= 5) { p3 = shoe.pop(); p.push(p3); }
      const v3 = p3 == null ? null : val(p3);
      const bDraw = v3 == null ? bt <= 5
        : bt <= 2 ? true : bt === 3 ? v3 !== 8 : bt === 4 ? v3 >= 2 && v3 <= 7 : bt === 5 ? v3 >= 4 && v3 <= 7 : bt === 6 ? v3 === 6 || v3 === 7 : false;
      if (bDraw) b.push(shoe.pop());
      pt = pts(p); bt = pts(b);
    }
    const win = pt > bt ? 'p' : bt > pt ? 'b' : 't';
    return { p, b, pt, bt, win, pp: rk(p[0]) === rk(p[1]), bp: rk(b[0]) === rk(b[1]) };
  }
  // 一個人押的錢這局輸贏多少（不含本金）
  function payout(bets, r) {
    let d = 0;
    for (const [k, a] of Object.entries(bets || {})) {
      if (!a) continue;
      if (k === 'p' || k === 'b') d += r.win === 't' ? 0 : r.win === k ? Math.floor(a * AREAS[k].pay) : -a;   // 開和：押莊閒退回
      else if (k === 't') d += r.win === 't' ? a * 8 : -a;
      else if (k === 'pp') d += r.pp ? a * 11 : -a;
      else if (k === 'bp') d += r.bp ? a * 11 : -a;
    }
    return d;
  }
  return { TABLES, LIMIT, AREAS, MAXP, PETS, rk, val, pts, newShoe, deal, payout };
})();
if (typeof module !== 'undefined') module.exports = BC;
