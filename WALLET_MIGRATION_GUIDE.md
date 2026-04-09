# Wallet System Migration Guide

## For Existing Installations

If you're adding the wallet system to an existing SilloBite installation, follow this guide.

## Pre-Migration Checklist

- [ ] Backup your PostgreSQL database
- [ ] Backup your `.env` file
- [ ] Note current user count
- [ ] Verify PostgreSQL is running
- [ ] Have Razorpay credentials ready

## Migration Steps

### Step 1: Backup Database

```bash
# PostgreSQL backup
pg_dump -U your_username -d your_database > backup_before_wallet_$(date +%Y%m%d).sql

# Or using Docker
docker exec your_postgres_container pg_dump -U your_username your_database > backup_before_wallet_$(date +%Y%m%d).sql
```

### Step 2: Update Code

```bash
# Pull latest changes
git pull origin main

# Or if you're manually updating, ensure you have:
# - Updated prisma/schema.prisma
# - New server/services/walletService.ts
# - New server/routes/wallet.ts
# - Updated server/routes.ts
# - New client/src/components/profile/WalletCard.tsx
# - Updated client/src/components/profile/ProfilePage.tsx
```

### Step 3: Install Dependencies

```bash
npm install decimal.js
```

### Step 4: Update Environment Variables

Add to your `.env` file:

```env
# Razorpay Configuration (if not already present)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Step 5: Run Migration

```bash
# Development
npx prisma migrate dev --name add_wallet_system

# Production
npx prisma migrate deploy
```

Expected output:
```
✔ Generated Prisma Client
✔ Applied migration: 20240101000000_add_wallet_system
```

### Step 6: Generate Prisma Client

```bash
npx prisma generate
```

### Step 7: Verify Migration

```bash
# Check if tables were created
psql -U your_username -d your_database -c "\dt wallets"
psql -U your_username -d your_database -c "\dt wallet_transactions"
```

Expected output:
```
              List of relations
 Schema |        Name         | Type  |  Owner   
--------+---------------------+-------+----------
 public | wallets             | table | postgres
 public | wallet_transactions | table | postgres
```

### Step 8: Restart Server

```bash
# Development
npm run dev

# Production
pm2 restart your-app
# or
systemctl restart your-service
```

### Step 9: Verify Installation

1. Open your application
2. Navigate to Profile page
3. Check if "Wallet" section appears
4. Click "Add Money"
5. Try a test transaction (use Razorpay test mode)

## Post-Migration Verification

### Database Verification

```sql
-- Check wallets table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'wallets';

-- Check wallet_transactions table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'wallet_transactions';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('wallets', 'wallet_transactions');
```

### API Verification

```bash
# Test wallet endpoint (replace USER_ID with actual user ID)
curl http://localhost:5000/api/wallet/1

# Expected response:
# {
#   "wallet": {
#     "id": 1,
#     "userId": 1,
#     "balance": "0.00",
#     "currency": "INR",
#     ...
#   },
#   "stats": {...}
# }
```

### UI Verification

- [ ] Wallet card displays on profile page
- [ ] Balance shows ₹0.00 for new wallets
- [ ] "Add Money" button works
- [ ] Quick amounts (₹100, ₹200, etc.) work
- [ ] Razorpay checkout opens
- [ ] Transaction history is accessible

## Rollback Procedure

If something goes wrong, you can rollback:

### Option 1: Rollback Migration

```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back 20240101000000_add_wallet_system

# Drop wallet tables manually
psql -U your_username -d your_database
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
```

### Option 2: Restore from Backup

```bash
# Restore PostgreSQL backup
psql -U your_username -d your_database < backup_before_wallet_20240101.sql

# Or using Docker
docker exec -i your_postgres_container psql -U your_username your_database < backup_before_wallet_20240101.sql
```

### Option 3: Revert Code Changes

```bash
# Revert to previous commit
git revert HEAD

# Or checkout previous version
git checkout previous_commit_hash

# Reinstall dependencies
npm install

# Regenerate Prisma client
npx prisma generate
```

## Troubleshooting

### Migration Fails

**Error: "relation already exists"**
```bash
# Drop existing tables
psql -U your_username -d your_database
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;

# Run migration again
npx prisma migrate dev --name add_wallet_system
```

**Error: "DATABASE_URL not found"**
```bash
# Verify .env file exists
cat .env | grep DATABASE_URL

# If missing, add it
echo "DATABASE_URL=postgresql://..." >> .env
```

### Prisma Client Issues

**Error: "Cannot find module '@prisma/client'"**
```bash
npm install @prisma/client
npx prisma generate
```

**Error: "Type 'Decimal' is not assignable"**
```bash
npm install decimal.js
npm install @types/decimal.js --save-dev
```

### Runtime Errors

**Error: "walletService is not defined"**
- Check if `server/services/walletService.ts` exists
- Verify import in routes: `import walletRoutes from './routes/wallet.js'`
- Restart server

**Error: "Cannot read property 'balance' of null"**
- Wallet not created for user
- Check if `getOrCreateWallet()` is called
- Verify user ID is correct

## Data Migration (If Needed)

If you have existing balance data to migrate:

```sql
-- Example: Migrate from old balance system
INSERT INTO wallets (user_id, balance, currency, is_active, created_at, updated_at)
SELECT 
  id as user_id,
  COALESCE(old_balance, 0) as balance,
  'INR' as currency,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM users
WHERE old_balance IS NOT NULL AND old_balance > 0;

-- Create initial transaction records
INSERT INTO wallet_transactions (
  wallet_id, user_id, type, amount, 
  balance_before, balance_after, 
  description, status, created_at
)
SELECT 
  w.id as wallet_id,
  w.user_id,
  'CREDIT' as type,
  w.balance as amount,
  0 as balance_before,
  w.balance as balance_after,
  'Initial balance migration' as description,
  'COMPLETED' as status,
  NOW() as created_at
FROM wallets w
WHERE w.balance > 0;
```

## Performance Optimization

After migration, optimize for performance:

```sql
-- Analyze tables for query optimization
ANALYZE wallets;
ANALYZE wallet_transactions;

-- Vacuum tables
VACUUM ANALYZE wallets;
VACUUM ANALYZE wallet_transactions;

-- Check index usage
SELECT 
  schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename IN ('wallets', 'wallet_transactions')
ORDER BY idx_scan DESC;
```

## Monitoring

Set up monitoring for wallet operations:

```sql
-- Create view for wallet monitoring
CREATE OR REPLACE VIEW wallet_monitoring AS
SELECT 
  COUNT(DISTINCT w.id) as total_wallets,
  COUNT(DISTINCT CASE WHEN w.balance > 0 THEN w.id END) as active_wallets,
  SUM(w.balance) as total_balance,
  AVG(w.balance) as avg_balance,
  COUNT(wt.id) as total_transactions,
  COUNT(CASE WHEN wt.status = 'PENDING' THEN 1 END) as pending_transactions,
  COUNT(CASE WHEN wt.status = 'FAILED' THEN 1 END) as failed_transactions
FROM wallets w
LEFT JOIN wallet_transactions wt ON w.id = wt.wallet_id;

-- Query monitoring view
SELECT * FROM wallet_monitoring;
```

## Security Audit

After migration, verify security:

- [ ] Razorpay keys are in `.env` (not hardcoded)
- [ ] `.env` is in `.gitignore`
- [ ] Webhook secret is configured
- [ ] HTTPS is enabled in production
- [ ] Database backups are automated
- [ ] Transaction logs are monitored

## Production Deployment

### Pre-deployment

1. Test thoroughly in staging
2. Verify all environment variables
3. Test Razorpay integration
4. Check webhook configuration
5. Review security settings

### Deployment

```bash
# 1. Backup production database
pg_dump -U prod_user -d prod_db > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Deploy code
git pull origin main
npm install

# 3. Run migration
npx prisma migrate deploy

# 4. Generate client
npx prisma generate

# 5. Build frontend
npm run build

# 6. Restart server
pm2 restart your-app

# 7. Verify
curl https://your-domain.com/api/health
```

### Post-deployment

1. Monitor server logs
2. Check error rates
3. Verify wallet creation for new users
4. Test payment flow
5. Monitor Razorpay dashboard

## Support

If you encounter issues:

1. Check logs: `tail -f logs/app.log`
2. Review migration status: `npx prisma migrate status`
3. Verify database: `psql -U user -d db -c "SELECT * FROM wallets LIMIT 1;"`
4. Test API: `curl http://localhost:5000/api/wallet/1`
5. Check documentation: `WALLET_SYSTEM_DOCUMENTATION.md`

## Success Criteria

Migration is successful when:

- ✅ All tables created without errors
- ✅ Indexes are in place
- ✅ Wallet card appears on profile page
- ✅ Test payment completes successfully
- ✅ Balance updates correctly
- ✅ Transaction history displays
- ✅ No errors in server logs
- ✅ All existing features still work

## Timeline

Estimated migration time:
- Small installation (<100 users): 15-30 minutes
- Medium installation (100-1000 users): 30-60 minutes
- Large installation (>1000 users): 1-2 hours

## Maintenance Window

Recommended maintenance window:
- Development: No downtime needed
- Production: 15-30 minutes downtime recommended

## Communication Template

Email to users:

```
Subject: System Maintenance - New Wallet Feature

Dear Users,

We're excited to announce a new wallet feature that will make payments faster and more convenient!

Maintenance Window: [Date] [Time] - [Time]
Expected Downtime: 15-30 minutes

What's New:
- Digital wallet for faster payments
- Add money via Razorpay
- View transaction history
- Secure and convenient

The system will be briefly unavailable during the update. We apologize for any inconvenience.

Thank you for your patience!
```

---

**Need Help?** Contact support or check `WALLET_SYSTEM_DOCUMENTATION.md`
