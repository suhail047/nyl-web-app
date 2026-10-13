// Phone verification by one-time password (OTP) sent over SMS.
const crypto = require('node:crypto');
const { q } = require('./db');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_MS = 30 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_SENDS_PER_IP_PER_HOUR = 20;

const env = process.env;
const PROVIDER = (env.SMS_PROVIDER || 'console').toLowerCase();

// Each provider sends `code` to the 10-digit Indian mobile number `phone`.
const providers = {
  // Development only: prints the code in the server log instead of sending an SMS.
  async console(phone, code) {
    console.log(`[OTP] ${code} for +91${phone} (SMS_PROVIDER=console, no SMS sent)`);
  },

  // https://docs.msg91.com/reference/send-otp  (needs a DLT-approved OTP template)
  async msg91(phone, code) {
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.search = new URLSearchParams({ template_id: env.MSG91_TEMPLATE_ID, mobile: `91${phone}`, otp: code, otp_expiry: '5' });
    const res = await fetch(url, { method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.type === 'error') throw new Error(`MSG91: ${body.message || res.status}`);
  },

  // https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}/{template}
  async '2factor'(phone, code) {
    const parts = [env.TWOFACTOR_API_KEY, 'SMS', `91${phone}`, code, env.TWOFACTOR_TEMPLATE].filter(Boolean).map(encodeURIComponent);
    const res = await fetch(`https://2factor.in/API/V1/${parts.join('/')}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.Status !== 'Success') throw new Error(`2Factor: ${body.Details || res.status}`);
  },

  // https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource
  async twilio(phone, code) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64') },
      body: new URLSearchParams({
        To: `+91${phone}`,
        From: env.TWILIO_FROM,
        Body: `${code} is your ${env.CLINIC_NAME || 'clinic'} verification code. It expires in 5 minutes.`,
      }),
    });
    if (!res.ok) throw new Error(`Twilio: ${(await res.json().catch(() => ({}))).message || res.status}`);
  },
};

if (!providers[PROVIDER]) throw new Error(`Unknown SMS_PROVIDER "${PROVIDER}". Use one of: ${Object.keys(providers).join(', ')}`);

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const httpError = (status, message, extra) => Object.assign(new Error(message), { status, ...extra });

// In-memory per-IP limit so one client can't spam SMS to many different numbers.
const ipSends = new Map();
function checkIpLimit(ip) {
  const now = Date.now();
  const entry = ipSends.get(ip);
  if (!entry || now - entry.start > 3600_000) return ipSends.set(ip, { start: now, count: 1 });
  if (++entry.count > MAX_SENDS_PER_IP_PER_HOUR) throw httpError(429, 'Too many requests. Please try again later.');
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of ipSends) if (now - e.start > 3600_000) ipSends.delete(ip);
  q.purgeSessions.run(now);
}, 600_000).unref();

async function sendOtp(phone, ip) {
  const now = Date.now();
  const existing = q.getOtp.get(phone);
  if (existing && now - existing.last_sent_at < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (now - existing.last_sent_at)) / 1000);
    throw httpError(429, `Please wait ${wait} seconds before requesting a new code.`, { retryAfter: wait });
  }
  const sameWindow = existing && now - existing.window_start < 3600_000;
  if (sameWindow && existing.sends_in_window >= MAX_SENDS_PER_HOUR) {
    throw httpError(429, 'Too many codes requested for this number. Please try again in an hour.');
  }
  checkIpLimit(ip);

  const code = String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  await providers[PROVIDER](phone, code);
  q.upsertOtp.run(phone, hash(salt + code), salt, now + OTP_TTL_MS, now,
    sameWindow ? existing.window_start : now, sameWindow ? existing.sends_in_window + 1 : 1);
  return { resendAfter: RESEND_AFTER_MS / 1000 };
}

function verifyOtp(phone, code) {
  const row = q.getOtp.get(phone);
  if (!row || row.expires_at < Date.now()) throw httpError(400, 'This code has expired. Please request a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw httpError(429, 'Too many wrong attempts. Please request a new code.');
  q.bumpOtpAttempts.run(phone);
  const given = hash(row.salt + String(code || '').replace(/\D/g, ''));
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(row.code_hash))) {
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw httpError(400, left > 0 ? `Incorrect code. ${left} attempt${left > 1 ? 's' : ''} left.` : 'Too many wrong attempts. Please request a new code.');
  }
  q.expireOtp.run(phone); // single use
}

function createSession(phone) {
  const token = crypto.randomBytes(32).toString('base64url');
  q.insertSession.run(hash(token), phone, Date.now() + SESSION_TTL_MS);
  return { token, maxAge: SESSION_TTL_MS };
}

function sessionPhone(token) {
  return token ? q.getSession.get(hash(token), Date.now())?.phone || null : null;
}

function endSession(token) {
  if (token) q.deleteSession.run(hash(token));
}

module.exports = { PROVIDER, sendOtp, verifyOtp, createSession, sessionPhone, endSession };
