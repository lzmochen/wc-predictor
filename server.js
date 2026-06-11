const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mem_wc2026_secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mem2026';
const DATA_DIR = process.env.RENDER_DISK_PATH || __dirname;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== JSON FILE DATABASE ==========
const DB_PATH = path.join(DATA_DIR, 'db.json');

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: [], matches: [], predictions: [], nextUserId: 1, nextMatchId: 1, nextPredId: 1 };
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch(e) {
    return { users: [], matches: [], predictions: [], nextUserId: 1, nextMatchId: 1, nextPredId: 1 };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Seed default matches
function seedMatches() {
  const db = readDB();
  if (db.matches.length === 0) {
    const seed = [
      { stage: 'group1', group_name: 'A', home: '墨西哥', away: '南非', match_date: '2026-06-12T03:00', venue: '墨西哥城', result_home: null, result_away: null },
      { stage: 'group1', group_name: 'A', home: '韩国', away: '捷克', match_date: '2026-06-12T10:00', venue: '瓜达拉哈拉', result_home: null, result_away: null },
      { stage: 'group1', group_name: 'B', home: '巴西', away: '瑞士', match_date: '2026-06-12T22:00', venue: '洛杉矶', result_home: null, result_away: null },
      { stage: 'group1', group_name: 'B', home: '法国', away: '哥伦比亚', match_date: '2026-06-13T06:00', venue: '纽约', result_home: null, result_away: null },
      { stage: 'group1', group_name: 'C', home: '阿根廷', away: '摩洛哥', match_date: '2026-06-13T09:00', venue: '达拉斯', result_home: null, result_away: null },
      { stage: 'group1', group_name: 'C', home: '英格兰', away: '塞内加尔', match_date: '2026-06-13T22:00', venue: '休斯顿', result_home: null, result_away: null },
    ];
    seed.forEach(m => {
      m.id = db.nextMatchId++;
      m.created_at = new Date().toISOString();
      db.matches.push(m);
    });
    writeDB(db);
    console.log('✅ 已初始化默认比赛数据');
  }
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

// ========== POINTS LOGIC ==========
function calcPoints(prediction, result) {
  if (!prediction || !result) return 0;
  const ph = prediction.home, pa = prediction.away;
  const rh = result.home, ra = result.away;
  let points = 0;
  const pO = ph > pa ? 'W' : ph < pa ? 'L' : 'D';
  const rO = rh > ra ? 'W' : rh < ra ? 'L' : 'D';
  if (pO === rO) points += 1;
  if ((ph+pa<=2?'low':'high') === (rh+ra<=2?'low':'high') && pO === rO) points += 2;
  if (ph === rh && pa === ra) points += 5;
  return points;
}

// ========== API ROUTES ==========

// Register / Login
app.post('/api/register', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入昵称' });
  const trimmed = name.trim().substring(0, 10);
  const db = readDB();
  let user = db.users.find(u => u.name === trimmed);
  if (!user) {
    user = { id: db.nextUserId++, name: trimmed, created_at: new Date().toISOString() };
    db.users.push(user);
    writeDB(db);
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
  const db = readDB();
  const matches = db.matches.sort((a, b) => a.match_date.localeCompare(b.match_date));
  res.json(matches);
});

// Submit prediction
app.post('/api/predict', auth, (req, res) => {
  const { matchId, predHome, predAway } = req.body;
  if (matchId == null || predHome == null || predAway == null) return res.status(400).json({ error: '参数不完整' });
  if (predHome < 0 || predAway < 0 || predHome > 20 || predAway > 20) return res.status(400).json({ error: '比分无效' });

  const db = readDB();
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return res.status(404).json({ error: '比赛不存在' });
  if (match.result_home != null) return res.status(400).json({ error: '比赛已结束' });

  const deadline = new Date(match.match_date);
  deadline.setMinutes(deadline.getMinutes() - 30);
  if (new Date() > deadline) return res.status(400).json({ error: '预言已截止' });

  const existIdx = db.predictions.findIndex(p => p.user_id === req.user.id && p.match_id === matchId);
  if (existIdx >= 0) {
    db.predictions[existIdx].pred_home = predHome;
    db.predictions[existIdx].pred_away = predAway;
    db.predictions[existIdx].updated_at = new Date().toISOString();
  } else {
    db.predictions.push({
      id: db.nextPredId++,
      user_id: req.user.id,
      match_id: matchId,
      pred_home: predHome,
      pred_away: predAway,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  writeDB(db);
  res.json({ success: true });
});

// Get my predictions
app.get('/api/predictions', auth, (req, res) => {
  const db = readDB();
  const preds = db.predictions.filter(p => p.user_id === req.user.id);
  res.json(preds);
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const { stage } = req.query;
  const db = readDB();

  let matches;
  if (stage && stage !== 'total') {
    matches = db.matches.filter(m => m.stage === stage && m.result_home != null);
  } else {
    matches = db.matches.filter(m => m.result_home != null);
  }

  if (matches.length === 0) return res.json([]);

  const matchIds = new Set(matches.map(m => m.id));
  const userPredMap = {};
  db.predictions.forEach(p => {
    if (matchIds.has(p.match_id)) {
      if (!userPredMap[p.user_id]) userPredMap[p.user_id] = {};
      userPredMap[p.user_id][p.match_id] = { home: p.pred_home, away: p.pred_away };
    }
  });

  const result = db.users.map(u => {
    let points = 0, correct = 0, predCount = 0;
    matches.forEach(m => {
      const pred = userPredMap[u.id]?.[m.id];
      if (pred) {
        predCount++;
        const pts = calcPoints(pred, { home: m.result_home, away: m.result_away });
        points += pts;
        if (pts > 0) correct++;
      }
    });
    return { userId: u.id, name: u.name, points, correct, predCount };
  }).filter(u => u.predCount > 0).sort((a, b) => b.points - a.points || b.correct - a.correct);

  res.json(result);
});

// ========== ADMIN API ==========

// Add match
app.post('/api/admin/match', adminAuth, (req, res) => {
  const { stage, groupName, home, away, matchDate, venue } = req.body;
  if (!stage || !home || !away || !matchDate) return res.status(400).json({ error: '参数不完整' });

  const db = readDB();
  db.matches.push({
    id: db.nextMatchId++,
    stage, group_name: groupName || '', home, away,
    match_date: matchDate, venue: venue || '',
    result_home: null, result_away: null,
    created_at: new Date().toISOString()
  });
  writeDB(db);
  res.json({ success: true });
});

// Set match result
app.post('/api/admin/result', adminAuth, (req, res) => {
  const { matchId, resultHome, resultAway } = req.body;
  if (!matchId || resultHome == null || resultAway == null) return res.status(400).json({ error: '参数不完整' });

  const db = readDB();
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return res.status(404).json({ error: '比赛不存在' });
  match.result_home = resultHome;
  match.result_away = resultAway;
  writeDB(db);
  res.json({ success: true });
});

// Delete match
app.delete('/api/admin/match/:id', adminAuth, (req, res) => {
  const matchId = parseInt(req.params.id);
  const db = readDB();
  db.matches = db.matches.filter(m => m.id !== matchId);
  db.predictions = db.predictions.filter(p => p.match_id !== matchId);
  writeDB(db);
  res.json({ success: true });
});

// Get all users (admin)
app.get('/api/admin/users', adminAuth, (req, res) => {
  const db = readDB();
  res.json(db.users);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
seedMatches();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚽ 绿茵预言家服务器已启动: http://localhost:${PORT}`);
  console.log(`🔑 管理员密码: ${ADMIN_PASSWORD}`);
});
