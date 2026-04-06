from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3, hashlib, secrets, os

app = FastAPI(title="Cut The Rope")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

DB = "/app/data/game.db"
os.makedirs("/app/data", exist_ok=True)

def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    c = db()
    c.execute('''CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        token TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS scores(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        level INTEGER NOT NULL,
        stars INTEGER NOT NULL,
        score INTEGER NOT NULL,
        ts TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )''')
    c.commit(); c.close()

init_db()

def hp(p): return hashlib.sha256(p.encode()).hexdigest()
def by_token(t):
    c = db(); u = c.execute("SELECT * FROM users WHERE token=?", (t,)).fetchone(); c.close(); return u

class Reg(BaseModel):
    username: str
    email: str
    password: str

class Login(BaseModel):
    username: str
    password: str

class ScoreReq(BaseModel):
    token: str
    level: int
    stars: int
    score: int

@app.post("/api/register")
def register(r: Reg):
    if len(r.username) < 3: raise HTTPException(400, "Username min 3 chars")
    if len(r.password) < 6: raise HTTPException(400, "Password min 6 chars")
    c = db()
    try:
        tok = secrets.token_hex(32)
        c.execute("INSERT INTO users(username,email,password,token) VALUES(?,?,?,?)", (r.username, r.email, hp(r.password), tok))
        c.commit()
        uid = c.execute("SELECT id FROM users WHERE username=?", (r.username,)).fetchone()["id"]
        return {"success": True, "token": tok, "username": r.username, "user_id": uid}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Username or email already taken")
    finally:
        c.close()

@app.post("/api/login")
def login(r: Login):
    c = db()
    u = c.execute("SELECT * FROM users WHERE username=? AND password=?", (r.username, hp(r.password))).fetchone()
    if not u: c.close(); raise HTTPException(401, "Invalid credentials")
    tok = secrets.token_hex(32)
    c.execute("UPDATE users SET token=? WHERE id=?", (tok, u["id"]))
    c.commit(); c.close()
    return {"success": True, "token": tok, "username": u["username"], "user_id": u["id"]}

@app.post("/api/score")
def save_score(r: ScoreReq):
    u = by_token(r.token)
    if not u: raise HTTPException(401, "Invalid token")
    c = db()
    ex = c.execute("SELECT * FROM scores WHERE user_id=? AND level=?", (u["id"], r.level)).fetchone()
    if ex:
        if r.stars > ex["stars"] or (r.stars == ex["stars"] and r.score > ex["score"]):
            c.execute("UPDATE scores SET stars=?,score=?,ts=CURRENT_TIMESTAMP WHERE id=?", (r.stars, r.score, ex["id"]))
    else:
        c.execute("INSERT INTO scores(user_id,level,stars,score) VALUES(?,?,?,?)", (u["id"], r.level, r.stars, r.score))
    c.commit(); c.close()
    return {"success": True}

@app.get("/api/progress")
def get_progress(token: str):
    u = by_token(token)
    if not u: raise HTTPException(401, "Invalid token")
    c = db()
    rows = c.execute("SELECT level,stars,score FROM scores WHERE user_id=? ORDER BY level", (u["id"],)).fetchall()
    c.close()
    return {"progress": [{"level": r["level"], "stars": r["stars"], "score": r["score"]} for r in rows]}

@app.get("/api/leaderboard")
def leaderboard():
    c = db()
    rows = c.execute("""SELECT u.username, SUM(s.score) as total, SUM(s.stars) as stars
        FROM scores s JOIN users u ON s.user_id=u.id
        GROUP BY u.id ORDER BY total DESC LIMIT 20""").fetchall()
    c.close()
    return {"leaderboard": [{"username": r["username"], "total": r["total"], "stars": r["stars"]} for r in rows]}

app.mount("/", StaticFiles(directory="static", html=True), name="static")
