/* ============================================================
   VOLVO XC60 HANDBOOK — app.js
   Routing, manifest loading, content rendering, Favorites
   ============================================================ */

'use strict';

const MANIFEST_URL = './app-manifest.yml';

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
  role: 'admin', 
  theme: 'dark',
  manifest: null,
  currentItem: null,
  fontSize: parseInt(localStorage.getItem('volvo-font-size') || '16'),
  favorites: JSON.parse(localStorage.getItem('volvo-favorites') || '[]')
};

const $ = id => document.getElementById(id);

// ── THEME & FONT ─────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('volvo-theme') || 'dark';
  setTheme(saved);
  updateFontSize(0);
}
function setTheme(t) {
  State.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  $('theme-toggle').textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('volvo-theme', t);
}
function toggleTheme() { setTheme(State.theme === 'dark' ? 'light' : 'dark'); }

function updateFontSize(delta) {
  State.fontSize = Math.max(12, Math.min(26, State.fontSize + delta));
  document.documentElement.style.setProperty('--base-font', State.fontSize + 'px');
  localStorage.setItem('volvo-font-size', State.fontSize);
  
  const frame = $('calc-frame');
  if (frame && frame.contentWindow) {
    try {
      const doc = frame.contentWindow.document;
      doc.documentElement.style.setProperty('--base-font', State.fontSize + 'px');
      frame.style.height = doc.documentElement.scrollHeight + 'px';
    } catch(e) {}
  }
}

// ── FAVORITES ────────────────────────────────────────────
function toggleFavorite(itemId, sectionId) {
  const index = State.favorites.findIndex(f => f.itemId === itemId && f.sectionId === sectionId);
  if (index > -1) State.favorites.splice(index, 1);
  else State.favorites.push({ itemId, sectionId });
  localStorage.setItem('volvo-favorites', JSON.stringify(State.favorites));
  buildNav($('sidebar-search').value);
  if (State.currentItem && State.currentItem.id === itemId) {
    const star = $('fav-toggle');
    if (star) star.textContent = index > -1 ? '☆' : '★';
  }
}
function isFavorite(itemId, sectionId) { return State.favorites.some(f => f.itemId === itemId && f.sectionId === sectionId); }

// ── AUDIO ENGINE (ADVANCED SYNTH 4.0) ───────────────────
const AudioEngine = {
  ctx: null,
  muted: localStorage.getItem('volvo-muted') === 'true',
  bgmNodes: [],
  
  init() { this.updateToggle(); },

  async ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  },

  playSFX(type) {
    if (this.muted) return;
    this.ensureCtx().then(() => {
      switch(type) {
        case 'click':  this.synthClick(800, 0.08); break;
        case 'nav':    this.synthClick(350, 0.12, 'triangle'); break;
        case 'open':   this.synthDoublePing(); break;
        case 'error':  this.synthError(); break;
        case 'engine': this.synthEngineAggressive(); break;
      }
    });
  },

  synthClick(freq, dur, type = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq/2, this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  },

  synthDoublePing() {
    [1100, 1400].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.07);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.07 + 0.12);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.07); osc.stop(this.ctx.currentTime + i * 0.07 + 0.12);
    });
  },

  synthError() {
    [180, 140].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.1 + 0.1);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.1); osc.stop(this.ctx.currentTime + i * 0.1 + 0.1);
    });
  },

  synthEngineAggressive() {
    const dur = 3.0;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(20, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.4); 
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + dur);
    osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  },

  startBGM() {
    if (this.muted) return;
    this.ensureCtx().then(() => {
      this.stopBGM();
      const createPad = (freq, vol) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 2);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start();
        this.bgmNodes.push(osc);
      };
      createPad(110, 0.05); createPad(165, 0.03);
    });
  },

  stopBGM() { this.bgmNodes.forEach(n => { try { n.stop(); } catch(e) {} }); this.bgmNodes = []; },
  toggle() { this.muted = !this.muted; localStorage.setItem('volvo-muted', this.muted); if (this.muted) this.stopBGM(); else this.startBGM(); this.updateToggle(); },
  updateToggle() { const btn = $('sound-toggle'); if (btn) btn.textContent = this.muted ? '🔇' : '🔊'; }
};

// ── AUTH & IGNITION ──────────────────────────────────────
const AUTH_CODE = '456755';
let pinInput = '';

function addPin(num) {
  if (pinInput.length >= 6) return;
  AudioEngine.playSFX('click');
  pinInput += num;
  updatePinDisplay();
  if (pinInput.length === 6) setTimeout(checkPin, 300);
}
function clearPin() { AudioEngine.playSFX('click'); pinInput = ''; updatePinDisplay(); }

async function checkPin() {
  if (pinInput === AUTH_CODE) {
    $('login-status').textContent = 'ENGINE STARTING...';
    $('login-status').style.color = '#4caf50';
    document.querySelector('#ignition-knob').classList.add('ignited');
    AudioEngine.playSFX('engine');
    AudioEngine.startBGM();
    localStorage.setItem('volvo-session', Date.now());
    setTimeout(() => { $('login-screen').style.opacity = '0'; setTimeout(() => { $('login-screen').style.display = 'none'; showApp(); }, 500); }, 2000);
  } else {
    $('login-status').textContent = 'INVALID KEY'; $('login-status').style.color = '#f44336';
    AudioEngine.playSFX('error'); pinInput = ''; updatePinDisplay();
    setTimeout(() => { $('login-status').textContent = 'READY TO START'; $('login-status').style.color = ''; }, 1500);
  }
}

$('ignition-knob').addEventListener('click', () => {
  AudioEngine.playSFX('click');
  $('ignition-knob-wrap').style.transform = 'scale(0.95) rotate(5deg)';
  setTimeout(() => { $('ignition-knob-wrap').style.display = 'none'; $('pin-pad').style.display = 'block'; $('login-status').textContent = 'ENTER PIN'; }, 200);
});

// ── APP INIT ─────────────────────────────────────────────
async function showApp() {
  const APP_VERSION = '2.7';
  if (localStorage.getItem('volvo-app-version') !== APP_VERSION) {
    localStorage.removeItem('volvo-session');
    localStorage.setItem('volvo-app-version', APP_VERSION);
  }
  if (!localStorage.getItem('volvo-session')) {
    $('login-screen').style.display = 'flex'; $('app').style.display = 'none'; return;
  }
  $('app').style.display = 'flex';
  try {
    const text = await fetch(MANIFEST_URL + '?v=' + Date.now()).then(r => r.text());
    State.manifest = jsyaml.load(text);
    buildNav();
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('section'), iid = urlParams.get('item');
    if (sid && iid) openItemById(sid, iid, false);
    else if (sid) openSection(sid, false);
    else showHome(false);
  } catch(e) { console.error('Manifest fail', e); }
}

// ── NAV BUILD ────────────────────────────────────────────
function buildNav(filter = '') {
  const nav = $('sidebar-nav'), fl = filter.toLowerCase();
  nav.innerHTML = '';
  if (State.favorites.length > 0) {
    const favSec = document.createElement('div');
    favSec.className = 'nav-section';
    favSec.innerHTML = `<div class="nav-section-header">⭐ <span>Избранное</span></div><div class="nav-items"></div>`;
    const container = favSec.querySelector('.nav-items');
    State.favorites.forEach(fav => {
      const section = State.manifest.sections.find(s => s.id === fav.sectionId);
      const item = section?.items.find(i => i.id === fav.itemId);
      if (item && (!fl || item.title.toLowerCase().includes(fl))) {
        const el = document.createElement('div'); el.className = 'nav-item';
        el.innerHTML = `<span>${item.title}</span>`;
        el.onclick = () => openItem(section, item);
        container.appendChild(el);
      }
    });
    if (container.children.length > 0) nav.appendChild(favSec);
  }
  for (const section of State.manifest.sections) {
    const items = (section.items || []).filter(i => !fl || i.title.toLowerCase().includes(fl));
    if (!items.length) continue;
    const sec = document.createElement('div');
    sec.className = 'nav-section';
    sec.innerHTML = `<div class="nav-section-header">${section.icon} <span>${section.title}</span></div><div class="nav-items"></div>`;
    const container = sec.querySelector('.nav-items');
    items.forEach(item => {
      const el = document.createElement('div'); el.className = 'nav-item';
      el.innerHTML = `<span>${item.title}</span>`;
      el.onclick = () => openItem(section, item);
      container.appendChild(el);
    });
    nav.appendChild(sec);
  }
}

function openSection(sectionId, push = true) {
  if (push) AudioEngine.playSFX('nav');
  const section = State.manifest.sections.find(s => s.id === sectionId);
  if (!section) return;
  if (push) updateUrl({ view: 'section', id: sectionId });
  renderSectionIndex(section);
}

function openItem(section, item, push = true) {
  State.currentItem = item;
  if (push) { updateUrl({ view: 'item', sectionId: section.id, itemId: item.id }); AudioEngine.playSFX('open'); }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.innerText === item.title));
  $('page-breadcrumb').innerHTML = `<span class="bc-link" onclick="showHome()">Главная</span> <span class="bc-sep">/</span> <span class="bc-link" onclick="openSection('${section.id}')">${section.title}</span>`;
  $('sidebar').classList.remove('open'); $('overlay').classList.remove('visible');
  const area = $('content-area');
  const file = resolvePath(item.file);
  if (item.type === 'document' || file.endsWith('.pdf')) renderPDF(item, area, section);
  else if (file.endsWith('.json')) renderJSON(item, area, section);
  else if (item.type === 'calculator' || item.file.endsWith('.html')) renderHTML(item, area, section);
  else renderMarkdown(item, area, section);
  area.scrollTo(0, 0);
}

function showHome(push = true) {
  if (push) updateUrl({ view: 'home' });
  $('page-breadcrumb').innerHTML = '<span class="bc-link" onclick="showHome()">Панель управления</span>';
  State.currentItem = null;
  renderHome();
}

function renderHome() {
  const area = $('content-area'), now = new Date();
  const greeting = now.getHours() < 6 ? 'Доброй ночи' : now.getHours() < 12 ? 'Доброе утро' : now.getHours() < 18 ? 'Добрый день' : 'Добрый вечер';
  let cards = '';
  State.manifest.sections.forEach(s => {
    cards += `<div class="home-card" onclick="openSection('${s.id}')"><div class="home-card-icon">${s.icon || '📁'}</div><div class="home-card-title">${s.title}</div></div>`;
  });
  area.innerHTML = `
    <div id="home-screen">
      <div id="home-greeting"><h1>${greeting}</h1><p>Volvo XC60 · ${now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</p></div>
      <div id="vehicle-info-bar">
        <div id="vehicle-img-wrap"><img src="icons/icon-192.png"></div>
        <div id="vehicle-details">
          <div id="vehicle-title">Volvo XC60 Momentum 2020</div>
          <div id="vehicle-specs">
            <span class="spec-pill">VIN</span><span class="vin-box">LYVUZAKVDLB515051</span>
            <span class="spec-pill">Номер</span><span class="plate-box">78770601</span>
          </div>
        </div>
      </div>
      <div class="home-grid">${cards}</div>
    </div>`;
}

function renderSectionIndex(section) {
  const area = $('content-area');
  $('page-breadcrumb').innerHTML = `<span class="bc-link" onclick="showHome()">Главная</span> <span class="bc-sep">/</span> <span>${section.title}</span>`;
  let html = `<div id="section-index"><div class="index-grid">`;
  (section.items || []).forEach(item => {
    html += `<div class="index-card sec-${section.id}" onclick="openItemById('${section.id}', '${item.id}')"><div class="index-card-title">${item.title}</div></div>`;
  });
  area.innerHTML = html + `</div></div>`;
}

function openItemById(sid, iid, push = true) {
  const s = State.manifest.sections.find(x => x.id === sid);
  const i = s?.items.find(x => x.id === iid);
  if (s && i) openItem(s, i, push);
}

async function renderMarkdown(item, area, section) {
  area.innerHTML = '<p class="loading-msg">Загрузка…</p>';
  try {
    const text = await fetch(resolvePath(item.file) + '?v=' + Date.now()).then(r => r.text());
    
    // Настраиваем генерацию ID для заголовков
    const renderer = new marked.Renderer();
    renderer.heading = (text, level) => {
      const id = text.toLowerCase().trim().replace(/[^\wа-яё]+/g, '-').replace(/^-+|-+$/g, '');
      return `<h${level} id="${id}">${text}</h${level}>`;
    };

    const html = marked.parse(text, { renderer });
    const responsiveHtml = html.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>/g, '</table></div>');
    area.innerHTML = `<div id="page-view"><div class="page-header"><span class="page-type-badge">${item.type}</span><button id="fav-toggle" class="topbar-btn" onclick="toggleFavorite('${item.id}', '${section.id}')" style="margin-left:10px; font-size:18px; border:none; background:transparent;">${isFavorite(item.id, section.id) ? '★' : '☆'}</button></div><div class="md-body">${responsiveHtml}</div></div>`;
    interceptLinks(area);
  } catch(e) { area.innerHTML = `<p class="empty-msg">Ошибка</p>`; }
}

function renderHTML(item, area, section) {
  area.innerHTML = `<div id="page-view" class="wide"><div class="page-header"><span class="page-type-badge">${item.type}</span><button id="fav-toggle" class="topbar-btn" onclick="toggleFavorite('${item.id}', '${section.id}')" style="margin-left:10px; font-size:18px; border:none; background:transparent;">${isFavorite(item.id, section.id) ? '★' : '☆'}</button></div><iframe id="calc-frame" title="${item.title}" style="opacity:0; width:100%; border:none;"></iframe></div>`;
  const frame = $('calc-frame');
  frame.onload = () => {
    try {
      const doc = frame.contentWindow.document;
      const style = doc.createElement('style');
      style.textContent = `:root { --gold: #c5a059; --bg: #121212; --panel: #1e1e1e; --border: #333; --text: #e0e0e0; --base-font: ${State.fontSize}px; } body { background: transparent !important; margin: 0 !important; padding: 20px !important; line-height: 1.6; color: var(--text) !important; font-family: sans-serif !important; font-size: var(--base-font) !important; } * { color: var(--text) !important; border-color: var(--border) !important; } div, section, header, footer, article, aside, main, p, li { background-color: transparent !important; } h1, h2, h3, h4, strong, b { color: #fff !important; } h2 { color: var(--gold) !important; text-transform: uppercase; } a, a * { color: var(--gold) !important; text-decoration: none !important; } .card, .info-card, .highlight, .toc, blockquote, [class*="card"], [class*="warning"], [class*="block"] { background: var(--panel) !important; border: 1px solid var(--border) !important; border-left: 4px solid var(--gold) !important; padding: 20px !important; margin: 20px 0 !important; } table { width: 100% !important; border-collapse: collapse !important; background: var(--panel) !important; } th { background: #000 !important; color: var(--gold) !important; padding: 12px !important; } td { padding: 12px !important; border-bottom: 1px solid var(--border) !important; } .sidebar, aside, nav:not(.toc nav) { display: none !important; } .layout, .content, .container { display: block !important; max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }`;
      doc.head.appendChild(style);
      const updateHeight = () => { frame.style.height = doc.documentElement.scrollHeight + 'px'; };
      updateHeight(); frame.style.opacity = '1';
      new ResizeObserver(updateHeight).observe(doc.body);
    } catch(e) { frame.style.height = '80vh'; frame.style.opacity = '1'; }
  };
  frame.src = resolvePath(item.file);
}

function renderJSON(item, area, section) {
  area.innerHTML = '<p class="loading-msg">Загрузка каталога…</p>';
  fetch(resolvePath(item.file)).then(r=>r.json()).then(data => {
    let h = `<div id="page-view" class="wide"><div class="page-header"><span class="page-type-badge">Каталог</span></div>`;
    for(let k in data.categories){
      let c = data.categories[k]; if(!c.name) continue;
      h += `<h2 style="color:var(--accent-gold); margin-top:30px;">${c.name}</h2>`;
      (c.items||[]).forEach(p => {
        h += `<div class="card sec-${section.id}" style="margin-bottom:15px; border-left:4px solid var(--accent-gold);"><h3 style="color:#fff;">${p.name}</h3><p style="font-size:0.9em; opacity:0.8;">${p.interval||''}</p><div class="vin-box" style="margin-top:10px;">${p.original}</div></div>`;
      });
    }
    area.innerHTML = h + `</div>`;
  });
}

function renderPDF(item, area, section) {
  const file = resolvePath(item.file);
  area.innerHTML = `<div id="page-view" class="wide"><div class="page-header"><span class="page-type-badge">PDF</span><div style="margin-left:auto; display:flex; gap:6px;"><button class="topbar-btn" onclick="window.open('${file}', '_blank')">📱</button><a href="${file}" download class="topbar-btn">⬇️</a></div></div><div style="background:#111; border-radius:4px; height:80vh; overflow:hidden;"><object data="${file}" type="application/pdf" width="100%" height="100%"><iframe src="${file}" style="width:100%; height:100%; border:none;"></iframe></object></div></div>`;
}

function interceptLinks(area) {
  area.querySelectorAll('a').forEach(a => {
    a.onclick = (e) => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#')) {
        e.preventDefault();
        const rawId = decodeURIComponent(href.substring(1)).toLowerCase().trim();
        const slugId = rawId.replace(/[^\wа-яё]+/g, '-').replace(/^-+|-+$/g, '');
        const target = area.querySelector(`[id="${slugId}"]`) || area.querySelector(`[id="${rawId}"]`) || area.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      } else if (href.endsWith('.md') || href.endsWith('.html') || href.endsWith('.json') || href.endsWith('.pdf')) {
        e.preventDefault();
        const filename = href.split('/').pop();
        for (const section of State.manifest.sections) {
          const item = section.items.find(i => i.file.endsWith(filename));
          if (item) { openItem(section, item); return; }
        }
      }
    };
  });
}

function updatePinDisplay() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => dot.classList.toggle('active', i < pinInput.length));
}

function updateUrl(p) {
  const u = new URL(window.location);
  if (p.view === 'home') u.search = '';
  else if (p.view === 'section') { u.searchParams.set('section', p.id); u.searchParams.delete('item'); }
  else if (p.view === 'item') { u.searchParams.set('section', p.sectionId); u.searchParams.set('item', p.itemId); }
  window.history.pushState(p, '', u);
}

window.onpopstate = (e) => {
  const s = e.state;
  if (!s || s.view === 'home') showHome(false);
  else if (s.view === 'section') openSection(s.id, false);
  else if (s.view === 'item') openItemById(s.sectionId, s.itemId, false);
};

AudioEngine.init(); initTheme(); showApp();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
