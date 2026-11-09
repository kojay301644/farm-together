/* ================= 小鎮地圖：斜角座標 ================= */
const TW=72, TH=36, OX=680, OY=96, WW=1360, WH=800;
const PAD={t:120,b:150,l:40,r:40};
const iso=(x,y)=>[OX+(x-y)*TW/2, OY+(x+y)*TH/2];
const P=a=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
const up=(p,h)=>[p[0],p[1]-h];
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const poly=(pts,f,extra='')=>`<polygon points="${P(pts)}" fill="${f}" ${extra}/>`;
const dia=(x,y,w,d)=>[iso(x,y),iso(x+w,y),iso(x+w,y+d),iso(x,y+d)];
function fpt(P0,P1,u,v){ return [P0[0]+(P1[0]-P0[0])*u, P0[1]+(P1[1]-P0[1])*u - v]; }
function fq(P0,P1,u0,u1,v0,v1,f,extra=''){ return poly([fpt(P0,P1,u0,v0),fpt(P0,P1,u1,v0),fpt(P0,P1,u1,v1),fpt(P0,P1,u0,v1)],f,extra); }
let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };

/* 田地位置（格座標，3×2） */
const PS=1.8;
const PLOTS=[0,1,2,3,4,5].map(i=>[5.6+(i%3)*2.1, 7+Math.floor(i/3)*2.1]);
const plotCenter=i=>iso(PLOTS[i][0]+PS/2, PLOTS[i][1]+PS/2);
const FARM_C=[8.7,8.9];

/* ================= 美術元件 ================= */
function labelPill(x,y,text,opt={}){
  const w = text.length*13+24;
  const bg = opt.locked?'#D9D2C4':(opt.bg||'#FFFFFF');
  const fg = opt.locked?'#7A6E5D':(opt.fg||'#3A3226');
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" style="pointer-events:none">
    <rect x="${-w/2}" y="-13" width="${w}" height="26" rx="13" fill="${bg}" stroke="rgba(0,0,0,.08)" stroke-width="2"/>
    <path d="M-5 12 L0 18 L5 12Z" fill="${bg}"/>
    <text x="0" y="5" text-anchor="middle" font-size="13" font-weight="900" fill="${fg}" font-family="Noto Sans TC,sans-serif">${opt.locked?'🔒 ':''}${text}</text></g>`;
}

function building(o){
  const A=iso(o.x,o.y),B=iso(o.x+o.w,o.y),C=iso(o.x+o.w,o.y+o.d),D=iso(o.x,o.y+o.d);
  const h=o.h, rh=o.rh;
  const R1=up(mid(A,D),h+rh), R2=up(mid(B,C),h+rh);
  let s = `<ellipse cx="${mid(A,C)[0]}" cy="${mid(A,C)[1]+6}" rx="${(B[0]-D[0])/2+8}" ry="${(C[1]-A[1])/2+5}" fill="rgba(0,0,0,.12)"/>`;
  s += poly([D,C,up(C,h),up(D,h)], o.wallL) + poly([C,B,up(B,h),up(C,h)], o.wallR);
  s += `<path d="M${P([D,C,B])}" stroke="rgba(0,0,0,.12)" stroke-width="3" fill="none"/>`;
  if(o.deco) s += o.deco(D,C,B,h);
  s += poly([up(A,h),up(B,h),R2,R1], o.roofB);
  s += poly([up(C,h),up(B,h),R2], o.wallR) + `<path d="M${P([up(C,h),R2,up(B,h)])}" stroke="${o.roofB}" stroke-width="4" fill="none" stroke-linejoin="round"/>`;
  const e=4, Df=[up(D,h)[0]-e,up(D,h)[1]+e*0.5], Cf=[up(C,h)[0]+e*0.3,up(C,h)[1]+e];
  s += poly([Df,Cf,R2,R1], o.roofF);
  s += `<path d="M${P([Df,Cf])}" stroke="rgba(0,0,0,.18)" stroke-width="3"/>`;
  for(let k=1;k<=3;k++){ const t=k/4; const p1=[Df[0]+(R1[0]-Df[0])*t, Df[1]+(R1[1]-Df[1])*t], p2=[Cf[0]+(R2[0]-Cf[0])*t, Cf[1]+(R2[1]-Cf[1])*t]; s+=`<path d="M${P([p1,p2])}" stroke="rgba(255,255,255,.18)" stroke-width="2"/>`; }
  if(o.top) s += o.top(R1,R2);
  const L = up(mid(R1,R2), 26);
  return {svg:s, label:L, depth:o.x+o.w/2+o.y+o.d/2};
}

const BLD = [
  {id:'barn', name:'穀倉', x:1.3,y:1.2,w:3,d:2.8,h:52,rh:30, wallL:'#E2574C', wallR:'#C8453B', roofF:'#8B5E3C', roofB:'#6E4A2E',
    deco:(D,C,B,h)=> fq(D,C,.28,.72,0,36,'#FFF3E0')+fq(D,C,.32,.68,0,32,'#B5413A')
      +`<path d="M${P([fpt(D,C,.32,0),fpt(D,C,.68,32)])} M${P([fpt(D,C,.68,0),fpt(D,C,.32,32)])}" stroke="#FFF3E0" stroke-width="3"/>`
      +fq(D,C,.42,.58,40,48,'#FFF3E0')+fq(C,B,.35,.65,18,32,'#FFF3E0')+fq(C,B,.39,.61,20,30,'#7A3B33')},
  {id:'shop', name:'種子商店', x:6,y:1.6,w:2.8,d:2.5,h:42,rh:24, wallL:'#FFF8E7', wallR:'#EEDFC2', roofF:'#3BB273', roofB:'#2E9660',
    deco:(D,C,B,h)=>{ let s=fq(D,C,.08,.46,6,26,'#9ED8FF')+fq(D,C,.1,.44,8,12,'#7CC85A')+fq(D,C,.58,.82,0,28,'#5A9E3E')+fq(D,C,.62,.78,2,24,'#7CC85A');
      for(let k=0;k<6;k++) s+=fq(D,C,.04+k*.155,.04+(k+1)*.155,30,38,k%2?'#FFFFFF':'#FF8A8A');
      s+=fq(C,B,.2,.8,20,32,'#FFE7A3'); return s; }},
  {id:'home', name:'我的家', x:10.4,y:1.2,w:3,d:2.8,h:44,rh:30, wallL:'#FFF3E0', wallR:'#F0DCBD', roofF:'#FF8A3D', roofB:'#E0701F',
    deco:(D,C,B,h)=> fq(D,C,.42,.58,0,26,'#C98B5E')+`<circle cx="${fpt(D,C,.54,13)[0]}" cy="${fpt(D,C,.54,13)[1]}" r="1.6" fill="#FFE066"/>`
      +fq(D,C,.1,.3,14,30,'#9ED8FF')+fq(D,C,.7,.9,14,30,'#9ED8FF')+fq(D,C,.1,.3,12,15,'#C98B5E')+fq(D,C,.7,.9,12,15,'#C98B5E')
      +fq(C,B,.35,.65,16,32,'#9ED8FF'),
    top:(R1,R2)=>{ const p=[R1[0]+(R2[0]-R1[0])*.72, R1[1]+(R2[1]-R1[1])*.72+6]; return `<rect x="${p[0]-5}" y="${p[1]-16}" width="11" height="18" fill="#B5654A"/><rect x="${p[0]-6}" y="${p[1]-18}" width="13" height="4" fill="#8E4A35"/>
      <circle class="smoke" cx="${p[0]+1}" cy="${p[1]-24}" r="5" fill="#fff" opacity=".7"/><circle class="smoke" style="animation-delay:1.5s" cx="${p[0]+4}" cy="${p[1]-26}" r="4" fill="#fff" opacity=".7"/>`; }},
  {id:'decor', name:'裝飾店', x:0.4,y:10.1,w:2.4,d:2.2,h:36,rh:22, wallL:'#FFFFFF', wallR:'#ECE4EE', roofF:'#F78FB3', roofB:'#D86F94', locked:'裝飾店將在第四階段開放',
    deco:(D,C,B,h)=> fq(D,C,.4,.62,0,22,'#F78FB3')+fq(D,C,.08,.32,10,24,'#FFD6E5')+fq(D,C,.72,.94,10,24,'#FFD6E5')+fq(C,B,.3,.7,14,26,'#FFD6E5')},
  {id:'coop', name:'牧場', x:14,y:9.9,w:1.5,d:1.3,h:24,rh:14, wallL:'#FFE0A3', wallR:'#EFC982', roofF:'#E2574C', roofB:'#B5413A', locked:'牧場將在第四階段開放',
    deco:(D,C,B,h)=> fq(D,C,.35,.65,0,14,'#8B5E3C')},
];

function tree(gx,gy,k=1){ const [x,y]=iso(gx,gy); return {depth:gx+gy, svg:`<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="2" rx="17" ry="6.5" fill="rgba(0,0,0,.13)"/><rect x="-3.5" y="-22" width="7" height="24" rx="3" fill="#9C6B43"/><circle cx="0" cy="-36" r="19" fill="#4FA845"/><circle cx="-10" cy="-27" r="13" fill="#5DB54A"/><circle cx="10" cy="-29" r="14" fill="#5DB54A"/><circle cx="-5" cy="-43" r="8" fill="#7CC85A" opacity=".8"/></g>`}; }
function bush(gx,gy,fc){ const [x,y]=iso(gx,gy); return {depth:gx+gy, svg:`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="1" rx="14" ry="5" fill="rgba(0,0,0,.12)"/><circle cx="-7" cy="-6" r="8" fill="#5DB54A"/><circle cx="7" cy="-6" r="8" fill="#5DB54A"/><circle cx="0" cy="-11" r="9" fill="#6CC655"/>${fc?`<circle cx="-6" cy="-10" r="2.4" fill="${fc}"/><circle cx="5" cy="-13" r="2.4" fill="${fc}"/><circle cx="8" cy="-5" r="2.4" fill="${fc}"/><circle cx="-2" cy="-4" r="2.4" fill="${fc}"/>`:''}</g>`}; }
function windmill(gx,gy){ const [x,y]=iso(gx,gy);
  let bl=''; for(let a=0;a<360;a+=90) bl+=`<g transform="rotate(${a})"><rect x="-2.5" y="-40" width="5" height="40" fill="#A86F45"/><rect x="2.5" y="-38" width="12" height="28" fill="#FFFFFF" stroke="#E6D8C4" stroke-width="1.5"/></g>`;
  return {depth:gx+gy, svg:`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="2" rx="24" ry="8" fill="rgba(0,0,0,.12)"/><path d="M-17 0 L-10 -74 L10 -74 L17 0Z" fill="#FFF3E0"/><path d="M0 0 L10 -74 L17 0Z" fill="#EAD9BD"/><path d="M-13 -74 L0 -90 L13 -74Z" fill="#E2574C"/><rect x="-6" y="-20" width="12" height="20" rx="5" fill="#9C6B43"/><rect x="-4" y="-50" width="8" height="9" fill="#9ED8FF"/>
    <g transform="translate(0 -72)"><g class="blades">${bl}<circle r="4.5" fill="#8B5E3C"/></g></g></g>`}; }
function board(gx,gy){ const [x,y]=iso(gx,gy); return {depth:gx+gy, id:'board', svg:`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="2" rx="26" ry="7" fill="rgba(0,0,0,.12)"/><rect x="-22" y="-38" width="5" height="40" fill="#9C6B43"/><rect x="17" y="-38" width="5" height="40" fill="#9C6B43"/><rect x="-26" y="-44" width="52" height="32" rx="4" fill="#C98B5E"/><rect x="-22" y="-40" width="44" height="24" rx="2" fill="#E8C49A"/>
  <rect x="-18" y="-37" width="12" height="14" fill="#fff" transform="rotate(-5 -12 -30)"/><rect x="-2" y="-38" width="12" height="10" fill="#FFF6C9"/><rect x="11" y="-33" width="8" height="12" fill="#D9F2FF" transform="rotate(6 15 -27)"/><path d="M-30 -44 L0 -54 L30 -44Z" fill="#8B5E3C"/></g>`}; }

function personSVG(o){
  const skin=o.skin||'#FFD7B5', pants=o.pants||'#4A6FA5';
  return `<ellipse cx="0" cy="1" rx="9" ry="3.5" fill="rgba(0,0,0,.16)"/>
  <rect class="lg1" x="-5" y="-11" width="4" height="11" rx="2" fill="${pants}"/><rect class="lg2" x="1" y="-11" width="4" height="11" rx="2" fill="${pants}"/>
  <g class="bd"><rect x="-7.5" y="-23" width="15" height="14" rx="5" fill="${o.shirt}"/>
  ${o.apron?`<rect x="-5" y="-19" width="10" height="10" rx="2" fill="${o.apron}"/>`:''}
  ${o.overall?`<rect x="-6" y="-17" width="12" height="8" rx="2" fill="${o.overall}"/><rect x="-5" y="-23" width="2" height="7" fill="${o.overall}"/><rect x="3" y="-23" width="2" height="7" fill="${o.overall}"/>`:''}
  <circle cx="0" cy="-30" r="8.5" fill="${skin}"/>
  <path d="M-8.5 -29 Q-9 -41 0 -40 Q9 -41 8.5 -29 Q5 -35 -1 -35 Q-6 -35 -8.5 -29Z" fill="${o.hair}"/>
  ${o.long?`<path d="M-8.5 -30 Q-10 -22 -6 -20 L-6 -30Z" fill="${o.hair}"/>`:''}
  <circle cx="2.5" cy="-29" r="1.2" fill="#3A3226"/><circle cx="6.2" cy="-29" r="1.2" fill="#3A3226"/>
  <circle cx="4.5" cy="-25.8" r="1.6" fill="#FF9AA2" opacity=".75"/>
  ${o.hat?`<ellipse cx="0" cy="-36" rx="14" ry="4" fill="#E8C766"/><path d="M-7.5 -36 Q-7 -46 0 -46 Q7 -46 7.5 -36Z" fill="#F2D57E"/><rect x="-7.5" y="-39" width="15" height="2.6" fill="#E2574C"/>`:''}
  ${o.tool==='hoe'?`<path d="M-9 -20 L-14 -46" stroke="#A86F45" stroke-width="2.5" stroke-linecap="round"/><path d="M-14 -46 l-6 2" stroke="#9AA6B2" stroke-width="4" stroke-linecap="round"/>`:''}</g>`;
}
const CHICK = `<ellipse cy="1" rx="6" ry="2" fill="rgba(0,0,0,.15)"/><path d="M-2 -1 v2.5 M2 -1 v2.5" stroke="#F0A030" stroke-width="1.5"/><g class="bd"><ellipse cx="0" cy="-6" rx="7.5" ry="5.5" fill="#fff"/><path d="M-7 -8 l-4 -3 l1 5z" fill="#F1ECE4"/><circle cx="5" cy="-11" r="3.8" fill="#fff"/><path d="M3.5 -14.5 q1 -2.5 2 0 q1 -2.5 2.2 0z" fill="#F2545B"/><path d="M8.6 -11.2 l3.2 1 l-3.2 1z" fill="#F0A030"/><circle cx="6.2" cy="-11.6" r=".9" fill="#333"/></g>`;

/* ================= 組合地圖 ================= */
let plotEls=[], plotSig=[], plotLabs=[];
const movers=[];

function buildWorld(){
  const W=$('world');
  W.setAttribute('viewBox',`0 0 ${WW} ${WH}`);
  seed=11;
  let sea='', island='', ground='', objs=[], lab='', cloud='';

  // 海
  sea += `<rect x="-200" y="-200" width="${WW+400}" height="${WH+400}" fill="#8FD3F4"/>`;
  for(let k=0;k<26;k++){ const x=rnd()*WW, y=rnd()*WH; sea+=`<path class="wave" style="animation-delay:${(rnd()*3).toFixed(2)}s" d="M${x} ${y} q8 -5 16 0 t16 0" stroke="#C6EBFB" stroke-width="3" fill="none" stroke-linecap="round"/>`; }

  // 島
  const I=dia(-1,-1,18,18), cl=40;
  island += `<ellipse cx="${OX}" cy="${iso(17,17)[1]+cl-10}" rx="660" ry="40" fill="rgba(40,110,150,.25)"/>`;
  island += poly([I[3],I[2],up(I[2],-cl),up(I[3],-cl*0.6)],'#B07A4F') + poly([I[2],I[1],up(I[1],-cl*0.6),up(I[2],-cl)],'#8F603D');
  island += `<path d="M${P([up(I[3],-cl*0.3),up(I[2],-cl*0.55),up(I[1],-cl*0.3)])}" stroke="rgba(0,0,0,.12)" stroke-width="4" fill="none"/>`;
  island += poly(I,'#8ACB5B') + `<path d="M${P([I[3],I[2],I[1]])}" stroke="#6DB548" stroke-width="7" fill="none" stroke-linejoin="round"/>`;
  // 瀑布（河流流出島嶼）
  const wf1=iso(17,14.35), wf2=iso(17,15.25);
  island += poly([wf1,wf2,up(wf2,-cl*0.9),up(wf1,-cl*0.9)],'#5BB8E8') + `<path class="flow" d="M${(wf1[0]+wf2[0])/2} ${(wf1[1]+wf2[1])/2} v${cl}" stroke="#E3F6FF" stroke-width="3"/>`;

  // 草地點綴
  for(let k=0;k<70;k++){ const gx=rnd()*17-0.5, gy=rnd()*17-0.5; const [x,y]=iso(gx,gy);
    ground += rnd()<0.7 ? `<path d="M${x-4} ${y} l2 -6 l2 6 l2 -5 l2 5" stroke="#6DB548" stroke-width="1.6" fill="none"/>`
      : `<circle cx="${x}" cy="${y}" r="2.6" fill="${['#FFE066','#FFFFFF','#FF9AA2'][k%3]}"/>`; }

  // 小路
  const path=(x,y,w,d)=>poly(dia(x,y,w,d),'#E8D3A2','stroke="#D8BE86" stroke-width="2"');
  ground += path(-1,5,18,1) + path(3,6,1,11) + path(7.2,4.1,0.8,0.9) + path(11.6,4,0.8,1) + path(2.6,4,0.8,1);
  for(let k=0;k<30;k++){ const t=rnd(); const [x,y]= k<20? iso(-0.5+t*17, 5.2+rnd()*0.6) : iso(3.2+rnd()*0.6, 6.5+t*10); ground+=`<ellipse cx="${x}" cy="${y}" rx="3" ry="1.6" fill="#D2B47C"/>`; }

  // 河
  ground += poly(dia(-1,14.2,18,1.2),'#7FD0F0') + poly(dia(-1,14.35,18,0.9),'#5BB8E8');
  ground += `<path class="flow" d="M${P([iso(-1,14.65),iso(17,14.65)])}" stroke="#E3F6FF" stroke-width="2.5" opacity=".8"/><path class="flow" style="animation-delay:-1s" d="M${P([iso(-1,14.95),iso(17,14.95)])}" stroke="#E3F6FF" stroke-width="2" opacity=".6"/>`;
  // 橋
  const bw=dia(2.75,13.9,1.5,1.8);
  ground += poly(bw,'#C98B5E');
  for(let k=1;k<6;k++){ ground+=`<path d="M${P([iso(2.75,13.9+k*0.3),iso(4.25,13.9+k*0.3)])}" stroke="#A86F45" stroke-width="2"/>`; }
  ground += `<path d="M${P([up(iso(2.75,13.9),8),up(iso(2.75,15.7),8)])} M${P([up(iso(4.25,13.9),8),up(iso(4.25,15.7),8)])}" stroke="#8B5E3C" stroke-width="3"/>`;

  // 田區底
  ground += poly(dia(5.25,6.65,6.95,4.6),'#9ACF6A','stroke="#7DB14C" stroke-width="3"');
  // 牧場底與圍欄
  const RX=11.9,RY=9.5,RW=3.9,RD=4;
  ground += poly(dia(RX,RY,RW,RD),'#A7D46F');
  const fence=(x0,y0,x1,y1)=>{ let s=''; const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/0.55);
    const a=iso(x0,y0), b=iso(x1,y1); s+=`<path d="M${P([up(a,9),up(b,9)])} M${P([up(a,16),up(b,16)])}" stroke="#E8D3A2" stroke-width="3"/>`;
    for(let k=0;k<=n;k++){ const p=iso(x0+(x1-x0)*k/n, y0+(y1-y0)*k/n); s+=`<rect x="${p[0]-2}" y="${p[1]-20}" width="4" height="20" rx="1.5" fill="#F3E3BF"/>`; } return s; };
  ground += fence(RX,RY,RX+RW,RY) + fence(RX,RY,RX,RY+RD);
  objs.push({depth:RX+RW+RY+RD+0.5, svg: fence(RX,RY+RD,RX+RW,RY+RD) + fence(RX+RW,RY,RX+RW,RY+RD)});
  // 飼料槽
  objs.push({depth:RX+1+RY+2.6, svg:(()=>{ const [x,y]=iso(RX+1,RY+2.6); return `<rect x="${x-14}" y="${y-8}" width="28" height="8" rx="3" fill="#A86F45"/><rect x="${x-12}" y="${y-8}" width="24" height="3" fill="#F2D57E"/>`; })()});

  // 建築
  BLD.forEach(o=>{ const b=building(o);
    objs.push({depth:b.depth, svg:`<g class="tap" data-b="${o.id}">${b.svg}</g>`});
    lab += labelPill(b.label[0], b.label[1], o.name, {locked:!!o.locked, bg:o.id==='shop'?'#FFF1DC':null});
  });
  const bd=board(1.6,7.4); objs.push({depth:bd.depth, svg:`<g class="tap" data-b="board">${bd.svg}</g>`});
  lab += labelPill(iso(1.6,7.4)[0], iso(1.6,7.4)[1]-68, '好友布告欄', {bg:'#E3F6EA',fg:'#2E9660'});
  const wm=windmill(13.7,7.4); objs.push(wm);
  // 信箱
  objs.push((()=>{ const [x,y]=iso(13.9,4.5); return {depth:18.4, svg:`<g transform="translate(${x} ${y})"><rect x="-1.5" y="-22" width="3" height="22" fill="#9C6B43"/><rect x="-8" y="-32" width="16" height="11" rx="5" fill="#3DA5F4"/><rect x="5" y="-36" width="2" height="8" fill="#F2545B"/></g>`}; })());

  // 樹木與花叢
  [[-0.4,3.4],[-0.5,7.6],[-0.3,13.2],[5,13.1],[8,13.4],[10.8,13.2],[16,7],[16,15.6],[13,16.2],[1.5,16.3],[7.5,16.4],[16.2,2.2],[15.6,-0.4],[4.9,-0.3],[9.4,-0.4],[-0.6,0.3],[16.3,13.6],[5.2,15.9]].forEach(([x,y],k)=>objs.push(tree(x,y,0.85+((k*37)%30)/100)));
  [[9.7,4.5,'#FF9AA2'],[14.4,4.6,'#FFE066'],[4.9,4.5,null],[12.4,6.6,'#FFFFFF'],[2.3,8.8,'#FFE066'],[4.6,11.6,null]].forEach(([x,y,f])=>objs.push(bush(x,y,f)));

  // 田地（可點）
  PLOTS.forEach((_,i)=>{ const [cx,cy]=plotCenter(i); objs.push({depth:PLOTS[i][0]+PLOTS[i][1]+PS, svg:`<g class="tap plot" data-p="${i}"><g class="pg"></g><g class="ps"></g></g>`}); });

  // 固定人物
  const stand=(gx,gy,o,flip)=>{ const [x,y]=iso(gx,gy); objs.push({depth:gx+gy, svg:`<g transform="translate(${x} ${y}) scale(${flip?-1.15:1.15} 1.15)">${personSVG(o)}</g>`}); };
  stand(4.85,8.3,{shirt:'#FFFFFF',overall:'#3DA5F4',hair:'#5A3A22',hat:true,tool:'hoe'},false);
  stand(7.45,4.6,{shirt:'#3BB273',apron:'#FFF3E0',hair:'#3A3226'},true);

  objs.sort((a,b)=>a.depth-b.depth);

  // 雲
  for(let k=0;k<4;k++){ const y=40+k*150+rnd()*60, d=50+rnd()*40, s=0.8+rnd()*0.7;
    cloud+=`<g class="cloud" style="animation-duration:${d}s;animation-delay:${-rnd()*d}s"><g transform="translate(0 ${y}) scale(${s})" opacity=".85"><ellipse cx="0" cy="0" rx="40" ry="14" fill="#fff"/><ellipse cx="18" cy="-10" rx="22" ry="14" fill="#fff"/><ellipse cx="-14" cy="-6" rx="16" ry="11" fill="#fff"/></g></g>`; }

  W.innerHTML = `<g>${sea}</g><g>${island}</g><g>${ground}</g><g id="objs">${objs.map(o=>o.svg).join('')}</g><g id="movers"></g><g id="labels">${lab}<g id="plabs"></g></g><g style="pointer-events:none">${cloud}</g>`;

  // 田地元素與標籤
  plotEls=[]; plotSig=[]; plotLabs=[];
  const pl=$('plabs');
  W.querySelectorAll('[data-p]').forEach(g=>{ const i=+g.dataset.p; plotEls[i]=g; plotSig[i]=''; g.addEventListener('click',()=>act(i)); });
  PLOTS.forEach((_,i)=>{ const [cx,cy]=plotCenter(i);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','plab'); g.setAttribute('transform',`translate(${cx} ${cy-62})`);
    g.innerHTML=`<rect x="-44" y="-12" width="88" height="25" rx="11" fill="#fff" stroke="rgba(0,0,0,.08)" stroke-width="2"/><text x="0" y="3" text-anchor="middle" font-size="12" font-weight="900" fill="#3A3226" font-family="Noto Sans TC,sans-serif"></text><rect class="bb" x="-32" y="6" width="64" height="4" rx="2" fill="#EEE6D6"/><rect class="bf" x="-32" y="6" width="0" height="4" rx="2" fill="#7ED957"/>`;
    pl.appendChild(g); plotLabs[i]=g; });
  W.querySelectorAll('[data-b]').forEach(g=>g.addEventListener('click',()=>tapBuilding(g)));

  // 會動的人物與小雞
  movers.length=0;
  const mv=$('movers');
  const addMover=(html,o)=>{ const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.innerHTML=`<g>${html}</g>`; mv.appendChild(g); movers.push(Object.assign({el:g,inner:g.firstChild,wait:0,face:1},o)); };
  addMover(personSVG({shirt:'#5DADE2',hair:'#6B4423',pants:'#3A5A8C'}),{x:2,y:5.5,path:[[0.2,5.5],[15.8,5.5]],tgt:1,speed:0.9,s:1.1});
  addMover(personSVG({shirt:'#F78FB3',hair:'#2F2F2F',long:true,pants:'#7A6E9E'}),{x:12,y:5.6,path:[[15.6,5.6],[0.4,5.6]],tgt:1,speed:0.7,s:1.1});
  addMover(personSVG({shirt:'#FFD23F',hair:'#8B5E3C',pants:'#5A7A3A'}),{x:3.5,y:9,path:[[3.5,6.3],[3.5,15]],tgt:1,speed:0.6,s:1.1});
  for(let k=0;k<4;k++) addMover(CHICK,{x:RX+0.6+rnd()*(RW-1.2),y:RY+0.8+rnd()*(RD-1.4),chick:true,area:[RX+0.5,RY+1.6,RX+RW-0.5,RY+RD-0.4],speed:0.5,s:1.2,wait:rnd()*2});
}

/* 移動動畫 */
let lastF=performance.now();
function animate(now){
  const dt=Math.min(0.1,(now-lastF)/1000); lastF=now;
  for(const m of movers){
    let moving=false;
    if(m.wait>0){ m.wait-=dt; }
    else {
      if(!m.goal){
        if(m.chick){ const a=m.area; m.goal=[a[0]+Math.random()*(a[2]-a[0]), a[1]+Math.random()*(a[3]-a[1])]; }
        else { m.goal=m.path[m.tgt]; }
      }
      const dx=m.goal[0]-m.x, dy=m.goal[1]-m.y, dist=Math.hypot(dx,dy), step=m.speed*dt;
      if(dist<=step){ m.x=m.goal[0]; m.y=m.goal[1]; m.goal=null;
        if(m.chick) m.wait=0.6+Math.random()*2.5; else { m.tgt=1-m.tgt; m.wait=1+Math.random()*3; } }
      else { m.x+=dx/dist*step; m.y+=dy/dist*step; moving=true;
        const sdx=(dx-dy); if(Math.abs(sdx)>0.01) m.face = sdx>0?1:-1; }
    }
    const [sx,sy]=iso(m.x,m.y);
    m.el.setAttribute('transform',`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${m.face*m.s} ${m.s})`);
    if(m.moving!==moving){ m.moving=moving; m.el.classList.toggle('walk',moving); }
  }
  requestAnimationFrame(animate);
}

/* ================= 田地繪製 ================= */
const SPR=0.85;
function plotGroundSVG(p,i){
  const [x,y]=PLOTS[i], pts=dia(x,y,PS,PS), B=pts[1], C=pts[2], D=pts[3];
  let top='#A06F49', sl='#7E5638', sr='#6B4830';
  if(p.s==='wild'){ top='#7DB14C'; sl='#8B5E3C'; sr='#76502F'; }
  else if(p.s==='grow'){ if(isDry(p)){ top='#C08A5C'; } else { top='#7A4E33'; } }
  let s = poly([D,C,[C[0],C[1]+7],[D[0],D[1]+7]],sl) + poly([C,B,[B[0],B[1]+7],[C[0],C[1]+7]],sr) + poly(pts,top);
  if(p.s!=='wild') for(const k of [0.45,0.9,1.35]) s+=`<path d="M${P([iso(x+0.15,y+k),iso(x+PS-0.15,y+k)])}" stroke="rgba(0,0,0,.12)" stroke-width="3" stroke-linecap="round"/>`;
  if(p.s==='grow' && isDry(p)) s+=`<path d="M${P([iso(x+0.4,y+0.3),iso(x+0.6,y+0.5),iso(x+0.5,y+0.7)])} M${P([iso(x+1.3,y+1.2),iso(x+1.5,y+1.3)])}" stroke="#8C6040" stroke-width="1.6" fill="none"/>`;
  return s;
}
function plotSpriteSVG(p,i){
  let body='';
  if(p.s==='wild'){
    body = `${weedArt(30,80)}${weedArt(90,70)}${weedArt(56,64)}<ellipse cx="76" cy="84" rx="8" ry="5" fill="#B5AFA3"/><ellipse cx="74" cy="82" rx="4" ry="2" fill="#CFCAC0"/>
      <g transform="translate(36 24)"><rect x="22" y="14" width="4" height="26" fill="#B07A4F"/><rect x="0" y="0" width="48" height="20" rx="5" fill="#F3D9A8"/><text x="24" y="14.5" font-size="11" font-weight="900" text-anchor="middle" fill="#8A5A34" font-family="Noto Sans TC,sans-serif">荒地</text></g>`;
  } else if(p.s==='grow'){
    const st=stageOf(p);
    body += `<g class="crop">${cropArt(CROP[p.c],st)}</g>`;
    for(let k=0;k<p.w;k++) body += weedArt(...WEED_POS[k]);
    for(let k=0;k<p.b;k++) body += bugArt(...BUG_POS[k]);
    if(st===4) body += `<g class="spark" fill="#FFF"><path d="M100 22 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z"/><path d="M18 30 l1.4 4 l4 1.4 l-4 1.4 l-1.4 4 l-1.4 -4 l-4 -1.4 l4 -1.4z"/></g>`;
    if(isDry(p)) body += `<g transform="translate(98 26)"><path d="M0 0 Q-8 11 0 15 Q8 11 0 0Z" fill="#3DA5F4"/><path d="M-1 7 h2" stroke="#fff" stroke-width="1.5"/></g>`;
  } else if(p.s==='dead') body = deadArt;
  const [cx,cy]=plotCenter(i);
  return `<g transform="translate(${(cx-60*SPR).toFixed(1)} ${(cy-74*SPR).toFixed(1)}) scale(${SPR})">${body}</g>`;
}

/* ================= 地圖縮放與拖曳 ================= */
const map=$('map'), world=$('world');
let scale=1;
function layout(){
  const vw=innerWidth, vh=innerHeight;
  scale=Math.max(0.6, Math.min(vw/470, vh/560, 1.6));
  world.setAttribute('width',(WW*scale).toFixed(0)); world.setAttribute('height',(WH*scale).toFixed(0));
  world.style.margin=`${PAD.t}px ${PAD.r}px ${PAD.b}px ${PAD.l}px`;
}
function centerOn(gx,gy,smooth){
  const [x,y]=iso(gx,gy), vh=innerHeight, topH=110, botH=120;
  map.scrollTo({left:PAD.l+x*scale-innerWidth/2, top:PAD.t+y*scale-(topH+(vh-topH-botH)/2), behavior:smooth?'smooth':'auto'});
}
let drag=null, moved=false;
map.addEventListener('pointerdown',e=>{ if(e.pointerType!=='mouse') return; drag={x:e.clientX,y:e.clientY,sl:map.scrollLeft,st:map.scrollTop}; moved=false; });
addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
  if(!moved && Math.abs(dx)+Math.abs(dy)>6){ moved=true; map.classList.add('drag'); }
  if(moved){ map.scrollLeft=drag.sl-dx; map.scrollTop=drag.st-dy; } });
addEventListener('pointerup',()=>{ drag=null; map.classList.remove('drag'); });
map.addEventListener('click',e=>{ if(moved){ e.stopPropagation(); e.preventDefault(); moved=false; } },true);
addEventListener('resize',()=>{ if(S){ layout(); centerOn(...FARM_C); } });

