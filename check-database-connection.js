import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkConnection() {
  try {
    console.log('🔍 Checking database connection...\n');
    
    // Get database name
    const dbInfo = await prisma.$queryRaw`
      SELECT current_database() as database_name,
             current_user as user_name,
             inet_server_addr() as server_address,
             inet_server_port() as server_port
    `;
    
    console.log('📊 Connected to:');
    console.log(dbInfo[0]);
    
    // List all tables
    console.log('\n📋 All tables in this database:');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    tables.forEach((t, i) => {
      console.log(`${i + 1}. ${t.table_name}`);
    });
    
    // Check for our tables
    const ourTables = tables.filter(t => 
      t.table_name === 'connection_codes' || t.table_name === 'api_tokens'
    );
    
    if (ourTables.length === 2) {
      console.log('\n✅ Both connection_codes and api_tokens tables exist!');
    } else {
      console.log('\n❌ Tables missing:', ourTables.length, 'of 2 found');
    }
    
    // Show DATABASE_URL (masked)
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.log('\n🔗 DATABASE_URL:', maskedUrl);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnection();
