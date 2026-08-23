// Debug script to check api_tokens table
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkToken() {
  try {
    console.log('🔍 Checking api_tokens table...\n');
    
    // Get all tokens
    const tokens = await prisma.$queryRaw`
      SELECT id, user_id, token, created_at 
      FROM api_tokens 
      ORDER BY created_at DESC
    `;
    
    console.log(`Found ${tokens.length} tokens:\n`);
    
    for (const token of tokens) {
      console.log(`ID: ${token.id}`);
      console.log(`User ID: ${token.user_id}`);
      console.log(`Token: ${token.token.substring(0, 20)}...`);
      console.log(`Created: ${token.created_at}`);
      console.log('---');
    }
    
    // Check specific user
    const email = 'steepan430@gmail.com';
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (user) {
      console.log(`\n✅ User found: ${user.name} (ID: ${user.id})`);
      
      const userToken = await prisma.$queryRaw`
        SELECT * FROM api_tokens WHERE user_id = ${user.id}
      `;
      
      if (userToken.length > 0) {
        console.log(`✅ Token exists for user`);
        console.log(`Token: ${userToken[0].token}`);
      } else {
        console.log(`❌ No token found for user`);
      }
    } else {
      console.log(`\n❌ User not found: ${email}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkToken();
