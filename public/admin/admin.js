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
      <div class="row"><span class="name">${esc(v.patientName)}</span><span class="pill ${esc(v.paymentStatus)}">${esc(STATUS_LABEL[v.paymentStatus] || v.paymentStatus)}</span></div>
      <div class="muted">${esc(fmtPhone(v.phone))}${v.age != null ? ' · ' + esc(v.age) + ' yrs' : ''}${v.gender ? ' · ' + esc(v.gender) : ''}</div>
      <div class="muted kind">${v.visitKind === 'followup' ? '🌱 Positive changes since last healing' : 'Problems faced'}</div>
      <div class="problems">${esc(v.problems)}</div>
      ${v.visitKind !== 'followup' ? `
        <div class="muted kind">Treatments tried</div>
        <div class="problems">${esc(v.treatmentsTried || '—')}</div>
        <div class="muted kind">Medicines taking now</div>
        <div class="problems">${esc(v.currentMedicines || '—')}</div>` : ''}
      <div class="row muted"><span>${esc(fmtDate(v.createdAt))}</span><span>${v.amount > 0 ? '₹' + esc(v.amount.toLocaleString('en-IN')) : 'No fixed fee'}</span></div>
      ${v.razorpayPaymentId ? `<div class="muted">Payment ID: ${esc(v.razorpayPaymentId)}</div>` : ''}
      ${v.paymentMethod === 'upi' && v.paymentStatus !== 'paid' ? `<div class="muted">UPI note to look for: <b>Visit ${v.id}</b></div>` : ''}
      ${v.upiRef ? `<div class="muted">UTR given by patient: <b>${esc(v.upiRef)}</b></div>` : ''}
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
      <td><button class="link" data-del="${p.id}">Delete</button></td></tr>`;
  }).join('') || '<tr><td colspan="8" class="empty">No patients yet.</td></tr>';
}

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
  });
  es.addEventListener('visit-updated', (e) => {
    const v = JSON.parse(e.data);
    const i = state.visits.findIndex((x) => x.id === v.id);
    if (i >= 0) state.visits[i] = v; else state.visits.unshift(v);
    renderVisits(v.id);
  });
  es.addEventListener('patient-added', loadPatientsQuietly);
  es.addEventListener('patient-deleted', loadPatientsQuietly);
}

async function loadPatientsQuietly() {
  try { state.patients = await api('/api/admin/patients'); renderPatients(); } catch {}
}

// ---------- UI wiring ----------
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('tab-visits').classList.toggle('hidden', t.dataset.tab !== 'visits');
  $('tab-patients').classList.toggle('hidden', t.dataset.tab !== 'patients');
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
