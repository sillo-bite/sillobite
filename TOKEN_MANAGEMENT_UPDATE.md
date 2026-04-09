# Token Management Update - One Token Per User

## Changes Made

### 1. Database Schema Update ✅
- Added `UNIQUE` constraint on `user_id` in `api_tokens` table
- Ensures each user can only have ONE active token
- Removed all duplicate tokens from existing data

### 2. Service Logic Update ✅
Updated `connectionCodeService.verifyCode()` to use UPSERT:

```sql
INSERT INTO api_tokens (user_id, token)
VALUES (user_id, new_token)
ON CONFLICT (user_id) 
DO UPDATE SET token = new_token, created_at = NOW()
```

## Behavior

### Before Fix ❌
- User generates code → Gets token A
- User generates code again → Gets token B (duplicate)
- Database has multiple tokens for same user
- Old tokens never invalidated

### After Fix ✅
- User generates code → Gets token A
- User generates code again → Token A is REPLACED with token B
- Database has only ONE token per user
- Old token automatically invalidated

## Benefits

1. **No Duplicates**: Each user has exactly one active token
2. **Automatic Revocation**: Old tokens are automatically replaced
3. **Security**: When user reconnects, old token becomes invalid
4. **Clean Data**: No orphaned tokens in database

## Testing

Run the test to verify:
```bash
node test-token-upsert.js
```

Expected output:
- First insert: Creates new token
- Second insert: Updates existing token (count stays at 1)
- No duplicates created

## Migration Applied

The fix has been applied to your database:
- ✅ Duplicate tokens removed
- ✅ Unique constraint added
- ✅ Service logic updated
- ✅ Migration file updated for future deployments

## Usage

No changes needed in CareBite integration. The API works the same:

```javascript
// User generates code and verifies
const { access_token } = await verifyCode(email, code);

// If user reconnects later, old token is automatically replaced
const { access_token: new_token } = await verifyCode(email, new_code);
// old access_token is now invalid
```

## Database State

```
api_tokens table:
- user_id: UNIQUE (one token per user)
- token: UNIQUE (no duplicate tokens)
- created_at: Updated on each reconnection
```

## Future Enhancements

Consider adding:
1. Token expiration date
2. Token refresh mechanism
3. Manual token revocation endpoint
4. Token usage tracking
