const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');

const prisma = new PrismaClient();

async function getTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Get user with ID 3 (from your logs)
    const user = await prisma.user.findUnique({
      where: { id: 3 }
    });
    
    if (!user) {
      console.log('User ID 3 not found, trying first user...');
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        console.log('\n📧 User Found:');
        console.log(JSON.stringify({
          id: firstUser.id,
          email: firstUser.email,
          name: firstUser.name
        }, null, 2));
      }
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
      console.log('\n🔑 Access Token Found:');
      console.log(accessToken);
    } else {
      console.log('\n⚠️ No access token found - generating placeholder');
      console.log('You can generate one by:');
      console.log('1. Going to Profile page');
      console.log('2. Finding the Connection Code section');
      console.log('3. Generating a new code');
    }
    
    // Get menu items from MongoDB - check collection name
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📚 Available Collections:');
    collections.forEach(c => console.log(`  - ${c.name}`));
    
    // Try both collection names
    const MenuItemSchema = new mongoose.Schema({}, { strict: false });
    let menuItems = [];
    
    // Try 'menu_items' first
    try {
      const MenuItem1 = mongoose.model('MenuItem1', MenuItemSchema, 'menu_items');
      menuItems = await MenuItem1.find({ isAvailable: true }).limit(5).lean();
      console.log(`\n🍽️ Found ${menuItems.length} items in 'menu_items' collection`);
    } catch (e) {
      console.log('⚠️ Error with menu_items:', e.message);
    }
    
    // If empty, try 'menuitems'
    if (menuItems.length === 0) {
      try {
        const MenuItem2 = mongoose.model('MenuItem2', MenuItemSchema, 'menuitems');
        menuItems = await MenuItem2.find({ isAvailable: true }).limit(5).lean();
        console.log(`🍽️ Found ${menuItems.length} items in 'menuitems' collection`);
      } catch (e) {
        console.log('⚠️ Error with menuitems:', e.message);
      }
    }
    
    // If still empty, try without isAvailable filter
    if (menuItems.length === 0) {
      try {
        const MenuItem3 = mongoose.model('MenuItem3', MenuItemSchema, 'menuitems');
        menuItems = await MenuItem3.find({}).limit(5).lean();
        console.log(`🍽️ Found ${menuItems.length} items (any status) in 'menuitems' collection`);
      } catch (e) {
        console.log('⚠️ Error:', e.message);
      }
    }
    
    if (menuItems.length > 0) {
      console.log('\nAvailable Menu Items:');
      menuItems.forEach(item => {
        console.log(`  - ${item.name} (ID: ${item.id || item._id}, Price: ₹${item.price}, Canteen: ${item.canteenId}, Available: ${item.isAvailable})`);
      });
      
      // Use _id if id is not available
      const getItemId = (item) => item.id || item._id.toString();
      
      // Create test request body
      const testBody = {
        email: user.email,
        accessToken: accessToken || 'GENERATE_TOKEN_FROM_PROFILE_PAGE',
        menus: menuItems.slice(0, 2).map(item => [getItemId(item), 2]), // 2 of each item
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
        const balance = parseFloat(wallet.balance.toString());
        if (balance >= total) {
          console.log('✅ Sufficient balance for this order');
        } else {
          const needed = total - balance;
          console.log(`❌ Insufficient balance - need ₹${needed.toFixed(2)} more`);
          console.log(`   Add money via: http://localhost:5000/app (Profile > Wallet > Add Money)`);
        }
      } else {
        console.log('⚠️ No wallet found - will be created automatically');
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('📝 POSTMAN SETUP');
      console.log('='.repeat(60));
      console.log('Method: POST');
      console.log('URL: http://localhost:5000/api/carebite/create-order');
      console.log('Headers:');
      console.log('  Content-Type: application/json');
      console.log('\nBody (raw JSON):');
      console.log(JSON.stringify(testBody, null, 2));
      console.log('='.repeat(60));
      
    } else {
      console.log('\n❌ No menu items found in database');
      console.log('Please add menu items through the admin panel first');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}

getTestData();
