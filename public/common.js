// Shared helpers for the patient-facing pages.
async function api(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && body.needsLogin && location.pathname !== '/') {
    location.href = '/';
    return new Promise(() => {}); // page is navigating away
  }
  if (!res.ok) throw Object.assign(new Error(body.error || 'Something went wrong. Please try again.'), { retryAfter: body.retryAfter });
  return body;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

let configPromise;
function getConfig() {
  configPromise ||= api('/api/config');
  return configPromise;
}

getConfig().then((c) => document.querySelectorAll('[data-clinic]').forEach((el) => (el.textContent = c.clinicName))).catch(() => {});

async function logout() {
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  sessionStorage.removeItem('phone');
  location.href = '/';
}

function fmtPhone(p) {
  return '+91 ' + p.slice(0, 5) + ' ' + p.slice(5);
}
