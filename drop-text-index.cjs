const mongoose = require('mongoose');
require('dotenv/config');

async function dropTextIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('menuitems');
    
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));
    
    const textIndexes = indexes.filter(i => i.name.includes('text'));
    
    for (const index of textIndexes) {
      console.log('Dropping text index:', index.name);
      await collection.dropIndex(index.name);
      console.log('✅ Dropped:', index.name);
    }
    
    console.log('✅ Text indexes removed. Restart server to create new indexes.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropTextIndex();
