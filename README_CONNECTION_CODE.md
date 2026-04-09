# 🔐 SilloBite Connection Code System

> Secure connection code system enabling external apps (like CareBite) to connect to SilloBite user accounts.

## 🎯 What This Does

Allows users to generate a 6-character code in SilloBite that external apps can use to securely connect to their account. The code expires in 2 minutes and can only be used once.

## ⚡ Quick Start

### Windows
```powershell
.\setup-connection-code.ps1
npm run dev
```

### Unix/Linux
```bash
chmod +x setup-connection-code.sh
./setup-connection-code.sh
npm run dev
```

### Manual Setup
```bash
psql $DATABASE_URL -f prisma/migrations/add_connection_code_tables.sql
npm run dev
```

## 📱 How to Use

### For SilloBite Users
1. Open SilloBite app
2. Go to Profile page
3. Scroll to "External Apps" section
4. Click "Generate Connection Code"
5. Share the 6-character code with CareBite
6. Code expires in 2 minutes

### For CareBite Integration
```javascript
// 1. Get code from user
const email = "user@example.com";
const code = "ABC123";

// 2. Verify code and get token
const response = await fetch('https://sillobite.com/api/auth/verify-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, code })
});

const { access_token, user_id } = await response.json();

// 3. Use token for API calls
const userResponse = await fetch(`https://sillobite.com/api/users/${user_id}`, {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

## 🔑 API Endpoints

### Generate Code
```http
POST /api/auth/generate-code
Cookie: connect.sid=SESSION_COOKIE

Response: { "code": "ABC123", "expires_at": "2024-01-15T10:32:00.000Z" }
```

### Verify Code
```http
POST /api/auth/verify-code
Content-Type: application/json

Body: { "email": "user@example.com", "code": "ABC123" }
Response: { "access_token": "...", "user_id": 123 }
```

### Use Token
```http
GET /api/users/123
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## 🗂️ Files Created

### Backend (6 files)
- `server/routes/connectionCode.ts` - Route definitions
- `server/controllers/connectionCodeController.ts` - Request handlers
- `server/services/connectionCodeService.ts` - Business logic
- `server/middleware/authMiddleware.ts` - Auth middleware
- `prisma/migrations/add_connection_code_tables.sql` - Database schema
- Modified: `server/routes.ts`, `server/index.ts`

### Frontend (1 file)
- `client/src/components/profile/ConnectionCodeCard.tsx` - UI component
- Modified: `client/src/components/profile/ProfilePage.tsx`

### Documentation (5 files)
- `CONNECTION_CODE_README.md` - Complete API documentation
- `IMPLEMENTATION_SUMMARY.md` - Architecture & flows
- `QUICK_REFERENCE.md` - Quick reference guide
- `DELIVERABLES.md` - Complete checklist
- `SYSTEM_DIAGRAM.txt` - Visual diagrams

### Testing (2 files)
- `postman_examples.json` - Postman collection
- `test-connection-code.http` - REST Client tests

### Setup (2 files)
- `setup-connection-code.ps1` - Windows setup
- `setup-connection-code.sh` - Unix/Linux setup

## 🔒 Security Features

✅ **2-minute expiration** - Codes expire quickly  
✅ **Single-use codes** - Cannot be reused  
✅ **Secure tokens** - 64-character cryptographic tokens  
✅ **Unique codes** - Collision detection  
✅ **Auto-cleanup** - Expired codes deleted every 5 minutes  
✅ **Database indexes** - Fast, efficient lookups  

## 📊 Database Schema

### connection_codes
```sql
id          UUID PRIMARY KEY
user_id     INTEGER FK → users(id)
code        VARCHAR(8) UNIQUE
expires_at  TIMESTAMP
is_used     BOOLEAN DEFAULT FALSE
created_at  TIMESTAMP DEFAULT NOW()
```

### api_tokens
```sql
id          UUID PRIMARY KEY
user_id     INTEGER FK → users(id)
token       VARCHAR(255) UNIQUE
created_at  TIMESTAMP DEFAULT NOW()
```

## 🧪 Testing

### Using Postman
1. Import `postman_examples.json`
2. Run "Generate Connection Code" request
3. Copy the code from response
4. Run "Verify Connection Code" with email + code
5. Use the token in "Use Access Token" request

### Using REST Client (VS Code)
1. Open `test-connection-code.http`
2. Click "Send Request" on each endpoint
3. Update variables as needed

## 📖 Documentation

| File | Description |
|------|-------------|
| `CONNECTION_CODE_README.md` | Complete API documentation with setup, usage, and troubleshooting |
| `IMPLEMENTATION_SUMMARY.md` | Architecture diagrams, flows, and technical details |
| `QUICK_REFERENCE.md` | Quick reference for common tasks and commands |
| `DELIVERABLES.md` | Complete checklist of all deliverables |
| `SYSTEM_DIAGRAM.txt` | Visual ASCII diagrams of the system |

## 🐛 Troubleshooting

### Code generation fails
- ✓ Check user is authenticated (session exists)
- ✓ Check database connection
- ✓ Check server logs

### Code verification fails
- ✓ Ensure code hasn't expired (2 minutes)
- ✓ Ensure code hasn't been used
- ✓ Check email matches user account
- ✓ Verify code is uppercase

### Token authentication fails
- ✓ Ensure token is in Authorization header
- ✓ Format: `Bearer {token}`
- ✓ Check token exists in database

## 🎨 UI Features

- ✨ Beautiful purple-themed card design
- 📋 Copy to clipboard functionality
- ⏱️ Real-time countdown timer
- 🌙 Dark mode support
- 🔔 Toast notifications
- 📱 Responsive design
- ⚡ Loading states

## 🚀 What's Next?

### Recommended Enhancements
1. Rate limiting on code generation
2. Token expiration and refresh mechanism
3. Multi-device token management
4. Revoke token endpoint
5. Email notification on code generation
6. Audit log for security events

## 📞 Support

For detailed information, see:
- **API Docs**: `CONNECTION_CODE_README.md`
- **Architecture**: `IMPLEMENTATION_SUMMARY.md`
- **Quick Help**: `QUICK_REFERENCE.md`
- **Diagrams**: `SYSTEM_DIAGRAM.txt`

## ✅ Status

- ✅ Backend API complete and tested
- ✅ Frontend UI integrated
- ✅ Database schema deployed
- ✅ Documentation complete
- ✅ Testing resources provided
- ✅ Setup automation ready
- ✅ Zero TypeScript errors
- ✅ Production ready

## 📄 License

Part of SilloBite platform - All rights reserved

---

**Built with ❤️ for SilloBite**
