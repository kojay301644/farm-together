/* ---------- 大老二（連線；跟麻將共用牌桌外框、連線流程、結算） ---------- */
let b2Groups = {}, b2Sel = new Set(), b2HandKey = '', b2Hint = {}, b2Busy = false;
const B2_ICON = {n:'🌱',m:'🌻',h:'🏆',r:'💰'};

function openB2Lobby(){
  const gold = S.me.gold;
  modal('🃏 大老二', `<div class="rhint">台灣大老二，輸贏用農場金幣。中途離開，這局由系統代打、輸贏照算</div>
    <div id="b2Back"></div>
    ${Object.entries(B2.TABLES).map(([k,t])=>{ const poor = gold<t.min; return `<div class="mjtb"><div class="mjtbi">${B2_ICON[k]}</div><div class="tx"><b>${t.name}</b>
      <div>每張 ${t.per.toLocaleString()} 金</div><div>需要 ${t.min.toLocaleString()} 金幣才能坐下</div></div>
      <div class="mjtbb"><button class="mini" data-b2q="${k}" ${poor?'disabled':''}>${poor?'金幣不夠':'快速配對'}</button><button class="mini sub" data-b2c="${k}" ${poor?'disabled':''}>開房找朋友</button></div></div>`; }).join('')}
    <div class="mjjoin"><input id="b2Code" inputmode="numeric" maxlength="4" placeholder="輸入 4 位數房號"><button class="mini" id="b2Join">加入朋友的房間</button></div>
    <button class="link" id="b2Rules">📖 怎麼玩、怎麼算？</button>`, [['回寵物娛樂廳','sub',openHall]]);
  const busy = b => { document.querySelectorAll('#md .mini').forEach(x=>x.disabled = b); };
  const go = async (a, extra) => { busy(true); try{ const r = await mjCall(a, extra); if(!r.view) throw new Error('進不去，等等再試'); closeModal(); mjOnlineEnter(r.view); }catch(e){ toast(e.message); busy(false); } };
  document.querySelectorAll('#md [data-b2q]').forEach(b=>b.onclick=()=>go('quick', {lvl:b.dataset.b2q, game:'b2'}));
  document.querySelectorAll('#md [data-b2c]').forEach(b=>b.onclick=()=>go('create', {lvl:b.dataset.b2c, game:'b2'}));
  $('b2Join').onclick = ()=>{ const c = ($('b2Code').value||'').trim(); if(!/^\d{4}$/.test(c)) return toast('房號是 4 位數字'); go('join', {code:c}); };
  $('b2Rules').onclick = b2Rules;
  mjCall('state').then(r=>{ if(r.view && r.view.status && $('b2Back')) { $('b2Back').innerHTML = `<button class="btn o" id="b2BackB" style="width:100%;margin:6px 0">🃏 你還有一桌在打，回到牌桌</button>`; $('b2BackB').onclick = ()=>{ closeModal(); mjOnlineEnter(r.view); }; } }).catch(()=>{});
}
function b2Rules(){
  const body = `<div class="help">
    <p><b>目標：</b>最先把 13 張牌出完的人贏。</p>
    <p><b>大小：</b>3 最小，2 最大（3 4 5 6 7 8 9 10 J Q K A 2）。一樣大時比花色：♠ 黑桃 &gt; ♥ 紅心 &gt; ♦ 方塊 &gt; ♣ 梅花。</p>
    <p><b>能出的牌：</b>單張、對子、五張牌型（順子、葫蘆、鐵支、同花順，沒有同花）。</p><p><b>順子比大小：</b>看最前面那張：3‑4‑5‑6‑7 &lt; 4‑5‑6‑7‑8 &lt; … &lt; 10‑J‑Q‑K‑A；A‑2‑3‑4‑5 最小，2‑3‑4‑5‑6 最大。一樣的話比最前面那張的花色。</p><p><b>五張牌型怎麼壓：</b>只能用同一種壓（順子壓順子、葫蘆壓葫蘆…）。例外：鐵支可以壓順子、葫蘆；同花順可以壓所有五張牌型。</p>
    <p><b>怎麼出：</b>第一局拿到梅花 3 的人先出，而且要出到梅花 3；之後每局由上一局贏家先出。輪到你時要出同樣張數、比較大的牌，或按「過」。<b>過了之後這一輪就不能再出</b>，等其他人都過，由最後出牌的人重新開始，出任何牌型都可以。</p>
    <p><b>怎麼算：</b>有人出完，其他三家照手上剩幾張付錢，每張 × 桌上的「每張」金額：</p>
    <ul><li>手上的 2，每張多算一張</li><li>剩 10 張以上：加倍</li><li>13 張都沒出：3 倍</li></ul>
    <p>贏家的獎金，娛樂廳會抽 ${Math.round(B2.RAKE*100)}% 當場地費。</p></div>`;
  if(mjOn()) return mjPanel('📖 大老二怎麼玩', body, [['知道了','',mjPanelClose]]);
  modal('📖 大老二怎麼玩', body, [['知道了','',openB2Lobby]]);
}

// 牌面：白底、左上角點數＋花色、中間大花色；牌背：這局的寵物
function b2Card(c, cls=''){
  if(c==null) return `<i class="b2c bk ${cls}"></i>`;
  const r = B2.RANKS[B2.rk(c)], s = B2.SUITS[B2.st(c)], red = B2.st(c)===1 || B2.st(c)===2;
  return `<i class="b2c ${red?'rd':''} ${cls}" data-c="${c}"><b>${r}</b><em>${s}</em><u>${s}</u></i>`;
}
function b2Cards(cs, cls=''){ return (cs||[]).map(c=>b2Card(c, cls)).join(''); }

function b2Render(V){
  mjMe = V.me;
  const ME = V.me, T = B2.TABLES[V.table] || B2.TABLES.n, me = V.seats[ME], wl = V.waiting || [];
  const felt = $('mjFelt'); if(!felt) return;
  $('mj').style.setProperty('--b2pet', `url("${typeof chrSrc==='function' ? chrSrc((V.pet||'bunny')+'1') : ''}")`);
  // 換了一副手牌就清掉選牌
  const hk = V.handNo + ':' + (me.hand||[]).join(',');
  if(hk !== b2HandKey){ const keep = new Set([...b2Sel].filter(c=>(me.hand||[]).includes(c))); b2Sel = keep; b2HandKey = hk; b2Hint = {}; }
  const myTurn = V.phase==='play' && V.turn===ME && !me.auto;
  const seatCard = j => { const s = V.seats[j], on = wl.includes(j) && V.phase==='play';
    return `<div class="mjs mjs-${mjSeatPos(j)}${on?' on':''}"><div class="mjav"><img src="${avSrc(s.av)}" alt="">${s.auto&&!s.bot?'<span class="mjtg" style="background:#7A8BA6">託</span>':''}</div>
      <div class="mjtx"><div class="mjnm">${esc(s.name)}</div><div class="mjgd">${s.gold.toLocaleString()}</div></div></div>`; };
  const play = j => { const s = V.seats[j], p = mjSeatPos(j), top = V.cur && V.cur.by===j;
    if(s.last==='pass'){ const k = V.handNo + ':pass:' + V.logN, still = (mjAnimKey['b2p' + j]||'').startsWith(V.handNo + ':pass'); if(!still) mjAnimKey['b2p' + j] = k;
      return `<div class="b2p b2p-${p}${still?' still':''}"><span class="b2pass">過</span></div>`; }
    if(Array.isArray(s.last) && s.last.length){
      // 出過的牌只在剛出的那一下有動畫，之後畫面更新不要再跳
      const k = V.handNo + ':' + s.last.join(','), still = mjAnimKey['b2p' + j] === k; mjAnimKey['b2p' + j] = k;
      return `<div class="b2p b2p-${p}${top?' top':''}${still?' still':''}">${b2Cards(s.last,'pl')}</div>`; }
    mjAnimKey['b2p' + j] = '';
    return ''; };
  const other = j => { const s = V.seats[j], p = mjSeatPos(j), n = s.n;
    const backs = Array.from({length: Math.min(n, 3)}, ()=>b2Card(null,'ob')).join('');
    return `<div class="b2o b2o-${p}">${seatCard(j)}<div class="b2ob">${backs}</div><div class="b2on${n<=3?' warn':''}">${n} 張</div></div>`; };
  const others = [1,2,3].map(k=>(ME+k)%4);
  felt.style.setProperty('--pw', Math.max(26, Math.min(38, Math.round(mjW * 0.045))) + 'px');
  felt.innerHTML = `<div class="b2mid"><div class="b2pet"></div><div class="b2sec"><b id="mjSec"></b><small>第 ${V.handNo} 局</small></div></div>`
    + others.map(other).join('') + [0,1,2,3].map(play).join('')
    + (V.cur && V.phase==='play' ? `<div class="b2ty">${esc(V.cur.ty)}</div>` : '');

  // 我的手牌＋按鈕
  const hand = me.hand || [];
  const n = Math.max(hand.length, 1), cw = Math.max(34, Math.min(62, Math.floor((mjW - 40) / (n*0.64 + 0.5)), Math.floor(mjH * 0.15)));
  const selArr = [...b2Sel].sort((a,b)=>a-b), cb = selArr.length ? B2.classify(selArr) : null;
  const lead = !V.cur || V.cur.by===ME;
  const canPlay = myTurn && cb && (V.must==null || selArr.includes(V.must)) && (lead || B2.beats(cb, curCb(V)));
  // 現在能出的牌，依牌型分組（對子、順子、同花、葫蘆、鐵支、同花順）
  b2Groups = {};
  const playable = new Set();   // 這一手能出到的牌（其他變灰）
  if(myTurn){
    const legal = B2.combos(hand).filter(x=> (V.must==null || x.cards.includes(V.must)) && (lead || B2.beats(x.cb, curCb(V))));
    legal.forEach(x=>x.cards.forEach(c=>playable.add(c)));
    const all = legal.filter(x=>x.cards.length > 1);
    all.forEach(x=>{ const n = B2.comboName(x.cb); (b2Groups[n] = b2Groups[n] || []).push(x); });
    Object.values(b2Groups).forEach(L=>L.sort((a,b)=>a.cb.key-b.cb.key || a.cards[0]-b.cards[0]));
  }
  // 所有牌型一排列出來：能出的亮，沒有的變灰
  const typeBtns = ['對子','順子','葫蘆','鐵支','同花順'].map(n=>{ const L = b2Groups[n] || [], i = b2Hint[n];
    return `<button class="b2t${i!=null?' on':''}" data-b2t="${n}" ${L.length?'':'disabled'}>${n}${L.length>1?`<small>${i!=null?`${i+1}/`:''}${L.length}</small>`:''}</button>`; }).join('');
  let hint = '';
  if(myTurn){
    if(V.must!=null && lead) hint = '第一手要出到 ♣3';
    else if(lead) hint = '換你先出，任何牌型都可以';
    else hint = V.cur.cards.length===5 ? `要出比 ${esc(V.cur.ty)} 大的${esc(V.cur.ty)}${/鐵支|同花順/.test(V.cur.ty)?'':'（或鐵支、同花順）'}，或按「過」` : `要出比 ${esc(V.cur.ty)} 大的${V.cur.ty}，或按「過」`;
    if(selArr.length && !cb) hint = '這幾張組不成牌型';
    else if(selArr.length && cb && !canPlay && !lead) hint = cb.ty !== curCb(V).ty ? '張數要跟上一手一樣' : cb.ty==='five' && cb.kind !== curCb(V).kind && cb.kind < 4 ? `要出${esc(V.cur.ty)}才能壓（或鐵支、同花順）` : '不夠大';
  }
  $('mjUi').innerHTML = `${hint?`<div class="mjhint still b2hint${myTurn && typeBtns ? ' hi' : ''}">${hint}</div>`:''}
    ${myTurn && typeBtns ? `<div class="b2types">${typeBtns}</div>` : ''}
    ${myTurn ? `<div class="b2btns">${V.opts && V.opts.pass ? `<button class="b2b pass" id="b2Pass">過</button>` : ''}<button class="b2b go" id="b2Go" ${canPlay?'':'disabled'}>出牌${cb?`<small>${B2.comboName(cb)}</small>`:''}</button></div>` : ''}
    <div class="b2hand${myTurn?' can':''}" style="--cw:${cw}px">${hand.map(c=>b2Card(c, 'hd'+(b2Sel.has(c)?' sel':'')+(myTurn && !playable.has(c)?' dim':''))).join('')}</div>`;
  $('mjBar').innerHTML = `<div class="mjbt">每張 ${T.per.toLocaleString()} 金</div>
    <div class="mjbme${wl.includes(ME)&&V.phase==='play'?' on':''}"><img src="${avSrc(me.av)}" alt=""><b>${esc(me.name)}</b><span class="mjbg">${me.gold.toLocaleString()}</span></div>
    <div class="mjbt r">${T.name}・第 ${V.handNo} 局</div>`;

  // 結算
  const endKey = V.phase==='end' ? 'b2:' + V.handNo : '';
  const endHtml = V.phase==='end' && V.result ? b2ResultHtml(V) : '';
  $('mjEnd').innerHTML = endKey && endKey === mjAnimKey.end ? endHtml.replace('class="mjres"', 'class="mjres still"') : endHtml;
  mjAnimKey.end = endKey;
  if(V.phase==='end' && V.result) mjBindResult(V);

  // 輪到我：提醒
  const turnKey = myTurn ? V.handNo + ':' + V.logN : '';
  if(turnKey && turnKey !== mjAnimKey.turn) setTimeout(()=>{ const VV = mjCurView(); if(VV && VV.phase==='play' && VV.turn===VV.me) mjTurnAlert(); }, 60);
  mjAnimKey.turn = turnKey;

  // 點牌：選起來／放下
  document.querySelectorAll('#mj .b2hand .b2c').forEach(el=>el.onclick=()=>{
    if(el.classList.contains('dim')) return;   // 這手出不到的牌不能選
    const c = +el.dataset.c; if(b2Sel.has(c)) b2Sel.delete(c); else b2Sel.add(c); b2Hint = {}; mjSfx('pick'); b2Render(mjCurView());
  });
  if($('b2Go')) $('b2Go').onclick = ()=>{ const cs = [...b2Sel].sort((a,b)=>a-b); if(cs.length) b2Do({a:'play', cards:cs}); };
  if($('b2Pass')) $('b2Pass').onclick = ()=>b2Do({a:'pass'});
  // 牌型按鈕：點一下選出那種牌型最小的一組，再點換下一組
  document.querySelectorAll('#mj [data-b2t]').forEach(el=>el.onclick=()=>{
    const ty = el.dataset.b2t, L = b2Groups[ty] || []; if(!L.length) return;
    const i = ((b2Hint[ty] ?? -1) + 1) % L.length; b2Hint = { [ty]: i };
    b2Sel = new Set(L[i].cards); mjSfx('pick'); b2Render(mjCurView()); b2Hint = { [ty]: i };
  });


  // 新事件：出牌音效、五張牌型喊出來、有人出完
  const L = V.log || [], N = V.logN != null ? V.logN : L.length;
  if(!mjLastLog || mjLastLog.h !== V.handNo || N < mjLastLog.n) mjLastLog = { h: V.handNo, n: Math.max(0, N - 1) };
  const fresh = L.slice(Math.max(0, L.length - (N - mjLastLog.n))); mjLastLog.n = N;
  for(const e of fresh){
    if(e.k==='play'){ if(MJO && MJO.skipSig === 'b2:' + e.s + ':' + e.cards.join(',')) MJO.skipSig = null; else mjSfx('tile');
      if(e.cards.length===5) mjShout(e.s, e.ty + '！', !/葫蘆|鐵支|同花順/.test(e.ty)); }
    else if(e.k==='win') mjCelebrate(e.s, '出完了', '出完了');
  }
}
const curCb = V => V.cur ? B2.classify(V.cur.cards) : null;

function b2Do(a){
  const V = mjCurView(); if(!V || V.phase!=='play' || !MJO || MJO.busy) return;
  const me = V.seats[V.me];
  // 自己的動作先顯示，伺服器確認在背景做
  if(a.a==='play'){
    const cb = B2.classify(a.cards); if(!cb) return mjToast('這不是能出的牌型');
    me.hand = me.hand.filter(c=>!a.cards.includes(c)); me.n = me.hand.length; me.last = a.cards.slice();
    V.cur = { cards: a.cards.slice(), by: V.me, ty: B2.comboName(cb) }; V.turn = -1; V.waiting = []; V.opts = {}; V.must = null;
    b2Sel = new Set(); mjSfx('tile'); MJO.skipSig = 'b2:' + V.me + ':' + a.cards.join(',');
  } else { me.last = 'pass'; V.turn = -1; V.waiting = []; V.opts = {}; b2Sel = new Set(); mjSfx('pick'); }
  b2Render(V);
  mjOnline('act', { act: a });
}
function b2ResultHtml(V){
  const r = V.result, T = B2.TABLES[V.table] || B2.TABLES.n, w = V.seats[r.winner];
  const btns = `<div class="mjrb"><button class="btn sub" id="mjOut">離開</button><button class="btn" id="mjNext">下一局 <span id="mjNs"></span></button></div>`;
  const rows = [0,1,2,3].map(j=>{ const s = V.seats[j], v = r.pay[j], ln = r.lines.find(l=>l.s===j);
    const why = ln ? `剩 ${ln.n} 張${ln.twos?`（${ln.twos} 張 2 多算）`:''}${ln.mult>1?` × ${ln.mult}`:''}` : '出完了 🏆';
    return `<div class="mjpr${j===V.me?' me':''}"><img src="${avSrc(s.av)}" alt=""><span>${esc(s.name)}<small class="b2why">${why}</small></span><b class="${v>0?'up':v<0?'dn':''}">${v>0?'+':''}${v.toLocaleString()}</b></div>`; }).join('');
  const left = [0,1,2,3].filter(j=>j!==r.winner && r.hands[j].length).map(j=>`<div class="b2rl"><span>${esc(V.seats[j].name)}</span><div class="b2rh">${b2Cards(r.hands[j],'rs')}</div></div>`).join('');
  return `<div class="mjres"><div class="mjrc${r.winner===V.me?' mine':''}"><div class="mjrl1"><div class="mjrt">${esc(w.name)} 出完了！</div>
    <div class="b2rls">${left}</div><div class="mjrs">每張 ${T.per.toLocaleString()} 金・手上的 2 多算一張・剩 10 張以上加倍・13 張都沒出 3 倍</div></div>
    <div class="mjrl2"><div class="mjpay">${rows}</div>${r.rake?`<div class="mjrk">娛樂廳場地費 ${Math.round(B2.RAKE*100)}%：${r.rake.toLocaleString()} 金</div>`:''}${btns}</div></div></div>`;
}
