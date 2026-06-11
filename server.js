const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mem_wc2026_secret_key_change_in_production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mem2026';
const DATA_DIR = process.env.RENDER_DISK_PATH || __dirname;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database - use persistent disk if available
const dbPath = path.join(DATA_DIR, 'data.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage TEXT NOT NULL,
    group_name TEXT DEFAULT '',
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    match_date TEXT NOT NULL,
    venue TEXT DEFAULT '',
    result_home INTEGER DEFAULT NULL,
    result_away INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,
    pred_home INTEGER NOT NULL,
    pred_away INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, match_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (match_id) REFERENCES matches(id)
  );
`);

// Seed default matches if empty
const matchCount = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;
if (matchCount === 0) {
  const insert = db.prepare('INSERT INTO matches (stage, group_name, home, away, match_date, venue) VALUES (?,?,?,?,?,?)');
  const seed = [
    ['group1', 'A', '墨西哥', '南非', '2026-06-12T03:00', '墨西哥城'],
    ['group1', 'A', '韩国', '捷克', '2026-06-12T10:00', '瓜达拉哈拉'],
    ['group1', 'B', '巴西', '瑞士', '2026-06-12T22:00', '洛杉矶'],
    ['group1', 'B', '法国', '哥伦比亚', '2026-06-13T06:00', '纽约'],
    ['group1', 'C', '阿根廷', '摩洛哥', '2026-06-13T09:00', '达拉斯'],
    ['group1', 'C', '英格兰', '塞内加尔', '2026-06-13T22:00', '休斯顿'],
  ];
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(...r);
  });
  insertMany(seed);
  console.log('✅ 已初始化默认比赛数据');
}

// ========== AUTH HELPERS ==========
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: '无管理员权限' });
    req.user = decoded;
    next();
  } catch(e) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

// ========== API ROUTES ==========

// Register / Login
app.post('/api/register', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入昵称' });
  const trimmed = name.trim().substring(0, 10);
  
  let user = db.prepare('SELECT * FROM users WHERE name = ?').get(trimmed);
  if (!user) {
    const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(trimmed);
    user = { id: result.lastInsertRowid, name: trimmed };
  }
  
  const token = jwt.sign({ id: user.id, name: user.name, isAdmin: false }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name } });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '管理员密码错误' });
  const token = jwt.sign({ id: 0, name: '管理员', isAdmin: true }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Get current user
app.get('/api/me', auth, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, isAdmin: req.user.isAdmin || false });
});

// Get all matches
app.get('/api/matches', (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY match_date ASC').all();
  res.json(matches);
});

// Submit prediction
app.post('/api/predict', auth, (req, res) => {
  const { matchId, predHome, predAway } = req.body;
  if (matchId == null || predHome == null || predAway == null) return res.status(400).json({ error: '参数不完整' });
  if (predHome < 0 || predAway < 0 || predHome > 20 || predAway > 20) return res.status(400).json({ error: '比分无效' });
  
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) return res.status(404).json({ error: '比赛不存在' });
  if (match.result_home != null) return res.status(400).json({ error: '比赛已结束' });
  
  const deadline = new Date(match.match_date);
  deadline.setMinutes(deadline.getMinutes() - 30);
  if (new Date() > deadline) return res.status(400).json({ error: '预言已截止' });
  
  db.prepare(`
    INSERT INTO predictions (user_id, match_id, pred_home, pred_away) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, match_id) DO UPDATE SET pred_home=excluded.pred_home, pred_away=excluded.pred_away, updated_at=CURRENT_TIMESTAMP
  `).run(req.user.id, matchId, predHome, predAway);
  
  res.json({ success: true });
});

// Get my predictions
app.get('/api/predictions', auth, (req, res) => {
  const preds = db.prepare('SELECT * FROM predictions WHERE user_id = ?').all(req.user.id);
  res.json(preds);
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const { stage } = req.query;
  
  let matches;
  if (stage && stage !== 'total') {
    matches = db.prepare('SELECT * FROM matches WHERE stage = ? AND result_home IS NOT NULL').all(stage);
  } else {
    matches = db.prepare('SELECT * FROM matches WHERE result_home IS NOT NULL').all();
  }
  
  if (matches.length === 0) return res.json([]);
  
  const matchIds = matches.map(m => m.id);
  const placeholders = matchIds.map(() => '?').join(',');
  
  const rows = db.prepare(`
    SELECT u.id as user_id, u.name,
           COUNT(p.id) as pred_count
    FROM users u
    LEFT JOIN predictions p ON u.id = p.user_id AND p.match_id IN (${placeholders})
    GROUP BY u.id
  `).all(...matchIds);
  
  const allPreds = db.prepare(`
    SELECT p.* FROM predictions p WHERE p.match_id IN (${placeholders})
  `).all(...matchIds);
  
  const userPredMap = {};
  allPreds.forEach(p => {
    if (!userPredMap[p.user_id]) userPredMap[p.user_id] = {};
    userPredMap[p.user_id][p.match_id] = { home: p.pred_home, away: p.pred_away };
  });
  
  const result = rows.map(u => {
    let points = 0;
    let correct = 0;
    let predCount = 0;
    matches.forEach(m => {
      const pred = userPredMap[u.user_id]?.[m.id];
      if (pred) {
        predCount++;
        if (m.result_home != null) {
          const pts = calcPoints(pred, { home: m.result_home, away: m.result_away });
          points += pts;
          if (pts > 0) correct++;
        }
      }
    });
    return { userId: u.user_id, name: u.name, points, correct, predCount };
  }).sort((a, b) => b.points - a.points || b.correct - a.correct);
  
  res.json(result);
});

// Get point breakdown
app.get('/api/points/:matchId', auth, (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.matchId);
  if (!match || match.result_home == null) return res.json({ points: 0, breakdown: [] });
  
  const pred = db.prepare('SELECT * FROM predictions WHERE user_id = ? AND match_id = ?').get(req.user.id, req.params.matchId);
  if (!pred) return res.json({ points: 0, breakdown: [] });
  
  const result = { home: match.result_home, away: match.result_away };
  const prediction = { home: pred.pred_home, away: pred.pred_away };
  const points = calcPoints(prediction, result);
  const breakdown = getPointBreakdown(prediction, result);
  
  res.json({ points, breakdown });
});

// ========== ADMIN API ==========

// Add match
app.post('/api/admin/match', adminAuth, (req, res) => {
  const { stage, groupName, home, away, matchDate, venue } = req.body;
  if (!stage || !home || !away || !matchDate) return res.status(400).json({ error: '参数不完整' });
  
  db.prepare('INSERT INTO matches (stage, group_name, home, away, match_date, venue) VALUES (?,?,?,?,?,?)')
    .run(stage, groupName || '', home, away, matchDate, venue || '');
  res.json({ success: true });
});

// Set match result
app.post('/api/admin/result', adminAuth, (req, res) => {
  const { matchId, resultHome, resultAway } = req.body;
  if (!matchId || resultHome == null || resultAway == null) return res.status(400).json({ error: '参数不完整' });
  
  db.prepare('UPDATE matches SET result_home = ?, result_away = ? WHERE id = ?')
    .run(resultHome, resultAway, matchId);
  res.json({ success: true });
});

// Delete match
app.delete('/api/admin/match/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM predictions WHERE match_id = ?').run(req.params.id);
  db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get all users (admin)
app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ========== POINTS LOGIC ==========
function calcPoints(prediction, result) {
  if (!prediction || !result) return 0;
  const ph = prediction.home, pa = prediction.away;
  const rh = result.home, ra = result.away;
  
  let points = 0;
  const pOutcome = ph > pa ? 'W' : ph < pa ? 'L' : 'D';
  const rOutcome = rh > ra ? 'W' : rh < ra ? 'L' : 'D';
  
  if (pOutcome === rOutcome) points += 1;
  
  const pTotal = ph + pa, rTotal = rh + ra;
  const pRange = pTotal <= 2 ? 'low' : 'high';
  const rRange = rTotal <= 2 ? 'low' : 'high';
  if (pRange === rRange && pOutcome === rOutcome) points += 2;
  
  if (ph === rh && pa === ra) points += 5;
  
  return points;
}

function getPointBreakdown(prediction, result) {
  if (!prediction || !result) return [];
  const ph = prediction.home, pa = prediction.away;
  const rh = result.home, ra = result.away;
  const breakdown = [];
  
  const pOutcome = ph > pa ? 'W' : ph < pa ? 'L' : 'D';
  const rOutcome = rh > ra ? 'W' : rh < ra ? 'L' : 'D';
  
  if (pOutcome === rOutcome) breakdown.push({ type: 'bronze', label: '胜负正确', pts: 1 });
  
  const pTotal = ph + pa, rTotal = rh + ra;
  const pRange = pTotal <= 2 ? 'low' : 'high';
  const rRange = rTotal <= 2 ? 'low' : 'high';
  if (pRange === rRange && pOutcome === rOutcome) breakdown.push({ type: 'gold', label: '区间正确', pts: 2 });
  
  if (ph === rh && pa === ra) breakdown.push({ type: 'crown', label: '比分命中', pts: 5 });
  
  return breakdown;
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚽ 绿茵预言家服务器已启动: http://localhost:${PORT}`);
  console.log(`🔑 管理员密码: ${ADMIN_PASSWORD}`);
  console.log(`📁 数据目录: ${DATA_DIR}`);
});
