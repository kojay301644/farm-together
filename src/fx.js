
/* ================= 效能、設定 ================= */
const PREF = (k, d) => { try{ const v = localStorage.getItem('ytzt_'+k); return v===null ? d : v==='1'; }catch(e){ return d; } };
const SETPREF = (k, v) => { try{ localStorage.setItem('ytzt_'+k, v?'1':'0'); }catch(e){} };
let LOWFX = PREF('low', (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || (navigator.deviceMemory && navigator.deviceMemory <= 2));
let SFX_ON = PREF('sfx', true), VIB_ON = PREF('vib', true);
document.body.classList.toggle('lowfx', LOWFX);

/* ================= 音效（WebAudio 即時合成，不用音檔） ================= */
let AC = null;
function audio(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC && AC.state==='suspended') AC.resume(); return AC; }
addEventListener('pointerdown', ()=>{ if(SFX_ON) audio(); }, {once:true});
function tone(f1, f2, dur, type='sine', vol=0.18, delay=0){
  const a=audio(); if(!a) return; const t=a.currentTime+delay;
  const o=a.createOscillator(), g=a.createGain(); o.type=type;
  o.frequency.setValueAtTime(f1,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t+dur+0.02);
}
function noise(dur, freq, vol=0.15, delay=0){
  const a=audio(); if(!a) return; const t=a.currentTime+delay;
  const b=a.createBuffer(1, a.sampleRate*dur, a.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=a.createBufferSource(); s.buffer=b; const f=a.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq; f.Q.value=0.8;
  const g=a.createGain(); g.gain.value=vol; s.connect(f).connect(g).connect(a.destination); s.start(t);
}
function sfx(n){
  if(!SFX_ON) return;
  try{
    if(n==='water'){ noise(0.5, 1800, 0.22); noise(0.35, 900, 0.12, 0.15); }
    else if(n==='seed'){ [0,0.07,0.14].forEach(d=>tone(700+Math.random()*300, 1100, 0.07, 'triangle', 0.12, d)); }
    else if(n==='harvest'){ tone(420, 880, 0.12, 'sine', 0.22); tone(1320, 0, 0.18, 'triangle', 0.12, 0.1); }
    else if(n==='coin'){ tone(1320, 0, 0.09, 'square', 0.07); tone(1760, 0, 0.16, 'square', 0.07, 0.08); }
    else if(n==='steal'){ noise(0.25, 2500, 0.15); tone(900, 500, 0.18, 'triangle', 0.12, 0.05); tone(1200, 0, 0.12, 'triangle', 0.1, 0.2); }
    else if(n==='prank'){ tone(300, 180, 0.3, 'sawtooth', 0.06); tone(240, 140, 0.3, 'sawtooth', 0.05, 0.12); }
    else if(n==='poof'){ noise(0.18, 1200, 0.15); tone(600, 300, 0.12, 'sine', 0.08); }
    else if(n==='lvup'){ [523,659,784,1047].forEach((f,k)=>tone(f, 0, 0.22, 'triangle', 0.14, k*0.1)); }
    else if(n==='dig'){ noise(0.2, 400, 0.25); }
    else if(n==='tap'){ tone(900, 0, 0.04, 'sine', 0.06); }
    else if(n==='err'){ tone(220, 180, 0.15, 'square', 0.05); }
  }catch(e){}
}
function vib(ms){ if(VIB_ON && navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} }

/* ================= 特效（畫面座標） ================= */
const FX = $('fx');
function plotXY(i){ const el = plotEls[i] && plotEls[i].querySelector('.pg'); if(!el) return [innerWidth/2, innerHeight/2]; const r = el.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; }
function spawn(html, x, y, cls, life=1200, style=''){
  const d=document.createElement('div'); d.className='fxp '+(cls||''); d.innerHTML=html; d.style.cssText=`left:${x}px;top:${y}px;${style}`;
  FX.appendChild(d); setTimeout(()=>d.remove(), life); return d;
}
function fxWater(i){
  sfx('water'); const [x,y]=plotXY(i);
  spawn(`<svg viewBox="0 0 32 32" width="46" height="46">${ICONS.water.replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg>`, x+26, y-58, 'can', 1100);
  if(LOWFX) return;
  for(let k=0;k<12;k++) spawn('', x-22+Math.random()*30, y-44+Math.random()*10, 'drop', 900, `animation-delay:${(k*0.05).toFixed(2)}s`);
  for(let k=0;k<2;k++) spawn('', x-8+k*14, y+2, 'ripple', 1000, `animation-delay:${0.35+k*0.15}s`);
}
function fxSeed(i){
  sfx('seed'); const [x,y]=plotXY(i);
  if(!LOWFX) for(let k=0;k<7;k++){ const dx=(Math.random()-0.5)*40; spawn('', x-50, y-70, 'seed', 800, `--dx:${50+dx}px;--dy:${70+(Math.random()-0.5)*10}px;animation-delay:${k*0.04}s`); }
  setTimeout(()=>fxDirt(i, true), LOWFX?0:450);
}
function fxDirt(i, quiet){
  if(!quiet) sfx('dig'); const [x,y]=plotXY(i);
  for(let k=0;k<(LOWFX?3:8);k++){ const a=Math.random()*Math.PI*2, r=18+Math.random()*16; spawn('', x, y, 'dirt', 700, `--dx:${Math.cos(a)*r}px;--dy:${Math.sin(a)*r*0.5-12}px`); }
}
function fxPoof(i, color){
  sfx('poof'); const [x,y]=plotXY(i);
  for(let k=0;k<(LOWFX?3:8);k++){ const a=Math.random()*Math.PI*2, r=20+Math.random()*18; spawn('🍃', x, y-12, 'leaf', 800, `--dx:${Math.cos(a)*r}px;--dy:${Math.sin(a)*r-20}px;filter:${color==='bug'?'hue-rotate(60deg)':'none'}`); }
}
function fxHarvest(i, c, amt){
  sfx('harvest'); vib(25); const [x,y]=plotXY(i);
  const ic = spawn(iconSVG(c), x-27, y-46, 'fly', 1100);
  const tgt = document.querySelector('[data-b="barn"]'); let tx=innerWidth-60, ty=60;
  if(tgt){ const r=tgt.getBoundingClientRect(); if(r.width && r.top>0 && r.top<innerHeight){ tx=r.left+r.width/2; ty=r.top+r.height/2; } }
  ic.style.setProperty('--tx', (tx-x)+'px'); ic.style.setProperty('--ty', (ty-y+40)+'px');
  if(!LOWFX) for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; spawn('✦', x, y-30, 'star', 700, `--dx:${Math.cos(a)*34}px;--dy:${Math.sin(a)*24}px`); }
}
function fxSteal(i, c){
  sfx('steal'); vib(15); const [x,y]=plotXY(i);
  spawn('<span style="font-size:38px">🫳</span>', x-19, y-80, 'grab', 900);
  const ic = spawn(iconSVG(c), x-27, y-46, 'fly', 1100, 'animation-delay:.35s'); ic.style.setProperty('--tx', (innerWidth-60-x)+'px'); ic.style.setProperty('--ty', (40-y)+'px');
}
function fxSmoke(i){
  sfx('prank'); const [x,y]=plotXY(i);
  for(let k=0;k<(LOWFX?3:7);k++) spawn('', x-14+Math.random()*28, y-20+Math.random()*10, 'smoke2', 1000, `animation-delay:${k*0.06}s`);
  spawn('<span style="font-size:26px">😈</span>', x-13, y-60, 'pop', 1000);
}
function fxConfetti(){
  sfx('lvup'); vib([30,40,30]);
  if(LOWFX) return;
  const cols=['#FF9F43','#3BB273','#F2545B','#3DA5F4','#FFE066','#B9A6FF'];
  for(let k=0;k<60;k++) spawn('', Math.random()*innerWidth, -20, 'conf', 2600, `background:${cols[k%6]};--dx:${(Math.random()-0.5)*160}px;--r:${Math.random()*720}deg;animation-delay:${Math.random()*0.5}s;animation-duration:${1.8+Math.random()}s`);
}
// 數字跳動
function tweenNum(el, to){
  if(!el) return; const from = +(el.dataset.v||to); el.dataset.v = to;
  if(from===to || LOWFX){ el.textContent = to.toLocaleString(); return; }
  const t0=performance.now(), d=600; el.parentElement && el.parentElement.classList.add('bump');
  const step=n=>{ const p=Math.min(1,(n-t0)/d); el.textContent=Math.round(from+(to-from)*(1-Math.pow(1-p,3))).toLocaleString(); if(p<1) requestAnimationFrame(step); else el.parentElement && el.parentElement.classList.remove('bump'); };
  requestAnimationFrame(step);
}

/* ================= 日夜變化（依手機時間） ================= */
function dayNight(){
  let h = new Date().getHours() + new Date().getMinutes()/60;
  const q = new URLSearchParams(location.search).get('hour'); if(q!==null) h = +q;
  let tint='transparent', night=false;
  if(h>=19 || h<5){ tint='rgba(52,62,140,.5)'; night=true; }
  else if(h>=17){ tint='rgba(255,150,80,.28)'; night = h>=18.3; }
  else if(h<7){ tint='rgba(255,190,160,.25)'; night = h<6; }
  $('tint').style.background = tint;
  document.body.classList.toggle('night', night);
}
dayNight(); setInterval(dayNight, 60000);

/* ================= 頭像 ================= */
const avSrc = n => `assets/av${n||11}.webp`;
const avImg = (o, cls='avatar sm') => `<img class="${cls} avimg" src="${avSrc(o && o.avatar)}" alt="">`;
function openAvatarPicker(){
  const cur = S.me.avatar||11;
  modal('選擇頭像', `<div class="avgrid">${Array.from({length:30},(_,k)=>`<img class="avpick${k+1===cur?' on':''}" data-av="${k+1}" src="${avSrc(k+1)}" alt="">`).join('')}</div>`);
  document.querySelectorAll('[data-av]').forEach(b=>b.onclick=async()=>{
    try{ applyState(await rpc('farm_set_avatar', {p_n:+b.dataset.av})); refresh(); sfx('coin'); toast('頭像已更換'); closeModal(); }catch(e){ toast(e.message); }
  });
}

/* ================= 讀取畫面 ================= */
(function preload(){
  const list = ['b_shop','b_farm','b_academy','bc_shop','b_fountain','b_sail','dc_flower','dc_lamp','dc_bench','dc_pond','dc_hay','dc_mail','dc_kennel','dc_lantree','dc_swing','dc_sakura','dc_picnic','dc_balloon','bunny1','bear1','fox1','penguin1','n_friends','i_coin','i_gem','bg_forest','av11'];
  let n=0; const done=()=>{ n++; $('ldbar').style.width = Math.round(n/list.length*100)+'%'; if(n>=list.length) finish(); };
  let fin=false; const finish=()=>{ if(fin) return; fin=true; $('loader').classList.add('hide'); setTimeout(()=>$('loader').remove(), 600); };
  list.forEach(k=>{ const im=new Image(); im.onload=im.onerror=done; im.src=`assets/${k}.webp`; });
  setTimeout(finish, 8000);
})();
