
/* ================= 城鎮色調 ================= */
let TONES = [], TONE = {};
/* 以下色調資料與上色演算法直接沿用萌獸星球 */
const TONE_FX = {
  spring:{sky:['#3f9be8','#8fcdfb','#d6efff'], g:[]},
  autumn:{sky:['#4a8fd8','#f2c48e','#ffe2bc'], px:'autumn', g:[['soft-light','#ff6a10',.8]], fx:'leaf'},
  dusk:{sky:['#3a3a8a','#e8707a','#ffc27a'], g:[['soft-light','#ff4a2a',.65],['multiply','#ffaa80',.5]], lamps:.55, fx:'ember'},
  snow:{sky:['#8fb2d8','#cfdff0','#f2f7ff'], px:'snow', g:[['saturation','#808080',.6],['screen','#d8e8ff',.4]], fx:'snow'},
  sakura:{sky:['#6aa8ec','#f7c6dc','#fff0f6'], px:'sakura', g:[['soft-light','#ff5aa8',.7]], fx:'petal'},
  night:{sky:['#070b24','#15204e','#2a3570'], g:[], post:['multiply','#2c3a86',.82], lamps:1, fx:'firefly', stars:1},
  candy:{sky:['#a98af0','#f7b6e6','#ffe6f6'], px:'candy', g:[['hue','#ff40d0',.5],['soft-light','#ffb0f0',.4]], fx:'bubble'},
};
const TONE_ICON={leaf:'🍁',ember:'🔥',snow:'❄️',petal:'🌸',firefly:'✨',bubble:'🫧'};
function setToneConfig(list){ if(list){ TONES=list; TONE={}; list.forEach(t=>TONE[t.id]=t); } }
function _rgb2hsl(t,e,s){t/=255,e/=255,s/=255;const n=Math.max(t,e,s),a=Math.min(t,e,s),i=(n+a)/2;if(n===a)return[0,0,i];const r=n-a,c=i>.5?r/(2-n-a):r/(n+a);return[(n===t?(e-s)/r+(e<s?6:0):n===e?(s-t)/r+2:(t-e)/r+4)*60,c,i]}
function _hsl2rgb(t,e,s){if(t=(t%360+360)%360/360,!e){const r=s*255;return[r,r,r]}const n=s<.5?s*(1+e):s+e-s*e,a=2*s-n,i=r=>(r<0&&(r+=1),r>1&&(r-=1),r<1/6?a+(n-a)*6*r:r<1/2?n:r<2/3?a+(n-a)*(2/3-r)*6:a);return[i(t+1/3)*255,i(t)*255,i(t-1/3)*255]}
function _recolor(cv,e){const s=cv.getContext('2d'),n=s.getImageData(0,0,cv.width,cv.height),a=n.data;for(let r=0;r<a.length;r+=4){if(a[r+3]<8)continue;let[c,d,f]=_rgb2hsl(a[r],a[r+1],a[r+2]);const u=c>55&&c<170&&d>.18;e==='autumn'?u&&(f<.5?(c=4+52*f,d=Math.min(1,d*1.1+.08),f=f*.98):(c=44+(c-55)*.08,d=d*.75,f=f*.98)):e==='sakura'?u&&(f<.44?(c=338,d=Math.min(.85,d*.75+.12),f=Math.min(.84,f*1.45+.14)):(c=c*.9+5,d*=.8)):e==='snow'?u||c>25&&c<55&&d>.25&&f>.35?(d*=.2,f=Math.min(.97,.5+f*.55),c=210):(d*=.88,f=Math.min(1,f*1.02+.01)):e==='candy'&&(u?f<.44?(c=290+30*f,d=Math.min(.8,d*.8+.15),f=Math.min(.82,f*1.35+.15)):(c=150+(c-55)*.3,d=d*.6,f=Math.min(.9,f*1.08+.06)):f>.15&&(d=Math.min(1,d*.9),f=Math.min(.94,f*1.06+.05)));const[p,h,b]=_hsl2rgb(c,d,f);a[r]=p,a[r+1]=h,a[r+2]=b}s.putImageData(n,0,0)}
/* 把一張圖套上色調（跟萌獸星球的 Xn 一樣：先換植物顏色，再疊色，最後依原圖透明度裁切） */
const _toneCache=new Map(); let _toneQ=Promise.resolve();
/* 大圖（島嶼、遠景、草地）預先算好四款植物變色版本，放在 assets/ */
const TONE_PRE=['home_island','backdrop','grass_tile'];
function tonedURL(url,id){
  const t=TONE_FX[id]; if(!t||(!t.g.length&&!t.px)) return Promise.resolve(url);
  const key=id+'|'+url; if(_toneCache.has(key)) return _toneCache.get(key);
  const nm=(url.match(/assets\/([a-z0-9_]+)\.webp/)||[])[1];
  if(t.px && TONE_PRE.includes(nm)){ const pu=A(nm+'_'+t.px); _toneCache.set(key,Promise.resolve(pu)); return _toneCache.get(key); }
  const pr=_toneQ=_toneQ.then(()=>new Promise(res=>{ const im=new Image(); im.onload=()=>{ try{
      const cv=document.createElement('canvas'); cv.width=im.naturalWidth; cv.height=im.naturalHeight;
      const c=cv.getContext('2d',{willReadFrequently:true}); c.drawImage(im,0,0);
      if(t.px) _recolor(cv,t.px);
      else { for(const [m,col,al] of t.g){ c.globalCompositeOperation=m; c.globalAlpha=al; c.fillStyle=col; c.fillRect(0,0,cv.width,cv.height); }
        c.globalAlpha=1; c.globalCompositeOperation='destination-in'; c.drawImage(im,0,0); }
      cv.toBlob(b=>res(b?URL.createObjectURL(b):url),'image/webp',0.9);
    }catch(e){ res(url); } }; im.onerror=()=>res(url); im.src=url; }).then(u=>new Promise(r=>setTimeout(()=>r(u),16))));
  _toneCache.set(key,pr); return pr;
}
let toneCur='spring';
const _toneSkip=el=>el.closest('#movers,.gbadge,#labels');
function toneImage(el){
  if(_toneSkip(el)) return;
  const href=el.getAttribute('href')||''; if(href.startsWith('blob:')||/_(autumn|sakura|snow|candy)\.webp/.test(href)) return;
  el.dataset.o=href; const id=toneCur;
  const t=TONE_FX[id]; if(!t||(!t.g.length&&!t.px)) return;
  tonedURL(href,id).then(u=>{ if(u!==href && toneCur===id && el.dataset.o===href && el.getAttribute('href')===href) el.setAttribute('href',u); });
}
function toneAllImages(){
  const W=$('world'); if(!W) return;
  W.querySelectorAll('image').forEach(el=>{ const o=el.dataset.o, h=el.getAttribute('href')||'';
    if(o && h!==o){ el.dataset.o=''; el.setAttribute('href',o); } toneImage(el); });
}
let _toneObs=null;
function watchToneImages(){
  const W=$('world'); if(!W||W._toneObs) return;
  W._toneObs=new MutationObserver(ms=>{ for(const m of ms){
    if(m.type==='attributes'){ const el=m.target, h=el.getAttribute('href')||''; if(!h.startsWith('blob:') && h!==el.dataset.o && !/_(autumn|sakura|snow|candy)\.webp/.test(h)) toneImage(el); continue; }
    m.addedNodes.forEach(n=>{ if(n.nodeType!==1) return; if(n.tagName==='image') toneImage(n); else n.querySelectorAll&&n.querySelectorAll('image').forEach(toneImage); }); } });
  W._toneObs.observe(W,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
}
function applyTone(id){
  id = TONE_FX[id] ? id : 'spring'; const W=$('world'); if(!W) return;
  watchToneImages();
  const L0=$('toneL'); if(id===toneCur && L0 && L0.dataset.t===id) return; toneCur=id; if(L0) L0.dataset.t=id;
  const t=TONE_FX[id];
  const st=W.querySelectorAll('#gSky stop'); t.sky.forEach((c,i)=>{ if(st[i]) st[i].setAttribute('stop-color', c); });
  toneAllImages();
  const L=$('toneL'); if(L){
    let h = t.post ? `<rect x="-3000" y="-3000" width="8000" height="8000" fill="${t.post[1]}" opacity="${t.post[2]}" style="mix-blend-mode:${t.post[0]}"/>` : '';
    if(t.lamps){ h += `<defs><radialGradient id="gLampT"><stop offset="0" stop-color="rgb(255,200,110)" stop-opacity="${(.55*t.lamps).toFixed(2)}"/><stop offset="1" stop-color="rgb(255,140,50)" stop-opacity="0"/></radialGradient></defs>`;
      (typeof BLD!=='undefined'?BLD:[]).forEach(o=>{ if(o.skip||!o.c) return; const [x,y]=iso(o.c[0],o.c[1]); const r=Math.max(60,o.w*0.45); h+=`<circle class="tlamp" cx="${x.toFixed(0)}" cy="${(y-o.w*0.15).toFixed(0)}" r="${r.toFixed(0)}" fill="url(#gLampT)" style="mix-blend-mode:screen"/>`; }); }
    L.innerHTML=h; }
  document.body.classList.toggle('night', !!t.lamps);
  const S2=$('starL'); if(S2) S2.innerHTML='';
  toneFxStart(t);
}
/* 飄落特效：萌獸星球的 hm / pm 粒子 */
let _tfx=null;
function toneFxStart(t){
  let cv=$('tfx'); if(cv && cv.tagName!=='CANVAS'){ cv.remove(); cv=null; }
  if(!cv){ cv=document.createElement('canvas'); cv.id='tfx'; document.body.appendChild(cv); }
  _tfx={t, P:[], last:performance.now()};
  if(!toneFxStart._run){ toneFxStart._run=1; requestAnimationFrame(toneFxLoop); }
}
function toneFxLoop(now){
  requestAnimationFrame(toneFxLoop);
  const cv=$('tfx'); if(!cv||!_tfx) return;
  const dpr=Math.min(2,devicePixelRatio||1), O=innerWidth, z=innerHeight;
  if(cv.width!==Math.round(O*dpr)||cv.height!==Math.round(z*dpr)){ cv.width=Math.round(O*dpr); cv.height=Math.round(z*dpr); }
  const l=cv.getContext('2d'); l.setTransform(dpr,0,0,dpr,0,0); l.clearRect(0,0,O,z);
  const e=Math.min(.05,(now-_tfx.last)/1000); _tfx.last=now;
  const t=_tfx.t, w=Math.random, Ns=_tfx.P;
  if(t.stars){ l.fillStyle='#fff'; for(let s=0;s<70;s++){ const n=s*173.3%O, a=s*97.7%(z*.3), i=.4+.6*Math.abs(Math.sin(now/700+s)); l.globalAlpha=i*.9; l.fillRect(n,a,s%7?1.5:2.5,s%7?1.5:2.5); } l.globalAlpha=1; }
  const fx=t.fx; if(!fx) return;
  let cnt={snow:110,leaf:40,petal:55,firefly:34,bubble:24,ember:22}[fx]; if(typeof LOWFX!=='undefined'&&LOWFX) cnt=Math.round(cnt/3);
  while(Ns.length<cnt) Ns.push({x:w()*O,y:w()*z,v:w(),ph:w()*6,s:.5+w()}); Ns.length=cnt;
  for(const n of Ns){ n.ph+=e;
    fx==='snow'?(n.y+=(30+n.v*50)*e,n.x+=Math.sin(n.ph*1.3)*15*e):fx==='leaf'||fx==='petal'?(n.y+=(35+n.v*35)*e,n.x+=(Math.sin(n.ph*1.6)*40+20)*e):fx==='firefly'?(n.x+=Math.cos(n.ph*.7+n.v*6)*18*e,n.y+=Math.sin(n.ph*.9+n.v*3)*14*e):(n.y-=(25+n.v*30)*e,n.x+=Math.sin(n.ph*1.4)*12*e);
    if(n.y>z+20||n.y<-z*.6&&(fx==='bubble'||fx==='ember')||n.x>O+30){ n.x=w()*O; n.y=fx==='bubble'||fx==='ember'?z+10:-10; }
    if(fx==='firefly'&&(n.y<-20||n.x<-20)){ n.x=w()*O; n.y=w()*z; } }
  l.save();
  for(const s of Ns){
    if(fx==='snow'){ l.fillStyle='rgba(255,255,255,.9)'; l.beginPath(); l.arc(s.x,s.y,1.2+s.s*1.8,0,7); l.fill(); }
    else if(fx==='leaf'||fx==='petal'){ l.save(); l.translate(s.x,s.y); l.rotate(s.ph*2+s.v*6); l.scale(1,Math.cos(s.ph*3)); l.fillStyle=fx==='leaf'?['#e8541a','#f0a020','#c83a10'][Math.floor(s.v*3)]:['#ffc0dc','#ff9ac8','#fff0f6'][Math.floor(s.v*3)]; l.beginPath(); l.ellipse(0,0,5+s.s*4,2.5+s.s*2,0,0,7); l.fill(); l.restore(); }
    else if(fx==='firefly'||fx==='ember'){ l.globalCompositeOperation='lighter'; const n=.5+.5*Math.sin(s.ph*3+s.v*9), a=fx==='firefly'?10:6, i=l.createRadialGradient(s.x,s.y,0,s.x,s.y,a); i.addColorStop(0,fx==='firefly'?`rgba(230,255,140,${n})`:`rgba(255,190,90,${n})`); i.addColorStop(1,'rgba(255,200,80,0)'); l.fillStyle=i; l.fillRect(s.x-a,s.y-a,a*2,a*2); l.globalCompositeOperation='source-over'; }
    else { l.strokeStyle=['rgba(255,170,230,.8)','rgba(190,170,255,.8)','rgba(170,230,255,.8)'][Math.floor(s.v*3)]; l.lineWidth=2; l.beginPath(); l.arc(s.x,s.y,4+s.s*5,0,7); l.stroke(); } }
  l.restore();
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
    return `<div class="skcard${on?' on':''}"><div class="tsw" data-tpv="${t.id}" style="background:linear-gradient(${fx.sky[0]},${fx.sky[1]} 60%,${fx.sky[2]})"><img alt="" src="${A('home_island')}"><span>${TONE_ICON[fx.fx]||'🌼'}</span></div><b>${esc(t.name)}</b><small style="font-size:10px;font-weight:700;color:var(--ink2);min-height:2.4em">${esc(t.descr||'')}</small>
      ${on?'<span class="tag" style="background:#E8F8EE;color:#2E9660">使用中</span>':have?`<button class="mini" data-tuse="${t.id}">套用</button>`:`<button class="mini ${t.gems!=null?'gem':''}" data-tbuy="${t.id}" ${poor?'disabled':''}>${cost}</button>`}</div>`; }).join('')}</div>
    <div class="rhint" style="text-align:center;margin-top:8px">色調會改變天空、整座島的色彩和飄落特效，買過可以隨時切換，好友來拜訪也看得到</div>`;
  modal(shopTitle(), body); bindShopNav();
  const md=$('md');
  md.querySelectorAll('[data-tpv]').forEach(d=>{ const id=d.dataset.tpv, f=TONE_FX[id]||{}, im=d.querySelector('img');
    tonedURL(A('home_island'),id).then(u=>{ im.src=u; });
    if(f.post) d.insertAdjacentHTML('beforeend',`<i style="position:absolute;inset:0;background:${f.post[1]};opacity:${f.post[2]};mix-blend-mode:${f.post[0]}"></i>`); });
  md.querySelectorAll('[data-tuse]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_set_tone',{p_id:b.dataset.tuse})); refresh(); sfx('coin'); openToneShop(); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-tbuy]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_buy_tone',{p_id:b.dataset.tbuy})); refresh(); fxConfetti(); sfx('lvup'); toast('色調已套用！'); openToneShop(); }catch(e){ toast(e.message); } });
}
