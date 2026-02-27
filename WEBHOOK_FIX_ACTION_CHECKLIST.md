# Webhook Reliability Fix - Action Checklist

## Immediate Actions Required

### ☐ 1. Deploy Code Changes
```bash
# Restart your server to apply the changes
pm2 restart all
# OR
npm run dev  # if in development
```

### ☐ 2. Run Migration Script
```bash
# This will update existing payment records with indexed fields
node scripts/migrate-payment-indexed-fields.js
```

**Expected time:** 1-5 minutes (depending on number of payment records)

### ☐ 3. Verify Indexes Created
```bash
# Connect to MongoDB and verify indexes
mongosh <your-mongodb-uri>

# In MongoDB shell:
use canteen
db.payments.getIndexes()
```

**Look for these indexes:**
- `razorpayOrderId_1`
- `razorpayPaymentId_1`
- `checkoutSessionId_1`

---

## Testing (Recommended)

### ☐ 4. Test a Payment Flow
1. Create a new order
2. Initiate payment
3. Complete payment (or use Razorpay test mode)
4. Verify webhook processes successfully
5. Check logs for fast processing time (<10ms)

### ☐ 5. Check for Failed Webhooks
```bash
# In MongoDB shell:
db.webhooklogs.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(10)
```

If you see the failed webhook from earlier (`pay_SKhdLeMhw4qTAI`), you can investigate it now.

---

## Monitoring (Next 24 Hours)

### ☐ 6. Monitor Webhook Processing
Watch your server logs for:
- ✅ Fast lookups: "Found payment by razorpayOrderId"
- ⚠️ Slow fallbacks: "Indexed lookup failed, falling back to metadata search"
- ❌ Failures: "No local payment record found"

### ☐ 7. Check Webhook Log Collection
```bash
# Count failed webhooks
db.webhooklogs.countDocuments({ status: 'failed' })

# Should be near zero for new webhooks
```

---

## Troubleshooting

### If Migration Fails:
- Check MongoDB connection string in `.env`
- Ensure MongoDB is running
- Check for permission issues

### If Webhooks Still Fail:
1. Check if payment record was created before webhook arrived
2. Verify `razorpayOrderId` is stored in payment record
3. Check webhook logs in `webhooklogs` collection
4. Review server logs for detailed error messages

### If Performance Doesn't Improve:
1. Verify indexes were created: `db.payments.getIndexes()`
2. Check if migration script completed successfully
3. Ensure new payments have indexed fields

---

## Success Criteria

✅ Migration script completes without errors
✅ Indexes are created on Payment collection
✅ New payments have `razorpayOrderId` and `checkoutSessionId` fields
✅ Webhook processing time <10ms (check logs)
✅ No failed webhooks in last 24 hours
✅ All test payments process successfully

---

## Need Help?

If you encounter issues:
1. Check `WEBHOOK_RELIABILITY_FIX_COMPLETE.md` for detailed documentation
2. Review `WEBHOOK_RELIABILITY_ANALYSIS.md` for technical details
3. Check server logs for error messages
4. Query `webhooklogs` collection for failed webhooks

---

## Estimated Time

- Code deployment: 1 minute
- Migration script: 1-5 minutes
- Testing: 5-10 minutes
- **Total: 10-15 minutes**

---

## Next Steps After 24 Hours

If everything is working well:
- ✅ Mark this issue as resolved
- ✅ Remove old documentation files (optional)
- ✅ Set up monitoring alerts for webhook failures
- ✅ Consider implementing automatic retry mechanism (future enhancement)

If issues persist:
- Review failed webhook logs
- Check for patterns in failures
- Consider implementing additional fallback mechanisms
