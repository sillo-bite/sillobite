const mongoose = require('mongoose');

// MongoDB connection string (update this to match your setup)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kit_sillobyte';

const DEFAULT_CANTEEN_ID = 'canteen-1758205071111';

async function migratePaymentsCanteen() {
  try {
    console.log('🔄 Starting payments canteen migration...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get the Payment and Order models
    const Payment = mongoose.model('Payment', new mongoose.Schema({}, { strict: false }));
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    
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
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePaymentsCanteen();






