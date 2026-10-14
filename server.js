const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env'));

const express = require('express');
const multer = require('multer');
const { q, normalizePhone } = require('./src/db');
const otp = require('./src/otp');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const FEE_PAISE = Math.round(Number(process.env.CONSULTATION_FEE_INR || 500) * 100);
const CLINIC_NAME = process.env.CLINIC_NAME || 'NYL Clinic';
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const PAYMENTS_ENABLED = Boolean(RZP_KEY_ID && RZP_KEY_SECRET);
const OTP_ENABLED = process.env.OTP_ENABLED === 'true';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (ADMIN_PASSWORD === 'change-me') console.warn('WARNING: set ADMIN_PASSWORD in .env before going live.');
if (!PAYMENTS_ENABLED) console.warn('Razorpay keys not set: submissions will be recorded without payment.');
if (!OTP_ENABLED) console.log('OTP is off: patients go straight from phone number to the patient list.');
else if (otp.PROVIDER === 'console') console.warn('SMS_PROVIDER=console: OTP codes are printed here, not sent by SMS.');

const app = express();
app.set('trust proxy', true);

// ---------- Live updates to the admin dashboard (Server-Sent Events) ----------
const liveClients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of liveClients) res.write(msg);
}
setInterval(() => { for (const res of liveClients) res.write(': ping\n\n'); }, 25000).unref();

// ---------- Helpers ----------
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function requireAdmin(req, res, next) {
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const i = decoded.indexOf(':');
    if (safeEqual(decoded.slice(0, i), ADMIN_USER) && safeEqual(decoded.slice(i + 1), ADMIN_PASSWORD)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="NYL Admin", charset="UTF-8"').status(401).send('Authentication required');
}

// ---------- Patient phone sessions (set after OTP verification) ----------
const SESSION_COOKIE = 'nyl_session';

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function startSession(req, res, phone) {
  const { token, maxAge } = otp.createSession(phone);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge, path: '/' });
}

function requirePatient(req, res, next) {
  req.phone = otp.sessionPhone(readCookie(req, SESSION_COOKIE));
  if (!req.phone) return res.status(401).json({ error: 'Please verify your mobile number first.', needsLogin: true });
  next();
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function visitDto(v) {
  return v && {
    id: v.id,
    patientId: v.patient_id,
    patientName: v.patient_name,
    phone: v.patient_phone,
    age: v.patient_age,
    gender: v.patient_gender,
    problems: v.problems,
    photoUrl: v.photo_file ? `/uploads/${v.photo_file}` : null,
    amount: v.amount_paise / 100,
    paymentStatus: v.payment_status,
    razorpayOrderId: v.razorpay_order_id,
    razorpayPaymentId: v.razorpay_payment_id,
    createdAt: v.created_at,
    paidAt: v.paid_at,
  };
}

async function createRazorpayOrder(visitId) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64'),
    },
    body: JSON.stringify({ amount: FEE_PAISE, currency: 'INR', receipt: `visit_${visitId}`, notes: { visit_id: String(visitId) } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.description || `Razorpay order failed (${res.status})`);
  return body;
}

function markVisitPaid(visit, paymentId) {
  if (q.markPaid.run(paymentId, visit.id).changes) broadcast('visit-updated', visitDto(q.visitById.get(visit.id)));
}

// ---------- Uploads ----------
const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ALLOWED_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(Object.assign(new Error('Please upload a JPG, PNG, WEBP or HEIC photo.'), { status: 400 }));
  },
});

// ---------- Razorpay webhook (needs the raw body, so it is registered before express.json) ----------
app.post('/api/razorpay/webhook', express.raw({ type: '*/*' }), (req, res) => {
  if (!RZP_WEBHOOK_SECRET) return res.status(404).end();
  const expected = crypto.createHmac('sha256', RZP_WEBHOOK_SECRET).update(req.body).digest('hex');
  if (!safeEqual(expected, req.headers['x-razorpay-signature'] || '')) return res.status(400).send('Bad signature');

  const event = JSON.parse(req.body.toString());
  const payment = event.payload?.payment?.entity;
  if (payment?.order_id) {
    const visit = q.visitByOrder.get(payment.order_id);
    if (visit && (event.event === 'payment.captured' || event.event === 'order.paid')) markVisitPaid(visit, payment.id);
    if (visit && event.event === 'payment.failed' && q.markFailed.run(visit.id).changes) {
      broadcast('visit-updated', visitDto(q.visitById.get(visit.id)));
    }
  }
  res.json({ ok: true });
});

app.use(express.json({ limit: '100kb' }));

// ---------- Patient-facing API ----------
app.get('/api/config', (_req, res) => {
  res.json({ clinicName: CLINIC_NAME, fee: FEE_PAISE / 100, paymentsEnabled: PAYMENTS_ENABLED, otpEnabled: OTP_ENABLED });
});

app.post('/api/otp/send', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
    if (!OTP_ENABLED) {
      startSession(req, res, phone);
      return res.json({ phone, verified: true });
    }
    const { resendAfter } = await otp.sendOtp(phone, req.ip);
    res.json({ phone, sent: true, resendAfter });
  } catch (err) {
    if (!err.status) {
      console.error('OTP send failed:', err.message);
      return res.status(502).json({ error: 'Could not send the code. Please try again.' });
    }
    next(err);
  }
});

app.post('/api/otp/verify', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  otp.verifyOtp(phone, req.body.code);
  startSession(req, res, phone);
  res.json({ phone, verified: true });
});

app.get('/api/session', requirePatient, (req, res) => res.json({ phone: req.phone }));

app.post('/api/logout', (req, res) => {
  otp.endSession(readCookie(req, SESSION_COOKIE));
  res.clearCookie(SESSION_COOKIE, { path: '/' }).json({ ok: true });
});

// Everything below only works for the phone number verified in this browser.
app.use(['/api/patients', '/api/visits'], requirePatient);

app.get('/api/patients', (req, res) => {
  res.json({ phone: req.phone, patients: q.patientsByPhone.all(req.phone) });
});

function createPatient(req, res) {
  const phone = normalizePhone(req.body.phone);
  const name = cleanText(req.body.name, 100);
  const age = req.body.age === '' || req.body.age == null ? null : Number(req.body.age);
  const gender = cleanText(req.body.gender, 20) || null;
  if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (age !== null && !(Number.isInteger(age) && age >= 0 && age <= 130)) return res.status(400).json({ error: 'Enter a valid age.' });

  const { lastInsertRowid } = q.insertPatient.run(phone, name, age, gender);
  const patient = q.patientById.get(lastInsertRowid);
  broadcast('patient-added', patient);
  res.status(201).json(patient);
}

app.post('/api/patients', (req, res) => {
  req.body.phone = req.phone;
  createPatient(req, res);
});

function ownPatient(req, id) {
  const p = q.patientById.get(Number(id));
  return p && p.phone === req.phone ? p : null;
}

function ownVisit(req) {
  const v = q.visitById.get(Number(req.params.id));
  return v && v.patient_phone === req.phone ? v : null;
}

app.get('/api/patients/:id', (req, res) => {
  const p = ownPatient(req, req.params.id);
  if (!p) return res.status(404).json({ error: 'Patient not found.' });
  res.json({ id: p.id, name: p.name, age: p.age, gender: p.gender, phone: p.phone });
});

// Saves the photo + problems immediately so staff see them live. Payment happens next, on the /pay page.
app.post('/api/visits', upload.single('photo'), (req, res) => {
  const patient = ownPatient(req, req.body.patientId);
  const problems = cleanText(req.body.problems, 5000);
  if (!patient || !problems || !req.file) {
    if (req.file) fs.rm(req.file.path, () => {});
    return res.status(400).json({ error: !patient ? 'Patient not found.' : !problems ? 'Please describe your problems.' : 'Please upload a photo.' });
  }

  const status = PAYMENTS_ENABLED ? 'pending' : 'not_configured';
  const { lastInsertRowid: visitId } = q.insertVisit.run(patient.id, problems, req.file.filename, FEE_PAISE, status);
  broadcast('visit-created', visitDto(q.visitById.get(visitId)));
  res.status(201).json({ visitId });
});

// Summary shown on the payment page.
app.get('/api/visits/:id', (req, res) => {
  const v = ownVisit(req);
  if (!v) return res.status(404).json({ error: 'Visit not found.' });
  res.json({
    id: v.id, patientName: v.patient_name, age: v.patient_age, gender: v.patient_gender, problems: v.problems,
    amount: v.amount_paise / 100, paymentStatus: v.payment_status, paymentsEnabled: PAYMENTS_ENABLED,
  });
});

// Creates a Razorpay order for the visit (called when the patient taps Pay, and again on retry).
app.post('/api/visits/:id/order', async (req, res, next) => {
  try {
    const visit = ownVisit(req);
    if (!visit) return res.status(404).json({ error: 'Visit not found.' });
    if (visit.payment_status === 'paid') return res.status(409).json({ error: 'Already paid.' });
    if (!PAYMENTS_ENABLED) return res.status(400).json({ error: 'Payments are not configured.' });
    let order;
    try {
      order = await createRazorpayOrder(visit.id);
    } catch (err) {
      console.error('Razorpay order creation failed:', err.message);
      return res.status(502).json({ error: 'Could not start the payment. Please check your internet connection and try again.' });
    }
    q.setVisitOrder.run(order.id, visit.id);
    res.json({
      keyId: RZP_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency, name: CLINIC_NAME,
      prefill: { name: visit.patient_name, contact: `+91${visit.patient_phone}` },
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/visits/:id/verify', (req, res) => {
  const visit = ownVisit(req);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!visit || !PAYMENTS_ENABLED || !orderId || !paymentId || !signature || orderId !== visit.razorpay_order_id) {
    return res.status(400).json({ error: 'Invalid payment details.' });
  }
  const expected = crypto.createHmac('sha256', RZP_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  if (!safeEqual(expected, signature)) return res.status(400).json({ error: 'Payment verification failed.' });

  markVisitPaid(visit, paymentId);
  res.json({ ok: true });
});

app.post('/api/visits/:id/failed', (req, res) => {
  const visit = ownVisit(req);
  if (visit && q.markFailed.run(visit.id).changes) broadcast('visit-updated', visitDto(q.visitById.get(visit.id)));
  res.json({ ok: true });
});

// ---------- Admin (password protected) ----------
app.use(['/admin', '/api/admin', '/uploads'], requireAdmin);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h' }));

app.get('/api/admin/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  liveClients.add(res);
  req.on('close', () => liveClients.delete(res));
});

app.get('/api/admin/visits', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json(q.recentVisits.all(limit).map(visitDto));
});

app.get('/api/admin/patients', (_req, res) => res.json(q.allPatients.all()));

app.post('/api/admin/patients', createPatient);

app.delete('/api/admin/patients/:id', (req, res) => {
  const id = Number(req.params.id);
  const photos = q.photosForPatient.all(id);
  q.deletePatient.run(id);
  for (const { photo_file } of photos) fs.rm(path.join(UPLOAD_DIR, photo_file), () => {});
  broadcast('patient-deleted', { id });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------- Errors ----------
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 15 MB).' : err.message });
  }
  if (!err.status) console.error(err);
  if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.', retryAfter: err.retryAfter });
});

app.listen(PORT, () => {
  console.log(`Patient app:     http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
  // Set by the start-windows.bat / start-mac.command scripts: open the browser once the server is ready.
  if (process.env.OPEN_BROWSER) {
    const url = `http://localhost:${PORT}`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    require('node:child_process').exec(cmd, () => {});
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Either the app is already running in another window`);
    console.error(`(just open http://localhost:${PORT}), or another program uses it: set PORT=3001 in .env and restart.\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
