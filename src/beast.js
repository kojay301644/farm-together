
/* ================= 萌獸園：我的萌獸＋圖鑑 ================= */
let BEASTS = [], BST = {}, parkTab = 'mine';
function setBeastConfig(list){ if(list){ BEASTS=list; BST={}; list.forEach(b=>BST[b.id]=b); } }
const ownedBeasts = o => Object.keys((o && o.beasts) || {});
const bName = sp => (CHR_NAMES[sp]||[])[0] || (BST[sp]||{}).name || sp;
const fmtDate = ms => { if(!ms) return '一開始就在'; const d=new Date(+ms); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} 加入`; };

function openBeastPark(t){
  if(t) parkTab=t;
  const visit = mode==='visit' && V, who = visit ? V.owner : S.me, own = who.beasts || {};
  const tabs = `<div class="tabs"><button data-pt="mine" class="${parkTab==='mine'?'on':''}">${visit?'牠的萌獸':'我的萌獸'}（${ownedBeasts(who).length}）</button><button data-pt="dex" class="${parkTab==='dex'?'on':''}">圖鑑 ${ownedBeasts(who).length}/${BEASTS.length}</button></div>`;
  let body = tabs;
  if(parkTab==='mine'){
    const pt=partyOf(who), inP=sp=>pt.findIndex(p=>p.s===sp), cap=visit?6:(who.party_cap||1);
    body += `<div class="sec">${visit?'牠的夥伴':`我的夥伴（${pt.length}/${cap}）`}</div>` + partyRowHTML(who, !visit);
    if(!visit) body += `<div class="rhint">👑 隊長會跑去幫你收成、澆水。每隻夥伴都能插一件裝備（點夥伴下面的＋），同種功能取最強的那件。</div>`;
    const list = BEASTS.filter(b=>own[b.id]!=null);
    body += `<div class="sec">全部萌獸</div><div class="bgrid">${list.map(b=>{ const k=inP(b.id);
      let btn='';
      if(visit) btn = k>=0 ? '<span class="tag" style="background:#E8F8EE;color:#2E9660">夥伴</span>' : '<span class="tag">在萌獸園玩</span>';
      else if(k===0) btn='<span class="tag" style="background:#FFF1DC;color:#C77A1E">👑 隊長</span>';
      else if(k>0) btn=`<div style="display:flex;gap:4px"><button class="mini o" data-lead="${b.id}">隊長</button><button class="mini sub" data-off="${b.id}">下場</button></div>`;
      else btn=`<button class="mini" data-on="${b.id}" ${pt.length>=cap?'disabled':''}>上場</button>`;
      return `<div class="bcard${k>=0?' on':''}"><img src="${chrSrc(b.id+'1')}" alt=""><b>${bName(b.id)}</b><small>${fmtDate(own[b.id])}</small>${btn}</div>`; }).join('')}</div>`;
  } else {
    body += `<div class="bgrid">${BEASTS.map(b=>{ const has=own[b.id]!=null, lock=!visit && S.me.lv<b.lv;
      const cost = b.gold!=null ? `${b.gold.toLocaleString()} 金` : `💎${b.gems}`;
      const poor = !visit && (b.gold!=null ? S.me.gold<b.gold : (S.me.gems||0)<b.gems);
      return `<div class="bcard${has?'':' dark'}"><img src="${chrSrc(b.id+'1')}" alt=""><b>${bName(b.id)}</b><small>${has?fmtDate(own[b.id]):(b.gems!=null?'✨ 稀有萌獸':'還沒擁有')}</small>
        ${has?'<span class="tag" style="background:#E8F8EE;color:#2E9660">已擁有</span>':visit?'':lock?`<span class="lock">Lv${b.lv} 解鎖</span>`:`<button class="mini ${b.gems!=null?'gem':''}" data-bb="${b.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }).join('')}</div>`;
  }
  modal(visit ? `${esc(V.owner.nickname)} 的萌獸園` : '萌獸園', body);
  const md=$('md');
  md.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>openBeastPark(b.dataset.pt));
  const pt0 = () => JSON.parse(JSON.stringify(partyOf(S.me)));
  md.querySelectorAll('[data-on]').forEach(b=>b.onclick=async()=>{ const pt=pt0(); pt.push({s:b.dataset.on,g:null}); await saveParty(pt, `${bName(b.dataset.on)} 上場了！`); openBeastPark('mine'); });
  md.querySelectorAll('[data-off]').forEach(b=>b.onclick=async()=>{ const pt=pt0().filter(p=>p.s!==b.dataset.off); await saveParty(pt, `${bName(b.dataset.off)} 回萌獸園玩了`); openBeastPark('mine'); });
  md.querySelectorAll('[data-lead]').forEach(b=>b.onclick=async()=>{ const pt=pt0(), i=pt.findIndex(p=>p.s===b.dataset.lead); const [m]=pt.splice(i,1); pt.unshift(m); await saveParty(pt, `${bName(m.s)} 當上隊長！`); openBeastPark('mine'); });
  md.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>openGearBag(+b.dataset.pg));
  md.querySelectorAll('[data-bb]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.bb;
    try{ applyState(await rpc('farm_buy_beast',{p_id:id})); refresh(); fxConfetti(); sfx('lvup');
      modal('新夥伴加入！', `<div style="text-align:center;padding:6px 0"><img src="${chrSrc(id+'1')}" style="width:140px;height:140px;object-fit:contain;animation:floaty 3s ease-in-out infinite"><div style="font-weight:900;font-size:20px;margin-top:6px">${bName(id)}</div><div style="color:var(--ink2);font-weight:700">已經住進萌獸園了</div></div>`,
        [['上場當夥伴','',async()=>{ const pt=JSON.parse(JSON.stringify(partyOf(S.me))); if(pt.length>=(S.me.party_cap||1)) return toast('夥伴格子滿了，先讓一隻下場'); pt.push({s:id,g:null}); await saveParty(pt, `${bName(id)} 上場了！`); closeModal(); }],['繼續看圖鑑','sub',()=>openBeastPark('dex')]]);
    }catch(e){ toast(e.message); } });
}

/* 萌獸園裡玩的萌獸（不是夥伴的那些） */
let parkMovers = [], parkSig = '', PARK = null;
function syncParkMovers(){
  if(!PARK) return;
  const who = mode==='visit' && V ? V.owner : S && S.me; if(!who) return;
  const inParty = partyOf(who).map(p=>p.s), list = ownedBeasts(who).filter(sp=>!inParty.includes(sp) && BST[sp]).slice(0, 12);
  const sig = list.join(',') + (mode==='visit'); if(sig===parkSig) return; parkSig = sig;
  const mv=$('movers'); if(!mv) return;
  parkMovers.forEach(m=>{ m.el.remove(); const i=movers.indexOf(m); if(i>=0) movers.splice(i,1); }); parkMovers=[];
  const [cx,cy,r]=PARK;
  list.forEach(sp=>{ const k=sp+'1', n=50, w=n*(CHR_RATIO[k]||1);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.innerHTML=`<g class="mvin"><ellipse cx="0" cy="0" rx="${w*0.3}" ry="${n*0.08}" fill="rgba(0,0,0,.2)"/><g class="hop"><image href="${chrSrc(k)}" x="${-w/2}" y="${-n}" width="${w}" height="${n}"/></g></g>`;
    mv.appendChild(g);
    const m={el:g, wait:Math.random()*3, face:1, x:cx+(Math.random()-0.5)*r, y:cy+(Math.random()-0.5)*r, chick:true, area:[cx-r,cy-r,cx+r,cy+r], speed:0.45, s:1, petFace:-1};
    movers.push(m); parkMovers.push(m);
  });
}

/* ================= 夥伴隊伍（最多 6 隻，依等級開放） ================= */
const partyOf = who => (who && who.party && who.party.length) ? who.party : [{s:chrSpecies(who && who.chara), g:who && who.equip}];
function syncParty(){
  const who = mode==='visit' && V ? V.owner : S && S.me; if(!who || !farmerMover) return;
  const pt = partyOf(who);
  setMoverChar(farmerMover, pt[0].s+'1', pt[0].g);
  const extra = pt.slice(1), mv=$('movers'); if(!mv) return;
  while(partyMovers.length > extra.length){ const m=partyMovers.pop(); m.el.remove(); const i=movers.indexOf(m); if(i>=0) movers.splice(i,1); }
  while(partyMovers.length < extra.length){
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.innerHTML='<g class="mvin"></g>'; mv.appendChild(g);
    const a=Math.random()*Math.PI*2, m={el:g, wait:Math.random()*2, face:1, x:farmerMover.x+Math.cos(a)*1.2, y:farmerMover.y+Math.sin(a)*1.2, path:[], tgt:0, speed:0.5, s:1.1, farmer:true, member:true};
    movers.push(m); partyMovers.push(m);
  }
  extra.forEach((p,i)=>setMoverChar(partyMovers[i], p.s+'1', p.g));
}
function partyLvs(){ const st=(typeof CFG_SET!=='undefined'&&CFG_SET)||{}; return [1, +(st.party_lv2??5), +(st.party_lv3??10), +(st.party_lv4??15), +(st.party_lv5??20), +(st.party_lv6??25)]; }
async function saveParty(pt, msg){
  try{ applyState(await rpc('farm_set_party',{p_party:pt})); refresh(); sfx('coin'); if(msg) toast(msg); }catch(e){ toast(e.message); }
}
function partyRowHTML(who, editable){
  const pt=partyOf(who), cap=editable ? (who.party_cap||1) : pt.length, lvs=partyLvs();
  return `<div class="prow">${[0,1,2,3,4,5].map(i=>{ const p=pt[i];
    if(p){ const g=GEAR[p.g]; return `<div class="pslot${i===0?' lead':''}">${i===0?'<span class="crown">👑</span>':''}<img src="${chrSrc(p.s+'1')}" alt="">${editable?`<button class="pg" data-pg="${i}">${g?`<img src="${A(g.icon)}" alt="">`:'＋'}</button>`:(g?`<span class="pg"><img src="${A(g.icon)}" alt=""></span>`:'')}</div>`; }
    if(i<cap) return `<div class="pslot empty">空位</div>`;
    return `<div class="pslot lock">🔒<br>Lv${lvs[i]}</div>`; }).join('')}</div>`;
}
