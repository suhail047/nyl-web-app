// Session reminders on WhatsApp.
// Every day the app works out which patients are due a session today. The admin's Reminders tab lists them with a
// "Send on WhatsApp" link (opens WhatsApp with the message ready). If a WhatsApp Business account is connected
// (Meta WhatsApp Cloud API: WHATSAPP_TOKEN + WHATSAPP_PHONE_ID and an approved template), the app also sends the
// reminders itself once a day at REMINDER_TIME (Indian time).
const { q } = require('./db');
const plan = require('./plan');

const env = process.env;
const TOKEN = (env.WHATSAPP_TOKEN || '').trim();
const PHONE_ID = (env.WHATSAPP_PHONE_ID || '').trim();
const TEMPLATE = (env.WHATSAPP_TEMPLATE || 'session_reminder').trim();
const TEMPLATE_LANG = (env.WHATSAPP_TEMPLATE_LANG || 'en').trim();
const API_VERSION = (env.WHATSAPP_API_VERSION || 'v21.0').trim();
const REMINDER_TIME = /^\d{1,2}:\d{2}$/.test(env.REMINDER_TIME || '') ? env.REMINDER_TIME : '18:00';
const ENABLED = Boolean(TOKEN && PHONE_ID);
const ACTIVE_DAYS = 14; // after a longer gap the patient restarts at Session 1, so stop reminding

// Patients whose next session is due today (or overdue, within the last two weeks) and who haven't uploaded today.
function dueToday(today = plan.istDay()) {
  const out = [];
  for (const v of q.lastVisitPerPatient.all()) {
    if (!v.session_no) continue;
    const lastDay = plan.istDay(v.created_at);
    if (lastDay >= today) continue; // already sent today's photo
    const gap = Math.round((Date.parse(today) - Date.parse(lastDay)) / 86400000);
    if (gap > ACTIVE_DAYS) continue;
    const next = plan.upcoming(v, v.next_block);
    if (next.date > today) continue; // e.g. weekly phase, not due yet
    out.push({
      patientId: v.patient_id,
      name: v.patient_name,
      phone: v.patient_phone,
      label: next.label,
      lastDay,
      remindersOff: Boolean(v.reminders_off),
      sent: q.reminderFor.get(v.patient_id, today) || null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function messageText(name, label, appUrl) {
  return `Hello ${name}, a reminder from ${env.CLINIC_NAME || "Suhail's Meridian Healing"}: please send your photo for ${label} ` +
    `before 10 PM IST today.${appUrl ? ' ' + appUrl : ''}`;
}

async function sendTemplate(phone, name, label) {
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: `91${phone}`,
      type: 'template',
      template: {
        name: TEMPLATE,
        language: { code: TEMPLATE_LANG },
        components: [{ type: 'body', parameters: [{ type: 'text', text: name }, { type: 'text', text: label }] }],
      },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `WhatsApp error ${res.status}`);
  }
}

// Send today's reminders (skips patients already reminded today or with reminders switched off).
async function runToday() {
  if (!ENABLED) throw Object.assign(new Error('WhatsApp is not connected.'), { status: 400 });
  const today = plan.istDay();
  const summary = { sent: 0, failed: 0, skipped: 0 };
  for (const d of dueToday(today)) {
    if (d.remindersOff || d.sent?.status === 'sent') { summary.skipped++; continue; }
    try {
      await sendTemplate(d.phone, d.name, d.label);
      q.logReminder.run(d.patientId, today, 'sent', null);
      summary.sent++;
    } catch (err) {
      q.logReminder.run(d.patientId, today, 'failed', err.message.slice(0, 300));
      summary.failed++;
    }
  }
  q.setSetting.run('reminders_last_run', JSON.stringify({ day: today, at: new Date().toISOString(), ...summary }));
  return summary;
}

// Checks every minute; sends once a day after REMINDER_TIME (and before the 10 PM session).
function startDailyReminders() {
  if (!ENABLED) return;
  const [h, m] = REMINDER_TIME.split(':').map(Number);
  const tick = () => {
    const now = new Date(Date.now() + 5.5 * 3600 * 1000);
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (minutes < h * 60 + m || minutes >= 22 * 60) return;
    const last = JSON.parse(q.getSetting.get('reminders_last_run')?.value || '{}');
    if (last.day === plan.istDay()) return;
    runToday().then((s) => console.log('WhatsApp reminders:', s)).catch((e) => console.error('WhatsApp reminders failed:', e.message));
  };
  setInterval(tick, 60 * 1000).unref();
  tick();
}

function status() {
  return {
    enabled: ENABLED,
    time: REMINDER_TIME,
    template: TEMPLATE,
    lastRun: JSON.parse(q.getSetting.get('reminders_last_run')?.value || 'null'),
  };
}

module.exports = { dueToday, messageText, runToday, startDailyReminders, status, ENABLED };
