// Healing plan: a 12-day daily course, then weekly healing for 12 weeks, then another 12-day course, and so on.
// After a daily course the admin can choose "another 12 days" instead of weekly (patients.next_block = 'daily'),
// or restart a patient at Day 1 of a new course from their next visit (next_block = 'restart').
// Sessions are counted per upload (one per Indian calendar day), so a skipped day does not break the count.
const { db, q } = require('./db');

const SESSIONS = 12;
const DAY_MS = 86400000;
const RESTART_AFTER_DAYS = 21; // a gap of more than three weeks starts a new 12-day course at Day 1

// "YYYY-MM-DD" in Indian time, for a UTC "YYYY-MM-DD HH:MM:SS" database timestamp or a Date.
function istDay(value = new Date()) {
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value).replace(' ', 'T') + 'Z');
  return new Date(t + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

function addDays(day, n) {
  return new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
}

// The plan step for a new visit, given the patient's previous visit.
function nextStep(prev, nextBlock, today = istDay()) {
  if (!prev || !prev.session_no) return { phase: 'daily', session: 1, block: 1 };
  const same = { phase: prev.phase, session: prev.session_no, block: prev.block_no };
  if (istDay(prev.created_at) === today) return same; // a second upload on the same day is the same session
  if (daysBetween(istDay(prev.created_at), today) > RESTART_AFTER_DAYS) {
    return { phase: 'daily', session: 1, block: prev.block_no + 1, consumed: nextBlock === 'restart' };
  }
  if (nextBlock === 'restart') return { phase: 'daily', session: 1, block: prev.block_no + 1, consumed: true };
  if (prev.session_no < SESSIONS) return { ...same, session: prev.session_no + 1 };
  if (prev.phase === 'daily') {
    return nextBlock === 'daily'
      ? { phase: 'daily', session: 1, block: prev.block_no + 1, consumed: true }
      : { phase: 'weekly', session: 1, block: prev.block_no + 1 };
  }
  return { phase: 'daily', session: 1, block: prev.block_no + 1 };
}

function label(phase, session) {
  return phase === 'weekly' ? `Week ${session} of ${SESSIONS}` : `Day ${session} of ${SESSIONS}`;
}

// What comes after this visit, for the patient's confirmation page and the admin's Progress view.
function upcoming(visit, nextBlock) {
  const day = istDay(visit.created_at);
  const step = nextStep(visit, nextBlock, addDays(day, 1));
  const gap = step.phase === 'weekly' || (visit.phase === 'weekly' && step.session === 1) ? 7 : 1;
  const finished = visit.session_no === SESSIONS
    ? (visit.phase === 'weekly' ? 'Your 12 weeks of weekly healing are complete.' : 'Your 12-day healing course is complete.')
    : null;
  const next = step.phase === 'weekly' && step.session === 1
    ? 'Next: weekly healing for 12 weeks'
    : step.session === 1 ? 'Next: a new 12-day healing course' : null;
  return { label: label(step.phase, step.session), date: addDays(day, gap), gap, finished, next, phase: step.phase };
}

// Number every visit that predates the plan feature, in order, per patient.
function backfill() {
  const todo = db.prepare('SELECT DISTINCT patient_id FROM visits WHERE session_no IS NULL').all();
  if (!todo.length) return;
  const rows = db.prepare('SELECT id, patient_id, created_at FROM visits WHERE patient_id = ? ORDER BY id');
  const set = db.prepare('UPDATE visits SET phase = ?, session_no = ?, block_no = ? WHERE id = ?');
  for (const { patient_id } of todo) {
    let prev = null;
    for (const v of rows.all(patient_id)) {
      const s = nextStep(prev, null, istDay(v.created_at));
      set.run(s.phase, s.session, s.block, v.id);
      prev = { ...v, phase: s.phase, session_no: s.session, block_no: s.block };
    }
  }
}

module.exports = { SESSIONS, RESTART_AFTER_DAYS, istDay, addDays, nextStep, label, upcoming, backfill };
