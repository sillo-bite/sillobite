import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixApiTokens() {
  try {
    console.log('🔧 Fixing api_tokens table...\n');
    
    // 1. Remove duplicate tokens (keep only the latest one per user)
    console.log('1️⃣ Removing duplicate tokens...');
    await prisma.$executeRawUnsafe(`
      DELETE FROM api_tokens
      WHERE id NOT IN (
        SELECT DISTINCT ON (user_id) id
        FROM api_tokens
        ORDER BY user_id, created_at DESC
      )
    `);
    console.log('✅ Duplicates removed\n');
    
    // 2. Add unique constraint on user_id
    console.log('2️⃣ Adding unique constraint on user_id...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE api_tokens
      ADD CONSTRAINT api_tokens_user_id_unique UNIQUE (user_id)
    `);
    console.log('✅ Unique constraint added\n');
    
    // 3. Verify
    const count = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM api_tokens
    `;
    console.log('📊 Total tokens now:', Number(count[0].count));
    
    console.log('\n✅ Fix completed successfully!');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Unique constraint already exists, skipping...');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixApiTokens();
