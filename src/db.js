const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');

// Earlier versions used data/nyl.db: keep using that data under the new name.
if (!process.env.DB_PATH && !fs.existsSync(DB_PATH) && fs.existsSync(path.join(DATA_DIR, 'nyl.db'))) {
  for (const ext of ['', '-wal', '-shm']) {
    const old = path.join(DATA_DIR, 'nyl.db' + ext);
    if (fs.existsSync(old)) fs.renameSync(old, DB_PATH + ext);
  }
}
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS patients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    phone       TEXT NOT NULL,
    name        TEXT NOT NULL,
    age         INTEGER,
    gender      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

  CREATE TABLE IF NOT EXISTS visits (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id           INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    problems             TEXT NOT NULL,
    photo_file           TEXT,
    amount_paise         INTEGER NOT NULL,
    payment_status       TEXT NOT NULL DEFAULT 'pending', -- pending | upi_claimed | paid | failed | not_configured
    razorpay_order_id    TEXT,
    razorpay_payment_id  TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at              TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_visits_order ON visits(razorpay_order_id);

  CREATE TABLE IF NOT EXISTS otp_codes (
    phone         TEXT PRIMARY KEY,
    code_hash     TEXT NOT NULL,
    salt          TEXT NOT NULL,
    expires_at    INTEGER NOT NULL,  -- unix ms
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_sent_at  INTEGER NOT NULL,
    window_start  INTEGER NOT NULL,  -- start of the hourly send-limit window
    sends_in_window INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT
  );

  CREATE TABLE IF NOT EXISTS patient_sessions (
    token_hash  TEXT PRIMARY KEY,
    phone       TEXT NOT NULL,
    expires_at  INTEGER NOT NULL     -- unix ms
  );
`);

// Store phone numbers as the 10-digit Indian mobile number so "+91 98765 43210",
// "098765 43210" and "9876543210" all match the same patients.
function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}

// Columns added after the first release.
const visitColumns = db.prepare('PRAGMA table_info(visits)').all().map((c) => c.name);
if (!visitColumns.includes('payment_method')) db.exec('ALTER TABLE visits ADD COLUMN payment_method TEXT');
if (!visitColumns.includes('upi_ref')) db.exec('ALTER TABLE visits ADD COLUMN upi_ref TEXT');
// 'first' = problems the patient is facing; 'followup' = positive changes since the previous healing.
if (!visitColumns.includes('treatments_tried')) db.exec('ALTER TABLE visits ADD COLUMN treatments_tried TEXT');
if (!visitColumns.includes('current_medicines')) db.exec('ALTER TABLE visits ADD COLUMN current_medicines TEXT');
if (!visitColumns.includes('consent_at')) db.exec('ALTER TABLE visits ADD COLUMN consent_at TEXT');
if (!visitColumns.includes('visit_kind')) db.exec("ALTER TABLE visits ADD COLUMN visit_kind TEXT NOT NULL DEFAULT 'first'");

const VISIT_SELECT = `
  SELECT v.*, p.name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender
  FROM visits v JOIN patients p ON p.id = v.patient_id`;

const q = {
  patientsByPhone: db.prepare('SELECT id, name, age, gender FROM patients WHERE phone = ? ORDER BY name'),
  patientById: db.prepare('SELECT * FROM patients WHERE id = ?'),
  insertPatient: db.prepare('INSERT INTO patients (phone, name, age, gender) VALUES (?, ?, ?, ?)'),
  photosForPatient: db.prepare('SELECT photo_file FROM visits WHERE patient_id = ? AND photo_file IS NOT NULL'),
  deletePatient: db.prepare('DELETE FROM patients WHERE id = ?'),
  allPatients: db.prepare(`
    SELECT p.*, COUNT(v.id) AS visit_count, MAX(v.created_at) AS last_visit
    FROM patients p LEFT JOIN visits v ON v.patient_id = p.id
    GROUP BY p.id ORDER BY p.phone, p.name`),
  insertVisit: db.prepare(`
    INSERT INTO visits (patient_id, problems, photo_file, amount_paise, payment_status, payment_method, visit_kind,
                        treatments_tried, current_medicines, consent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`),
  // True when the patient already sent a photo on an earlier day (Indian time).
  // A follow-up: the patient's last healing was on an earlier day, no more than 7 days ago (Indian time).
  hadRecentHealing: db.prepare(`
    SELECT 1 FROM visits WHERE patient_id = ?
      AND date(created_at, '+5 hours', '+30 minutes') <  date('now', '+5 hours', '+30 minutes')
      AND date(created_at, '+5 hours', '+30 minutes') >= date('now', '+5 hours', '+30 minutes', '-7 days') LIMIT 1`),
  markUpiClaimed: db.prepare(`
    UPDATE visits SET payment_status = 'upi_claimed', upi_ref = ? WHERE id = ? AND payment_status IN ('pending', 'failed')`),
  confirmPayment: db.prepare(`
    UPDATE visits SET payment_status = 'paid', paid_at = datetime('now') WHERE id = ? AND payment_status != 'paid'`),
  rejectPayment: db.prepare(`UPDATE visits SET payment_status = 'failed' WHERE id = ? AND payment_status = 'upi_claimed'`),
  setVisitOrder: db.prepare(`
    UPDATE visits SET razorpay_order_id = ?, payment_status = CASE payment_status WHEN 'paid' THEN 'paid' ELSE 'pending' END
    WHERE id = ?`),
  markPaid: db.prepare(`
    UPDATE visits SET payment_status = 'paid', razorpay_payment_id = ?, paid_at = datetime('now')
    WHERE id = ? AND payment_status != 'paid'`),
  markFailed: db.prepare(`UPDATE visits SET payment_status = 'failed' WHERE id = ? AND payment_status = 'pending'`),
  visitById: db.prepare(`${VISIT_SELECT} WHERE v.id = ?`),
  visitByOrder: db.prepare(`${VISIT_SELECT} WHERE v.razorpay_order_id = ?`),
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
  setVisitAmount: db.prepare(`UPDATE visits SET amount_paise = ? WHERE id = ? AND payment_status != 'paid'`),
  getOtp: db.prepare('SELECT * FROM otp_codes WHERE phone = ?'),
  upsertOtp: db.prepare(`
    INSERT INTO otp_codes (phone, code_hash, salt, expires_at, attempts, last_sent_at, window_start, sends_in_window)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, salt = excluded.salt, expires_at = excluded.expires_at,
      attempts = 0, last_sent_at = excluded.last_sent_at, window_start = excluded.window_start, sends_in_window = excluded.sends_in_window`),
  bumpOtpAttempts: db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?'),
  expireOtp: db.prepare('UPDATE otp_codes SET expires_at = 0 WHERE phone = ?'),
  insertSession: db.prepare('INSERT INTO patient_sessions (token_hash, phone, expires_at) VALUES (?, ?, ?)'),
  getSession: db.prepare('SELECT phone FROM patient_sessions WHERE token_hash = ? AND expires_at > ?'),
  deleteSession: db.prepare('DELETE FROM patient_sessions WHERE token_hash = ?'),
  purgeSessions: db.prepare('DELETE FROM patient_sessions WHERE expires_at <= ?'),
  recentVisits: db.prepare(`${VISIT_SELECT} ORDER BY v.id DESC LIMIT ?`),
};

module.exports = { db, q, normalizePhone };
