'use strict';
/**
 * 商品目录网站 — 顾客端 + 管理后台（同域名）
 * Customer storefront (/) + admin backend (/admin)
 *
 * 技术栈：Node.js + Express + multer，数据库就是 data/products.json
 * 无构建步骤：npm install && npm start 即可运行。
 *
 * 宝塔部署：监听 0.0.0.0:3000（可用环境变量 PORT 改端口），
 * 宝塔里用反向代理把域名指向 http://127.0.0.1:3000 即可。
 */
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('./config');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0'; // 宝塔反向代理走 127.0.0.1:3000，0.0.0.0 包含它
const ADMIN_USER = process.env.ADMIN_USER || 'admin01'; // 管理员账号（也可以在 .env 里用 ADMIN_USER 改）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '968574'; // 管理员密码（也可以在 .env 里用 ADMIN_PASSWORD 改）

const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// ---------- 数据层：JSON 文件就是数据库 ----------
function loadProducts() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}
function saveProducts(list) {
  // 先写临时文件再改名，避免写一半断电损坏
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8');
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- 访问统计：每天多少人看网站 + 每个商品被看了多少次（存 data/stats.json） ----------
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
function loadStats() {
  try {
    const s = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    return { days: s.days || {}, productViews: s.productViews || {} };
  } catch (e) {
    return { days: {}, productViews: {} };
  }
}
function saveStats(s) {
  // 只留最近 60 天，IP 只存哈希、每天清掉旧的
  const keys = Object.keys(s.days).sort().slice(-60);
  const days = {};
  for (const k of keys) days[k] = s.days[k];
  const tmp = STATS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ days, productViews: s.productViews }, null, 2), 'utf-8');
  fs.renameSync(tmp, STATS_FILE);
}
// ---------- 广告费用记账：每笔充值 / 花费（存 data/ad_spend.json，不进仓库） ----------
const ADS_FILE = path.join(__dirname, 'data', 'ad_spend.json');
function loadAds() {
  try {
    const a = JSON.parse(fs.readFileSync(ADS_FILE, 'utf-8'));
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}
function saveAds(list) {
  const tmp = ADS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8');
  fs.renameSync(tmp, ADS_FILE);
}
function todayStr(d) { return (d || new Date()).toISOString().slice(0, 10); }
function trackVisit(req) {
  try {
    const s = loadStats();
    const day = todayStr();
    const ipHash = crypto.createHash('sha256').update(req.ip || req.socket.remoteAddress || '').digest('hex').slice(0, 16);
    if (!s.days[day]) s.days[day] = { views: 0, ips: [] };
    s.days[day].views += 1;
    if (!s.days[day].ips.includes(ipHash)) s.days[day].ips.push(ipHash);
    saveStats(s);
  } catch (e) { /* 统计失败不影响正常访问 */ }
}
function trackProductView(id) {
  try {
    const s = loadStats();
    s.productViews[String(id)] = (s.productViews[String(id)] || 0) + 1;
    saveStats(s);
  } catch (e) {}
}

// ---------- 管理员登录：一次登录发一个随机 token（存 cookie） ----------
let adminToken = null;
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function requireAdmin(req, res, next) {
  if (adminToken && parseCookies(req).admin_token === adminToken) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

// ---------- 上传：多图，存 public/uploads/ ----------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '') || '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 单张 ≤10MB，一次 ≤10 张
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('只允许上传图片文件'));
  }
});

const app = express();
app.use(express.json({ limit: '1mb' }));
// 首页每次打开记一次访问（放 static 之前，不然首页会被静态文件直接接走不计数）
app.use((req, res, next) => { if (req.method === 'GET' && req.path === '/') trackVisit(req); next(); });
app.use(express.static(path.join(__dirname, 'public')));

// 商品详情被打开记一次（前台调用）
app.post('/api/track/view', (req, res) => {
  if (req.body && req.body.id) trackProductView(req.body.id);
  res.json({ ok: true });
});

// 顾客端 API：成本、商家联系方式、商品链接只在后台可见，前台一律去掉
function publicProduct(p) {
  const { costCny, supplier, sourceUrl, ...rest } = p;
  if (Array.isArray(rest.variants)) rest.variants = rest.variants.map(({ costCny: _c, ...v }) => v);
  return rest;
}
app.get('/api/config', (req, res) => {
  res.json({ ok: true, storeName: config.storeName, whatsappNumber: config.whatsappNumber, whatsappDisplay: config.whatsappDisplay, defaultLang: config.defaultLang, exchangeRate: config.exchangeRate || 7.2 });
});

// 只返回已上架的商品；价格字段原样返回，前端默认隐藏（没填价就不显示）
app.get('/api/products', (req, res) => {
  res.json({ ok: true, products: loadProducts().filter((p) => p.published !== false).map(publicProduct) });
});
app.get('/api/products/:id', (req, res) => {
  const p = loadProducts().find((x) => String(x.id) === String(req.params.id) && x.published !== false);
  if (!p) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, product: publicProduct(p) });
});

// ---------- 管理后台 API ----------
// 登录
app.post('/api/admin/login', (req, res) => {
  if (!req.body || req.body.username !== ADMIN_USER || req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: '密码错误' });
  }
  adminToken = crypto.randomBytes(24).toString('hex');
  res.cookie('admin_token', adminToken, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  adminToken = null;
  res.clearCookie('admin_token', { path: '/' });
  res.json({ ok: true });
});
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

// 全部商品（含下架的）
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json({ ok: true, products: loadProducts() });
});

// 访问统计（仅后台）：今日/总访问、最近 30 天每天多少人、商品被看次数排行
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const s = loadStats();
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const rec = s.days[d] || { views: 0, ips: [] };
    dates.push({ date: d, views: rec.views, unique: (rec.ips || []).length });
  }
  const total = Object.values(s.days).reduce((a, d) => a + (d.views || 0), 0);
  const today = s.days[todayStr()] || { views: 0, ips: [] };
  const products = loadProducts();
  let codeMap = {};
  try { codeMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'code-map.json'), 'utf-8')); } catch (e) {}
  const top = Object.entries(s.productViews)
    .map(([id, views]) => ({ id: codeMap[id] || id, views, name: (products.find((p) => String(p.id) === (codeMap[id] || id)) || {}).name || id }))
    .sort((a, b) => b.views - a.views).slice(0, 10);
  res.json({ ok: true, today: { views: today.views, unique: (today.ips || []).length }, total, last30: dates, topProducts: top });
});

// 广告费用记账（仅后台）：查全部 / 记一笔（充值或花费）/ 删一笔
app.get('/api/admin/ad-spend', requireAdmin, (req, res) => {
  res.json({ ok: true, entries: loadAds() });
});
app.post('/api/admin/ad-spend', requireAdmin, (req, res) => {
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!b.date || !['recharge', 'spend'].includes(b.type) || !(amount > 0)) {
    return res.status(400).json({ ok: false, error: '日期、类型、金额必填，金额要大于 0' });
  }
  const list = loadAds();
  const entry = {
    id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
    date: String(b.date).slice(0, 10),
    platform: String(b.platform || 'Meta'),
    type: b.type, // recharge = 充值，spend = 花费
    amount,
    currency: b.currency === 'CNY' ? 'CNY' : 'USD',
    note: String(b.note || '')
  };
  list.push(entry);
  saveAds(list);
  res.json({ ok: true, entry });
});
app.delete('/api/admin/ad-spend/:id', requireAdmin, (req, res) => {
  saveAds(loadAds().filter((e) => String(e.id) !== String(req.params.id)));
  res.json({ ok: true });
});

// 上传图片（多张）：表单字段名 images
app.post('/api/admin/upload', requireAdmin, upload.array('images', 10), (req, res) => {
  const urls = (req.files || []).map((f) => '/uploads/' + f.filename);
  res.json({ ok: true, urls });
});

// 新增商品
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.code) return res.status(400).json({ ok: false, error: '商品名和编号必填' });
  const list = loadProducts();
  const id = String(b.code);
  if (list.some((p) => String(p.id) === id)) return res.status(400).json({ ok: false, error: '编号已存在' });
  const item = {
    id,
    code: String(b.code),
    name: String(b.name),
    name_en: String(b.name_en || b.name),
    brand: String(b.brand || ''),
    category: String(b.category || 'bags'),
    price: b.price === '' || b.price == null ? null : Number(b.price), // 美元，空 = 不填价
    currency: 'USD',
    published: b.published !== false,
    costCny: b.costCny === '' || b.costCny == null ? null : Number(b.costCny), // 成本价人民币，仅后台可见
    supplier: String(b.supplier || ''), // 商家联系方式，仅后台可见
    sourceUrl: String(b.sourceUrl || ''), // 商品链接，仅后台可见
    sold: b.sold === '' || b.sold == null ? Math.floor(12 + Math.random() * 140) : Number(b.sold), // 已售件数，前台显示
    images: Array.isArray(b.images) ? b.images.filter(Boolean) : []
  };
  list.push(item);
  saveProducts(list);
  res.json({ ok: true, product: item });
});

// 编辑商品
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const list = loadProducts();
  const item = list.find((p) => String(p.id) === String(req.params.id));
  if (!item) return res.status(404).json({ ok: false, error: 'not found' });
  const b = req.body || {};
  if (b.name != null) item.name = String(b.name);
  if (b.name_en != null) item.name_en = String(b.name_en || b.name);
  if (b.brand != null) item.brand = String(b.brand);
  if (b.category != null) item.category = String(b.category);
  if (b.price !== undefined) item.price = (b.price === '' || b.price == null) ? null : Number(b.price);
  if (b.costCny !== undefined) item.costCny = (b.costCny === '' || b.costCny == null) ? null : Number(b.costCny);
  if (b.supplier !== undefined) item.supplier = String(b.supplier || '');
  if (b.sourceUrl !== undefined) item.sourceUrl = String(b.sourceUrl || '');
  if (b.sold !== undefined) item.sold = (b.sold === '' || b.sold == null) ? 0 : Number(b.sold);
  if (b.published !== undefined) item.published = !!b.published;
  if (Array.isArray(b.images)) item.images = b.images.filter(Boolean);
  saveProducts(list);
  res.json({ ok: true, product: item });
});

// 删除商品（只删记录，不删图片文件）
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const list = loadProducts().filter((p) => String(p.id) !== String(req.params.id));
  saveProducts(list);
  res.json({ ok: true });
});

// 管理后台页面
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use((err, req, res, next) => {
  res.status(400).json({ ok: false, error: err.message || '请求失败' });
});

app.listen(PORT, HOST, () => {
  console.log(`Catalog website running at http://${HOST}:${PORT}  (admin: /admin)`);
  console.log('Storefront: /   Admin: /admin   API: /api/products');
});
