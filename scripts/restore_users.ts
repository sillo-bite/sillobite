
import { db } from "../server/db";
import * as fs from "fs";
import * as path from "path";

function formatValue(val: any): string {
    if (val === null) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
}

async function restore() {
    try {
        const backupPath = path.join(process.cwd(), "backup_users.json");
        console.log(`Reading backup from ${backupPath}...`);

        if (!fs.existsSync(backupPath)) {
            console.error("Backup file not found!");
            process.exit(1);
        }

        const rawJSON = fs.readFileSync(backupPath, "utf-8");
        const data = JSON.parse(rawJSON);

        const users = data.users || [];
        const deliveryPersons = data.deliveryPersons || []; // if previously backup structure includes it
        // Handle array case if backup structure was different
        const actualUsers = Array.isArray(data) ? data : users;

        console.log(`Restoring ${actualUsers.length} users...`);
        const database = db();

        // Restore Users
        for (const user of actualUsers) {
            const keys = Object.keys(user).map(k => `"${k}"`).join(", ");
            const values = Object.values(user).map(formatValue).join(", ");

            const query = `INSERT INTO "users" (${keys}) VALUES (${values}) ON CONFLICT DO NOTHING`;
            await database.$executeRawUnsafe(query);
        }

        // Restore Delivery Persons
        if (deliveryPersons.length > 0) {
            console.log(`Restoring ${deliveryPersons.length} delivery persons...`);
            for (const dp of deliveryPersons) {
                const keys = Object.keys(dp).map(k => `"${k}"`).join(", ");
                const values = Object.values(dp).map(formatValue).join(", ");

                const query = `INSERT INTO "delivery_persons" (${keys}) VALUES (${values}) ON CONFLICT DO NOTHING`;
                await database.$executeRawUnsafe(query);
            }
        }

        console.log("Restore completed successfully!");
    } catch (error) {
        console.error("Restore failed:", error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

restore();
