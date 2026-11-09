
/* ================= 小鎮地圖：斜角座標 ================= */
const TW=72, TH=36, OX=680, OY=96, VX=-120, VY=-110, WW=1600, WH=1040;
const PAD={t:0,b:0,l:0,r:0};
const iso=(x,y)=>[OX+(x-y)*TW/2, OY+(x+y)*TH/2];
const P=a=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
const up=(p,h)=>[p[0],p[1]-h];
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const poly=(pts,f,extra='')=>`<polygon points="${P(pts)}" fill="${f}" ${extra}/>`;
const dia=(x,y,w,d)=>[iso(x,y),iso(x+w,y),iso(x+w,y+d),iso(x,y+d)];
let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
const A = n => `assets/${n}.webp`;

/* 田地位置（格座標，3 排 × 6 塊） */
const PS=1.45, PG=1.65;
const PLOTS=Array.from({length:18},(_,i)=>[4.35+(i%6)*PG, 6.75+Math.floor(i/6)*PG]);
const plotCenter=i=>iso(PLOTS[i][0]+PS/2, PLOTS[i][1]+PS/2);
const FARM_C=[9.2,9.2];

/* ================= 美術元件 ================= */
const INK='#4B3423';
function labelPill(x,y,text,opt={}){
  const w = text.length*13+26;
  const bg = opt.locked?'#E2DACB':(opt.bg||'#FFFFFF');
  const fg = opt.locked?'#7A6E5D':(opt.fg||'#3A3226');
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" style="pointer-events:none">
    <rect x="${-w/2}" y="-13" width="${w}" height="26" rx="13" fill="${bg}" stroke="${INK}" stroke-width="2"/>
    <path d="M-5 12.5 L0 18 L5 12.5" fill="${bg}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="10" width="12" height="3" fill="${bg}"/>
    <text x="0" y="5" text-anchor="middle" font-size="13" font-weight="900" fill="${fg}" font-family="Noto Sans TC,sans-serif">${opt.locked?'🔒 ':''}${text}</text></g>`;
}
// 圖片精靈：以格座標為底部中心
function sprite(name, gx, gy, w, opt={}){
  const [x,y]=iso(gx,gy), h=w*(opt.ratio||1);
  const yy = y - h*(opt.foot ?? 0.82);
  return `<image href="${A(name)}" x="${(x-w/2).toFixed(1)}" y="${yy.toFixed(1)}" width="${w}" height="${h.toFixed(1)}" ${opt.cls?`class="${opt.cls}"`:''}/>`;
}
const RATIO = {b_shop:690/627, b_farm:522/504, b_academy:690/645, bc_shop:690/594, b_fountain:690/591, b_sail:1,
  dc_flower:1, dc_lamp:1, dc_bench:1, dc_pond:1, dc_hay:1, dc_mail:1, dc_kennel:1, dc_lantree:1, dc_swing:1, dc_sakura:1, dc_picnic:1, dc_balloon:1,
  bunny1:396/310, bear1:1, fox1:1, penguin1:1, otter1:1, mouse1:1};

// 建築（萌獸星球素材），footprint 用來算前後順序與點擊
const BLD = [
  {id:'barn',  name:'穀倉',     img:'b_farm',     c:[2.8,2.6],  w:250, foot:0.80},
  {id:'shop',  name:'種子商店', img:'b_shop',     c:[7.4,2.85], w:225, foot:0.80},
  {id:'home',  name:'我的家',   img:'b_academy',  c:[11.9,2.6], w:235, foot:0.80},
  {id:'decor', name:'裝飾店',   img:'bc_shop',    c:[1.6,11.2], w:180, foot:0.80, locked:'裝飾店將在第四階段開放'},
  {id:'coop',  name:'牧場',     img:'dc_hay',     c:[11.6,13.0],w:84,  foot:0.78, locked:'牧場將在第四階段開放'},
];

// 描邊：把向量圖形加上粗咖啡色外框，統一成手繪風
function ol(s, w=2, c=INK){
  return s.replace(/<(circle|ellipse|rect|polygon|path)\b([^>]*?)(\/?)>/g, (m,tag,attrs,sl)=>{
    if(/stroke=|fill="none"|rgba\(0,0,0|class="nool"|opacity=/.test(attrs)) return m;
    return `<${tag}${attrs} stroke="${c}" stroke-width="${w}" stroke-linejoin="round"${sl}>`;
  });
}

function tree(gx,gy,k=1,still,dark){ const [x,y]=iso(gx,gy); const d=(-(gx*0.7+gy*0.3)%4).toFixed(2); const c1=dark?'#3F9A3E':'#4FA845', c2=dark?'#4CA845':'#5DB54A';
  return {depth:gx+gy, svg:`<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="2" rx="18" ry="7" fill="rgba(0,0,0,.15)"/>
    ${ol(`<path d="M-4 2 L-3 -22 Q0 -26 3 -22 L4 2Z" fill="#9C6B43"/>`,2.2)}
    <g${still?'':` class="tsway" style="animation-delay:${d}s"`}>${ol(`<circle cx="-11" cy="-27" r="13" fill="${c1}"/><circle cx="11" cy="-29" r="14" fill="${c1}"/><circle cx="0" cy="-40" r="18" fill="${c2}"/>`,2.4,'#2F6B2A')}
    <circle class="nool" cx="-6" cy="-46" r="7" fill="#8ED46B" opacity=".75"/><circle class="nool" cx="8" cy="-34" r="4" fill="#8ED46B" opacity=".6"/><circle class="nool" cx="-14" cy="-30" r="3.5" fill="#8ED46B" opacity=".6"/></g></g>`}; }
function bush(gx,gy,fc){ const [x,y]=iso(gx,gy); return {depth:gx+gy, svg:`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="1" rx="15" ry="5" fill="rgba(0,0,0,.14)"/>
  ${ol(`<circle cx="-7" cy="-6" r="8" fill="#55AE45"/><circle cx="7" cy="-6" r="8" fill="#55AE45"/><circle cx="0" cy="-11" r="9" fill="#66C255"/>`,2,'#2F6B2A')}
  ${fc?[[-6,-11],[5,-14],[8,-5],[-2,-4]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="2.6" fill="${fc}" stroke="${INK}" stroke-width="1"/>`).join(''):''}</g>`}; }
function board(gx,gy){ const [x,y]=iso(gx,gy); return {depth:gx+gy, svg:`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="2" rx="28" ry="8" fill="rgba(0,0,0,.14)"/>
  ${ol(`<rect x="-22" y="-38" width="5" height="40" rx="2" fill="#9C6B43"/><rect x="17" y="-38" width="5" height="40" rx="2" fill="#9C6B43"/><rect x="-27" y="-46" width="54" height="34" rx="5" fill="#C98B5E"/><rect x="-22" y="-41" width="44" height="24" rx="3" fill="#EBC9A0"/>
  <rect x="-18" y="-38" width="12" height="14" fill="#fff" transform="rotate(-5 -12 -30)"/><rect x="-2" y="-39" width="12" height="10" fill="#FFF6C9"/><rect x="11" y="-34" width="8" height="12" fill="#D9F2FF" transform="rotate(6 15 -27)"/><path d="M-31 -46 L0 -57 L31 -46Z" fill="#8B5E3C"/>`,2.2)}
  <image href="${A('n_friends')}" x="-17" y="-80" width="34" height="34"/></g>`}; }

function personSVG(o){
  const skin=o.skin||'#FFD7B5', pants=o.pants||'#4A6FA5';
  return ol(`<ellipse class="nool" cx="0" cy="1" rx="9" ry="3.5" fill="rgba(0,0,0,.18)"/>
  <rect class="lg1" x="-5" y="-11" width="4" height="11" rx="2" fill="${pants}"/><rect class="lg2" x="1" y="-11" width="4" height="11" rx="2" fill="${pants}"/>
  <g class="bd"><rect x="-7.5" y="-23" width="15" height="14" rx="5" fill="${o.shirt}"/>
  ${o.overall?`<rect x="-6" y="-17" width="12" height="8" rx="2" fill="${o.overall}"/>`:''}
  <circle cx="0" cy="-30" r="8.5" fill="${skin}"/>
  <path d="M-8.5 -29 Q-9 -41 0 -40 Q9 -41 8.5 -29 Q5 -35 -1 -35 Q-6 -35 -8.5 -29Z" fill="${o.hair}"/>
  <circle class="nool" cx="2.5" cy="-29" r="1.3" fill="#3A3226"/><circle class="nool" cx="6.2" cy="-29" r="1.3" fill="#3A3226"/>
  <circle class="nool" cx="4.5" cy="-25.8" r="1.7" fill="#FF9AA2" opacity=".8"/>
  ${o.hat?`<ellipse cx="0" cy="-36" rx="14" ry="4" fill="#E8C766"/><path d="M-7.5 -36 Q-7 -46 0 -46 Q7 -46 7.5 -36Z" fill="#F2D57E"/><rect x="-7.5" y="-39" width="15" height="2.6" fill="#E2574C"/>`:''}
  ${o.tool==='hoe'?`<path d="M-9 -20 L-14 -46" stroke="#A86F45" stroke-width="2.5" stroke-linecap="round"/><path d="M-14 -46 l-6 2" stroke="#9AA6B2" stroke-width="4" stroke-linecap="round"/>`:''}</g>`, 1.4);
}
const CHICK = ol(`<ellipse class="nool" cy="1" rx="6" ry="2" fill="rgba(0,0,0,.15)"/><path d="M-2 -1 v2.5 M2 -1 v2.5" stroke="#F0A030" stroke-width="1.5"/><g class="bd"><ellipse cx="0" cy="-6" rx="7.5" ry="5.5" fill="#fff"/><circle cx="5" cy="-11" r="3.8" fill="#fff"/><path d="M3.5 -14.5 q1 -2.5 2 0 q1 -2.5 2.2 0z" fill="#F2545B"/><path d="M8.6 -11.2 l3.2 1 l-3.2 1z" fill="#F0A030"/><circle class="nool" cx="6.2" cy="-11.6" r=".9" fill="#333"/></g>`, 1.2);
const BUTTERFLY = c => `<g class="bfly"><ellipse cx="-4" cy="-2" rx="4.5" ry="3.5" fill="${c}" stroke="${INK}" stroke-width="1"/><ellipse cx="4" cy="-2" rx="4.5" ry="3.5" fill="${c}" stroke="${INK}" stroke-width="1"/><ellipse cx="-3" cy="2.5" rx="3" ry="2.5" fill="${c}" stroke="${INK}" stroke-width="1"/><ellipse cx="3" cy="2.5" rx="3" ry="2.5" fill="${c}" stroke="${INK}" stroke-width="1"/><rect x="-.8" y="-4" width="1.6" height="8" rx=".8" fill="${INK}"/></g>`;

/* ================= 組合地圖 ================= */
let plotEls=[], plotSig=[], plotLabs=[];
const movers=[];
let farmerMover=null, farmerAv=null;
const AV_SHIRT=['#7F9625','#A39697','#7D4017','#BC6B3A','#F2C380','#E39C6C','#5C344A','#3D251B','#C08B69','#5C4320','#CF8F5E','#362727','#C14943','#77571B','#CD4365','#D2DAF2','#A82C15','#53455F','#352828','#A5815D','#E9A83C','#724154','#CC814D','#F4B07A','#E9B644','#A7B5C9','#A85E2F','#D6A039','#B8B6AE','#B3556C'];
/* 大頭Q版人物：頭＝頭像圖 */
function charSVG(av){
  av = Math.min(30, Math.max(1, +av||11)); const sh = AV_SHIRT[av-1], id='avclip'+av, SK='#FBD7B5';
  const leg=x=>ol(`<rect x="${x-3}" y="-15" width="6" height="14" rx="3" fill="#5A3E28"/><ellipse cx="${x}" cy="-1.5" rx="5" ry="3" fill="#3B2A1E"/>`,2.2);
  const arm=x=>ol(`<ellipse cx="${x}" cy="-24.5" rx="4" ry="7.5" fill="${sh}"/><circle cx="${x}" cy="-16.5" r="3.4" fill="${SK}"/>`,2.2);
  return `<ellipse cx="0" cy="1" rx="14" ry="4.5" fill="rgba(0,0,0,.18)"/><g class="hop"><g class="ch">
    <g class="ch-lgL">${leg(-4.5)}</g><g class="ch-lgR">${leg(4.5)}</g>
    <g class="ch-up">
            ${ol(`<path d="M-11.5 -12 Q-13 -34 0 -35 Q13 -34 11.5 -12 Q0 -8 -11.5 -12Z" fill="${sh}"/>`,2.2)}
      <path d="M-6 -33 L0 -27 L6 -33" stroke="#fff" stroke-width="2.4" fill="none" opacity=".75"/>
      <g class="ch-hd">
        <clipPath id="${id}"><circle cx="0" cy="-55" r="21"/></clipPath>
        <circle cx="0" cy="-55" r="22.5" fill="#fff" stroke="${INK}" stroke-width="2.6"/>
        <image href="${avSrc(av)}" x="-27" y="-84" width="54" height="54" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>
        <ellipse cx="-8" cy="-68" rx="6" ry="3" fill="#fff" opacity=".35" transform="rotate(-25 -8 -68)"/>
      </g>
      <g class="ch-arL">${arm(-13)}</g><g class="ch-arR">${arm(13)}</g>
    </g></g></g>`;
}
/* 角色動作 */
function setAct(m, a){ if(m.act===a) return; if(m.act) m.el.classList.remove('a-'+m.act); m.act=a; if(a) m.el.classList.add('a-'+a); }
function emote(m, e){ if(!e || typeof spawn!=='function') return; const r=m.el.getBoundingClientRect(); if(!r.width) return;
  spawn(`<span>${e}</span>`, r.left+r.width/2-14, r.top-18, 'emo', 1500); }
const FARMER_ACT = {harvest:['work','✨'], water:['water','💧'], seed:['work','🌱'], dig:['work','💪'], weed:['work','👍'], bug:['work','👍'],
  steal:['angry','💢'], prank:['angry','😤'], help:['cheer','❤️']};
function farmerDo(i, kind){
  const m=farmerMover; if(!m || !kind) return;
  let [act,emo] = FARMER_ACT[kind] || ['work','✨'];
  if(typeof mode!=='undefined' && mode==='visit'){ // 好友的角色在原地反應
    if(kind!=='steal' && kind!=='prank') [act,emo]=FARMER_ACT.help;
    setAct(m,null); m.task={pos:[m.x,m.y], act, emo, dur:1.6, started:false}; return; }
  const P=PLOTS[i]; if(!P) return;
  m.task={pos:[P[0]+PS*0.5, P[1]+PS+0.12], act, emo, dur:1.5, started:false, look:[P[0]+PS/2,P[1]+PS/2]};
  setAct(m,null); m.wait=0; m.goal=null;
}
function setFarmer(av){ if(!farmerMover || farmerAv===av) return; farmerAv=av; farmerMover.el.firstChild.innerHTML = charSVG(av); }

function buildWorld(){
  const W=$('world');
  W.setAttribute('viewBox',`${VX} ${VY} ${WW} ${WH}`);
  seed=11;
  let defs='', sea='', island='', ground='', objs=[], lab='', cloud='';

  defs = `<defs>
    <linearGradient id="gGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A5DB72"/><stop offset="1" stop-color="#7EC452"/></linearGradient>
    <linearGradient id="gCliffL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C08A5A"/><stop offset="1" stop-color="#8E5E38"/></linearGradient>
    <linearGradient id="gCliffR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A2703F"/><stop offset="1" stop-color="#704526"/></linearGradient>
    <linearGradient id="gRiver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6FCBF2"/><stop offset="1" stop-color="#3FA6E0"/></linearGradient>
    <radialGradient id="gGlow"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".9"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient>
    <linearGradient id="gSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ADBF7"/><stop offset="1" stop-color="#6EC3EE"/></linearGradient>
  </defs>`;

  // 大草原（填滿畫面）
  sea += `<rect x="${VX-50}" y="${VY-50}" width="${WW+100}" height="${WH+100}" fill="url(#gGrass)"/>`;
  for(let k=0;k<70;k++){ const x=VX+rnd()*WW, y=VY+rnd()*WH; sea += `<ellipse cx="${x}" cy="${y}" rx="${40+rnd()*70}" ry="${16+rnd()*24}" fill="${rnd()<0.5?'#8FCD5E':'#B4E27F'}" opacity=".45"/>`; }
  // 草地色塊
  for(let k=0;k<20;k++){ const [x,y]=iso(rnd()*17-0.5, rnd()*17-0.5); island += `<ellipse cx="${x}" cy="${y}" rx="${30+rnd()*50}" ry="${12+rnd()*18}" fill="${rnd()<0.5?'#8FCD5E':'#B4E27F'}" opacity=".45"/>`; }
  // 草叢與小花
  for(let k=0;k<200;k++){ const gx=rnd()*30-7, gy=rnd()*30-7; const [x,y]=iso(gx,gy); if(x<VX||x>VX+WW||y<VY||y>VY+WH) continue;
    ground += rnd()<0.65 ? `<path class="tuft" style="animation-delay:-${(rnd()*3).toFixed(2)}s" d="M${x-4} ${y} l2 -7 l2 7 l2 -6 l2 6" stroke="#4E9A3A" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`
      : `<g><circle cx="${x}" cy="${y-2}" r="2.8" fill="${['#FFE066','#FFFFFF','#FF9AA2','#B9A6FF'][k%4]}" stroke="${INK}" stroke-width="1"/><circle cx="${x}" cy="${y-2}" r="1" fill="#F0A030"/></g>`; }

  // 小路（沙土＋石板）
  const path=(x,y,w,d)=>poly(dia(x,y,w,d),'#EAD5A3',`stroke="#B9965E" stroke-width="2.5" stroke-linejoin="round"`);
  ground += path(-16,5,48,1) + path(3,6,1,24) + path(7.2,4.1,0.8,0.9) + path(11.6,4,0.8,1) + path(2.6,4,0.8,1);
  for(let x=-15.6;x<31.8;x+=0.62){ const [px,py]=iso(x+0.1*rnd(), 5.5+(rnd()-0.5)*0.35); ground+=`<ellipse cx="${px}" cy="${py}" rx="${7+rnd()*3}" ry="${3.5+rnd()*1.5}" fill="#D8C08C" stroke="#A88A57" stroke-width="1.3"/>`; }
  for(let y=6.3;y<29.8;y+=0.62){ const [px,py]=iso(3.5+(rnd()-0.5)*0.35, y); ground+=`<ellipse cx="${px}" cy="${py}" rx="${7+rnd()*3}" ry="${3.5+rnd()*1.5}" fill="#D8C08C" stroke="#A88A57" stroke-width="1.3"/>`; }

  // 河
  ground += poly(dia(-16,14.15,48,1.3),'#9ADFF7',`stroke="${INK}" stroke-width="2.5"`) + poly(dia(-16,14.35,48,0.9),'url(#gRiver)');
  ground += `<path class="flow" d="M${P([iso(-16,14.65),iso(32,14.65)])}" stroke="#E3F6FF" stroke-width="2.5" opacity=".85"/><path class="flow" style="animation-delay:-1s" d="M${P([iso(-16,14.95),iso(32,14.95)])}" stroke="#E3F6FF" stroke-width="2" opacity=".6"/>`;
  for(let k=0;k<18;k++){ const [x,y]=iso(rnd()*40-14, 14.4+rnd()*0.8); ground+=`<ellipse class="wave" style="animation-delay:-${(rnd()*3).toFixed(1)}s" cx="${x}" cy="${y}" rx="5" ry="1.6" fill="#fff" opacity=".7"/>`; }
  // 橋
  ground += poly(dia(2.75,13.9,1.5,1.8),'#C98B5E',`stroke="${INK}" stroke-width="2.5"`);
  for(let k=1;k<6;k++){ ground+=`<path d="M${P([iso(2.75,13.9+k*0.3),iso(4.25,13.9+k*0.3)])}" stroke="#8B5E3C" stroke-width="2"/>`; }
  ground += `<path d="M${P([up(iso(2.75,13.9),9),up(iso(2.75,15.7),9)])} M${P([up(iso(4.25,13.9),9),up(iso(4.25,15.7),9)])}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M${P([up(iso(2.75,13.9),9),up(iso(2.75,15.7),9)])} M${P([up(iso(4.25,13.9),9),up(iso(4.25,15.7),9)])}" stroke="#A86F45" stroke-width="2" stroke-linecap="round"/>`;

  // 田區底＋木圍欄
  ground += poly(dia(4.1,6.5,10.15,5.35),'#97C964',`stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`);
  const fence=(x0,y0,x1,y1,col='#E8D3A2')=>{ let s=''; const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/0.55);
    const a=iso(x0,y0), b=iso(x1,y1); s+=`<path d="M${P([up(a,9),up(b,9)])} M${P([up(a,16),up(b,16)])}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M${P([up(a,9),up(b,9)])} M${P([up(a,16),up(b,16)])}" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/>`;
    for(let k=0;k<=n;k++){ const p=iso(x0+(x1-x0)*k/n, y0+(y1-y0)*k/n); s+=`<rect x="${p[0]-2.5}" y="${p[1]-21}" width="5" height="21" rx="2" fill="#F3E3BF" stroke="${INK}" stroke-width="1.5"/>`; } return s; };
  ground += fence(4.1,6.5,14.25,6.5,'#D9B98A') + fence(4.1,6.5,4.1,11.85,'#D9B98A');
  objs.push({depth:4.1+11.85+14.25+0.2, svg: fence(4.1,11.85,9.0,11.85,'#D9B98A')});

  // 牧場
  const RX=9.4,RY=12.1,RW=6.2,RD=1.9;
  ground += poly(dia(RX,RY,RW,RD),'#B2DB7A',`stroke="${INK}" stroke-width="2"`);
  ground += fence(RX,RY,RX+RW,RY) + fence(RX,RY,RX,RY+RD);
  objs.push({depth:RX+RW+RY+RD+0.5, svg: fence(RX,RY+RD,RX+RW,RY+RD) + fence(RX+RW,RY,RX+RW,RY+RD)});

  // 建築
  BLD.forEach(o=>{
    const [gx,gy]=o.c, h=o.w*(RATIO[o.img]||1);
    let s = `<ellipse cx="${iso(gx,gy)[0]}" cy="${iso(gx,gy)[1]+4}" rx="${o.w*0.42}" ry="${o.w*0.16}" fill="rgba(0,0,0,.14)"/>` + sprite(o.img, gx, gy, o.w, {ratio:RATIO[o.img], foot:o.foot});
    if(o.id==='barn'){ // 風車葉片
      const [x,y]=iso(gx,gy), top=y-h*o.foot; const cx=x-o.w*0.5+o.w*0.235, cy=top+h*0.2;
      s += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"><g class="blades"><image href="${A('b_sail')}" x="-55" y="-55" width="110" height="110"/></g></g>`;
    }
    if(o.id==='home'){ const [x,y]=iso(gx,gy), top=y-h*o.foot; s += `<circle class="smoke" cx="${x+o.w*0.24}" cy="${top+h*0.02}" r="6" fill="#fff" opacity=".75"/><circle class="smoke" style="animation-delay:1.5s" cx="${x+o.w*0.26}" cy="${top}" r="5" fill="#fff" opacity=".75"/>`; }
    objs.push({depth:gx+gy, svg:`<g class="tap" data-b="${o.id}">${s}</g>`});
    const [lx,ly]=iso(gx,gy);
    lab += labelPill(lx, ly - h*o.foot + (o.id==='coop'?4:18), o.name, {locked:!!o.locked, bg:o.id==='shop'?'#FFF1DC':null});
  });
  const bd=board(1.6,7.4); objs.push({depth:bd.depth, svg:`<g class="tap" data-b="board">${bd.svg}</g>`});
  lab += labelPill(iso(1.6,7.4)[0], iso(1.6,7.4)[1]-92, '好友布告欄', {bg:'#E3F6EA',fg:'#2E9660'});

  // 裝飾（萌獸星球素材）
  const deco=(n,gx,gy,w,extra='')=>objs.push({depth:gx+gy, svg:`<g ${extra}>${sprite(n,gx,gy,w,{ratio:RATIO[n],foot:0.8})}</g>`});
  const lamps=[[4.75,4.55],[9.75,4.6],[14.6,4.6],[2.4,10.0]];
  lamps.forEach(([x,y])=>{ deco('dc_lamp',x,y,48); const [px,py]=iso(x,y); objs.push({depth:x+y+0.01, svg:`<circle class="lampglow" cx="${px}" cy="${py-34}" r="30" fill="url(#gGlow)"/>`}); });
  deco('dc_fountain'in RATIO?'dc_fountain':'b_fountain', 16.1, 5.5, 118);
  deco('dc_bench', 13.0, 4.65, 62); deco('dc_mail', 14.0, 3.9, 44); deco('dc_kennel', 15.0, 2.6, 70);
  deco('dc_flower', 2.4, 8.9, 64); deco('dc_flower', 9.6, 0.3, 58); deco('dc_pond', 7.4, 16.0, 96);
  deco('dc_hay', 14.2, 12.9, 70); deco('dc_picnic', 14.8, 15.8, 76); deco('dc_balloon', -0.1, 9.3, 62, 'class="floaty"');
  deco('dc_sakura', 16.2, 1.9, 96); deco('dc_swing', -0.4, 7.4, 86); deco('dc_lantree', 5.0, 15.9, 90);

  // 外圍森林（填滿四周）
  const inView=(gx,gy,m=40)=>{ const [x,y]=iso(gx,gy); return x>VX-m && x<VX+WW+m && y>VY-m && y<VY+WH+m+60; };
  const onRoad=(gx,gy)=>(gy>4.6&&gy<6.4)||(gx>2.6&&gx<4.4&&gy>5)||(gy>13.9&&gy<15.7);
  for(let gx=-14;gx<32;gx+=1.25) for(let gy=-14;gy<32;gy+=1.25){
    const x=gx+(rnd()-0.5)*0.9, y=gy+(rnd()-0.5)*0.9;
    const out=Math.max(-1.6-x, -1.6-y, x-17.6, y-17.6); if(out<0 || !inView(x,y) || onRoad(x,y)) continue;
    const r=rnd();
    if(r<0.72) objs.push(tree(x,y,0.85+rnd()*0.45, true, out>2.5));
    else if(r<0.86) objs.push(bush(x,y,[null,'#FF9AA2','#FFFFFF','#FFE066'][Math.floor(rnd()*4)]));
  }
  // 樹木與花叢
  [[-0.4,3.4],[-0.3,13.2],[5,13.1],[7.6,13.3],[16,15.6],[13,16.2],[1.5,16.3],[15.6,-0.4],[4.9,-0.3],[9.4,-0.4],[-0.6,0.3],[16.6,11.2],[16.4,8.5]].forEach(([x,y],k)=>objs.push(tree(x,y,0.85+((k*37)%30)/100)));
  [[9.7,4.5,'#FF9AA2'],[15.6,10.4,'#FFFFFF'],[2.4,12.9,null],[8.3,4.6,'#FFE066']].forEach(([x,y,f])=>objs.push(bush(x,y,f)));

  // 田地（可點）
  PLOTS.forEach((_,i)=>{ objs.push({depth:PLOTS[i][0]+PLOTS[i][1]+PS, svg:`<g class="tap plot" data-p="${i}"><g class="pg"></g><g class="ps"></g></g>`}); });

  // 農夫與商店老闆
  const stand=(gx,gy,o,flip)=>{ const [x,y]=iso(gx,gy); objs.push({depth:gx+gy, svg:`<g transform="translate(${x} ${y}) scale(${flip?-1.2:1.2} 1.2)">${personSVG(o)}</g>`}); };

  objs.sort((a,b)=>a.depth-b.depth);

  // 雲
  for(let k=0;k<4;k++){ const y=40+k*150+rnd()*60, d=55+rnd()*40, s=0.8+rnd()*0.7;
    cloud+=`<g class="cloud" style="animation-duration:${d}s;animation-delay:${-rnd()*d}s"><g transform="translate(0 ${y}) scale(${s})" opacity=".8">${ol(`<ellipse cx="0" cy="0" rx="40" ry="14" fill="#fff"/><ellipse cx="18" cy="-10" rx="22" ry="14" fill="#fff"/><ellipse cx="-14" cy="-6" rx="16" ry="11" fill="#fff"/>`,2,'#BFDCEB')}</g></g>`; }
  // 飛鳥
  for(let k=0;k<2;k++) cloud += `<g class="bird" style="animation-delay:${-k*17}s"><g transform="translate(0 ${120+k*90})"><path d="M0 0 q6 -6 12 0 q6 -6 12 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path transform="translate(26 14) scale(.8)" d="M0 0 q6 -6 12 0 q6 -6 12 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/></g></g>`;

  W.innerHTML = `${defs}<g>${sea}</g><g>${island}</g><g>${ground}</g><g id="objs">${objs.map(o=>o.svg).join('')}</g><g id="movers"></g><g id="fxw"></g><g class="sky" style="pointer-events:none">${cloud}</g><g id="labels">${lab}<g id="plabs"></g></g>`;

  // 田地元素與標籤
  plotEls=[]; plotSig=[]; plotLabs=[];
  const pl=$('plabs');
  W.querySelectorAll('[data-p]').forEach(g=>{ const i=+g.dataset.p; plotEls[i]=g; plotSig[i]=''; g.addEventListener('click',()=>act(i)); });
  PLOTS.forEach((_,i)=>{ const [cx,cy]=plotCenter(i);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','plab'); g.setAttribute('transform',`translate(${cx} ${cy-44})`);
    g.innerHTML=`<rect x="-38" y="-11" width="76" height="22" rx="10" fill="#fff" stroke="${INK}" stroke-width="1.6"/><text x="0" y="2" text-anchor="middle" font-size="11" font-weight="900" fill="#3A3226" font-family="Noto Sans TC,sans-serif"></text><rect class="bb" x="-28" y="5" width="56" height="3" rx="1.5" fill="#EEE6D6"/><rect class="bf" x="-28" y="5" width="0" height="3" rx="1.5" fill="#7ED957"/>`;
    pl.appendChild(g); plotLabs[i]=g; });
  W.querySelectorAll('[data-b]').forEach(g=>g.addEventListener('click',()=>tapBuilding(g)));

  // 會動的萌寵、小雞、蝴蝶
  movers.length=0;
  const mv=$('movers');
  const addMover=(html,o)=>{ const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.innerHTML=`<g class="mvin">${html}</g>`; mv.appendChild(g); movers.push(Object.assign({el:g,wait:0,face:1},o)); };
  const pet=(n,w)=>{ const h=w*(RATIO[n]||1); return `<ellipse cx="0" cy="1" rx="${w*0.32}" ry="${w*0.1}" fill="rgba(0,0,0,.16)"/><g class="hop"><image href="${A(n)}" x="${-w/2}" y="${-h*0.96}" width="${w}" height="${h}"/></g>`; };
  // 農場主人（用頭像做的人物，自己家＝自己，拜訪＝好友）
  addMover('',{x:3.5,y:9,path:[[3.5,6.4],[3.5,13.3],[3.5,5.5],[8.6,5.5],[12.6,5.6],[7.4,5.5],[3.5,5.6],[0.6,5.5],[3.5,5.6]],tgt:1,speed:0.55,s:1.25,farmer:true});
  farmerMover=movers[movers.length-1]; farmerAv=null;
  for(let k=0;k<4;k++) addMover(CHICK,{x:RX+0.6+rnd()*(RW-1.2),y:RY+0.6+rnd()*(RD-1.0),chick:true,area:[RX+0.4,RY+0.5,RX+RW-1.6,RY+RD-0.3],speed:0.5,s:1.25,wait:rnd()*2});
  ['#FFD6E5','#FFE066','#BDE6FF'].forEach((c,k)=>addMover(BUTTERFLY(c),{x:5+k*3,y:8+k,fly:true,area:[3,6,15,12],speed:0.9,s:1.1,wait:rnd()}));
}

/* 農場主人的移動與動作 */
function farmerStep(m, dt){
  let moving=false;
  if(m.wait>0){ m.wait-=dt; if(m.wait<=0){ setAct(m,null); if(m.task && m.task.started) m.task=null; } }
  else {
    const goal = m.task ? m.task.pos : m.path[m.tgt];
    const dx=goal[0]-m.x, dy=goal[1]-m.y, dist=Math.hypot(dx,dy), step=(m.task?2.4:m.speed)*dt;
    if(dist<=step){ m.x=goal[0]; m.y=goal[1];
      if(m.task){ m.task.started=true; if(m.task.look){ const sd=(m.task.look[0]-m.x)-(m.task.look[1]-m.y); if(Math.abs(sd)>0.05) m.face=sd>0?1:-1; }
        setAct(m,m.task.act); m.wait=m.task.dur; emote(m,m.task.emo); }
      else { m.tgt=(m.tgt+1)%m.path.length; m.wait=1+Math.random()*3;
        const r=Math.random(); if(r<0.5) setAct(m, ['wave','stretch','look','wave'][Math.floor(Math.random()*4)]); }
    } else { m.x+=dx/dist*step; m.y+=dy/dist*step; moving=true; const sdx=dx-dy; if(Math.abs(sdx)>0.01) m.face=sdx>0?1:-1; }
  }
  const [sx,sy]=iso(m.x,m.y);
  m.el.setAttribute('transform',`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${m.face*m.s} ${m.s})`);
  if(m.moving!==moving){ m.moving=moving; m.el.classList.toggle('walk',moving); m.el.classList.toggle('run',moving && !!m.task); }
}
/* 移動動畫 */
let lastF=performance.now();
function animate(now){
  const dt=Math.min(0.1,(now-lastF)/1000); lastF=now;
  for(const m of movers){
    if(m.fly && LOWFX){ m.el.style.display='none'; continue; }
    if(m.farmer){ farmerStep(m, dt); continue; }
    let moving=false;
    if(m.wait>0){ m.wait-=dt; }
    else {
      if(!m.goal){
        if(m.chick || m.fly){ const a=m.area; m.goal=[a[0]+Math.random()*(a[2]-a[0]), a[1]+Math.random()*(a[3]-a[1])]; }
        else { m.goal=m.path[m.tgt]; }
      }
      const dx=m.goal[0]-m.x, dy=m.goal[1]-m.y, dist=Math.hypot(dx,dy), step=m.speed*dt;
      if(dist<=step){ m.x=m.goal[0]; m.y=m.goal[1]; m.goal=null;
        if(m.chick) m.wait=0.6+Math.random()*2.5; else if(m.fly) m.wait=Math.random()*0.6; else { m.tgt=(m.tgt+1)%m.path.length; m.wait=(m.farmer?0.8:1)+Math.random()*3; } }
      else { m.x+=dx/dist*step; m.y+=dy/dist*step; moving=true;
        const sdx=(dx-dy); if(Math.abs(sdx)>0.01) m.face = (sdx>0?1:-1) * (m.petFace||1); }
    }
    let [sx,sy]=iso(m.x,m.y); if(m.fly) sy -= 30 + Math.sin(now/400 + m.x)*8;
    m.el.setAttribute('transform',`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${m.face*m.s} ${m.s})`);
    if(m.moving!==moving){ m.moving=moving; m.el.classList.toggle('walk',moving); }
  }
  requestAnimationFrame(animate);
}

/* ================= 田地繪製 ================= */
const SPR=0.7;
function plotGroundSVG(p,i){
  const [x,y]=PLOTS[i], pts=dia(x,y,PS,PS), B=pts[1], C=pts[2], D=pts[3];
  let top='#9A6743', rim='#B98258', sl='#7A4E30', sr='#663F25';
  if(p.s==='wild'){ top='#7DB14C'; rim='#93C763'; sl='#8B5E3C'; sr='#76502F'; }
  else if(p.s==='grow'){ if(isDry(p)){ top='#C79563'; rim='#D8AA78'; } else { top='#6E4329'; rim='#845436'; } }
  const k=7;
  let s = poly([D,C,[C[0],C[1]+k],[D[0],D[1]+k]],sl,`stroke="${INK}" stroke-width="2"`) + poly([C,B,[B[0],B[1]+k],[C[0],C[1]+k]],sr,`stroke="${INK}" stroke-width="2"`)
        + poly(pts,top,`stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" class="soil"`);
  const inner=dia(x+0.08,y+0.08,PS-0.16,PS-0.16); s += `<path d="M${P([inner[3],inner[0],inner[1]])}" stroke="${rim}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  if(p.s!=='wild'){
    for(const t of [0.28,0.52,0.76]) s+=`<path d="M${P([iso(x+0.14,y+PS*t),iso(x+PS-0.14,y+PS*t)])}" stroke="rgba(40,22,10,.28)" stroke-width="4" stroke-linecap="round"/><path d="M${P([iso(x+0.14,y+PS*t-0.06),iso(x+PS-0.14,y+PS*t-0.06)])}" stroke="${rim}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`;
    const r=(i*13)%7; [[0.25,0.18],[1.1,0.4],[0.6,1.2],[1.25,1.15]].forEach(([a,b],k)=>{ if((k+r)%2) return; const [px,py]=iso(x+a,y+b); s+=`<ellipse cx="${px}" cy="${py}" rx="2.6" ry="1.6" fill="#C9B39A" stroke="${INK}" stroke-width=".8"/>`; });
  }
  if(p.s==='grow' && isDry(p)) s+=`<path d="M${P([iso(x+0.4,y+0.3),iso(x+0.6,y+0.5),iso(x+0.5,y+0.7)])} M${P([iso(x+1.0,y+0.95),iso(x+1.2,y+1.05),iso(x+1.15,y+1.25)])}" stroke="#8C6040" stroke-width="1.8" fill="none"/>`;
  return s;
}
function wildSign(i){ const l=LAND[i]; if(!l || mode==='visit' || !S) return '荒地'; return S.me.lv>=l.lv ? '可開墾' : `Lv${l.lv}`; }
function plotSpriteSVG(p,i){
  let body='';
  const dl = `style="animation-delay:-${((i*0.73)%3.2).toFixed(2)}s"`;
  if(p.s==='wild'){
    body = `<g class="wsway" ${dl}>${weedArt(30,80)}${weedArt(90,70)}${weedArt(56,64)}</g><ellipse cx="76" cy="84" rx="8" ry="5" fill="#B5AFA3" stroke="${INK}" stroke-width="1.5"/><ellipse class="nool" cx="74" cy="82" rx="4" ry="2" fill="#D9D4CB"/>
      <g transform="translate(36 22)"><rect x="22" y="14" width="5" height="28" rx="2" fill="#B07A4F" stroke="${INK}" stroke-width="1.6"/><rect x="0" y="0" width="50" height="21" rx="6" fill="#F3D9A8" stroke="${INK}" stroke-width="2"/><text x="25" y="15" font-size="11" font-weight="900" text-anchor="middle" fill="#8A5A34" font-family="Noto Sans TC,sans-serif">${wildSign(i)}</text></g>`;
  } else if(p.s==='grow'){
    const st=stageOf(p);
    body += `<g class="crop${st===4?'':' sway'}" ${dl}>${cropArt(CROP[p.c],st)}</g>`;
    for(let k=0;k<p.w;k++) body += `<g class="wsway" style="animation-delay:-${k*0.6}s">${weedArt(...WEED_POS[k])}</g>`;
    for(let k=0;k<p.b;k++) body += `<g class="crawl" style="animation-delay:-${k*0.45}s">${bugArt(...BUG_POS[k])}</g>`;
    if(st===4) body += `<g class="spark" fill="#FFF" stroke="${INK}" stroke-width="1"><path d="M100 22 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z"/><path d="M18 30 l1.4 4 l4 1.4 l-4 1.4 l-1.4 4 l-1.4 -4 l-4 -1.4 l4 -1.4z"/></g>`;
    if(isDry(p)) body += `<g class="drip" transform="translate(98 26)"><path d="M0 0 Q-8 11 0 15 Q8 11 0 0Z" fill="#3DA5F4" stroke="${INK}" stroke-width="1.5"/><path d="M-1 7 h2" stroke="#fff" stroke-width="1.5"/></g>`;
  } else if(p.s==='dead') body = deadArt;
  const [cx,cy]=plotCenter(i);
  return `<g transform="translate(${(cx-60*SPR).toFixed(1)} ${(cy-74*SPR).toFixed(1)}) scale(${SPR})">${body}</g>`;
}
/* ================= 地圖縮放與拖曳 ================= */
const map=$('map'), world=$('world');
let scale=1;
function layout(){
  const vw=innerWidth, vh=innerHeight;
  scale=Math.max(vw/WW, vh/WH, vw<700?0.82:Math.min(vw/1150, vh/720));
  world.setAttribute('width',(WW*scale).toFixed(0)); world.setAttribute('height',(WH*scale).toFixed(0));
  world.style.margin=`${PAD.t}px ${PAD.r}px ${PAD.b}px ${PAD.l}px`;
}
function centerOn(gx,gy,smooth){
  const [x,y]=iso(gx,gy), vh=innerHeight, wide=innerWidth>=700, topH=wide?230:110, botH=wide?90:120;
  map.scrollTo({left:(x-VX)*scale-innerWidth/2, top:(y-VY)*scale-(topH+(vh-topH-botH)/2), behavior:smooth?'smooth':'auto'});
}
let drag=null, moved=false;
map.addEventListener('pointerdown',e=>{ if(e.pointerType!=='mouse') return; drag={x:e.clientX,y:e.clientY,sl:map.scrollLeft,st:map.scrollTop}; moved=false; });
addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
  if(!moved && Math.abs(dx)+Math.abs(dy)>6){ moved=true; map.classList.add('drag'); }
  if(moved){ map.scrollLeft=drag.sl-dx; map.scrollTop=drag.st-dy; } });
addEventListener('pointerup',()=>{ drag=null; map.classList.remove('drag'); });
map.addEventListener('click',e=>{ if(moved){ e.stopPropagation(); e.preventDefault(); moved=false; } },true);
addEventListener('resize',()=>{ if(S){ layout(); centerOn(...FARM_C); } });

