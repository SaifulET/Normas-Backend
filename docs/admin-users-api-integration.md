# Admin Users API Integration Guide

Base URL: `http://localhost:5000/api/v1/admin/users`

Use `Authorization: Bearer <superadmin_access_token>` for every request below.

All endpoints in this module are restricted to `superadmin`.

## Purpose

Use these APIs for the super-admin user information module:

- View all investor and investee users.
- See user profile image, name, Gmail/email, account type, joining date, and account status.
- Open a user details page with profile, profile KYC summary, submitted KYC information, and created pitches/features.
- Update user account status as `active`, `inactive`, or `pending`.

## Account Status Values

| Value | Meaning |
| --- | --- |
| `pending` | User is waiting for review or activation |
| `active` | User account is active |
| `inactive` | User account is inactive |

New users default to `pending`.

## 1. Get All Investor and Investee Users

`GET /`

Returns paginated users for the super-admin table.

### Query Parameters

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `page` | number | No | Default: `1` |
| `limit` | number | No | Default: `20`, max: `100` |
| `role` | string | No | `investor` or `investee` |
| `accountStatus` | string | No | `active`, `inactive`, or `pending` |
| `status` | string | No | Alias of `accountStatus` |
| `search` | string | No | Searches name, email, and mobile |

### Examples

All investor and investee users:

```http
GET /api/v1/admin/users
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

Only investors:

```http
GET /api/v1/admin/users?role=investor
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

Pending accounts:

```http
GET /api/v1/admin/users?accountStatus=pending
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

Search by name or Gmail:

```http
GET /api/v1/admin/users?search=saiful&page=1&limit=10
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Admin users fetched successfully",
  "data": {
    "users": [
      {
        "id": "USER_ID",
        "profileImage": "https://example.com/profile.jpg",
        "name": "Investor Name",
        "email": "investor@gmail.com",
        "gmail": "investor@gmail.com",
        "mobile": "+8801700000000",
        "accountType": "investor",
        "role": "investor",
        "country": "Bangladesh",
        "joiningDate": "2026-05-28T10:00:00.000Z",
        "accountStatus": "pending",
        "kycStatus": "approved",
        "pitchCount": 2,
        "createdAt": "2026-05-28T10:00:00.000Z",
        "updatedAt": "2026-05-28T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

## 2. Get Complete User Details

`GET /:userId`

Returns all information needed for the user details page: profile, profile KYC summary, full submitted KYC, and all created pitches/features.

### Example

```http
GET /api/v1/admin/users/USER_ID
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Admin user details fetched successfully",
  "data": {
    "profile": {
      "id": "USER_ID",
      "profileImage": "https://example.com/profile.jpg",
      "name": "Investee Name",
      "email": "investee@gmail.com",
      "gmail": "investee@gmail.com",
      "mobile": "+8801700000000",
      "accountType": "investee",
      "role": "investee",
      "country": "Bangladesh",
      "age": 30,
      "joiningDate": "2026-05-28T10:00:00.000Z",
      "accountStatus": "active",
      "taxPercentage": 0,
      "socialLinks": {},
      "createdAt": "2026-05-28T10:00:00.000Z",
      "updatedAt": "2026-05-28T10:00:00.000Z"
    },
    "profileKyc": {
      "profileImage": "https://example.com/profile.jpg",
      "status": "approved",
      "accountType": "investee",
      "role": "investee",
      "name": "Investee Name",
      "kycId": "KYC_ID",
      "currentStep": 4,
      "submittedAt": "2026-05-28T10:20:00.000Z",
      "updatedAt": "2026-05-28T10:30:00.000Z"
    },
    "kyc": {
      "_id": "KYC_ID",
      "user": "USER_ID",
      "role": "investee",
      "currentStep": 4,
      "status": "approved",
      "personalIdentity": {
        "fullLegalName": "Investee Legal Name",
        "dateOfBirth": "1996-01-01T00:00:00.000Z",
        "countryOfResidence": "Bangladesh",
        "identificationType": "passport",
        "identityDocument": "https://example.com/document.pdf"
      },
      "addressVerification": {
        "utilityBill": "https://example.com/utility.pdf",
        "bankStatement": "https://example.com/bank.pdf"
      },
      "faceVerification": {
        "facePhoto": "https://example.com/face.jpg",
        "verificationVideo": "https://example.com/video.mp4"
      },
      "sourceOfFunds": {
        "salarySlip": "",
        "businessDocument": "https://example.com/business.pdf",
        "taxReturns": "https://example.com/tax.pdf"
      },
      "approval": {
        "reviewedBy": {
          "_id": "SUPERADMIN_USER_ID",
          "name": "Admin Name",
          "email": "admin@example.com",
          "role": "superadmin"
        },
        "reviewedAt": "2026-05-28T10:30:00.000Z",
        "rejectionReason": null
      },
      "createdAt": "2026-05-28T10:20:00.000Z",
      "updatedAt": "2026-05-28T10:30:00.000Z"
    },
    "pitches": [
      {
        "_id": "PITCH_ID",
        "user": {
          "_id": "USER_ID",
          "name": "Investee Name",
          "email": "investee@gmail.com",
          "role": "investee",
          "profileImage": "",
          "accountStatus": "active"
        },
        "bannerImage": "https://example.com/banner.jpg",
        "title": "Startup Pitch",
        "country": "Bangladesh",
        "stage": "Seed",
        "sector": "Fintech",
        "fundingTarget": 50000,
        "keyword": "fintech,payments",
        "description": "Pitch description",
        "additionalDetails": [
          {
            "key": "Team",
            "value": "5 people"
          }
        ],
        "status": "activated",
        "viewCount": 20,
        "createdAt": "2026-05-28T11:00:00.000Z",
        "updatedAt": "2026-05-28T11:00:00.000Z"
      }
    ],
    "features": [
      {
        "_id": "PITCH_ID",
        "title": "Startup Pitch",
        "status": "activated"
      }
    ]
  }
}
```

`features` is returned as an alias of `pitches` for frontend pages that use the word features.

If the user has not submitted KYC, `kyc` is `null`, `profileKyc.status` is `not_submitted`, and KYC-specific fields are `null`.

## 3. Get User Profile and Profile KYC Summary

`GET /:userId/profile`

Use this for a profile tab or details header.

### Example

```http
GET /api/v1/admin/users/USER_ID/profile
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Admin user profile fetched successfully",
  "data": {
    "profile": {
      "id": "USER_ID",
      "profileImage": "",
      "name": "Investor Name",
      "email": "investor@gmail.com",
      "gmail": "investor@gmail.com",
      "mobile": "",
      "accountType": "investor",
      "role": "investor",
      "country": "Bangladesh",
      "age": 30,
      "joiningDate": "2026-05-28T10:00:00.000Z",
      "accountStatus": "pending",
      "taxPercentage": 0,
      "socialLinks": {},
      "createdAt": "2026-05-28T10:00:00.000Z",
      "updatedAt": "2026-05-28T10:00:00.000Z"
    },
    "profileKyc": {
      "profileImage": "",
      "status": "pending",
      "accountType": "investor",
      "role": "investor",
      "name": "Investor Name",
      "kycId": "KYC_ID",
      "currentStep": 4,
      "submittedAt": "2026-05-28T10:20:00.000Z",
      "updatedAt": "2026-05-28T10:20:00.000Z"
    }
  }
}
```

## 4. Get User Submitted KYC Information

`GET /:userId/kyc`

Use this for the KYC tab/page.

### Example

```http
GET /api/v1/admin/users/USER_ID/kyc
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Admin user KYC fetched successfully",
  "data": {
    "user": {
      "profileImage": "",
      "status": "approved",
      "accountType": "investee",
      "role": "investee",
      "name": "Investee Name",
      "kycId": "KYC_ID",
      "currentStep": 4,
      "submittedAt": "2026-05-28T10:20:00.000Z",
      "updatedAt": "2026-05-28T10:30:00.000Z"
    },
    "kyc": {
      "_id": "KYC_ID",
      "user": "USER_ID",
      "role": "investee",
      "currentStep": 4,
      "status": "approved",
      "personalIdentity": {},
      "addressVerification": {},
      "faceVerification": {},
      "sourceOfFunds": {},
      "approval": {},
      "createdAt": "2026-05-28T10:20:00.000Z",
      "updatedAt": "2026-05-28T10:30:00.000Z"
    }
  }
}
```

## 5. Get User Pitches or Features

`GET /:userId/pitches`

Alias:

`GET /:userId/features`

Use this for the page that shows all pitches/features created by the user.

### Example

```http
GET /api/v1/admin/users/USER_ID/pitches
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Admin user pitches fetched successfully",
  "data": {
    "user": {
      "id": "USER_ID",
      "profileImage": "",
      "name": "Investee Name",
      "email": "investee@gmail.com",
      "gmail": "investee@gmail.com",
      "mobile": "",
      "accountType": "investee",
      "role": "investee",
      "country": "Bangladesh",
      "age": 30,
      "joiningDate": "2026-05-28T10:00:00.000Z",
      "accountStatus": "active",
      "taxPercentage": 0,
      "socialLinks": {},
      "createdAt": "2026-05-28T10:00:00.000Z",
      "updatedAt": "2026-05-28T10:00:00.000Z"
    },
    "pitches": [
      {
        "_id": "PITCH_ID",
        "title": "Startup Pitch",
        "country": "Bangladesh",
        "stage": "Seed",
        "sector": "Fintech",
        "fundingTarget": 50000,
        "status": "activated",
        "viewCount": 20,
        "createdAt": "2026-05-28T11:00:00.000Z",
        "updatedAt": "2026-05-28T11:00:00.000Z"
      }
    ],
    "features": [
      {
        "_id": "PITCH_ID",
        "title": "Startup Pitch",
        "status": "activated"
      }
    ]
  }
}
```

`features` and `pitches` contain the same list data.

## 6. Update User Account Status

`PATCH /:userId/status`

Use this when super admin changes an investor/investee account status.

### Request Body

```json
{
  "accountStatus": "active"
}
```

You can also send:

```json
{
  "status": "inactive"
}
```

### Example

```http
PATCH /api/v1/admin/users/USER_ID/status
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
Content-Type: application/json

{
  "accountStatus": "active"
}
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Admin user account status updated successfully",
  "data": {
    "id": "USER_ID",
    "profileImage": "",
    "name": "Investor Name",
    "email": "investor@gmail.com",
    "gmail": "investor@gmail.com",
    "mobile": "",
    "accountType": "investor",
    "role": "investor",
    "country": "Bangladesh",
    "joiningDate": "2026-05-28T10:00:00.000Z",
    "accountStatus": "active",
    "kycStatus": "approved",
    "pitchCount": 0,
    "createdAt": "2026-05-28T10:00:00.000Z",
    "updatedAt": "2026-05-28T12:00:00.000Z"
  }
}
```

## Common Error Responses

### Missing or Invalid Token

Status: `401 Unauthorized`

```json
{
  "success": false,
  "message": "Authorization token is missing or invalid"
}
```

### Not Super Admin

Status: `403 Forbidden`

```json
{
  "success": false,
  "message": "Forbidden: insufficient permissions"
}
```

### Invalid User ID

Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "Invalid userId"
}
```

### User Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Investor or investee user not found"
}
```

### Invalid Account Status

Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "accountStatus must be active, inactive, or pending"
}
```

## Frontend Page Mapping

| Page or Section | API |
| --- | --- |
| Admin user table | `GET /api/v1/admin/users` |
| User details full page | `GET /api/v1/admin/users/:userId` |
| Profile section | `GET /api/v1/admin/users/:userId/profile` |
| Profile KYC card | Included in profile and details responses as `profileKyc` |
| KYC documents/details page | `GET /api/v1/admin/users/:userId/kyc` |
| User created pitches/features | `GET /api/v1/admin/users/:userId/pitches` or `/features` |
| Status dropdown/action | `PATCH /api/v1/admin/users/:userId/status` |
