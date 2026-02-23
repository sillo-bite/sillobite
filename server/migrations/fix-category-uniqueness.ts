import mongoose from 'mongoose';
import { connectToMongoDB } from '../mongodb';

/**
 * Migration to fix category uniqueness constraints
 * 
 * This migration:
 * 1. Drops any existing unique index on just the 'name' field
 * 2. Creates a compound unique index on (name, canteenId)
 * 3. This allows the same category name across different canteens
 */
export async function fixCategoryUniqueness() {
  try {
    console.log('🔄 Starting category uniqueness migration...');

    // Connect to MongoDB
    await connectToMongoDB();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const collection = db.collection('categories');

    // Get existing indexes
    const existingIndexes = await collection.indexes();
    console.log('📋 Existing indexes:', existingIndexes.map(idx => idx.name));

    // Check if there's a unique index on just 'name'
    const nameOnlyIndex = existingIndexes.find(idx =>
      idx.key &&
      Object.keys(idx.key).length === 1 &&
      idx.key.name === 1 &&
      idx.unique === true
    );

    if (nameOnlyIndex) {
      console.log('⚠️ Found unique index on name only, dropping it...');
      await collection.dropIndex(nameOnlyIndex.name!);
      console.log('✅ Dropped unique index on name only');
    }

    // Check if compound index already exists
    const compoundIndex = existingIndexes.find(idx =>
      idx.key &&
      idx.key.name === 1 &&
      idx.key.canteenId === 1 &&
      idx.unique === true
    );

    if (!compoundIndex) {
      console.log('🔧 Creating compound unique index on (name, canteenId)...');
      await collection.createIndex(
        { name: 1, canteenId: 1 },
        { unique: true, name: 'name_canteenId_unique' }
      );
      console.log('✅ Created compound unique index on (name, canteenId)');
    } else {
      console.log('✅ Compound unique index on (name, canteenId) already exists');
    }

    // Verify the final indexes
    const finalIndexes = await collection.indexes();
    console.log('📋 Final indexes:', finalIndexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique
    })));

    console.log('🎉 Category uniqueness migration completed successfully!');

  } catch (error) {
    console.error('❌ Category uniqueness migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixCategoryUniqueness()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
