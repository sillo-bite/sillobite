/**
 * Migration Script: Add Indexed Fields to Existing Payment Records
 * 
 * This script migrates existing payment records to include indexed fields
 * (razorpayOrderId, razorpayPaymentId, checkoutSessionId) extracted from metadata.
 * 
 * Run with: node scripts/migrate-payment-indexed-fields.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/canteen';

// Payment Schema (simplified for migration)
const PaymentSchema = new mongoose.Schema({
  merchantTransactionId: String,
  razorpayTransactionId: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  checkoutSessionId: String,
  metadata: String,
  status: String,
  amount: Number,
  createdAt: Date,
  updatedAt: Date
}, { strict: false });

const Payment = mongoose.model('Payment', PaymentSchema);

async function migratePayments() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all payments
    const payments = await Payment.find({});
    console.log(`📊 Found ${payments.length} payment records`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const payment of payments) {
      try {
        // Skip if already has indexed fields
        if (payment.razorpayOrderId && payment.checkoutSessionId) {
          skippedCount++;
          continue;
        }

        // Parse metadata
        if (!payment.metadata) {
          console.log(`⚠️ Payment ${payment.merchantTransactionId} has no metadata, skipping`);
          skippedCount++;
          continue;
        }

        let metadata;
        try {
          metadata = typeof payment.metadata === 'string' 
            ? JSON.parse(payment.metadata) 
            : payment.metadata;
        } catch (e) {
          console.error(`❌ Failed to parse metadata for ${payment.merchantTransactionId}:`, e.message);
          errorCount++;
          continue;
        }

        // Extract fields from metadata
        const updates = {};
        let hasUpdates = false;

        if (metadata.razorpayOrderId && !payment.razorpayOrderId) {
          updates.razorpayOrderId = metadata.razorpayOrderId;
          hasUpdates = true;
        }

        if (metadata.checkoutSessionId && !payment.checkoutSessionId) {
          updates.checkoutSessionId = metadata.checkoutSessionId;
          hasUpdates = true;
        }

        // razorpayPaymentId might be in razorpayTransactionId
        if (payment.razorpayTransactionId && !payment.razorpayPaymentId) {
          updates.razorpayPaymentId = payment.razorpayTransactionId;
          hasUpdates = true;
        }

        if (hasUpdates) {
          await Payment.updateOne(
            { _id: payment._id },
            { $set: updates }
          );
          
          console.log(`✅ Updated payment ${payment.merchantTransactionId}:`, updates);
          updatedCount++;
        } else {
          skippedCount++;
        }

      } catch (error) {
        console.error(`❌ Error processing payment ${payment.merchantTransactionId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total payments: ${payments.length}`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // Create indexes
    console.log('\n🔧 Creating indexes...');
    await Payment.collection.createIndex({ razorpayOrderId: 1 });
    await Payment.collection.createIndex({ razorpayPaymentId: 1 });
    await Payment.collection.createIndex({ checkoutSessionId: 1 });
    console.log('✅ Indexes created successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration
migratePayments()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
