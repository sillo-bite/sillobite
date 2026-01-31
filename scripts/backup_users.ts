
import { db } from "../server/db";
import * as fs from "fs";
import * as path from "path";

async function backup() {
    try {
        const database = db();
        console.log("Fetching users...");
        // Use raw query to avoid Prisma Client type validation errors
        const users = await database.$queryRaw`SELECT * FROM "users"`;

        // Backup DeliveryPerson
        let deliveryPersons = [];
        try {
            deliveryPersons = await database.$queryRaw`SELECT * FROM "delivery_persons"`;
        } catch (e) {
            console.log("No delivery_persons table found or empty.");
        }

        const backupPath = path.join(process.cwd(), "backup_users.json");
        fs.writeFileSync(backupPath, JSON.stringify({ users, deliveryPersons }, null, 2));

        console.log(`Backup completed! Saved ${Array.isArray(users) ? users.length : 0} users and ${Array.isArray(deliveryPersons) ? deliveryPersons.length : 0} delivery persons to ${backupPath}`);
    } catch (error) {
        console.error("Backup failed:", error);
    } finally {
        process.exit(0);
    }
}

backup();
