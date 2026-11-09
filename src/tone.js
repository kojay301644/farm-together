
/* ================= 城鎮色調 ================= */
let TONES = [], TONE = {};
const TONE_FX = {
  spring:{sky:['#3f9be8','#8fcdfb','#d6efff'], g:[], fx:null},
  autumn:{sky:['#4a8fd8','#f2c48e','#ffe2bc'], g:[['soft-light','#ff6a10',.55]], fx:'🍂'},
  dusk:{sky:['#3a3a8a','#e8707a','#ffc27a'], g:[['soft-light','#ff4a2a',.5],['multiply','#ffaa80',.35]], fx:'✨', lamps:1},
  snow:{sky:['#8fb2d8','#cfdff0','#f2f7ff'], g:[['saturation','#808080',.45],['screen','#d8e8ff',.35]], fx:'❄️'},
  sakura:{sky:['#6aa8ec','#f7c6dc','#fff0f6'], g:[['soft-light','#ff5aa8',.5]], fx:'🌸'},
  night:{sky:['#070b24','#15204e','#2a3570'], g:[['multiply','#2c3a86',.6]], fx:'✨', lamps:1, stars:1},
  candy:{sky:['#a98af0','#f7b6e6','#ffe6f6'], g:[['hue','#ff40d0',.3],['soft-light','#ffb0f0',.35]], fx:'🫧'},
};
function setToneConfig(list){ if(list){ TONES=list; TONE={}; list.forEach(t=>TONE[t.id]=t); } }
let toneCur=null;
function applyTone(id){
  id = TONE_FX[id] ? id : 'spring'; if(id===toneCur) return; toneCur=id;
  const t=TONE_FX[id], W=$('world'); if(!W) return;
  const st=W.querySelectorAll('#gSky stop'); t.sky.forEach((c,i)=>{ if(st[i]) st[i].setAttribute('stop-color', c); });
  const L=$('toneL'); if(L) L.innerHTML = t.g.map(([m,c,a])=>`<rect x="-2000" y="-2000" width="6000" height="6000" fill="${c}" opacity="${a}" style="mix-blend-mode:${m}"/>`).join('');
  document.body.classList.toggle('night', !!t.lamps);
  const S2=$('starL'); if(S2) S2.innerHTML = t.stars ? Array.from({length:40},(_,k)=>`<circle class="twk" style="animation-delay:-${(k*0.37%3).toFixed(2)}s" cx="${(k*97)%1700-60}" cy="${(k*53)%260-80}" r="${1+(k%3)*0.6}" fill="#fff"/>`).join('') : '';
  let fx=$('tfx'); if(!fx){ fx=document.createElement('div'); fx.id='tfx'; document.body.appendChild(fx); }
  fx.innerHTML = t.fx ? Array.from({length:14},(_,k)=>`<span style="left:${(k*7.3)%100}%;animation-duration:${9+(k*1.7)%7}s;animation-delay:-${(k*1.3)%9}s;font-size:${12+(k%3)*4}px">${t.fx}</span>`).join('') : '';
}

/* ================= 商店（裝飾、外觀、色調、裝備都在這裡） ================= */
const SHOP_TABS = [['decor','🎨 裝飾'],['mine','📦 我的裝飾'],['skin','🏠 建築外觀'],['tone','🌈 城鎮色調'],['gear','🐾 萌獸裝備']];
const shopTitle = () => `商店　<span style="font-size:14px;color:var(--ink2)">${S.me.gold.toLocaleString()} 金・💎${(S.me.gems||0).toLocaleString()}</span>`;
const shopNav = cur => `<div class="snav">${SHOP_TABS.map(([k,n])=>`<button data-snav="${k}" class="${k===cur?'on':''}">${n}</button>`).join('')}</div>`;
function bindShopNav(){ document.querySelectorAll('[data-snav]').forEach(b=>b.onclick=()=>openShopTab(b.dataset.snav)); }
function openShopTab(k){
  if(k==='decor') return openDecorShop('shop');
  if(k==='mine') return openDecorShop('mine');
  if(k==='skin') return openSkinShop();
  if(k==='tone') return openToneShop();
  if(k==='gear') return openGearShop();
}
function openToneShop(){
  if(mode==='visit') return toast('回到自己的農場才能換色調');
  const me=S.me, own=me.tones||{}, cur=me.tone||'spring';
  let body = shopNav('tone') + `<div class="skgrid">${TONES.map(t=>{ const fx=TONE_FX[t.id]||TONE_FX.spring, have=t.id==='spring'||own[t.id], on=t.id===cur;
    const cost=t.gold!=null?`${t.gold.toLocaleString()} 金`:t.gems!=null?`💎${t.gems}`:'';
    const poor=t.gold!=null?me.gold<t.gold:(me.gems||0)<(t.gems||0);
    return `<div class="skcard${on?' on':''}"><div class="tsw" style="background:linear-gradient(${fx.sky[0]},${fx.sky[1]} 60%,${fx.sky[2]})"><span>${fx.fx||'🌼'}</span></div><b>${esc(t.name)}</b><small style="font-size:10px;font-weight:700;color:var(--ink2);min-height:2.4em">${esc(t.descr||'')}</small>
      ${on?'<span class="tag" style="background:#E8F8EE;color:#2E9660">使用中</span>':have?`<button class="mini" data-tuse="${t.id}">套用</button>`:`<button class="mini ${t.gems!=null?'gem':''}" data-tbuy="${t.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }).join('')}</div>
    <div class="rhint" style="text-align:center;margin-top:8px">色調會改變天空、整座島的色彩和飄落特效，買過可以隨時切換，好友來拜訪也看得到</div>`;
  modal(shopTitle(), body); bindShopNav();
  const md=$('md');
  md.querySelectorAll('[data-tuse]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_set_tone',{p_id:b.dataset.tuse})); refresh(); sfx('coin'); openToneShop(); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-tbuy]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_buy_tone',{p_id:b.dataset.tbuy})); refresh(); fxConfetti(); sfx('lvup'); toast('色調已套用！'); openToneShop(); }catch(e){ toast(e.message); } });
}
