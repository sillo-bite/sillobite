
import { storage } from './server/storage-hybrid';
import mongoose from 'mongoose';

// Mock express session if needed by storage init? No, storage is usually standalone.

async function verifyCollege() {
    try {
        console.log('Connecting to storage...');
        // We might need to wait for connection if it's async in module
        // But usually importing it triggers connection logic or it awaits implicitly in methods

        // Allow some time for connection
        await new Promise(resolve => setTimeout(resolve, 2000));

        const settings = await storage.getSystemSettings();

        if (!settings || !settings.colleges || !settings.colleges.list) {
            console.log('No colleges found in settings');
            return;
        }

        const collegeId = 'college-1766479575414';
        console.log(`Looking for collegeId: ${collegeId}`);

        const college = settings.colleges.list.find((c: any) => c.id === collegeId);

        if (college) {
            console.log('✅ College FOUND:', JSON.stringify(college, null, 2));
        } else {
            console.log('❌ College NOT FOUND by ID');
            // List all colleges
            console.log('Available colleges:', settings.colleges.list.map((c: any) => ({
                id: c.id,
                name: c.name,
                code: c.code,
                adminEmail: c.adminEmail
            })));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyCollege();
