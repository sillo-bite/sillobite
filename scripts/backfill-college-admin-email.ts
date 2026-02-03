
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI or DATABASE_URL environment variable is not defined.');
    process.exit(1);
}

// Define the schema inline to avoid importing dependencies that might fail in a standalone script
const SystemSettingsSchema = new mongoose.Schema({
    colleges: {
        list: [{
            id: { type: String },
            name: { type: String },
            code: { type: String },
            isActive: { type: Boolean },
            adminEmail: { type: String },
            // Other fields can be loose, we only care about updating adminEmail
        }]
    }
}, { strict: false }); // strict: false allows us to work with the document without defining the full schema

const SystemSettings = mongoose.model('SystemSettings', SystemSettingsSchema, 'systemsettings');

async function backfillAdminEmail() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI as string);
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Fetching SystemSettings...');
        const settings = await SystemSettings.findOne();

        if (!settings) {
            console.log('⚠️ No SystemSettings document found.');
            return;
        }

        // @ts-ignore
        const colleges = settings.colleges?.list || [];
        console.log(`found ${colleges.length} colleges.`);

        let updatedCount = 0;

        // @ts-ignore
        settings.colleges.list = colleges.map((college: any) => {
            if (!college.adminEmail) {
                console.log(`✏️ Updating college: ${college.name} (${college.code}) -> adminEmail: sillobiteadmin@gmail.com`);
                updatedCount++;
                return {
                    ...college,
                    adminEmail: 'sillobiteadmin@gmail.com'
                };
            }
            return college;
        });

        if (updatedCount > 0) {
            // Mark the array as modified to ensure Mongoose saves the changes
            settings.markModified('colleges.list');
            await settings.save();
            console.log(`✅ Successfully backfilled adminEmail for ${updatedCount} colleges.`);
        } else {
            console.log('✨ All colleges already have an adminEmail. No changes needed.');
        }

    } catch (error) {
        console.error('❌ Error executing backfill:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

backfillAdminEmail();
