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
  if (item.type === 'calculator' || item.file.endsWith('.html')) {
    renderHTML(item, area, section);
  } else {
    renderMarkdown(item, area, section);
  }
  area.scrollTo(0, 0);
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
      <iframe id="calc-frame" src="${resolvePath(item.file)}" title="${item.title}" style="opacity:0; transition:opacity 0.2s;"></iframe>
    </div>
  `;

  const frame = $('calc-frame');
  frame.onload = () => {
    try {
      const doc = frame.contentWindow.document;
      
      // Глобальная инъекция стилей Volvo Luxury во все iframe
      const style = doc.createElement('style');
      style.textContent = `
        :root {
          --accent: #003057;
          --gold: #c5a059;
          --bg: #121212;
          --panel: #1e1e1e;
          --border: #333;
          --text: #e0e0e0;
          --text-muted: #a0a0a0;
        }
        
        body { 
          background: transparent !important; 
          color: var(--text) !important; 
          font-family: 'IBM Plex Sans', system-ui, sans-serif !important;
          margin: 0 !important; 
          padding: 20px !important; 
          line-height: 1.6;
        }

        /* Заголовки */
        h1, h2, h3 { color: #fff !important; font-weight: 300 !important; margin-top: 1.5em !important; margin-bottom: 0.8em !important; }
        h1 { font-size: 2.2em; border-bottom: 1px solid var(--border); padding-bottom: 0.5em; }
        h2 { font-size: 1.6em; color: var(--gold) !important; text-transform: uppercase; letter-spacing: 0.05em; }
        
        /* Таблицы */
        table { 
          width: 100% !important; 
          border-collapse: collapse !important; 
          margin: 1.5em 0 !important; 
          background: var(--panel) !important;
          border: 1px solid var(--border) !important;
        }
        th { 
          background: #000 !important; 
          color: var(--text-muted) !important; 
          text-align: left !important; 
          padding: 12px 16px !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.1em !important;
          border-bottom: 2px solid var(--border) !important;
        }
        td { padding: 12px 16px !important; border-bottom: 1px solid var(--border) !important; font-size: 14px; }
        tr:hover td { background: rgba(255,255,255,0.02) !important; }

        /* Карточки и блоки */
        .info-card, .card, [class*="card"] {
          background: var(--panel) !important;
          border: 1px solid var(--border) !important;
          padding: 1.5em !important;
          margin: 1em 0 !important;
          border-radius: 4px !important;
        }
        
        /* Скроллбары */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

        /* Убираем лишние сайдбары и фиксированные элементы из car.html если они там остались */
        .sidebar, aside, nav { display: none !important; }
        .layout, .content { display: block !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; width: 100% !important; }
      `;
      doc.head.appendChild(style);

      const updateHeight = () => {
        const height = doc.documentElement.scrollHeight;
        frame.style.height = height + 'px';
      };
      
      updateHeight();
      frame.style.opacity = '1';
      new ResizeObserver(updateHeight).observe(doc.body);
    } catch(e) {
      console.warn('Seamless mode failed:', e);
      frame.style.height = '80vh';
      frame.style.opacity = '1';
    }
  };
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