import express from 'express';
import { Order, MenuItem } from '../models/mongodb-models';

const router = express.Router();

router.get('/:canteenId/monitor', async (req, res) => {
    try {
        const { canteenId } = req.params;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // 1. Active Orders (preparing, pending, etc.)
        // Statuses: 'preparing', 'pending', 'payment_pending', 'ready'
        const activeOrders = await Order.countDocuments({
            canteenId,
            status: { $in: ['preparing', 'pending', 'payment_pending', 'ready'] }
        });

        // 2. Menu Items
        const totalMenuItems = await MenuItem.countDocuments({
            canteenId,
            available: true
        });

        // 3. Today's Revenue (completed orders)
        const revenueResult = await Order.aggregate([
            {
                $match: {
                    canteenId,
                    status: 'completed',
                    createdAt: { $gte: startOfDay }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        const todayRevenue = revenueResult[0]?.total || 0;

        // 4. Staff Active (Mock for now)
        const activeStaff = 0;

        res.json({
            activeOrders,
            totalMenuItems,
            todayRevenue,
            activeStaff
        });
    } catch (error) {
        console.error("Monitor stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

router.get('/:canteenId/menu-stats', async (req, res) => {
    try {
        const { canteenId } = req.params;

        // Fetch all menu items for this canteen
        // Sort by trending (desc), then available (desc), then name (asc)
        const items = await MenuItem.find({ canteenId })
            .select('name price stock available categoryId isTrending isVegetarian imageUrl')
            .sort({ isTrending: -1, available: -1, name: 1 })
            .limit(50); // Limit to top 50 for now to be safe

        res.json({ items });
    } catch (error) {
        console.error("Menu stats error:", error);
        res.status(500).json({ error: "Failed to fetch menu stats" });
    }
});

export default router;
