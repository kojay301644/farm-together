
/* ================= 商店與自由擺放 ================= */
let DECOR = [], DEC = {}, DECOR_MAX = 40, OBST_FIXED = [], decorSig = '', EDIT = null;
const DEC_R = {"balloon":1.249,"bench":0.83,"carousel":1.346,"crystal":0.978,"dragon":1.071,"flag":1.602,"flower":0.796,"gifts":0.924,"hay":0.898,"kennel":0.966,"lamp":1.969,"lantree":1.1,"mail":1.291,"mush":1.058,"picnic":0.713,"pond":0.819,"pumpkin":0.924,"rainbow":0.793,"sakura":1.109,"snowman":1.151,"statue":1.313,"swing":1.113,"torii":1.266,"xmas":1.131};
function setDecorConfig(list, st){ if(list){ DECOR=list; DEC={}; list.forEach(d=>DEC[d.id]=d); } if(st && st.decor_max!=null) DECOR_MAX=+st.decor_max; }
const decW = id => (DEC[id] && DEC[id].w) || 70;
const bonusTxt = d => !d || !d.bonus ? '' : d.bonus==='prank' ? `擺出來：每天惡作劇 +${d.bonus_val}` : `擺出來：每天偷陌生人 +${d.bonus_val}`;

/* 位置能不能擺：在島上、不壓到建築、田、牧場 */
function decorOK(gx, gy){
  const [x,y]=iso(gx,gy);
  if(((x-ISL[0])/(ISL[2]*0.97))**2+((y-ISL[1])/(ISL[3]*0.95))**2>1) return false;
  for(const [ox,oy,rx,ry] of OBST_FIXED) if(((x-ox)/rx)**2+((y-oy)/ry)**2<1) return false;
  if(RANCH && gx>RANCH[0]-0.3 && gx<RANCH[0]+RANCH[2]+0.3 && gy>RANCH[1]-0.3 && gy<RANCH[1]+RANCH[3]+0.3) return false;
  for(const [px,py] of PLOTS) if(gx>px-0.25 && gx<px+PS+0.25 && gy>py-0.25 && gy<py+PS+0.25) return false;
  return true;
}
function curDecor(){ if(EDIT) return EDIT.list; if(mode==='visit' && V) return V.owner.decor_place||[]; return (S && S.me.decor_place)||[]; }

function renderDecor(force){
  const L = $('decorL'); if(!L) return;
  const list = curDecor();
  const sig = JSON.stringify(list) + (EDIT?('e'+EDIT.sel):'');
  if(!force && sig===decorSig) return; decorSig = sig;
  const idx = list.map((d,i)=>i).sort((a,b)=>(list[a].x+list[a].y)-(list[b].x+list[b].y));
  L.innerHTML = idx.map(i=>{ const d=list[i], w=decW(d.i), h=w*(DEC_R[d.i]||1), [x,y]=iso(d.x,d.y);
    const bad = EDIT && !decorOK(d.x,d.y), sel = EDIT && EDIT.sel===i;
    const img = `<image href="${A('dc_'+d.i)}" x="${(x-w/2).toFixed(1)}" y="${(y-h*0.85).toFixed(1)}" width="${w}" height="${h.toFixed(1)}"${d.f?` transform="translate(${2*x} 0) scale(-1 1)"`:''}/>`;
    return `<g data-di="${i}" class="dec${sel?' sel':''}${bad?' bad':''}">${sel?`<ellipse cx="${x}" cy="${y}" rx="${w*0.5}" ry="${w*0.22}" fill="${bad?'rgba(242,84,91,.35)':'rgba(255,255,255,.45)'}" stroke="${bad?'#F2545B':'#3BB273'}" stroke-width="3" stroke-dasharray="8 5"/>`:''}${img}</g>`; }).join('');
  // 萌獸繞開裝飾
  OBST = OBST_FIXED.concat(list.map(d=>{ const w=decW(d.i), [x,y]=iso(d.x,d.y); return [x, y-w*0.06, w*0.4, w*0.2]; }));
}

/* ---------- 商店 ---------- */
let decorTab = 'shop';
function openDecorShop(t){
  if(mode==='visit') return toast('回到自己的農場才能逛商店');
  if(t) decorTab=t;
  const me=S.me, inv=me.decor_inv||{}, placed={}; (me.decor_place||[]).forEach(d=>placed[d.i]=(placed[d.i]||0)+1);
  let body = shopNav(decorTab==='shop'?'decor':'mine');
  if(decorTab==='shop'){
    body += DECOR.map(d=>{ const lock=me.lv<d.lv, n=inv[d.id]||0, cost=d.gold!=null?`${d.gold.toLocaleString()} 金`:`💎${d.gems}`;
      const poor = d.gold!=null ? me.gold<d.gold : (me.gems||0)<d.gems;
      return `<div class="row" style="${lock?'opacity:.55':''}"><div class="ic"><img src="${A('dc_'+d.id)}" style="width:44px;height:44px;object-fit:contain" alt=""></div>
        <div class="tx"><b>${esc(d.name)}</b>${n?` <span class="tag">已有 ${n}</span>`:''}${d.bonus?`<div style="color:#7B6CF6">${bonusTxt(d)}</div>`:'<div>&nbsp;</div>'}</div>
        ${lock?`<span class="lock">Lv${d.lv} 解鎖</span>`:`<button class="mini ${d.gems!=null?'gem':''}" data-bd="${d.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }).join('');
  } else {
    const own = DECOR.filter(d=>(inv[d.id]||0)>0);
    body += own.length ? own.map(d=>`<div class="row"><div class="ic"><img src="${A('dc_'+d.id)}" style="width:44px;height:44px;object-fit:contain" alt=""></div>
        <div class="tx"><b>${esc(d.name)}</b> <span class="tag">擺了 ${placed[d.id]||0}/${inv[d.id]}</span>${d.bonus?`<div style="color:#7B6CF6">${bonusTxt(d)}</div>`:''}</div>
        <button class="mini" data-pd="${d.id}" ${(placed[d.id]||0)>=inv[d.id]?'disabled':''}>擺放</button></div>`).join('')
      : `<div class="empty">還沒有裝飾，去商店買一些吧！</div>`;
  }
  body += `<div class="rhint" style="text-align:center;margin-top:8px">同一種加成裝飾只算一次・最多擺 ${DECOR_MAX} 個・好友來拜訪看得到</div>`;
  modal(shopTitle(), body, [['🖐️ 擺放模式','o',()=>enterDecorEdit()]]);
  bindShopNav(); const md=$('md');
  md.querySelectorAll('[data-bd]').forEach(b=>b.onclick=async()=>{ const d=DEC[b.dataset.bd];
    try{ applyState(await rpc('farm_buy_decor',{p_id:d.id,p_n:1})); refresh(); sfx('coin');
      modal('買到了！', `<div style="text-align:center;padding:6px 0"><img src="${A('dc_'+d.id)}" style="width:110px;height:110px;object-fit:contain"><div style="font-weight:900;font-size:18px;margin-top:6px">${esc(d.name)}</div>${d.bonus?`<div style="color:#7B6CF6;font-weight:700">${bonusTxt(d)}</div>`:''}</div>`,
        [['馬上擺放','',()=>enterDecorEdit(d.id)],['繼續逛','sub',()=>openDecorShop('shop')]]);
    }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-pd]').forEach(b=>b.onclick=()=>enterDecorEdit(b.dataset.pd));
}

/* ---------- 擺放模式 ---------- */
function screenToGrid(cx, cy){ const W=$('world'), pt=W.createSVGPoint(); pt.x=cx; pt.y=cy; const p=pt.matrixTransform(W.getScreenCTM().inverse()); return W2G(p.x, p.y); }
function enterDecorEdit(addId){
  if(mode==='visit') return;
  closeModal();
  EDIT = {list: JSON.parse(JSON.stringify(S.me.decor_place||[])), sel:-1, orig: JSON.stringify(S.me.decor_place||[])};
  document.body.classList.add('editing');
  let bar=$('editBar');
  if(!bar){ bar=document.createElement('div'); bar.id='editBar'; document.body.appendChild(bar); }
  bar.style.display='';
  if(addId) decorAdd(addId); else renderEditBar();
  renderDecor(true);
  if(!addId) toast('點裝飾選取、拖曳移動');
}
function renderEditBar(){
  const bar=$('editBar'), s=EDIT.sel>=0, inv=S.me.decor_inv||{}, used={};
  EDIT.list.forEach(d=>used[d.i]=(used[d.i]||0)+1);
  const left = DECOR.filter(d=>(inv[d.id]||0)>(used[d.id]||0));
  bar.innerHTML = `<div class="ebin">
    <div class="ebrow">${s?`<button class="mini sub" id="eFlip">↔️ 翻轉</button><button class="mini sub" id="eBack">📦 收回</button>`:`<span class="ebtip">點裝飾選取，按住拖曳移動（${EDIT.list.length}/${DECOR_MAX}）</span>`}</div>
    <div class="ebinv">${left.length?left.map(d=>`<button class="ebitem" data-ea="${d.id}"><img src="${A('dc_'+d.id)}" alt=""><span>${(inv[d.id]||0)-(used[d.id]||0)}</span></button>`).join(''):'<span class="ebtip">背包裡的裝飾都擺出來了</span>'}</div>
    <div class="ebrow"><button class="btn sub" id="eCancel">取消</button><button class="btn" id="eDone">✔ 完成</button></div></div>`;
  if(s){ $('eFlip').onclick=()=>{ const d=EDIT.list[EDIT.sel]; d.f=!d.f; renderDecor(true); };
         $('eBack').onclick=()=>{ EDIT.list.splice(EDIT.sel,1); EDIT.sel=-1; renderDecor(true); renderEditBar(); }; }
  bar.querySelectorAll('[data-ea]').forEach(b=>b.onclick=()=>decorAdd(b.dataset.ea));
  $('eCancel').onclick=()=>exitDecorEdit(false);
  $('eDone').onclick=()=>exitDecorEdit(true);
}
function decorAdd(id){
  if(EDIT.list.length>=DECOR_MAX) return toast(`最多只能擺 ${DECOR_MAX} 個`);
  let [gx,gy]=screenToGrid(innerWidth/2, innerHeight*0.45);
  // 中間不能擺就找附近的空位
  if(!decorOK(gx,gy)){ for(let r=0.5;r<8;r+=0.5){ let found=false; for(let a=0;a<12;a++){ const x=gx+Math.cos(a/12*Math.PI*2)*r, y=gy+Math.sin(a/12*Math.PI*2)*r; if(decorOK(x,y)){ gx=x; gy=y; found=true; break; } } if(found) break; } }
  EDIT.list.push({i:id, x:+gx.toFixed(2), y:+gy.toFixed(2), f:false}); EDIT.sel=EDIT.list.length-1;
  sfx('tap'); renderDecor(true); renderEditBar();
}
async function exitDecorEdit(save){
  if(save){
    if(EDIT.list.some(d=>!decorOK(d.x,d.y))) return toast('有裝飾擺在不能放的地方（紅色），移開再按完成');
    if(JSON.stringify(EDIT.list)!==EDIT.orig){
      try{ applyState(await rpc('farm_save_decor',{p_list:EDIT.list})); sfx('coin'); toast('擺放好了！'); }
      catch(e){ return toast(e.message); }
    }
  }
  EDIT=null; document.body.classList.remove('editing'); const bar=$('editBar'); if(bar) bar.style.display='none';
  refresh(); renderDecor(true);
}
/* 拖曳 */
let decDrag=null;
function bindDecorLayer(){
  const L=$('decorL'); if(!L || L._bound) return; L._bound=true;
  L.addEventListener('pointerdown', e=>{
    if(!EDIT) return; const g=e.target.closest('[data-di]'); if(!g) return;
    e.stopPropagation(); e.preventDefault();
    const i=+g.dataset.di, d=EDIT.list[i], [gx,gy]=screenToGrid(e.clientX,e.clientY);
    EDIT.sel=i; decDrag={i, dx:d.x-gx, dy:d.y-gy, id:e.pointerId};
    try{ L.setPointerCapture(e.pointerId); }catch(_){}
    renderDecor(true); renderEditBar();
  });
  L.addEventListener('pointermove', e=>{ if(!decDrag || e.pointerId!==decDrag.id) return; e.preventDefault();
    const [gx,gy]=screenToGrid(e.clientX,e.clientY), d=EDIT.list[decDrag.i]; d.x=+(gx+decDrag.dx).toFixed(2); d.y=+(gy+decDrag.dy).toFixed(2); renderDecor(true); });
  const end=e=>{ if(decDrag){ decDrag=null; } };
  L.addEventListener('pointerup', end); L.addEventListener('pointercancel', end);
  L.addEventListener('touchstart', e=>{ if(EDIT && e.target.closest('[data-di]')) e.preventDefault(); }, {passive:false});
  // 點空白處取消選取
  $('map').addEventListener('click', e=>{ if(EDIT && !e.target.closest('[data-di]') && EDIT.sel>=0){ EDIT.sel=-1; renderDecor(true); renderEditBar(); } });
}
