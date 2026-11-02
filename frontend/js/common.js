const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
const rp=n=>'Rp'+Number(n).toLocaleString('id-ID');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABEL={baru:'Pesanan Diterima',diproses:'Diproses',dikemas:'Dikemas',siap:'Siap Diambil',diantar:'Sedang Diantar',selesai:'Selesai'};
const FLOW={ambil:['baru','diproses','dikemas','siap','selesai'],antar:['baru','diproses','dikemas','diantar','selesai'],cod:['baru','diproses','dikemas','diantar','selesai']};
const METODE={ambil:'Ambil ke toko',antar:'Antar ke rumah',cod:'COD (antar & bayar di tempat)'};
const mapsUrl=o=>o.lat?`https://www.google.com/maps?q=${o.lat},${o.lng}`:`https://www.google.com/maps/search/${encodeURIComponent(o.alamat||'')}`;

async function api(url,method='GET',body){
  const r=await fetch('/api'+url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||'Terjadi kesalahan, coba lagi.');
  return d;
}
function toast(t){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';document.body.append(e)}
  e.textContent=t;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),3200)}

async function initNav(){
  const me=await api('/me'), page=location.pathname.split('/').pop()||'beranda.html';
  const L=(h,t)=>`<li><a href="${h}" class="${page===h?'on':''}">${t}</a></li>`;
  let m=L('beranda.html','Beranda');
  if(me.role==='admin') m+=L('admin.html','Dashboard Admin');
  else m+=L('pesan.html','Buat Parcel')+(me.role==='user'?L('pesanan.html','Pesanan Saya'):'');
  m+=me.role?`<li><button id="out">Keluar (${esc(me.nama)})</button></li>`:L('masuk.html','Masuk');
  $('#menu').innerHTML=m;
  if($('#out'))$('#out').onclick=async()=>{await api('/logout','POST');location='beranda.html'};
  return me;
}
function paymentText(o){
  if(o.paid>=o.total) return {t:'Lunas ✓',c:'b-ok'};
  if(o.paid>0) return {t:`DP ${rp(o.paid)} · sisa ${rp(o.total-o.paid)}`,c:'b-wait'};
  return o.pay_type==='cod'?{t:'Bayar di tempat (COD)',c:'b-wait'}:{t:'Menunggu pembayaran',c:'b-new'};
}
function trackHTML(o){
  const f=FLOW[o.metode], i=f.indexOf(o.status);
  return '<div class="track">'+f.map((s,n)=>`<div class="tstep ${n<i?'done':n===i?'now':''}"><i>${n<i?'✓':n+1}</i>${LABEL[s]}</div>`).join('')+'</div>';
}
function Chat(box,id,role){
  box.innerHTML='<div class="msgs"></div><form class="cform"><input placeholder="Tulis pesan…" maxlength="500" required><button class="btn">Kirim</button></form>';
  const m=$('.msgs',box);let last=0;
  async function pull(){try{const d=await api(`/orders/${id}/chat?after=${last}`);
    d.forEach(x=>{last=x.id;m.insertAdjacentHTML('beforeend',`<div class="msg ${x.sender==='sys'?'sys':x.sender===role?'me':'them'}">${esc(x.text)}<small>${x.time}</small></div>`)});
    if(d.length)m.scrollTop=m.scrollHeight}catch(e){}}
  $('form',box).onsubmit=async e=>{e.preventDefault();const i=$('input',box);
    try{await api(`/orders/${id}/chat`,'POST',{text:i.value});i.value='';pull()}catch(x){toast(x.message)}};
  pull();const t=setInterval(()=>box.isConnected?pull():clearInterval(t),4000);
}

/* ===== Shell: tema, menu mobile, progress, tilt, loader ===== */
(function(){
  const root=document.documentElement;
  const setTheme=t=>{root.dataset.theme=t;try{localStorage.setItem('theme',t)}catch(e){}const b=$('#theme');if(b)b.textContent=t==='dark'?'🌙':'☀️'};
  setTheme(root.dataset.theme||'dark');
  $('#theme').onclick=()=>setTheme(root.dataset.theme==='dark'?'light':'dark');
  const h=$('#ham'),m=$('#menu'),close=()=>{h.classList.remove('active');m.classList.remove('active');document.body.style.overflow=''};
  h.onclick=()=>{const o=h.classList.toggle('active');m.classList.toggle('active',o);document.body.style.overflow=o?'hidden':''};
  m.addEventListener('click',e=>{if(e.target.closest('a,button'))close()});
  const nb=$('#navbar'),pg=$('#prog');
  const sc=()=>{nb.classList.toggle('scrolled',scrollY>20);pg.style.width=(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)*100)+'%'};
  addEventListener('scroll',sc,{passive:true});sc();
  if(matchMedia('(hover:hover)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    document.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest('.tilt');if(!c)return;const r=c.getBoundingClientRect();
      c.style.transform=`perspective(900px) rotateY(${((e.clientX-r.left)/r.width-.5)*7}deg) rotateX(${-((e.clientY-r.top)/r.height-.5)*7}deg) translateY(-3px)`});
    document.addEventListener('pointerout',e=>{const c=e.target.closest&&e.target.closest('.tilt');if(c&&!c.contains(e.relatedTarget))c.style.transform=''});
  }
  try{if(sessionStorage.intro)return;sessionStorage.intro=1}catch(e){return}
  const l=document.createElement('div');l.className='loader';l.innerHTML='<div class="loader-card"><div class="mark">🎁</div><b id="lc">0</b><div class="loader-bar"><i id="lb"></i></div></div>';document.body.append(l);
  let n=0;const t=setInterval(()=>{n=Math.min(100,n+7);$('#lc').textContent=n;$('#lb').style.width=n+'%';if(n>=100){clearInterval(t);setTimeout(()=>{l.classList.add('off');setTimeout(()=>l.remove(),700)},150)}},45);
})();

/* ===== Reveal saat scroll & konfeti ===== */
function reveal(){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});$$('.rv').forEach(el=>io.observe(el))}
function confetti(){
  const c=document.createElement('canvas');c.id='confetti';document.body.append(c);const x=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;
  const cols=['#ec4899','#8b5cf6','#34d399','#fcd34d','#60a5fa'];
  const P=Array.from({length:130},()=>({x:innerWidth/2,y:innerHeight*.45,vx:(Math.random()-.5)*16,vy:-Math.random()*15-4,s:5+Math.random()*7,r:Math.random()*6,c:cols[Math.random()*5|0]}));
  let f=0;(function t(){x.clearRect(0,0,c.width,c.height);P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.4;p.vx*=.99;p.r+=.2;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/3,p.s,p.s*.6);x.restore()});
    if(++f<150)requestAnimationFrame(t);else c.remove()})();
}
