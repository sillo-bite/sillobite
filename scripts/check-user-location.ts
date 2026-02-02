
import { storage } from '../server/storage-hybrid';

async function checkUserLocation() {
    try {
        console.log("Checking user location...");
        // Force a small wait to ensure connection if needed (though storage usually handles it)

        // Check by email
        const email = 'steepan430@gmail.com';
        const user = await storage.getUserByEmail(email);

        if (user) {
            console.log("User found:", user.email);
            console.log("Selected Location Type:", user.selectedLocationType);
            console.log("Selected Location ID:", user.selectedLocationId);
            console.log("College:", user.college);
            console.log("Organization:", user.organization);
        } else {
            console.log("User not found: " + email);
        }
    } catch (error) {
        console.error("Error checking user:", error);
    } finally {
        process.exit(0);
    }
}

checkUserLocation();
