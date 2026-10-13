const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'nyl.db');
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
    payment_status       TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | not_configured
    razorpay_order_id    TEXT,
    razorpay_payment_id  TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at              TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_visits_order ON visits(razorpay_order_id);
`);

// Store phone numbers as the 10-digit Indian mobile number so "+91 98765 43210",
// "098765 43210" and "9876543210" all match the same patients.
function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}

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
    INSERT INTO visits (patient_id, problems, photo_file, amount_paise, payment_status)
    VALUES (?, ?, ?, ?, ?)`),
  setVisitOrder: db.prepare('UPDATE visits SET razorpay_order_id = ? WHERE id = ?'),
  markPaid: db.prepare(`
    UPDATE visits SET payment_status = 'paid', razorpay_payment_id = ?, paid_at = datetime('now')
    WHERE id = ? AND payment_status != 'paid'`),
  markFailed: db.prepare(`UPDATE visits SET payment_status = 'failed' WHERE id = ? AND payment_status = 'pending'`),
  visitById: db.prepare(`${VISIT_SELECT} WHERE v.id = ?`),
  visitByOrder: db.prepare(`${VISIT_SELECT} WHERE v.razorpay_order_id = ?`),
  recentVisits: db.prepare(`${VISIT_SELECT} ORDER BY v.id DESC LIMIT ?`),
};

module.exports = { db, q, normalizePhone };
