
import mongoose from 'mongoose';
import { Schema } from 'mongoose';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://0.0.0.0:27017/sillobite';

async function checkCollege() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const SystemSettingsSchema = new Schema({}, { strict: false });
        const SystemSettingsModel = mongoose.model('SystemSettings', SystemSettingsSchema);

        const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

        if (!settings) {
            console.log('No system settings found');
            return;
        }

        const collegeId = 'college-1766479575414';
        const colleges = settings.get('colleges.list') || [];

        console.log(`Searching for college with ID: ${collegeId}`);

        const college = colleges.find((c: any) => c.id === collegeId);

        if (college) {
            console.log('Found college:', JSON.stringify(college, null, 2));
        } else {
            console.log('College not found via ID');
            // SEARCH BY NAME OR OTHERS
            const cByName = colleges.find((c: any) => c.name === 'KIT College');
            if (cByName) {
                console.log('Found KIT College by name:', JSON.stringify(cByName, null, 2));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkCollege();
