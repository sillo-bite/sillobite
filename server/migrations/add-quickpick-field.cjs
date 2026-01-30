const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kit_sillobite');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// MenuItem schema (simplified for migration)
const MenuItemSchema = new mongoose.Schema({
  name: String,
  price: Number,
  categoryId: mongoose.Schema.Types.ObjectId,
  canteenId: String,
  available: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  description: String,
  addOns: { type: String, default: '[]' },
  isVegetarian: { type: Boolean, default: true },
  isMarkable: { type: Boolean, default: true },
  isTrending: { type: Boolean, default: false },
  isQuickPick: { type: Boolean, default: false }, // New field
  imageUrl: String,
  imagePublicId: String,
  storeCounterId: String,
  paymentCounterId: String,
  createdAt: { type: Date, default: Date.now }
});

const MenuItem = mongoose.model('MenuItem', MenuItemSchema);

// Migration function
const addQuickPickField = async () => {
  try {
    console.log('🔄 Starting migration: Adding isQuickPick field to existing menu items...');

    // Find all menu items that don't have the isQuickPick field
    const itemsWithoutQuickPick = await MenuItem.find({
      isQuickPick: { $exists: false }
    });

    console.log(`📊 Found ${itemsWithoutQuickPick.length} menu items without isQuickPick field`);

    if (itemsWithoutQuickPick.length === 0) {
      console.log('✅ All menu items already have isQuickPick field');
      return;
    }

    // Update all items to add the isQuickPick field with default value false
    const updateResult = await MenuItem.updateMany(
      { isQuickPick: { $exists: false } },
      { $set: { isQuickPick: false } }
    );

    console.log(`✅ Migration completed: Updated ${updateResult.modifiedCount} menu items`);

    // Verify the migration
    const itemsWithQuickPick = await MenuItem.find({
      isQuickPick: { $exists: true }
    });

    console.log(`✅ Verification: ${itemsWithQuickPick.length} menu items now have isQuickPick field`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await addQuickPickField();
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the migration
runMigration();
