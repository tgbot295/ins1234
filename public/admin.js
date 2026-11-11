'use strict';
/* 管理后台逻辑：登录 -> 列表 -> 新增/编辑/删除 -> 多图上传 */
let products = [];
let editImages = [];
let exchangeRate = 7.2;
const $ = (id) => document.getElementById(id);
const CAT = { bags: '包包', clothing: '衣服', shoes: '鞋子', accessories: '配饰', jewelry: '首饰' };

// 成本显示：¥ 人民币 + 按汇率换算的 $ 美元
function costText(p) {
  const costs = [p.costCny, ...((p.variants || []).map((v) => v.costCny))].filter((c) => c != null && c !== '');
  if (!costs.length) return '—';
  const lo = Math.min(...costs), hi = Math.max(...costs);
  const yen = lo === hi ? '¥' + lo : '¥' + lo + '–' + hi;
  const usd = (c) => '$' + (c / exchangeRate).toFixed(2);
  return yen + '<br><small style="color:#888">' + (lo === hi ? usd(lo) : usd(lo) + '–' + usd(hi)) + '</small>';
}

async function api(path, opts) {
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('请求失败 ' + r.status));
  return j;
}

function renderThumbs() {
  $('fThumbs').innerHTML = editImages.map((u, i) =>
    `<div><img src="${u}"><span data-i="${i}">✕</span></div>`).join('');
  document.querySelectorAll('#fThumbs span').forEach((s) => s.onclick = () => { editImages.splice(+s.dataset.i, 1); renderThumbs(); });
}

function openForm(p) {
  $('formBox').classList.remove('hidden');
  $('formTitle').textContent = p ? '编辑商品 Edit' : '新增商品 Add';
  $('fId').value = p ? p.id : '';
  $('fName').value = p ? p.name : '';
  $('fNameEn').value = p ? (p.name_en || '') : '';
  $('fBrand').value = p ? (p.brand || '') : '';
  $('fCat').value = p ? p.category : 'bags';
  $('fCode').value = p ? p.code : '';
  $('fCode').disabled = !!p; // 编号是唯一 ID，建好后不改
  $('fPrice').value = p && p.price != null ? p.price : '';
  $('fSold').value = p && p.sold != null ? p.sold : '';
  $('fCostCny').value = p && p.costCny != null ? p.costCny : '';
  $('fSupplier').value = p ? (p.supplier || '') : '';
  $('fSourceUrl').value = p ? (p.sourceUrl || '') : '';
  $('fPublished').checked = p ? p.published !== false : true;
  editImages = p ? [...(p.images || [])] : [];
  renderThumbs();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadStats() {
  try {
    const s = await api('/api/admin/stats');
    const last7 = s.last30.slice(-7);
    const w7 = last7.reduce((a, d) => a + d.views, 0);
    const max = Math.max(1, ...s.last30.map((d) => d.views));
    $('statsCards').innerHTML = `
      <div style="background:#f7f3ee;border-radius:10px;padding:12px"><div style="font-size:12px;color:#888">今日访问</div><div style="font-size:22px;font-weight:700">${s.today.views} 次 · ${s.today.unique} 人</div></div>
      <div style="background:#f7f3ee;border-radius:10px;padding:12px"><div style="font-size:12px;color:#888">近 7 天访问</div><div style="font-size:22px;font-weight:700">${w7} 次</div></div>
      <div style="background:#f7f3ee;border-radius:10px;padding:12px"><div style="font-size:12px;color:#888">累计访问</div><div style="font-size:22px;font-weight:700">${s.total} 次</div></div>`;
    $('statsChart').innerHTML = '<div style="font-size:13px;color:#555;margin-bottom:6px">最近 30 天每天访问（次）</div>' +
      s.last30.map((d) => `<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin:2px 0"><span style="width:86px;color:#888">${d.date.slice(5)}</span><span style="display:inline-block;height:12px;background:#25d366;border-radius:6px;width:${Math.max(2, Math.round(d.views / max * 100))}%"></span><span>${d.views}</span></div>`).join('');
    $('statsTop').innerHTML = s.topProducts.length ? '<b>被看最多的商品：</b><br>' + s.topProducts.map((t, i) => `${i + 1}. ${t.name} — ${t.views} 次`).join('<br>') : '还没有商品被点开看过。';
  } catch (e) { $('statsBox').innerHTML = '<p style="color:#888">统计加载失败：' + e.message + '</p>'; }
}

async function loadList() {
  try { const c = await api('/api/config'); if (c.exchangeRate) exchangeRate = c.exchangeRate; } catch (e) {}
  const j = await api('/api/admin/products');
  products = j.products || [];
  $('list').innerHTML = products.map((p) => `<tr>
    <td>${p.images && p.images[0] ? `<img src="${p.images[0]}">` : ''}</td>
    <td>${p.name}<br><small style="color:#888">${p.name_en || ''} · ${p.code}</small>${p.supplier ? `<br><small>商家：${p.supplier}</small>` : ''}${p.sourceUrl ? `<br><small><a href="${p.sourceUrl}" target="_blank" rel="noopener">商品链接 ↗</a></small>` : ''}</td>
    <td>${p.brand || ''} / ${CAT[p.category] || p.category}</td>
    <td>${p.price != null ? '$' + p.price : '—'}</td>
    <td>${costText(p)}</td>
    <td>${p.sold != null ? p.sold + ' 件' : '—'}</td>
    <td>${p.published !== false ? '已上架' : '已下架'}</td>
    <td><button class="grey" data-edit="${p.id}">编辑</button> <button class="red" data-del="${p.id}">删除</button></td>
  </tr>`).join('');
  document.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(products.find((p) => p.id === b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('确定删除这件商品吗？')) return;
    await api('/api/admin/products/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
    loadList(); loadStats();
  });
}

$('loginBtn').onclick = async () => {
  try {
    await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
    $('loginBox').classList.add('hidden');
    $('adminBox').classList.remove('hidden');
    loadList(); loadStats();
  } catch (e) { $('loginErr').textContent = e.message; }
};
$('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
$('logoutBtn').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); location.reload(); };
$('newBtn').onclick = () => openForm(null);
$('cancelBtn').onclick = () => $('formBox').classList.add('hidden');

$('uploadBtn').onclick = async () => {
  const files = $('fFiles').files;
  if (!files.length) { alert('请先选择图片'); return; }
  const fd = new FormData();
  for (const f of files) fd.append('images', f);
  try {
    const j = await api('/api/admin/upload', { method: 'POST', body: fd });
    editImages.push(...(j.urls || []));
    $('fFiles').value = '';
    renderThumbs();
  } catch (e) { alert(e.message); }
};

$('saveBtn').onclick = async () => {
  const body = {
    name: $('fName').value.trim(),
    name_en: $('fNameEn').value.trim(),
    brand: $('fBrand').value.trim(),
    category: $('fCat').value,
    code: $('fCode').value.trim(),
    price: $('fPrice').value === '' ? null : Number($('fPrice').value),
    sold: $('fSold').value === '' ? null : Number($('fSold').value),
    costCny: $('fCostCny').value === '' ? null : Number($('fCostCny').value),
    supplier: $('fSupplier').value.trim(),
    sourceUrl: $('fSourceUrl').value.trim(),
    published: $('fPublished').checked,
    images: editImages
  };
  if (!body.name || !body.code) { alert('商品名和编号必填'); return; }
  try {
    const id = $('fId').value;
    if (id) await api('/api/admin/products/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    else await api('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    $('formBox').classList.add('hidden');
    loadList(); loadStats();
  } catch (e) { alert(e.message); }
};

// 已登录过直接进后台
(async () => {
  try { await api("/api/admin/me"); $("loginBox").classList.add("hidden"); $("adminBox").classList.remove("hidden"); loadList(); loadStats(); } catch (e) {}
})();
