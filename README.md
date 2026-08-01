# Normas-Backend

Normas-Backend is the Express and MongoDB API service for Early-N. It provides authentication, role-based access, marketplace data, KYC, subscriptions, Stripe payments, messaging, notifications, moderation, analytics, and superadmin operations for the Normas frontend.

## What This API Provides

- User signup, signin, token refresh, logout, OTP, and password reset.
- Investor, investee, and superadmin role-based access control.
- KYC submission, review, and document upload support.
- Pitch/list creation, review, approval, saved lists, and public listing APIs.
- Stripe pricing, checkout, invoices, subscriptions, and webhook handling.
- Investment conversations, messages, and meeting requests.
- Support center conversations.
- Reports, moderation alerts, reviews, FAQs, legal content, schedules, notifications, and admin analytics.
- Superadmin admin notices with dashboard notifications and queued SES email delivery.
- Socket.IO server for real-time messages and notifications.

## Tech Stack

- Node.js 24 recommended, matching the Dockerfile
- Express 5
- MongoDB with Mongoose
- JSON Web Tokens
- bcryptjs
- Nodemailer
- AWS S3 SDK
- Stripe
- Socket.IO
- Multer

## Project Structure

```text
src/app.js                  Express app, middleware, route mounts, error handlers
src/server.js               HTTP server, database connection, Socket.IO startup
src/socket.js               Socket.IO configuration
src/config/                 Database configuration
src/middlewares/            Auth, optional auth, uploads, and KYC prechecks
src/modules/                Feature modules with models, routes, controllers, services
docs/                       Detailed integration notes for selected APIs
```

## Requirements

- Node.js 24 recommended
- npm
- MongoDB connection string
- SMTP credentials for OTP email
- Stripe secret and webhook secrets for payment flows
- AWS S3 credentials for profile, KYC, and list uploads

         # Currently no tests configured


## API Base Path

Most endpoints are mounted under:

```text
/api/v1
```

Route groups:

```text
POST /api/v1/pricing/webhook
POST /api/v1/payment/subscription/webhook

/api/v1/auth
/api/v1/kyc
/api/v1/lists
/api/v1/legal-contents
/api/v1/faqs
/api/v1/reviews
/api/v1/pricing
/api/v1/payment/subscription
/api/v1/reports
/api/v1/support
/api/v1/investment-conversations
/api/v1/schedules
/api/v1/admin/users
/api/v1/admin/analytics
/api/v1/notifications
/api/v1/moderation
/api/v1/super-admin/notices
/api/v1/investor/notices
/api/v1/investee/notices
```

## Admin Notice System

Superadmins can create dashboard notices with optional S3 images:

```http
POST /api/v1/super-admin/notices
Content-Type: multipart/form-data
```

Fields: `title`, `message`, `targetType` (`investor`, `investee`, or `all`), and optional `image`.

Notice endpoints:

```text
POST   /api/v1/super-admin/notices
GET    /api/v1/super-admin/notices
GET    /api/v1/super-admin/notices/:noticeId
PATCH  /api/v1/super-admin/notices/:noticeId
PATCH  /api/v1/super-admin/notices/:noticeId/archive
DELETE /api/v1/super-admin/notices/:noticeId
POST   /api/v1/super-admin/notices/:noticeId/retry-failed-emails
POST   /api/v1/super-admin/notices/images
DELETE /api/v1/super-admin/notices/images

GET    /api/v1/investor/notices
GET    /api/v1/investor/notices/:noticeId
PATCH  /api/v1/investor/notices/:noticeId/read

GET    /api/v1/investee/notices
GET    /api/v1/investee/notices/:noticeId
PATCH  /api/v1/investee/notices/:noticeId/read
```

By default, notice creation starts a short email queue drain automatically and stops when SQS is idle:

```env
NOTICE_AUTO_DRAIN_EMAIL_QUEUE=true
```

For higher-volume production deployments, you can disable auto-drain and run the email worker separately:

```bash
npm run notice-worker
```

To drain the current queue once and then stop:

```bash
npm run notice-worker-once
```

Recover notices that were created while the server or queue was interrupted:

```bash
npm run notice-dispatch
```

AWS requirements:

- `AWS_REGION`
- `AWS_S3_BUCKET` or `AWS_BUCKET_NAME`
- `AWS_S3_NOTICE_FOLDER=notices`
- `AWS_SQS_NOTICE_EMAIL_QUEUE_URL`
- `AWS_SQS_NOTICE_EMAIL_DLQ_URL` configured as the queue dead-letter target in AWS
- `AWS_SES_FROM_EMAIL=info@earlyn.com`
- `NOTICE_EMAIL_PROVIDER=auto` (`auto`, `ses`, or `smtp`)
- `NOTICE_SMTP_FROM_EMAIL` optional SMTP sender override
- `NOTICE_AUTO_DRAIN_EMAIL_QUEUE=true`
- `NOTICE_PENDING_REQUEUE_AFTER_MS=120000`
- `FRONTEND_URL`
- `NOTICE_WORKER_CONCURRENCY=5`

## Authentication

Protected routes require:

```http
Authorization: Bearer <access_token>
```

Roles used by the platform:

- `investor`
- `investee`
- `superadmin`
