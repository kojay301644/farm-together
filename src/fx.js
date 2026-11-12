
/* ================= 效能、設定 ================= */
const PREF = (k, d) => { try{ const v = localStorage.getItem('ytzt_'+k); return v===null ? d : v==='1'; }catch(e){ return d; } };
const SETPREF = (k, v) => { try{ localStorage.setItem('ytzt_'+k, v?'1':'0'); }catch(e){} };
let LOWFX = PREF('low', (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || (navigator.deviceMemory && navigator.deviceMemory <= 2));
let SFX_ON = PREF('sfx', true), VIB_ON = PREF('vib', true), BGM_ON = PREF('bgm', true);
/* 背景音樂：第一次點畫面後開始播（瀏覽器規定），切到背景自動暫停 */
let BGM = null;
function bgmSync(){
  if(typeof mjOn==='function' && mjOn()){ if(BGM) BGM.pause(); return; }   // 在麻將桌上：換成麻將音樂
  if(!BGM_ON || document.hidden){ if(BGM) BGM.pause(); return; }
  if(!BGM){ BGM = new Audio('assets/bgm.mp3?v='+(typeof BUILD!=='undefined'?BUILD:'')); BGM.loop = true; BGM.volume = 0.35; }
  const p = BGM.play(); if(p && p.catch) p.catch(()=>{});
}
addEventListener('pointerdown', ()=>{ if(BGM_ON && (!BGM || BGM.paused)) bgmSync(); }, {passive:true});
document.addEventListener('visibilitychange', bgmSync);
document.body.classList.toggle('lowfx', LOWFX);
/* 手機電量 20% 以下（沒在充電）自動開省電模式；充電或電量回到 30% 以上就恢復。玩家自己在設定開的不動。
   只有安卓 Chrome 抓得到電量，iPhone 抓不到就不會自動開 */
let LOW_AUTO = false;
try{ if(navigator.getBattery) navigator.getBattery().then(b=>{
  const chk = ()=>{
    if(PREF('low', false)) return;   // 自己開的省電模式不管
    const low = !b.charging && b.level <= 0.2, ok = b.charging || b.level >= 0.3;
    if(low && !LOWFX){ LOWFX = LOW_AUTO = true; document.body.classList.add('lowfx'); try{ toast('🔋 電量偏低，已自動開啟省電模式'); }catch(e){} }
    else if(ok && LOW_AUTO){ LOWFX = LOW_AUTO = false; document.body.classList.remove('lowfx'); }
  };
  chk(); b.addEventListener('levelchange', chk); b.addEventListener('chargingchange', chk);
}).catch(()=>{}); }catch(e){}

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
function fxWater(i){ try{farmerDo(i,'water');}catch(e){}
  sfx('water'); const [x,y]=plotXY(i);
  spawn(`<svg viewBox="0 0 32 32" width="46" height="46">${ICONS.water.replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg>`, x+26, y-58, 'can', 1100);
  if(LOWFX) return;
  for(let k=0;k<12;k++) spawn('', x-22+Math.random()*30, y-44+Math.random()*10, 'drop', 900, `animation-delay:${(k*0.05).toFixed(2)}s`);
  for(let k=0;k<2;k++) spawn('', x-8+k*14, y+2, 'ripple', 1000, `animation-delay:${0.35+k*0.15}s`);
}
function fxSeed(i){ try{farmerDo(i,'seed');}catch(e){}
  sfx('seed'); const [x,y]=plotXY(i);
  if(!LOWFX) for(let k=0;k<7;k++){ const dx=(Math.random()-0.5)*40; spawn('', x-50, y-70, 'seed', 800, `--dx:${50+dx}px;--dy:${70+(Math.random()-0.5)*10}px;animation-delay:${k*0.04}s`); }
  setTimeout(()=>fxDirt(i, true), LOWFX?0:450);
}
function fxDirt(i, quiet){ try{farmerDo(i,quiet?'':'dig');}catch(e){}
  if(!quiet) sfx('dig'); const [x,y]=plotXY(i);
  for(let k=0;k<(LOWFX?3:8);k++){ const a=Math.random()*Math.PI*2, r=18+Math.random()*16; spawn('', x, y, 'dirt', 700, `--dx:${Math.cos(a)*r}px;--dy:${Math.sin(a)*r*0.5-12}px`); }
}
function fxPoof(i, color){ try{farmerDo(i,color==='bug'?'bug':'weed');}catch(e){}
  sfx('poof'); const [x,y]=plotXY(i);
  for(let k=0;k<(LOWFX?3:8);k++){ const a=Math.random()*Math.PI*2, r=20+Math.random()*18; spawn('🍃', x, y-12, 'leaf', 800, `--dx:${Math.cos(a)*r}px;--dy:${Math.sin(a)*r-20}px;filter:${color==='bug'?'hue-rotate(60deg)':'none'}`); }
}
function fxHarvest(i, c, amt){ try{farmerDo(i,'harvest');}catch(e){}
  sfx('harvest'); vib(25); const [x,y]=plotXY(i);
  const ic = spawn(iconSVG(c), x-27, y-46, 'fly', 1100);
  const tgt = document.querySelector('[data-b="barn"]'); let tx=innerWidth-60, ty=60;
  if(tgt){ const r=tgt.getBoundingClientRect(); if(r.width && r.top>0 && r.top<innerHeight){ tx=r.left+r.width/2; ty=r.top+r.height/2; } }
  ic.style.setProperty('--tx', (tx-x)+'px'); ic.style.setProperty('--ty', (ty-y+40)+'px');
  if(!LOWFX) for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; spawn('✦', x, y-30, 'star', 700, `--dx:${Math.cos(a)*34}px;--dy:${Math.sin(a)*24}px`); }
}
function fxSteal(i, c){ try{farmerDo(i,'steal');}catch(e){}
  sfx('steal'); vib(15); const [x,y]=plotXY(i);
  spawn('<span style="font-size:38px">🫳</span>', x-19, y-80, 'grab', 900);
  const ic = spawn(iconSVG(c), x-27, y-46, 'fly', 1100, 'animation-delay:.35s'); ic.style.setProperty('--tx', (innerWidth-60-x)+'px'); ic.style.setProperty('--ty', (40-y)+'px');
}
function fxSmoke(i){ try{farmerDo(i,'prank');}catch(e){}
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
function dayNight(){ $('tint').style.background='transparent'; document.body.classList.remove('night'); }  // 不分日夜：永遠白天
dayNight();

/* ================= 頭像 ================= */
const avSrc = n => A("av"+(n||11));
const avImg = (o, cls='avatar sm') => `<img class="${cls} avimg${o&&o.frame?' fr '+o.frame:''}" src="${avSrc(o && o.avatar)}" alt="">`;
const ttlTag = o => o && o.title ? ` <span class="ttl">${esc(o.title)}</span>` : '';
function openAvatarPicker(){
  const cur = S.me.avatar||11;
  const nc=+(S.me.nick_changes||0), rc=+((typeof CFG_SET!=='undefined'&&CFG_SET.rename_gems)??100);
  modal('頭像・暱稱', `<div class="sec">✏️ 暱稱</div><div class="redeem nn"><input id="nnIn" maxlength="10" value="${esc(S.me.nickname)}" autocomplete="off"><button class="btn${nc>=1?' gem':''}" id="nnGo">${nc>=1?`💎${rc} 改名`:'免費改名'}</button></div>
    <div class="rhint">${nc>=1?`第一次改名已經用過了，之後每次改名要 💎${rc}`:'第一次改名免費，之後每次要 💎'+rc}</div><div class="sec">🖼️ 頭像</div><div class="avgrid">${Array.from({length:30},(_,k)=>`<img class="avpick${k+1===cur?' on':''}" data-av="${k+1}" src="${avSrc(k+1)}" alt="">`).join('')}</div>`);
  $('nnGo').onclick = async()=>{ const v=$('nnIn').value.trim(); if(!v) return toast('請輸入暱稱'); if(v===S.me.nickname) return toast('跟現在的暱稱一樣');
    const go = async()=>{ try{ applyState(await rpc('farm_rename',{p_nick:v})); refresh(); sfx('lvup'); toast(`暱稱改成「${v}」了！`); closeModal(); }catch(e){ toast(e.message); } };
    if(nc>=1) return modal('確定改名？', `<div style="text-align:center;font-weight:800;line-height:1.8">改成「${esc(v)}」<br>要花 💎${rc}</div>`, [['取消','sub',openAvatarPicker],[`💎${rc} 確定`,'',go]]);
    go(); };
  document.querySelectorAll('[data-av]').forEach(b=>b.onclick=async()=>{
    try{ applyState(await rpc('farm_set_avatar', {p_n:+b.dataset.av})); refresh(); sfx('coin'); toast('頭像已更換'); closeModal(); }catch(e){ toast(e.message); }
  });
}

/* ================= 讀取畫面 ================= */
(function preload(){
  const list = ['home_island','backdrop','b_shop','b_farm','b_academy','bc_shop','b_fountain','b_sail','dc_flower','dc_lamp','dc_hay','dc_balloon','c_bunny1','n_friends','i_coin','i_gem','bg_forest','av11'];
  let n=0; const done=()=>{ n++; $('ldbar').style.width = Math.round(n/list.length*100)+'%'; if(n>=list.length) finish(); };
  let fin=false; const finish=()=>{ if(fin) return; fin=true; $('loader').classList.add('hide'); setTimeout(()=>$('loader').remove(), 600); };
  list.forEach(k=>{ const im=new Image(); im.onload=im.onerror=done; im.src=A(k); });
  setTimeout(finish, 8000);
})();

/* ================= 被看門狗咬：全螢幕驚嚇動畫 =================
   一隻生氣的小狗在畫面中間低吼 → 張大嘴朝螢幕撲過來 → 咬下去（畫面震動、手機震動）→「汪！！」→ 淡出（不蓋背景） */
const DOG_SVG = `<svg viewBox="0 0 400 400" class="dbdog">
  <ellipse cx="200" cy="372" rx="120" ry="16" fill="rgba(0,0,0,.35)"/>
  <path d="M96 118 Q48 112 40 190 Q36 250 84 262 Q112 222 122 150 Z" fill="#7A4A26"/>
  <path d="M304 118 Q352 112 360 190 Q364 250 316 262 Q288 222 278 150 Z" fill="#7A4A26"/>
  <ellipse cx="200" cy="190" rx="122" ry="112" fill="#D99A5B"/>
  <ellipse cx="148" cy="132" rx="40" ry="34" fill="#F2D2A6"/>
  <path d="M112 128 L176 150" stroke="#3A2414" stroke-width="12" stroke-linecap="round"/>
  <path d="M288 128 L224 150" stroke="#3A2414" stroke-width="12" stroke-linecap="round"/>
  <ellipse cx="150" cy="168" rx="22" ry="20" fill="#FFF8EE"/><ellipse cx="250" cy="168" rx="22" ry="20" fill="#FFF8EE"/>
  <circle cx="156" cy="172" r="11" fill="#C81E1E"/><circle cx="244" cy="172" r="11" fill="#C81E1E"/>
  <circle cx="156" cy="172" r="5" fill="#1A0A0A"/><circle cx="244" cy="172" r="5" fill="#1A0A0A"/>
  <ellipse cx="200" cy="232" rx="78" ry="58" fill="#F2D2A6"/>
  <g class="mo">
    <path d="M140 236 Q200 214 260 236 Q262 318 200 334 Q138 318 140 236 Z" fill="#5A0D14"/>
    <path d="M168 300 Q200 336 232 300 Q226 326 200 330 Q174 326 168 300 Z" fill="#E86A7A"/>
    <path d="M146 238 L158 270 L170 240 Z M184 232 L192 252 L200 232 Z M200 232 L208 252 L216 232 Z M230 240 L242 270 L254 238 Z" fill="#FFF8EE"/>
    <path d="M152 316 L162 292 L172 322 Z M228 322 L238 292 L248 316 Z" fill="#FFF8EE"/>
  </g>
  <g class="mc">
    <path d="M146 262 Q172 278 200 262 Q228 278 254 262" fill="none" stroke="#3A2414" stroke-width="8" stroke-linecap="round"/>
    <path d="M162 266 L170 290 L178 270 Z M222 270 L230 290 L238 266 Z" fill="#FFF8EE" stroke="#3A2414" stroke-width="2"/>
  </g>
  <ellipse cx="200" cy="214" rx="26" ry="18" fill="#2A1A12"/><ellipse cx="192" cy="208" rx="8" ry="5" fill="#6B5446"/>
  <path d="M88 330 Q86 300 120 300 Q150 302 148 336 Q120 352 88 330 Z" fill="#D99A5B"/>
  <path d="M312 330 Q314 300 280 300 Q250 302 252 336 Q280 352 312 330 Z" fill="#D99A5B"/>
  <path d="M104 334 v-12 M120 338 v-14 M136 334 v-12 M296 334 v-12 M280 338 v-14 M264 334 v-12" stroke="#7A4A26" stroke-width="4" stroke-linecap="round"/>
  <path d="M52 92 l18 22 M28 140 l26 6 M348 92 l-18 22 M372 140 l-26 6" stroke="#FF5A4A" stroke-width="8" stroke-linecap="round" class="dbang"/>
</svg>`;
function dogBite(msg){
  try{
    const old = document.getElementById('dogBite'); if(old) old.remove();
    const mark = `<svg viewBox="0 0 240 160" class="dbmark">${[0,1,2,3,4,5].map(i => `<ellipse cx="${40 + i * 32}" cy="${44 - Math.sin(i / 5 * Math.PI) * 18}" rx="11" ry="15" fill="#7A0E16" opacity=".85"/>`).join('')}${[0,1,2,3,4,5].map(i => `<ellipse cx="${40 + i * 32}" cy="${118 + Math.sin(i / 5 * Math.PI) * 18}" rx="11" ry="15" fill="#7A0E16" opacity=".85"/>`).join('')}</svg>`;
    const d = document.createElement('div'); d.id = 'dogBite';
    d.innerHTML = `<div class="dbwrap">${DOG_SVG}</div><div class="dbtxt">汪！！</div><div class="dbmsg">${esc(msg || '被看門狗咬了！')}</div>`;
    document.body.appendChild(d);
    // 聲音：低吼 → 撲上來咬 → 兩聲狗叫
    if(SFX_ON){ noise(0.6, 220, 0.28); tone(90, 70, 0.6, 'sawtooth', 0.05);
      noise(0.08, 3200, 0.35, 0.72); tone(160, 60, 0.18, 'square', 0.12, 0.72);
      tone(720, 340, 0.13, 'sawtooth', 0.16, 0.88); noise(0.12, 1400, 0.18, 0.88);
      tone(680, 320, 0.15, 'sawtooth', 0.16, 1.08); noise(0.13, 1300, 0.18, 1.08); }
    setTimeout(() => { if(VIB_ON && navigator.vibrate) try{ navigator.vibrate([90, 50, 160, 60, 60]); }catch(e){}
      document.body.classList.add('dbshake'); setTimeout(() => document.body.classList.remove('dbshake'), 520); }, 720);
    setTimeout(() => d.classList.add('out'), 2300);
    setTimeout(() => d.remove(), 2700);
  }catch(e){}
}
