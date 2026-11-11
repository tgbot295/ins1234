'use strict';
/* 管理后台逻辑：登录 -> 列表 -> 新增/编辑/删除 -> 多图上传 */
let products = [];
let editImages = [];
const $ = (id) => document.getElementById(id);
const CAT = { bags: '包包', clothing: '衣服', shoes: '鞋子', accessories: '配饰' };

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
  $('fPublished').checked = p ? p.published !== false : true;
  editImages = p ? [...(p.images || [])] : [];
  renderThumbs();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadList() {
  const j = await api('/api/admin/products');
  products = j.products || [];
  $('list').innerHTML = products.map((p) => `<tr>
    <td>${p.images && p.images[0] ? `<img src="${p.images[0]}">` : ''}</td>
    <td>${p.name}<br><small style="color:#888">${p.name_en || ''} · ${p.code}</small></td>
    <td>${p.brand || ''} / ${CAT[p.category] || p.category}</td>
    <td>${p.price != null ? '$' + p.price : '—'}</td>
    <td>${p.published !== false ? '已上架' : '已下架'}</td>
    <td><button class="grey" data-edit="${p.id}">编辑</button> <button class="red" data-del="${p.id}">删除</button></td>
  </tr>`).join('');
  document.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(products.find((p) => p.id === b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('确定删除这件商品吗？')) return;
    await api('/api/admin/products/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
    loadList();
  });
}

$('loginBtn').onclick = async () => {
  try {
    await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
    $('loginBox').classList.add('hidden');
    $('adminBox').classList.remove('hidden');
    loadList();
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
    published: $('fPublished').checked,
    images: editImages
  };
  if (!body.name || !body.code) { alert('商品名和编号必填'); return; }
  try {
    const id = $('fId').value;
    if (id) await api('/api/admin/products/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    else await api('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    $('formBox').classList.add('hidden');
    loadList();
  } catch (e) { alert(e.message); }
};

// 已登录过直接进后台
(async () => {
  try { await api('/api/admin/me'); $('loginBox').classList.add('hidden'); $('adminBox').classList.remove('hidden'); loadList(); } catch (e) {}
})();
