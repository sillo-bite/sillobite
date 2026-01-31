
import { db } from "../server/db";

async function fixSequences() {
    try {
        const database = db();
        console.log("Fixing database sequences...");

        // Fix Users sequence
        try {
            console.log("Fixing 'users' id sequence...");
            // Postgres specific command to update sequence to max(id)
            await database.$executeRawUnsafe(`
        SELECT setval(pg_get_serial_sequence('"users"', 'id'), COALESCE((SELECT MAX(id) + 1 FROM "users"), 1), false);
      `);
            console.log("Fixed 'users' sequence.");
        } catch (error) {
            console.error("Failed to fix 'users' sequence:", error);
        }

        // Fix DeliveryPerson sequence
        try {
            console.log("Fixing 'delivery_persons' id sequence...");
            await database.$executeRawUnsafe(`
        SELECT setval(pg_get_serial_sequence('"delivery_persons"', 'id'), COALESCE((SELECT MAX(id) + 1 FROM "delivery_persons"), 1), false);
      `);
            console.log("Fixed 'delivery_persons' sequence.");
        } catch (error) {
            console.error("Failed to fix 'delivery_persons' sequence:", error);
        }

        console.log("Sequence fix completed!");
    } catch (error) {
        console.error("Script failed:", error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

fixSequences();
