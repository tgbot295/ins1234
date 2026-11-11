'use strict';
/**
 * 服务器上合并本地改过的 products.json（编号改成 M01…之后专用）。
 * 用法（在服务器项目目录里）：
 *   cp data/products.json /tmp/products.json.bak
 *   git checkout -- data/products.json
 *   git pull
 *   node scripts/merge-local-products.js /tmp/products.json.bak
 *   pm2 restart catalog-website-source
 *
 * 作用：把备份里旧编号（1252824179 这种）的商品按 data/code-map.json
 * 换成新编号（M28 这种），本地改过的价格、名字、已售数都保留；
 * 本地自己加的商品（比如 37373838）编号不变，也一起保留。
 */
const fs = require('fs');
const path = require('path');

const bakFile = process.argv[2];
if (!bakFile) { console.error('用法：node scripts/merge-local-products.js /tmp/products.json.bak'); process.exit(1); }

const map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'code-map.json'), 'utf-8'));
const bak = JSON.parse(fs.readFileSync(bakFile, 'utf-8'));
const cur = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf-8'));

function remapImg(s) {
  if (!s) return s;
  const m = s.match(/^(.*\/)([^/]+)(\.[a-z]+)$/i);
  if (!m) return s;
  let stem = m[2];
  if (map[stem]) stem = map[stem];
  else {
    const d = stem.lastIndexOf('-');
    if (d > 0 && map[stem.slice(0, d)]) stem = map[stem.slice(0, d)] + stem.slice(d);
  }
  return m[1] + stem + m[3];
}
function remap(p) {
  const q = { ...p };
  if (map[p.id]) { q.id = map[p.id]; q.code = map[p.code] || q.code; }
  q.images = (p.images || []).map(remapImg);
  if (p.variants) q.variants = p.variants.map((v) => ({ ...v, code: map[v.code] || v.code, image: remapImg(v.image) }));
  return q;
}

const byId = new Map(cur.map((p) => [String(p.id), p]));
for (const p of bak) {
  const q = remap(p);
  if (byId.has(String(q.id))) byId.set(String(q.id), { ...byId.get(String(q.id)), ...q });
  else byId.set(String(q.id), q);
}
fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.json'), JSON.stringify([...byId.values()], null, 2));
console.log('合并完成，共 ' + byId.size + ' 件商品');
