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
```

## Authentication

Protected routes require:

```http
Authorization: Bearer <access_token>
```

Roles used by the platform:

- `investor`
- `investee`
- `superadmin`



