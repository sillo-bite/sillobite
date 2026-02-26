/**
 * Migration Script: Fix Coupon Usage Data
 * 
 * This script fixes coupon usage tracking for orders that were created
 * but didn't have their coupon usage tracked properly.
 * 
 * Run this script ONCE after deploying the coupon fix.
 * 
 * Usage:
 *   node scripts/fix-coupon-data.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function fixCouponData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const couponsCollection = db.collection('coupons');
    const ordersCollection = db.collection('orders');

    // Step 1: Find all coupons
    console.log('\n📋 Finding all coupons...');
    const coupons = await couponsCollection.find({}).toArray();
    console.log(`Found ${coupons.length} coupons`);

    let fixedCount = 0;
    let skippedCount = 0;

    // Step 2: For each coupon, find orders that used it
    for (const coupon of coupons) {
      console.log(`\n🎟️  Processing coupon: ${coupon.code}`);
      
      // Find all orders that used this coupon
      const orders = await ordersCollection.find({ 
        appliedCoupon: coupon.code 
      }).toArray();

      if (orders.length === 0) {
        console.log(`   No orders found for coupon ${coupon.code}`);
        skippedCount++;
        continue;
      }

      console.log(`   Found ${orders.length} orders using this coupon`);

      // Extract unique user IDs (ensure they're numbers)
      const userIds = [...new Set(orders.map(o => Number(o.customerId)))];
      
      // Build usage history
      const usageHistory = orders.map(o => ({
        userId: Number(o.customerId),
        orderId: o._id,
        orderNumber: o.orderNumber,
        discountAmount: o.discountAmount || 0,
        usedAt: o.createdAt || new Date()
      }));

      // Check if data needs fixing
      const needsFix = 
        coupon.usedCount !== orders.length ||
        coupon.usedBy.length !== userIds.length ||
        coupon.usageHistory.length !== orders.length;

      if (!needsFix) {
        console.log(`   ✅ Coupon ${coupon.code} data is already correct`);
        skippedCount++;
        continue;
      }

      console.log(`   🔧 Fixing coupon ${coupon.code}:`);
      console.log(`      Old: usedCount=${coupon.usedCount}, usedBy=${coupon.usedBy.length}, history=${coupon.usageHistory.length}`);
      console.log(`      New: usedCount=${orders.length}, usedBy=${userIds.length}, history=${orders.length}`);

      // Update the coupon
      const result = await couponsCollection.updateOne(
        { _id: coupon._id },
        {
          $set: {
            usedCount: orders.length,
            usedBy: userIds,
            usageHistory: usageHistory
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`   ✅ Fixed coupon ${coupon.code}`);
        fixedCount++;
      } else {
        console.log(`   ⚠️  Failed to update coupon ${coupon.code}`);
      }
    }

    // Step 3: Fix type mismatches in usedBy arrays
    console.log('\n🔧 Checking for type mismatches in usedBy arrays...');
    const couponsWithStringIds = await couponsCollection.find({
      usedBy: { $type: 'string' }
    }).toArray();

    if (couponsWithStringIds.length > 0) {
      console.log(`Found ${couponsWithStringIds.length} coupons with string IDs in usedBy array`);
      
      for (const coupon of couponsWithStringIds) {
        const numericIds = coupon.usedBy.map(id => Number(id));
        await couponsCollection.updateOne(
          { _id: coupon._id },
          { $set: { usedBy: numericIds } }
        );
        console.log(`   ✅ Fixed type mismatch for coupon ${coupon.code}`);
        fixedCount++;
      }
    } else {
      console.log('   ✅ No type mismatches found');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total coupons processed: ${coupons.length}`);
    console.log(`Coupons fixed: ${fixedCount}`);
    console.log(`Coupons skipped (already correct): ${skippedCount}`);
    console.log('='.repeat(50));

    console.log('\n✅ Migration completed successfully');
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the migration
fixCouponData();
