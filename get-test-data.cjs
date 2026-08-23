const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');

const prisma = new PrismaClient();

async function getTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Get a user
    const user = await prisma.user.findFirst({
      where: { 
        email: { contains: '@' }
      }
    });
    
    if (!user) {
      console.log('No user found');
      return;
    }
    
    console.log('\n📧 User Found:');
    console.log(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name
    }, null, 2));
    
    // Get access token for this user
    const tokenResult = await prisma.$queryRaw`
      SELECT token FROM api_tokens WHERE user_id = ${user.id} LIMIT 1
    `;
    
    const accessToken = tokenResult.length > 0 ? tokenResult[0].token : null;
    
    if (accessToken) {
      console.log('\n🔑 Access Token:');
      console.log(accessToken);
    } else {
      console.log('\n⚠️ No access token found for this user');
    }
    
    // Get menu items from MongoDB
    const MenuItem = mongoose.model('MenuItem', new mongoose.Schema({}, { strict: false }), 'menu_items');
    const menuItems = await MenuItem.find({ isAvailable: true }).limit(3).lean();
    
    if (menuItems.length > 0) {
      console.log('\n🍽️ Available Menu Items:');
      menuItems.forEach(item => {
        console.log(`  - ${item.name} (ID: ${item.id}, Price: ₹${item.price}, Canteen: ${item.canteenId})`);
      });
      
      // Create test request body
      const testBody = {
        email: user.email,
        accessToken: accessToken || 'YOUR_ACCESS_TOKEN_HERE',
        menus: menuItems.slice(0, 2).map(item => [item.id, 2]), // 2 of each item
        canteenId: menuItems[0].canteenId
      };
      
      console.log('\n📦 Test Request Body:');
      console.log(JSON.stringify(testBody, null, 2));
      
      // Calculate expected total
      const total = menuItems.slice(0, 2).reduce((sum, item) => sum + (item.price * 2), 0);
      console.log(`\n💰 Expected Total: ₹${total}`);
      
      // Check wallet balance
      const wallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });
      
      if (wallet) {
        console.log(`💳 Current Wallet Balance: ₹${wallet.balance}`);
        if (parseFloat(wallet.balance.toString()) >= total) {
          console.log('✅ Sufficient balance for this order');
        } else {
          console.log('❌ Insufficient balance - need to top up wallet first');
        }
      } else {
        console.log('⚠️ No wallet found for this user');
      }
      
      console.log('\n📝 Postman Setup:');
      console.log('URL: POST http://localhost:5000/api/carebite/create-order');
      console.log('Headers: Content-Type: application/json');
      console.log('Body: (Copy the JSON above)');
      
    } else {
      console.log('\n❌ No menu items found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}

getTestData();
