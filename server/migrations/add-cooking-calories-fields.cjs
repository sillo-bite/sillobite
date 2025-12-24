/**
 * Migration: Add cookingTime and calories fields to all menu items
 * 
 * This migration adds the new cookingTime and calories fields to existing menu items
 * that don't have them yet, setting them to 0 as the default value.
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function migrate() {
  try {
    console.log('🚀 Starting migration: Add cookingTime and calories fields to menu items...');
    
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get the MenuItem collection
    const MenuItem = mongoose.connection.collection('menuitems');
    
    // Find all menu items that don't have cookingTime or calories fields
    const filter = {
      $or: [
        { cookingTime: { $exists: false } },
        { calories: { $exists: false } }
      ]
    };
    
    const count = await MenuItem.countDocuments(filter);
    console.log(`📊 Found ${count} menu items that need updating`);
    
    if (count === 0) {
      console.log('✅ No menu items need updating. Migration complete!');
      return;
    }
    
    // Update all menu items without these fields
    const result = await MenuItem.updateMany(
      filter,
      {
        $set: {
          cookingTime: 0,
          calories: 0
        }
      }
    );
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`📊 Updated ${result.modifiedCount} menu items`);
    console.log(`   - Added cookingTime field (default: 0)`);
    console.log(`   - Added calories field (default: 0)`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
