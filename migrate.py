from pymongo import MongoClient, UpdateOne
from pymongo.errors import PyMongoError
import sys
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB URIs - Update these with your actual connection strings
SRC_URI = os.getenv("")
DST_URI = os.getenv("")

# Database names - Update these with your actual database names
# Common database names: sillobite, test, admin, local
SRC_DB_NAME = os.getenv("MONGODB_SOURCE_DB", "sillobite")  # Changed default to 'test'
DST_DB_NAME = os.getenv("MONGODB_TARGET_DB", "figgy")

BATCH_SIZE = 1000

def log(msg):
    """Log message with timestamp"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def migrate_mongodb():
    """Migrate all collections from source MongoDB to target MongoDB"""
    
    log("🚀 Starting MongoDB migration...")
    log(f"📊 Source DB: {SRC_DB_NAME}")
    log(f"📊 Target DB: {DST_DB_NAME}")
    log(f"📦 Batch size: {BATCH_SIZE}")
    
    try:
        # Connect to source MongoDB
        log("🔌 Connecting to source MongoDB...")
        src = MongoClient(SRC_URI, serverSelectionTimeoutMS=5000)
        src.admin.command('ping')  # Test connection
        log("✅ Connected to source MongoDB")
        
        # Connect to target MongoDB
        log("🔌 Connecting to target MongoDB...")
        dst = MongoClient(DST_URI, serverSelectionTimeoutMS=5000)
        dst.admin.command('ping')  # Test connection
        log("✅ Connected to target MongoDB")
        
        # List all available databases
        log("\n🔍 Listing available databases in source:")
        src_databases = src.list_database_names()
        for db_name in src_databases:
            log(f"   - {db_name}")
        
        log("\n🔍 Listing available databases in target:")
        dst_databases = dst.list_database_names()
        for db_name in dst_databases:
            log(f"   - {db_name}")
        
        src_db = src[SRC_DB_NAME]
        dst_db = dst[DST_DB_NAME]
        
        # Get list of collections
        collections = src_db.list_collection_names()
        log(f"\n📋 Found {len(collections)} collections in '{SRC_DB_NAME}' database")
        
        if len(collections) == 0:
            log(f"\n⚠️  WARNING: No collections found in database '{SRC_DB_NAME}'")
            log(f"⚠️  Please check if the database name is correct.")
            log(f"⚠️  Available databases are listed above.")
            log(f"\n💡 TIP: Update MONGODB_SOURCE_DB in your .env file or in the script")
            return False
        
        total_docs = 0
        migration_summary = {}
        
        for col in collections:
            log(f"\n{'='*60}")
            log(f"📦 Migrating collection: {col}")
            
            s = src_db[col]
            d = dst_db[col]
            
            # Get total count
            total_count = s.count_documents({})
            log(f"📊 Total documents: {total_count}")
            
            if total_count == 0:
                log(f"⚠️  Collection {col} is empty, skipping...")
                migration_summary[col] = {"docs": 0, "status": "empty"}
                continue
            
            ops = []
            count = 0
            errors = 0
            
            try:
                for doc in s.find():
                    try:
                        ops.append(
                            UpdateOne(
                                {"_id": doc["_id"]},
                                {"$set": doc},
                                upsert=True
                            )
                        )
                        
                        if len(ops) == BATCH_SIZE:
                            result = d.bulk_write(ops)
                            count += len(ops)
                            log(f"✅ {count}/{total_count} docs synced ({(count/total_count*100):.1f}%)")
                            ops = []
                    
                    except Exception as e:
                        errors += 1
                        log(f"⚠️  Error processing document {doc.get('_id', 'unknown')}: {str(e)}")
                        continue
                
                # Write remaining operations
                if ops:
                    result = d.bulk_write(ops)
                    count += len(ops)
                
                log(f"✅ Collection completed: {col} ({count} docs synced, {errors} errors)")
                total_docs += count
                migration_summary[col] = {"docs": count, "errors": errors, "status": "completed"}
                
            except Exception as e:
                log(f"❌ Error migrating collection {col}: {str(e)}")
                migration_summary[col] = {"docs": count, "errors": errors, "status": "failed"}
                continue
        
        # Print summary
        log(f"\n{'='*60}")
        log("🎉 Migration completed!")
        log(f"\n📊 Migration Summary:")
        log(f"{'='*60}")
        log(f"Total collections: {len(collections)}")
        log(f"Total documents migrated: {total_docs}")
        log(f"\nPer-collection breakdown:")
        for col, stats in migration_summary.items():
            status_icon = "✅" if stats["status"] == "completed" else "⚠️" if stats["status"] == "empty" else "❌"
            log(f"{status_icon} {col}: {stats['docs']} docs, {stats.get('errors', 0)} errors")
        
        return True
        
    except PyMongoError as e:
        log(f"❌ MongoDB connection error: {str(e)}")
        return False
    except Exception as e:
        log(f"❌ Unexpected error: {str(e)}")
        return False
    finally:
        try:
            src.close()
            dst.close()
            log("\n🔌 Disconnected from MongoDB")
        except:
            pass

if __name__ == "__main__":
    log("╔════════════════════════════════════════════╗")
    log("║     MongoDB Migration Tool                ║")
    log("║     Migrate data between MongoDB clusters ║")
    log("╚════════════════════════════════════════════╝\n")
    
    # Confirm before proceeding
    response = input("⚠️  This will migrate data from source to target MongoDB. Continue? (yes/no): ")
    if response.lower() != "yes":
        log("❌ Migration cancelled by user")
        sys.exit(0)
    
    success = migrate_mongodb()
    sys.exit(0 if success else 1)