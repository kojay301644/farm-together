/* ================= 遊戲資料 ================= */
const CROPS = [
  {id:'radish',    name:'白蘿蔔', lv:1, seed:10,  time:120,   yield:8,  price:3,  exp:4,   type:'root',  color:'#F7F4EA', edge:'#D9D2C0'},
  {id:'carrot',    name:'紅蘿蔔', lv:1, seed:16,  time:300,   yield:10, price:3,  exp:6,   type:'root',  color:'#FF8A3D'},
  {id:'cabbage',   name:'高麗菜', lv:2, seed:30,  time:900,   yield:10, price:6,  exp:10,  type:'leafy', color:'#A6D96A'},
  {id:'corn',      name:'玉米',   lv:3, seed:50,  time:1800,  yield:12, price:7,  exp:16,  type:'stalk', color:'#FFD23F'},
  {id:'tomato',    name:'番茄',   lv:4, seed:80,  time:3600,  yield:14, price:9,  exp:24,  type:'bush',  color:'#F2545B', fruit:'round'},
  {id:'eggplant',  name:'茄子',   lv:5, seed:110, time:7200,  yield:14, price:12, exp:32,  type:'bush',  color:'#7B4BB7', fruit:'long'},
  {id:'strawberry',name:'草莓',   lv:6, seed:160, time:10800, yield:16, price:15, exp:45,  type:'bush',  color:'#E8384F', fruit:'berry'},
  {id:'pumpkin',   name:'南瓜',   lv:7, seed:220, time:14400, yield:12, price:28, exp:60,  type:'ground',color:'#FF9F1C'},
  {id:'watermelon',name:'西瓜',   lv:8, seed:300, time:21600, yield:10, price:48, exp:80,  type:'ground',color:'#3E9B4F', stripe:true},
  {id:'grape',     name:'葡萄',   lv:9, seed:400, time:28800, yield:16, price:38, exp:110, type:'bush',  color:'#8E5CC9', fruit:'grape'},
  {id:'pineapple', name:'鳳梨',   lv:10,seed:480, time:36000, yield:12, price:58, exp:135, type:'pine',  color:'#FFC531'},
  {id:'peach',     name:'桃子',   lv:11,seed:560, time:43200, yield:18, price:44, exp:160, type:'bush',  color:'#FF9EA0', fruit:'round'},
  {id:'dragonfruit',name:'火龍果',lv:12,seed:650, time:50400, yield:14, price:65, exp:190, type:'bush',  color:'#E8338A', fruit:'dragon'},
  {id:'melon',     name:'哈密瓜', lv:13,seed:760, time:57600, yield:10, price:105,exp:220, type:'ground',color:'#D9E8A0', net:true},
  {id:'mango',     name:'芒果',   lv:14,seed:880, time:64800, yield:16, price:75, exp:255, type:'bush',  color:'#FFB02E', fruit:'long'},
];
const CROP = Object.fromEntries(CROPS.map(c=>[c.id,c]));
// 20 塊田的開墾條件（第 0～1 塊一開始就有），要跟伺服器的 land 表一致
const LAND = [null,null,{lv:1,cost:50},{lv:1,cost:80},{lv:1,cost:100},{lv:2,cost:200},{lv:2,cost:300},{lv:3,cost:500},{lv:4,cost:800},{lv:5,cost:1200},{lv:6,cost:1600},{lv:7,cost:2000},{lv:8,cost:2500},{lv:9,cost:3000},{lv:10,cost:4000},{lv:11,cost:5000},{lv:12,cost:6500},{lv:13,cost:8000},{lv:14,cost:10000},{lv:15,cost:12000}];
const WILD = LAND;
const MAX_LV = 30;
const needExp = lv => 30*lv*lv;
const wetDur = c => Math.min(3600, Math.max(45, c.time*0.3));
/* ================= 美術（向量繪製） ================= */
const L = (cx,cy,rx,ry,rot,f)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${f}"/>`;
const UNRIPE = '#B6DB7A';

function cropArt(c, st){ return olc(cropArt0(c, st)) + cropHL(c, st); }
function cropArt0(c, st){
  if(st===0) return `<ellipse cx="60" cy="74" rx="14" ry="5" fill="#8B5A3A"/><circle cx="54" cy="72" r="2" fill="#F0DFAE"/><circle cx="61" cy="70" r="2" fill="#F0DFAE"/><circle cx="67" cy="73" r="2" fill="#F0DFAE"/>`;
  if(st===1) return `<rect x="58.5" y="62" width="3" height="12" rx="1.5" fill="#5DB54A"/>${L(53,62,8,4,-30,'#7CC85A')}${L(67,62,8,4,30,'#7CC85A')}`;
  if(st===2) return `<rect x="58" y="52" width="4" height="22" rx="2" fill="#5DB54A"/>${L(47,58,13,6,-30,'#6CC655')}${L(73,58,13,6,30,'#6CC655')}${L(52,48,10,5,-60,'#7CC85A')}${L(68,48,10,5,60,'#7CC85A')}`;
  const ripe = st===4, k = ripe?1:0.75, col = ripe?c.color:UNRIPE;
  switch(c.type){
    case 'root':
      return `${L(50,52,7,17,-25,'#5DB54A')}${L(70,52,7,17,25,'#5DB54A')}${L(60,48,7,19,0,'#6CC655')}
        <ellipse cx="60" cy="72" rx="${13*k}" ry="${9*k}" fill="${ripe?c.color:'#E8D9B5'}" ${c.edge&&ripe?`stroke="${c.edge}" stroke-width="1.5"`:''}/>
        <path d="M54 72 h5 M61 75 h5" stroke="rgba(0,0,0,.12)" stroke-width="1.5" stroke-linecap="round"/>`;
    case 'leafy':
      return `<circle cx="60" cy="64" r="${22*k}" fill="#7FBF4D"/><circle cx="60" cy="63" r="${16*k}" fill="${ripe?c.color:'#93CF62'}"/><circle cx="60" cy="62" r="${9*k}" fill="#CDEB8F"/>
        <path d="M60 ${63-14*k} V${63+14*k}" stroke="#7FBF4D" stroke-width="1.5"/>`;
    case 'stalk':
      return `<rect x="58" y="${ripe?18:28}" width="4" height="${ripe?58:48}" rx="2" fill="#6DB548"/>${L(47,54,5,17,-40,'#5DB54A')}${L(73,48,5,17,40,'#6CC655')}${L(48,40,4,12,-50,'#7CC85A')}
        <ellipse cx="67" cy="40" rx="${6*k}" ry="${13*k}" fill="${col}"/>${ripe?'<path d="M64 32 h6 M64 38 h6 M64 44 h6" stroke="#E8B520" stroke-width="1.2"/>':''}
        ${L(64,46,4,10,15,'#8CCB5E')}<path d="M60 ${ripe?18:28} l-5 -8 M60 ${ripe?18:28} l0 -9 M60 ${ripe?18:28} l5 -8" stroke="#D9B44A" stroke-width="2" stroke-linecap="round"/>`;
    case 'bush': {
      const pts = [[47,62],[71,63],[59,48],[58,68],[66,53]];
      let fr = '';
      for(const [x,y] of pts){
        if(c.fruit==='round') fr += `<circle cx="${x}" cy="${y}" r="${6*k}" fill="${col}"/><rect x="${x-2}" y="${y-7*k}" width="4" height="3" rx="1" fill="#3E8E3A"/>`;
        else if(c.fruit==='long') fr += `<ellipse cx="${x}" cy="${y+2}" rx="${4*k}" ry="${8*k}" fill="${col}"/><rect x="${x-3}" y="${y-7*k}" width="6" height="3" rx="1.5" fill="#3E8E3A"/>`;
        else if(c.fruit==='berry') fr += `<path d="M${x-5*k} ${y-3*k} Q${x} ${y-7*k} ${x+5*k} ${y-3*k} Q${x+4*k} ${y+5*k} ${x} ${y+7*k} Q${x-4*k} ${y+5*k} ${x-5*k} ${y-3*k}Z" fill="${col}"/>${ripe?`<circle cx="${x-1.5}" cy="${y}" r=".9" fill="#FFE066"/><circle cx="${x+1.8}" cy="${y+2}" r=".9" fill="#FFE066"/>`:''}`;
        else if(c.fruit==='dragon') fr += `<ellipse cx="${x}" cy="${y}" rx="${5.5*k}" ry="${7*k}" fill="${col}"/>${ripe?`<path d="M${x-5} ${y-3} l-3 -2 M${x+5} ${y-2} l3 -2 M${x} ${y-7} l0 -3" stroke="#7CC85A" stroke-width="2" stroke-linecap="round"/>`:''}`;
        else if(c.fruit==='grape'){ const r=3*k; fr += [[0,0],[-3,-3],[3,-3],[-1.5,3],[1.5,3],[0,6]].map(([a,b])=>`<circle cx="${x+a*k}" cy="${y-2+b*k}" r="${r}" fill="${col}"/>`).join(''); }
      }
      return `<rect x="58" y="62" width="4" height="13" fill="#5A9E3E"/><circle cx="47" cy="60" r="15" fill="#5DB54A"/><circle cx="73" cy="60" r="15" fill="#5DB54A"/><circle cx="60" cy="50" r="17" fill="#6CC655"/><circle cx="54" cy="45" r="6" fill="#86D46A" opacity=".7"/>${fr}`;
    }
    case 'pine':
      return `${L(50,46,5,16,-30,'#4E9B3F')}${L(70,46,5,16,30,'#4E9B3F')}${L(44,58,5,14,-55,'#5DB54A')}${L(76,58,5,14,55,'#5DB54A')}
        <ellipse cx="60" cy="${70-4*(1-k)}" rx="${11*k}" ry="${14*k}" fill="${ripe?c.color:'#C8D97A'}"/>
        ${ripe?`<path d="M51 62 L69 78 M51 72 L63 82 M57 58 L69 70 M69 62 L51 78 M69 72 L57 82 M63 58 L51 70" stroke="#D99A1E" stroke-width="1.6"/>`:''}
        ${L(56,50,3,9,-20,'#5DB54A')}${L(64,50,3,9,20,'#5DB54A')}${L(60,47,3,10,0,'#6CC655')}`;
    case 'ground':
      return `<path d="M30 70 Q45 56 60 66 T92 64" stroke="#5A9E3E" stroke-width="3" fill="none"/>${L(36,62,13,7,-20,'#5DB54A')}${L(86,60,13,7,20,'#6CC655')}
        <ellipse cx="60" cy="66" rx="${22*k}" ry="${15*k}" fill="${col}"/>
        ${c.net?`<path d="M${60-14*k} ${60} Q60 ${56} ${60+14*k} ${60} M${60-18*k} 67 Q60 63 ${60+18*k} 67 M${60-14*k} 74 Q60 70 ${60+14*k} 74 M${60-8*k} ${54+(1-k)*6} Q${60-12*k} 66 ${60-8*k} ${79-(1-k)*6} M${60+8*k} ${54+(1-k)*6} Q${60+12*k} 66 ${60+8*k} ${79-(1-k)*6}" stroke="${ripe?'#A9BF6E':'#95C25E'}" stroke-width="1.6" fill="none"/>`:c.stripe?`<path d="M${60-12*k} ${54*1+(1-k)*8} Q${60-16*k} 66 ${60-12*k} ${78-(1-k)*8} M60 ${51+(1-k)*4} V${81-(1-k)*4} M${60+12*k} ${54+(1-k)*8} Q${60+16*k} 66 ${60+12*k} ${78-(1-k)*8}" stroke="${ripe?'#2C7A3B':'#8DBF55'}" stroke-width="3" fill="none"/>`
                  :`<path d="M${60-10*k} ${54+(1-k)*6} Q${60-15*k} 66 ${60-10*k} ${78-(1-k)*6} M${60+10*k} ${54+(1-k)*6} Q${60+15*k} 66 ${60+10*k} ${78-(1-k)*6}" stroke="${ripe?'#E8830C':'#95C25E'}" stroke-width="2.5" fill="none"/>`}
        <rect x="58" y="${50+(1-k)*5}" width="5" height="6" rx="2" fill="#6B8E3A"/>`;
  }
}
function olc(s){ return s.replace(/<(circle|ellipse|rect|polygon|path)\b([^>]*?)(\/?)>/g,(m,t,a,sl)=>(/stroke=|fill="none"|class="nool"|opacity=/.test(a)?m:`<${t}${a} stroke="#4B3423" stroke-width="2" stroke-linejoin="round"${sl}>`)); }
// 作物高光（讓果實有光澤）
function cropHL(c, st){
  if(st<3) return '';
  const k = st===4?1:0.75, hl=(x,y,r)=>`<ellipse class="nool" cx="${x}" cy="${y}" rx="${r}" ry="${r*0.7}" fill="#fff" opacity=".6"/>`;
  if(c.type==='bush'){ return [[47,62],[71,63],[59,48],[58,68],[66,53]].map(([x,y])=>hl(x-2*k,y-2.5*k,1.8*k)).join(''); }
  if(c.type==='ground') return hl(52,58+(1-k)*6,5*k);
  if(c.type==='root') return hl(55,69,3*k);
  if(c.type==='leafy') return hl(54,56,4*k);
  if(c.type==='pine') return hl(55,62,3*k);
  if(c.type==='stalk') return hl(65,34,2*k);
  return '';
}
const deadArt = olc(`<path d="M60 76 Q58 60 64 50 Q70 44 74 50" stroke="#4B3423" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M60 76 Q58 60 64 50 Q70 44 74 50" stroke="#B08A5E" stroke-width="2.8" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="66" rx="9" ry="4" transform="rotate(25 50 66)" fill="#C9A577"/><ellipse cx="70" cy="62" rx="9" ry="4" transform="rotate(-35 70 62)" fill="#B89566"/><ellipse cx="76" cy="54" rx="6" ry="3" transform="rotate(40 76 54)" fill="#C9A577"/>`);
const weedArt = (x,y)=>`<g transform="translate(${x} ${y}) scale(1.5)">${olc(`<path d="M0 0 L-7 -12 L-2 -4 L0 -16 L2 -4 L8 -11 Z" fill="#3E9B3E"/><path d="M-4 0 L-10 -6 L-2 0Z" fill="#55B04A"/>`).replace(/stroke-width="2"/g,'stroke-width="1.2"')}</g>`;
const bugArt  = (x,y)=>`<g transform="translate(${x} ${y}) scale(1.5)">${[[-7,1,'#8BD35C'],[-3.5,0,'#9ADB6A'],[0,-1,'#8BD35C'],[3.5,-0.5,'#9ADB6A']].map(([a,b,c],k)=>`<circle class="seg" style="animation-delay:-${k*0.12}s" cx="${a}" cy="${b}" r="3.2" fill="${c}" stroke="#4B3423" stroke-width="1"/>`).join('')}<circle cx="7" cy="-2" r="4" fill="#9ADB6A" stroke="#4B3423" stroke-width="1"/><circle cx="8.2" cy="-2.8" r="1.1" fill="#3A3226"/><circle cx="6" cy="-3" r="1.1" fill="#3A3226"/><path d="M6 -6 l-1 -3 M8.5 -6 l1 -3" stroke="#4B3423" stroke-width="1" stroke-linecap="round"/><circle cx="8" cy="-0.5" r=".9" fill="#FF9AA2"/></g>`;
const WEED_POS=[[24,86],[98,64],[30,62]], BUG_POS=[[86,84],[44,80],[80,62]];

function stageOf(p){ const c=CROP[p.c]; const r=p.g/c.time; return r>=1?4: r<0.1?0: r<0.4?1: r<0.75?2:3; }

function iconSVG(c){ return `<svg viewBox="10 14 100 72">${cropArt(c,4)}</svg>`; }

const ICONS = {
  hand:`<svg viewBox="0 0 32 32"><path d="M6 13 h20 l-2.5 13 a2 2 0 0 1 -2 1.6 h-11 a2 2 0 0 1 -2 -1.6Z" fill="#E0A45E"/><path d="M8 17 h16 M9 21 h14" stroke="#C4843D" stroke-width="1.6"/><path d="M10 13 Q16 3 22 13" stroke="#C4843D" stroke-width="2.4" fill="none"/><circle cx="12" cy="11" r="3.2" fill="#F2545B"/><circle cx="19" cy="10" r="3.2" fill="#FF8A3D"/></svg>`,
  seed:`<svg viewBox="0 0 32 32"><path d="M9 10 Q7 26 10 28 h12 Q25 26 23 10Z" fill="#F3D9A8"/><path d="M9 10 h14 l-2 -4 h-10Z" fill="#E0BE82"/><path d="M12 8 h8" stroke="#B07A4F" stroke-width="2"/><ellipse cx="16" cy="19" rx="3.5" ry="5" fill="#6CC655"/><path d="M16 15 v8" stroke="#3E8E3A" stroke-width="1.2"/></svg>`,
  water:`<svg viewBox="0 0 32 32"><rect x="7" y="13" width="14" height="13" rx="3" fill="#3DA5F4"/><path d="M21 17 L29 11 L29 13.5 L22 20Z" fill="#2F8FD9"/><path d="M10 13 Q14 5 18 13" stroke="#2F8FD9" stroke-width="2.4" fill="none"/><circle cx="30" cy="16" r="1.3" fill="#9ED8FF"/><circle cx="28" cy="19" r="1.3" fill="#9ED8FF"/></svg>`,
  weed:`<svg viewBox="0 0 32 32"><path d="M8 26 L4 12 L10 20 L12 6 L15 20 L20 10 L18 26Z" fill="#3E9B3E"/><circle cx="23" cy="22" r="7" fill="#F2545B"/><path d="M20 22 h6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  bug:`<svg viewBox="0 0 32 32"><rect x="10" y="12" width="11" height="15" rx="3" fill="#7ED957"/><rect x="12" y="7" width="7" height="6" rx="1.5" fill="#5DB54A"/><path d="M19 9 h6 v3 h-3" fill="#5DB54A"/><rect x="12" y="16" width="7" height="6" rx="1.5" fill="#fff"/><circle cx="27" cy="7" r="1.2" fill="#B5E8A0"/><circle cx="29" cy="11" r="1.2" fill="#B5E8A0"/><circle cx="26" cy="14" r="1.2" fill="#B5E8A0"/></svg>`,
  shovel:`<svg viewBox="0 0 32 32"><rect x="14.5" y="3" width="3" height="16" rx="1.5" fill="#C98B5E"/><rect x="11" y="2" width="10" height="3.5" rx="1.7" fill="#A86F45"/><path d="M10 18 h12 v4 a6 6 0 0 1 -12 0Z" fill="#9AA6B2"/><path d="M12 19.5 h8" stroke="#C5CED6" stroke-width="1.5"/></svg>`,
};
const TOOLS = [['hand','收成'],['seed','播種'],['water','澆水'],['weed','除草'],['bug','除蟲'],['shovel','剷除']];
for(const k in ICONS) ICONS[k] = olc(ICONS[k]).replace(/stroke-width="2"/g,'stroke-width="1.3"');

/* ================= 工具函式 ================= */
const $ = id=>document.getElementById(id);
function dur(sec){ sec=Math.round(sec); const h=Math.floor(sec/3600), m=Math.round(sec%3600/60); if(h) return m?`${h}小時${m}分鐘`:`${h}小時`; if(sec>=60) return `${Math.round(sec/60)}分鐘`; return `${sec}秒`; }
function fmtS(sec){ sec=Math.max(0,Math.ceil(sec)); const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s=sec%60; const p=n=>String(n).padStart(2,'0'); if(h) return `${h}:${p(m)}:${p(s)}`; if(m) return `${m}:${p(s)}`; return `${s}秒`; }
function fmt(sec){
  sec = Math.max(0, Math.ceil(sec));
  const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s=sec%60;
  if(h) return `${h}小時${m}分`;
  if(m) return `${m}分${String(s).padStart(2,'0')}秒`;
  return `${s}秒`;
}
let toastT;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1800); }
function floatAt(el, text, color){
  const r = el.getBoundingClientRect();
  const f = document.createElement('div'); f.className='fl'; f.textContent=text; if(color) f.style.color=color;
  f.style.left = (r.left + r.width/2)+'px'; f.style.top = (r.top + r.height*0.3)+'px';
  document.body.appendChild(f); setTimeout(()=>f.remove(),1100);
}
/* ================= 視窗 ================= */
function modal(title, body, btns){
  $('md').innerHTML = `<h3><span>${title}</span><button class="x" id="mx">×</button></h3><div class="bd">${body}</div>${btns&&btns.length?'<div class="ft" id="mft"></div>':''}`;
  $('mx').onclick = closeModal;
  if(btns && btns.length){
    const ft=$('mft');
    btns.forEach(([t,cls,fn])=>{ const b=document.createElement('button'); b.className='btn '+(cls||''); b.textContent=t; b.onclick=fn; ft.appendChild(b); });
  }
  $('md').insertAdjacentHTML('beforeend','<button class="mmore" id="mMore">往下滑還有 ⌄</button>');
  const bd=$('md').querySelector('.bd'), mm=$('mMore');
  const upd=()=>{ const more = bd.scrollHeight - bd.scrollTop - bd.clientHeight > 24; mm.classList.toggle('on', more); $('md').classList.toggle('hasmore', more); };
  bd.addEventListener('scroll', upd, {passive:true}); mm.onclick=()=>bd.scrollBy({top:bd.clientHeight*0.7, behavior:'smooth'});
  bd.querySelectorAll('img').forEach(im=>{ if(!im.complete) im.addEventListener('load', upd, {once:true}); });
  $('ov').classList.add('show'); document.body.classList.add('modalopen'); upd(); setTimeout(upd, 120); setTimeout(upd, 600);
}
function closeModal(){ $('ov').classList.remove('show'); document.body.classList.remove('modalopen'); }
$('ov').addEventListener('click', e=>{ if(e.target.id==='ov') closeModal(); });

