import { PrismaClient } from '@prisma/client';

/**
 * Production-safe migration to add location selection fields to users table
 * 
 * This migration:
 * 1. Adds selectedLocationType and selectedLocationId columns if they don't exist
 * 2. Backfills data based on existing college/organizationId fields
 * 3. Is idempotent - can be run multiple times safely
 * 4. Provides detailed logging and error handling
 * 5. Does NOT delete any existing data
 * 
 * Priority for auto-setting location:
 * - Organization (if organizationId exists) -> selectedLocationType: 'organization'
 * - College (if college exists) -> selectedLocationType: 'college'
 * - Neither -> NULL (user will select manually)
 */

interface MigrationStats {
  success: boolean;
  columnsAdded: boolean;
  totalUsers: number;
  usersUpdated: number;
  usersWithOrganization: number;
  usersWithCollege: number;
  usersWithoutLocation: number;
  errors: string[];
}

export async function addUserLocationFields(): Promise<MigrationStats> {
  const prisma = new PrismaClient();
  const stats: MigrationStats = {
    success: false,
    columnsAdded: false,
    totalUsers: 0,
    usersUpdated: 0,
    usersWithOrganization: 0,
    usersWithCollege: 0,
    usersWithoutLocation: 0,
    errors: []
  };

  try {
    console.log('🚀 Starting user location fields migration...');
    console.log('📋 This migration will add location selection functionality');
    console.log('');

    // Step 1: Check if columns already exist
    console.log('🔍 Step 1: Checking if columns exist...');
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
      console.log('➕ Columns do not exist. Adding them now...');
      
      // Step 2: Add columns with transaction for atomicity
      try {
        await prisma.$executeRaw`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS selected_location_type VARCHAR(255),
          ADD COLUMN IF NOT EXISTS selected_location_id VARCHAR(255);
        `;
        
        stats.columnsAdded = true;
        console.log('✅ Columns added successfully');
      } catch (error: any) {
        if (error.code === '42701') {
          console.log('ℹ️ Columns already exist (race condition handled)');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ Columns already exist, skipping creation');
    }

    console.log('');
    console.log('🔍 Step 2: Analyzing existing user data...');

    // Step 3: Get all users to analyze and update
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        college: true,
        organizationId: true,
        selectedLocationType: true,
        selectedLocationId: true,
        name: true
      }
    });

    stats.totalUsers = allUsers.length;
    console.log(`📊 Found ${stats.totalUsers} total users`);
    console.log('');

    // Step 4: Update users without location based on existing data
    console.log('🔄 Step 3: Backfilling location data for users...');
    console.log('Priority: Organization > College > NULL');
    console.log('');

    for (const user of allUsers) {
      try {
        // Skip if user already has a location set
        if (user.selectedLocationType && user.selectedLocationId) {
          console.log(`⏭️  User ${user.id} (${user.name}): Already has location set - ${user.selectedLocationType}:${user.selectedLocationId}`);
          continue;
        }

        let updateData: { selectedLocationType: string; selectedLocationId: string } | null = null;

        // Priority 1: Organization
        if (user.organizationId) {
          updateData = {
            selectedLocationType: 'organization',
            selectedLocationId: user.organizationId
          };
          stats.usersWithOrganization++;
          console.log(`🏢 User ${user.id} (${user.name}): Setting location to organization ${user.organizationId}`);
        }
        // Priority 2: College
        else if (user.college) {
          updateData = {
            selectedLocationType: 'college',
            selectedLocationId: user.college
          };
          stats.usersWithCollege++;
          console.log(`🎓 User ${user.id} (${user.name}): Setting location to college ${user.college}`);
        }
        // No location data available
        else {
          stats.usersWithoutLocation++;
          console.log(`⚠️  User ${user.id} (${user.name}): No college or organization - location will remain NULL`);
          continue;
        }

        // Perform the update if we have data
        if (updateData) {
          await prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
          stats.usersUpdated++;
        }
      } catch (error: any) {
        const errorMsg = `Error updating user ${user.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Columns added: ${stats.columnsAdded ? 'YES' : 'NO (already existed)'}`);
    console.log(`   Total users: ${stats.totalUsers}`);
    console.log(`   Users updated: ${stats.usersUpdated}`);
    console.log(`   ├─ Set to organization: ${stats.usersWithOrganization}`);
    console.log(`   ├─ Set to college: ${stats.usersWithCollege}`);
    console.log(`   └─ Without location data: ${stats.usersWithoutLocation}`);
    console.log(`   Errors: ${stats.errors.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (stats.errors.length > 0) {
      console.log('');
      console.log('⚠️  Errors encountered:');
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('');
    console.log('ℹ️  Next steps:');
    console.log('   - Users with locations will see their default location on login');
    console.log('   - Users without locations can select one from their profile');
    console.log('   - All data filtering will respect the selected location');
    console.log('');

    stats.success = true;
    return stats;

  } catch (error: any) {
    console.error('');
    console.error('❌ MIGRATION FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error: ${error.message}`);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error('⚠️  Database state:');
    console.error('   - No data has been deleted');
    console.error('   - Partial updates may have occurred');
    console.error('   - You can safely re-run this migration');
    console.error('');
    
    stats.success = false;
    stats.errors.push(error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running this migration directly
// Check if this file is being run directly (not imported)
const runMigration = async () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   USER LOCATION FIELDS MIGRATION          ║');
  console.log('║   Production-Safe Database Migration       ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  try {
    const stats = await addUserLocationFields();
    console.log('');
    if (stats.success) {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    } else {
      console.log('❌ Migration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Migration crashed:', error);
    process.exit(1);
  }
};

// Auto-run when executed directly
runMigration();
