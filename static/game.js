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
    table.innerHTML = d.leaderboard.map((e, i) => '<div class="lb-row"><div class="lb-rank ' + (i===0?'gold':i===1?'silver':i===2?'bronze':'') + '">' + (i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1) + '</div><div class="lb-name">' + e.username + '</div><div class="lb-stars">' + '★'.repeat(Math.min(e.stars,12)) + '</div><div class="lb-score">' + e.total.toLocaleString() + '</div></div>').join('');
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
// PHYSICS ENGINE - Verlet + Constraint solver
// =============================================

const GRAVITY = 980;        // px/s² (realistic)
const DAMPING = 0.995;      // velocity damping per frame
const ROPE_DAMPING = 0.98;  // rope segment damping
const SUBSTEPS = 8;         // constraint solver iterations

class Vec2 {
  constructor(x=0, y=0) { this.x=x; this.y=y; }
  add(v) { return new Vec2(this.x+v.x, this.y+v.y); }
  sub(v) { return new Vec2(this.x-v.x, this.y-v.y); }
  scale(s) { return new Vec2(this.x*s, this.y*s); }
  len() { return Math.sqrt(this.x*this.x + this.y*this.y); }
  norm() { const l=this.len()||1; return new Vec2(this.x/l, this.y/l); }
  dot(v) { return this.x*v.x + this.y*v.y; }
}

// Point mass for Verlet integration
class Point {
  constructor(x, y, pinned=false) {
    this.pos = new Vec2(x, y);
    this.prev = new Vec2(x, y);
    this.pinned = pinned;
    this.mass = 1.0;
  }
  applyForce(fx, fy, dt) {
    if (this.pinned) return;
    this.pos.x += fx * dt * dt;
    this.pos.y += fy * dt * dt;
  }
  integrate(dt) {
    if (this.pinned) return;
    const vx = (this.pos.x - this.prev.x) * DAMPING;
    const vy = (this.pos.y - this.prev.y) * DAMPING;
    this.prev.x = this.pos.x;
    this.prev.y = this.pos.y;
    this.pos.x += vx + 0 * dt * dt;
    this.pos.y += vy + GRAVITY * dt * dt;
  }
  get vx() { return this.pos.x - this.prev.x; }
  get vy() { return this.pos.y - this.prev.y; }
  set vx(v) { this.prev.x = this.pos.x - v; }
  set vy(v) { this.prev.y = this.pos.y - v; }
}

// Stick constraint between two points
class Stick {
  constructor(p1, p2, length) {
    this.p1 = p1; this.p2 = p2;
    this.length = length || p1.pos.sub(p2.pos).len();
    this.broken = false;
  }
  solve() {
    if (this.broken) return;
    const dx = this.p2.pos.x - this.p1.pos.x;
    const dy = this.p2.pos.y - this.p1.pos.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
    const diff = (dist - this.length) / dist * 0.5;
    const ox = dx * diff, oy = dy * diff;
    if (!this.p1.pinned) { this.p1.pos.x += ox; this.p1.pos.y += oy; }
    if (!this.p2.pinned) { this.p2.pos.x -= ox; this.p2.pos.y -= oy; }
  }
}

class GameEngine {
  constructor(canvasId, level, onComplete, onFail) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.level = level; this.onComplete = onComplete; this.onFail = onFail;
    this.running = false; this.animId = null;
    this.score = 0; this.starsCollected = 0;
    this.ropes = []; this.balloons = []; this.spikes = []; this.collectibles = [];
    this.candy = null; this.omnom = null;
    this.lastTime = 0; this.cutLine = null;
    this.gameOver = false; this.won = false;
    this.points = []; this.sticks = [];
    this.setupCanvas();
    this._resizeFn = () => { this.setupCanvas(); this.loadLevel(this.level); };
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

  start() { this.running = true; this.loadLevel(this.level); this.lastTime = performance.now(); requestAnimationFrame(t => this.loop(t)); }

  destroy() {
    this.running = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this._resizeFn);
    this.canvas.onmousedown = null; this.canvas.onmousemove = null; this.canvas.onmouseup = null;
    this.canvas.ontouchstart = null; this.canvas.ontouchmove = null; this.canvas.ontouchend = null;
  }

  setupInput() {
    const getP = e => { const r=this.canvas.getBoundingClientRect(); return {x:(e.clientX||e.pageX)-r.left, y:(e.clientY||e.pageY)-r.top}; };
    this.canvas.onmousedown = e => { const p=getP(e); this.cutLine={x1:p.x,y1:p.y,x2:p.x,y2:p.y}; };
    this.canvas.onmousemove = e => { if(this.cutLine){const p=getP(e);this.cutLine.x2=p.x;this.cutLine.y2=p.y;this.checkCuts();} };
    this.canvas.onmouseup = () => { this.cutLine=null; };
    this.canvas.ontouchstart = e => { e.preventDefault(); const p=getP(e.touches[0]); this.cutLine={x1:p.x,y1:p.y,x2:p.x,y2:p.y}; };
    this.canvas.ontouchmove = e => { e.preventDefault(); if(this.cutLine){const p=getP(e.touches[0]);this.cutLine.x2=p.x;this.cutLine.y2=p.y;this.checkCuts();} };
    this.canvas.ontouchend = e => { e.preventDefault(); this.cutLine=null; };
  }

  // Build a rope from anchor to candy point using N segments
  makeRope(ax, ay, candyPt, N) {
    const segs = [];
    const pts = [];
    // anchor pin
    const anchor = new Point(ax, ay, true);
    pts.push(anchor);
    const dx = (candyPt.pos.x - ax) / N;
    const dy = (candyPt.pos.y - ay) / N;
    for (let i = 1; i < N; i++) {
      const p = new Point(ax + dx*i, ay + dy*i, false);
      pts.push(p);
    }
    pts.push(candyPt);
    for (let i = 0; i < pts.length-1; i++) {
      const s = new Stick(pts[i], pts[i+1]);
      segs.push(s);
    }
    this.points.push(...pts.slice(0, -1)); // don't double-add candy
    this.sticks.push(...segs);
    return { pts, segs, cut: false, cutAnim: 0, anchor: {x:ax, y:ay} };
  }

  loadLevel(n) {
    const W = this.W, H = this.H;
    this.ropes=[]; this.balloons=[]; this.spikes=[]; this.collectibles=[];
    this.points=[]; this.sticks=[];
    this.score=0; this.gameOver=false; this.won=false; this.starsCollected=0;

    // Candy point mass
    const mkCandy = (x, y) => {
      const cp = new Point(x, y, false);
      cp.mass = 2.0;
      this.points.push(cp);
      return cp;
    };

    const levels = [
      () => { // L1 - Tutorial
        const cp = mkCandy(W/2, H*0.22);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W/2, y:H*0.84, eating:false };
        this.ropes.push(this.makeRope(W/2, 8, cp, 10));
        this.collectibles.push({x:W/2, y:H*0.50, r:14, collected:false, pop:0, bob:0});
      },
      () => { // L2 - Two ropes
        const cp = mkCandy(W/2, H*0.28);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W/2, y:H*0.84, eating:false };
        this.ropes.push(this.makeRope(W*0.22, 8, cp, 10));
        this.ropes.push(this.makeRope(W*0.78, 8, cp, 10));
        this.collectibles.push({x:W/2, y:H*0.48, r:14, collected:false, pop:0, bob:Math.PI*0.5});
        this.collectibles.push({x:W*0.3, y:H*0.64, r:14, collected:false, pop:0, bob:Math.PI});
      },
      () => { // L3 - Spike
        const cp = mkCandy(W/2, H*0.22);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W/2, y:H*0.84, eating:false };
        this.ropes.push(this.makeRope(W*0.28, 8, cp, 10));
        this.ropes.push(this.makeRope(W*0.72, 8, cp, 10));
        this.spikes.push({x:W/2, y:H*0.56, r:32});
        this.collectibles.push({x:W*0.2, y:H*0.50, r:14, collected:false, pop:0, bob:0});
        this.collectibles.push({x:W/2, y:H*0.38, r:14, collected:false, pop:0, bob:1});
        this.collectibles.push({x:W*0.8, y:H*0.50, r:14, collected:false, pop:0, bob:2});
      },
      () => { // L4 - Three ropes + spikes
        const cp = mkCandy(W/2, H*0.28);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W/2, y:H*0.84, eating:false };
        this.ropes.push(this.makeRope(W*0.15, 8, cp, 12));
        this.ropes.push(this.makeRope(W*0.50, 8, cp, 8));
        this.ropes.push(this.makeRope(W*0.85, 8, cp, 12));
        this.spikes.push({x:W*0.25, y:H*0.60, r:30});
        this.spikes.push({x:W*0.75, y:H*0.60, r:30});
        this.collectibles.push({x:W/2, y:H*0.52, r:14, collected:false, pop:0, bob:0});
        this.collectibles.push({x:W*0.18, y:H*0.70, r:14, collected:false, pop:0, bob:1});
        this.collectibles.push({x:W*0.82, y:H*0.70, r:14, collected:false, pop:0, bob:2});
      },
      () => { // L5 - Balloons
        const cp = mkCandy(W/2, H*0.60);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W/2, y:H*0.84, eating:false };
        this.ropes.push(this.makeRope(W*0.50, 8, cp, 14));
        this.balloons.push({x:W*0.35, y:H*0.28, pt:cp, cut:false, cutAnim:0, col:'#FF6B6B', bob:0});
        this.balloons.push({x:W*0.65, y:H*0.28, pt:cp, cut:false, cutAnim:0, col:'#4ECDC4', bob:Math.PI});
        this.spikes.push({x:W*0.18, y:H*0.76, r:28});
        this.spikes.push({x:W*0.82, y:H*0.76, r:28});
        this.collectibles.push({x:W/2, y:H*0.44, r:14, collected:false, pop:0, bob:0});
        this.collectibles.push({x:W*0.25, y:H*0.55, r:14, collected:false, pop:0, bob:1});
        this.collectibles.push({x:W*0.75, y:H*0.55, r:14, collected:false, pop:0, bob:2});
      },
      () => { // L6 - Complex
        const cp = mkCandy(W*0.72, H*0.26);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W*0.28, y:H*0.84, eating:false };
        this.ropes.push(this.makeRope(W*0.50, 8, cp, 12));
        this.ropes.push(this.makeRope(W*0.92, 8, cp, 10));
        this.balloons.push({x:W*0.72, y:H*0.10, pt:cp, cut:false, cutAnim:0, col:'#FFEAA7', bob:0});
        this.spikes.push({x:W*0.50, y:H*0.58, r:32});
        this.spikes.push({x:W*0.70, y:H*0.70, r:26});
        this.collectibles.push({x:W*0.22, y:H*0.44, r:14, collected:false, pop:0, bob:0});
        this.collectibles.push({x:W*0.50, y:H*0.40, r:14, collected:false, pop:0, bob:1});
        this.collectibles.push({x:W*0.72, y:H*0.58, r:14, collected:false, pop:0, bob:2});
      },
      () => { // L7 - Expert
        const cp = mkCandy(W/2, H*0.18);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W/2, y:H*0.84, eating:false };
        this.ropes.push(this.makeRope(W*0.10, 8, cp, 14));
        this.ropes.push(this.makeRope(W*0.50, 8, cp, 10));
        this.ropes.push(this.makeRope(W*0.90, 8, cp, 14));
        this.balloons.push({x:W*0.28, y:H*0.08, pt:cp, cut:false, cutAnim:0, col:'#96CEB4', bob:0});
        this.balloons.push({x:W*0.72, y:H*0.08, pt:cp, cut:false, cutAnim:0, col:'#FF6B6B', bob:Math.PI});
        this.spikes.push({x:W*0.20, y:H*0.50, r:34});
        this.spikes.push({x:W*0.50, y:H*0.64, r:34});
        this.spikes.push({x:W*0.80, y:H*0.50, r:34});
        this.collectibles.push({x:W*0.50, y:H*0.36, r:14, collected:false, pop:0, bob:0});
        this.collectibles.push({x:W*0.20, y:H*0.32, r:14, collected:false, pop:0, bob:1});
        this.collectibles.push({x:W*0.80, y:H*0.32, r:14, collected:false, pop:0, bob:2});
      },
      () => { // L8 - Master
        const cp = mkCandy(W/2, H*0.14);
        this.candy = { pt: cp, r:18 };
        this.omnom = { x:W/2, y:H*0.86, eating:false };
        this.ropes.push(this.makeRope(W*0.08, 8, cp, 16));
        this.ropes.push(this.makeRope(W*0.32, 8, cp, 12));
        this.ropes.push(this.makeRope(W*0.68, 8, cp, 12));
        this.ropes.push(this.makeRope(W*0.92, 8, cp, 16));
        this.balloons.push({x:W*0.20, y:H*0.05, pt:cp, cut:false, cutAnim:0, col:'#4ECDC4', bob:0});
        this.balloons.push({x:W*0.50, y:H*0.05, pt:cp, cut:false, cutAnim:0, col:'#FFD700', bob:1});
        this.balloons.push({x:W*0.80, y:H*0.05, pt:cp, cut:false, cutAnim:0, col:'#FF6B6B', bob:2});
        this.spikes.push({x:W*0.15, y:H*0.44, r:32});
        this.spikes.push({x:W*0.38, y:H*0.57, r:32});
        this.spikes.push({x:W*0.62, y:H*0.57, r:32});
        this.spikes.push({x:W*0.85, y:H*0.44, r:32});
        this.collectibles.push({x:W*0.50, y:H*0.30, r:14, collected:false, pop:0, bob:0});
        this.collectibles.push({x:W*0.25, y:H*0.30, r:14, collected:false, pop:0, bob:1});
        this.collectibles.push({x:W*0.75, y:H*0.30, r:14, collected:false, pop:0, bob:2});
      }
    ];
    (levels[n-1] || levels[0])();
    updateHud(this.activeRopeCount(), 0);
  }

  activeRopeCount() {
    return this.ropes.filter(r=>!r.cut).length + this.balloons.filter(b=>!b.cut).length;
  }

  checkCuts() {
    if (!this.cutLine) return;
    const {x1,y1,x2,y2} = this.cutLine;
    // Check rope sticks
    this.ropes.forEach(rope => {
      if (rope.cut) return;
      rope.segs.forEach(stick => {
        if (stick.broken) return;
        const ax=stick.p1.pos.x, ay=stick.p1.pos.y;
        const bx=stick.p2.pos.x, by=stick.p2.pos.y;
        if (segIntersect(x1,y1,x2,y2, ax,ay,bx,by)) {
          rope.cut = true;
          rope.cutAnim = 15;
          rope.segs.forEach(s => s.broken = true);
          this.score += 50;
          updateHud(this.activeRopeCount(), this.score);
        }
      });
    });
    // Check balloon strings
    this.balloons.forEach(b => {
      if (b.cut) return;
      const bx=b.pt.pos.x, by=b.pt.pos.y;
      const tx=b.x, ty=b.y + 22;
      if (segIntersect(x1,y1,x2,y2, bx,by,tx,ty)) {
        b.cut = true; b.cutAnim = 15;
        this.score += 50;
        updateHud(this.activeRopeCount(), this.score);
      }
    });
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lastTime) / 1000, 0.033);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.animId = requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    if (this.gameOver || this.won) return;
    const cp = this.candy.pt;
    // Count active balloons for buoyancy
    const activeBalloons = this.balloons.filter(b => !b.cut).length;

    // Verlet sub-step integration
    const subDt = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      // Apply gravity (and balloon buoyancy) to candy
      const netGravity = GRAVITY - activeBalloons * 420;
      if (!cp.pinned) {
        const vx2 = (cp.pos.x - cp.prev.x) * ROPE_DAMPING;
        const vy2 = (cp.pos.y - cp.prev.y) * ROPE_DAMPING;
        cp.prev.x = cp.pos.x; cp.prev.y = cp.pos.y;
        cp.pos.x += vx2;
        cp.pos.y += vy2 + netGravity * subDt * subDt;
      }
      // Integrate rope interior points
      this.points.forEach(p => {
        if (p === cp || p.pinned) return;
        const vxp = (p.pos.x - p.prev.x) * ROPE_DAMPING;
        const vyp = (p.pos.y - p.prev.y) * ROPE_DAMPING;
        p.prev.x = p.pos.x; p.prev.y = p.pos.y;
        p.pos.x += vxp;
        p.pos.y += vyp + GRAVITY * subDt * subDt;
      });
      // Solve stick constraints
      this.sticks.forEach(st => st.solve());
    }

    // Collectibles bob animation
    this.collectibles.forEach(c => { c.bob += dt * 3; });

    // Check collectible pickup
    const cx=cp.pos.x, cy=cp.pos.y;
    this.collectibles.forEach(c => {
      if (!c.collected && vdist(cx,cy,c.x,c.y) < c.r + this.candy.r) {
        c.collected=true; c.pop=20; this.starsCollected++; this.score+=200;
        updateHud(this.activeRopeCount(), this.score);
      }
      if (c.pop > 0) c.pop--;
    });

    // Spike collision
    this.spikes.forEach(sp => {
      if (vdist(cx,cy,sp.x,sp.y) < sp.r + this.candy.r - 4) {
        if (!this.gameOver) { this.gameOver=true; setTimeout(()=>this.onFail(),700); }
      }
    });

    // Om Nom collision
    if (this.omnom && vdist(cx,cy,this.omnom.x,this.omnom.y) < 44) {
      if (!this.won) {
        this.won=true; this.omnom.eating=true;
        this.score += this.starsCollected*100 + 300;
        setTimeout(()=>this.onComplete(this.starsCollected, this.score), 700);
      }
    }

    // Out of bounds
    if (cy > this.H + 120 || cx < -150 || cx > this.W + 150) {
      if (!this.gameOver) { this.gameOver=true; setTimeout(()=>this.onFail(),300); }
    }
  }

  draw() {
    const ctx=this.ctx, W=this.W, H=this.H;
    // Background
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#0d0d2b'); grad.addColorStop(1,'#1a0a2e');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.025)'; ctx.lineWidth=1;
    for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    // Spikes
    this.spikes.forEach(sp => {
      ctx.save(); ctx.translate(sp.x,sp.y);
      ctx.rotate(performance.now()*0.0008);
      const n=8,r=sp.r;
      ctx.beginPath();
      for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=a+Math.PI/n;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(b)*r*0.38,Math.sin(b)*r*0.38);}
      ctx.closePath(); ctx.fillStyle='#e74c3c'; ctx.shadowColor='#e74c3c'; ctx.shadowBlur=16; ctx.fill();
      ctx.strokeStyle='#c0392b'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
    });

    // Collectibles (stars)
    this.collectibles.forEach(c => {
      if (c.collected && c.pop<=0) return;
      ctx.save();
      const bob=Math.sin(c.bob)*6;
      ctx.translate(c.x, c.y+bob);
      ctx.rotate(performance.now()*0.002);
      if (c.collected) { const s=1+c.pop*0.08; ctx.scale(s,s); ctx.globalAlpha=c.pop/20; }
      ctx.beginPath();
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI/5;if(i===0)ctx.moveTo(Math.cos(a)*14,Math.sin(a)*14);else ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14);ctx.lineTo(Math.cos(b)*6,Math.sin(b)*6);}
      ctx.closePath(); ctx.fillStyle='#FFD700'; ctx.shadowColor='#FFD700'; ctx.shadowBlur=24; ctx.fill();
      ctx.strokeStyle='#e6ac00'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
    });

    // Ropes (multi-segment)
    this.ropes.forEach(rope => {
      if (rope.cut && rope.cutAnim<=0) return;
      ctx.save();
      if (rope.cut) { ctx.globalAlpha=rope.cutAnim/15; rope.cutAnim--; }
      const pts=rope.pts;
      if (pts.length < 2) { ctx.restore(); return; }
      // Draw rope as smooth curve through all segments
      ctx.beginPath();
      ctx.moveTo(pts[0].pos.x, pts[0].pos.y);
      for (let i=1; i<pts.length-1; i++) {
        const mx=(pts[i].pos.x+pts[i+1].pos.x)/2;
        const my=(pts[i].pos.y+pts[i+1].pos.y)/2;
        ctx.quadraticCurveTo(pts[i].pos.x, pts[i].pos.y, mx, my);
      }
      const last=pts[pts.length-1];
      ctx.lineTo(last.pos.x, last.pos.y);
      ctx.strokeStyle='#8B4513'; ctx.lineWidth=4.5; ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=5; ctx.stroke();
      // Highlight
      ctx.beginPath();
      ctx.moveTo(pts[0].pos.x, pts[0].pos.y);
      for (let i=1; i<pts.length-1; i++) {
        const mx=(pts[i].pos.x+pts[i+1].pos.x)/2;
        const my=(pts[i].pos.y+pts[i+1].pos.y)/2;
        ctx.quadraticCurveTo(pts[i].pos.x, pts[i].pos.y, mx, my);
      }
      ctx.lineTo(last.pos.x, last.pos.y);
      ctx.strokeStyle='rgba(200,130,60,0.4)'; ctx.lineWidth=2; ctx.shadowBlur=0; ctx.stroke();
      // Anchor nail
      const ap=pts[0].pos;
      ctx.beginPath(); ctx.arc(ap.x,ap.y,7,0,Math.PI*2);
      ctx.fillStyle='#ccc'; ctx.shadowColor='#000'; ctx.shadowBlur=8; ctx.fill();
      ctx.beginPath(); ctx.arc(ap.x,ap.y,3,0,Math.PI*2);
      ctx.fillStyle='#666'; ctx.fill();
      ctx.restore();
    });

    // Balloons
    this.balloons.forEach(b => {
      if (b.cut && b.cutAnim<=0) return;
      ctx.save();
      if (b.cut) { ctx.globalAlpha=b.cutAnim/15; b.cutAnim--; }
      const bob=Math.sin(performance.now()*0.002+b.bob)*5;
      const bx=b.x, by=b.y+bob;
      const cx2=b.pt.pos.x, cy2=b.pt.pos.y;
      // String from candy to balloon knot
      ctx.beginPath(); ctx.moveTo(cx2,cy2); ctx.lineTo(bx,by+24);
      ctx.strokeStyle='rgba(220,220,220,0.6)'; ctx.lineWidth=2; ctx.shadowBlur=0; ctx.stroke();
      // Balloon body
      ctx.beginPath(); ctx.ellipse(bx,by,19,24,0,0,Math.PI*2);
      ctx.fillStyle=b.col; ctx.shadowColor=b.col; ctx.shadowBlur=20; ctx.fill();
      // Shine
      ctx.beginPath(); ctx.ellipse(bx-6,by-8,6,9,-0.4,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fill();
      // Knot
      ctx.beginPath(); ctx.arc(bx,by+24,4,0,Math.PI*2);
      ctx.fillStyle=b.col; ctx.shadowBlur=0; ctx.fill();
      ctx.restore();
    });

    // Om Nom
    if (this.omnom) this.drawOmNom(ctx, this.omnom);

    // Candy
    if (this.candy) {
      const cp2=this.candy.pt;
      ctx.save(); ctx.translate(cp2.pos.x, cp2.pos.y);
      // rotation from velocity
      const vx=cp2.pos.x-cp2.prev.x, vy=cp2.pos.y-cp2.prev.y;
      ctx.rotate(Math.atan2(vy,vx)*0.3);
      ctx.shadowColor='#FF6B35'; ctx.shadowBlur=26;
      ctx.beginPath(); ctx.arc(0,0,this.candy.r,0,Math.PI*2);
      const g=ctx.createRadialGradient(-5,-5,2,0,0,this.candy.r);
      g.addColorStop(0,'#FF9A42'); g.addColorStop(0.5,'#FF6B35'); g.addColorStop(1,'#cc4400');
      ctx.fillStyle=g; ctx.fill();
      ctx.beginPath(); ctx.arc(-5,-5,6,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.42)'; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,0,10,0.2,Math.PI*1.0); ctx.stroke();
      ctx.restore();
    }

    // Cut swipe line
    if (this.cutLine) {
      ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=3;
      ctx.setLineDash([7,4]); ctx.shadowColor='#fff'; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.moveTo(this.cutLine.x1,this.cutLine.y1); ctx.lineTo(this.cutLine.x2,this.cutLine.y2); ctx.stroke();
      ctx.restore();
    }
  }

  drawOmNom(ctx, o) {
    ctx.save();
    const bob=Math.sin(performance.now()*0.003)*3;
    ctx.translate(o.x, o.y+bob);
    const mouth=o.eating?0.9:(0.2+Math.sin(performance.now()*0.005)*0.18);
    // Shadow
    ctx.beginPath(); ctx.ellipse(0,28,22,8,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fill();
    // Body
    ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*2);
    const g=ctx.createRadialGradient(-6,-6,4,0,0,28);
    g.addColorStop(0,'#7ee87e'); g.addColorStop(0.6,'#5bc85b'); g.addColorStop(1,'#3a9e3a');
    ctx.fillStyle=g; ctx.shadowColor='#5bc85b'; ctx.shadowBlur=18; ctx.fill();
    // Tummy patch
    ctx.beginPath(); ctx.ellipse(0,10,14,10,0,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fill();
    // Mouth
    ctx.beginPath(); ctx.moveTo(0,5);
    ctx.arc(0,10,15,-Math.PI/2-mouth,-Math.PI/2+mouth);
    ctx.closePath();
    ctx.fillStyle=o.eating?'#ff9999':'#ff5555'; ctx.shadowBlur=0; ctx.fill();
    // Tongue
    if (!o.eating) {
      ctx.beginPath(); ctx.ellipse(0,22,5,4,0,0,Math.PI*2);
      ctx.fillStyle='#ff8888'; ctx.fill();
    }
    // Eyes
    [-11,11].forEach(ex => {
      ctx.beginPath(); ctx.arc(ex,-11,8,0,Math.PI*2);
      ctx.fillStyle='#fff'; ctx.shadowBlur=0; ctx.fill();
      ctx.beginPath(); ctx.arc(ex+1.5,-11,4,0,Math.PI*2);
      ctx.fillStyle='#111'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex+3,-13,1.5,0,Math.PI*2);
      ctx.fillStyle='#fff'; ctx.fill();
    });
    // Feet
    [-14,14].forEach(fx => {
      ctx.beginPath(); ctx.ellipse(fx,28,7,5,fx>0?0.3:-0.3,0,Math.PI*2);
      ctx.fillStyle='#3a9e3a'; ctx.fill();
    });
    ctx.restore();
  }
}

function vdist(x1,y1,x2,y2) { return Math.sqrt((x2-x1)**2+(y2-y1)**2); }

function segIntersect(x1,y1,x2,y2,x3,y3,x4,y4) {
  const d1x=x2-x1,d1y=y2-y1,d2x=x4-x3,d2y=y4-y3;
  const cross=d1x*d2y-d1y*d2x;
  if(Math.abs(cross)<1e-8) return false;
  const t=((x3-x1)*d2y-(y3-y1)*d2x)/cross;
  const u=((x3-x1)*d1y-(y3-y1)*d1x)/cross;
  return t>=0&&t<=1&&u>=0&&u<=1;
}
