# Suhail's Healing

A small web app for patient check-in:

1. **Phone number** – patient enters the mobile number their family is registered under (optionally
   verified with a 6-digit SMS code – see *OTP* below; off by default).
2. **Select patient** – all names registered under that (verified) number are listed (a new name can be added).
3. **Photo & questions** – patient takes/uploads a photo. On the first visit they answer: problems faced,
   treatments already tried, and medicines they are taking now. If their last healing was on an earlier day
   within the past 7 days, they are instead asked about the *positive changes they are feeling after their
   last healing*. After more than a week without a healing, the first-visit questions are asked again.
4. **Payment** – right after the upload, a payment page shows a **UPI QR code** (default UPI ID
   `suhailbinalionline-2@oksbi`) with an amount box the patient fills in – no fee or minimum is shown.
5. **Done** – "Photo successfully submitted for treatment. Treatment will start at 10 PM IST", followed by
   the five rules for the patient to follow.

The **admin dashboard** (`/admin`, password protected) shows every submission **live**: the moment a
patient taps *Upload & Pay*, their photo, name, phone and problems appear on the dashboard (with a sound,
a browser notification and a highlight), and the payment badge flips to *Paid* when Razorpay confirms.
Staff can also add/delete patients and phone numbers there.

## Tech

- Node.js ≥ 22.13, Express 5, Multer (uploads)
- SQLite via Node's built-in `node:sqlite` (file: `data/app.db`) – no database server needed
- Photos stored in `uploads/` and served only to logged-in admins
- Live updates via Server-Sent Events (`/api/admin/stream`)
- Plain HTML/CSS/JS frontend (no build step), mobile-first

## Run it

```bash
npm install
cp .env.example .env      # set ADMIN_PASSWORD and Razorpay keys
npm run seed              # optional: sample patients under 9876543210 and 9123456789
npm start
```

- Patient app: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin (user/password from `.env`)

Without Razorpay keys the app still works; submissions are recorded with status *No payment*.

## OTP (SMS verification)

**OTP is off by default.** When turned on, patient names are only shown after the phone number is verified with a one-time code. Once verified,
the browser stays signed in for 12 hours (HttpOnly cookie); every patient API checks that the patient or
visit belongs to the verified number.

Configure in `.env`:

| Setting | Meaning |
| --- | --- |
| `OTP_ENABLED` | `false` (default) or `true` to require SMS verification |
| `SMS_PROVIDER` | `console` (default, dev only: code printed in the server log), `msg91`, `2factor` or `twilio` |
| `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` | MSG91 OTP API |
| `TWOFACTOR_API_KEY`, `TWOFACTOR_TEMPLATE` | 2Factor.in SMS OTP API |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Twilio Messaging |

For Indian numbers, MSG91 and 2Factor are the usual choice; SMS in India needs a **DLT-registered sender
ID and OTP template**, which the provider helps you set up.

Limits: code valid 5 minutes, single use, 5 wrong attempts per code, resend after 30 s, max 5 codes per
number per hour and 20 per IP per hour.

## UPI QR payments (no payment gateway)

Set your clinic's UPI ID in `.env`:

```
UPI_ID=suhailbinalionline-2@oksbi
UPI_NAME=Suhail's Healing
```

The payment page then shows a QR code for the amount the patient enters (plus a *Pay with UPI app* button on phones).
The UPI note reads `Visit <number> <patient name>`, so it shows up in your UPI/bank statement.
A plain UPI QR can't confirm payment automatically, so the patient taps **I have paid** (optionally entering
the UTR), the dashboard shows *UPI – please confirm*, and staff click **Mark paid** or **Not received**
after checking their UPI app. A business/merchant UPI ID is more reliable than a personal one.

Amount: there is no default fee – the patient types the amount on the payment page and the QR updates
to match; the dashboard shows the amount the patient says they paid. To pre-fill a fee, set one in the
admin dashboard under **Settings** (or `CONSULTATION_FEE_INR` in `.env`); patients can still change it.

## Razorpay setup (alternative to UPI QR)

1. In the Razorpay Dashboard → *Account & Settings → API Keys*, generate keys (use **Test mode** first)
   and put them in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. Set `CONSULTATION_FEE_INR` to the fee.
3. Recommended: add a webhook pointing to `https://<your-domain>/api/razorpay/webhook` for the events
   `payment.captured`, `order.paid` and `payment.failed`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
   This marks visits paid even if the patient closes the browser right after paying.

Payment flow: the photo and problems are saved first (so staff see them immediately), then the patient
lands on the payment page. Tapping *Pay* makes the server create a Razorpay order, Razorpay Checkout opens, and the server verifies the payment signature before marking the
visit *Paid*. If the patient closes the payment window they can simply tap *Pay* again.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/otp/send` | Send OTP `{phone}` |
| POST | `/api/otp/verify` | Verify `{phone, code}` → sets session cookie |
| POST | `/api/logout` | End the patient session |
| GET | `/api/patients` | Patients under the verified number |
| POST | `/api/patients` | Register a new patient `{name, age, gender}` under the verified number |
| POST | `/api/visits` | Multipart: `patientId`, `problems`, `photo` → saves the visit |
| GET | `/api/visits/:id` | Visit summary for the payment page |
| POST | `/api/visits/:id/verify` | Verify Razorpay checkout signature |
| POST | `/api/visits/:id/order` | Create a Razorpay order for the visit |
| POST | `/api/razorpay/webhook` | Razorpay webhook |
| GET | `/api/admin/visits`, `/api/admin/patients` | Admin data (Basic auth) |
| GET | `/api/admin/stream` | Live event stream (Basic auth) |

## Deploying

The app keeps its database and photos on disk, so the host needs a **persistent disk** (free tiers that
wipe files on restart will lose data). It also needs HTTPS, which the hosts below provide.

**Render (easiest):** push this repo to GitHub, then in Render choose *New → Blueprint* and pick the repo.
`render.yaml` sets up a Starter web service in Singapore with a 1 GB disk at `/var/data`
(`DB_PATH=/var/data/app.db`, `UPLOAD_DIR=/var/data/uploads`) and asks for `ADMIN_PASSWORD`, `CLINIC_NAME`,
`UPI_ID` and `UPI_NAME`. Add a custom domain under the service's *Settings → Custom Domains*.

**Railway / Fly.io:** same idea – attach a volume and point `DB_PATH` and `UPLOAD_DIR` at it.

**Your own VPS (e.g. Hostinger KVM, Ubuntu 24.04):** copy the unzipped folder to the server and run

```bash
sudo bash deploy/setup-vps.sh yourdomain.com     # or without a domain: sudo bash deploy/setup-vps.sh
```

It installs Node.js 22 and Caddy (automatic HTTPS), copies the app to `/opt/patient-app`, keeps data in
`/var/lib/patient-app`, asks for the clinic name / admin password / UPI ID (saved in `/etc/patient-app.env`),
runs the app as a `systemd` service and turns on the firewall. Run it again after uploading a new version
to update; data and settings are kept. Logs: `sudo journalctl -u patient-app -f`.
If you use nginx instead, disable buffering for `/api/admin/stream` so live updates are not delayed.

## Notes / next steps

- Photos are health data – keep the admin password strong and the server on HTTPS.
