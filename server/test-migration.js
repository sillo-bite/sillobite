// Simple test script to manually add canteenId to one payment
const mongoose = require('mongoose');

// Connect to MongoDB Atlas (using the same connection as the server)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://steepanraj:steepanraj@cluster0.8qjqj.mongodb.net/test?retryWrites=true&w=majority';

async function testMigration() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get the Payment model
    const Payment = mongoose.model('Payment', new mongoose.Schema({}, { strict: false }));
    
    // Find the first payment without canteenId
    const payment = await Payment.findOne({ canteenId: { $exists: false } });
    
    if (payment) {
      console.log(`📊 Found payment: ${payment.merchantTransactionId}`);
      
      // Update it with canteenId
      await Payment.findByIdAndUpdate(payment._id, {
        canteenId: 'canteen-1758205071111'
      });
      
      console.log('✅ Updated payment with canteenId');
      
      // Test the API endpoint
      console.log('🧪 Testing API endpoint...');
      const response = await fetch('http://localhost:5000/api/canteens/canteen-1758205071111/payments');
      const data = await response.json();
      console.log('📊 API Response:', data);
      
    } else {
      console.log('❌ No payments found without canteenId');
    }
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testMigration();






