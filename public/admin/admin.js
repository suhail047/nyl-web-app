const state = { visits: [], patients: [], unseen: 0 };
const $ = (id) => document.getElementById(id);
const STATUS_LABEL = { paid: 'Paid', pending: 'Payment pending', upi_claimed: 'UPI – please confirm', failed: 'Not received', not_configured: 'Pay at clinic' };

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS"
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtPhone(p) { return '+91 ' + p.slice(0, 5) + ' ' + p.slice(5); }

// ---------- Submissions ----------
function visitCard(v, fresh) {
  return `<article class="visit${fresh ? ' fresh' : ''}" data-id="${v.id}">
    <a class="photo" href="${esc(v.photoUrl)}" target="_blank" rel="noopener">${v.photoUrl ? `<img src="${esc(v.photoUrl)}" alt="Photo of ${esc(v.patientName)}" loading="lazy">` : ''}</a>
    <div class="body">
      <div class="row"><button type="button" class="name link-plain" data-progress="${v.patientId}" title="See progress">${esc(v.patientName)}</button><span class="pill ${esc(v.paymentStatus)}">${esc(STATUS_LABEL[v.paymentStatus] || v.paymentStatus)}</span></div>
      <div class="muted">${esc(fmtPhone(v.phone))}${v.age != null ? ' · ' + esc(v.age) + ' yrs' : ''}${v.gender ? ' · ' + esc(v.gender) : ''}</div>
      ${v.planLabel ? `<div><span class="plan-tag">${esc(v.planLabel)}</span></div>` : ''}
      <div class="muted kind">${v.visitKind === 'followup' ? '🌱 Positive changes since last healing' : 'Problems faced'}</div>
      <div class="problems">${esc(v.problems)}</div>
      ${v.visitKind !== 'followup' ? `
        <div class="muted kind">Treatments tried</div>
        <div class="problems">${esc(v.treatmentsTried || '—')}</div>
        <div class="muted kind">Medicines taking now</div>
        <div class="problems">${esc(v.currentMedicines || '—')}</div>` : ''}
      ${v.consentAt ? '<div class="muted">✓ Consent given</div>' : ''}
      <div class="row muted"><span>${esc(fmtDate(v.createdAt))}</span><span>${v.amount > 0 ? '₹' + esc(v.amount.toLocaleString('en-IN')) : 'No fixed fee'}</span></div>
      ${v.razorpayPaymentId ? `<div class="muted">Payment ID: ${esc(v.razorpayPaymentId)}</div>` : ''}
      ${v.paymentMethod === 'upi' && v.paymentStatus !== 'paid' ? `<div class="muted">UPI note to look for: <b>Visit ${v.id}</b></div>` : ''}
      ${v.upiRef ? `<div class="muted">UTR given by patient: <b>${esc(v.upiRef)}</b></div>` : ''}
      <div><button type="button" class="link link-danger" data-remove="${v.id}" data-label="${esc(v.planLabel || 'this session')} for ${esc(v.patientName)}">Remove this session</button></div>
      ${v.paymentStatus !== 'paid' ? `<div class="pay-actions">
        <button type="button" data-pay="confirm" data-id="${v.id}">✓ Mark paid</button>
        ${v.paymentStatus === 'upi_claimed' ? `<button type="button" class="secondary" data-pay="reject" data-id="${v.id}">Not received</button>` : ''}
      </div>` : ''}
    </div>
  </article>`;
}

function renderVisits(freshId) {
  const term = $('visitSearch').value.trim().toLowerCase();
  const status = $('statusFilter').value;
  const shown = state.visits.filter((v) =>
    (!status || v.paymentStatus === status) &&
    (!term || [v.patientName, v.phone, v.problems, v.treatmentsTried, v.currentMedicines].some((f) => String(f).toLowerCase().includes(term))));
  $('visits').innerHTML = shown.map((v) => visitCard(v, v.id === freshId)).join('');
  $('visitsEmpty').classList.toggle('hidden', shown.length > 0);
}

// ---------- Patients ----------
function renderPatients() {
  const term = $('patientSearch').value.trim().toLowerCase();
  const shown = state.patients.filter((p) => !term || p.name.toLowerCase().includes(term) || p.phone.includes(term.replace(/\D/g, '') || '\0'));
  let prev = null;
  $('patients').innerHTML = shown.map((p) => {
    const first = p.phone !== prev;
    prev = p.phone;
    return `<tr class="${first ? 'group-start' : ''}">
      <td>${first ? esc(fmtPhone(p.phone)) : ''}</td><td>${esc(p.name)}</td><td>${p.age ?? '—'}</td><td>${esc(p.gender || '—')}</td>
      <td>${p.visit_count ?? 0}</td><td>${esc(fmtDate(p.last_visit))}</td><td>${esc(fmtDate(p.created_at))}</td>
      <td><button class="link link-ok" data-progress="${p.id}">Progress</button></td>
      <td><button class="link" data-del="${p.id}">Delete</button></td></tr>`;
  }).join('') || '<tr><td colspan="9" class="empty">No patients yet.</td></tr>';
  renderProgressList();
}

// ---------- Progress (one patient's healing day by day) ----------
const progress = { patientId: null };

// "YYYY-MM-DD" in Indian time for a UTC timestamp from the database.
function istDay(s) {
  return new Date(new Date(s.replace(' ', 'T') + 'Z').getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function fmtDay(day) {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function renderProgressList() {
  const term = $('progressSearch').value.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const shown = state.patients
    .filter((p) => !term || p.name.toLowerCase().includes(term) || (digits && p.phone.includes(digits)))
    .sort((a, b) => (b.last_visit || '').localeCompare(a.last_visit || '') || a.name.localeCompare(b.name));
  $('progressList').innerHTML = shown.map((p) => `
    <li><button type="button" class="${p.id === progress.patientId ? 'active' : ''}" data-progress="${p.id}">
      <span class="pname">${esc(p.name)}</span>
      <span class="muted">${esc(fmtPhone(p.phone))} · ${p.visit_count || 0} visit${p.visit_count === 1 ? '' : 's'}${p.last_visit ? ' · last ' + esc(fmtDay(istDay(p.last_visit))) : ''}</span>
    </button></li>`).join('') || '<li class="muted">No patients found.</li>';
}

async function openProgress(patientId) {
  progress.patientId = Number(patientId);
  document.querySelector('.tab[data-tab=progress]').click();
  renderProgressList();
  await loadProgress();
  if (window.matchMedia('(max-width: 760px)').matches) $('progressMain').scrollIntoView({ behavior: 'smooth' });
}

// Heading for each block, numbered per type in time order, e.g. "12-session course #2".
function blockTitles(visits) {
  const titles = {};
  const count = { daily: 0, weekly: 0 };
  for (const v of visits) {
    if (v.blockNo == null || titles[v.blockNo]) continue;
    const n = ++count[v.phase];
    titles[v.blockNo] = v.phase === 'weekly' ? `Weekly sessions – 12 weeks${n > 1 ? ' #' + n : ''}` : `12-session course #${n}`;
  }
  return titles;
}

async function loadProgress() {
  if (!progress.patientId) return;
  let data;
  try {
    data = await api(`/api/admin/patients/${progress.patientId}/visits`);
  } catch (err) {
    $('progressMain').innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    return;
  }
  const { patient: p, visits, upcoming } = data;
  const last = visits[visits.length - 1];
  const nextChoice = p.next_block || '';
  const head = `
    <div class="progress-head card">
      <div><h2>${esc(p.name)}</h2>
        <div class="muted">${esc(fmtPhone(p.phone))}${p.age != null ? ' · ' + esc(p.age) + ' yrs' : ''}${p.gender ? ' · ' + esc(p.gender) : ''}</div></div>
      <div class="stats">
        <span><b>${visits.length}</b> healing${visits.length === 1 ? '' : 's'}</span>
        ${last?.planLabel ? `<span>Now: <b>${esc(last.planLabel)}</b></span>` : ''}
        ${upcoming ? `<span>Next: <b>${esc(upcoming.label)}</b> · ${esc(fmtDay(upcoming.date))}</span>` : ''}
      </div>
    </div>
    <div class="plan-card card">
      <label for="nextBlock">${last?.phase === 'weekly' ? 'After the next 12-session course' : 'After the current 12-session course'}</label>
      <div class="plan-row">
        <select id="nextBlock" data-patient="${p.id}">
          <option value="" ${nextChoice === '' ? 'selected' : ''}>12 weekly sessions (usual)</option>
          <option value="daily" ${nextChoice === 'daily' ? 'selected' : ''}>Another 12 sessions</option>
          <option value="restart" ${nextChoice === 'restart' ? 'selected' : ''}>Restart at Session 1 from the next visit</option>
        </select>
        <span class="muted" id="planSaved"></span>
      </div>
      <p class="muted small">The plan: 12 sessions → 12 weekly sessions → 12 sessions → … "Another 12 sessions" applies once, after the
        current course; after that the patient goes back to weekly healing.</p>
    </div>`;
  if (!visits.length) {
    $('progressMain').innerHTML = head + '<p class="empty">No photos submitted yet.</p>';
    return;
  }
  // Newest first, grouped under a heading per course.
  const titles = blockTitles(visits);
  const newest = [...visits].reverse();
  $('progressMain').innerHTML = head + '<ol class="timeline">' + newest.map((v, i) => {
    const day = istDay(v.createdAt);
    const newBlock = i === 0 || v.blockNo !== newest[i - 1].blockNo;
    const tag = v.sessionNo ? `Session ${v.sessionNo}` : '';
    return `
    ${newBlock ? `<li class="course-break">${esc(titles[v.blockNo] || 'Healing')}</li>` : ''}
    <li class="entry">
      <div class="when"><span class="dayno">${esc(tag)}</span><span class="muted">of 12</span><span class="muted">${esc(fmtDay(day))}</span></div>
      <a class="thumb" href="${esc(v.photoUrl)}" target="_blank" rel="noopener">${v.photoUrl ? `<img src="${esc(v.photoUrl)}" alt="Photo, ${esc(tag)}" loading="lazy">` : ''}</a>
      <div class="what">
        <div class="row"><span class="muted kind">${v.visitKind === 'followup' ? '🌱 Positive changes since last healing' : 'Problems faced'}</span>
          <span class="pill ${esc(v.paymentStatus)}">${esc(STATUS_LABEL[v.paymentStatus] || v.paymentStatus)}${v.amount > 0 ? ' · ₹' + esc(v.amount.toLocaleString('en-IN')) : ''}</span></div>
        <div class="problems">${esc(v.problems)}</div>
        ${v.visitKind !== 'followup' ? `
          <div class="muted kind">Treatments tried</div><div class="problems">${esc(v.treatmentsTried || '—')}</div>
          <div class="muted kind">Medicines taking now</div><div class="problems">${esc(v.currentMedicines || '—')}</div>` : ''}
        <div><button type="button" class="link link-danger" data-remove="${v.id}" data-label="${esc(tag)} on ${esc(fmtDay(day))}">Remove this session</button></div>
      </div>
    </li>`;
  }).join('') + '</ol>';
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  if (!confirm(`Remove ${btn.dataset.label}?\n\nThe photo and answers for this session will be deleted. Later sessions in the same course move up by one.`)) return;
  btn.disabled = true;
  try {
    await api('/api/admin/visits/' + btn.dataset.remove, { method: 'DELETE' });
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id !== 'nextBlock') return;
  $('planSaved').textContent = 'Saving…';
  try {
    await api(`/api/admin/patients/${e.target.dataset.patient}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nextBlock: e.target.value || null }),
    });
    await loadProgress();
    $('planSaved').textContent = '✓ Saved';
  } catch (err) {
    $('planSaved').textContent = err.message;
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-progress]');
  if (btn) openProgress(btn.dataset.progress);
});
$('progressSearch').addEventListener('input', renderProgressList);

async function loadAll() {
  const [visits, patients] = await Promise.all([api('/api/admin/visits'), api('/api/admin/patients')]);
  state.visits = visits;
  state.patients = patients;
  renderVisits();
  renderPatients();
}

// ---------- Live updates ----------
function notify(v) {
  if (!document.hasFocus() || $('tab-visits').classList.contains('hidden')) {
    state.unseen++;
    $('newCount').textContent = state.unseen;
    $('newCount').classList.remove('hidden');
    document.title = `(${state.unseen}) New submission · Clinic Admin`;
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('New patient submission', { body: `${v.patientName} · ${fmtPhone(v.phone)}`, icon: v.photoUrl });
  }
}

function connect() {
  const es = new EventSource('/api/admin/stream');
  es.onopen = () => { $('live').className = 'live on'; $('liveText').textContent = 'Live'; loadAll().catch(() => {}); };
  es.onerror = () => { $('live').className = 'live off'; $('liveText').textContent = 'Reconnecting…'; };
  es.addEventListener('visit-created', (e) => {
    const v = JSON.parse(e.data);
    state.visits.unshift(v);
    renderVisits(v.id);
    notify(v);
    loadPatientsQuietly();
    if (v.patientId === progress.patientId) loadProgress();
  });
  es.addEventListener('visit-updated', (e) => {
    const v = JSON.parse(e.data);
    const i = state.visits.findIndex((x) => x.id === v.id);
    if (i >= 0) state.visits[i] = v; else state.visits.unshift(v);
    renderVisits(v.id);
    if (v.patientId === progress.patientId) loadProgress();
  });
  es.addEventListener('patient-added', loadPatientsQuietly);
  es.addEventListener('patient-deleted', loadPatientsQuietly);
  es.addEventListener('visit-deleted', (e) => {
    const { id, patientId } = JSON.parse(e.data);
    state.visits = state.visits.filter((x) => x.id !== id);
    renderVisits();
    loadPatientsQuietly();
    if (patientId === progress.patientId) loadProgress();
  });
}

async function loadPatientsQuietly() {
  try { state.patients = await api('/api/admin/patients'); renderPatients(); } catch {}
}

// ---------- UI wiring ----------
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('tab-visits').classList.toggle('hidden', t.dataset.tab !== 'visits');
  $('tab-patients').classList.toggle('hidden', t.dataset.tab !== 'patients');
  $('tab-progress').classList.toggle('hidden', t.dataset.tab !== 'progress');
  $('tab-settings').classList.toggle('hidden', t.dataset.tab !== 'settings');
  if (t.dataset.tab === 'settings') loadSettings();
  if (t.dataset.tab === 'visits') clearUnseen();
}));

function clearUnseen() {
  state.unseen = 0;
  $('newCount').classList.add('hidden');
  document.title = 'Clinic Admin';
}
window.addEventListener('focus', () => { if (!$('tab-visits').classList.contains('hidden')) clearUnseen(); });
document.addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}, { once: true });

$('visits').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-pay]');
  if (!btn) return;
  const v = state.visits.find((x) => String(x.id) === btn.dataset.id);
  const question = btn.dataset.pay === 'confirm'
    ? `Mark ${v.amount > 0 ? '₹' + v.amount : 'the payment'} from ${v.patientName} as received?`
    : `Mark ${v.patientName}'s UPI payment as NOT received?`;
  if (!confirm(question)) return;
  btn.disabled = true;
  try {
    await api('/api/admin/visits/' + btn.dataset.id + '/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: btn.dataset.pay }),
    });
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
});

$('visitSearch').addEventListener('input', () => renderVisits());
$('statusFilter').addEventListener('change', () => renderVisits());
$('patientSearch').addEventListener('input', renderPatients);

$('addPatient').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('apError').textContent = '';
  try {
    await api('/api/admin/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: $('apPhone').value, name: $('apName').value, age: $('apAge').value, gender: $('apGender').value }),
    });
    e.target.reset();
    $('apPhone').focus();
    loadPatientsQuietly();
  } catch (err) {
    $('apError').textContent = err.message;
  }
});

$('patients').addEventListener('click', async (e) => {
  const id = e.target.dataset.del;
  if (!id) return;
  const p = state.patients.find((x) => String(x.id) === id);
  if (!confirm(`Delete ${p.name}? Their submissions will also be removed.`)) return;
  await api('/api/admin/patients/' + id, { method: 'DELETE' });
  state.visits = state.visits.filter((v) => String(v.patientId) !== id);
  renderVisits();
  loadPatientsQuietly();
});

async function loadSettings() {
  const { fee } = await api('/api/admin/settings');
  $('feeInput').value = fee > 0 ? fee : '';
  $('settingsMsg').textContent = '';
  loadBackups();
}

async function loadBackups() {
  const list = await api('/api/admin/backups');
  $('backupList').innerHTML = list.length
    ? list.slice(0, 60).map((b) => `<li><a href="/api/admin/backups/${encodeURIComponent(b.name)}" download>${esc(new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</a>
        <span class="muted">${Math.max(1, Math.round(b.size / 1024))} KB</span></li>`).join('')
    : '<li class="muted">The first daily backup will appear here after 11:30 PM tonight.</li>';
}

$('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('settingsMsg');
  msg.textContent = '';
  msg.style.color = '';
  $('saveSettings').disabled = true;
  try {
    const { fee } = await api('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fee: $('feeInput').value }),
    });
    $('feeInput').value = fee > 0 ? fee : '';
    msg.style.color = 'var(--ok)';
    msg.textContent = fee > 0 ? `Saved. New patients will see ₹${fee.toLocaleString('en-IN')}.` : 'Saved. No fixed fee – patients enter the amount.';
  } catch (err) {
    msg.textContent = err.message;
  } finally {
    $('saveSettings').disabled = false;
  }
});

loadAll().catch((err) => alert(err.message));
connect();
