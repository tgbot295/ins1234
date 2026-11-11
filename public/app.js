'use strict';
/* 顾客端逻辑：取 /api/products + /api/config，中英切换（默认英文），价格始终隐藏 */
let products = [];
let cfg = { storeName: 'M$M', whatsappNumber: '19302240183', whatsappDisplay: '+1 (930) 224-0183' };
let lang = localStorage.getItem('lang') || 'en';
let activeCat = 'all';
let activeBrand = '';
let query = '';
let galImgs = [], galIdx = 0;

const I18N = {
  en: { category: 'Category', search: 'Search', all: 'All Products', bags: 'Bags', clothing: 'Clothing', shoes: 'Shoes', accessories: 'Accessories', jewelry: 'Jewelry', viewDetails: 'View Details', code: 'Code', color: 'Color', sold: 'sold', contactUs: 'Contact Us', howTitle: 'How to order', how1: 'Browse a product and tap View Details.', how2: 'Tap WhatsApp — the message already includes the product name and code.', how3: 'Our customer service will confirm the price and shipping with you.', searchPh: 'Search products...', noResult: 'No products found.', feat1t: 'Worldwide Shipping', feat1s: 'USA · Canada · Japan · Korea', feat2t: 'WhatsApp Service', feat2s: 'Chat to order, fast reply', feat3t: 'New Arrivals Weekly', feat3s: 'Bags · Clothing · Shoes · Jewelry', feat4t: 'Handpicked Selection', feat4s: 'Quality checked before shipping', shopByBrand: 'Shop by Brand', allBrands: 'All Brands' },
  zh: { category: '分类', search: '搜索', all: '全部商品', bags: '包包', clothing: '衣服', shoes: '鞋子', accessories: '配饰', jewelry: '首饰', viewDetails: '看详情', code: '编号', color: '颜色', sold: '已售', contactUs: '联系客服', howTitle: '购买流程', how1: '浏览商品，点“看详情”。', how2: '点 WhatsApp，消息里已带好商品名和编号。', how3: '客服会跟你确认价格和运费。', searchPh: '搜索商品…', noResult: '没有找到商品。', feat1t: '全球发货', feat1s: '美国 · 加拿大 · 日本 · 韩国', feat2t: 'WhatsApp 客服', feat2s: '聊天下单，快速回复', feat3t: '每周上新', feat3s: '包包 · 衣服 · 鞋子 · 首饰', feat4t: '精选好物', feat4s: '发货前逐件质检', shopByBrand: '按品牌选购', allBrands: '全部品牌' }
};
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
const dispName = (p) => lang === 'zh' ? p.name : (p.name_en || p.name);
const soldText = (p) => (p.sold != null && p.sold !== '') ? (lang === 'zh' ? `已售 ${p.sold} 件` : `${p.sold} sold`) : '';
const catLabel = (c) => c === 'all' ? t('all') : t(c) || c;

// 同款多色：一个商品 + variants[{color,color_en,code,image}]；详情里点颜色切换，翻页一样
const varLabel = (v) => lang === 'zh' ? v.color : (v.color_en || v.color);
const curVar = (p) => (p.variants && p.variants.length && window._curV != null) ? p.variants[window._curV] : (p.variants && p.variants[0]);
const curCode = (p) => { const v = curVar(p); return v ? v.code : p.code; };

function waLink(p, vIdx) {
  const v = (p.variants && p.variants.length) ? p.variants[vIdx != null ? vIdx : (window._curV || 0)] || p.variants[0] : null;
  const code = v ? v.code : p.code;
  const name = dispName(p) + (v ? ' - ' + varLabel(v) : '');
  const msg = lang === 'zh'
    ? `你好，我想咨询这件商品：${name}（编号：${code}）`
    : `Hi, I'm interested in this product: ${name} (Code: ${code})`;
  return `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}
// 分享弹窗：像 Mercury 那样，列出各平台 + 下载 + 复制链接
function shareImgUrl(p, imgSrc) {
  const img = imgSrc || (p.images && p.images[0]) || '';
  return img ? (img.startsWith('http') ? img : location.origin + img) : location.href;
}
function openShare(p, imgSrc) {
  if (!p) return;
  window._shareP = p; window._shareImg = imgSrc || (p.images && p.images[0]) || '';
  const url = shareImgUrl(p, window._shareImg);
  const text = `${dispName(p)} (Code: ${curCode(p)})`;
  const enc = encodeURIComponent;
  const set = (id, href) => { const el = document.getElementById(id); if (el) el.href = href; };
  set('shWa', `https://wa.me/${cfg.whatsappNumber}?text=${enc(text + '\n' + url)}`);
  set('shFb', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`);
  set('shMs', `https://www.facebook.com/dialog/send?link=${enc(url)}&app_id=0&redirect_uri=${enc(url)}`);
  set('shX', `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`);
  set('shPin', `https://pinterest.com/pin/create/button/?url=${enc(url)}&media=${enc(url)}&description=${enc(text)}`);
  set('shLine', `https://social-plugins.line.me/lineit/share?url=${enc(url)}`);
  set('shIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`);
  const dl = document.getElementById('shDl');
  if (dl) { dl.href = url; dl.setAttribute('download', (p.code || 'product') + '.jpg'); }
  document.getElementById('shareModal').classList.remove('hidden');
}
function closeShare() { document.getElementById('shareModal').classList.add('hidden'); }
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
    (!activeBrand || p.brand === activeBrand) &&
    (!q || p.name.toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.code.includes(q) || (p.variants || []).some((v) => v.code.includes(q) || v.color.toLowerCase().includes(q) || (v.color_en || '').toLowerCase().includes(q))));
}

function render() {
  // 品牌 Logo 按钮选中态
  document.querySelectorAll('.brand-logo-btn').forEach((b) => b.classList.toggle('active', b.dataset.brand === activeBrand));
  const clearBtn = document.getElementById('clearBrand');
  if (clearBtn) clearBtn.style.display = activeBrand ? '' : 'none';
  // 分类抽屉
  const cats = ['all', 'bags', 'clothing', 'shoes', 'accessories', 'jewelry'];
  document.getElementById('drawerCats').innerHTML = cats.map((c) =>
    `<button data-cat="${c}" class="${activeCat === c ? 'active' : ''}">${catLabel(c)}</button>`).join('');
  document.querySelectorAll('#drawerCats button').forEach((b) => b.onclick = () => { activeCat = b.dataset.cat; closeDrawer(); render(); });
  // 品牌分区（按分类分组）
  const list = filtered();
  const wrap = document.getElementById('brandSections');
  if (!list.length) { wrap.innerHTML = `<p style="text-align:center;padding:30px">${t('noResult')}</p>`; return; }
  const order = ['bags', 'clothing', 'shoes', 'accessories', 'jewelry'];
  wrap.innerHTML = order.filter((c) => list.some((p) => p.category === c)).map((c) => `
    <section class="brand-section"><h2>${catLabel(c)}</h2><div class="grid">
      ${list.filter((p) => p.category === c).map((p) => `
        <div class="card" data-id="${p.id}">
          <button class="share-btn" title="Share" aria-label="Share"><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg></button>
          <img src="${p.images[0] || ''}" alt="" loading="lazy">
          <div class="name">${dispName(p)}</div>
          ${soldText(p) ? `<div class="sold">${soldText(p)}</div>` : ''}
          ${p.variants && p.variants.length > 1 ? `<div class="var-colors">${p.variants.map((v) => varLabel(v)).join(' · ')}</div>` : ''}
          ${p.price != null && p.price !== '' ? `<div class="price">$${p.price}</div>` : ''}
          <div class="actions">
            <button class="detail-btn">${t('viewDetails')}</button>
            <a href="${waLink(p, 0)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>
          </div>
        </div>`).join('')}
    </div></section>`).join('');
  wrap.querySelectorAll('.card').forEach((card) => {
    card.onclick = () => openDetail(products.find((p) => p.id === card.dataset.id));
    const sb = card.querySelector('.share-btn');
    if (sb) sb.onclick = (e) => { e.stopPropagation(); const p = products.find((x) => x.id === card.dataset.id); openShare(p); };
  });
}

// 详情弹窗（多图画廊：箭头 / 缩略图 / 滑动；同款多色在详情里点颜色分页切换）
function openDetail(p) {
  if (!p) return;
  window._curP = p;
  window._curV = 0;
  galImgs = p.images && p.images.length ? p.images : [];
  galIdx = 0;
  document.getElementById('dName').textContent = dispName(p);
  document.getElementById('dBrand').textContent = p.brand;
  document.getElementById('dCode').textContent = p.code;
  document.getElementById('dSold').textContent = soldText(p);
  document.getElementById('dPrice').textContent = p.price != null && p.price !== '' ? '$' + p.price : '';
  document.getElementById('dWa').href = waLink(p);
  renderVariants(p);
  showGal();
  document.getElementById('detailModal').classList.remove('hidden');
  fetch('/api/track/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }).catch(() => {});
}
function renderVariants(p) {
  const box = document.getElementById('dVariants');
  if (!box) return;
  if (!p.variants || p.variants.length < 2) { box.innerHTML = ''; return; }
  box.innerHTML = `<span class="var-label">${t('color')}:</span>` + p.variants.map((v, i) =>
    `<button data-i="${i}" class="${i === (window._curV || 0) ? 'active' : ''}">${varLabel(v)}</button>`).join('');
  box.querySelectorAll('button').forEach((b) => b.onclick = () => selectVariant(p, +b.dataset.i));
}
function selectVariant(p, i) {
  window._curV = i;
  const v = p.variants[i];
  if (!v) return;
  galImgs = [v.image];
  galIdx = 0;
  document.getElementById('dCode').textContent = v.code;
  document.getElementById('dWa').href = waLink(p);
  renderVariants(p);
  showGal();
}
function showGal() {
  const img = document.getElementById('galImg');
  img.src = galImgs[galIdx] || '';
  const ds = document.getElementById('dShare');
  if (ds && window._curP) ds.onclick = (e) => { e.preventDefault(); openShare(window._curP, galImgs[galIdx]); };
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

document.getElementById('shareClose').onclick = closeShare;
document.getElementById('shareModal').onclick = (e) => { if (e.target.id === 'shareModal') closeShare(); };
document.getElementById('shCopy').onclick = async () => {
  const p = window._shareP; if (!p) return;
  const link = shareImgUrl(p, window._shareImg);
  try { await navigator.clipboard.writeText(link); document.getElementById('shCopy').textContent = '✓ 已复制'; setTimeout(() => { document.getElementById('shCopy').textContent = '复制链接'; }, 1500); } catch (e) { prompt('复制链接：', link); }
};
document.getElementById('shIg').onclick = async () => {
  const p = window._shareP; if (!p) return;
  const url = shareImgUrl(p, window._shareImg);
  const text = `${dispName(p)} (Code: ${curCode(p)})`;
  // 手机上：把图片文件直接交给系统分享，分享单里选 Instagram，图就带过去了
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], (p.code || 'product') + '.jpg', { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      closeShare(); return;
    }
  } catch (e) { /* fall through */ }
  // 退而求其次：手机调起 IG App 的分享页；电脑没有 IG 分享接口，
  // 就复制商品信息、下载图片，再打开 IG 网页版私信，顾客粘贴/上传就能发
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (isMobile) location.href = 'instagram://share?text=' + encodeURIComponent(text + ' ' + url);
  else {
    try { await navigator.clipboard.writeText(text + '\n' + url); } catch (e) {}
    alert('商品信息已复制。IG 网页版私信已打开，粘贴就能发给我们');
    window.open('https://www.instagram.com/direct/inbox/', '_blank');
  }
  closeShare();
};
document.getElementById('shMore').onclick = async () => {
  const p = window._shareP; if (!p) return;
  const url = shareImgUrl(p, window._shareImg);
  if (navigator.share) { try { await navigator.share({ title: dispName(p), text: `${dispName(p)} (Code: ${p.code})`, url }); } catch (e) {} }
  closeShare();
};

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
document.querySelectorAll('.brand-logo-btn').forEach((b) => b.onclick = () => {
  activeBrand = b.dataset.brand; activeCat = 'all'; query = '';
  const si = document.getElementById('searchInput'); if (si) si.value = '';
  render();
  document.getElementById('brandSections').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('clearBrand').onclick = () => { activeBrand = ''; render(); };

(async function init() {
  try { const c = await (await fetch('/api/config')).json(); if (c.ok) cfg = c; } catch (e) {}
  try { const r = await (await fetch('/api/products')).json(); products = r.products || []; } catch (e) { products = []; }
  applyLang();
})();
