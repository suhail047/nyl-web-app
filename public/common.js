// Shared helpers for the patient-facing pages.
async function api(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
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
