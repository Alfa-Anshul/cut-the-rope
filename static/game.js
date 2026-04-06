// ============================================================
// CUT THE ROPE — Full Rewrite
// Physics: Verlet + Position-Based Dynamics, 12 substeps
// Graphics: Particle FX, glow, trails, cinematic Om Nom
// ============================================================

// ===== GLOBAL STATE =====
let session = JSON.parse(localStorage.getItem('ctr_session') || 'null');
let progress = {};
let currentLevel = 1;
let gameEngine = null;
const TOTAL_LEVELS = 8;
const LEVEL_NAMES = ['Tutorial','Two Ropes','Danger Zone','Triple Threat','Balloon Rush','Complex','Expert','Master'];

window.onload = () => {
  if (session) { loadProgress().then(() => { showScreen('menuScreen'); updateMenuUI(); }); }
  else showScreen('authScreen');
};

// ===== NAVIGATION =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'levelScreen') renderLevelSelect();
  if (id === 'menuScreen') updateMenuUI();
  if (id !== 'gameScreen' && gameEngine) { gameEngine.destroy(); gameEngine = null; }
}

// ===== AUTH =====
function switchTab(t) {
  document.getElementById('loginForm').style.display = t==='login'?'':'none';
  document.getElementById('registerForm').style.display = t==='register'?'':'none';
  document.getElementById('tabLogin').classList.toggle('active', t==='login');
  document.getElementById('tabReg').classList.toggle('active', t==='register');
  document.getElementById('authError').textContent='';
}
async function doLogin() {
  const u=document.getElementById('loginUser').value.trim(), p=document.getElementById('loginPass').value;
  if(!u||!p) return setErr('Fill all fields');
  try {
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
    const d=await r.json();
    if(!r.ok) return setErr(d.detail||'Login failed');
    session={token:d.token,username:d.username,user_id:d.user_id};
    localStorage.setItem('ctr_session',JSON.stringify(session));
    await loadProgress(); showScreen('menuScreen');
  } catch(e){setErr('Network error');}
}
async function doRegister() {
  const u=document.getElementById('regUser').value.trim(),e2=document.getElementById('regEmail').value.trim(),p=document.getElementById('regPass').value;
  if(!u||!e2||!p) return setErr('Fill all fields');
  try {
    const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,email:e2,password:p})});
    const d=await r.json();
    if(!r.ok) return setErr(d.detail||'Registration failed');
    session={token:d.token,username:d.username,user_id:d.user_id};
    localStorage.setItem('ctr_session',JSON.stringify(session));
    progress={}; showScreen('menuScreen'); showToast('Welcome '+u+'! 🎉');
  } catch(e){setErr('Network error');}
}
function logout(){session=null;progress={};localStorage.removeItem('ctr_session');showScreen('authScreen');}
function setErr(m){document.getElementById('authError').textContent=m;}

async function loadProgress(){
  if(!session)return;
  try{const r=await fetch('/api/progress?token='+session.token);const d=await r.json();progress={};d.progress.forEach(p=>progress[p.level]=p);}catch(e){}
}
function updateMenuUI(){
  if(!session)return;
  document.getElementById('menuAvatar').textContent=session.username[0].toUpperCase();
  document.getElementById('menuName').textContent=session.username;
  const st=Object.values(progress).reduce((s,p)=>s+p.stars,0);
  const co=Object.keys(progress).length;
  document.getElementById('menuStat').textContent=co+'/'+TOTAL_LEVELS+' levels · '+st+'⭐ total stars';
}

// ===== LEVEL SELECT =====
function renderLevelSelect(){
  const g=document.getElementById('levelsGrid'); g.innerHTML='';
  for(let i=1;i<=TOTAL_LEVELS;i++){
    const p=progress[i], unlocked=i===1||progress[i-1];
    const d=document.createElement('div');
    d.className='level-card'+(p?' completed':'')+(unlocked?'':' locked');
    const st=p?p.stars:0;
    d.innerHTML='<div class="level-num">'+i+'</div><div class="level-label">'+(LEVEL_NAMES[i-1]||'Level '+i)+'</div><div class="level-stars">'+[1,2,3].map(s=>'<span class="lstar'+(st>=s?' lit':'')+'">★</span>').join('')+'</div>'+(unlocked?'':'<div style="font-size:1.5rem;margin-top:6px">🔒</div>');
    if(unlocked) d.onclick=()=>startLevel(i);
    g.appendChild(d);
  }
}

// ===== LEADERBOARD =====
async function showLeaderboard(){
  showScreen('lbScreen');
  const el=document.getElementById('lbList');
  el.innerHTML='<div class="lb-empty">Loading...</div>';
  try{
    const r=await fetch('/api/leaderboard'),d=await r.json();
    if(!d.leaderboard.length){el.innerHTML='<div class="lb-empty">No scores yet! Be the first 🎮</div>';return;}
    el.innerHTML=d.leaderboard.map((e,i)=>`
      <div class="lb-row ${i===0?'top1':i===1?'top2':i===2?'top3':''}">
        <div class="lb-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
        <div class="lb-av">${e.username[0].toUpperCase()}</div>
        <div class="lb-name">${e.username}</div>
        <div class="lb-right"><div class="lb-sc">${e.total.toLocaleString()}</div><div class="lb-st">${'★'.repeat(Math.min(e.stars,10))}</div></div>
      </div>`).join('');
  }catch(e){el.innerHTML='<div class="lb-empty">Failed to load</div>';}
}

// ===== GAME CONTROL =====
function startLevel(level){
  currentLevel=level;
  showScreen('gameScreen');
  document.getElementById('hudLevel').textContent='Level '+level;
  document.getElementById('gameOverlay').classList.remove('show');
  if(gameEngine) gameEngine.destroy();
  gameEngine=new GameEngine('gameCanvas',level,onLevelComplete,onLevelFail);
  gameEngine.start();
}
function quitGame(){if(gameEngine){gameEngine.destroy();gameEngine=null;}loadProgress().then(()=>showScreen('levelScreen'));}
function retryLevel(){document.getElementById('gameOverlay').classList.remove('show');startLevel(currentLevel);}
function nextLevel(){if(currentLevel<TOTAL_LEVELS)startLevel(currentLevel+1);else showScreen('menuScreen');}

async function onLevelComplete(stars,score){
  document.getElementById('overlayTitle').textContent=stars===3?'🎉 Perfect!':stars===2?'🌟 Great!':'✅ Done!';
  document.getElementById('overlayStars').innerHTML=[1,2,3].map(s=>'<span>'+(stars>=s?'⭐':'☆')+'</span>').join('');
  document.getElementById('overlayScore').textContent='Score: '+score.toLocaleString();
  document.getElementById('btnNext').style.display=currentLevel<TOTAL_LEVELS?'':'none';
  document.getElementById('gameOverlay').classList.add('show');
  if(session){try{await fetch('/api/score',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:session.token,level:currentLevel,stars,score})});await loadProgress();}catch(e){}}
  showToast(stars===3?'🌟 PERFECT! 3 Stars!':'✅ Level Complete!');
  spawnParticles();
}
function onLevelFail(){
  document.getElementById('overlayTitle').textContent='💀 Try Again!';
  document.getElementById('overlayStars').innerHTML='☆☆☆';
  document.getElementById('overlayScore').textContent='';
  document.getElementById('btnNext').style.display='none';
  document.getElementById('gameOverlay').classList.add('show');
}

function updateHud(ropes,score){
  document.getElementById('hudRopes').textContent='✂️ Ropes: '+ropes;
  document.getElementById('hudScore').textContent=score.toLocaleString();
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

function spawnParticles(){
  const emojis=['⭐','✨','🎉','🌟','💫'];
  for(let i=0;i<12;i++){
    setTimeout(()=>{
      const el=document.createElement('div');
      el.className='particle';
      el.textContent=emojis[Math.floor(Math.random()*emojis.length)];
      el.style.left=Math.random()*100+'vw';
      el.style.top=Math.random()*100+'vh';
      el.style.setProperty('--tx',(Math.random()-0.5)*200+'px');
      el.style.setProperty('--ty',-(Math.random()*200+50)+'px');
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),1300);
    },i*80);
  }
}

// ================================================================
//  GAME ENGINE — Verlet PBD Physics, 12 substeps, particle FX
// ================================================================

// Physics constants — FAST & SATISFYING
const G          = 1800;    // gravity px/s² — strong, snappy
const DAMPING    = 0.9992;  // per-substep velocity retention
const SUBSTEPS   = 12;      // constraint iterations per frame
const ROPE_SEG   = 12;      // rope segments per rope

class GameEngine {
  constructor(canvasId, level, onComplete, onFail) {
    this.canvas=document.getElementById(canvasId);
    this.ctx=this.canvas.getContext('2d');
    this.level=level; this.onComplete=onComplete; this.onFail=onFail;
    this.running=false; this.animId=null;
    this.score=0; this.starsCollected=0;
    this.pts=[]; this.sticks=[];
    this.ropes=[]; this.balloons=[]; this.spikes=[]; this.collectibles=[];
    this.candy=null; this.omnom=null;
    this.cutLine=null; this.gameOver=false; this.won=false;
    this.particles=[]; this.trail=[];
    this.lastTime=0;
    this.resize();
    this._rf=()=>this.resize(); window.addEventListener('resize',this._rf);
    this.bindInput();
  }

  resize(){
    const hud=document.querySelector('.game-hud');
    const hh=hud?hud.offsetHeight:50;
    this.W=Math.min(window.innerWidth,420);
    this.H=window.innerHeight-hh;
    this.canvas.width=this.W; this.canvas.height=this.H;
  }

  start(){this.running=true;this.loadLevel(this.level);this.lastTime=performance.now();this.loop(this.lastTime);}

  destroy(){
    this.running=false;
    if(this.animId)cancelAnimationFrame(this.animId);
    window.removeEventListener('resize',this._rf);
    this.canvas.onmousedown=this.canvas.onmousemove=this.canvas.onmouseup=null;
    this.canvas.ontouchstart=this.canvas.ontouchmove=this.canvas.ontouchend=null;
  }

  bindInput(){
    const gp=e=>{const r=this.canvas.getBoundingClientRect();return{x:(e.clientX??e.pageX)-r.left,y:(e.clientY??e.pageY)-r.top};};
    this.canvas.onmousedown=e=>{const p=gp(e);this.cutLine={x1:p.x,y1:p.y,x2:p.x,y2:p.y};};
    this.canvas.onmousemove=e=>{if(this.cutLine){const p=gp(e);this.cutLine.x2=p.x;this.cutLine.y2=p.y;this.tryCut();}};
    this.canvas.onmouseup=()=>{this.cutLine=null;};
    this.canvas.ontouchstart=e=>{e.preventDefault();const p=gp(e.touches[0]);this.cutLine={x1:p.x,y1:p.y,x2:p.x,y2:p.y};};
    this.canvas.ontouchmove=e=>{e.preventDefault();if(this.cutLine){const p=gp(e.touches[0]);this.cutLine.x2=p.x;this.cutLine.y2=p.y;this.tryCut();}};
    this.canvas.ontouchend=e=>{e.preventDefault();this.cutLine=null;};
  }

  // ---- Point & Stick helpers ----
  mkPt(x,y,pin=false){const p={x,y,px:x,py:y,pin};this.pts.push(p);return p;}
  mkStick(a,b){const dx=a.x-b.x,dy=a.y-b.y,l=Math.sqrt(dx*dx+dy*dy);const s={a,b,l,broken:false};this.sticks.push(s);return s;}

  mkRope(ax,ay,cpt,N){
    const pts=[this.mkPt(ax,ay,true)];
    for(let i=1;i<N;i++){
      const t=i/N;
      pts.push(this.mkPt(ax+(cpt.x-ax)*t, ay+(cpt.y-ay)*t));
    }
    pts.push(cpt);
    const segs=[];
    for(let i=0;i<pts.length-1;i++) segs.push(this.mkStick(pts[i],pts[i+1]));
    return {pts,segs,cut:false,cutAnim:0};
  }

  // ---- Level layouts ----
  loadLevel(n){
    this.pts=[]; this.sticks=[];
    this.ropes=[]; this.balloons=[]; this.spikes=[]; this.collectibles=[];
    this.score=0; this.gameOver=false; this.won=false; this.starsCollected=0;
    this.particles=[]; this.trail=[];
    const W=this.W,H=this.H;

    const mkC=(x,y)=>{const p=this.mkPt(x,y);p.mass=1;return p;};
    const star=(x,y)=>({x,y,r:13,col:false,pop:0,bob:Math.random()*Math.PI*2,rot:0});
    const spike=(x,y,r=34)=>({x,y,r,rot:0});

    const L=[
      ()=>{const c=mkC(W/2,H*.2);this.candy={pt:c,r:20};this.omnom={x:W/2,y:H*.84};
        this.ropes.push(this.mkRope(W/2,8,c,ROPE_SEG));
        this.collectibles.push(star(W/2,H*.5));},
      ()=>{const c=mkC(W/2,H*.26);this.candy={pt:c,r:20};this.omnom={x:W/2,y:H*.84};
        this.ropes.push(this.mkRope(W*.2,8,c,ROPE_SEG));
        this.ropes.push(this.mkRope(W*.8,8,c,ROPE_SEG));
        this.collectibles.push(star(W/2,H*.46),star(W*.28,H*.64));},
      ()=>{const c=mkC(W/2,H*.2);this.candy={pt:c,r:20};this.omnom={x:W/2,y:H*.84};
        this.ropes.push(this.mkRope(W*.28,8,c,ROPE_SEG));
        this.ropes.push(this.mkRope(W*.72,8,c,ROPE_SEG));
        this.spikes.push(spike(W/2,H*.56));
        this.collectibles.push(star(W*.18,H*.5),star(W/2,H*.37),star(W*.82,H*.5));},
      ()=>{const c=mkC(W/2,H*.26);this.candy={pt:c,r:20};this.omnom={x:W/2,y:H*.84};
        this.ropes.push(this.mkRope(W*.15,8,c,ROPE_SEG));
        this.ropes.push(this.mkRope(W*.5,8,c,8));
        this.ropes.push(this.mkRope(W*.85,8,c,ROPE_SEG));
        this.spikes.push(spike(W*.25,H*.6,30),spike(W*.75,H*.6,30));
        this.collectibles.push(star(W/2,H*.52),star(W*.16,H*.7),star(W*.84,H*.7));},
      ()=>{const c=mkC(W/2,H*.58);this.candy={pt:c,r:20};this.omnom={x:W/2,y:H*.84};
        this.ropes.push(this.mkRope(W*.5,8,c,16));
        this.balloons.push({x:W*.34,y:H*.26,pt:c,cut:false,cutAnim:0,col:'#FF6B6B',bob:0});
        this.balloons.push({x:W*.66,y:H*.26,pt:c,cut:false,cutAnim:0,col:'#4ECDC4',bob:Math.PI});
        this.spikes.push(spike(W*.16,H*.76,28),spike(W*.84,H*.76,28));
        this.collectibles.push(star(W/2,H*.42),star(W*.24,H*.55),star(W*.76,H*.55));},
      ()=>{const c=mkC(W*.72,H*.24);this.candy={pt:c,r:20};this.omnom={x:W*.28,y:H*.84};
        this.ropes.push(this.mkRope(W*.5,8,c,ROPE_SEG));
        this.ropes.push(this.mkRope(W*.92,8,c,10));
        this.balloons.push({x:W*.72,y:H*.1,pt:c,cut:false,cutAnim:0,col:'#FFEAA7',bob:0});
        this.spikes.push(spike(W*.5,H*.58,32),spike(W*.7,H*.7,26));
        this.collectibles.push(star(W*.22,H*.42),star(W*.5,H*.38),star(W*.72,H*.58));},
      ()=>{const c=mkC(W/2,H*.16);this.candy={pt:c,r:20};this.omnom={x:W/2,y:H*.84};
        this.ropes.push(this.mkRope(W*.1,8,c,16));
        this.ropes.push(this.mkRope(W*.5,8,c,12));
        this.ropes.push(this.mkRope(W*.9,8,c,16));
        this.balloons.push({x:W*.28,y:H*.07,pt:c,cut:false,cutAnim:0,col:'#96CEB4',bob:0});
        this.balloons.push({x:W*.72,y:H*.07,pt:c,cut:false,cutAnim:0,col:'#FF6B6B',bob:Math.PI});
        this.spikes.push(spike(W*.2,H*.48,34),spike(W*.5,H*.62,34),spike(W*.8,H*.48,34));
        this.collectibles.push(star(W*.5,H*.34),star(W*.2,H*.3),star(W*.8,H*.3));},
      ()=>{const c=mkC(W/2,H*.13);this.candy={pt:c,r:20};this.omnom={x:W/2,y:H*.86};
        [W*.08,W*.32,W*.68,W*.92].forEach(ax=>this.ropes.push(this.mkRope(ax,8,c,ROPE_SEG+4)));
        [{x:W*.2,col:'#4ECDC4'},{x:W*.5,col:'#FFD700'},{x:W*.8,col:'#FF6B6B'}].forEach((b,i)=>
          this.balloons.push({x:b.x,y:H*.05,pt:c,cut:false,cutAnim:0,col:b.col,bob:i*2.1}));
        [W*.15,W*.38,W*.62,W*.85].forEach(bx=>this.spikes.push(spike(bx,H*.46,30)));
        this.collectibles.push(star(W*.5,H*.3),star(W*.25,H*.28),star(W*.75,H*.28));},
    ];
    (L[n-1]||L[0])();
    updateHud(this.activeRopes(),0);
  }

  activeRopes(){return this.ropes.filter(r=>!r.cut).length+this.balloons.filter(b=>!b.cut).length;}

  // ---- Cut detection ----
  tryCut(){
    if(!this.cutLine)return;
    const{x1,y1,x2,y2}=this.cutLine;
    this.ropes.forEach(rope=>{
      if(rope.cut)return;
      for(const s of rope.segs){
        if(s.broken)continue;
        if(segX(x1,y1,x2,y2,s.a.x,s.a.y,s.b.x,s.b.y)){
          rope.cut=true; rope.cutAnim=20;
          rope.segs.forEach(k=>k.broken=true);
          // impulse to candy
          const cp=this.candy.pt;
          const vx=x2-x1,vy=y2-y1,spd=Math.sqrt(vx*vx+vy*vy)||1;
          cp.px-=(vx/spd)*4; cp.py-=(vy/spd)*2;
          this.score+=50; updateHud(this.activeRopes(),this.score);
          this.spawnCutFX(s.a.x+(s.b.x-s.a.x)*.5, s.a.y+(s.b.y-s.a.y)*.5);
          break;
        }
      }
    });
    this.balloons.forEach(b=>{
      if(b.cut)return;
      if(segX(x1,y1,x2,y2,b.pt.x,b.pt.y,b.x,b.y)){
        b.cut=true; b.cutAnim=20;
        this.score+=50; updateHud(this.activeRopes(),this.score);
        this.spawnCutFX(b.x,b.y);
      }
    });
  }

  spawnCutFX(x,y){
    for(let i=0;i<10;i++){
      const a=Math.random()*Math.PI*2, spd=80+Math.random()*200;
      this.particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
        life:1,maxLife:1,r:2+Math.random()*3,col:`hsl(${20+Math.random()*40},100%,65%)`});
    }
  }

  // ---- Main loop ----
  loop(ts){
    if(!this.running)return;
    const dt=Math.min((ts-this.lastTime)/1000,0.04);
    this.lastTime=ts;
    this.update(dt);
    this.draw();
    this.animId=requestAnimationFrame(t=>this.loop(t));
  }

  update(dt){
    if(this.gameOver||this.won)return;
    const cp=this.candy.pt;
    const abBal=this.balloons.filter(b=>!b.cut).length;
    const netG=G-abBal*520; // buoyancy

    const sub=dt/SUBSTEPS;
    for(let s=0;s<SUBSTEPS;s++){
      // Integrate all points
      this.pts.forEach(p=>{
        if(p.pin)return;
        const grav=(p===cp)?netG:G;
        const vx=(p.x-p.px)*DAMPING, vy=(p.y-p.py)*DAMPING;
        p.px=p.x; p.py=p.y;
        p.x+=vx; p.y+=vy+grav*sub*sub;
      });
      // Solve sticks
      this.sticks.forEach(s=>{
        if(s.broken)return;
        const dx=s.b.x-s.a.x, dy=s.b.y-s.a.y;
        const d=Math.sqrt(dx*dx+dy*dy)||0.001;
        const diff=(d-s.l)/d*0.5;
        const ox=dx*diff, oy=dy*diff;
        if(!s.a.pin){s.a.x+=ox;s.a.y+=oy;}
        if(!s.b.pin){s.b.x-=ox;s.b.y-=oy;}
      });
    }

    // Trail
    this.trail.push({x:cp.x,y:cp.y,t:1});
    if(this.trail.length>20) this.trail.shift();
    this.trail.forEach(t=>t.t-=dt*3);

    // Particles
    this.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;p.life-=dt*2;});
    this.particles=this.particles.filter(p=>p.life>0);

    // Collectible bob
    this.collectibles.forEach(c=>{c.bob+=dt*2.5;c.rot+=dt*3;});

    // Collect stars
    this.collectibles.forEach(c=>{
      if(!c.col&&vd(cp.x,cp.y,c.x,c.y)<c.r+this.candy.r+6){
        c.col=true;c.pop=25;this.starsCollected++;this.score+=200;
        updateHud(this.activeRopes(),this.score);
        for(let i=0;i<15;i++){const a=Math.random()*Math.PI*2,sp=100+Math.random()*300;
          this.particles.push({x:c.x,y:c.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,maxLife:1,r:3,col:'#FFD700'});}
      }
      if(c.pop>0)c.pop-=dt*40;
    });

    // Spike death
    this.spikes.forEach(sp=>{
      if(vd(cp.x,cp.y,sp.x,sp.y)<sp.r+this.candy.r-6){
        if(!this.gameOver){this.gameOver=true;this.deathFX(cp.x,cp.y);setTimeout(()=>this.onFail(),900);}
      }
    });

    // Feed Om Nom
    if(this.omnom&&vd(cp.x,cp.y,this.omnom.x,this.omnom.y)<46){
      if(!this.won){this.won=true;this.omnom.eating=true;this.score+=this.starsCollected*100+400;
        setTimeout(()=>this.onComplete(this.starsCollected,this.score),800);}
    }

    // OOB
    if(cp.y>this.H+150||cp.x<-180||cp.x>this.W+180){
      if(!this.gameOver){this.gameOver=true;setTimeout(()=>this.onFail(),300);}
    }

    this.omnom&&(this.omnom.t=(this.omnom.t||0)+dt);
  }

  deathFX(x,y){
    for(let i=0;i<30;i++){
      const a=Math.random()*Math.PI*2,sp=80+Math.random()*400;
      this.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,maxLife:1,r:3+Math.random()*4,col:`hsl(${Math.random()*30},100%,60%)`});
    }
  }

  // ---- Draw ----
  draw(){
    const ctx=this.ctx,W=this.W,H=this.H,now=performance.now();

    // BG
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#0a0818'); bg.addColorStop(0.5,'#0d0c20'); bg.addColorStop(1,'#140a24');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // Subtle star field
    ctx.fillStyle='rgba(255,255,255,0.35)';
    for(let i=0;i<30;i++){
      const sx=((i*137.5)%1)*W, sy=((i*97.3)%1)*H;
      const sz=0.5+((i*53.1)%1)*1.5;
      const tw=Math.sin(now*.001+i)*0.5+0.5;
      ctx.globalAlpha=0.1+tw*0.25;
      ctx.beginPath();ctx.arc(sx,sy,sz,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;

    // Glow blobs
    const drawBlob=(x,y,r,col)=>{
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,col); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.fillRect(x-r,y-r,r*2,r*2);
    };
    if(this.candy){drawBlob(this.candy.pt.x,this.candy.pt.y,80,'rgba(255,107,53,0.06)');}
    if(this.omnom){drawBlob(this.omnom.x,this.omnom.y,100,'rgba(74,222,128,0.05)');}

    // Trail
    this.trail.forEach((t,i)=>{
      if(t.t<=0)return;
      ctx.beginPath();ctx.arc(t.x,t.y,3*(i/this.trail.length),0,Math.PI*2);
      ctx.fillStyle=`rgba(255,140,80,${t.t*0.4*(i/this.trail.length)})`;ctx.fill();
    });

    // Particles
    this.particles.forEach(p=>{
      ctx.globalAlpha=p.life;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.col;ctx.fill();
    });
    ctx.globalAlpha=1;

    // Spikes
    this.spikes.forEach(sp=>{
      sp.rot+=0.012;
      ctx.save();ctx.translate(sp.x,sp.y);ctx.rotate(sp.rot);
      // Outer glow
      const sg=ctx.createRadialGradient(0,0,sp.r*.4,0,0,sp.r*1.5);
      sg.addColorStop(0,'rgba(231,76,60,0.25)');sg.addColorStop(1,'transparent');
      ctx.fillStyle=sg;ctx.beginPath();ctx.arc(0,0,sp.r*1.5,0,Math.PI*2);ctx.fill();
      // Spike body
      ctx.beginPath();
      for(let i=0;i<8;i++){const a=i*Math.PI/4,b=a+Math.PI/8;
        ctx.lineTo(Math.cos(a)*sp.r,Math.sin(a)*sp.r);
        ctx.lineTo(Math.cos(b)*sp.r*.35,Math.sin(b)*sp.r*.35);}
      ctx.closePath();
      const sg2=ctx.createRadialGradient(-sp.r*.3,-sp.r*.3,0,0,0,sp.r);
      sg2.addColorStop(0,'#ff6b6b');sg2.addColorStop(0.5,'#e74c3c');sg2.addColorStop(1,'#8b0000');
      ctx.fillStyle=sg2;ctx.shadowColor='#e74c3c';ctx.shadowBlur=20;ctx.fill();
      ctx.restore();
    });
    ctx.shadowBlur=0;

    // Stars / collectibles
    this.collectibles.forEach(c=>{
      if(c.col&&c.pop<=0)return;
      ctx.save();
      const b=Math.sin(c.bob)*7;
      ctx.translate(c.x,c.y+b);ctx.rotate(c.rot);
      if(c.col){ctx.scale(1+c.pop*.04);ctx.globalAlpha=Math.max(0,c.pop/25);}
      // Glow
      const sg=ctx.createRadialGradient(0,0,0,0,0,c.r*2.5);
      sg.addColorStop(0,'rgba(255,215,0,0.5)');sg.addColorStop(1,'transparent');
      ctx.fillStyle=sg;ctx.beginPath();ctx.arc(0,0,c.r*2.5,0,Math.PI*2);ctx.fill();
      // Star shape
      ctx.beginPath();
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b2=a+Math.PI/5;
        if(i===0)ctx.moveTo(Math.cos(a)*c.r,Math.sin(a)*c.r);
        else ctx.lineTo(Math.cos(a)*c.r,Math.sin(a)*c.r);
        ctx.lineTo(Math.cos(b2)*c.r*.42,Math.sin(b2)*c.r*.42);}
      ctx.closePath();
      const sg2=ctx.createRadialGradient(-c.r*.3,-c.r*.3,0,0,0,c.r);
      sg2.addColorStop(0,'#fff7a0');sg2.addColorStop(0.4,'#FFD700');sg2.addColorStop(1,'#cc8800');
      ctx.fillStyle=sg2;ctx.shadowColor='#FFD700';ctx.shadowBlur=18;ctx.fill();
      ctx.restore();ctx.shadowBlur=0;
    });

    // Ropes (multi-segment smooth curve)
    this.ropes.forEach(rope=>{
      if(rope.cut&&rope.cutAnim<=0)return;
      ctx.save();
      if(rope.cut){ctx.globalAlpha=rope.cutAnim/20;rope.cutAnim--;}
      const ps=rope.pts;
      // Shadow
      ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);
      for(let i=1;i<ps.length-1;i++){const mx=(ps[i].x+ps[i+1].x)/2,my=(ps[i].y+ps[i+1].y)/2;ctx.quadraticCurveTo(ps[i].x,ps[i].y,mx,my);}
      ctx.lineTo(ps[ps.length-1].x,ps[ps.length-1].y);
      ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=7;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
      // Main rope
      ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);
      for(let i=1;i<ps.length-1;i++){const mx=(ps[i].x+ps[i+1].x)/2,my=(ps[i].y+ps[i+1].y)/2;ctx.quadraticCurveTo(ps[i].x,ps[i].y,mx,my);}
      ctx.lineTo(ps[ps.length-1].x,ps[ps.length-1].y);
      const rg=ctx.createLinearGradient(ps[0].x,ps[0].y,ps[ps.length-1].x,ps[ps.length-1].y);
      rg.addColorStop(0,'#a0522d');rg.addColorStop(0.5,'#c67c3a');rg.addColorStop(1,'#8B4513');
      ctx.strokeStyle=rg;ctx.lineWidth=5;ctx.shadowColor='rgba(100,50,10,0.4)';ctx.shadowBlur=4;ctx.stroke();
      // Highlight
      ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);
      for(let i=1;i<ps.length-1;i++){const mx=(ps[i].x+ps[i+1].x)/2,my=(ps[i].y+ps[i+1].y)/2;ctx.quadraticCurveTo(ps[i].x,ps[i].y,mx,my);}
      ctx.lineTo(ps[ps.length-1].x,ps[ps.length-1].y);
      ctx.strokeStyle='rgba(240,180,100,0.3)';ctx.lineWidth=2;ctx.shadowBlur=0;ctx.stroke();
      // Nail
      const nail=ps[0];
      ctx.beginPath();ctx.arc(nail.x,nail.y,8,0,Math.PI*2);
      const ng=ctx.createRadialGradient(nail.x-2,nail.y-2,1,nail.x,nail.y,8);
      ng.addColorStop(0,'#ddd');ng.addColorStop(1,'#666');
      ctx.fillStyle=ng;ctx.shadowColor='#000';ctx.shadowBlur=8;ctx.fill();
      ctx.beginPath();ctx.arc(nail.x-2,nail.y-2,2,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fill();
      ctx.restore();ctx.shadowBlur=0;
    });

    // Balloons
    this.balloons.forEach(b=>{
      if(b.cut&&b.cutAnim<=0)return;
      ctx.save();
      if(b.cut){ctx.globalAlpha=b.cutAnim/20;b.cutAnim--;}
      const bob=Math.sin(now*.0018+b.bob)*6;
      const bx=b.x,by=b.y+bob,cx=b.pt.x,cy=b.pt.y;
      // String (wavy)
      ctx.beginPath();ctx.moveTo(cx,cy);
      ctx.quadraticCurveTo(bx+Math.sin(now*.001)*8,by+(cy-by)*.5,bx,by+26);
      ctx.strokeStyle='rgba(220,220,220,0.5)';ctx.lineWidth=1.5;ctx.shadowBlur=0;ctx.stroke();
      // Balloon glow
      const bg2=ctx.createRadialGradient(bx,by,5,bx,by,30);
      bg2.addColorStop(0,b.col+'88');bg2.addColorStop(1,'transparent');
      ctx.fillStyle=bg2;ctx.beginPath();ctx.arc(bx,by,30,0,Math.PI*2);ctx.fill();
      // Balloon body
      ctx.beginPath();ctx.ellipse(bx,by,20,26,0,0,Math.PI*2);
      const bg3=ctx.createRadialGradient(bx-7,by-9,2,bx,by,22);
      bg3.addColorStop(0,'#fff');bg3.addColorStop(0.2,b.col);bg3.addColorStop(1,b.col+'99');
      ctx.fillStyle=bg3;ctx.shadowColor=b.col;ctx.shadowBlur=22;ctx.fill();
      // Shine
      ctx.beginPath();ctx.ellipse(bx-7,by-9,7,10,-.4,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.4)';ctx.shadowBlur=0;ctx.fill();
      // Knot
      ctx.beginPath();ctx.arc(bx,by+26,4,0,Math.PI*2);ctx.fillStyle=b.col;ctx.fill();
      ctx.restore();ctx.shadowBlur=0;
    });

    // Om Nom
    if(this.omnom) this.drawOmNom(ctx,this.omnom,now);

    // Candy — with glow + wobble
    if(this.candy){
      const cp=this.candy.pt,R=this.candy.r;
      const vx=cp.x-cp.px,vy=cp.y-cp.py;
      const spd=Math.sqrt(vx*vx+vy*vy);
      const angle=Math.atan2(vy,vx);
      // stretch/squash based on speed
      const strX=1+Math.min(spd*.008,.25);
      const strY=1/strX;
      ctx.save();ctx.translate(cp.x,cp.y);ctx.rotate(angle);ctx.scale(strX,strY);ctx.rotate(-angle);
      // Outer glow
      const cg=ctx.createRadialGradient(0,0,R*.5,0,0,R*2.5);
      cg.addColorStop(0,'rgba(255,107,53,0.4)');cg.addColorStop(1,'transparent');
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(0,0,R*2.5,0,Math.PI*2);ctx.fill();
      // Body
      ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);
      const cg2=ctx.createRadialGradient(-R*.4,-R*.4,R*.1,0,0,R);
      cg2.addColorStop(0,'#FF9A42');cg2.addColorStop(0.4,'#FF6B35');cg2.addColorStop(0.8,'#E04800');cg2.addColorStop(1,'#8B2200');
      ctx.fillStyle=cg2;ctx.shadowColor='#FF6B35';ctx.shadowBlur=28;ctx.fill();
      // Swirl lines
      ctx.save();ctx.rotate(now*.002);ctx.strokeStyle='rgba(255,200,150,0.4)';ctx.lineWidth=1.5;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,R*.55+i*2,0,Math.PI*1.2);ctx.stroke();}
      ctx.restore();
      // Shine
      ctx.beginPath();ctx.ellipse(-R*.3,-R*.35,R*.35,R*.22,-.6,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.55)';ctx.shadowBlur=0;ctx.fill();
      // Mini shine
      ctx.beginPath();ctx.arc(-R*.1,-R*.5,R*.1,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fill();
      ctx.restore();ctx.shadowBlur=0;
    }

    // Cut swipe
    if(this.cutLine){
      ctx.save();
      ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=3;
      ctx.setLineDash([8,5]);ctx.lineDashOffset=-now*.05;
      ctx.shadowColor='#fff';ctx.shadowBlur=14;
      ctx.beginPath();ctx.moveTo(this.cutLine.x1,this.cutLine.y1);ctx.lineTo(this.cutLine.x2,this.cutLine.y2);ctx.stroke();
      ctx.restore();ctx.shadowBlur=0;
    }
  }

  drawOmNom(ctx,o,now){
    ctx.save();
    const bob=Math.sin((o.t||0)*3)*4;
    ctx.translate(o.x,o.y+bob);
    const mouth=o.eating?.92:(0.18+Math.sin((o.t||0)*5)*.16);
    const R=30;
    // Ground shadow
    ctx.beginPath();ctx.ellipse(0,R+4,R*.85,R*.28,0,0,Math.PI*2);
    const sh=ctx.createRadialGradient(0,R+4,0,0,R+4,R*.85);
    sh.addColorStop(0,'rgba(0,0,0,0.35)');sh.addColorStop(1,'transparent');
    ctx.fillStyle=sh;ctx.fill();
    // Body glow
    const bg=ctx.createRadialGradient(0,0,R*.3,0,0,R*2);
    bg.addColorStop(0,'rgba(74,222,128,0.25)');bg.addColorStop(1,'transparent');
    ctx.fillStyle=bg;ctx.beginPath();ctx.arc(0,0,R*2,0,Math.PI*2);ctx.fill();
    // Body
    ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);
    const bg2=ctx.createRadialGradient(-R*.4,-R*.4,R*.1,0,0,R);
    bg2.addColorStop(0,'#90ee90');bg2.addColorStop(0.4,'#6bcb77');bg2.addColorStop(0.7,'#4aba5a');bg2.addColorStop(1,'#2d8040');
    ctx.fillStyle=bg2;ctx.shadowColor='#6bcb77';ctx.shadowBlur=22;ctx.fill();ctx.shadowBlur=0;
    // Belly
    ctx.beginPath();ctx.ellipse(0,R*.3,R*.55,R*.4,0,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fill();
    // Mouth (open wedge)
    ctx.save();
    ctx.beginPath();ctx.moveTo(0,R*.15);
    ctx.arc(0,R*.35,R*.55,-Math.PI/2-mouth,-Math.PI/2+mouth);
    ctx.closePath();
    ctx.fillStyle=o.eating?'#cc3333':'#dd4444';ctx.fill();
    // Teeth
    if(!o.eating){
      ctx.fillStyle='#fff';
      for(let i=-1;i<=1;i++){ctx.fillRect(i*R*.18,R*.6,R*.14,R*.2);}
    }
    // Tongue
    ctx.beginPath();ctx.ellipse(0,R*.7,R*.22,R*.14,0,0,Math.PI*2);
    ctx.fillStyle='#ee7777';ctx.fill();
    ctx.restore();
    // Eyes
    [-R*.38,R*.38].forEach((ex,ei)=>{
      // White
      ctx.beginPath();ctx.ellipse(ex,-R*.35,R*.28,R*.32,ei===0?.1:-.1,0,Math.PI*2);
      ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,0.3)';ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;
      // Pupil (track downward)
      const px=ex*1.1,py=-R*.3;
      ctx.beginPath();ctx.arc(px,py,R*.14,0,Math.PI*2);ctx.fillStyle='#111';ctx.fill();
      // Iris shine
      ctx.beginPath();ctx.arc(px-R*.06,py-R*.07,R*.06,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fill();
      ctx.beginPath();ctx.arc(px+R*.04,py+R*.04,R*.03,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fill();
    });
    // Eyebrows (happy expression or concerned if eating)
    ctx.strokeStyle=o.eating?'#1a5c2a':'#2d7a44';ctx.lineWidth=3;ctx.lineCap='round';
    [-R*.38,R*.38].forEach((ex,ei)=>{
      ctx.beginPath();
      ctx.arc(ex,-R*.7,R*.22, ei===0?Math.PI+.4:-.4, ei===0?Math.PI*2-.4:Math.PI-.4);
      if(o.eating)ctx.arc(ex,-R*.6,R*.22,ei===0?Math.PI:.4,ei===0?Math.PI+.6:Math.PI-.6);
      ctx.stroke();
    });
    // Feet
    [-R*.5,R*.5].forEach(fx=>{
      ctx.beginPath();ctx.ellipse(fx,R+4,R*.32,R*.22,fx>0?.3:-.3,0,Math.PI*2);
      ctx.fillStyle='#3a9e4a';ctx.fill();
      // Toes
      for(let t=-1;t<=1;t++){
        ctx.beginPath();ctx.arc(fx+t*R*.12,R+10,R*.1,0,Math.PI*2);
        ctx.fillStyle='#2d8040';ctx.fill();
      }
    });
    ctx.restore();
  }
}

// ---- Helpers ----
function vd(x1,y1,x2,y2){return Math.sqrt((x2-x1)**2+(y2-y1)**2);}
function segX(x1,y1,x2,y2,x3,y3,x4,y4){
  const d1x=x2-x1,d1y=y2-y1,d2x=x4-x3,d2y=y4-y3;
  const c=d1x*d2y-d1y*d2x;
  if(Math.abs(c)<1e-9)return false;
  const t=((x3-x1)*d2y-(y3-y1)*d2x)/c;
  const u=((x3-x1)*d1y-(y3-y1)*d1x)/c;
  return t>=0&&t<=1&&u>=0&&u<=1;
}
