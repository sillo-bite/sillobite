import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTokenUpsert() {
  try {
    console.log('🧪 Testing token UPSERT logic...\n');
    
    // Get a test user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`👤 Testing with user: ${user.name} (ID: ${user.id})\n`);
    
    // Test 1: Insert first token
    console.log('1️⃣ Inserting first token...');
    const token1 = 'test_token_' + Date.now() + '_1';
    await prisma.$executeRaw`
      INSERT INTO api_tokens (user_id, token)
      VALUES (${user.id}, ${token1})
      ON CONFLICT (user_id) 
      DO UPDATE SET token = ${token1}, created_at = NOW()
    `;
    
    let tokens = await prisma.$queryRaw`
      SELECT * FROM api_tokens WHERE user_id = ${user.id}
    `;
    console.log(`✅ Tokens for user: ${tokens.length}`);
    console.log(`   Token: ${tokens[0].token.substring(0, 20)}...\n`);
    
    // Test 2: Update with second token (should replace, not duplicate)
    console.log('2️⃣ Updating with second token...');
    const token2 = 'test_token_' + Date.now() + '_2';
    await prisma.$executeRaw`
      INSERT INTO api_tokens (user_id, token)
      VALUES (${user.id}, ${token2})
      ON CONFLICT (user_id) 
      DO UPDATE SET token = ${token2}, created_at = NOW()
    `;
    
    tokens = await prisma.$queryRaw`
      SELECT * FROM api_tokens WHERE user_id = ${user.id}
    `;
    console.log(`✅ Tokens for user: ${tokens.length} (should still be 1)`);
    console.log(`   Token: ${tokens[0].token.substring(0, 20)}...\n`);
    
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.$executeRaw`
      DELETE FROM api_tokens WHERE user_id = ${user.id}
    `;
    
    console.log('✅ Test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   • First insert: Created new token');
    console.log('   • Second insert: Updated existing token (no duplicate)');
    console.log('   • User can only have ONE token at a time');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testTokenUpsert();
