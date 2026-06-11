const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mem_wc2026_secret_key_change_in_production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mem2026';
const DATA_DIR = process.env.RENDER_DISK_PATH || __dirname;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== DATABASE (SQLite3 Async) ==========
const dbPath = path.join(DATA_DIR, 'data.db');

function openDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  const db = await openDb();

  await dbRun(db, `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await dbRun(db, `CREATE TABLE IF NOT EXISTS matches (
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
  )`);

  await dbRun(db, `CREATE TABLE IF NOT EXISTS predictions (
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
  )`);

  // Seed default matches if empty
  const count = await dbGet(db, 'SELECT COUNT(*) as c FROM matches');
  if (count.c === 0) {
    const seed = [
      ['group1', 'A', '墨西哥', '南非', '2026-06-12T03:00', '墨西哥城'],
      ['group1', 'A', '韩国', '捷克', '2026-06-12T10:00', '瓜达拉哈拉'],
      ['group1', 'B', '巴西', '瑞士', '2026-06-12T22:00', '洛杉矶'],
      ['group1', 'B', '法国', '哥伦比亚', '2026-06-13T06:00', '纽约'],
      ['group1', 'C', '阿根廷', '摩洛哥', '2026-06-13T09:00', '达拉斯'],
      ['group1', 'C', '英格兰', '塞内加尔', '2026-06-13T22:00', '休斯顿'],
    ];
    for (const r of seed) {
      await dbRun(db, 'INSERT INTO matches (stage, group_name, home, away, match_date, venue) VALUES (?,?,?,?,?,?)', r);
    }
    console.log('✅ 已初始化默认比赛数据');
  }

  db.close();
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
app.post('/api/register', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入昵称' });
  const trimmed = name.trim().substring(0, 10);

  const db = await openDb();
  try {
    let user = await dbGet(db, 'SELECT * FROM users WHERE name = ?', [trimmed]);
    if (!user) {
      const result = await dbRun(db, 'INSERT INTO users (name) VALUES (?)', [trimmed]);
      user = { id: result.lastID, name: trimmed };
    }
    const token = jwt.sign({ id: user.id, name: user.name, isAdmin: false }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.name } });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
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
app.get('/api/matches', async (req, res) => {
  const db = await openDb();
  try {
    const matches = await dbAll(db, 'SELECT * FROM matches ORDER BY match_date ASC');
    res.json(matches);
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// Submit prediction
app.post('/api/predict', auth, async (req, res) => {
  const { matchId, predHome, predAway } = req.body;
  if (matchId == null || predHome == null || predAway == null) return res.status(400).json({ error: '参数不完整' });
  if (predHome < 0 || predAway < 0 || predHome > 20 || predAway > 20) return res.status(400).json({ error: '比分无效' });

  const db = await openDb();
  try {
    const match = await dbGet(db, 'SELECT * FROM matches WHERE id = ?', [matchId]);
    if (!match) return res.status(404).json({ error: '比赛不存在' });
    if (match.result_home != null) return res.status(400).json({ error: '比赛已结束' });

    const deadline = new Date(match.match_date);
    deadline.setMinutes(deadline.getMinutes() - 30);
    if (new Date() > deadline) return res.status(400).json({ error: '预言已截止' });

    await dbRun(db, `
      INSERT INTO predictions (user_id, match_id, pred_home, pred_away) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, match_id) DO UPDATE SET pred_home=excluded.pred_home, pred_away=excluded.pred_away, updated_at=CURRENT_TIMESTAMP
    `, [req.user.id, matchId, predHome, predAway]);

    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// Get my predictions
app.get('/api/predictions', auth, async (req, res) => {
  const db = await openDb();
  try {
    const preds = await dbAll(db, 'SELECT * FROM predictions WHERE user_id = ?', [req.user.id]);
    res.json(preds);
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const { stage } = req.query;
  const db = await openDb();

  try {
    let matches;
    if (stage && stage !== 'total') {
      matches = await dbAll(db, 'SELECT * FROM matches WHERE stage = ? AND result_home IS NOT NULL', [stage]);
    } else {
      matches = await dbAll(db, 'SELECT * FROM matches WHERE result_home IS NOT NULL');
    }

    if (matches.length === 0) return res.json([]);

    const matchIds = matches.map(m => m.id);
    const placeholders = matchIds.map(() => '?').join(',');

    const rows = await dbAll(db, `
      SELECT u.id as user_id, u.name, COUNT(p.id) as pred_count
      FROM users u
      LEFT JOIN predictions p ON u.id = p.user_id AND p.match_id IN (${placeholders})
      GROUP BY u.id
    `, matchIds);

    const allPreds = await dbAll(db, `
      SELECT p.* FROM predictions p WHERE p.match_id IN (${placeholders})
    `, matchIds);

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
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// ========== ADMIN API ==========

// Add match
app.post('/api/admin/match', adminAuth, async (req, res) => {
  const { stage, groupName, home, away, matchDate, venue } = req.body;
  if (!stage || !home || !away || !matchDate) return res.status(400).json({ error: '参数不完整' });

  const db = await openDb();
  try {
    await dbRun(db, 'INSERT INTO matches (stage, group_name, home, away, match_date, venue) VALUES (?,?,?,?,?,?)',
      [stage, groupName || '', home, away, matchDate, venue || '']);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// Set match result
app.post('/api/admin/result', adminAuth, async (req, res) => {
  const { matchId, resultHome, resultAway } = req.body;
  if (!matchId || resultHome == null || resultAway == null) return res.status(400).json({ error: '参数不完整' });

  const db = await openDb();
  try {
    await dbRun(db, 'UPDATE matches SET result_home = ?, result_away = ? WHERE id = ?', [resultHome, resultAway, matchId]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// Delete match
app.delete('/api/admin/match/:id', adminAuth, async (req, res) => {
  const db = await openDb();
  try {
    await dbRun(db, 'DELETE FROM predictions WHERE match_id = ?', [req.params.id]);
    await dbRun(db, 'DELETE FROM matches WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// Get all users (admin)
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const db = await openDb();
  try {
    const users = await dbAll(db, 'SELECT * FROM users ORDER BY created_at ASC');
    res.json(users);
  } catch(e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
async function start() {
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚽ 绿茵预言家服务器已启动: http://localhost:${PORT}`);
    console.log(`🔑 管理员密码: ${ADMIN_PASSWORD}`);
    console.log(`📁 数据目录: ${DATA_DIR}`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
