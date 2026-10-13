# NYL Patient Intake

A small web app for patient check-in:

1. **Phone number** – patient enters the mobile number their family is registered under.
2. **Select patient** – all names registered under that number are listed (a new name can be added).
3. **Photo, problems & payment** – patient takes/uploads a photo, describes their problems/diseases,
   and pays the consultation fee through **Razorpay**.

The **admin dashboard** (`/admin`, password protected) shows every submission **live**: the moment a
patient taps *Upload & Pay*, their photo, name, phone and problems appear on the dashboard (with a sound,
a browser notification and a highlight), and the payment badge flips to *Paid* when Razorpay confirms.
Staff can also add/delete patients and phone numbers there.

## Tech

- Node.js ≥ 22.13, Express 5, Multer (uploads)
- SQLite via Node's built-in `node:sqlite` (file: `data/nyl.db`) – no database server needed
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

## Razorpay setup

1. In the Razorpay Dashboard → *Account & Settings → API Keys*, generate keys (use **Test mode** first)
   and put them in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. Set `CONSULTATION_FEE_INR` to the fee.
3. Recommended: add a webhook pointing to `https://<your-domain>/api/razorpay/webhook` for the events
   `payment.captured`, `order.paid` and `payment.failed`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
   This marks visits paid even if the patient closes the browser right after paying.

Payment flow: the photo and problems are saved first (so staff see them immediately), the server creates a
Razorpay order, Razorpay Checkout opens, and the server verifies the payment signature before marking the
visit *Paid*. If the patient closes the payment window they get a "Try payment again" button.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/patients?phone=` | Patients registered under a number |
| POST | `/api/patients` | Register a new patient `{phone, name, age, gender}` |
| POST | `/api/visits` | Multipart: `patientId`, `problems`, `photo` → saves + creates Razorpay order |
| POST | `/api/visits/:id/verify` | Verify Razorpay checkout signature |
| POST | `/api/visits/:id/order` | New order to retry payment |
| POST | `/api/razorpay/webhook` | Razorpay webhook |
| GET | `/api/admin/visits`, `/api/admin/patients` | Admin data (Basic auth) |
| GET | `/api/admin/stream` | Live event stream (Basic auth) |

## Deploying

Run behind HTTPS (required for the camera on phones and for Razorpay in live mode), e.g. on a VPS with
nginx/Caddy, Render, Railway or Fly.io. Keep `data/` and `uploads/` on a persistent disk and back them up.
If you use nginx, disable buffering for `/api/admin/stream` so live updates are not delayed.

## Notes / next steps

- Anyone who knows a phone number can see the names registered under it. If that matters, add an
  OTP check on the phone page (e.g. MSG91 / Twilio) before showing names.
- Photos are health data – keep the admin password strong and the server on HTTPS.
