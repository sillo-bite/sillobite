import mongoose from 'mongoose';
import { connectToMongoDB } from '../mongodb.js';
import { Payment, Order } from '../models/mongodb-models.js';

/**
 * Migration script to add canteenId to existing payments
 * This script will:
 * 1. Find all payments without canteenId
 * 2. Get the canteenId from their associated orders
 * 3. Update the payments with the canteenId
 * 4. For payments without orders, assign them to the default canteen
 */

const DEFAULT_CANTEEN_ID = 'canteen-1758205071111';

export async function migratePaymentsCanteen() {
  try {
    console.log('🔄 Starting payments canteen migration...');
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Find all payments without canteenId
    const paymentsWithoutCanteen = await Payment.find({ 
      canteenId: { $exists: false } 
    });
    
    console.log(`📊 Found ${paymentsWithoutCanteen.length} payments without canteenId`);
    
    let updatedCount = 0;
    let defaultAssignedCount = 0;
    
    for (const payment of paymentsWithoutCanteen) {
      try {
        if (payment.orderId) {
          // Get the order to find its canteenId
          const order = await Order.findById(payment.orderId);
          
          if (order && order.canteenId) {
            // Update payment with the order's canteenId
            await Payment.findByIdAndUpdate(payment._id, {
              canteenId: order.canteenId
            });
            updatedCount++;
            console.log(`✅ Updated payment ${payment.merchantTransactionId} with canteenId: ${order.canteenId}`);
          } else {
            // Order not found or doesn't have canteenId, assign to default
            await Payment.findByIdAndUpdate(payment._id, {
              canteenId: DEFAULT_CANTEEN_ID
            });
            defaultAssignedCount++;
            console.log(`⚠️ Payment ${payment.merchantTransactionId} assigned to default canteen (order not found or no canteenId)`);
          }
        } else {
          // Payment has no orderId, assign to default canteen
          await Payment.findByIdAndUpdate(payment._id, {
            canteenId: DEFAULT_CANTEEN_ID
          });
          defaultAssignedCount++;
          console.log(`⚠️ Payment ${payment.merchantTransactionId} assigned to default canteen (no orderId)`);
        }
      } catch (error) {
        console.error(`❌ Error updating payment ${payment.merchantTransactionId}:`, error);
      }
    }
    
    console.log('🎉 Payments canteen migration completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Updated from orders: ${updatedCount}`);
    console.log(`   - Assigned to default canteen: ${defaultAssignedCount}`);
    console.log(`   - Total processed: ${updatedCount + defaultAssignedCount}`);
    
    return {
      success: true,
      updatedFromOrders: updatedCount,
      assignedToDefault: defaultAssignedCount,
      totalProcessed: updatedCount + defaultAssignedCount
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePaymentsCanteen()
    .then((result) => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
