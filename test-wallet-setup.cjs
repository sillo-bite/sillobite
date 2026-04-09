/**
 * Quick test script to verify wallet system setup
 * Run with: node test-wallet-setup.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWalletSetup() {
  console.log('🧪 Testing Wallet System Setup...\n');

  try {
    // Test 1: Check if wallets table exists
    console.log('1️⃣ Checking if wallets table exists...');
    const walletCount = await prisma.wallet.count();
    console.log(`   ✅ Wallets table exists (${walletCount} wallets)\n`);

    // Test 2: Check if wallet_transactions table exists
    console.log('2️⃣ Checking if wallet_transactions table exists...');
    const transactionCount = await prisma.walletTransaction.count();
    console.log(`   ✅ Wallet transactions table exists (${transactionCount} transactions)\n`);

    // Test 3: Check if we can create a test wallet
    console.log('3️⃣ Testing wallet creation...');
    const testUserId = 999999; // Use a high number to avoid conflicts
    
    // Clean up any existing test wallet
    await prisma.walletTransaction.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.wallet.deleteMany({
      where: { userId: testUserId }
    });

    // Create test wallet
    const testWallet = await prisma.wallet.create({
      data: {
        userId: testUserId,
        balance: 0,
        currency: 'INR',
        isActive: true
      }
    });
    console.log(`   ✅ Test wallet created (ID: ${testWallet.id})\n`);

    // Test 4: Test transaction creation
    console.log('4️⃣ Testing transaction creation...');
    const testTransaction = await prisma.walletTransaction.create({
      data: {
        walletId: testWallet.id,
        userId: testUserId,
        type: 'CREDIT',
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        description: 'Test transaction',
        status: 'COMPLETED'
      }
    });
    console.log(`   ✅ Test transaction created (ID: ${testTransaction.id})\n`);

    // Clean up test data
    console.log('5️⃣ Cleaning up test data...');
    await prisma.walletTransaction.delete({
      where: { id: testTransaction.id }
    });
    await prisma.wallet.delete({
      where: { id: testWallet.id }
    });
    console.log('   ✅ Test data cleaned up\n');

    console.log('🎉 All tests passed! Wallet system is ready to use.\n');
    console.log('📋 Next steps:');
    console.log('   1. Restart your development server');
    console.log('   2. Navigate to Profile page');
    console.log('   3. You should see the Wallet section');
    console.log('   4. Try adding money with Razorpay\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure you ran: npx prisma db push');
    console.error('   2. Make sure DATABASE_URL is set in .env');
    console.error('   3. Make sure PostgreSQL is running');
    console.error('   4. Try: npx prisma generate\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testWalletSetup();
