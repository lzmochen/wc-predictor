const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mem_wc2026_secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mem2026';
const REGISTER_PASSWORD = process.env.REGISTER_PASSWORD || 'thumem';
const MAX_ACCOUNTS_PER_IP = parseInt(process.env.MAX_ACCOUNTS_PER_IP) || 2;
const DATA_DIR = process.env.RENDER_DISK_PATH || __dirname;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== FULL WORLD CUP 2026 SCHEDULE ==========
const WC_SCHEDULE = [
  // === 小组赛第1轮 ===
  { stage:'group1', group:'A', home:'墨西哥', away:'南非', date:'2026-06-12T03:00', venue:'墨西哥城' },
  { stage:'group1', group:'A', home:'韩国', away:'捷克', date:'2026-06-12T10:00', venue:'瓜达拉哈拉' },
  { stage:'group1', group:'B', home:'加拿大', away:'波黑', date:'2026-06-13T03:00', venue:'多伦多' },
  { stage:'group1', group:'D', home:'美国', away:'巴拉圭', date:'2026-06-13T09:00', venue:'洛杉矶' },
  { stage:'group1', group:'B', home:'卡塔尔', away:'瑞士', date:'2026-06-14T03:00', venue:'旧金山' },
  { stage:'group1', group:'C', home:'巴西', away:'摩洛哥', date:'2026-06-14T06:00', venue:'纽约' },
  { stage:'group1', group:'C', home:'海地', away:'苏格兰', date:'2026-06-14T09:00', venue:'波士顿' },
  { stage:'group1', group:'D', home:'澳大利亚', away:'土耳其', date:'2026-06-14T12:00', venue:'温哥华' },
  { stage:'group1', group:'E', home:'德国', away:'库拉索', date:'2026-06-15T06:00', venue:'休斯顿' },
  { stage:'group1', group:'E', home:'科特迪瓦', away:'厄瓜多尔', date:'2026-06-15T09:00', venue:'达拉斯' },
  { stage:'group1', group:'F', home:'荷兰', away:'日本', date:'2026-06-15T22:00', venue:'迈阿密' },
  { stage:'group1', group:'F', home:'瑞典', away:'突尼斯', date:'2026-06-16T03:00', venue:'费城' },
  { stage:'group1', group:'G', home:'比利时', away:'埃及', date:'2026-06-16T06:00', venue:'亚特兰大' },
  { stage:'group1', group:'G', home:'伊朗', away:'新西兰', date:'2026-06-16T09:00', venue:'西雅图' },
  { stage:'group1', group:'H', home:'西班牙', away:'佛得角', date:'2026-06-16T22:00', venue:'旧金山' },
  { stage:'group1', group:'H', home:'沙特', away:'乌拉圭', date:'2026-06-17T03:00', venue:'墨西哥城' },
  { stage:'group1', group:'I', home:'法国', away:'塞内加尔', date:'2026-06-17T06:00', venue:'休斯顿' },
  { stage:'group1', group:'I', home:'伊拉克', away:'挪威', date:'2026-06-17T09:00', venue:'温哥华' },
  { stage:'group1', group:'J', home:'阿根廷', away:'阿尔及利亚', date:'2026-06-17T22:00', venue:'达拉斯' },
  { stage:'group1', group:'J', home:'奥地利', away:'约旦', date:'2026-06-18T03:00', venue:'堪萨斯城' },
  { stage:'group1', group:'K', home:'葡萄牙', away:'民主刚果', date:'2026-06-18T06:00', venue:'纽约' },
  { stage:'group1', group:'K', home:'乌兹别克斯坦', away:'哥伦比亚', date:'2026-06-18T09:00', venue:'波士顿' },
  { stage:'group1', group:'L', home:'英格兰', away:'克罗地亚', date:'2026-06-18T22:00', venue:'洛杉矶' },
  { stage:'group1', group:'L', home:'加纳', away:'巴拿马', date:'2026-06-19T03:00', venue:'亚特兰大' },

  // === 小组赛第2轮 ===
  { stage:'group2', group:'A', home:'墨西哥', away:'韩国', date:'2026-06-19T06:00', venue:'墨西哥城' },
  { stage:'group2', group:'A', home:'南非', away:'捷克', date:'2026-06-19T22:00', venue:'休斯顿' },
  { stage:'group2', group:'B', home:'加拿大', away:'卡塔尔', date:'2026-06-20T03:00', venue:'多伦多' },
  { stage:'group2', group:'B', home:'波黑', away:'瑞士', date:'2026-06-20T06:00', venue:'费城' },
  { stage:'group2', group:'C', home:'巴西', away:'海地', date:'2026-06-20T22:00', venue:'纽约' },
  { stage:'group2', group:'C', home:'摩洛哥', away:'苏格兰', date:'2026-06-21T03:00', venue:'迈阿密' },
  { stage:'group2', group:'D', home:'美国', away:'澳大利亚', date:'2026-06-21T06:00', venue:'洛杉矶' },
  { stage:'group2', group:'D', home:'巴拉圭', away:'土耳其', date:'2026-06-21T09:00', venue:'达拉斯' },
  { stage:'group2', group:'E', home:'德国', away:'科特迪瓦', date:'2026-06-21T22:00', venue:'波士顿' },
  { stage:'group2', group:'E', home:'库拉索', away:'厄瓜多尔', date:'2026-06-22T03:00', venue:'休斯顿' },
  { stage:'group2', group:'F', home:'荷兰', away:'瑞典', date:'2026-06-22T06:00', venue:'亚特兰大' },
  { stage:'group2', group:'F', home:'日本', away:'突尼斯', date:'2026-06-22T09:00', venue:'西雅图' },
  { stage:'group2', group:'G', home:'比利时', away:'伊朗', date:'2026-06-22T22:00', venue:'旧金山' },
  { stage:'group2', group:'G', home:'埃及', away:'新西兰', date:'2026-06-23T03:00', venue:'墨西哥城' },
  { stage:'group2', group:'H', home:'西班牙', away:'沙特', date:'2026-06-23T06:00', venue:'纽约' },
  { stage:'group2', group:'H', home:'佛得角', away:'乌拉圭', date:'2026-06-23T09:00', venue:'波士顿' },
  { stage:'group2', group:'I', home:'法国', away:'伊拉克', date:'2026-06-23T22:00', venue:'迈阿密' },
  { stage:'group2', group:'I', home:'塞内加尔', away:'挪威', date:'2026-06-24T03:00', venue:'温哥华' },
  { stage:'group2', group:'J', home:'阿根廷', away:'奥地利', date:'2026-06-24T06:00', venue:'达拉斯' },
  { stage:'group2', group:'J', home:'阿尔及利亚', away:'约旦', date:'2026-06-24T09:00', venue:'休斯顿' },
  { stage:'group2', group:'K', home:'葡萄牙', away:'乌兹别克斯坦', date:'2026-06-24T22:00', venue:'费城' },
  { stage:'group2', group:'K', home:'民主刚果', away:'哥伦比亚', date:'2026-06-25T03:00', venue:'洛杉矶' },
  { stage:'group2', group:'L', home:'英格兰', away:'加纳', date:'2026-06-25T06:00', venue:'纽约' },
  { stage:'group2', group:'L', home:'克罗地亚', away:'巴拿马', date:'2026-06-25T09:00', venue:'亚特兰大' },

  // === 小组赛第3轮 ===
  { stage:'group3', group:'A', home:'墨西哥', away:'捷克', date:'2026-06-26T03:00', venue:'墨西哥城' },
  { stage:'group3', group:'A', home:'南非', away:'韩国', date:'2026-06-26T03:00', venue:'休斯顿' },
  { stage:'group3', group:'B', home:'加拿大', away:'瑞士', date:'2026-06-26T09:00', venue:'多伦多' },
  { stage:'group3', group:'B', home:'波黑', away:'卡塔尔', date:'2026-06-26T09:00', venue:'费城' },
  { stage:'group3', group:'C', home:'巴西', away:'苏格兰', date:'2026-06-27T03:00', venue:'纽约' },
  { stage:'group3', group:'C', home:'摩洛哥', away:'海地', date:'2026-06-27T03:00', venue:'迈阿密' },
  { stage:'group3', group:'D', home:'美国', away:'土耳其', date:'2026-06-27T09:00', venue:'洛杉矶' },
  { stage:'group3', group:'D', home:'巴拉圭', away:'澳大利亚', date:'2026-06-27T09:00', venue:'达拉斯' },
  { stage:'group3', group:'E', home:'德国', away:'厄瓜多尔', date:'2026-06-28T03:00', venue:'波士顿' },
  { stage:'group3', group:'E', home:'库拉索', away:'科特迪瓦', date:'2026-06-28T03:00', venue:'休斯顿' },
  { stage:'group3', group:'F', home:'荷兰', away:'突尼斯', date:'2026-06-28T09:00', venue:'亚特兰大' },
  { stage:'group3', group:'F', home:'瑞典', away:'日本', date:'2026-06-28T09:00', venue:'西雅图' },
  { stage:'group3', group:'G', home:'比利时', away:'新西兰', date:'2026-06-29T03:00', venue:'旧金山' },
  { stage:'group3', group:'G', home:'埃及', away:'伊朗', date:'2026-06-29T03:00', venue:'墨西哥城' },
  { stage:'group3', group:'H', home:'西班牙', away:'乌拉圭', date:'2026-06-29T09:00', venue:'纽约' },
  { stage:'group3', group:'H', home:'佛得角', away:'沙特', date:'2026-06-29T09:00', venue:'波士顿' },
  { stage:'group3', group:'I', home:'法国', away:'挪威', date:'2026-06-30T03:00', venue:'迈阿密' },
  { stage:'group3', group:'I', home:'塞内加尔', away:'伊拉克', date:'2026-06-30T03:00', venue:'温哥华' },
  { stage:'group3', group:'J', home:'阿根廷', away:'约旦', date:'2026-06-30T09:00', venue:'达拉斯' },
  { stage:'group3', group:'J', home:'阿尔及利亚', away:'奥地利', date:'2026-06-30T09:00', venue:'休斯顿' },
  { stage:'group3', group:'K', home:'葡萄牙', away:'哥伦比亚', date:'2026-07-01T03:00', venue:'费城' },
  { stage:'group3', group:'K', home:'民主刚果', away:'乌兹别克斯坦', date:'2026-07-01T03:00', venue:'洛杉矶' },
  { stage:'group3', group:'L', home:'英格兰', away:'巴拿马', date:'2026-07-01T09:00', venue:'纽约' },
  { stage:'group3', group:'L', home:'克罗地亚', away:'加纳', date:'2026-07-01T09:00', venue:'亚特兰大' },

  // === 1/16决赛 ===
  { stage:'r32', group:'', home:'1A', away:'2B', date:'2026-07-03T06:00', venue:'待定' },
  { stage:'r32', group:'', home:'1B', away:'2A', date:'2026-07-03T09:00', venue:'待定' },
  { stage:'r32', group:'', home:'1C', away:'2D', date:'2026-07-04T03:00', venue:'待定' },
  { stage:'r32', group:'', home:'1D', away:'2C', date:'2026-07-04T06:00', venue:'待定' },
  { stage:'r32', group:'', home:'1E', away:'2F', date:'2026-07-04T09:00', venue:'待定' },
  { stage:'r32', group:'', home:'1F', away:'2E', date:'2026-07-05T03:00', venue:'待定' },
  { stage:'r32', group:'', home:'1G', away:'2H', date:'2026-07-05T06:00', venue:'待定' },
  { stage:'r32', group:'', home:'1H', away:'2G', date:'2026-07-05T09:00', venue:'待定' },
  { stage:'r32', group:'', home:'1I', away:'2J', date:'2026-07-06T03:00', venue:'待定' },
  { stage:'r32', group:'', home:'1J', away:'2I', date:'2026-07-06T06:00', venue:'待定' },
  { stage:'r32', group:'', home:'1K', away:'2L', date:'2026-07-06T09:00', venue:'待定' },
  { stage:'r32', group:'', home:'1L', away:'2K', date:'2026-07-07T03:00', venue:'待定' },
  { stage:'r32', group:'', home:'3rd1', away:'3rd2', date:'2026-07-07T06:00', venue:'待定' },
  { stage:'r32', group:'', home:'3rd3', away:'3rd4', date:'2026-07-07T09:00', venue:'待定' },
  { stage:'r32', group:'', home:'3rd5', away:'3rd6', date:'2026-07-08T03:00', venue:'待定' },
  { stage:'r32', group:'', home:'3rd7', away:'3rd8', date:'2026-07-08T06:00', venue:'待定' },

  // === 1/8决赛 ===
  { stage:'r16', group:'', home:'TBD', away:'TBD', date:'2026-07-10T06:00', venue:'待定' },
  { stage:'r16', group:'', home:'TBD', away:'TBD', date:'2026-07-10T09:00', venue:'待定' },
  { stage:'r16', group:'', home:'TBD', away:'TBD', date:'2026-07-11T03:00', venue:'待定' },
  { stage:'r16', group:'', home:'TBD', away:'TBD', date:'2026-07-11T06:00', venue:'待定' },

  // === 半决赛 ===
  { stage:'r8', group:'', home:'TBD', away:'TBD', date:'2026-07-14T03:00', venue:'待定' },
  { stage:'r8', group:'', home:'TBD', away:'TBD', date:'2026-07-15T03:00', venue:'待定' },

  // === 季军赛 ===
  { stage:'r3rd', group:'', home:'TBD', away:'TBD', date:'2026-07-18T03:00', venue:'待定' },

  // === 决赛 ===
  { stage:'final', group:'', home:'TBD', away:'TBD', date:'2026-07-19T03:00', venue:'纽约大都会人寿' },
];

// ========== JSON FILE DATABASE ==========
const DB_PATH = path.join(DATA_DIR, 'db.json');

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return { users: [], matches: [], predictions: [], nextUserId: 1, nextMatchId: 1, nextPredId: 1 };
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // Ensure ipRegistry exists for backwards compatibility
    if (!db.ipRegistry) db.ipRegistry = {};
    return db;
  } catch(e) {
    return { users: [], matches: [], predictions: [], nextUserId: 1, nextMatchId: 1, nextPredId: 1, ipRegistry: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Seed WC schedule into matches
function seedMatches() {
  const db = readDB();
  if (db.matches.length === 0) {
    WC_SCHEDULE.forEach(m => {
      db.matches.push({
        id: db.nextMatchId++,
        stage: m.stage,
        group_name: m.group || '',
        home: m.home,
        away: m.away,
        match_date: m.date,
        venue: m.venue || '',
        result_home: null,
        result_away: null,
        created_at: new Date().toISOString()
      });
    });
    writeDB(db);
    console.log(`✅ 已初始化 ${WC_SCHEDULE.length} 场世界杯比赛数据`);
  } else {
    console.log(`✅ 已有 ${db.matches.length} 场比赛数据`);
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
  const { name, registerPassword } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入昵称' });
  if (!registerPassword) return res.status(400).json({ error: '请输入注册密码' });
  if (registerPassword !== REGISTER_PASSWORD) return res.status(400).json({ error: '注册密码错误，请联系群主获取' });
  
  // IP-based registration limit
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const db = readDB();
  const ipCount = db.ipRegistry[clientIP] || 0;
  if (ipCount >= MAX_ACCOUNTS_PER_IP) {
    return res.status(429).json({ error: `该设备已注册${ipCount}个账号，每人限1个账号，多注册请联系管理员` });
  }
  
  const trimmed = name.trim().substring(0, 10);
  let user = db.users.find(u => u.name === trimmed);
  if (!user) {
    user = { id: db.nextUserId++, name: trimmed, ip: clientIP, created_at: new Date().toISOString() };
    db.users.push(user);
    // Track IP registration count
    db.ipRegistry[clientIP] = ipCount + 1;
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

// Get WC schedule (full schedule view, grouped by date)
app.get('/api/schedule', (req, res) => {
  const db = readDB();
  const matches = db.matches.sort((a, b) => a.match_date.localeCompare(b.match_date));
  
  // Group by date
  const grouped = {};
  matches.forEach(m => {
    const d = m.match_date.substring(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });
  
  res.json(grouped);
});

// Get today's matches
app.get('/api/today', (req, res) => {
  const db = readDB();
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().substring(0, 10);
  
  const matches = db.matches.filter(m => {
    const d = m.match_date.substring(0, 10);
    return d === todayStr || d === tomorrow;
  }).sort((a, b) => a.match_date.localeCompare(b.match_date));
  
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
  // Include IP info for admin
  const users = db.users.map(u => ({
    id: u.id,
    name: u.name,
    ip: u.ip || 'unknown',
    created_at: u.created_at
  }));
  res.json(users);
});

// Get IP registration stats (admin)
app.get('/api/admin/ip-stats', adminAuth, (req, res) => {
  const db = readDB();
  const ipMap = {};
  db.users.forEach(u => {
    const ip = u.ip || 'unknown';
    if (!ipMap[ip]) ipMap[ip] = { count: 0, users: [] };
    ipMap[ip].count++;
    ipMap[ip].users.push(u.name);
  });
  // Only show IPs with 2+ accounts
  const suspicious = Object.entries(ipMap)
    .filter(([_, v]) => v.count >= 2)
    .map(([ip, v]) => ({ ip, count: v.count, users: v.users }));
  res.json({ totalUsers: db.users.length, suspiciousIPs: suspicious, ipRegistry: db.ipRegistry || {} });
});

// Reset matches to WC schedule (admin)
app.post('/api/admin/reset-schedule', adminAuth, (req, res) => {
  const db = readDB();
  db.matches = [];
  db.nextMatchId = 1;
  WC_SCHEDULE.forEach(m => {
    db.matches.push({
      id: db.nextMatchId++,
      stage: m.stage,
      group_name: m.group || '',
      home: m.home,
      away: m.away,
      match_date: m.date,
      venue: m.venue || '',
      result_home: null,
      result_away: null,
      created_at: new Date().toISOString()
    });
  });
  writeDB(db);
  res.json({ success: true, count: db.matches.length });
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
