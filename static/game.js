// ===== STATE =====
let session = JSON.parse(localStorage.getItem('ctr_session') || 'null');
let progress = {};
let currentLevel = 1;
let gameEngine = null;
const TOTAL_LEVELS = 8;

window.onload = () => {
  if (session) { loadProgress().then(() => { showScreen('menuScreen'); updateMenuUI(); }); }
  else showScreen('authScreen');
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'levelScreen') renderLevelSelect();
  if (id === 'menuScreen') updateMenuUI();
  if (id !== 'gameScreen' && gameEngine) { gameEngine.destroy(); gameEngine = null; }
}

function switchTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? '' : 'none';
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
  document.getElementById('authError').textContent = '';
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!username || !password) return setErr('Please fill all fields');
  try {
    const r = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password}) });
    const d = await r.json();
    if (!r.ok) return setErr(d.detail || 'Login failed');
    session = { token: d.token, username: d.username, user_id: d.user_id };
    localStorage.setItem('ctr_session', JSON.stringify(session));
    await loadProgress();
    showScreen('menuScreen');
  } catch(e) { setErr('Network error'); }
}

async function doRegister() {
  const username = document.getElementById('regUser').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value;
  if (!username || !email || !password) return setErr('Please fill all fields');
  try {
    const r = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, email, password}) });
    const d = await r.json();
    if (!r.ok) return setErr(d.detail || 'Registration failed');
    session = { token: d.token, username: d.username, user_id: d.user_id };
    localStorage.setItem('ctr_session', JSON.stringify(session));
    progress = {};
    showScreen('menuScreen');
    showToast('Welcome, ' + username + '! 🎉');
  } catch(e) { setErr('Network error'); }
}

function logout() {
  session = null; progress = {};
  localStorage.removeItem('ctr_session');
  showScreen('authScreen');
}

function setErr(msg) { document.getElementById('authError').textContent = msg; }

async function loadProgress() {
  if (!session) return;
  try {
    const r = await fetch('/api/progress?token=' + session.token);
    const d = await r.json();
    progress = {};
    d.progress.forEach(p => progress[p.level] = p);
  } catch(e) {}
}

function updateMenuUI() {
  if (!session) return;
  document.getElementById('menuAvatar').textContent = session.username[0].toUpperCase();
  document.getElementById('menuName').textContent = session.username;
  const totalStars = Object.values(progress).reduce((s, p) => s + p.stars, 0);
  const completed = Object.keys(progress).length;
  document.getElementById('menuStat').textContent = completed + '/' + TOTAL_LEVELS + ' levels · ' + totalStars + '⭐ stars';
}

function renderLevelSelect() {
  const grid = document.getElementById('levelsGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const p = progress[i];
    const unlocked = i === 1 || progress[i - 1];
    const div = document.createElement('div');
    div.className = 'level-card' + (!unlocked ? ' locked' : '') + (p ? ' completed' : '');
    const stars = p ? p.stars : 0;
    div.innerHTML = '<div class="level-num">' + i + '</div><div class="level-stars">' +
      [1,2,3].map(s => '<span class="star ' + (stars >= s ? 'lit' : '') + '">★</span>').join('') + '</div>' +
      (!unlocked ? '<div style="font-size:1.8rem;margin-top:4px">🔒</div>' : '');
    if (unlocked) div.onclick = () => startLevel(i);
    grid.appendChild(div);
  }
}

async function showLeaderboard() {
  showScreen('lbScreen');
  const table = document.getElementById('lbTable');
  table.innerHTML = '<div class="lb-empty">Loading...</div>';
  try {
    const r = await fetch('/api/leaderboard');
    const d = await r.json();
    if (!d.leaderboard.length) { table.innerHTML = '<div class="lb-empty">No scores yet! Be the first 🎮</div>'; return; }
    table.innerHTML = d.leaderboard.map((e, i) => '<div class="lb-row"><div class="lb-rank ' + (i===0?'gold':i===1?'silver':i===2?'bronze':'') + '">' + (i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1) + '</div><div class="lb-name">' + e.username + '</div><div class="lb-stars">' + '★'.repeat(Math.min(e.stars,15)) + '</div><div class="lb-score">' + e.total.toLocaleString() + '</div></div>').join('');
  } catch(e) { table.innerHTML = '<div class="lb-empty">Failed to load</div>'; }
}

function startLevel(level) {
  currentLevel = level;
  showScreen('gameScreen');
  document.getElementById('hudLevel').textContent = 'Level ' + level;
  document.getElementById('gameOverlay').classList.remove('show');
  if (gameEngine) gameEngine.destroy();
  gameEngine = new GameEngine('gameCanvas', level, onLevelComplete, onLevelFail);
  gameEngine.start();
}

function quitGame() {
  if (gameEngine) { gameEngine.destroy(); gameEngine = null; }
  loadProgress().then(() => showScreen('levelScreen'));
}

function retryLevel() { document.getElementById('gameOverlay').classList.remove('show'); startLevel(currentLevel); }
function nextLevel() { if (currentLevel < TOTAL_LEVELS) startLevel(currentLevel + 1); else showScreen('menuScreen'); }

async function onLevelComplete(stars, score) {
  document.getElementById('overlayTitle').textContent = stars === 3 ? '🎉 Perfect!' : stars === 2 ? '🌟 Great!' : '✅ Complete!';
  document.getElementById('overlayStars').innerHTML = [1,2,3].map(s => '<span>' + (stars >= s ? '⭐' : '☆') + '</span>').join('');
  document.getElementById('overlayScore').textContent = 'Score: ' + score.toLocaleString();
  document.getElementById('btnNext').style.display = currentLevel < TOTAL_LEVELS ? '' : 'none';
  document.getElementById('gameOverlay').classList.add('show');
  if (session) {
    try {
      await fetch('/api/score', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:session.token, level:currentLevel, stars, score}) });
      await loadProgress();
    } catch(e) {}
  }
  showToast(stars === 3 ? 'Perfect! 3 Stars! ⭐⭐⭐' : 'Level Complete!');
}

function onLevelFail() {
  document.getElementById('overlayTitle').textContent = '💀 Try Again!';
  document.getElementById('overlayStars').innerHTML = '☆☆☆';
  document.getElementById('overlayScore').textContent = '';
  document.getElementById('btnNext').style.display = 'none';
  document.getElementById('gameOverlay').classList.add('show');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function updateHud(ropes, score) {
  document.getElementById('hudRopes').textContent = 'Ropes: ' + ropes;
  document.getElementById('hudScore').textContent = score.toLocaleString();
}

// =============================================
// GAME ENGINE
// =============================================
class GameEngine {
  constructor(canvasId, level, onComplete, onFail) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.level = level; this.onComplete = onComplete; this.onFail = onFail;
    this.running = false; this.animId = null;
    this.score = 0; this.starsCollected = 0;
    this.ropes = []; this.balloons = []; this.spikes = []; this.stars3d = [];
    this.candy = null; this.omnom = null;
    this.lastTime = 0; this.cutLine = null;
    this.gameOver = false; this.won = false;
    this.setupCanvas();
    this._resizeFn = () => this.setupCanvas();
    window.addEventListener('resize', this._resizeFn);
    this.setupInput();
  }

  setupCanvas() {
    const hud = document.querySelector('.game-hud');
    const hudH = hud ? hud.offsetHeight : 50;
    const W = Math.min(window.innerWidth, 480);
    const H = window.innerHeight - hudH;
    this.canvas.width = W; this.canvas.height = H;
    this.W = W; this.H = H;
  }

  start() { this.running = true; this.loadLevel(this.level); requestAnimationFrame(t => this.loop(t)); }

  destroy() {
    this.running = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this._resizeFn);
    ['mousedown','mousemove','mouseup'].forEach(e => this.canvas.removeEventListener(e, this['_' + e]));
    ['touchstart','touchmove','touchend'].forEach(e => this.canvas.removeEventListener(e, this['_' + e]));
  }

  setupInput() {
    this['_mousedown'] = e => { const p = this.getPos(e); this.cutLine = {x1:p.x,y1:p.y,x2:p.x,y2:p.y}; };
    this['_mousemove'] = e => { if (this.cutLine) { const p = this.getPos(e); this.cutLine.x2=p.x; this.cutLine.y2=p.y; this.checkCuts(); } };
    this['_mouseup'] = e => { this.cutLine = null; };
    this['_touchstart'] = e => { e.preventDefault(); const p = this.getPos(e.touches[0]); this.cutLine = {x1:p.x,y1:p.y,x2:p.x,y2:p.y}; };
    this['_touchmove'] = e => { e.preventDefault(); if (this.cutLine) { const p = this.getPos(e.touches[0]); this.cutLine.x2=p.x; this.cutLine.y2=p.y; this.checkCuts(); } };
    this['_touchend'] = e => { e.preventDefault(); this.cutLine = null; };
    this.canvas.addEventListener('mousedown', this['_mousedown']);
    this.canvas.addEventListener('mousemove', this['_mousemove']);
    this.canvas.addEventListener('mouseup', this['_mouseup']);
    this.canvas.addEventListener('touchstart', this['_touchstart'], {passive:false});
    this.canvas.addEventListener('touchmove', this['_touchmove'], {passive:false});
    this.canvas.addEventListener('touchend', this['_touchend'], {passive:false});
  }

  getPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX||e.pageX) - r.left, y: (e.clientY||e.pageY) - r.top };
  }

  loadLevel(n) {
    const W = this.W, H = this.H;
    this.ropes=[]; this.spikes=[]; this.balloons=[]; this.stars3d=[];
    this.score=0; this.gameOver=false; this.won=false; this.starsCollected=0;
    const mk = [
      () => { // L1 tutorial
        this.candy=new Candy(W/2,H*.2,this); this.omnom=new OmNom(W/2,H*.82,this);
        this.ropes.push(new Rope({x:W/2,y:10},this.candy,this));
        this.stars3d.push(new Star3D(W/2,H*.48,this));
      },
      () => { // L2 two ropes
        this.candy=new Candy(W/2,H*.28,this); this.omnom=new OmNom(W/2,H*.82,this);
        this.ropes.push(new Rope({x:W*.22,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.78,y:10},this.candy,this));
        this.stars3d.push(new Star3D(W/2,H*.46,this));
        this.stars3d.push(new Star3D(W*.3,H*.62,this));
      },
      () => { // L3 spike
        this.candy=new Candy(W/2,H*.22,this); this.omnom=new OmNom(W/2,H*.82,this);
        this.ropes.push(new Rope({x:W*.28,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.72,y:10},this.candy,this));
        this.spikes.push(new Spike(W/2,H*.55,36,this));
        this.stars3d.push(new Star3D(W*.2,H*.52,this));
        this.stars3d.push(new Star3D(W/2,H*.38,this));
        this.stars3d.push(new Star3D(W*.8,H*.52,this));
      },
      () => { // L4 three ropes + spikes
        this.candy=new Candy(W/2,H*.3,this); this.omnom=new OmNom(W/2,H*.82,this);
        this.ropes.push(new Rope({x:W*.15,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.5,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.85,y:10},this.candy,this));
        this.spikes.push(new Spike(W*.25,H*.58,32,this));
        this.spikes.push(new Spike(W*.75,H*.58,32,this));
        this.stars3d.push(new Star3D(W/2,H*.52,this));
        this.stars3d.push(new Star3D(W*.18,H*.68,this));
        this.stars3d.push(new Star3D(W*.82,H*.68,this));
      },
      () => { // L5 balloons
        this.candy=new Candy(W/2,H*.58,this); this.omnom=new OmNom(W/2,H*.82,this);
        this.balloons.push(new Balloon(W*.38,H*.3,this.candy,this));
        this.balloons.push(new Balloon(W*.62,H*.3,this.candy,this));
        this.ropes.push(new Rope({x:W*.5,y:10},this.candy,this));
        this.spikes.push(new Spike(W*.18,H*.72,28,this));
        this.spikes.push(new Spike(W*.82,H*.72,28,this));
        this.stars3d.push(new Star3D(W/2,H*.42,this));
        this.stars3d.push(new Star3D(W*.25,H*.55,this));
        this.stars3d.push(new Star3D(W*.75,H*.55,this));
      },
      () => { // L6 complex
        this.candy=new Candy(W*.72,H*.28,this); this.omnom=new OmNom(W*.28,H*.82,this);
        this.ropes.push(new Rope({x:W*.48,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.92,y:10},this.candy,this));
        this.balloons.push(new Balloon(W*.72,H*.12,this.candy,this));
        this.spikes.push(new Spike(W*.48,H*.58,34,this));
        this.spikes.push(new Spike(W*.68,H*.68,28,this));
        this.stars3d.push(new Star3D(W*.22,H*.42,this));
        this.stars3d.push(new Star3D(W*.48,H*.42,this));
        this.stars3d.push(new Star3D(W*.72,H*.58,this));
      },
      () => { // L7 expert
        this.candy=new Candy(W/2,H*.18,this); this.omnom=new OmNom(W/2,H*.82,this);
        this.ropes.push(new Rope({x:W*.1,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.5,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.9,y:10},this.candy,this));
        this.balloons.push(new Balloon(W*.3,H*.08,this.candy,this));
        this.balloons.push(new Balloon(W*.7,H*.08,this.candy,this));
        this.spikes.push(new Spike(W*.2,H*.48,36,this));
        this.spikes.push(new Spike(W*.5,H*.62,36,this));
        this.spikes.push(new Spike(W*.8,H*.48,36,this));
        this.stars3d.push(new Star3D(W*.5,H*.36,this));
        this.stars3d.push(new Star3D(W*.2,H*.32,this));
        this.stars3d.push(new Star3D(W*.8,H*.32,this));
      },
      () => { // L8 master
        this.candy=new Candy(W/2,H*.14,this); this.omnom=new OmNom(W/2,H*.84,this);
        this.ropes.push(new Rope({x:W*.08,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.32,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.68,y:10},this.candy,this));
        this.ropes.push(new Rope({x:W*.92,y:10},this.candy,this));
        this.balloons.push(new Balloon(W*.2,H*.05,this.candy,this));
        this.balloons.push(new Balloon(W*.5,H*.05,this.candy,this));
        this.balloons.push(new Balloon(W*.8,H*.05,this.candy,this));
        this.spikes.push(new Spike(W*.15,H*.43,34,this));
        this.spikes.push(new Spike(W*.38,H*.56,34,this));
        this.spikes.push(new Spike(W*.62,H*.56,34,this));
        this.spikes.push(new Spike(W*.85,H*.43,34,this));
        this.stars3d.push(new Star3D(W*.5,H*.3,this));
        this.stars3d.push(new Star3D(W*.25,H*.3,this));
        this.stars3d.push(new Star3D(W*.75,H*.3,this));
      }
    ];
    (mk[n-1]||mk[0])();
    updateHud(this.ropes.filter(r=>!r.cut).length + this.balloons.filter(b=>!b.cut).length, 0);
  }

  checkCuts() {
    if (!this.cutLine) return;
    const cl = this.cutLine;
    [...this.ropes,...this.balloons].forEach(r => {
      if (!r.cut && r.intersectsCut(cl.x1,cl.y1,cl.x2,cl.y2)) {
        r.cut=true; r.cutAnim=12;
        this.score+=50;
        updateHud(this.ropes.filter(r=>!r.cut).length+this.balloons.filter(b=>!b.cut).length, this.score);
      }
    });
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts-this.lastTime)/1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.animId = requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    if (this.gameOver || this.won) return;
    if (this.candy) this.candy.update(dt, this.ropes, this.balloons);
    this.stars3d.forEach(s => s.update(dt));
    this.stars3d.forEach(s => {
      if (!s.collected && this.candy && dist(this.candy.x,this.candy.y,s.x,s.y) < 28) {
        s.collected=true; s.popAnim=20; this.starsCollected++; this.score+=200;
        updateHud(this.ropes.filter(r=>!r.cut).length+this.balloons.filter(b=>!b.cut).length, this.score);
      }
    });
    this.spikes.forEach(sp => {
      if (this.candy && dist(this.candy.x,this.candy.y,sp.x,sp.y) < sp.r+12) {
        if (!this.gameOver) { this.gameOver=true; setTimeout(()=>this.onFail(),800); }
      }
    });
    if (this.candy && this.omnom && dist(this.candy.x,this.candy.y,this.omnom.x,this.omnom.y) < 42) {
      if (!this.won) { this.won=true; this.omnom.eating=true; this.score+=this.starsCollected*100+300; setTimeout(()=>this.onComplete(this.starsCollected,this.score),700); }
    }
    if (this.candy && (this.candy.y > this.H+100 || this.candy.x < -120 || this.candy.x > this.W+120)) {
      if (!this.gameOver) { this.gameOver=true; setTimeout(()=>this.onFail(),400); }
    }
  }

  draw() {
    const ctx=this.ctx, W=this.W, H=this.H;
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#0d0d2b'); grad.addColorStop(1,'#1a0a2e');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1;
    for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    this.spikes.forEach(s=>s.draw(ctx));
    this.stars3d.forEach(s=>s.draw(ctx));
    this.ropes.forEach(r=>r.draw(ctx));
    this.balloons.forEach(b=>b.draw(ctx));
    if(this.omnom) this.omnom.draw(ctx);
    if(this.candy) this.candy.draw(ctx);
    if(this.cutLine){
      ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=3;
      ctx.setLineDash([6,4]); ctx.shadowColor='#fff'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.moveTo(this.cutLine.x1,this.cutLine.y1); ctx.lineTo(this.cutLine.x2,this.cutLine.y2); ctx.stroke();
      ctx.restore();
    }
  }
}

function dist(x1,y1,x2,y2){return Math.sqrt((x2-x1)**2+(y2-y1)**2);}
function segIntersect(x1,y1,x2,y2,x3,y3,x4,y4){
  const d1x=x2-x1,d1y=y2-y1,d2x=x4-x3,d2y=y4-y3;
  const cross=d1x*d2y-d1y*d2x;
  if(Math.abs(cross)<1e-10)return false;
  const t=((x3-x1)*d2y-(y3-y1)*d2x)/cross;
  const u=((x3-x1)*d1y-(y3-y1)*d1x)/cross;
  return t>=0&&t<=1&&u>=0&&u<=1;
}

class Candy{
  constructor(x,y,engine){this.x=x;this.y=y;this.vx=0;this.vy=0;this.r=18;this.engine=engine;this.angle=0;}
  update(dt,ropes,balloons){
    const activeRopes=ropes.filter(r=>!r.cut);
    const activeBalloons=balloons.filter(b=>!b.cut);
    let gravity=420;
    if(activeBalloons.length>0) gravity-=activeBalloons.length*155;
    if(activeRopes.length>0){
      activeRopes.forEach(r=>r.constrain(this,gravity,dt));
    } else {
      this.vy+=gravity*dt;
      this.x+=this.vx*dt; this.y+=this.vy*dt;
      this.vx*=0.99; this.vy*=0.99;
    }
    this.angle=this.vx*0.012;
  }
  draw(ctx){
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle);
    ctx.shadowColor='#FF6B35'; ctx.shadowBlur=22;
    ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2);
    const g=ctx.createRadialGradient(-5,-5,2,0,0,this.r);
    g.addColorStop(0,'#FF8C42'); g.addColorStop(0.5,'#FF6B35'); g.addColorStop(1,'#cc4400');
    ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.arc(-5,-5,6,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*1.2); ctx.stroke();
    ctx.restore();
  }
}

class Rope{
  constructor(anchor,candy,engine){this.anchor=anchor;this.candy=candy;this.engine=engine;this.cut=false;this.cutAnim=0;this.initLen=dist(anchor.x,anchor.y,candy.x,candy.y)||120;}
  constrain(candy,gravity,dt){
    if(this.cut)return;
    candy.vy+=gravity*dt;
    candy.x+=candy.vx*dt; candy.y+=candy.vy*dt;
    candy.vx*=0.985; candy.vy*=0.985;
    const dx=candy.x-this.anchor.x, dy=candy.y-this.anchor.y;
    const d=Math.sqrt(dx*dx+dy*dy)||1;
    if(d>this.initLen){
      candy.x=this.anchor.x+dx/d*this.initLen;
      candy.y=this.anchor.y+dy/d*this.initLen;
      const perp={x:-dy/d,y:dx/d};
      const vel=candy.vx*perp.x+candy.vy*perp.y;
      candy.vx=perp.x*vel*0.95; candy.vy=perp.y*vel*0.95;
    }
  }
  intersectsCut(x1,y1,x2,y2){
    if(this.cut)return false;
    return segIntersect(x1,y1,x2,y2,this.anchor.x,this.anchor.y,this.candy.x,this.candy.y);
  }
  draw(ctx){
    if(this.cut&&this.cutAnim<=0)return;
    ctx.save();
    if(this.cut){ctx.globalAlpha=this.cutAnim/12;this.cutAnim--;}
    const cx=this.candy.x,cy=this.candy.y;
    const mx=(this.anchor.x+cx)/2+8,my=(this.anchor.y+cy)/2+18;
    ctx.beginPath(); ctx.moveTo(this.anchor.x,this.anchor.y); ctx.quadraticCurveTo(mx,my,cx,cy);
    ctx.strokeStyle='#8B4513'; ctx.lineWidth=4.5; ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.anchor.x,this.anchor.y); ctx.quadraticCurveTo(mx,my,cx,cy);
    ctx.strokeStyle='rgba(180,100,40,0.45)'; ctx.lineWidth=2; ctx.stroke();
    ctx.beginPath(); ctx.arc(this.anchor.x,this.anchor.y,6,0,Math.PI*2);
    ctx.fillStyle='#bbb'; ctx.shadowColor='#000'; ctx.shadowBlur=6; ctx.fill();
    ctx.restore();
  }
}

class Balloon{
  constructor(x,y,candy,engine){this.x=x;this.y=y;this.candy=candy;this.engine=engine;this.cut=false;this.cutAnim=0;this.bobPhase=Math.random()*Math.PI*2;const cols=['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7'];this.color=cols[Math.floor(Math.random()*cols.length)];}
  intersectsCut(x1,y1,x2,y2){
    if(this.cut)return false;
    const t=0.35,bx=this.candy.x+(this.x-this.candy.x)*t,by=this.candy.y+(this.y-this.candy.y)*t;
    return segIntersect(x1,y1,x2,y2,bx,by,this.candy.x,this.candy.y);
  }
  draw(ctx){
    if(this.cut&&this.cutAnim<=0)return;
    ctx.save();
    if(this.cut){ctx.globalAlpha=this.cutAnim/12;this.cutAnim--;}
    const bob=Math.sin(Date.now()*.002+this.bobPhase)*4;
    const bx=this.x,by=this.y+bob,cx=this.candy.x,cy=this.candy.y;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(bx,by+22);
    ctx.strokeStyle='rgba(200,200,200,0.55)';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.ellipse(bx,by,18,23,0,0,Math.PI*2);
    ctx.fillStyle=this.color;ctx.shadowColor=this.color;ctx.shadowBlur=16;ctx.fill();
    ctx.beginPath();ctx.ellipse(bx-5,by-7,6,9,-.4,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.32)';ctx.fill();
    ctx.beginPath();ctx.arc(bx,by+22,3,0,Math.PI*2);
    ctx.fillStyle=this.color;ctx.fill();
    ctx.restore();
  }
}

class Spike{
  constructor(x,y,r,engine){this.x=x;this.y=y;this.r=r;this.engine=engine;this.rot=Math.random()*Math.PI*2;}
  draw(ctx){
    ctx.save();ctx.translate(this.x,this.y);this.rot+=0.018;ctx.rotate(this.rot);
    const n=8,r=this.r;
    ctx.beginPath();
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=a+Math.PI/n;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(b)*r*.38,Math.sin(b)*r*.38);}
    ctx.closePath();ctx.fillStyle='#e74c3c';ctx.shadowColor='#e74c3c';ctx.shadowBlur=14;ctx.fill();
    ctx.strokeStyle='#c0392b';ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();
  }
}

class Star3D{
  constructor(x,y,engine){this.x=x;this.y=y;this.engine=engine;this.collected=false;this.popAnim=0;this.bobPhase=Math.random()*Math.PI*2;this.rot=0;}
  update(dt){this.rot+=dt*2.2;}
  draw(ctx){
    if(this.collected&&this.popAnim<=0)return;
    ctx.save();
    const bob=Math.sin(Date.now()*.002+this.bobPhase)*5;
    ctx.translate(this.x,this.y+bob);ctx.rotate(this.rot);
    if(this.collected){const s=1+this.popAnim*.1;ctx.scale(s,s);ctx.globalAlpha=this.popAnim/20;this.popAnim--;}
    ctx.beginPath();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI/5;if(i===0)ctx.moveTo(Math.cos(a)*14,Math.sin(a)*14);else ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14);ctx.lineTo(Math.cos(b)*6,Math.sin(b)*6);}
    ctx.closePath();ctx.fillStyle='#FFD700';ctx.shadowColor='#FFD700';ctx.shadowBlur=22;ctx.fill();
    ctx.strokeStyle='#e6ac00';ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();
  }
}

class OmNom{
  constructor(x,y,engine){this.x=x;this.y=y;this.engine=engine;this.eating=false;this.bob=0;}
  draw(ctx){
    ctx.save();
    const b=Math.sin(Date.now()*.003)*3;
    ctx.translate(this.x,this.y+b);
    const mouth=this.eating?.85:(.2+Math.sin(Date.now()*.004)*.15);
    ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);
    const g=ctx.createRadialGradient(-5,-5,4,0,0,28);
    g.addColorStop(0,'#6BCB77');g.addColorStop(1,'#4a9955');
    ctx.fillStyle=g;ctx.shadowColor='#6BCB77';ctx.shadowBlur=16;ctx.fill();
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,8,14,-Math.PI/2-mouth,-Math.PI/2+mouth);ctx.closePath();
    ctx.fillStyle=this.eating?'#ffaaaa':'#ff6b6b';ctx.fill();
    [-10,10].forEach(ex=>{ctx.beginPath();ctx.arc(ex,-10,7,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.beginPath();ctx.arc(ex+1,-10,3.5,0,Math.PI*2);ctx.fillStyle='#222';ctx.fill();ctx.beginPath();ctx.arc(ex+2,-11.5,1.2,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();});
    ctx.restore();
  }
}
