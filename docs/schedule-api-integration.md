# Schedule API Integration Guide

Base URL: `http://localhost:5000/api/v1/schedules`

Use `Authorization: Bearer <access_token>` for every request below.

## Roles and Access

| Role | Create | List | Details | Update | Delete |
| --- | --- | --- | --- | --- | --- |
| `superadmin` | Yes | All schedules | Any schedule | Yes | Yes |
| `investor` | No | Own investor schedules only | Own schedules only | No | No |
| `investee` | No | Own investee schedules only | Own schedules only | No | No |

Investor and investee users cannot access schedules where they are not selected as a participant.

## Schedule Object

```json
{
  "_id": "SCHEDULE_ID",
  "conversation": "CONVERSATION_ID",
  "title": "Investor meeting",
  "dateTime": "2026-06-01T10:00:00.000Z",
  "startsAt": "2026-06-01T10:00:00.000Z",
  "timeZone": "Asia/Dhaka",
  "location": "123 Main Street",
  "investor": {
    "_id": "INVESTOR_USER_ID",
    "name": "Investor Name",
    "email": "investor@example.com",
    "role": "investor",
    "profileImage": "",
    "mobile": ""
  },
  "investee": {
    "_id": "INVESTEE_USER_ID",
    "name": "Investee Name",
    "email": "investee@example.com",
    "role": "investee",
    "profileImage": "",
    "mobile": ""
  },
  "createdBy": {
    "_id": "SUPERADMIN_USER_ID",
    "name": "Admin Name",
    "email": "admin@example.com",
    "role": "superadmin",
    "profileImage": "",
    "mobile": ""
  },
  "createdAt": "2026-05-27T08:00:00.000Z",
  "updatedAt": "2026-05-27T08:00:00.000Z"
}
```

`startsAt` is returned as an alias of `dateTime` for calendar UI compatibility.

## 1. Create Schedule

`POST /`

Only `superadmin` can create a schedule.

### Request Body

```json
{
  "title": "Investor meeting",
  "dateTime": "2026-06-01T10:00:00.000Z",
  "timeZone": "Asia/Dhaka",
  "location": "123 Main Street",
  "investorId": "INVESTOR_USER_ID",
  "investeeId": "INVESTEE_USER_ID",
  "conversationId": "OPTIONAL_CONVERSATION_ID"
}
```

### Required Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | Yes | Max 200 characters |
| `dateTime` | ISO date string | Yes | Example: `2026-06-01T10:00:00.000Z` |
| `timeZone` | string | Yes | Example: `Asia/Dhaka`, `UTC`, `America/New_York` |
| `location` | string | Yes | Max 200 characters |
| `investorId` | string | Yes, unless derived from `conversationId` | Must be a user with role `investor` |
| `investeeId` | string | Yes, unless derived from `conversationId` | Must be a user with role `investee` |
| `conversationId` | string | No | Must be an existing investment conversation between the same investor and investee |

You can also send `startsAt` instead of `dateTime`; the API treats it as the schedule date and time.

### Success Response

Status: `201 Created`

```json
{
  "success": true,
  "message": "Schedule created successfully",
  "data": {
    "_id": "SCHEDULE_ID",
    "conversation": "CONVERSATION_ID",
    "title": "Investor meeting",
    "dateTime": "2026-06-01T10:00:00.000Z",
    "startsAt": "2026-06-01T10:00:00.000Z",
    "timeZone": "Asia/Dhaka",
    "location": "123 Main Street",
    "investor": {},
    "investee": {},
    "createdBy": {},
    "createdAt": "2026-05-27T08:00:00.000Z",
    "updatedAt": "2026-05-27T08:00:00.000Z"
  }
}
```

## 2. List Schedules

`GET /`

### Visibility Rules

- `superadmin`: returns all schedules.
- `investor`: returns schedules where the logged-in user is the selected investor.
- `investee`: returns schedules where the logged-in user is the selected investee.

### Query Parameters

| Parameter | Type | Roles | Notes |
| --- | --- | --- | --- |
| `from` | ISO date string | All | Return schedules on or after this date |
| `to` | ISO date string | All | Return schedules on or before this date |
| `conversationId` | string | All | Filter by linked chat conversation |
| `investorId` | string | Super Admin useful | Non-admin users are still restricted to their own schedules |
| `investeeId` | string | Super Admin useful | Non-admin users are still restricted to their own schedules |

### Examples

Investor dashboard:

```http
GET /api/v1/schedules
Authorization: Bearer INVESTOR_ACCESS_TOKEN
```

Investee dashboard:

```http
GET /api/v1/schedules
Authorization: Bearer INVESTEE_ACCESS_TOKEN
```

Super Admin dashboard:

```http
GET /api/v1/schedules
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

Calendar date range:

```http
GET /api/v1/schedules?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z
Authorization: Bearer ACCESS_TOKEN
```

Schedules for one chat:

```http
GET /api/v1/schedules?conversationId=CONVERSATION_ID
Authorization: Bearer ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Schedules fetched successfully",
  "data": [
    {
      "_id": "SCHEDULE_ID",
      "conversation": "CONVERSATION_ID",
      "title": "Investor meeting",
      "dateTime": "2026-06-01T10:00:00.000Z",
      "startsAt": "2026-06-01T10:00:00.000Z",
      "timeZone": "Asia/Dhaka",
      "location": "123 Main Street",
      "investor": {},
      "investee": {},
      "createdBy": {},
      "createdAt": "2026-05-27T08:00:00.000Z",
      "updatedAt": "2026-05-27T08:00:00.000Z"
    }
  ]
}
```

## 3. Get Schedule Details

`GET /:scheduleId`

Investor and investee users can only open schedules where they are involved.

### Example

```http
GET /api/v1/schedules/SCHEDULE_ID
Authorization: Bearer ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Schedule fetched successfully",
  "data": {
    "_id": "SCHEDULE_ID",
    "conversation": "CONVERSATION_ID",
    "title": "Investor meeting",
    "dateTime": "2026-06-01T10:00:00.000Z",
    "startsAt": "2026-06-01T10:00:00.000Z",
    "timeZone": "Asia/Dhaka",
    "location": "123 Main Street",
    "investor": {
      "_id": "INVESTOR_USER_ID",
      "name": "Investor Name",
      "email": "investor@example.com",
      "role": "investor",
      "profileImage": "",
      "mobile": ""
    },
    "investee": {
      "_id": "INVESTEE_USER_ID",
      "name": "Investee Name",
      "email": "investee@example.com",
      "role": "investee",
      "profileImage": "",
      "mobile": ""
    },
    "createdBy": {
      "_id": "SUPERADMIN_USER_ID",
      "name": "Admin Name",
      "email": "admin@example.com",
      "role": "superadmin",
      "profileImage": "",
      "mobile": ""
    },
    "createdAt": "2026-05-27T08:00:00.000Z",
    "updatedAt": "2026-05-27T08:00:00.000Z"
  }
}
```

## 4. Update Schedule

`PATCH /:scheduleId`

Only `superadmin` can update a schedule.

### Request Body

All fields are optional. Send only the fields that need to change.

```json
{
  "title": "Updated investor meeting",
  "dateTime": "2026-06-02T11:00:00.000Z",
  "timeZone": "Asia/Dhaka",
  "location": "Updated location",
  "investorId": "INVESTOR_USER_ID",
  "investeeId": "INVESTEE_USER_ID",
  "conversationId": "CONVERSATION_ID"
}
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Schedule updated successfully",
  "data": {
    "_id": "SCHEDULE_ID",
    "conversation": "CONVERSATION_ID",
    "title": "Updated investor meeting",
    "dateTime": "2026-06-02T11:00:00.000Z",
    "startsAt": "2026-06-02T11:00:00.000Z",
    "timeZone": "Asia/Dhaka",
    "location": "Updated location",
    "investor": {},
    "investee": {},
    "createdBy": {},
    "createdAt": "2026-05-27T08:00:00.000Z",
    "updatedAt": "2026-05-27T09:00:00.000Z"
  }
}
```

## 5. Delete Schedule

`DELETE /:scheduleId`

Only `superadmin` can delete a schedule.

### Example

```http
DELETE /api/v1/schedules/SCHEDULE_ID
Authorization: Bearer SUPERADMIN_ACCESS_TOKEN
```

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "message": "Schedule deleted successfully",
  "data": {
    "id": "SCHEDULE_ID",
    "message": "Schedule deleted successfully"
  }
}
```

## Chat Relation

Schedules can be linked to the existing investor-investee chat by sending `conversationId` during create or update.

When `conversationId` is provided:

- The conversation must exist.
- The conversation investor must match `investorId`.
- The conversation investee must match `investeeId`.
- If `investorId` or `investeeId` is omitted, the API can derive them from the conversation.

Example using only the conversation participants:

```json
{
  "title": "Follow-up meeting",
  "dateTime": "2026-06-03T09:00:00.000Z",
  "timeZone": "Asia/Dhaka",
  "location": "Zoom",
  "conversationId": "CONVERSATION_ID"
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

### Investor or Investee Trying to Create, Update, or Delete

Status: `403 Forbidden`

```json
{
  "success": false,
  "message": "Forbidden: insufficient permissions"
}
```

### User Trying to Access Another User's Schedule

Status: `403 Forbidden`

```json
{
  "success": false,
  "message": "Forbidden: you cannot access this schedule"
}
```

### Invalid Participant Role

Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "investorId must be a investor"
}
```

```json
{
  "success": false,
  "message": "investeeId must be a investee"
}
```

### Conversation Participants Do Not Match

Status: `400 Bad Request`

```json
{
  "success": false,
  "message": "Schedule participants must match the conversation participants"
}
```

### Schedule Not Found

Status: `404 Not Found`

```json
{
  "success": false,
  "message": "Schedule not found"
}
```

## Frontend Integration Notes

- Use `GET /api/v1/schedules` for investor, investee, and superadmin dashboards.
- Use `from` and `to` query params for calendar views.
- Use `GET /api/v1/schedules/:scheduleId` when opening the schedule details panel.
- Show create, edit, and delete actions only for `superadmin`.
- Hide create, edit, and delete actions for `investor` and `investee`.
- For a schedule created from a chat, pass the chat `conversationId`.
- Store and send `dateTime` as an ISO string. Display it using the returned `timeZone`.
