# 📋 Wallet System Setup Checklist

Use this checklist to ensure proper wallet system setup and deployment.

## ✅ Pre-Setup Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL database running
- [ ] Razorpay account created
- [ ] Project dependencies installed (`npm install`)
- [ ] `.env` file exists in root directory

## 🔧 Configuration Checklist

### Environment Variables
- [ ] `DATABASE_URL` configured in `.env`
- [ ] `RAZORPAY_KEY_ID` added to `.env`
- [ ] `RAZORPAY_KEY_SECRET` added to `.env`
- [ ] `RAZORPAY_WEBHOOK_SECRET` added to `.env` (optional for development)
- [ ] `.env` file is in `.gitignore`

### Razorpay Setup
- [ ] Signed up at https://razorpay.com/
- [ ] Generated Test Mode API keys
- [ ] Copied Key ID and Key Secret
- [ ] (Production) Generated Live Mode API keys
- [ ] (Production) Configured webhook URL
- [ ] (Production) Copied webhook secret

## 🗄️ Database Setup Checklist

- [ ] PostgreSQL is running
- [ ] Database connection tested
- [ ] Backup taken (if existing installation)
- [ ] `decimal.js` package installed (`npm install decimal.js`)
- [ ] Prisma schema updated with wallet models
- [ ] Migration created (`npx prisma migrate dev --name add_wallet_system`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Tables created successfully:
  - [ ] `wallets` table exists
  - [ ] `wallet_transactions` table exists
- [ ] Indexes created successfully
- [ ] Foreign key constraints in place

## 💻 Code Integration Checklist

### Backend
- [ ] `server/services/walletService.ts` created
- [ ] `server/routes/wallet.ts` created
- [ ] Wallet routes imported in `server/routes.ts`
- [ ] Wallet routes mounted at `/api/wallet`
- [ ] No TypeScript compilation errors
- [ ] Service methods accessible

### Frontend
- [ ] `client/src/components/profile/WalletCard.tsx` created
- [ ] WalletCard imported in ProfilePage
- [ ] Wallet section added to ProfilePage
- [ ] Component renders without errors
- [ ] Razorpay script loads correctly

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Server starts without errors
- [ ] Navigate to profile page successfully
- [ ] Wallet section appears on profile page
- [ ] Balance displays ₹0.00 for new users
- [ ] "Add Money" button is clickable
- [ ] Add money dialog opens

### Top-up Flow
- [ ] Can enter custom amount
- [ ] Quick amount buttons work (₹100, ₹200, ₹500, ₹1000)
- [ ] Amount validation works:
  - [ ] Rejects amount < ₹10
  - [ ] Rejects amount > ₹10,000
  - [ ] Accepts valid amounts
- [ ] "Proceed to Pay" button works
- [ ] Razorpay checkout opens
- [ ] Can complete test payment with test card
- [ ] Payment success updates balance
- [ ] Payment failure doesn't update balance

### Transaction History
- [ ] "History" button opens dialog
- [ ] Transactions display correctly
- [ ] Transaction details are accurate:
  - [ ] Amount
  - [ ] Type (CREDIT/DEBIT)
  - [ ] Status
  - [ ] Date/time
  - [ ] Description
- [ ] Pagination works (if applicable)
- [ ] Empty state shows when no transactions

### API Endpoints
- [ ] `GET /api/wallet/:userId` returns wallet data
- [ ] `GET /api/wallet/:userId/transactions` returns history
- [ ] `GET /api/wallet/:userId/balance` returns balance
- [ ] `POST /api/wallet/:userId/topup/create-order` creates order
- [ ] `POST /api/wallet/:userId/topup/verify` verifies payment
- [ ] `POST /api/wallet/webhook` handles webhooks

### UI/UX
- [ ] Wallet card displays correctly
- [ ] Balance formatting is correct (₹X.XX)
- [ ] Stats show correct totals
- [ ] Icons display properly
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Loading states work
- [ ] Error messages display

## 🔒 Security Checklist

- [ ] Payment signature verification works
- [ ] Webhook signature verification works
- [ ] Balance validation prevents negative balance
- [ ] Amount limits enforced (₹10 - ₹10,000)
- [ ] Transactions are immutable
- [ ] Sensitive data in environment variables
- [ ] No hardcoded credentials in code
- [ ] HTTPS enabled (production)
- [ ] Rate limiting configured (production)

## 📊 Database Verification

Run these queries to verify:

```sql
-- Check wallets table
- [ ] SELECT * FROM wallets LIMIT 1;

-- Check wallet_transactions table
- [ ] SELECT * FROM wallet_transactions LIMIT 1;

-- Check indexes
- [ ] SELECT indexname FROM pg_indexes WHERE tablename = 'wallets';
- [ ] SELECT indexname FROM pg_indexes WHERE tablename = 'wallet_transactions';

-- Verify constraints
- [ ] SELECT conname FROM pg_constraint WHERE conrelid = 'wallets'::regclass;
- [ ] SELECT conname FROM pg_constraint WHERE conrelid = 'wallet_transactions'::regclass;
```

## 📝 Documentation Checklist

- [ ] Read `WALLET_README.md`
- [ ] Read `setup-wallet.md`
- [ ] Reviewed `WALLET_QUICK_REFERENCE.md`
- [ ] Understand API endpoints
- [ ] Know how to use wallet service
- [ ] Familiar with transaction flow
- [ ] Understand security measures

## 🚀 Pre-Production Checklist

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] No console errors in browser
- [ ] No server errors in logs
- [ ] Code follows project conventions
- [ ] Comments added where needed

### Testing
- [ ] All manual tests passed
- [ ] Test with multiple users
- [ ] Test concurrent transactions
- [ ] Test edge cases:
  - [ ] Insufficient balance
  - [ ] Invalid amounts
  - [ ] Payment failures
  - [ ] Network errors
- [ ] Load testing completed (if applicable)

### Security
- [ ] Security audit completed
- [ ] Penetration testing done (if applicable)
- [ ] Razorpay keys secured
- [ ] Webhook secret secured
- [ ] Database backups configured
- [ ] Monitoring set up

### Documentation
- [ ] API documentation complete
- [ ] User guide created (if needed)
- [ ] Admin guide created (if needed)
- [ ] Troubleshooting guide available
- [ ] Rollback procedure documented

## 🌐 Production Deployment Checklist

### Pre-Deployment
- [ ] Production database backup taken
- [ ] Razorpay live keys ready
- [ ] Webhook URL configured in Razorpay
- [ ] Environment variables set for production
- [ ] SSL/TLS certificates configured
- [ ] Monitoring tools set up
- [ ] Alerting configured

### Deployment
- [ ] Code deployed to production
- [ ] Dependencies installed
- [ ] Database migration run (`npx prisma migrate deploy`)
- [ ] Prisma client generated
- [ ] Frontend built (`npm run build`)
- [ ] Server restarted
- [ ] Health check passed

### Post-Deployment
- [ ] Wallet functionality verified
- [ ] Test transaction completed
- [ ] Logs monitored for errors
- [ ] Razorpay dashboard checked
- [ ] Webhook events verified
- [ ] Performance metrics checked
- [ ] User feedback collected

## 📈 Monitoring Checklist

### Metrics to Track
- [ ] Total wallets created
- [ ] Total balance in system
- [ ] Transaction success rate
- [ ] Transaction failure rate
- [ ] Average transaction amount
- [ ] Webhook delivery rate
- [ ] API response times
- [ ] Error rates

### Alerts to Set Up
- [ ] High transaction failure rate
- [ ] Webhook delivery failures
- [ ] Database connection issues
- [ ] API errors
- [ ] Unusual transaction patterns
- [ ] Low balance warnings (future)

## 🐛 Troubleshooting Checklist

If issues occur, check:

- [ ] Server logs for errors
- [ ] Browser console for errors
- [ ] Database connection
- [ ] Razorpay dashboard for payment status
- [ ] Environment variables are set
- [ ] Prisma client is generated
- [ ] Database tables exist
- [ ] Indexes are created
- [ ] Network connectivity
- [ ] Webhook configuration

## 📞 Support Resources

- [ ] `WALLET_SYSTEM_DOCUMENTATION.md` bookmarked
- [ ] `WALLET_QUICK_REFERENCE.md` accessible
- [ ] `WALLET_MIGRATION_GUIDE.md` reviewed
- [ ] Razorpay support contact saved
- [ ] Database admin contact saved
- [ ] Team members trained

## ✨ Optional Enhancements

- [ ] Add wallet notifications
- [ ] Implement cashback system
- [ ] Add referral bonuses
- [ ] Create admin dashboard
- [ ] Add transaction export
- [ ] Implement auto top-up
- [ ] Add wallet analytics
- [ ] Create mobile app integration

## 🎯 Success Criteria

Mark complete when:

- [ ] All users can create wallets
- [ ] Top-up flow works end-to-end
- [ ] Payments process successfully
- [ ] Balance updates correctly
- [ ] Transaction history is accurate
- [ ] No critical bugs
- [ ] Performance is acceptable
- [ ] Security measures in place
- [ ] Documentation is complete
- [ ] Team is trained

## 📅 Timeline Tracking

| Phase | Task | Estimated Time | Actual Time | Status |
|-------|------|----------------|-------------|--------|
| Setup | Environment configuration | 15 min | | ⏳ |
| Setup | Database migration | 10 min | | ⏳ |
| Setup | Code integration | 5 min | | ⏳ |
| Testing | Basic functionality | 30 min | | ⏳ |
| Testing | Payment flow | 30 min | | ⏳ |
| Testing | Edge cases | 30 min | | ⏳ |
| Security | Security audit | 1 hour | | ⏳ |
| Deploy | Production deployment | 30 min | | ⏳ |
| Monitor | Post-deployment monitoring | 1 hour | | ⏳ |

## 📝 Notes

Use this section to track issues, decisions, or important information:

```
Date: ___________
Issue: ___________________________________________________________
Resolution: _______________________________________________________
___________________________________________________________________

Date: ___________
Issue: ___________________________________________________________
Resolution: _______________________________________________________
___________________________________________________________________

Date: ___________
Issue: ___________________________________________________________
Resolution: _______________________________________________________
___________________________________________________________________
```

## ✅ Final Sign-off

- [ ] All checklist items completed
- [ ] System tested thoroughly
- [ ] Documentation reviewed
- [ ] Team trained
- [ ] Production deployment successful
- [ ] Monitoring in place
- [ ] Ready for users

**Completed by:** ___________________

**Date:** ___________________

**Signature:** ___________________

---

**Status**: ⏳ In Progress / ✅ Complete

**Version**: 1.0.0

**Last Updated**: ___________________

---

🎉 **Congratulations!** Once all items are checked, your wallet system is ready!
