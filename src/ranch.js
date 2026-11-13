
/* ================= 牧場 ================= */
let ANIMALS = [], ANI = {}, RANCH_LV = 3;
const GOOD_ICON = {egg:'🥚', duck_egg:'🪺', wool:'🧶', milk:'🥛', truffle:'🍄'};
function setRanchConfig(list, st){ if(list){ ANIMALS=list; ANI={}; list.forEach(a=>ANI[a.id]=a); } if(st && st.ranch_lv!=null) RANCH_LV=+st.ranch_lv; }

/* 動物向量圖（腳底在 0,0，跟小雞同樣大小比例） */
const ANI_ART = {
  chicken: CHICK,
  duck: ol(`<ellipse class="nool" cy="1" rx="7" ry="2" fill="rgba(0,0,0,.15)"/><path d="M-2 -1 v2.5 M2 -1 v2.5" stroke="#F0A030" stroke-width="1.6"/><g class="bd"><ellipse cx="-1" cy="-6" rx="8" ry="5.5" fill="#FFE27A"/><path d="M-9 -8 q-3 -2 -2 2z" fill="#FFE27A"/><circle cx="5" cy="-12" r="4.2" fill="#FFE27A"/><path d="M8.5 -12 q4 0 4.5 1.5 q-2 1.2 -4.5 .6z" fill="#F79A3E"/><circle class="nool" cx="6.3" cy="-12.8" r=".9" fill="#333"/><path d="M-4 -7 q3 -3 6 0" fill="none" stroke="#E2BB45" stroke-width="1.2"/></g>`, 1.2),
  sheep: ol(`<ellipse class="nool" cy="1" rx="9" ry="2.4" fill="rgba(0,0,0,.15)"/><g class="bd"><rect x="-6" y="-5" width="2.6" height="6" rx="1.2" fill="#5A4636"/><rect x="3" y="-5" width="2.6" height="6" rx="1.2" fill="#5A4636"/><g fill="#FFFDF5"><circle cx="-5" cy="-9" r="5"/><circle cx="1" cy="-11" r="5.5"/><circle cx="6" cy="-8" r="4.5"/><circle cx="-1" cy="-6" r="5"/></g><ellipse cx="9" cy="-12" rx="3.6" ry="4.2" fill="#5A4636"/><ellipse cx="6.5" cy="-14.5" rx="2" ry="1.2" fill="#5A4636"/><circle class="nool" cx="10" cy="-12.8" r=".9" fill="#fff"/></g>`, 1.2),
  cow: ol(`<ellipse class="nool" cy="1" rx="10" ry="2.6" fill="rgba(0,0,0,.15)"/><g class="bd"><rect x="-7" y="-5" width="3" height="6" rx="1.3" fill="#fff"/><rect x="4" y="-5" width="3" height="6" rx="1.3" fill="#fff"/><rect x="-10" y="-14" width="18" height="10" rx="5" fill="#fff"/><path d="M-6 -14 q2 4 6 1 q1 -1 0 -1z" fill="#3B3230"/><circle cx="-6" cy="-7" r="2.3" fill="#3B3230"/><ellipse cx="10" cy="-13" rx="4.2" ry="4" fill="#fff"/><ellipse cx="11.5" cy="-10.5" rx="3" ry="2" fill="#F7B5B5"/><path d="M7 -17 l-1.5 -2.5 M12 -17 l1.5 -2.5" stroke="#E0C38C" stroke-width="1.6" stroke-linecap="round"/><circle class="nool" cx="10.5" cy="-14" r=".9" fill="#333"/></g>`, 1.2),
  pig: ol(`<ellipse class="nool" cy="1" rx="9" ry="2.4" fill="rgba(0,0,0,.15)"/><g class="bd"><rect x="-6" y="-4" width="2.6" height="5" rx="1.2" fill="#F4A6B4"/><rect x="3" y="-4" width="2.6" height="5" rx="1.2" fill="#F4A6B4"/><ellipse cx="0" cy="-8" rx="10" ry="6.5" fill="#FFC2CC"/><ellipse cx="10" cy="-8.5" rx="2.6" ry="2.3" fill="#F48FA2"/><circle class="nool" cx="9.4" cy="-8.6" r=".5" fill="#B34A60"/><circle class="nool" cx="10.6" cy="-8.4" r=".5" fill="#B34A60"/><path d="M4 -14 l1 -3 l2.5 2z" fill="#F48FA2"/><circle class="nool" cx="6.5" cy="-10.5" r=".9" fill="#333"/><path d="M-10 -9 q-3 -1 -2 -3 q1 2 -1 2" fill="none" stroke="#F48FA2" stroke-width="1.2"/></g>`, 1.2),
};

/* 動物狀態（依伺服器時間推算） */
function aniState(r, off){ const now=Date.now()+(off||0);
  if(!r.ra) return 'hungry';
  return r.ra <= now ? 'ready' : 'busy'; }
function aniLeft(r, off){ return Math.max(0, Math.ceil((r.ra - (Date.now()+(off||0)))/1000)); }

/* 地圖上的動物 */
let ranchMovers = [], ranchSig = '';
function syncRanchMovers(){
  if(!RANCH) return;
  const list = (mode==='visit' && V ? V.ranch : S && S.ranch) || [], off = mode==='visit'&&V ? V.off : S ? S.off : 0;
  const sig = list.map(r=>r.slot+r.k+aniState(r,off)+r.f).join('|') + (mode==='visit') + ANIMALS.length;
  if(sig===ranchSig) return; ranchSig = sig;
  const mv = $('movers'); if(!mv) return;
  ranchMovers.forEach(m=>{ m.el.remove(); const i=movers.indexOf(m); if(i>=0) movers.splice(i,1); }); ranchMovers=[];
  const [X,Y,W,D] = RANCH;
  list.forEach((r,k)=>{ const a=ANI[r.k]; const st=aniState(r,off);
    const bub = st==='ready' ? `<g class="abub"><circle cx="0" cy="-30" r="8.5" fill="#fff" stroke="${INK}" stroke-width="1.4"/><text x="0" y="-26.5" text-anchor="middle" font-size="10">${GOOD_ICON[a&&a.good]||'⭐'}</text></g>`
      : st==='hungry' ? `<g class="abub"><circle cx="0" cy="-30" r="8.5" fill="#FFF6DB" stroke="${INK}" stroke-width="1.4"/><text x="0" y="-26.5" text-anchor="middle" font-size="9">🌾</text></g>` : '';
    const mine = mode!=='visit';
    const fl = r.f ? `<g class="afly${mine?' big':''}"><text x="-6" y="-20" font-size="${mine?13:8}">🦟</text>${r.f>1?`<text x="4" y="-24" font-size="${mine?11:7}">🦟</text>`:''}</g>` : '';
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.innerHTML=`<g class="mvin">${ANI_ART[r.k]||CHICK}</g>`;
    const tag=document.createElementNS('http://www.w3.org/2000/svg','g'); tag.innerHTML=bub+fl; tag.setAttribute('class','atag');
    if(r.f && mine){ // 自己的動物有蚊子：直接點動物就拍
      g.style.pointerEvents='auto'; g.style.cursor='pointer';
      g.insertAdjacentHTML('afterbegin','<circle cx="0" cy="-12" r="16" fill="rgba(0,0,0,0)"/>');
      g.addEventListener('click',e=>{ e.stopPropagation(); swatAni(r.slot, g); });
    }
    mv.appendChild(g);
    const m={el:g, tag, wait:Math.random()*2, face:1, x:X+0.6+Math.random()*(W-1.2), y:Y+0.5+Math.random()*(D-1), chick:true, area:[X+0.4,Y+0.4,X+W-0.4,Y+D-0.4], speed:st==='hungry'?0.25:0.45, s:1.6, ani:true};
    g.appendChild(tag); movers.push(m); ranchMovers.push(m);
  });
}

/* 牧場視窗 */
const fmtLeft = s => s>=3600 ? `${Math.floor(s/3600)}小時${Math.floor(s%3600/60)}分` : s>=60 ? `${Math.floor(s/60)}分${s%60}秒` : `${s}秒`;
function cropCount(me){ return Object.values(me.crops||{}).reduce((a,b)=>a+b,0); }
function openRanch(){
  const visit = mode==='visit' && V;
  if(!visit && S.me.lv < RANCH_LV) return toast(`牧場 Lv${RANCH_LV} 開放`);
  const list = visit ? (V.ranch||[]) : (S.ranch||[]), off = visit ? V.off : S.off, me=S.me;
  const cap = visit ? null : (me.ranch_cap||0);
  let body = '';
  if(!visit) body += `<div class="rhint">倉庫現在有 <b>${cropCount(me)}</b> 個作物${me.auto_feed&&CROP[me.auto_feed]?`（其中${CROP[me.auto_feed].name} <b>${me.crops[me.auto_feed]||0}</b> 個）`:''}。</div>`;
  body += list.length ? list.map(r=>{ const a=ANI[r.k]||{name:r.k}; const st=aniState(r,off);
    const status = st==='ready' ? `<b style="color:#E08A1E">${GOOD_ICON[a.good]||''} ${a.good_name} 可以收了！</b>${r.st?`（被偷 ${r.st}）`:''}`
      : st==='busy' ? `生產中・還要 ${fmtLeft(aniLeft(r,off))}` : `肚子餓了，要 <b>${a.feed}</b> 個${(!visit&&S.me.auto_feed&&CROP[S.me.auto_feed])?CROP[S.me.auto_feed].name:'作物'}當飼料`;
    let btns='';
    if(!visit){
      if(st==='hungry') btns+=`<button class="mini" data-ra="feed" data-s="${r.slot}" ${cropCount(me)<a.feed?'disabled':''}>餵食</button>`;
      if(st==='ready') btns+=`<button class="mini o" data-ra="collect" data-s="${r.slot}">收成</button>`;
      if(r.f) btns+=`<button class="mini sub" data-ra="swat" data-s="${r.slot}">拍蚊子 🦟${r.f}</button>`;
      btns+=`<button class="mini sub" data-rsell="${r.slot}">💰 賣掉</button>`;
    } else {
      if(st==='ready' && !r.mine && r.st<r.cap && !V.protected) btns+=`<button class="mini o" data-rf="steal" data-s="${r.slot}">偷</button>`;
      if(st==='ready' && r.mine) btns+=`<span class="tag">已偷過</span>`;
      if(V.friend && st==='hungry') btns+=`<button class="mini" data-rf="help_feed" data-s="${r.slot}">幫餵</button>`;
      if(V.friend && r.f) btns+=`<button class="mini sub" data-rf="help_swat" data-s="${r.slot}">幫拍 🦟</button>`;
      if(st==='busy' && r.f<2 && !V.protected) btns+=`<button class="mini sub" data-rf="prank" data-s="${r.slot}">放蚊子 😈</button>`;
    }
    return `<div class="row"><div class="ic ani"><svg viewBox="-14 -24 30 28">${ANI_ART[r.k]||CHICK}</svg></div><div class="tx"><b>${a.name}</b>${r.f?` <span class="tag">🦟×${r.f}</span>`:''}<div>${status}</div></div><div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:150px">${btns}</div></div>`; }).join('')
    : `<div class="empty">${visit?'這個牧場還沒有動物':'牧場還是空的，買一隻小動物吧！'}</div>`;
  if(!visit){
    body += `<div class="sec">買動物（${list.length}/${cap} 格・升級可擴充）</div>`;
    body += ANIMALS.map(a=>{ const lock=me.lv<a.lv;
      return `<div class="row" style="${lock?'opacity:.55':''}"><div class="ic ani"><svg viewBox="-14 -24 30 28">${ANI_ART[a.id]||CHICK}</svg></div>
        <div class="tx"><b>${a.name}</b><span class="tag">${a.price.toLocaleString()} 金</span><div>吃 ${a.feed} 個作物・${dur(a.prod_sec)}後產 ${a.yield} 個${GOOD_ICON[a.good]||''}${a.good_name}（每個 ${a.good_price} 金）</div></div>
        ${lock?`<span class="lock">Lv${a.lv} 解鎖</span>`:`<button class="mini" data-buyani="${a.id}" ${me.gold<a.price||list.length>=cap?'disabled':''}>買</button>`}</div>`; }).join('');
  }
  if(!visit) body = autoFeedHTML() + body;
  modal(visit ? `${esc(V.owner.nickname)} 的牧場` : '我的牧場', body);
  if(!visit) bindAutoSel();
  const md=$('md');
  md.querySelectorAll('[data-ra]').forEach(b=>b.onclick=()=>ranchAct(b.dataset.ra, +b.dataset.s));
  md.querySelectorAll('[data-buyani]').forEach(b=>b.onclick=()=>ranchAct('buy', null, b.dataset.buyani));
  md.querySelectorAll('[data-rf]').forEach(b=>b.onclick=()=>ranchFriend(b.dataset.rf, +b.dataset.s));
  md.querySelectorAll('[data-rsell]').forEach(b=>b.onclick=()=>sellAnimal(+b.dataset.rsell));
}
/* 賣掉動物：退原價一半，格子空出來 */
function sellAnimal(slot){
  const r=(S.ranch||[]).find(x=>x.slot===slot); if(!r) return; const a=ANI[r.k]||{name:r.k,price:0}, st=aniState(r,S.off);
  const refund=Math.floor((a.price||0) * +(CFG_SET.ranch_sell_ratio ?? 0.5));
  const warn = st==='busy' ? `<div style="color:#D63B42;font-size:13px;margin-top:6px">⚠️ 牠還在生產中，賣掉的話這一輪的${a.good_name||'產品'}就沒了</div>`
    : st==='ready' ? `<div style="color:#2E9660;font-size:13px;margin-top:6px">牠的${a.good_name||'產品'}已經好了，會先幫你收進倉庫</div>` : '';
  modal(`賣掉${a.name}？`, `<div style="text-align:center;font-weight:800;line-height:1.8"><div class="ic ani" style="margin:0 auto;width:80px;height:70px"><svg viewBox="-14 -24 30 28">${ANI_ART[r.k]||CHICK}</svg></div>退回 <b>${refund.toLocaleString()} 金</b>（原價的一半），格子空出來就能買別的動物${warn}</div>`,
    [['取消','sub',()=>openRanch()],[`💰 賣掉（+${refund.toLocaleString()} 金）`,'',async()=>{
      try{ const res=await rpc('farm_ranch_sell',{p_slot:slot}); applyState(res.state); refresh(); sfx('coin');
        toast(`賣掉${a.name}，拿回 ${res.refund.toLocaleString()} 金${res.got?`，順便收了 ${res.got} 個${a.good_name}`:''}`); openRanch(); }
      catch(e){ toast(/farm_ranch_sell|function|schema cache/i.test(e.message)?'這個功能還在準備中，請稍後再試':e.message); } }]]);
}
async function ranchAct(action, slot, kind){
  if(ui.busy) return; ui.busy=true; ui.lastLocal=Date.now();
  try{
    const r = await rpc('farm_ranch_act', {p_action:action, p_slot:slot, p_kind:kind||null});
    applyState(r.state); refresh();
    const a = kind ? ANI[kind] : null;
    if(action==='buy'){ sfx('coin'); toast(`買了一隻${a?a.name:'動物'}！`); }
    else if(action==='feed'){ sfx('seed'); toast('餵飽了，等牠生產吧'); }
    else if(action==='collect'){ sfx('harvest'); fxConfetti(); toast(`收成 ${r.amt} 個，放進穀倉了`); }
    else if(action==='swat'){ sfx('poof'); toast('拍掉一隻蚊子！'); }
    else if(action==='sell_goods'){ sfx('coin'); toast(`賣出牧場產品，獲得 ${r.amt} 金`); }
    else if(action==='sell_good'){ sfx('coin'); const g=ANIMALS.find(x=>x.good===kind); toast(`賣出${g?g.good_name:'牧場產品'}，獲得 ${r.amt} 金`); }
    if(r.xp) toast(`+${r.xp} 經驗`);
    if(r.lvup) setTimeout(showLevelUp, 400);
    if(r.gift) setTimeout(()=>showGift(r.gift), r.lvup?1600:500);
    if(action!=='sell_goods' && action!=='sell_good') openRanch(); else openBag();
  }catch(e){ sfx('err'); toast(e.message); }
  finally{ ui.busy=false; }
}
async function swatAni(slot, el){
  if(ui.busy) return; ui.busy=true; ui.lastLocal=Date.now();
  const b=el.getBoundingClientRect(), x=b.left+b.width/2, y=b.top+b.height*0.3;
  try{
    const r = await rpc('farm_ranch_act', {p_action:'swat', p_slot:slot, p_kind:null});
    sfx('poof'); vib(20); spawn('<span style="font-size:30px">💥</span>', x-15, y-20, 'grab', 600);
    for(let k=0;k<(LOWFX?3:6);k++){ const a=Math.random()*Math.PI*2, d=18+Math.random()*14; spawn('✦', x, y, 'star', 600, `--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d*0.7}px`); }
    floatAt(el, '拍掉蚊子！');
    applyState(r.state); refresh();
    if(r.xp) xpFloat(el, r.xp);
    if(r.lvup) setTimeout(showLevelUp, 400);
    if(r.gift) setTimeout(()=>showGift(r.gift), r.lvup?1600:500);
  }catch(e){ sfx('err'); toast(e.message); }
  finally{ ui.busy=false; }
}
function setCoopDot(){ const d=$('coopDot'); if(!d) return; const n = mode!=='visit' && S ? (S.ranch||[]).reduce((a,r)=>a+(r.f||0),0) : 0;
  d.style.display = n>0 ? '' : 'none'; const t=$('coopDotN'); if(t) t.textContent = n>9?'9+':String(n); }
async function ranchFriend(action, slot){
  if(ui.busy) return; ui.busy=true;
  try{
    const r = await rpc('farm_ranch_friend', {p_owner:V.owner.id, p_action:action, p_slot:slot});
    applyState(r.state); applyVisit(r.visit); refresh();
    if(r.ab==='dog'){ dogBite('被看門狗咬了！什麼都沒偷到'); }
    else if(r.ab==='scare'){ sfx('err'); toast('被稻草人擋下了！🎃'); }
    else if(action==='steal'){ sfx('steal'); toast(`偷到 ${r.qty} 個！`); }
    else if(action==='help_feed'){ sfx('seed'); toast('幫忙餵飽了！'); }
    else if(action==='help_swat'){ sfx('poof'); toast('幫忙拍掉蚊子！'); }
    else if(action==='prank'){ sfx('prank'); toast('放了一隻蚊子 😈'); }
    if(r.lvup) setTimeout(showLevelUp, 400);
    if(r.gift) setTimeout(()=>showGift(r.gift), r.lvup?1600:500);
    openRanch();
  }catch(e){ sfx('err'); toast(e.message); }
  finally{ ui.busy=false; }
}
function goodsHTML(me){
  const g = Object.entries(me.goods||{}).filter(([,n])=>n>0);
  if(!g.length) return '';
  const total = Math.ceil(g.reduce((s,[k,n])=>s + n*mktUnit('g',k), 0));
  return `<div class="sec">牧場產品</div>` + g.map(([k,n])=>{ const a=ANIMALS.find(x=>x.good===k)||{good_name:k,good_price:0};
    return `<div class="row"><div class="ic" style="display:grid;place-items:center;font-size:26px">${GOOD_ICON[k]||'⭐'}</div><div class="tx"><b>${a.good_name}</b> <span class="tag">×${n}</span> ${mktTag('g',k)}<div>現在每個 ${mktFmt(mktUnit('g',k))} 金・共 ${Math.ceil(n*mktUnit('g',k)).toLocaleString()} 金</div></div><button class="mini o" data-sellg="${k}">全部賣出</button></div>`; }).join('')
    + `<button class="btn o" id="sellGoods" style="width:100%;margin-top:6px">賣出全部牧場產品（${total.toLocaleString()} 金）</button>`;
}
