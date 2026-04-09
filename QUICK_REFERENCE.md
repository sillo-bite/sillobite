# Connection Code System - Quick Reference

## 🚀 Quick Start

```bash
# Setup (Windows)
.\setup-connection-code.ps1

# Setup (Unix/Linux)
./setup-connection-code.sh

# Start server
npm run dev
```

## 📍 UI Location

Profile Page → External Apps → "Connect to CareBite" card

## 🔑 API Endpoints

### Generate Code
```http
POST /api/auth/generate-code
Cookie: connect.sid=SESSION_COOKIE

Response:
{
  "code": "ABC123",
  "expires_at": "2024-01-15T10:32:00.000Z"
}
```

### Verify Code
```http
POST /api/auth/verify-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "ABC123"
}

Response:
{
  "access_token": "a1b2c3d4...",
  "user_id": 123
}
```

### Use Token
```http
GET /api/users/123
Authorization: Bearer a1b2c3d4...
```

## 📊 Database Tables

```sql
connection_codes (id, user_id, code, expires_at, is_used, created_at)
api_tokens (id, user_id, token, created_at)
```

## 🔒 Security Features

- ✅ 2-minute expiration
- ✅ Single-use codes
- ✅ 64-char secure tokens
- ✅ Unique code generation
- ✅ Auto-cleanup every 5 min

## 📁 File Structure

```
server/
├── routes/connectionCode.ts
├── controllers/connectionCodeController.ts
├── services/connectionCodeService.ts
└── middleware/authMiddleware.ts

client/src/components/profile/
└── ConnectionCodeCard.tsx

prisma/migrations/
└── add_connection_code_tables.sql
```

## 🧪 Testing

```bash
# Import postman_examples.json to Postman
# OR use test-connection-code.http in VS Code
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Code generation fails | Check user session/authentication |
| Code verification fails | Check expiration (2 min) and usage |
| Token auth fails | Verify `Authorization: Bearer {token}` header |
| Migration fails | Check DATABASE_URL and PostgreSQL connection |

## 📖 Full Documentation

- `CONNECTION_CODE_README.md` - Complete API docs
- `IMPLEMENTATION_SUMMARY.md` - Architecture & flows
- `postman_examples.json` - API examples
- `test-connection-code.http` - Test requests

## 💡 Code Examples

### Frontend (Generate)
```typescript
const res = await fetch('/api/auth/generate-code', {
  method: 'POST',
  credentials: 'include'
});
const { code, expires_at } = await res.json();
```

### CareBite (Verify)
```typescript
const res = await fetch('/api/auth/verify-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, code })
});
const { access_token, user_id } = await res.json();
```

### CareBite (Use Token)
```typescript
const res = await fetch('/api/users/123', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
const user = await res.json();
```

## ⏱️ Timings

- Code validity: 2 minutes
- Cleanup interval: 5 minutes
- Token validity: Permanent (until revoked)

## 🎨 UI Features

- Generate button
- Copy to clipboard
- Real-time countdown
- Expiration handling
- Dark mode support
- Toast notifications

## 🔧 Maintenance

```typescript
// Manual cleanup (if needed)
import { connectionCodeService } from './services/connectionCodeService';
await connectionCodeService.cleanExpired();
```

## 📞 Support

Check logs for errors:
```bash
# Server logs show all connection code operations
# Look for: "Generate code", "Verify code", "Cleaned expired"
```
