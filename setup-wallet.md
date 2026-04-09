# Wallet System Setup Guide

## Prerequisites

Before setting up the wallet system, ensure you have:

1. PostgreSQL database configured
2. Razorpay account (for payment processing)
3. Node.js 18+ installed
4. All dependencies installed (`npm install`)

## Step 1: Configure Environment Variables

Add the following to your `.env` file:

```env
# Database (if not already configured)
DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name

# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Getting Razorpay Credentials

1. Sign up at https://razorpay.com/
2. Go to Settings > API Keys
3. Generate Test/Live API keys
4. Copy Key ID and Key Secret
5. For webhook secret:
   - Go to Settings > Webhooks
   - Create a new webhook with URL: `https://your-domain.com/api/wallet/webhook`
   - Copy the webhook secret

## Step 2: Run Database Migration

Run the Prisma migration to create wallet tables:

```bash
# Development
npx prisma migrate dev --name add_wallet_system

# Production
npx prisma migrate deploy
```

This will create:
- `wallets` table
- `wallet_transactions` table
- Required indexes for performance

## Step 3: Generate Prisma Client

```bash
npx prisma generate
```

## Step 4: Verify Installation

1. Start your development server:
```bash
npm run dev
```

2. Navigate to the profile page
3. You should see the "Wallet" section with a wallet card
4. Try adding money to test the integration

## Step 5: Configure Razorpay Webhook (Production)

1. Go to Razorpay Dashboard > Settings > Webhooks
2. Add webhook URL: `https://your-domain.com/api/wallet/webhook`
3. Select events:
   - `payment.captured`
   - `payment.failed`
4. Set the webhook secret in your `.env` file
5. Test the webhook using Razorpay's test mode

## Verification Checklist

- [ ] Database migration completed successfully
- [ ] Razorpay credentials configured
- [ ] Wallet card appears on profile page
- [ ] Can view wallet balance (₹0 initially)
- [ ] "Add Money" button opens dialog
- [ ] Quick amount buttons work
- [ ] Razorpay checkout opens when clicking "Proceed to Pay"
- [ ] Test payment completes successfully
- [ ] Balance updates after payment
- [ ] Transaction appears in history

## Testing in Development

### Test Mode Payment

Razorpay provides test cards for development:

1. **Successful Payment**
   - Card: 4111 1111 1111 1111
   - CVV: Any 3 digits
   - Expiry: Any future date

2. **Failed Payment**
   - Card: 4000 0000 0000 0002
   - CVV: Any 3 digits
   - Expiry: Any future date

### Test Workflow

1. Click "Add Money" on wallet card
2. Enter amount (e.g., ₹100)
3. Click "Proceed to Pay"
4. Use test card details
5. Complete payment
6. Verify balance updates
7. Check transaction history

## Troubleshooting

### Migration Fails

**Error: DATABASE_URL not found**
- Ensure `.env` file exists in root directory
- Verify DATABASE_URL is set correctly
- Check PostgreSQL is running

**Error: Connection refused**
- Verify PostgreSQL is running
- Check database credentials
- Ensure database exists

### Razorpay Issues

**Checkout not opening**
- Check browser console for errors
- Verify RAZORPAY_KEY_ID is set
- Ensure Razorpay script is loaded

**Payment verification fails**
- Verify RAZORPAY_KEY_SECRET is correct
- Check server logs for signature errors
- Ensure webhook secret matches

### Balance Not Updating

1. Check server logs for errors
2. Verify transaction status in database:
```sql
SELECT * FROM wallet_transactions WHERE user_id = YOUR_USER_ID ORDER BY created_at DESC;
```
3. Check wallet balance:
```sql
SELECT * FROM wallets WHERE user_id = YOUR_USER_ID;
```

## Database Schema

After migration, you'll have these tables:

### wallets
```sql
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### wallet_transactions
```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL, -- CREDIT or DEBIT
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(255),
  payment_method VARCHAR(50),
  payment_id VARCHAR(255),
  order_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'PENDING',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Next Steps

After successful setup:

1. **Test thoroughly** in development mode
2. **Configure production** Razorpay keys
3. **Set up webhook** in production
4. **Monitor transactions** in Razorpay dashboard
5. **Implement order payment** with wallet (Phase 2)

## Support

For issues:
1. Check `WALLET_SYSTEM_DOCUMENTATION.md` for detailed API docs
2. Review server logs for errors
3. Check Razorpay dashboard for payment status
4. Verify database tables were created correctly

## Security Notes

- Never commit `.env` file to version control
- Use test mode keys in development
- Rotate production keys regularly
- Monitor webhook logs for suspicious activity
- Set up rate limiting for API endpoints
- Enable 2FA on Razorpay account

## Production Deployment

Before deploying to production:

1. Switch to live Razorpay keys
2. Update webhook URL to production domain
3. Test with small amounts first
4. Set up monitoring and alerts
5. Configure backup and recovery
6. Document rollback procedure

## Maintenance

Regular maintenance tasks:

1. Monitor transaction logs
2. Check for failed transactions
3. Reconcile with Razorpay dashboard
4. Archive old transactions (optional)
5. Update Razorpay SDK if needed
6. Review and optimize database indexes

---

**Setup Complete!** 🎉

Your wallet system is now ready to use. Users can add money to their wallets and view transaction history. The next phase will enable using wallet balance for order payments.
