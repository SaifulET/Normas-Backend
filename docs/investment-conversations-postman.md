# Investment Conversations & Schedule APIs

Base URL: `http://localhost:5000/api/v1/investment-conversations`

Use `Authorization: Bearer <access_token>` for every request below.

## 1. Create or get a conversation

`POST /`

Initial message can only be sent by the `investee`.

### Investor request body

```json
{
  "listId": "LIST_ID",
  "investeeId": "INVESTEE_USER_ID"
}
```

### Investee request body

```json
{
  "listId": "LIST_ID",
  "investorId": "INVESTOR_USER_ID",
  "initialMessage": "Opening this room for project discussion."
}
```

Logged-in `investee` can create the conversation directly with this body.

### Superadmin request body

```json
{
  "listId": "LIST_ID",
  "investorId": "INVESTOR_USER_ID",
  "investeeId": "INVESTEE_USER_ID"
}
```

Because one `list` can now be used with multiple different investees, the conversation is identified by:

`listId + investorId + investeeId`

## 2. Get my conversation list

`GET /`

## 3. Get one conversation

`GET /:conversationId`

## 4. Mark conversation messages as seen

`PATCH /:conversationId/seen`

Request body:

```json
{}
```

## 5. Send chat message

`POST /:conversationId/messages`

Request body:

```json
{
  "message": "We are available next Wednesday at 10:00 AM."
}
```

## 6. Create meeting request from chat

If investor or investee creates this, it stays `pending` until superadmin accepts or rejects it.

If superadmin creates this, it becomes `accepted` immediately and shows in schedules.

`POST /:conversationId/meeting-requests`

Request body:

```json
{
  "title": "Windmill Project Meeting",
  "note": "Please review the pitch deck before the meeting.",
  "location": "123, Main Street",
  "locationDetails": "London, United Kingdom",
  "timeZone": "Europe/London",
  "startsAt": "2026-08-17T10:00:00.000Z",
  "endsAt": "2026-08-17T11:00:00.000Z"
}
```

## 7. Get meeting requests for one conversation

`GET /:conversationId/meeting-requests`

Optional query params or raw JSON body:

`status=pending`

`status=accepted`

`status=rejected`

`status=cancelled`

Example raw JSON body:

```json
{
  "status": "accepted"
}
```

## 8. Get all meeting requests I can see

`GET /meeting-requests`

Optional query params or raw JSON body:

`status=pending`

`status=accepted`

`status=rejected`

`status=cancelled`

`conversationId=CONVERSATION_ID`

`listId=LIST_ID`

`from=2026-08-01T00:00:00.000Z`

`to=2026-08-31T23:59:59.999Z`

## 9. Get one meeting request

`GET /meeting-requests/:meetingRequestId`

## 10. Superadmin accepts or rejects a meeting request

`PATCH /meeting-requests/:meetingRequestId/status`

Request body:

```json
{
  "status": "accepted",
  "responseNote": "Approved by superadmin. Please be on time."
}
```

Accepted values for `status`:

`accepted`

`rejected`

`cancelled`

## 11. Get accepted schedules for current user

For `superadmin`, this returns all accepted schedules.

For `investor`, this returns accepted schedules where the user is the investor.

For `investee`, this returns accepted schedules where the user owns the project/list.

`GET /schedules`

Optional query params or raw JSON body:

`status=accepted`

`conversationId=CONVERSATION_ID`

`listId=LIST_ID`

`from=2026-08-01T00:00:00.000Z`

`to=2026-08-31T23:59:59.999Z`

## 12. Get specific schedule details

This only returns schedule details when the meeting request status is `accepted`.

`GET /schedules/:meetingRequestId`

Body: none
