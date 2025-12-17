#!/usr/bin/env node

/**
 * Script to fix category uniqueness constraints
 * 
 * This script should be run in the production environment to:
 * 1. Drop any existing unique index on just the 'name' field
 * 2. Create a compound unique index on (name, canteenId)
 * 3. Allow the same category name across different canteens
 * 
 * Usage:
 *   node scripts/fix-category-uniqueness.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixCategoryUniqueness() {
  try {
    console.log('🔄 Starting category uniqueness migration...');
    
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI || 
                     process.env.MONGODB_ATLAS_URI || 
                     process.env.MONGODB_LOCAL_URI || 
                     'mongodb://localhost:27017/kit-canteen-dev';
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const collection = db.collection('categories');
    
    // Get existing indexes
    const existingIndexes = await collection.indexes();
    console.log('📋 Existing indexes:');
    existingIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique})`);
    });
    
    // Check if there's a unique index on just 'name'
    const nameOnlyIndex = existingIndexes.find(idx => 
      idx.key && 
      Object.keys(idx.key).length === 1 && 
      idx.key.name === 1 && 
      idx.unique === true
    );
    
    if (nameOnlyIndex) {
      console.log('⚠️ Found unique index on name only, dropping it...');
      await collection.dropIndex(nameOnlyIndex.name);
      console.log('✅ Dropped unique index on name only');
    } else {
      console.log('ℹ️ No unique index found on name only');
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
    console.log('📋 Final indexes:');
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique})`);
    });
    
    // Check existing categories to see if there are any conflicts
    const categories = await collection.find({}).toArray();
    console.log(`📊 Found ${categories.length} existing categories`);
    
    // Group by canteenId to show distribution
    const canteenGroups = {};
    categories.forEach(cat => {
      if (!canteenGroups[cat.canteenId]) {
        canteenGroups[cat.canteenId] = [];
      }
      canteenGroups[cat.canteenId].push(cat.name);
    });
    
    console.log('📊 Categories by canteen:');
    Object.keys(canteenGroups).forEach(canteenId => {
      console.log(`  Canteen ${canteenId}: ${canteenGroups[canteenId].join(', ')}`);
    });
    
    console.log('🎉 Category uniqueness migration completed successfully!');
    console.log('💡 Now different canteens can have categories with the same name');
    
  } catch (error) {
    console.error('❌ Category uniqueness migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
fixCategoryUniqueness()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
