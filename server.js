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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // 上线前务必改掉！

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
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 顾客端 API ----------
app.get('/api/config', (req, res) => {
  res.json({ ok: true, storeName: config.storeName, whatsappNumber: config.whatsappNumber, whatsappDisplay: config.whatsappDisplay, defaultLang: config.defaultLang });
});

// 只返回已上架的商品；价格字段原样返回，前端默认隐藏（没填价就不显示）
app.get('/api/products', (req, res) => {
  res.json({ ok: true, products: loadProducts().filter((p) => p.published !== false) });
});
app.get('/api/products/:id', (req, res) => {
  const p = loadProducts().find((x) => String(x.id) === String(req.params.id) && x.published !== false);
  if (!p) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, product: p });
});

// ---------- 管理后台 API ----------
// 登录
app.post('/api/admin/login', (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) {
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
