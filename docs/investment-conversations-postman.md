# Investment Conversations & Schedule APIs

Base URL: `http://localhost:5000/api/v1/investment-conversations`

Use `Authorization: Bearer <access_token>` for every request below.

## Socket.IO realtime

Socket URL: `http://localhost:5000`

You can pass the access token either in the event payload as `token` or in the Socket.IO auth object:

```js
const socket = io("http://localhost:5000", {
  auth: { token: accessToken }
});
```

### Join a conversation room

Client emits:

```js
socket.emit("investment:join", {
  conversationId: "CONVERSATION_ID",
  token: "ACCESS_TOKEN"
}, callback);
```

Joining validates access, joins room `investment:<conversationId>`, and marks incoming unseen messages as seen.

### Send message in realtime

Client emits after joining:

```js
socket.emit("investment:send-message", {
  conversationId: "CONVERSATION_ID",
  message: "We are available next Wednesday at 10:00 AM."
}, callback);
```

Server broadcasts to joined clients:

`investment:message`

```json
{
  "conversationId": "CONVERSATION_ID",
  "message": {},
  "conversation": {},
  "senderUser": {},
  "receiverUser": {},
  "receiverUnseenMessageCount": 1
}
```

The REST endpoint `POST /:conversationId/messages` also broadcasts the same `investment:message` event.

`message.direction` is calculated per connected socket user. The sender receives `outgoing`; the receiver receives `incoming`.

### Mark messages as seen in realtime

Client emits after joining:

```js
socket.emit("investment:mark-seen", {
  conversationId: "CONVERSATION_ID"
}, callback);
```

Server broadcasts when any messages changed:

`investment:messages-seen`

```json
{
  "conversationId": "CONVERSATION_ID",
  "seenMessageIds": ["MESSAGE_ID"],
  "conversation": {}
}
```

The REST endpoints `GET /:conversationId` and `PATCH /:conversationId/seen` also broadcast `investment:messages-seen` when new messages are marked seen.

### Meeting request realtime events

The REST endpoint `POST /:conversationId/meeting-requests` broadcasts:

`investment:meeting-request`

The REST endpoint `PATCH /meeting-requests/:meetingRequestId/status` broadcasts:

`investment:meeting-request-updated`

## 1. Create or get a conversation

`POST /`

An `investor` can start a conversation with only `listId` and `initialMessage`.
The API finds the investee from the list owner and creates a `pending` conversation.

### Investor request body

```json
{
  "listId": "LIST_ID",
  "initialMessage": "Hi, I am interested in this opportunity."
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

### Response

```json
{
  "success": true,
  "message": "Investment conversation created successfully",
  "data": {
    "created": true,
    "conversation": {
      "_id": "CONVERSATION_ID",
      "conversationStatus": "pending",
      "otherUserInfo": {
        "_id": "INVESTEE_USER_ID",
        "name": "Investee Name",
        "email": "investee@example.com",
        "role": "investee",
        "profileImage": ""
      },
      "list": {
        "_id": "LIST_ID",
        "title": "Carbonledger AI windmill"
      },
      "messages": [
        {
          "_id": "MESSAGE_ID",
          "message": "Hi, I am interested in this opportunity.",
          "direction": "outgoing",
          "isSeen": true,
          "sentAt": "2026-05-19T10:00:00.000Z"
        }
      ],
      "unreadCount": 0,
      "lastMessageAt": "2026-05-19T10:00:00.000Z"
    }
  }
}
```

## 2. Get my conversation list

`GET /`

Optional query params:

`status=pending`

`status=active`

## 2.1 Sidebar conversation list

`GET /sidebar`

Alias:

`GET /inbox`

Optional query params:

`status=pending`

`status=active`

Response item:

```json
{
  "conversationId": "CONVERSATION_ID",
  "otherUserInfo": {
    "_id": "USER_ID",
    "name": "Carbonledger AI windmill",
    "email": "user@example.com",
    "role": "investee",
    "profileImage": ""
  },
  "listInfo": {
    "_id": "LIST_ID",
    "title": "Carbonledger AI windmill"
  },
  "lastIncomingMessage": {
    "_id": "MESSAGE_ID",
    "message": "Hi team, we're experiencing some latency with t...",
    "direction": "incoming",
    "sentAt": "2026-05-19T10:00:00.000Z"
  },
  "lastIncomingMessagePreview": "Hi team, we're experiencing some latency with t...",
  "lastMessageTime": "2026-05-19T10:00:00.000Z",
  "timeAgo": "10m",
  "unseenMessageCount": 1,
  "conversationStatus": "pending"
}
```

## 2.2 Request list

`GET /requests`

Returns pending conversations for the logged-in investee. For superadmin, returns all pending conversations.

## 3. Get one conversation

`GET /:conversationId`

Opening a pending conversation marks incoming unseen messages as seen and updates `conversationStatus` from `pending` to `active`.

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

### Response

```json
{
  "success": true,
  "message": "Conversation message sent successfully",
  "data": {
    "message": {
      "_id": "MESSAGE_ID",
      "message": "We are available next Wednesday at 10:00 AM.",
      "direction": "outgoing",
      "isSeen": true,
      "sentAt": "2026-05-19T10:15:00.000Z"
    },
    "senderUser": {
      "_id": "SENDER_ID",
      "name": "Sender Name",
      "role": "investor"
    },
    "receiverUser": {
      "_id": "RECEIVER_ID",
      "name": "Receiver Name",
      "role": "investee"
    },
    "receiverUnseenMessageCount": 1
  }
}
```

## 5.1 Message list with load more

`GET /:conversationId/messages`

Query params:

`page=1`

`limitPairs=5`

The API returns up to `limitPairs * 2` latest messages. Page `1` returns the newest messages in chronological order. Page `2` loads older messages.

```json
{
  "success": true,
  "message": "Conversation messages fetched successfully",
  "data": {
    "conversationId": "CONVERSATION_ID",
    "conversationStatus": "active",
    "messages": [],
    "pagination": {
      "page": 1,
      "limitPairs": 5,
      "limitMessages": 10,
      "totalMessages": 24,
      "loadedMessages": 10,
      "hasMore": true,
      "nextPage": 2
    }
  }
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
