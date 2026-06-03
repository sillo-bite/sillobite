# MongoDB Migration Guide

## Overview

This guide explains how to migrate data between MongoDB clusters using the provided migration scripts.

## Available Migration Scripts

### 1. **migrate.py** - Full Database Migration
Migrates all collections from one MongoDB cluster to another.

**Location**: `migrate.py` (root directory)

**Use Case**: 
- Moving from one MongoDB cluster to another
- Creating a backup/replica of your database
- Migrating to a new MongoDB Atlas cluster

### 2. **migrate-canteen-ids-atlas.js** - Canteen ID Migration
Updates canteen IDs across all collections.

**Location**: `scripts/migrate-canteen-ids-atlas.js`

**Use Case**:
- Updating old canteen IDs to new format
- Fixing canteen ID references across collections

---

## Full Database Migration (migrate.py)

### Prerequisites

1. **Python 3.7+** installed
2. **pymongo** package installed:
   ```bash
   pip install pymongo python-dotenv
   ```
3. **Access credentials** for both source and target MongoDB clusters

### Configuration

#### Option 1: Using Environment Variables (Recommended)

Create a `.env` file in the root directory:

```env
# Source MongoDB (where data is coming from)
MONGODB_SOURCE_URI=mongodb+srv://user:password@source-cluster.mongodb.net/
MONGODB_SOURCE_DB=sillobite

# Target MongoDB (where data is going to)
MONGODB_TARGET_URI=mongodb+srv://user:password@target-cluster.mongodb.net/
MONGODB_TARGET_DB=sillobite
```

#### Option 2: Edit Script Directly

Edit `migrate.py` and update these lines:

```python
SRC_URI = "your_source_mongodb_uri"
DST_URI = "your_target_mongodb_uri"
SRC_DB_NAME = "your_source_database_name"
DST_DB_NAME = "your_target_database_name"
```

### Running the Migration

1. **Backup your target database** (if it has existing data):
   ```bash
   # Using mongodump
   mongodump --uri="mongodb+srv://user:password@target-cluster.mongodb.net/sillobite" --out=backup
   ```

2. **Run the migration script**:
   ```bash
   python migrate.py
   ```

3. **Confirm when prompted**:
   ```
   ⚠️  This will migrate data from source to target MongoDB. Continue? (yes/no): yes
   ```

### Expected Output

```
╔════════════════════════════════════════════╗
║     MongoDB Migration Tool                ║
║     Migrate data between MongoDB clusters ║
╚════════════════════════════════════════════╝

[10:30:15] 🚀 Starting MongoDB migration...
[10:30:15] 📊 Source DB: sillobite
[10:30:15] 📊 Target DB: sillobite
[10:30:15] 📦 Batch size: 1000
[10:30:15] 🔌 Connecting to source MongoDB...
[10:30:16] ✅ Connected to source MongoDB
[10:30:16] 🔌 Connecting to target MongoDB...
[10:30:17] ✅ Connected to target MongoDB
[10:30:17] 📋 Found 15 collections to migrate

============================================================
[10:30:17] 📦 Migrating collection: users
[10:30:17] 📊 Total documents: 1250
[10:30:18] ✅ 1000/1250 docs synced (80.0%)
[10:30:19] ✅ Collection completed: users (1250 docs synced, 0 errors)

============================================================
[10:30:19] 📦 Migrating collection: menuitems
[10:30:19] 📊 Total documents: 450
[10:30:20] ✅ Collection completed: menuitems (450 docs synced, 0 errors)

... (continues for all collections)

============================================================
[10:30:45] 🎉 Migration completed!

[10:30:45] 📊 Migration Summary:
============================================================
Total collections: 15
Total documents migrated: 5420

Per-collection breakdown:
✅ users: 1250 docs, 0 errors
✅ menuitems: 450 docs, 0 errors
✅ orders: 2300 docs, 0 errors
✅ categories: 25 docs, 0 errors
✅ canteens: 5 docs, 0 errors
✅ notifications: 890 docs, 0 errors
✅ quickorders: 200 docs, 0 errors
✅ complaints: 150 docs, 0 errors
✅ coupons: 50 docs, 0 errors
✅ reviews: 100 docs, 0 errors

[10:30:45] 🔌 Disconnected from MongoDB
```

### Features

- ✅ **Batch Processing**: Processes documents in batches of 1000 for efficiency
- ✅ **Progress Tracking**: Shows real-time progress for each collection
- ✅ **Error Handling**: Continues migration even if individual documents fail
- ✅ **Upsert Strategy**: Updates existing documents, inserts new ones
- ✅ **Connection Testing**: Verifies connections before starting migration
- ✅ **Detailed Summary**: Provides complete migration statistics

### Verification After Migration

1. **Check document counts**:
   ```javascript
   // In MongoDB shell or Compass
   db.users.countDocuments()
   db.menuitems.countDocuments()
   db.orders.countDocuments()
   // ... check all collections
   ```

2. **Verify sample data**:
   ```javascript
   db.users.findOne()
   db.menuitems.find().limit(5)
   ```

3. **Test application**:
   - Update your `.env` file to point to the new MongoDB cluster
   - Restart your application
   - Test key functionality (login, orders, menu, etc.)

---

## Canteen ID Migration (migrate-canteen-ids-atlas.js)

### Prerequisites

1. **Node.js** installed
2. **Dependencies** installed:
   ```bash
   npm install
   ```

### Configuration

Update the script with your canteen IDs:

```javascript
const OLD_CANTEEN_ID = '68cbd4d516f0e1a512cb6504';  // Old ID to replace
const NEW_CANTEEN_ID = 'canteen-1758205071111';     // New ID to use
```

### Running the Migration

```bash
node scripts/migrate-canteen-ids-atlas.js
```

### What It Does

1. Updates `canteenId` field in these collections:
   - categories
   - menuitems
   - orders
   - notifications
   - quickorders
   - complaints
   - coupons

2. Handles both ObjectId and string canteen IDs
3. Adds canteen ID to documents that don't have one

### Expected Output

```
🔌 Connecting to MongoDB Atlas...
✅ Connected to MongoDB Atlas
📊 Database: sillobite

📊 Total documents in categories: 25
📋 Sample document in categories: { id: ..., canteenId: '68cbd4d516f0e1a512cb6504', name: 'Main Course' }
📊 Found 25 documents with ObjectId canteenId, 0 with string canteenId
✅ Updated 25 documents in categories (ObjectId)

... (continues for all collections)

🎉 Migration completed successfully!

📋 Summary:
{
  "categories": { "updated": 25, "added": 0 },
  "menuitems": { "updated": 450, "added": 0 },
  "orders": { "updated": 2300, "added": 0 },
  ...
}
```

---

## Troubleshooting

### Issue: "Connection timeout"

**Solution**: 
- Check your MongoDB connection strings
- Verify network access (whitelist your IP in MongoDB Atlas)
- Check if MongoDB clusters are running

### Issue: "Authentication failed"

**Solution**:
- Verify username and password in connection string
- Check database user permissions
- Ensure user has read/write access to the database

### Issue: "Collection not found"

**Solution**:
- Verify database names are correct
- Check if collections exist in source database
- Use MongoDB Compass to inspect database structure

### Issue: "Duplicate key error"

**Solution**:
- The script uses upsert, so this shouldn't happen
- If it does, check for unique indexes on target database
- Consider dropping indexes before migration, recreate after

### Issue: Migration is slow

**Solution**:
- Increase `BATCH_SIZE` (try 2000 or 5000)
- Check network speed between your machine and MongoDB clusters
- Consider running migration from a server closer to MongoDB clusters
- Use MongoDB Atlas Data Migration service for large datasets

---

## Best Practices

### Before Migration

1. ✅ **Backup both databases**
2. ✅ **Test migration on a small dataset first**
3. ✅ **Verify connection strings**
4. ✅ **Check available disk space**
5. ✅ **Schedule during low-traffic period**

### During Migration

1. ✅ **Monitor progress logs**
2. ✅ **Keep terminal window open**
3. ✅ **Don't interrupt the process**
4. ✅ **Watch for error messages**

### After Migration

1. ✅ **Verify document counts match**
2. ✅ **Test application thoroughly**
3. ✅ **Check for missing data**
4. ✅ **Update connection strings in production**
5. ✅ **Keep old database for a few days as backup**

---

## Performance Tips

### For Large Databases (>10GB)

1. **Increase batch size**:
   ```python
   BATCH_SIZE = 5000  # Instead of 1000
   ```

2. **Run from a server** close to MongoDB clusters

3. **Use MongoDB Atlas Live Migration** for production:
   - Go to MongoDB Atlas Console
   - Use "Migrate Data to this Cluster" feature
   - Provides zero-downtime migration

4. **Parallel migration** (advanced):
   - Run multiple migration scripts for different collections
   - Requires modifying the script to target specific collections

### For Small Databases (<1GB)

- Default settings work fine
- Should complete in minutes

---

## Alternative Migration Methods

### 1. MongoDB Atlas Live Migration
- **Best for**: Production databases
- **Pros**: Zero downtime, automatic sync
- **Cons**: Only available in Atlas

### 2. mongodump/mongorestore
```bash
# Export from source
mongodump --uri="source_uri" --out=dump

# Import to target
mongorestore --uri="target_uri" dump/
```
- **Best for**: One-time migrations
- **Pros**: Official MongoDB tool, reliable
- **Cons**: Requires downtime

### 3. MongoDB Compass Export/Import
- **Best for**: Small datasets, testing
- **Pros**: GUI-based, easy to use
- **Cons**: Not suitable for large datasets

---

## Security Considerations

1. **Never commit connection strings** to version control
2. **Use environment variables** for credentials
3. **Rotate passwords** after migration
4. **Limit IP whitelist** to your migration machine
5. **Use SSL/TLS** connections (included in connection strings)
6. **Delete backup files** securely after migration

---

## Support

If you encounter issues:

1. Check the error messages in the output
2. Verify MongoDB connection strings
3. Test connections using MongoDB Compass
4. Check MongoDB Atlas network access settings
5. Review MongoDB Atlas logs for errors

---

## Related Files

- `migrate.py` - Main migration script
- `scripts/migrate-canteen-ids-atlas.js` - Canteen ID migration
- `scripts/migrate-payment-indexed-fields.js` - Payment field migration
- `.env` - Environment configuration (create this)

---

**Last Updated**: 2024  
**Tested With**: MongoDB 6.0+, Python 3.9+, Node.js 18+  
**Status**: ✅ Production Ready
