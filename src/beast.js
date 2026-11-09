
/* ================= 萌獸園：我的萌獸＋圖鑑 ================= */
let BEASTS = [], BST = {}, parkTab = 'mine';
function setBeastConfig(list){ if(list){ BEASTS=list; BST={}; list.forEach(b=>BST[b.id]=b); } }
const ownedBeasts = o => Object.keys((o && o.beasts) || {});
const bName = sp => (CHR_NAMES[sp]||[])[0] || (BST[sp]||{}).name || sp;
const fmtDate = ms => { if(!ms) return '一開始就在'; const d=new Date(+ms); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} 加入`; };

function openBeastPark(t){
  if(t) parkTab=t;
  const visit = mode==='visit' && V, who = visit ? V.owner : S.me, own = who.beasts || {}, partner = chrSpecies(who.chara);
  const tabs = `<div class="tabs"><button data-pt="mine" class="${parkTab==='mine'?'on':''}">${visit?'牠的萌獸':'我的萌獸'}（${ownedBeasts(who).length}）</button><button data-pt="dex" class="${parkTab==='dex'?'on':''}">圖鑑 ${ownedBeasts(who).length}/${BEASTS.length}</button></div>`;
  let body = tabs;
  if(parkTab==='mine'){
    const list = BEASTS.filter(b=>own[b.id]!=null);
    body += `<div class="bgrid">${list.map(b=>{ const isP=b.id===partner;
      return `<div class="bcard${isP?' on':''}"><img src="${chrSrc(b.id+'1')}" alt=""><b>${bName(b.id)}</b><small>${fmtDate(own[b.id])}</small>
        ${isP?'<span class="tag" style="background:#E8F8EE;color:#2E9660">夥伴中</span>':visit?'<span class="tag">在萌獸園玩</span>':`<button class="mini" data-bp="${b.id}">設為夥伴</button>`}</div>`; }).join('')}</div>`;
    if(!visit) body += `<div class="rhint" style="text-align:center;margin-top:8px">夥伴會跟著你在島上走、幫你做事，其他萌獸會在萌獸園裡玩</div>`;
  } else {
    body += `<div class="bgrid">${BEASTS.map(b=>{ const has=own[b.id]!=null, lock=!visit && S.me.lv<b.lv;
      const cost = b.gold!=null ? `${b.gold.toLocaleString()} 金` : `💎${b.gems}`;
      const poor = !visit && (b.gold!=null ? S.me.gold<b.gold : (S.me.gems||0)<b.gems);
      return `<div class="bcard${has?'':' dark'}"><img src="${chrSrc(b.id+'1')}" alt=""><b>${has?bName(b.id):'？？？'}</b><small>${has?fmtDate(own[b.id]):(b.gems!=null?'稀有萌獸':'&nbsp;')}</small>
        ${has?'<span class="tag" style="background:#E8F8EE;color:#2E9660">已擁有</span>':visit?'':lock?`<span class="lock">Lv${b.lv} 解鎖</span>`:`<button class="mini ${b.gems!=null?'gem':''}" data-bb="${b.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }).join('')}</div>`;
  }
  modal(visit ? `${esc(V.owner.nickname)} 的萌獸園` : '萌獸園', body);
  const md=$('md');
  md.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>openBeastPark(b.dataset.pt));
  md.querySelectorAll('[data-bp]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_set_chara',{p_c:b.dataset.bp+'1'})); refresh(); sfx('coin'); toast(`${bName(b.dataset.bp)} 成為你的夥伴！`); openBeastPark('mine'); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-bb]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.bb;
    try{ applyState(await rpc('farm_buy_beast',{p_id:id})); refresh(); fxConfetti(); sfx('lvup');
      modal('新夥伴加入！', `<div style="text-align:center;padding:6px 0"><img src="${chrSrc(id+'1')}" style="width:140px;height:140px;object-fit:contain;animation:floaty 3s ease-in-out infinite"><div style="font-weight:900;font-size:20px;margin-top:6px">${bName(id)}</div><div style="color:var(--ink2);font-weight:700">已經住進萌獸園了</div></div>`,
        [['設為夥伴','',async()=>{ try{ applyState(await rpc('farm_set_chara',{p_c:id+'1'})); refresh(); closeModal(); toast(`${bName(id)} 成為你的夥伴！`); }catch(e){ toast(e.message); } }],['繼續看圖鑑','sub',()=>openBeastPark('dex')]]);
    }catch(e){ toast(e.message); } });
}

/* 萌獸園裡玩的萌獸（不是夥伴的那些） */
let parkMovers = [], parkSig = '', PARK = null;
function syncParkMovers(){
  if(!PARK) return;
  const who = mode==='visit' && V ? V.owner : S && S.me; if(!who) return;
  const partner = chrSpecies(who.chara), list = ownedBeasts(who).filter(sp=>sp!==partner && BST[sp]).slice(0, 12);
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
