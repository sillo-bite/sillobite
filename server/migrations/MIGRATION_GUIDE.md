# User Location Fields Migration Guide

## Overview

This migration adds location selection functionality to the users table, allowing users to choose and switch between different locations (colleges, organizations, or restaurants).

## What This Migration Does

1. **Adds two new columns** to the `users` table:
   - `selected_location_type` (VARCHAR) - Stores 'college', 'organization', or 'restaurant'
   - `selected_location_id` (VARCHAR) - Stores the ID of the selected location

2. **Backfills existing data** based on priority:
   - If user has `organizationId` → auto-set to organization
   - Else if user has `college` → auto-set to college
   - Else → NULL (user will select manually)

3. **Preserves all existing data** - No data loss or deletion

## Safety Features

✅ **Idempotent** - Can be run multiple times safely  
✅ **Non-destructive** - No data deletion  
✅ **Detailed logging** - Complete visibility into changes  
✅ **Error handling** - Continues on individual user errors  
✅ **Rollback available** - Can be reversed if needed  

## Pre-Migration Checklist

- [ ] **Backup your database** (CRITICAL)
  ```bash
  # For PostgreSQL (example - adjust for your setup)
  pg_dump -h your-host -U your-user -d your-db > backup_before_location_migration.sql
  ```

- [ ] **Test in staging environment first**
  ```bash
  npm run migrate:user-location
  ```

- [ ] **Verify Prisma schema is up to date**
  ```bash
  npx prisma generate
  ```

- [ ] **Check database connection**
  ```bash
  npx prisma db execute --preview-feature --stdin <<< "SELECT 1"
  ```

## Running the Migration

### Option 1: Via NPM Script (Recommended)

1. Add to `package.json`:
   ```json
   {
     "scripts": {
       "migrate:user-location": "tsx server/migrations/add-user-location-fields.ts"
     }
   }
   ```

2. Run the migration:
   ```bash
   npm run migrate:user-location
   ```

### Option 2: Direct Execution

```bash
npx tsx server/migrations/add-user-location-fields.ts
```

### Option 3: Via Node (Production)

```bash
node dist/migrations/add-user-location-fields.js
```

## Expected Output

```
╔════════════════════════════════════════════╗
║   USER LOCATION FIELDS MIGRATION          ║
║   Production-Safe Database Migration       ║
╚════════════════════════════════════════════╝

🚀 Starting user location fields migration...
📋 This migration will add location selection functionality

🔍 Step 1: Checking if columns exist...
➕ Columns do not exist. Adding them now...
✅ Columns added successfully

🔍 Step 2: Analyzing existing user data...
📊 Found 1250 total users

🔄 Step 3: Backfilling location data for users...
Priority: Organization > College > NULL

🏢 User 1 (John Doe): Setting location to organization org-123
🎓 User 2 (Jane Smith): Setting location to college college-456
⚠️  User 3 (Bob Wilson): No college or organization - location will remain NULL

✅ Migration completed successfully!

📊 Migration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Columns added: YES
   Total users: 1250
   Users updated: 1200
   ├─ Set to organization: 300
   ├─ Set to college: 900
   └─ Without location data: 50
   Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Next steps:
   - Users with locations will see their default location on login
   - Users without locations can select one from their profile
   - All data filtering will respect the selected location

✅ Migration completed successfully
```

## Verification After Migration

### 1. Check Column Creation

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('selected_location_type', 'selected_location_id');
```

Expected result:
```
 column_name              | data_type        | is_nullable
--------------------------+------------------+-------------
 selected_location_type   | character varying| YES
 selected_location_id     | character varying| YES
```

### 2. Check Data Distribution

```sql
SELECT 
  selected_location_type,
  COUNT(*) as user_count
FROM users
GROUP BY selected_location_type
ORDER BY user_count DESC;
```

Expected result:
```
 selected_location_type | user_count
------------------------+------------
 college                | 900
 organization           | 300
 (null)                 | 50
```

### 3. Sample User Data

```sql
SELECT 
  id, 
  name, 
  college, 
  organization_id,
  selected_location_type,
  selected_location_id
FROM users
LIMIT 10;
```

### 4. Verify No Data Loss

```sql
-- Count should be the same as before migration
SELECT COUNT(*) FROM users;

-- All original fields should still exist
SELECT college, organization_id FROM users WHERE college IS NOT NULL OR organization_id IS NOT NULL;
```

## Rollback Procedure

If you need to revert this migration:

### 1. Run the Rollback Script

```bash
npx tsx server/migrations/rollback-user-location-fields.ts
```

### 2. Confirm the Rollback

The script will prompt:
```
Are you sure you want to rollback? This will remove location fields. (yes/no):
```

Type `yes` to proceed.

### 3. Verify Rollback

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('selected_location_type', 'selected_location_id');
```

Expected: No rows (columns removed)

## Production Deployment Steps

### 1. Pre-Deployment (1-2 days before)

1. Test migration in staging environment
2. Review migration logs
3. Verify data accuracy
4. Test application functionality with new fields

### 2. Deployment Day

1. **Schedule maintenance window** (optional - migration is non-blocking)
2. **Create database backup**
   ```bash
   # Adjust for your database provider
   pg_dump -h host -U user -d database > backup.sql
   ```
3. **Run migration**
   ```bash
   npm run migrate:user-location
   ```
4. **Verify migration success** (see Verification section)
5. **Deploy application code** with location selection feature
6. **Monitor logs** for any issues

### 3. Post-Deployment

1. Monitor application performance
2. Check user location selection behavior
3. Verify data filtering works correctly
4. Monitor error logs for location-related issues

## Troubleshooting

### Issue: "Column already exists" error

**Solution:** The migration is idempotent. If columns exist, it will skip creation and only backfill data.

### Issue: Migration fails partway through

**Solution:** 
1. Check the logs to identify which user failed
2. Fix the issue with that user's data
3. Re-run the migration (it will skip already-updated users)

### Issue: Users not seeing their location

**Solution:**
1. Check if the user has data in the new columns:
   ```sql
   SELECT selected_location_type, selected_location_id 
   FROM users 
   WHERE id = <user_id>;
   ```
2. Verify the frontend is loading the LocationContext
3. Check browser localStorage for cached location data

### Issue: Need to re-run migration for specific users

**Solution:**
```sql
-- Clear location for specific users
UPDATE users 
SET selected_location_type = NULL, 
    selected_location_id = NULL 
WHERE id IN (1, 2, 3);
```
Then re-run the migration.

## Database Performance Impact

- **Migration runtime**: ~1-2 seconds per 1000 users
- **Table locking**: None (ALTER TABLE is non-blocking in PostgreSQL 11+)
- **Disk space**: Minimal (~50 bytes per user)
- **Index impact**: None (no indexes on new columns initially)

## Security Considerations

- New columns are nullable - no forced defaults
- No sensitive data in location fields
- User data remains private
- Location selection is user-controlled

## Support

If you encounter issues:

1. **Check the logs** - Migration provides detailed output
2. **Verify database state** - Use SQL queries above
3. **Review error messages** - They include specific user IDs
4. **Rollback if needed** - Use the rollback script
5. **Contact development team** - With logs and error details

## Related Files

- Migration: `server/migrations/add-user-location-fields.ts`
- Rollback: `server/migrations/rollback-user-location-fields.ts`
- Schema: `prisma/schema.prisma`
- Context: `client/src/contexts/LocationContext.tsx`
- API: `server/routes.ts` (location endpoints)

---

**Last Updated:** December 2024  
**Database:** PostgreSQL  
**Risk Level:** LOW (non-destructive, idempotent, with rollback)
