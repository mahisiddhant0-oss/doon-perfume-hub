# Doon Perfume Hub Launch Runbook (Public Launch)

Target launch date: Sunday, April 26, 2026
Stack: Vercel (frontend) + Render/Railway (backend)

## 1) Release Scope (Freeze)
- Include only buyer-critical and ops-critical flows for launch.
- Defer non-blocking UI polish and non-critical admin enhancements.
- No new features after freeze unless required to fix launch blockers.

## 2) Production Environment Setup

### Backend
Use values from `backend/.env.production.example`.

Mandatory production variables:
- `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `DELHIVERY_TOKEN`, `TWILIO_*`
- `SMTP_*`, `ADMIN_EMAIL` only when `EMAIL_NOTIFICATIONS_ENABLED=true`

Notes:
- `NODE_ENV=production`
- `FRONTEND_URL` should include your exact web domains
- No placeholder values (the backend now rejects placeholders in production)
- Set `EMAIL_NOTIFICATIONS_ENABLED=false` if SMTP is not ready yet

### Frontend
Use values from `frontend/.env.production.example`.

Mandatory production variables:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_ACCESS_USERNAME`
- `ADMIN_ACCESS_PASSWORD`

## 3) Deployment Sequence
1. Deploy backend first on Render/Railway.
2. Verify backend:
   - `GET /health` returns `status: ok`
   - `GET /api/products` returns data
3. Configure Razorpay webhook:
   - URL: `https://api.doonperfumehub.com/api/webhooks/razorpay`
   - Event: `payment.captured`
4. Deploy frontend on Vercel.
5. Connect DNS + SSL:
   - `doonperfumehub.com` and `www.doonperfumehub.com` -> frontend
   - `api.doonperfumehub.com` -> backend

## 4) Smoke Tests (Must Pass)

### Backend smoke test
Run from `backend`:

```bash
npm run smoke:test
```

Optional OTP smoke:

```bash
SMOKE_TEST_PHONE=+91XXXXXXXXXX npm run smoke:test
```

### Frontend smoke test
Run from `frontend`:

```bash
npm run smoke:test
```

Optional deployed URL:

```bash
FRONTEND_BASE_URL=https://doonperfumehub.com npm run smoke:test
```

## 5) Manual End-to-End Checks
- Browse homepage, products list, product details, cart, checkout.
- Search with a very long string and confirm no crash.
- OTP login: valid phone + invalid OTP + valid OTP.
- Order flow: payment success -> success page -> order/payment status updated.
- Webhook replay safety: duplicate event should not duplicate side effects.
- Admin lock: `/admin` challenges for password when unauthenticated.
- Notification checks: one order sends both customer/admin email and SMS.

## 6) Go/No-Go Checklist
- [ ] All production envs populated, no placeholder values
- [ ] Health endpoint green in production
- [ ] Payment + webhook success tested live
- [ ] OTP tested live on real number
- [ ] Admin route protection verified
- [ ] Logs monitored for 60+ minutes post-launch

If any critical check fails, pause launch, patch only blocker, rerun affected smoke tests.

## 7) Security and Rollback
- Rotate any exposed secrets immediately (Mongo, JWT, Razorpay, Twilio, SMTP).
- Keep last known good deploy available for rollback.
- On rollback, verify:
  - `/health`
  - checkout creation
  - webhook ingestion
