# FollowBoost V1

FollowBoost is a global social growth platform that helps real people discover, connect, and grow across social media platforms.

## Included
- Responsive starter dashboard
- Points balance and daily check-in
- Tasks / Wallet / Referrals / Buy Points sections
- Signup API
- Login API
- One-account-per-email/device protection
- PostgreSQL schema
- Basic admin statistics endpoint

## Run
1. Install Node.js.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add your PostgreSQL `DATABASE_URL` and `ADMIN_KEY`.
4. Run `db/schema.sql` in PostgreSQL.
5. Run `npm start`.
6. Open the shown local URL.

This V1 is a foundation. Payment processing, production authentication/session tokens, task verification, moderation, and platform-specific integrations should be added before a public launch.