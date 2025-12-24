import { PrismaClient } from '@prisma/client';

/**
 * ROLLBACK script for user location fields migration
 * 
 * ⚠️  WARNING: This script will remove the location fields from the users table
 * Use this ONLY if you need to rollback the migration
 * 
 * What this script does:
 * 1. Removes selectedLocationType column
 * 2. Removes selectedLocationId column
 * 
 * What this script does NOT do:
 * - Does NOT delete any users
 * - Does NOT modify college or organizationId fields
 * - Does NOT affect any other data
 */

interface RollbackStats {
  success: boolean;
  columnsRemoved: boolean;
  errors: string[];
}

export async function rollbackUserLocationFields(): Promise<RollbackStats> {
  const prisma = new PrismaClient();
  const stats: RollbackStats = {
    success: false,
    columnsRemoved: false,
    errors: []
  };

  try {
    console.log('🔄 Starting rollback of user location fields...');
    console.log('⚠️  This will remove selectedLocationType and selectedLocationId columns');
    console.log('');

    // Check if columns exist
    console.log('🔍 Checking if columns exist...');
    const columnCheck = await prisma.$queryRaw<Array<{ column_exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'selected_location_type'
      ) as column_exists;
    `;

    const columnsExist = columnCheck[0]?.column_exists || false;

    if (!columnsExist) {
      console.log('ℹ️  Columns do not exist - nothing to rollback');
      stats.success = true;
      return stats;
    }

    console.log('✅ Columns found, proceeding with removal...');
    console.log('');

    // Remove the columns
    await prisma.$executeRaw`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS selected_location_type,
      DROP COLUMN IF EXISTS selected_location_id;
    `;

    stats.columnsRemoved = true;
    console.log('✅ Columns removed successfully');
    console.log('');
    console.log('📊 Rollback Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Columns removed: YES');
    console.log('   User data affected: NO');
    console.log('   College/Organization data: PRESERVED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    stats.success = true;
    return stats;

  } catch (error: any) {
    console.error('');
    console.error('❌ ROLLBACK FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error: ${error.message}`);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    
    stats.success = false;
    stats.errors.push(error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running this rollback directly
const runRollback = async () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   ROLLBACK: USER LOCATION FIELDS          ║');
  console.log('║   ⚠️  WARNING: This will remove columns   ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  // Prompt for confirmation
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Are you sure you want to rollback? This will remove location fields. (yes/no): ', (answer: string) => {
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Rollback cancelled');
      process.exit(0);
      return;
    }

    rollbackUserLocationFields()
      .then((stats) => {
        console.log('');
        if (stats.success) {
          console.log('✅ Rollback completed successfully');
          process.exit(0);
        } else {
          console.log('❌ Rollback completed with errors');
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error('💥 Rollback crashed:', error);
        process.exit(1);
      });
  });
};

// Auto-run when executed directly
runRollback();
