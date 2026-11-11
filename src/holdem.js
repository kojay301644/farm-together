/* ---------- 德州撲克（6 人桌，無限注；共用麻將的牌桌外框、連線流程） ---------- */
let thRaiseOpen = false, thRaiseTo = 0, thAnim = {};
const TH_ICON = {n:'🌱',m:'🌻',h:'🏆',r:'💰'};

function openThLobby(){
  const gold = S.me.gold;
  modal('♠️ 德州撲克', `<div class="rhint">6 人桌無限注德州撲克。坐下時把金幣換成籌碼帶上桌，離桌時剩下的籌碼自動換回金幣。人不夠時電腦補到 4 人，有真人加入電腦會讓位</div>
    <div id="thBack"></div>
    ${Object.entries(HOLD.TABLES).map(([k,t])=>{ const poor = gold<t.min; return `<div class="mjtb"><div class="mjtbi">${TH_ICON[k]}</div><div class="tx"><b>${t.name}</b>
      <div>盲注 ${t.sb.toLocaleString()} / ${t.bb.toLocaleString()}</div><div>帶入 ${t.buyMin.toLocaleString()}～${t.buyMax.toLocaleString()}・要 ${t.min.toLocaleString()} 金幣才能坐</div></div>
      <div class="mjtbb"><button class="mini" data-thq="${k}" ${poor?'disabled':''}>${poor?'金幣不夠':'快速配對'}</button><button class="mini sub" data-thc="${k}" ${poor?'disabled':''}>開房找朋友</button></div></div>`; }).join('')}
    <div class="mjjoin"><input id="thCode" inputmode="numeric" maxlength="4" placeholder="輸入 4 位數房號"><button class="mini" id="thJoin">加入朋友的房間</button></div>
    <button class="link" id="thRules">📖 怎麼玩？</button>`, [['回寵物娛樂廳','sub',openHall]]);
  document.querySelectorAll('#md [data-thq]').forEach(b=>b.onclick=()=>thBuyinAsk(b.dataset.thq, 'quick'));
  document.querySelectorAll('#md [data-thc]').forEach(b=>b.onclick=()=>thBuyinAsk(b.dataset.thc, 'create'));
  $('thJoin').onclick = async()=>{ const c = ($('thCode').value||'').trim(); if(!/^\d{4}$/.test(c)) return toast('房號是 4 位數字');
    // 先問房間是哪一桌，才知道帶入範圍：用新手桌範圍以外的話伺服器會擋
    thBuyinAsk(null, 'join', c); };
  $('thRules').onclick = thRules;
  mjCall('state').then(r=>{ if(r.view && r.view.status && $('thBack')) { $('thBack').innerHTML = `<button class="btn o" id="thBackB" style="width:100%;margin:6px 0">♠️ 你還有一桌在玩，回到牌桌</button>`; $('thBackB').onclick = ()=>{ closeModal(); mjOnlineEnter(r.view); }; } }).catch(()=>{});
}
// 帶入籌碼：選要帶多少上桌
function thBuyinAsk(lvl, a, code){
  const lv = lvl || 'n', T = HOLD.TABLES[lv], gold = S.me.gold;
  const ranges = lvl ? `${T.buyMin.toLocaleString()}～${T.buyMax.toLocaleString()}` : '照朋友房間的桌別';
  const max = lvl ? Math.min(T.buyMax, gold) : 0, def = lvl ? Math.min(max, T.bb*100) : 0;
  modal('💰 帶多少籌碼上桌？', lvl ? `<div class="rhint">${T.name}・盲注 ${T.sb}/${T.bb}・可以帶 ${ranges}</div>
    <div style="text-align:center;font-size:28px;font-weight:900;margin:8px 0" id="thBv">${def.toLocaleString()}</div>
    <input type="range" id="thBr" min="${T.buyMin}" max="${max}" step="${T.bb}" value="${def}" style="width:100%">
    <div class="row" style="justify-content:space-between;font-size:12px;color:var(--ink2)"><span>${T.buyMin.toLocaleString()}</span><span>你有 ${gold.toLocaleString()} 金</span><span>${max.toLocaleString()}</span></div>
    <div class="rhint" style="margin-top:8px">離桌時剩下的籌碼會自動換回金幣</div>`
    : `<div class="rhint">朋友房間的帶入範圍要看是哪一桌。輸入要帶的籌碼（例如新手桌 400～2,000）</div><input id="thBn" type="number" inputmode="numeric" value="2000" style="width:100%;font-size:20px;padding:8px;border-radius:10px;border:2px solid #E6D9C3">`,
    [['取消','sub',openThLobby],['坐下','',async e=>{
      const btn = e && e.currentTarget; if(btn){ if(btn.disabled) return; btn.disabled = true; }   // 不要連點兩下
      const amt = lvl ? +$('thBr').value : +$('thBn').value;
      try{ const r = await mjCall(a, Object.assign({ game:'th', buyin: amt }, lvl ? { lvl } : { code })); if(!r.view) throw new Error('進不去，等等再試');
        S.me.gold = Math.max(0, S.me.gold - amt); try{ refresh(); }catch(e){} closeModal(); mjOnlineEnter(r.view); }catch(err){ toast(err.message); if(btn) btn.disabled = false; } }]]);
  if($('thBr')) $('thBr').oninput = ()=>{ $('thBv').textContent = (+$('thBr').value).toLocaleString(); };
}
function thRules(){
  const body = `<div class="help">
    <p><b>目標：</b>用自己 2 張手牌加上桌上 5 張公牌，組出最好的 5 張牌，或讓其他人都棄牌。</p>
    <p><b>流程：</b>發 2 張手牌 → 下注 → 翻 3 張公牌 → 下注 → 第 4 張 → 下注 → 第 5 張 → 下注 → 攤牌比大小。</p>
    <p><b>動作：</b>棄牌（不玩了）、過牌（不加錢，前面沒人下注才可以）、跟注（跟上目前的注）、加注（下更多）、全下（籌碼全押）。每次輪到你有 10 秒。</p>
    <p><b>牌型由大到小：</b>同花順 &gt; 鐵支 &gt; 葫蘆 &gt; 同花 &gt; 順子 &gt; 三條 &gt; 兩對 &gt; 一對 &gt; 高牌。</p>
    <p><b>籌碼：</b>坐下時從金幣換成籌碼（20～100 個大盲），離桌時換回金幣。輸光可以補籌碼。</p>
    <p><b>場地費：</b>有翻牌的局，從底池抽 5%，最多 3 個大盲；沒翻牌就結束的局不抽。</p></div>`;
  if(mjOn()) return mjPanel('📖 德州撲克怎麼玩', body, [['知道了','',mjPanelClose]]);
  modal('📖 德州撲克怎麼玩', body, [['知道了','',openThLobby]]);
}

function thRender(V){
  const T = HOLD.TABLES[V.lvl] || HOLD.TABLES.n, felt = $('mjFelt'); if(!felt) return;
  const me = V.me, my = me >= 0 ? V.seats[me] : null, live = ['pre','flop','turn','river'].includes(V.street);
  const pos = i => me >= 0 ? (i - me + 6) % 6 : i;   // 我永遠在正下方
  const res = V.result, wonBy = res ? res.win : [];
  const seat = (p, i) => { if(!p) return `<div class="ths ths-${pos(i)} empty"><i>空位</i></div>`;
    const turn = live && V.turn === i, won = res && wonBy[i] > 0, hn = res && res.hands && res.hands[i];
    const cards = (p.hole||[]).length ? `<div class="thh${p.folded?' fold':''}">${p.hole.map(c=>b2Card(c, i===me ? 'thm' : 'tho')).join('')}</div>` : '';
    return `<div class="ths ths-${pos(i)}${turn?' turn':''}${won?' won':''}${p.folded?' folded':''}${p.sitOut?' out':''}">
      ${i===me ? '' : cards}
      <div class="thav"><img src="${avSrc(p.av)}" alt="">${V.button===i?'<span class="thd">D</span>':''}${p.auto&&!p.bot?'<span class="thauto">託</span>':''}</div>
      <div class="thnm">${esc(p.name)}</div><div class="thst">${p.stack.toLocaleString()}${p.rebuy?`<small>＋${p.rebuy.toLocaleString()}</small>`:''}</div>
      ${won ? `<div class="thwin">+${wonBy[i].toLocaleString()}${hn?`<small>${hn.name}</small>`:''}</div>` : p.last ? `<div class="thla">${esc(p.last)}</div>` : p.sitOut ? `<div class="thla">${p.stack<=0?'等補籌碼':'下局加入'}</div>` : ''}
      ${p.bet ? `<div class="thbet thbet-${pos(i)}"><i></i>${p.bet.toLocaleString()}</div>` : ''}</div>`; };
  const board = [0,1,2,3,4].map(k=> V.board && V.board[k]!=null ? b2Card(V.board[k], 'thb' + (thAnim['b'+k] !== V.handNo+':'+V.board[k] ? ' new' : '')) : `<i class="b2c thb ghost"></i>`).join('');
  (V.board||[]).forEach((c,k)=>thAnim['b'+k] = V.handNo+':'+c);
  const potTxt = V.pot ? `<div class="thpot">底池 <b>${V.pot.toLocaleString()}</b></div>` : '';
  const info = V.queued ? '<div class="thinfo">座位滿了，等電腦讓位…</div>' : !live && !res ? '<div class="thinfo">等下一局開始…</div>' : '';
  $('mj').style.setProperty('--b2pet', `url("${typeof chrSrc==='function' ? chrSrc('fox1') : ''}")`);
  felt.innerHTML = `<div class="thtab"></div><div class="thmid"><div class="thboard">${board}</div>${potTxt}${res && res.rake ? `<div class="thrake">場地費 ${res.rake.toLocaleString()}</div>` : ''}${info}</div>
    ${V.seats.map(seat).join('')}`;

  // 我的手牌＋動作按鈕
  const o = V.opts, myTurn = !!o && my && !my.auto;
  if(!myTurn) thRaiseOpen = false;
  if(myTurn && (!thRaiseTo || thRaiseTo < o.minTo || thRaiseTo > o.maxTo)) thRaiseTo = o.minTo;
  const preset = f => Math.max(o.minTo, Math.min(o.maxTo, Math.round((V.curBet + f * (o.pot + o.toCall)) / T.bb) * T.bb));
  const acts = myTurn ? (thRaiseOpen
    ? `<div class="thraise"><div class="thrp">${[['最小',o.minTo],['½池',preset(0.5)],['1 池',preset(1)],['全下',o.maxTo]].map(([t,x])=>`<button data-thp="${x}">${t}</button>`).join('')}</div>
        <div class="thrr"><button data-thd="-1">－</button><input type="range" id="thRg" min="${o.minTo}" max="${o.maxTo}" step="${T.bb}" value="${thRaiseTo}"><button data-thd="1">＋</button></div>
        <div class="thrb"><button class="thb2 x" id="thRx">取消</button><button class="thb2 r" id="thRo">${thRaiseTo>=o.maxTo?'全下':'加注到'} ${thRaiseTo.toLocaleString()}</button></div></div>`
    : `<div class="thacts"><button class="thb2 f" data-tha="fold">棄牌</button>${o.canCheck ? `<button class="thb2 c" data-tha="check">過牌</button>` : `<button class="thb2 c" data-tha="call">${o.toCall >= my.stack ? '全下' : '跟注'}<small>${o.toCall.toLocaleString()}</small></button>`}${o.canRaise && o.maxTo > V.curBet + (o.canCheck?0:0) && my.stack > o.toCall ? `<button class="thb2 r" data-tha="raise">${o.canCheck && !V.curBet ? '下注' : '加注'}</button>` : ''}</div>`) : '';
  const myCards = my && (my.hole||[]).length ? `<div class="thmy${my.folded?' fold':''}">${my.hole.map(c=>b2Card(c,'thm')).join('')}${res && res.hands && res.hands[me] ? `<span class="thmyh">${res.hands[me].name}</span>` : ''}</div>` : '';
  const canRebuy = my && !my.leaving && my.stack + (my.rebuy||0) < T.buyMax - T.bb && (!live || !my.inHand || my.folded || my.stack<=0);
  $('mjUi').innerHTML = `${myCards}${acts}${my && my.auto ? `<button class="mjauto" id="thAuto" style="pointer-events:auto">🤖 託管中・點這裡自己打</button>` : ''}`;
  $('mjBar').innerHTML = `<div class="mjbt">盲注 ${T.sb}/${T.bb}</div>
    <div class="mjbme"><img src="${avSrc(S.me.avatar||11)}" alt=""><b>${esc(S.me.nickname||'')}</b><span class="mjbg">${(S.me.gold||0).toLocaleString()}</span></div>
    ${canRebuy ? `<button class="threbuy" id="thRebuy">＋ 補籌碼</button>` : ''}
    <div class="mjbt r">${T.name}${V.code?`・房號 ${esc(V.code)}`:''}・第 ${V.handNo} 局</div>`;
  $('mjEnd').innerHTML = '';

  document.querySelectorAll('#mj [data-tha]').forEach(b=>b.onclick=()=>{ const k = b.dataset.tha;
    if(k==='raise'){ thRaiseOpen = true; thRaiseTo = Math.max(o.minTo, preset(0.5)); mjSfx('pick'); return thRender(mjCurView()); }
    thDo({ a: k }); });
  document.querySelectorAll('#mj [data-thp]').forEach(b=>b.onclick=()=>{ thRaiseTo = +b.dataset.thp; mjSfx('pick'); thRender(mjCurView()); });
  document.querySelectorAll('#mj [data-thd]').forEach(b=>b.onclick=()=>{ thRaiseTo = Math.max(o.minTo, Math.min(o.maxTo, thRaiseTo + (+b.dataset.thd) * T.bb)); thRender(mjCurView()); });
  if($('thRg')) $('thRg').oninput = ()=>{ thRaiseTo = +$('thRg').value; const b = $('thRo'); if(b) b.textContent = `${thRaiseTo>=o.maxTo?'全下':'加注到'} ${thRaiseTo.toLocaleString()}`; };
  if($('thRx')) $('thRx').onclick = ()=>{ thRaiseOpen = false; thRender(mjCurView()); };
  if($('thRo')) $('thRo').onclick = ()=>thDo({ a:'raise', to: thRaiseTo });
  if($('thAuto')) $('thAuto').onclick = ()=>mjOnline('auto', { on:false });
  if($('thRebuy')) $('thRebuy').onclick = thRebuyAsk;

  // 輪到我：提醒；有人動作：音效
  const turnKey = myTurn ? V.handNo + ':' + V.logN : '';
  if(turnKey && turnKey !== mjAnimKey.turn) setTimeout(()=>{ const VV = mjCurView(); if(VV && VV.opts) mjTurnAlert(); }, 60);
  mjAnimKey.turn = turnKey;
  const L = V.log || [], N = V.logN || 0;
  if(!mjLastLog || mjLastLog.h !== V.handNo || N < mjLastLog.n) mjLastLog = { h: V.handNo, n: Math.max(0, N - 1) };
  const fresh = L.slice(Math.max(0, L.length - (N - mjLastLog.n))); mjLastLog.n = N;
  for(const e of fresh){
    if(e.k==='act'){ if(MJO && MJO.skipSig === 'th:' + e.s + ':' + e.a) MJO.skipSig = null; else mjSfx(e.a==='棄牌' || e.a==='過牌' ? 'pick' : 'tile'); }
    else if(e.k==='street') mjSfx('tile');
    else if(e.k==='win' && res && res.win && res.win[me] > 0){ mjSfx('win'); }
  }
}
function thDo(a){
  const V = mjCurView(); if(!V || !V.opts || !MJO || MJO.busy) return;
  // 先在畫面上收起按鈕，伺服器確認在背景做
  const p = V.seats[V.me]; p.last = { fold:'棄牌', check:'過牌', call:'跟注', raise:'加注' }[a.a]; if(a.a==='fold') p.folded = true;
  MJO.skipSig = 'th:' + V.me + ':' + p.last; V.opts = null; thRaiseOpen = false; mjSfx(a.a==='fold'||a.a==='check' ? 'pick' : 'tile');
  thRender(V);
  mjOnline('act', { act: a });
}
function thRebuyAsk(){
  const V = mjCurView(), T = HOLD.TABLES[V.lvl] || HOLD.TABLES.n, my = V.seats[V.me];
  const room = T.buyMax - my.stack - (my.rebuy||0), max = Math.min(room, S.me.gold||0);
  if(max < T.bb) return mjToast(room < T.bb ? '籌碼已經是上限了' : '金幣不夠');
  mjPanel('＋ 補籌碼', `<div class="help"><p>最多可以補到 ${T.buyMax.toLocaleString()}（現在 ${my.stack.toLocaleString()}）。這局還在打的話，下一局開始前才會加上去。</p></div>
    <div style="text-align:center;font-size:24px;font-weight:900" id="thRbv">${max.toLocaleString()}</div><input type="range" id="thRbr" min="${T.bb}" max="${max}" step="${T.bb}" value="${max}" style="width:100%">`,
    [['取消','sub',mjPanelClose],['補籌碼','',async()=>{ const amt = +$('thRbr').value; mjPanelClose();
      try{ const r = await mjCall('act', { act:{ a:'rebuy', amt } }); if(typeof r.gold==='number') S.me.gold = r.gold; if(MJO) mjApply(r.view, null, false, true); mjToast('籌碼補好了'); }catch(e){ mjToast(e.message); } }]]);
  $('thRbr').oninput = ()=>{ $('thRbv').textContent = (+$('thRbr').value).toLocaleString(); };
}
