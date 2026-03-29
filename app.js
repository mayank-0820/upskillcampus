const API_CANDIDATES = (() => {
  const isLiveServer = /^55\d\d$/.test(window.location.port || '');
  if (isLiveServer) return ['http://localhost:5002/api'];
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) return ['http://localhost:5002/api'];
  return ['https://nonmischievous-sindy-unofficially.ngrok-free.dev/api'];
})();


// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('cms_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('cms_user')); } catch { return null; }
}
function isLoggedIn() {
  const token = getToken();
  const user = getUser();
  return !!(token && user && user.email);
}

function logout() {
  localStorage.removeItem('cms_token');
  localStorage.removeItem('cms_user');
  window.location.href = 'login.html';
}

// ─── API HELPER ───────────────────────────────────────────────────────────────
async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  let res;
  for (const base of API_CANDIDATES) {
    try {
      res = await fetch(base + endpoint, opts);
      break;
    } catch {
      // Try next candidate.
    }
  }
  if (!res) throw new Error('Cannot reach API server. Start backend on port 5000 or 5001.');

  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const looksHtml = raw.trim().startsWith('<');
      data = { error: looksHtml ? '' : raw };
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('cms_token');
      localStorage.removeItem('cms_user');
      throw new Error('Session expired. Please login again.');
    }
    if (res.status === 413) {
      throw new Error('Page is too large. Compress image blocks and try again.');
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  const icon = type === 'success'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  toast.innerHTML = icon + ' ' + msg;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── THEME (DARK / LIGHT MODE) ───────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('quillora_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    // Default to light
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('quillora_theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.innerHTML = isDark
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

// ─── SEARCH UTILITY ──────────────────────────────────────────────────────────
function searchPosts(query, posts) {
  if (!query || !query.trim()) return posts;
  const q = query.toLowerCase().trim();
  return posts.filter(p => {
    const title = (p.title || '').toLowerCase();
    const content = (p.content || '').toLowerCase();
    return title.includes(q) || content.includes(q);
  });
}

// ─── READING TIME UTILITY ────────────────────────────────────────────────────
function estimateReadTime(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const text = div.textContent || '';
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

// ─── NAV RENDER ───────────────────────────────────────────────────────────────
function renderNav(activePage = '') {
  const user = getUser();
  const loggedIn = isLoggedIn();
  const userLabel = user && user.email ? user.email.split('@')[0] : 'user';

  const nav = document.getElementById('nav');
  if (!nav) return;

  nav.innerHTML = `
    <a class="nav-logo" href="blogs.html">
      <span class="nav-logo-icon">Q</span>
      Quillora
    </a>
    <div class="nav-center">
      <a class="nav-link ${activePage === 'blogs' ? 'active' : ''}" href="blogs.html">Posts</a>
      ${loggedIn ? `
        <a class="nav-link ${activePage === 'editor' ? 'active' : ''}" href="editor.html">Write</a>
        <a class="nav-link ${activePage === 'builder' ? 'active' : ''}" href="builder.html">Builder</a>
      ` : ''}
    </div>
    <div class="nav-actions">
      <button class="theme-toggle" id="theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme"></button>
      ${loggedIn ? `
        <span class="nav-user">${userLabel}</span>
        <button class="nav-btn ghost" onclick="logout()">Logout</button>
      ` : `
        <a class="nav-btn ghost" href="login.html">Login</a>
        <a class="nav-btn" href="register.html">Sign Up</a>
      `}
    </div>
  `;

  updateThemeIcon();
}

// Initialize theme on every page load
initTheme();
