# SilloBite Connection Code System

Secure connection code system for linking external apps (like CareBite) to SilloBite accounts.

## Database Schema

### Tables Created

#### connection_codes
- `id` (UUID, primary key)
- `user_id` (INTEGER, foreign key to users)
- `code` (VARCHAR(8), unique)
- `expires_at` (TIMESTAMP)
- `is_used` (BOOLEAN, default false)
- `created_at` (TIMESTAMP, default now)

#### api_tokens
- `id` (UUID, primary key)
- `user_id` (INTEGER, foreign key to users)
- `token` (VARCHAR(255), unique)
- `created_at` (TIMESTAMP, default now)

### Indexes
- `idx_connection_codes_user_id` on connection_codes(user_id)
- `idx_connection_codes_code` on connection_codes(code)
- `idx_connection_codes_expires_at` on connection_codes(expires_at)
- `idx_api_tokens_user_id` on api_tokens(user_id)
- `idx_api_tokens_token` on api_tokens(token)

## Setup

### 1. Run Database Migration

```bash
psql $DATABASE_URL -f prisma/migrations/add_connection_code_tables.sql
```

### 2. Install Dependencies (if needed)

```bash
npm install
```

### 3. Start Server

```bash
npm run dev
```

## API Endpoints

### Generate Connection Code

**Endpoint:** `POST /api/auth/generate-code`

**Authentication:** Required (session-based)

**Description:** Generates a 6-character uppercase alphanumeric code valid for 2 minutes.

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/generate-code \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Response:**
```json
{
  "code": "ABC123",
  "expires_at": "2024-01-15T10:32:00.000Z"
}
```

**Features:**
- Invalidates previous unused codes for the user
- Ensures code uniqueness
- 2-minute expiration

### Verify Connection Code

**Endpoint:** `POST /api/auth/verify-code`

**Authentication:** None (public endpoint for CareBite)

**Description:** Verifies code and returns secure access token.

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "code": "ABC123"
  }'
```

**Response:**
```json
{
  "access_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
  "user_id": 123
}
```

**Validation:**
- User exists with provided email
- Code matches and belongs to user
- Code not expired
- Code not already used

**Error Response:**
```json
{
  "error": "Invalid or expired code"
}
```

## Using Access Token

Once CareBite receives the access token, it can make authenticated requests:

```bash
curl -X GET http://localhost:5000/api/users/123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

To use token authentication in your routes, import the middleware:

```typescript
import { tokenAuthMiddleware } from '../middleware/authMiddleware';

router.get('/protected', tokenAuthMiddleware, (req, res) => {
  const user = (req as any).user;
  res.json({ message: `Hello ${user.name}` });
});
```

## UI Component

The connection code UI is integrated into the Profile page at `/app` (Profile tab).

**Features:**
- Generate code button
- Display code with copy functionality
- Real-time countdown timer
- Expiration handling
- Responsive design with dark mode support

**Location:** `client/src/components/profile/ConnectionCodeCard.tsx`

## Security Features

1. **Secure Token Generation:** Uses `crypto.randomBytes(32)` for 64-character hex tokens
2. **Code Expiration:** 2-minute validity window
3. **Single Use:** Codes marked as used after verification
4. **Unique Codes:** Collision detection ensures uniqueness
5. **User Isolation:** Old unused codes invalidated when generating new ones
6. **Indexed Lookups:** Fast code verification with database indexes

## Code Structure

```
server/
├── routes/
│   └── connectionCode.ts          # Route definitions
├── controllers/
│   └── connectionCodeController.ts # Request handlers
├── services/
│   └── connectionCodeService.ts    # Business logic
└── middleware/
    └── authMiddleware.ts           # Auth middleware

client/src/components/profile/
└── ConnectionCodeCard.tsx          # UI component

prisma/migrations/
└── add_connection_code_tables.sql  # Database schema
```

## Testing with Postman

Import `postman_examples.json` into Postman for ready-to-use API examples.

## Maintenance

### Clean Expired Codes

The service includes a cleanup method:

```typescript
import { connectionCodeService } from './services/connectionCodeService';

// Run periodically (e.g., cron job)
await connectionCodeService.cleanExpired();
```

Add to your server startup or cron:

```typescript
// In server/index.ts
setInterval(async () => {
  await connectionCodeService.cleanExpired();
}, 5 * 60 * 1000); // Every 5 minutes
```

## Error Handling

All endpoints include proper error handling:
- 400: Bad request (missing parameters)
- 401: Unauthorized (invalid/expired code, no session)
- 500: Server error

## Future Enhancements

- Rate limiting on code generation
- Code usage analytics
- Token expiration/refresh mechanism
- Multi-device token management
- Revoke token endpoint
