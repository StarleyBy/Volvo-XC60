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

// ── AUDIO ENGINE (ADVANCED SYNTH 4.0 + PLAYLIST) ────────
const AudioEngine = {
  ctx: null,
  muted: localStorage.getItem('volvo-muted') === 'true',
  bgmNodes: [],
  playlist: [],
  currentIndex: -1,
  audio: new Audio(),
  minimized: localStorage.getItem('volvo-player-minimized') === 'true',
  
  init() {
    this.updateToggle();
    this.audio.onended = () => this.playNext();
    this.applyMinimize();
    this.initDraggable();
  },

  toggleMinimize() {
    this.minimized = !this.minimized;
    localStorage.setItem('volvo-player-minimized', this.minimized);
    this.applyMinimize();
  },

  applyMinimize() {
    const player = $('premium-player');
    const btn = $('player-minimize-btn');
    if (player) {
      if (this.minimized) {
        player.classList.add('minimized');
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 16.5l-6-6h12l-6 6z" fill="currentColor"/></svg>';
      } else {
        player.classList.remove('minimized');
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M19 13H5v-2h14v2z" fill="currentColor"/></svg>';
      }
    }
  },

  initDraggable() {
    const player = $('premium-player');
    if (!player) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Load position
    const pos = JSON.parse(localStorage.getItem('volvo-player-pos') || 'null');
    if (pos) {
      xOffset = pos.x;
      yOffset = pos.y;
      player.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    }

    const dragStart = (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest('.player-btn') || e.target.id === 'player-minimize-btn' || e.target.closest('#player-minimize-btn')) return;
      
      const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
      
      initialX = clientX - xOffset;
      initialY = clientY - yOffset;

      if (e.target.closest('#premium-player')) {
        isDragging = true;
      }
    };

    const dragEnd = () => {
      if (!isDragging) return;
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      localStorage.setItem('volvo-player-pos', JSON.stringify({ x: xOffset, y: yOffset }));
    };

    const drag = (e) => {
      if (isDragging) {
        e.preventDefault();
        const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
        
        currentX = clientX - initialX;
        currentY = clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;
        player.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
      }
    };

    player.addEventListener("touchstart", dragStart, { passive: false });
    document.addEventListener("touchend", dragEnd, false);
    document.addEventListener("touchmove", drag, { passive: false });

    player.addEventListener("mousedown", dragStart, false);
    document.addEventListener("mouseup", dragEnd, false);
    document.addEventListener("mousemove", drag, false);
  },

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
    console.log('AudioEngine: startBGM called, muted:', this.muted);
    if (this.muted) return;
    if (State.manifest && State.manifest.meta && State.manifest.meta.music && State.manifest.meta.music.length > 0) {
      console.log('AudioEngine: Found music in manifest:', State.manifest.meta.music);
      if (this.playlist.length === 0) {
        this.playlist = [...State.manifest.meta.music];
        this.shuffle(this.playlist);
        this.currentIndex = 0;
        console.log('AudioEngine: Playlist initialized and shuffled:', this.playlist);
      }
      this.playCurrent();
    } else {
      console.log('AudioEngine: No music in manifest (or not loaded yet), starting synth BGM');
      this.startSynthBGM();
    }
  },

  startSynthBGM() {
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

  playCurrent() {
    if (this.muted || this.playlist.length === 0) {
      console.log('AudioEngine: playCurrent aborted, muted or empty playlist');
      return;
    }
    const trackName = this.playlist[this.currentIndex];
    const trackUrl = 'music/' + trackName;
    console.log('AudioEngine: Playing track:', trackUrl);
    this.audio.src = trackUrl;
    this.audio.play().then(() => {
      console.log('AudioEngine: Playback started successfully');
      this.updateUI();
    }).catch(e => {
      console.warn('AudioEngine: Autoplay blocked or error:', e);
      this.updateUI();
      const playOnInteraction = () => {
        console.log('AudioEngine: User interaction detected, attempting play');
        this.audio.play().then(() => this.updateUI());
        window.removeEventListener('click', playOnInteraction);
      };
      window.addEventListener('click', playOnInteraction);
    });
  },

  playNext() {
    if (this.playlist.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.playCurrent();
  },

  playPrev() {
    if (this.playlist.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playCurrent();
  },

  togglePlay() {
    if (this.audio.paused) {
      if (!this.audio.src && this.playlist.length > 0) this.startBGM();
      else this.audio.play().then(() => this.updateUI());
    } else {
      this.audio.pause();
      this.updateUI();
    }
  },

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.updateUI();
  },

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  },

  stopBGM() { 
    this.bgmNodes.forEach(n => { try { n.stop(); } catch(e) {} }); 
    this.bgmNodes = []; 
    this.audio.pause();
    this.updateUI();
  },

  toggle() { 
    this.muted = !this.muted; 
    localStorage.setItem('volvo-muted', this.muted); 
    if (this.muted) {
      this.stopBGM(); 
    } else {
      if (this.audio.src) this.audio.play().then(() => this.updateUI());
      else this.startBGM(); 
    }
    this.updateToggle(); 
  },

  updateToggle() { 
    const btn = $('sound-toggle'); 
    if (btn) btn.textContent = this.muted ? '🔇' : '🔊';
    
    const pBtn = $('sound-toggle-premium');
    if (pBtn) {
      if (this.muted) {
        pBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>';
      } else {
        pBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>';
      }
    }
  },

  updateUI() {
    const playIcon = $('play-icon');
    if (playIcon) {
      if (this.audio.paused) {
        playIcon.innerHTML = '<path d="M8 5v14l11-7z" fill="currentColor"/>';
      } else {
        playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>';
      }
    }
    
    const info = $('music-info');
    if (info) {
      const name = this.playlist[this.currentIndex] || 'STANDING BY';
      info.textContent = this.audio.paused ? 'PAUSED' : name.replace('.mp3', '');
    }

    const dot = $('player-status-dot');
    if (dot) {
      dot.style.background = this.audio.paused ? '#777' : 'var(--accent-gold)';
      dot.style.boxShadow = this.audio.paused ? 'none' : '0 0 10px var(--accent-gold)';
    }
  }
};

// Expose AudioEngine globally to ensure it's accessible from inline onclick handlers
window.AudioEngine = AudioEngine;

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
    AudioEngine.startBGM();
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

// Event Listeners for UI toggles
$('theme-toggle').addEventListener('click', toggleTheme);
$('menu-toggle').addEventListener('click', () => {
  $('sidebar').classList.add('open');
  $('overlay').classList.add('visible');
});
$('overlay').addEventListener('click', () => {
  $('sidebar').classList.remove('open');
  $('overlay').classList.remove('visible');
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
