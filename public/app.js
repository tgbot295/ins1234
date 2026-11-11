'use strict';
/* 顾客端逻辑：取 /api/products + /api/config，中英切换（默认英文），价格始终隐藏 */
let products = [];
let cfg = { storeName: 'M$M', whatsappNumber: '19302240183', whatsappDisplay: '+1 (930) 224-0183' };
let lang = localStorage.getItem('lang') || 'en';
let activeCat = 'all';
let query = '';
let galImgs = [], galIdx = 0;

const I18N = {
  en: { category: 'Category', search: 'Search', all: 'All Products', bags: 'Bags', clothing: 'Clothing', shoes: 'Shoes', accessories: 'Accessories', viewDetails: 'View Details', code: 'Code', contactUs: 'Contact Us', howTitle: 'How to order', how1: 'Browse a product and tap View Details.', how2: 'Tap WhatsApp — the message already includes the product name and code.', how3: 'Our customer service will confirm the price and shipping with you.', searchPh: 'Search products...', noResult: 'No products found.' },
  zh: { category: '分类', search: '搜索', all: '全部商品', bags: '包包', clothing: '衣服', shoes: '鞋子', accessories: '配饰', viewDetails: '看详情', code: '编号', contactUs: '联系客服', howTitle: '购买流程', how1: '浏览商品，点“看详情”。', how2: '点 WhatsApp，消息里已带好商品名和编号。', how3: '客服会跟你确认价格和运费。', searchPh: '搜索商品…', noResult: '没有找到商品。' }
};
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
const dispName = (p) => lang === 'zh' ? p.name : (p.name_en || p.name);
const catLabel = (c) => c === 'all' ? t('all') : t(c) || c;

function waLink(p) {
  const msg = lang === 'zh'
    ? `你好，我想咨询这件商品：${p.name}（编号：${p.code}）`
    : `Hi, I'm interested in this product: ${dispName(p)} (Code: ${p.code})`;
  return `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}
function waGeneral() {
  const msg = lang === 'zh' ? '你好，我想咨询商品。' : 'Hi, I would like to ask about your products.';
  return `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.getElementById('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
  document.getElementById('searchInput').placeholder = t('searchPh');
  document.getElementById('storeName').textContent = cfg.storeName;
  document.getElementById('footerName').textContent = cfg.storeName;
  document.getElementById('waDisplay').textContent = cfg.whatsappDisplay;
  document.getElementById('topWa').href = waGeneral();
  document.getElementById('footerWa').href = waGeneral();
  document.getElementById('floatWa').href = waGeneral();
  localStorage.setItem('lang', lang);
  render();
}

function filtered() {
  const q = query.trim().toLowerCase();
  return products.filter((p) => (activeCat === 'all' || p.category === activeCat) &&
    (!q || p.name.toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.code.includes(q)));
}

function render() {
  // 分类抽屉
  const cats = ['all', 'bags', 'clothing', 'shoes', 'accessories'];
  document.getElementById('drawerCats').innerHTML = cats.map((c) =>
    `<button data-cat="${c}" class="${activeCat === c ? 'active' : ''}">${catLabel(c)}</button>`).join('');
  document.querySelectorAll('#drawerCats button').forEach((b) => b.onclick = () => { activeCat = b.dataset.cat; closeDrawer(); render(); });
  // 品牌分区（按分类分组）
  const list = filtered();
  const wrap = document.getElementById('brandSections');
  if (!list.length) { wrap.innerHTML = `<p style="text-align:center;padding:30px">${t('noResult')}</p>`; return; }
  const order = ['bags', 'clothing', 'shoes', 'accessories'];
  wrap.innerHTML = order.filter((c) => list.some((p) => p.category === c)).map((c) => `
    <section class="brand-section"><h2>${catLabel(c)}</h2><div class="grid">
      ${list.filter((p) => p.category === c).map((p) => `
        <div class="card" data-id="${p.id}">
          <img src="${p.images[0] || ''}" alt="" loading="lazy">
          <div class="name">${dispName(p)}</div>
          ${p.price != null && p.price !== '' ? `<div class="price">$${p.price}</div>` : ''}
          <div class="actions">
            <button class="detail-btn">${t('viewDetails')}</button>
            <a href="${waLink(p)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>
          </div>
        </div>`).join('')}
    </div></section>`).join('');
  wrap.querySelectorAll('.card').forEach((card) => {
    card.onclick = () => openDetail(products.find((p) => p.id === card.dataset.id));
  });
}

// 详情弹窗（多图画廊：箭头 / 缩略图 / 滑动）
function openDetail(p) {
  if (!p) return;
  galImgs = p.images && p.images.length ? p.images : [];
  galIdx = 0;
  document.getElementById('dName').textContent = dispName(p);
  document.getElementById('dBrand').textContent = p.brand;
  document.getElementById('dCode').textContent = p.code;
  document.getElementById('dPrice').textContent = p.price != null && p.price !== '' ? '$' + p.price : '';
  document.getElementById('dWa').href = waLink(p);
  showGal();
  document.getElementById('detailModal').classList.remove('hidden');
}
function showGal() {
  const img = document.getElementById('galImg');
  img.src = galImgs[galIdx] || '';
  document.getElementById('galCount').textContent = galImgs.length ? `${galIdx + 1}/${galImgs.length}` : '';
  document.getElementById('galThumbs').innerHTML = galImgs.map((s, i) =>
    `<img src="${s}" class="${i === galIdx ? 'active' : ''}" data-i="${i}">`).join('');
  document.querySelectorAll('#galThumbs img').forEach((th) => th.onclick = () => { galIdx = +th.dataset.i; showGal(); });
}
document.getElementById('galPrev').onclick = () => { galIdx = (galIdx - 1 + galImgs.length) % galImgs.length; showGal(); };
document.getElementById('galNext').onclick = () => { galIdx = (galIdx + 1) % galImgs.length; showGal(); };
let touchX = null;
const galImg = document.getElementById('galImg');
galImg.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
galImg.addEventListener('touchend', (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) { galIdx = dx < 0 ? (galIdx + 1) % galImgs.length : (galIdx - 1 + galImgs.length) % galImgs.length; showGal(); }
  touchX = null;
}, { passive: true });
document.getElementById('detailClose').onclick = () => document.getElementById('detailModal').classList.add('hidden');
document.getElementById('detailModal').onclick = (e) => { if (e.target.id === 'detailModal') e.target.classList.add('hidden'); };

// 抽屉 / 搜索 / 语言
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.add('hidden'); }
document.getElementById('catBtn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.remove('hidden'); };
document.getElementById('drawerClose').onclick = closeDrawer;
document.getElementById('drawerOverlay').onclick = closeDrawer;
document.getElementById('drawerFilter').oninput = (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#drawerCats button').forEach((b) => { b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none'; });
};
document.getElementById('searchBtn').onclick = () => document.getElementById('searchBar').classList.toggle('hidden');
document.getElementById('searchClose').onclick = () => { document.getElementById('searchBar').classList.add('hidden'); query = ''; document.getElementById('searchInput').value = ''; render(); };
document.getElementById('searchInput').oninput = (e) => { query = e.target.value; render(); };
document.getElementById('langBtn').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; applyLang(); };

(async function init() {
  try { const c = await (await fetch('/api/config')).json(); if (c.ok) cfg = c; } catch (e) {}
  try { const r = await (await fetch('/api/products')).json(); products = r.products || []; } catch (e) { products = []; }
  applyLang();
})();
