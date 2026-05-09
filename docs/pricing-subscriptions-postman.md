# Pricing, Subscription, and Payment APIs

Base URL: `http://localhost:5000/api/v1/pricing`

Use `Authorization: Bearer <access_token>` for all authenticated APIs.

For Stripe test payments in Postman, you can use a Stripe test payment method id such as `pm_card_visa`.

## 1. Get pricing config

`GET /`

Body: none

Optional query:

`role=investor`

`role=investee`

Example:

`GET /?role=investee`

## 2. Get public plan list

`GET /plans`

Optional query:

`role=investor`

`role=investee`

## 3. Superadmin create pricing config

`POST /`

```json
{
  "plans": [
    {
      "planType": "investor-basic",
      "audienceRole": "investor",
      "tier": "basic",
      "title": "Investor Basic",
      "description": "Essential access for investors",
      "currency": "usd",
      "pricePerMonth": 49,
      "discountMonthly": 0,
      "discountAnnually": 20,
      "features": [
        "Browse pitch listings (limited)",
        "View full pitch decks",
        "20 AI queries/month",
        "Watchlist up to 10 pitches",
        "Email support"
      ],
      "subscriptionTopics": [
        "Investor discovery",
        "Pitch deck access"
      ],
      "isActive": true
    },
    {
      "planType": "investor-pro",
      "audienceRole": "investor",
      "tier": "pro",
      "title": "Investor Pro",
      "description": "Advanced investor plan",
      "currency": "usd",
      "pricePerMonth": 99,
      "discountMonthly": 0,
      "discountAnnually": 20,
      "features": [
        "Full pitch listing access",
        "View full pitch decks",
        "Unlimited AI queries",
        "Unlimited watchlist",
        "Priority support",
        "Early access to new listings"
      ],
      "subscriptionTopics": [
        "Investor premium access",
        "Priority access"
      ],
      "isActive": true
    },
    {
      "planType": "investee-basic",
      "audienceRole": "investee",
      "tier": "basic",
      "title": "Investee Basic",
      "description": "Starter plan for investees",
      "currency": "usd",
      "pricePerMonth": 39,
      "discountMonthly": 0,
      "discountAnnually": 20,
      "features": [
        "Create profile",
        "Basic pitch listing",
        "Standard support"
      ],
      "subscriptionTopics": [
        "Startup listing",
        "Basic founder access"
      ],
      "isActive": true
    },
    {
      "planType": "investee-pro",
      "audienceRole": "investee",
      "tier": "pro",
      "title": "Investee Pro",
      "description": "Advanced plan for investees",
      "currency": "usd",
      "pricePerMonth": 79,
      "discountMonthly": 0,
      "discountAnnually": 20,
      "features": [
        "Premium pitch listing",
        "Priority visibility",
        "Advanced analytics",
        "Priority support"
      ],
      "subscriptionTopics": [
        "Founder growth",
        "Premium listing visibility"
      ],
      "isActive": true
    }
  ]
}
```

## 4. Superadmin update pricing config

`PATCH /:pricingId`

Use the same body shape as create:

```json
{
  "plans": [
    {
      "planType": "investor-basic",
      "audienceRole": "investor",
      "tier": "basic",
      "title": "Investor Basic",
      "description": "Updated essential access for investors",
      "currency": "usd",
      "pricePerMonth": 59,
      "discountMonthly": 5,
      "discountAnnually": 10,
      "features": [
        "Browse pitch listings (limited)",
        "View full pitch decks"
      ],
      "subscriptionTopics": [
        "Investor discovery"
      ],
      "isActive": true
    },
    {
      "planType": "investor-pro",
      "audienceRole": "investor",
      "tier": "pro",
      "title": "Investor Pro",
      "description": "Advanced investor plan",
      "currency": "usd",
      "pricePerMonth": 99,
      "discountMonthly": 0,
      "discountAnnually": 15,
      "features": [
        "Unlimited AI queries"
      ],
      "subscriptionTopics": [
        "Investor premium access"
      ],
      "isActive": true
    },
    {
      "planType": "investee-basic",
      "audienceRole": "investee",
      "tier": "basic",
      "title": "Investee Basic",
      "description": "Starter plan for investees",
      "currency": "usd",
      "pricePerMonth": 39,
      "discountMonthly": 0,
      "discountAnnually": 10,
      "features": [
        "Create profile"
      ],
      "subscriptionTopics": [
        "Startup listing"
      ],
      "isActive": true
    },
    {
      "planType": "investee-pro",
      "audienceRole": "investee",
      "tier": "pro",
      "title": "Investee Pro",
      "description": "Advanced plan for investees",
      "currency": "usd",
      "pricePerMonth": 79,
      "discountMonthly": 0,
      "discountAnnually": 15,
      "features": [
        "Premium pitch listing"
      ],
      "subscriptionTopics": [
        "Founder growth"
      ],
      "isActive": true
    }
  ]
}
```

The backend automatically calculates:

- `monthlyPrice`
- `annualPrice`

from:

- `pricePerMonth`
- `discountMonthly`
- `discountAnnually`

## 4A. Superadmin get all pricing cards separately

`GET /admin/plans`

Body: none

## 4B. Superadmin get one pricing card

`GET /admin/plans/:planType`

Valid `planType`:

- `investor-basic`
- `investor-pro`
- `investee-basic`
- `investee-pro`

Body: none

## 4C. Superadmin update one pricing card only

This is the API for the UI shown in your screenshot, where each card has its own save button.

`PATCH /admin/plans/:planType`

Example:

`PATCH /admin/plans/investor-basic`

```json
{
  "title": "Investor Basic",
  "description": "Essential access for investors",
  "currency": "usd",
  "pricePerMonth": 49,
  "discountMonthly": 5,
  "discountAnnually": 20,
  "features": [
    "Browse pitch listings (limited)",
    "View full pitch decks",
    "20 AI queries/month"
  ],
  "subscriptionTopics": [
    "Investor discovery",
    "Pitch deck access"
  ],
  "isActive": true
}
```

Another example:

`PATCH /admin/plans/investee-pro`

```json
{
  "title": "Investee Pro",
  "description": "Advanced plan for investees",
  "currency": "usd",
  "pricePerMonth": 79,
  "discountMonthly": 0,
  "discountAnnually": 15,
  "features": [
    "Premium pitch listing",
    "Priority visibility",
    "Advanced analytics",
    "Priority support"
  ],
  "subscriptionTopics": [
    "Founder growth",
    "Premium listing visibility"
  ],
  "isActive": true
}
```

## 5. Preview subscription before payment

Investor or investee only.

`POST /preview`

```json
{
  "planType": "investor-pro",
  "billingCycle": "monthly",
  "subscriptionTopic": "AI project investment access"
}
```

## 6. Create subscription with Stripe

Investor or investee only.

`POST /subscribe`

Example for investor:

```json
{
  "planType": "investor-pro",
  "billingCycle": "monthly",
  "paymentMethodId": "pm_card_visa",
  "subscriptionTopic": "AI project investment access",
  "billingAddress": {
    "fullName": "John Doe",
    "country": "US",
    "line1": "123 Main Street",
    "line2": "Suite 3",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001"
  }
}
```

Example for investee:

```json
{
  "planType": "investee-basic",
  "billingCycle": "annual",
  "paymentMethodId": "pm_card_visa",
  "subscriptionTopic": "Founders listing access",
  "billingAddress": {
    "fullName": "Jane Founder",
    "country": "GB",
    "line1": "456 Queen Street",
    "line2": "",
    "city": "London",
    "state": "",
    "postalCode": "SW1A 1AA"
  }
}
```

## 7. Change my plan

Investor or investee only.

`PATCH /my-subscription/change-plan`

```json
{
  "planType": "investor-pro",
  "billingCycle": "annual",
  "subscriptionTopic": "Upgrade to annual premium access"
}
```

## 8. Cancel my subscription at period end

Investor or investee only.

`PATCH /my-subscription/cancel`

```json
{}
```

## 9. Sync my subscription from Stripe

Investor or investee only.

`POST /my-subscription/sync`

```json
{}
```

## 10. Get my current subscription details

Investor or investee only.

`GET /my-subscription`

Body: none

## 11. Get my upcoming invoice

Investor or investee only.

`GET /my-upcoming-invoice`

Body: none

## 12. Get my payment history

Investor or investee only.

`GET /my-payments`

Optional query:

`status=paid`

`status=pending`

`status=failed`

## 13. Get my payment details

Investor or investee only.

`GET /my-payments/:invoiceId`

Body: none

## 14. Admin list all subscriptions and payment summary

Superadmin only.

`GET /admin/subscriptions`

Optional query:

`search=jake`

`status=active`

`status=past_due`

`status=suspended`

`role=investor`

`role=investee`

`planType=investee-pro`

`page=1`

`limit=10`

## 15. Admin get one subscription details page

Superadmin only.

This returns:

- user details
- current subscription details
- billing history
- upcoming invoice preview when available

`GET /admin/subscriptions/:subscriptionId`

Body: none

## 16. Admin suspend a subscription immediately

Superadmin only.

`POST /admin/subscriptions/:subscriptionId/suspend`

```json
{}
```

## 17. Admin sync a subscription from Stripe

Superadmin only.

`POST /admin/subscriptions/:subscriptionId/sync`

```json
{}
```

## 18. Stripe webhook

No auth header.

`POST /webhook`

This endpoint is for Stripe events such as:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Use Stripe webhook forwarding or Stripe CLI to test this endpoint.
