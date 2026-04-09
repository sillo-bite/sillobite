import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTables() {
  try {
    console.log('🔍 Checking for connection_codes table...');
    const codes = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('connection_codes', 'api_tokens')
      ORDER BY table_name
    `;
    
    console.log('📊 Found tables:', codes);
    
    console.log('\n🔍 Checking connection_codes structure...');
    const codeColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'connection_codes'
      ORDER BY ordinal_position
    `;
    console.log('Columns:', codeColumns);
    
    console.log('\n🔍 Checking api_tokens structure...');
    const tokenColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'api_tokens'
      ORDER BY ordinal_position
    `;
    console.log('Columns:', tokenColumns);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTables();
