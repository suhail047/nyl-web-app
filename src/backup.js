// Excel backups of patients and sessions (no photos): on demand from the dashboard, and daily at 11:30 PM IST.
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { db, DB_PATH } = require('./db');
const plan = require('./plan');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(DB_PATH), 'backups');
const KEEP_DAYS = 365;
const DAILY_AT = { hour: 23, minute: 30 }; // Indian time

const IST = (col) => `strftime('%Y-%m-%d %H:%M', ${col}, '+5 hours', '+30 minutes')`;
const STATUS = { paid: 'Paid', pending: 'Payment pending', upi_claimed: 'Patient says paid (to confirm)', failed: 'Not received', not_configured: 'Pay at clinic' };

function istDate(d = new Date()) {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const patients = wb.addWorksheet('Patients', { views: [{ state: 'frozen', ySplit: 1 }] });
  patients.columns = [
    { header: 'Patient ID', key: 'id', width: 11 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Age', key: 'age', width: 7 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Registered (IST)', key: 'registered', width: 18 },
    { header: 'Sessions', key: 'visits', width: 9 },
    { header: 'Last session (IST)', key: 'last_visit', width: 18 },
    { header: 'Your notes', key: 'notes', width: 50 },
  ];
  patients.addRows(db.prepare(`
    SELECT p.id, p.phone, p.name, p.age, p.gender, ${IST('p.created_at')} AS registered, p.notes,
           COUNT(v.id) AS visits, ${IST('MAX(v.created_at)')} AS last_visit
    FROM patients p LEFT JOIN visits v ON v.patient_id = p.id
    GROUP BY p.id ORDER BY p.phone, p.name`).all());

  const visits = wb.addWorksheet('Sessions', { views: [{ state: 'frozen', ySplit: 1 }] });
  visits.columns = [
    { header: 'Ref no.', key: 'id', width: 9 },
    { header: 'Date (IST)', key: 'date', width: 18 },
    { header: 'Patient ID', key: 'patient_id', width: 11 },
    { header: 'Patient name', key: 'name', width: 24 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Session type', key: 'kind', width: 13 },
    { header: 'Healing plan', key: 'plan', width: 14 },
    { header: 'Course no.', key: 'block_no', width: 10 },
    { header: 'Problems / positive changes', key: 'problems', width: 50 },
    { header: 'Treatments tried', key: 'treatments_tried', width: 36 },
    { header: 'Medicines taking now', key: 'current_medicines', width: 36 },
    { header: 'Amount (₹)', key: 'amount', width: 11 },
    { header: 'Payment status', key: 'status', width: 28 },
    { header: 'Payment method', key: 'payment_method', width: 15 },
    { header: 'UPI transaction ID', key: 'upi_ref', width: 20 },
    { header: 'Razorpay payment ID', key: 'razorpay_payment_id', width: 22 },
    { header: 'Paid at (IST)', key: 'paid_at', width: 18 },
    { header: 'Consent given (IST)', key: 'consent_at', width: 18 },
  ];
  const rows = db.prepare(`
    SELECT v.id, ${IST('v.created_at')} AS date, v.patient_id, p.name, p.phone, v.visit_kind, v.phase, v.session_no, v.block_no, v.problems,
           v.treatments_tried, v.current_medicines, v.amount_paise, v.payment_status, v.payment_method, v.upi_ref,
           v.razorpay_payment_id, ${IST('v.paid_at')} AS paid_at, ${IST('v.consent_at')} AS consent_at
    FROM visits v JOIN patients p ON p.id = v.patient_id ORDER BY p.phone, p.name, v.id`).all();
  visits.addRows(rows.map((r) => ({
    ...r,
    kind: r.visit_kind === 'followup' ? 'Follow-up' : 'First session',
    plan: r.session_no ? plan.label(r.phase, r.session_no) : null,
    amount: r.amount_paise ? r.amount_paise / 100 : null,
    status: STATUS[r.payment_status] || r.payment_status,
  })));
  visits.getColumn('problems').alignment = { wrapText: true, vertical: 'top' };
  visits.getColumn('treatments_tried').alignment = { wrapText: true, vertical: 'top' };
  visits.getColumn('current_medicines').alignment = { wrapText: true, vertical: 'top' };

  for (const ws of [patients, visits]) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F2E6' } };
    ws.getColumn('phone').numFmt = '@';
  }
  return wb;
}

async function exportBuffer() {
  return (await buildWorkbook()).xlsx.writeBuffer();
}

async function writeDailyBackup(date = istDate()) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `backup-${date}.xlsx`);
  await (await buildWorkbook()).xlsx.writeFile(file);
  const cutoff = istDate(new Date(Date.now() - KEEP_DAYS * 86400 * 1000));
  for (const f of listBackups()) if (f.date < cutoff) fs.rmSync(path.join(BACKUP_DIR, f.name), { force: true });
  return file;
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((n) => /^backup-\d{4}-\d{2}-\d{2}\.xlsx$/.test(n))
    .map((name) => ({ name, date: name.slice(7, 17), size: fs.statSync(path.join(BACKUP_DIR, name)).size }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function backupPath(name) {
  return /^backup-\d{4}-\d{2}-\d{2}\.xlsx$/.test(name) ? path.join(BACKUP_DIR, name) : null;
}

// Checks every minute; after 11:30 PM IST writes today's backup once (also catches up if the server was off then).
function startDailyBackups() {
  const tick = () => {
    const now = new Date(Date.now() + 5.5 * 3600 * 1000);
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const today = now.toISOString().slice(0, 10);
    const yesterday = istDate(new Date(Date.now() - 86400 * 1000));
    const have = new Set(listBackups().map((b) => b.date));
    const due = minutes >= DAILY_AT.hour * 60 + DAILY_AT.minute ? today : have.has(yesterday) || !have.size ? null : yesterday;
    if (due && !have.has(due)) {
      writeDailyBackup(due).then((f) => console.log('Daily backup written:', f)).catch((e) => console.error('Daily backup failed:', e));
    }
  };
  setInterval(tick, 60 * 1000).unref();
  tick();
}

module.exports = { exportBuffer, writeDailyBackup, listBackups, backupPath, startDailyBackups, istDate, BACKUP_DIR };
