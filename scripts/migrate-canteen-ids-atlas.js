// Migration script for MongoDB Atlas
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const OLD_CANTEEN_ID = '68cbd4d516f0e1a512cb6504';
const NEW_CANTEEN_ID = 'canteen-1758205071111';

// Convert string to ObjectId for comparison
const OLD_CANTEEN_OBJECT_ID = new mongoose.Types.ObjectId(OLD_CANTEEN_ID);

async function migrateCanteenIds() {
  try {
    // Use the same MongoDB URI as the server
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI or MONGODB_ATLAS_URI must be set');
    }
    
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = mongoose.connection.db;
    console.log(`📊 Database: ${db.databaseName}`);
    
    // Collections to update (using exact collection names from database)
    const collections = [
      'categories',
      'menuitems', 
      'orders',
      'notifications',
      'quickorders',
      'complaints',
      'coupons'
    ];
    
    const results = {};
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      
      // Debug: Check if collection exists and has documents
      const totalCount = await collection.countDocuments();
      console.log(`\n📊 Total documents in ${collectionName}: ${totalCount}`);
      
      if (totalCount > 0) {
        // Debug: Show sample document
        const sampleDoc = await collection.findOne({});
        console.log(`📋 Sample document in ${collectionName}:`, { 
          id: sampleDoc._id, 
          canteenId: sampleDoc.canteenId,
          name: sampleDoc.name || sampleDoc.orderNumber || 'N/A'
        });
      }
      
      // Count documents with old canteen ID (try both ObjectId and string)
      const countObjectId = await collection.countDocuments({ canteenId: OLD_CANTEEN_OBJECT_ID });
      const countString = await collection.countDocuments({ canteenId: OLD_CANTEEN_ID });
      const totalOldCount = countObjectId + countString;
      
      console.log(`📊 Found ${countObjectId} documents with ObjectId canteenId, ${countString} with string canteenId`);
      
      if (countObjectId > 0) {
        // Update documents with ObjectId canteenId
        const result = await collection.updateMany(
          { canteenId: OLD_CANTEEN_OBJECT_ID },
          { $set: { canteenId: NEW_CANTEEN_ID } }
        );
        
        console.log(`✅ Updated ${result.modifiedCount} documents in ${collectionName} (ObjectId)`);
        results[collectionName] = { updated: result.modifiedCount };
      } else if (countString > 0) {
        // Update documents with string canteenId
        const result = await collection.updateMany(
          { canteenId: OLD_CANTEEN_ID },
          { $set: { canteenId: NEW_CANTEEN_ID } }
        );
        
        console.log(`✅ Updated ${result.modifiedCount} documents in ${collectionName} (string)`);
        results[collectionName] = { updated: result.modifiedCount };
      } else {
        results[collectionName] = { updated: 0 };
      }
    }
    
    // Also update documents that don't have canteenId at all
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      
      // Count documents without canteenId
      const count = await collection.countDocuments({ canteenId: { $exists: false } });
      console.log(`\n📊 Found ${count} documents in ${collectionName} without canteenId`);
      
      if (count > 0) {
        // Add canteenId to documents that don't have it
        const result = await collection.updateMany(
          { canteenId: { $exists: false } },
          { $set: { canteenId: NEW_CANTEEN_ID } }
        );
        
        console.log(`✅ Added canteenId to ${result.modifiedCount} documents in ${collectionName}`);
        results[collectionName] = { 
          ...results[collectionName], 
          added: result.modifiedCount 
        };
      } else {
        results[collectionName] = { 
          ...results[collectionName], 
          added: 0 
        };
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log(JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

migrateCanteenIds();
