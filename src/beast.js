
/* ================= 寵物園：我的寵物＋購買新寵物 ================= */
let BEASTS = [], BST = {}, parkTab = 'mine';
function setBeastConfig(list, skins){ if(list){ BEASTS=list; BST={}; list.forEach(b=>BST[b.id]=b); } if(skins){ PSKINS=skins; PSK={}; skins.forEach(k=>PSK[k.id]=k); } }
let PSKINS = [], PSK = {};
const PSK_KIND = {mage:'🪄 魔法', mech:'🤖 機甲', star:'✨ 星辰'};
/* 寵物目前用的圖（有換造型就用造型） */
const petKey = (sp, who) => { const on = ((who||{}).pskin_on||{})[sp]; return on && /@/.test(on) ? on : sp+'1'; };
const petSrc = (sp, who) => chrSrc(petKey(sp, who));
const ownedBeasts = o => Object.keys((o && o.beasts) || {});
const bName = sp => (CHR_NAMES[sp]||[])[0] || (BST[sp]||{}).name || sp;
const fmtDate = ms => { if(!ms) return '一開始就在'; const d=new Date(+ms); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} 加入`; };

function openBeastPark(t){
  if(t) parkTab=t;
  const visit = mode==='visit' && V, who = visit ? V.owner : S.me, own = who.beasts || {};
  const tabs = `<div class="tabs"><button data-pt="mine" class="${parkTab==='mine'?'on':''}">${visit?'牠的寵物':'我的寵物'}（${ownedBeasts(who).length}）</button><button data-pt="dex" class="${parkTab==='dex'?'on':''}">購買新寵物 ${ownedBeasts(who).length}/${BEASTS.length}</button></div>`;
  let body = tabs;
  if(parkTab==='mine'){
    const pt=partyOf(who), inP=sp=>pt.findIndex(p=>p.s===sp), cap=visit?6:(who.party_cap||1);
    body += `<div class="sec">${visit?'牠的夥伴':`我的夥伴（${pt.length}/${cap}）`}</div>` + partyRowHTML(who, !visit);
    if(!visit) body += `<div class="rhint">👑 隊長會跑去幫你收成、澆水。每隻夥伴都能插一件裝備（點橘色「＋裝備」），同種功能取最強的那件。</div>`;
    const list = BEASTS.filter(b=>own[b.id]!=null);
    body += `<div class="sec">全部寵物</div><div class="bgrid">${list.map(b=>{ const k=inP(b.id);
      let btn='';
      if(visit) btn = k>=0 ? '<span class="tag" style="background:#E8F8EE;color:#2E9660">夥伴</span>' : '<span class="tag">在寵物園玩</span>';
      else if(k===0) btn='<span class="tag" style="background:#FFF1DC;color:#C77A1E">👑 隊長</span>';
      else if(k>0) btn=`<div style="display:flex;gap:4px"><button class="mini o" data-lead="${b.id}">隊長</button><button class="mini sub" data-off="${b.id}">下場</button></div>`;
      else btn=`<button class="mini" data-on="${b.id}" ${pt.length>=cap?'disabled':''}>上場</button>`;
      return `<div class="bcard${k>=0?' on':''}"><img src="${petSrc(b.id, who)}" alt=""${visit?'':` data-skin="${b.id}" style="cursor:pointer"`}>${visit?'':`<button class="skbtn" data-skin="${b.id}">🎨 換造型</button>`}<b>${bName(b.id)}</b><small>${fmtDate(own[b.id])}</small>${btn}</div>`; }).join('')}</div>`;
  } else {
    body += `<div class="bgrid">${BEASTS.map(b=>{ const has=own[b.id]!=null, lock=!visit && S.me.lv<b.lv;
      const cost = b.gold!=null ? `${b.gold.toLocaleString()} 金` : `💎${b.gems}`;
      const poor = !visit && (b.gold!=null ? S.me.gold<b.gold : (S.me.gems||0)<b.gems);
      return `<div class="bcard${has?'':' dark'}"><img src="${chrSrc(b.id+'1')}" alt=""><b>${bName(b.id)}</b><small>${has?fmtDate(own[b.id]):(b.gems!=null?'✨ 稀有寵物':'還沒擁有')}</small>
        ${has?'<span class="tag" style="background:#E8F8EE;color:#2E9660">已擁有</span>':visit?'':lock?`<span class="lock">Lv${b.lv} 解鎖</span>`:`<button class="mini ${b.gems!=null?'gem':''}" data-bb="${b.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }).join('')}</div>`;
  }
  modal(visit ? `${esc(V.owner.nickname)} 的寵物園` : '寵物園', body);
  const md=$('md');
  md.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>openBeastPark(b.dataset.pt));
  const pt0 = () => JSON.parse(JSON.stringify(partyOf(S.me)));
  md.querySelectorAll('[data-on]').forEach(b=>b.onclick=async()=>{ const pt=pt0(); pt.push({s:b.dataset.on,g:null}); await saveParty(pt, `${bName(b.dataset.on)} 上場了！`); openBeastPark('mine'); });
  md.querySelectorAll('[data-off]').forEach(b=>b.onclick=async()=>{ const pt=pt0().filter(p=>p.s!==b.dataset.off); await saveParty(pt, `${bName(b.dataset.off)} 回寵物園玩了`); openBeastPark('mine'); });
  md.querySelectorAll('[data-lead]').forEach(b=>b.onclick=async()=>{ const pt=pt0(), i=pt.findIndex(p=>p.s===b.dataset.lead); const [m]=pt.splice(i,1); pt.unshift(m); await saveParty(pt, `${bName(m.s)} 當上隊長！`); openBeastPark('mine'); });
  md.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>openGearBag(+b.dataset.pg));
  md.querySelectorAll('[data-skin]').forEach(b=>b.onclick=()=>openPetSkin(b.dataset.skin, ()=>openBeastPark('mine')));
  md.querySelectorAll('[data-bb]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.bb;
    try{ applyState(await rpc('farm_buy_beast',{p_id:id})); refresh(); fxConfetti(); sfx('lvup');
      modal('新夥伴加入！', `<div style="text-align:center;padding:6px 0"><img src="${chrSrc(id+'1')}" style="width:140px;height:140px;object-fit:contain;animation:floaty 3s ease-in-out infinite"><div style="font-weight:900;font-size:20px;margin-top:6px">${bName(id)}</div><div style="color:var(--ink2);font-weight:700">已經住進寵物園了</div></div>`,
        [['上場當夥伴','',async()=>{ const pt=JSON.parse(JSON.stringify(partyOf(S.me))); if(pt.length>=(S.me.party_cap||1)) return toast('夥伴格子滿了，先讓一隻下場'); pt.push({s:id,g:null}); await saveParty(pt, `${bName(id)} 上場了！`); closeModal(); }],['繼續看圖鑑','sub',()=>openBeastPark('dex')]]);
    }catch(e){ toast(e.message); } });
}

/* 寵物園裡玩的寵物（不是夥伴的那些） */
let parkMovers = [], parkSig = '', PARK = null;
function syncParkMovers(){
  if(!PARK) return;
  const who = mode==='visit' && V ? V.owner : S && S.me; if(!who) return;
  const inParty = partyOf(who).map(p=>p.s), list = ownedBeasts(who).filter(sp=>!inParty.includes(sp) && BST[sp]).slice(0, 12);
  const sig = list.map(sp=>petKey(sp,who)).join(',') + (mode==='visit'); if(sig===parkSig) return; parkSig = sig;
  const mv=$('movers'); if(!mv) return;
  parkMovers.forEach(m=>{ m.el.remove(); const i=movers.indexOf(m); if(i>=0) movers.splice(i,1); }); parkMovers=[];
  const [cx,cy,r]=PARK;
  list.forEach(sp=>{ const k=petKey(sp, who), n=50, w=n*(CHR_RATIO[k]||1);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.innerHTML=`<g class="mvin"><ellipse cx="0" cy="0" rx="${w*0.3}" ry="${n*0.08}" fill="rgba(0,0,0,.2)"/><g class="hop"><image href="${chrSrc(k)}" x="${-w/2}" y="${-n}" width="${w}" height="${n}"/></g></g>`;
    mv.appendChild(g);
    const m={el:g, wait:Math.random()*3, face:1, x:cx+(Math.random()-0.5)*r, y:cy+(Math.random()-0.5)*r, chick:true, area:[cx-r,cy-r,cx+r,cy+r], speed:0.45, s:1, petFace:-1};
    movers.push(m); parkMovers.push(m);
  });
}

/* ================= 夥伴隊伍（最多 9 隻，依等級開放） ================= */
const partyOf = who => (who && who.party && who.party.length) ? who.party : [{s:chrSpecies(who && who.chara), g:who && who.equip}];
function syncParty(){
  const who = mode==='visit' && V ? V.owner : S && S.me; if(!who || !farmerMover) return;
  const pt = partyOf(who);
  setMoverChar(farmerMover, petKey(pt[0].s, who0()), pt[0].g);
  const extra = pt.slice(1), mv=$('movers'); if(!mv) return;
  while(partyMovers.length > extra.length){ const m=partyMovers.pop(); m.el.remove(); const i=movers.indexOf(m); if(i>=0) movers.splice(i,1); }
  while(partyMovers.length < extra.length){
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.innerHTML='<g class="mvin"></g>'; mv.appendChild(g);
    let px=farmerMover.x, py=farmerMover.y; for(let t=0;t<30;t++){ const a=Math.random()*Math.PI*2, r=1+Math.random()*3, x=farmerMover.x+Math.cos(a)*r, y=farmerMover.y+Math.sin(a)*r; if(walkable(x,y)){ px=x; py=y; break; } }
    const m={el:g, wait:Math.random()*2, face:1, x:px, y:py, path:[], tgt:0, speed:0.5, s:1.1, farmer:true, member:true};
    movers.push(m); partyMovers.push(m);
  }
  extra.forEach((p,i)=>setMoverChar(partyMovers[i], petKey(p.s, who0()), p.g));
}
function partyLvs(){ const st=(typeof CFG_SET!=='undefined'&&CFG_SET)||{}; return [1, +(st.party_lv2??5), +(st.party_lv3??10), +(st.party_lv4??15), +(st.party_lv5??20), +(st.party_lv6??25), +(st.party_lv7??7), +(st.party_lv8??8), +(st.party_lv9??9)]; }
async function saveParty(pt, msg){
  try{ applyState(await rpc('farm_set_party',{p_party:pt})); refresh(); sfx('coin'); if(msg) toast(msg); }catch(e){ toast(e.message); }
}
function partyRowHTML(who, editable){
  const pt=partyOf(who), cap=editable ? (who.party_cap||1) : pt.length, lvs=partyLvs();
  return `<div class="prow">${[0,1,2,3,4,5,6,7,8].map(i=>{ const p=pt[i];
    if(p){ const g=GEAR[p.g]; return `<div class="pslot${i===0?' lead':''}">${i===0?'<span class="crown">👑</span>':''}<img class="pb" src="${petSrc(p.s, who)}" alt="">${editable?`<button class="pg${g?' on':''}" data-pg="${i}">${g?`<img src="${A(g.icon)}" alt="">`:'<i>＋</i>'}<span>${g?'✓':'裝備'}</span></button>`:(g?`<span class="pg on"><img src="${A(g.icon)}" alt=""><span>裝備</span></span>`:'')}</div>`; }
    if(i<cap) return `<div class="pslot empty">空位</div>`;
    return `<div class="pslot lock">🔒<br>Lv${lvs[i]}</div>`; }).join('')}</div>`;
}

const who0 = () => (mode==='visit' && V) ? V.owner : (S && S.me);

/* 換造型：點寵物就跳出來 */
function openPetSkin(sp, back){
  const me=S.me, on=(me.pskin_on||{})[sp]||'', own=me.pskins||{}, list=PSKINS.filter(k=>k.beast===sp);
  const card=(key,name,img,state)=>`<div class="bcard${state==='on'?' on':''}"><img src="${img}" alt=""><b>${name}</b>${state}</div>`;
  const cells=[`<div class="bcard${!on?' on':''}"><img src="${chrSrc(sp+'1')}" alt=""><b>原本的樣子</b>${!on?'<span class="tag" style="background:#E8F8EE;color:#2E9660">使用中</span>':`<button class="mini sub" data-wear="">換上</button>`}</div>`]
    .concat(list.map(k=>{ const has=own[k.id], cost=k.gold!=null?`${k.gold.toLocaleString()} 金`:`💎${k.gems}`, poor=k.gold!=null?me.gold<k.gold:(me.gems||0)<k.gems;
      return `<div class="bcard${on===k.id?' on':has?'':' dark'}"><img src="${chrSrc(k.id)}" alt=""><b>${PSK_KIND[k.kind]||''}</b>${on===k.id?'<span class="tag" style="background:#E8F8EE;color:#2E9660">使用中</span>':has?`<button class="mini" data-wear="${k.id}">換上</button>`:`<button class="mini ${k.gems!=null?'gem':''}" data-bsk="${k.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }));
  modal(`🎨 ${esc(bName(sp))} 的造型`, `<div class="skprev"><img src="${chrSrc(on||sp+'1')}" alt=""></div><div class="bgrid">${cells.join('')}</div><div class="rhint">買了造型會自動換上，之後可以隨時換回原本的樣子</div>`, back?[['← 返回','sub',back]]:undefined);
  const md=$('md');
  md.querySelectorAll('[data-wear]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_set_pskin',{p_beast:sp,p_skin:b.dataset.wear||null})); refresh(); sfx('coin'); openPetSkin(sp, back); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-bsk]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_buy_pskin',{p_id:b.dataset.bsk})); refresh(); sfx('lvup'); fxConfetti(); toast('新造型換上了！'); openPetSkin(sp, back); }catch(e){ toast(e.message); } });
}

/* 寵物商店：裝備／寵物／寵物造型 */
let petShopTab = 'gear';
function petShopTabs(){ return `<div class="tabs"><button data-pst="gear" class="${petShopTab==='gear'?'on':''}">🛡️ 裝備</button><button data-pst="pet" class="${petShopTab==='pet'?'on':''}">🐾 寵物</button><button data-pst="skin" class="${petShopTab==='skin'?'on':''}">🎨 寵物造型</button></div>`; }
function bindPetShopTabs(){ document.querySelectorAll('#md [data-pst]').forEach(b=>b.onclick=()=>openPetShop(b.dataset.pst)); }
function openPetShop(t){
  if(mode==='visit') return toast('回到自己的農場才能買東西');
  if(t) petShopTab=t;
  if(petShopTab==='gear') return openGearShop();
  const me=S.me, title=`寵物商店　<span style="font-size:14px;color:var(--ink2)">${me.gold.toLocaleString()} 金・💎${(me.gems||0).toLocaleString()}</span>`;
  if(petShopTab==='pet'){
    const own=me.beasts||{};
    const body = petShopTabs() + `<div class="bgrid">${BEASTS.map(b=>{ const has=own[b.id]!=null, lock=me.lv<b.lv;
      const cost = b.gold!=null ? `${b.gold.toLocaleString()} 金` : `💎${b.gems}`, poor = b.gold!=null ? me.gold<b.gold : (me.gems||0)<b.gems;
      return `<div class="bcard${has?'':' dark'}"><img src="${petSrc(b.id, me)}" alt=""><b>${bName(b.id)}</b><small>${has?'已擁有':(b.gems!=null?'✨ 稀有寵物':'還沒擁有')}</small>
        ${has?'<span class="tag" style="background:#E8F8EE;color:#2E9660">已擁有</span>':lock?`<span class="lock">Lv${b.lv} 解鎖</span>`:`<button class="mini ${b.gems!=null?'gem':''}" data-bb="${b.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }).join('')}</div>`;
    modal(title, body); bindPetShopTabs();
    document.querySelectorAll('#md [data-bb]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.bb;
      try{ applyState(await rpc('farm_buy_beast',{p_id:id})); refresh(); fxConfetti(); sfx('lvup');
        modal('新夥伴加入！', `<div style="text-align:center;padding:6px 0"><img src="${chrSrc(id+'1')}" style="width:140px;height:140px;object-fit:contain;animation:floaty 3s ease-in-out infinite"><div style="font-weight:900;font-size:20px;margin-top:6px">${bName(id)}</div><div style="color:var(--ink2);font-weight:700">已經住進寵物園了</div></div>`,
          [['上場當夥伴','',async()=>{ const pt=JSON.parse(JSON.stringify(partyOf(S.me))); if(pt.length>=(S.me.party_cap||1)) return toast('夥伴格子滿了，先讓一隻下場'); pt.push({s:id,g:null}); await saveParty(pt, `${bName(id)} 上場了！`); closeModal(); }],['繼續逛','sub',()=>openPetShop('pet')]]);
      }catch(e){ toast(e.message); } });
    return;
  }
  // 寵物造型：先列自己有的寵物，再列還沒有的
  const own=me.beasts||{}, have=BEASTS.filter(b=>own[b.id]!=null), not=BEASTS.filter(b=>own[b.id]==null);
  const rowFor=b=>{ const has=own[b.id]!=null, ks=PSKINS.filter(k=>k.beast===b.id);
    return `<div class="skrow${has?'':' dim'}"><div class="skhd"><img src="${chrSrc(b.id+'1')}" alt=""><b>${bName(b.id)}</b>${has?'':'<small>先擁有寵物才能買</small>'}</div><div class="skks">${ks.map(k=>{ const got=(me.pskins||{})[k.id], cost=k.gold!=null?`${k.gold.toLocaleString()} 金`:`💎${k.gems}`, poor=k.gold!=null?me.gold<k.gold:(me.gems||0)<k.gems;
      return `<div class="skk"><img src="${chrSrc(k.id)}" alt=""><small>${PSK_KIND[k.kind]||''}</small>${got?'<span class="tag" style="background:#E8F8EE;color:#2E9660">已擁有</span>':has?`<button class="mini ${k.gems!=null?'gem':''}" data-bsk="${k.id}" ${poor?'disabled':''}>${cost}</button>`:`<span class="lock">${cost}</span>`}</div>`; }).join('')}</div></div>`; };
  modal(title, petShopTabs() + `<div class="rhint">每隻寵物都有 3 款特別造型，買了會自動換上；在寵物園點寵物可以隨時換回來</div>` + have.concat(not).map(rowFor).join(''));
  bindPetShopTabs();
  document.querySelectorAll('#md [data-bsk]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_buy_pskin',{p_id:b.dataset.bsk})); refresh(); sfx('lvup'); fxConfetti(); toast('新造型換上了！'); openPetShop('skin'); }catch(e){ toast(e.message); } });
}
