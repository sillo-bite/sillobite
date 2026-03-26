from pymongo import MongoClient
from pymongo.errors import PyMongoError
import sys
import time

SRC_URI="mongodb://mongo:vyPqqAdKXpDNGSapRGIDupPFPefKRNpP@metro.proxy.rlwy.net:46226"
DST_URI="mongodb+srv://sillobite_db_user:GhjyPeMMgYWxnpTA@sillobiteprod.yha10xr.mongodb.net/"

BATCH_SIZE=1000

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

src=MongoClient(SRC_URI)
dst=MongoClient(DST_URI)

src_db=src["source_db"]
dst_db=dst["target_db"]

for col in src_db.list_collection_names():

    log(f"Migrating collection: {col}")

    s=src_db[col]
    d=dst_db[col]

    ops=[]
    count=0

    for doc in s.find():

        ops.append(
            UpdateOne(
                {"_id":doc["_id"]},
                {"$set":doc},
                upsert=True
            )
        )

        if len(ops)==BATCH_SIZE:
            d.bulk_write(ops)
            count+=len(ops)
            log(f"{count} docs synced")
            ops=[]

    if ops:
        d.bulk_write(ops)
        count+=len(ops)

    log(f"Collection completed: {col} ({count} docs)")