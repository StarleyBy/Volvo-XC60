/* ============================================================
   VOLVO XC60 HANDBOOK — app.js
   Routing, manifest loading, content rendering, Favorites
   ============================================================ */

'use strict';

const MANIFEST_URL = './app-manifest.yml';

// Base URL — directory where index.html lives
function getBaseUrl() {
  const path = window.location.pathname;
  const dir = path.substring(0, path.lastIndexOf('/') + 1);
  return window.location.origin + dir;
}
const BASE_URL = getBaseUrl();

function resolvePath(file) {
  const normalized = file.replace(/\\/g, '/');
  if (normalized.startsWith('http')) return normalized;
  if (normalized.startsWith('/')) return window.location.origin + normalized;
  return new URL(normalized, BASE_URL).href;
}

// ── STATE ────────────────────────────────────────────────
const State = {
  role: 'admin', // Default to admin since we removed login
  theme: 'dark',
  manifest: null,
  currentItem: null,
  favorites: JSON.parse(localStorage.getItem('volvo-favorites') || '[]')
};

// ── DOM REFS ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── THEME ────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('volvo-theme') || 'dark';
  setTheme(saved);
}
function setTheme(t) {
  State.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  $('theme-toggle').textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('volvo-theme', t);
}
function toggleTheme() {
  setTheme(State.theme === 'dark' ? 'light' : 'dark');
}

// ── FAVORITES ────────────────────────────────────────────
function toggleFavorite(itemId, sectionId) {
  const index = State.favorites.findIndex(f => f.itemId === itemId && f.sectionId === sectionId);
  if (index > -1) {
    State.favorites.splice(index, 1);
  } else {
    State.favorites.push({ itemId, sectionId });
  }
  localStorage.setItem('volvo-favorites', JSON.stringify(State.favorites));
  buildNav($('sidebar-search').value);
  
  // Update star icon if current page is this item
  if (State.currentItem && State.currentItem.id === itemId) {
    const star = $('fav-toggle');
    if (star) star.textContent = index > -1 ? '☆' : '★';
  }
}

function isFavorite(itemId, sectionId) {
  return State.favorites.some(f => f.itemId === itemId && f.sectionId === sectionId);
}

// ── APP INIT ─────────────────────────────────────────────
async function showApp() {
  // Update user indicator
  $('user-role-label').textContent = 'Владелец';
  $('user-dot').style.background = '#4caf50';

  // Load manifest
  try {
    const response = await fetch(MANIFEST_URL + '?v=' + Date.now());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    
    const yamlLib = window.jsyaml || window.jsYaml;
    if (!yamlLib) throw new Error('Библиотека js-yaml не найдена.');
    
    State.manifest = yamlLib.load(text);
    if (!State.manifest || !State.manifest.sections) throw new Error('Неверный манифест');

    buildNav();
    
    // Deep linking
    const urlParams = new URLSearchParams(window.location.search);
    const sectionId = urlParams.get('section');
    const itemId = urlParams.get('item');

    if (sectionId && itemId) {
      openItemById(sectionId, itemId, false);
    } else if (sectionId) {
      openSection(sectionId, false);
    } else {
      showHome(false);
    }
  } catch(e) {
    console.error('Manifest load failed', e);
    $('content-area').innerHTML = `
      <div style="padding:20px; text-align:center;">
        <p class="empty-msg">Не удалось загрузить манифест.</p>
        <p style="color:var(--text-muted); font-size:14px; margin-top:10px;">${e.message}</p>
        <button class="footer-btn" style="margin-top:20px; padding:8px 16px; background:var(--accent); border-radius:4px;" onclick="location.reload()">Повторить</button>
      </div>
    `;
  }
}

// ── NAV BUILD ────────────────────────────────────────────
function buildNav(filter = '') {
  const nav = $('sidebar-nav');
  nav.innerHTML = '';
  const fl = filter.toLowerCase();

  // ── Favorites Section ──
  if (State.favorites.length > 0) {
    const favSec = document.createElement('div');
    favSec.className = 'nav-section';
    favSec.innerHTML = `
      <div class="nav-section-header">
        <span class="nav-section-icon">⭐</span>
        <span>Избранное</span>
        <span class="nav-section-chevron">▾</span>
      </div>
      <div class="nav-items"></div>
    `;
    const container = favSec.querySelector('.nav-items');
    
    State.favorites.forEach(fav => {
      const section = State.manifest.sections.find(s => s.id === fav.sectionId);
      const item = section?.items.find(i => i.id === fav.itemId);
      if (item && (!fl || item.title.toLowerCase().includes(fl))) {
        const el = document.createElement('div');
        el.className = 'nav-item';
        el.dataset.itemId = item.id;
        el.dataset.sectionId = section.id;
        el.innerHTML = `
          <span class="nav-item-type"></span>
          <span>${item.title}</span>
        `;
        el.addEventListener('click', () => openItem(section, item));
        container.appendChild(el);
      }
    });

    if (container.children.length > 0) {
      favSec.querySelector('.nav-section-header').addEventListener('click', () => {
        favSec.classList.toggle('collapsed');
      });
      nav.appendChild(favSec);
    }
  }

  // ── Regular Sections ──
  for (const section of State.manifest.sections) {
    const sectionItems = section.items || [];
    const items = sectionItems.filter(item => {
      if (!fl) return true;
      return item.title.toLowerCase().includes(fl) ||
             (item.tags || []).some(t => t.includes(fl));
    });
    if (!items.length) continue;

    const sec = document.createElement('div');
    sec.className = 'nav-section';
    sec.innerHTML = `
      <div class="nav-section-header" data-id="${section.id}">
        <span class="nav-section-icon">${section.icon}</span>
        <span>${section.title}</span>
        <span class="nav-section-chevron">▾</span>
      </div>
      <div class="nav-items"></div>
    `;
    const container = sec.querySelector('.nav-items');
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.itemId = item.id;
      el.dataset.sectionId = section.id;
      el.innerHTML = `
        <span class="nav-item-type"></span>
        <span>${item.title}</span>
      `;
      el.addEventListener('click', () => openItem(section, item));
      container.appendChild(el);
    });

    sec.querySelector('.nav-section-header').addEventListener('click', () => {
      sec.classList.toggle('collapsed');
    });

    nav.appendChild(sec);
  }
}

// ── ROUTING ──────────────────────────────────────────────
function updateUrl(params) {
  const url = new URL(window.location);
  if (params.view === 'home') {
    url.search = '';
  } else if (params.view === 'section') {
    url.searchParams.set('section', params.id);
    url.searchParams.delete('item');
  } else if (params.view === 'item') {
    url.searchParams.set('section', params.sectionId);
    url.searchParams.set('item', params.itemId);
  }
  window.history.pushState(params, '', url);
}

window.addEventListener('popstate', (event) => {
  const state = event.state;
  if (!state || state.view === 'home') {
    showHome(false);
  } else if (state.view === 'section') {
    openSection(state.id, false);
  } else if (state.view === 'item') {
    openItemById(state.sectionId, state.itemId, false);
  }
});

function openItem(section, item, push = true) {
  State.currentItem = item;
  if (push) updateUrl({ view: 'item', sectionId: section.id, itemId: item.id });

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.itemId === item.id);
  });

  $('page-breadcrumb').innerHTML = `
    <span class="bc-link" onclick="showHome()">Главная</span>
    <span class="bc-sep">/</span>
    <span class="bc-link" onclick="openSection('${section.id}')">${section.title}</span>
  `;
  $('page-title-bar').textContent = item.title;

  $('sidebar').classList.remove('open');
  $('overlay').classList.remove('visible');

  const area = $('content-area');
  const file = resolvePath(item.file);
  
  if (item.type === 'document' || file.endsWith('.pdf')) {
    renderPDF(item, area, section);
  } else if (item.type === 'calculator' || item.file.endsWith('.html')) {
    renderHTML(item, area, section);
  } else {
    renderMarkdown(item, area, section);
  }
  area.scrollTo(0, 0);
}

// ── RENDER: PDF ──────────────────────────────────────────
function renderPDF(item, area, section) {
  const file = resolvePath(item.file);
  const favIcon = isFavorite(item.id, section.id) ? '★' : '☆';
  
  area.innerHTML = `
    <div id="page-view" class="wide">
      <div class="page-header" style="margin-bottom: 16px;">
        <span class="page-type-badge" style="background:var(--accent-gold); color:#000;">PDF Документ</span>
        <button id="fav-toggle" class="topbar-btn" onclick="toggleFavorite('${item.id}', '${section.id}')" style="margin-left:10px; font-size:18px; border:none; background:transparent;">${favIcon}</button>
        
        <div style="margin-left:auto; display:flex; gap:10px;">
          <a href="${file}" download="${item.title}.pdf" class="topbar-btn" style="text-decoration:none;">⬇️ Скачать</a>
          <button class="topbar-btn" onclick="shareFile('${file}', '${item.title}')">🔗 Поделиться</button>
        </div>
      </div>
      
      <div style="background:var(--bg-panel); border:1px solid var(--border); border-radius:4px; padding:10px; height:80vh;">
        <iframe src="${file}" style="width:100%; height:100%; border:none;"></iframe>
      </div>
      
      <div style="margin-top:20px; text-align:center; color:var(--text-muted); font-size:13px;">
        Если документ не отображается, воспользуйтесь кнопкой «Скачать»
      </div>
    </div>
  `;
}

async function shareFile(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title: title, url: url });
    } catch (err) { console.log('Share failed:', err); }
  } else {
    navigator.clipboard.writeText(url);
    alert('Ссылка на документ скопирована в буфер обмена');
  }
}

function showHome(push = true) {
  if (push) updateUrl({ view: 'home' });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  $('page-breadcrumb').innerHTML = '';
  $('page-title-bar').textContent = 'Volvo XC60';
  State.currentItem = null;
  renderHome();
}

// ── RENDER: HOME ─────────────────────────────────────────
function renderHome() {
  if (!State.manifest || !State.manifest.sections) return;
  const area = $('content-area');
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  let cards = '';
  for (const section of State.manifest.sections) {
    const itemsCount = (section.items || []).length;
    // Show sections even if empty (optional, but requested for dynamic categories)
    cards += `
      <div class="home-card" onclick="openSection('${section.id}')">
        <div class="home-card-icon">${section.icon || '📁'}</div>
        <div class="home-card-title">${section.title}</div>
        <div class="home-card-count">${itemsCount} ${pluralize(itemsCount, ['статья', 'статьи', 'статей'])}</div>
      </div>
    `;
  }

  area.innerHTML = `
    <div id="home-screen">
      <div id="home-greeting">
        <h1>${greeting}</h1>
        <p>Volvo XC60 · ${now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</p>
      </div>
      <div class="home-grid">${cards}</div>
    </div>
  `;
}

function pluralize(n, forms) {
  return n % 10 == 1 && n % 100 != 11 ? forms[0] : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? forms[1] : forms[2]);
}

function openSection(sectionId, push = true) {
  const section = State.manifest.sections.find(s => s.id === sectionId);
  if (!section) return;
  if (push) updateUrl({ view: 'section', id: sectionId });
  renderSectionIndex(section);
}

function renderSectionIndex(section) {
  State.currentItem = null;
  const area = $('content-area');
  
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  $('page-breadcrumb').innerHTML = `
    <span class="bc-link" onclick="showHome()">Главная</span>
  `;
  $('page-title-bar').textContent = section.title;

  let listHtml = '';
  section.items.forEach((item, index) => {
    const variant = index % 5;
    listHtml += `
      <div class="index-card ic-${item.type} v-${variant}" onclick="openItemById('${section.id}', '${item.id}')">
        <div class="index-card-title">${item.title}</div>
        <div class="index-card-tags">
          <span class="page-type-badge type-${item.type}">${item.type}</span>
          ${(item.tags || []).map(t => `<span class="tag">#${t}</span>`).join(' ')}
        </div>
      </div>
    `;
  });

  area.innerHTML = `
    <div id="section-index">
      <div class="index-grid">${listHtml}</div>
    </div>
  `;
}

function openItemById(sectionId, itemId, push = true) {
  const section = State.manifest.sections.find(s => s.id === sectionId);
  const item = section?.items.find(i => i.id === itemId);
  if (section && item) openItem(section, item, push);
}

// ── RENDER: MARKDOWN ─────────────────────────────────────
async function renderMarkdown(item, area, section) {
  area.innerHTML = '<p class="loading-msg">Загрузка…</p>';
  try {
    const text = await fetch(resolvePath(item.file) + '?v=' + Date.now()).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    });
    const html = marked.parse(text);
    const responsiveHtml = html.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>/g, '</table></div>');
    
    const favIcon = isFavorite(item.id, section.id) ? '★' : '☆';
    
    area.innerHTML = `
      <div id="page-view">
        <div class="page-header">
          <div>
            <span class="page-type-badge type-${item.type}">${item.type}</span>
            <button id="fav-toggle" class="topbar-btn" onclick="toggleFavorite('${item.id}', '${section.id}')" style="margin-left:10px; font-size:18px; border:none; background:transparent;">${favIcon}</button>
          </div>
          <div style="flex:1"></div>
          <a href="redact.html?file=${encodeURIComponent(item.file)}" target="_blank" id="redact-link">✏️ Редактировать</a>
        </div>
        <div class="md-body">${responsiveHtml}</div>
      </div>
    `;
  } catch(e) {
    area.innerHTML = `<p class="empty-msg">Контент еще не доступен.<br><small style="opacity:0.5">${item.file}</small></p>`;
  }
}

// ── RENDER: HTML (Iframe) ─────────────────────────────
function renderHTML(item, area, section) {
  const favIcon = isFavorite(item.id, section.id) ? '★' : '☆';
  
  area.innerHTML = `
    <div id="page-view" class="wide">
      <div class="page-header" style="margin-bottom: 8px;">
        <span class="page-type-badge type-${item.type}">${item.type}</span>
        <button id="fav-toggle" class="topbar-btn" onclick="toggleFavorite('${item.id}', '${section.id}')" style="margin-left:10px; font-size:18px; border:none; background:transparent;">${favIcon}</button>
        <a href="redact.html?file=${encodeURIComponent(item.file)}" target="_blank" id="redact-link" style="margin-left:auto">✏️ Редактировать</a>
      </div>
      <iframe id="calc-frame" title="${item.title}" style="opacity:0; transition:opacity 0.2s; width:100%; border:none;"></iframe>
    </div>
  `;

  const frame = $('calc-frame');
  
  // Важно: настраиваем onload ДО того как задаем src
  frame.onload = () => {
    try {
      const doc = frame.contentWindow.document;
      
      const style = doc.createElement('style');
      style.textContent = `
        :root {
          --gold: #c5a059;
          --bg: #121212;
          --panel: #1e1e1e;
          --border: #333;
          --text: #e0e0e0;
          --text-muted: #a0a0a0;
        }
        
        body { 
          background: transparent !important; 
          margin: 0 !important; 
          padding: 20px !important; 
          line-height: 1.6;
          color: var(--text) !important;
          font-family: 'IBM Plex Sans', system-ui, sans-serif !important;
        }

        /* Агрессивный сброс цвета для ВСЕХ элементов внутри */
        * { color: var(--text) !important; border-color: var(--border) !important; }
        
        /* Заголовки и акценты */
        h1, h2, h3, h4, h5, h6, strong, b { color: #fff !important; }
        h1 { border-bottom: 1px solid var(--border) !important; padding-bottom: 10px; }
        h2, .subsection-title { color: var(--gold) !important; text-transform: uppercase; letter-spacing: 0.05em; }
        
        /* Ссылки и кнопки */
        a, a * { color: var(--gold) !important; text-decoration: none !important; }
        a:hover { text-decoration: underline !important; }
        
        /* Специальные блоки (карточки, цитаты, оглавление) */
        .card, .info-card, .highlight, .toc, blockquote, .note, .warning {
          background: var(--panel) !important;
          border: 1px solid var(--border) !important;
          border-left: 4px solid var(--gold) !important;
          padding: 20px !important;
          margin: 20px 0 !important;
          border-radius: 4px !important;
        }
        
        .toc ul, .nav-list { list-style: none !important; padding: 0 !important; display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
        .toc li a, .nav-list li a { 
          background: #000 !important; 
          border: 1px solid var(--border) !important;
          padding: 6px 14px !important;
          border-radius: 20px !important;
          font-size: 13px !important;
        }

        /* Таблицы */
        table { width: 100% !important; border-collapse: collapse !important; margin: 20px 0 !important; background: var(--panel) !important; }
        th { background: #000 !important; color: var(--gold) !important; text-align: left !important; padding: 12px !important; font-size: 11px !important; text-transform: uppercase !important; }
        td { padding: 12px !important; border-bottom: 1px solid var(--border) !important; }

        /* Исключения для бейджей */
        .badge, [class*="badge"] { background: var(--gold) !important; color: #000 !important; padding: 2px 6px !important; border-radius: 2px !important; font-weight: 700 !important; text-transform: uppercase !important; font-size: 10px !important; }
        .badge * { color: #000 !important; }

        /* Скрытие лишнего мусора из старых шаблонов */
        .sidebar, aside, nav:not(.toc nav), header br { display: none !important; }
        .layout, .content, .container { display: block !important; max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
        
        /* Кнопки-демо */
        .button-demo { background: #000 !important; border: 1px solid var(--gold) !important; color: var(--gold) !important; padding: 2px 8px !important; border-radius: 4px !important; }
      `;
      doc.head.appendChild(style);

      const updateHeight = () => {
        frame.style.height = doc.documentElement.scrollHeight + 'px';
      };
      
      updateHeight();
      frame.style.opacity = '1';
      new ResizeObserver(updateHeight).observe(doc.body);
    } catch(e) {
      frame.style.height = '80vh';
      frame.style.opacity = '1';
    }
  };

  // Запускаем загрузку ПОСЛЕ того как навесили onload
  frame.src = resolvePath(item.file);
}

// ── SIDEBAR SEARCH ───────────────────────────────────────
$('sidebar-search').addEventListener('input', e => {
  buildNav(e.target.value.trim());
});

// ── MOBILE SIDEBAR ───────────────────────────────────────
$('menu-toggle').addEventListener('click', () => {
  $('sidebar').classList.add('open');
  $('overlay').classList.add('visible');
});
$('overlay').addEventListener('click', () => {
  $('sidebar').classList.remove('open');
  $('overlay').classList.remove('visible');
});

// ── THEME ────────────────────────────────────────────────
$('theme-toggle').addEventListener('click', toggleTheme);

// ── BOOT ─────────────────────────────────────────────────
initTheme();
showApp();

// PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}