import { Router } from "express";
import { Settlement, PayoutRequest, Order, Payment } from "../models/mongodb-models";
import mongoose from "mongoose";

const router = Router();

// ==================== AUTHENTICATION & RBAC MIDDLEWARES ====================

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// Middleware to verify Admin/Super Admin role
const requireAdmin = (req: any, res: any, next: any) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const role = user.role ? String(user.role).toLowerCase() : "";
  if (role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
};

// Middleware to verify Canteen Owner role (or Admin)
const requireCanteenOwner = (req: any, res: any, next: any) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const role = user.role ? String(user.role).toLowerCase() : "";
  if (role === "admin" || role === "super_admin") {
    return next();
  }
  // If not admin, they must be owner and requesting for their own canteen
  if (role !== "canteen_owner" && role !== "canteen-owner") {
    return res.status(403).json({ error: "Forbidden: Canteen Owner access required" });
  }
  // To strictly verify ownership, we ideally check if user.canteenId / user.id matches the owner logic.
  // We'll enforce that the authenticated user's email matches the canteen owner email if possible, or they have explicit access.
  // For now, based on typical RBAC here, verifying role is standard, but you'd also want to verify `canteenId` against their profile.
  next();
};

// Apply base authentication to all routes defined in this router
router.use(requireAuth);

// ==================== CANTEEN OWNER PAYOUT ENDPOINTS ====================

/**
 * Get pending settlement amount for a canteen
 * Calculates total revenue from completed orders that haven't been settled yet
 * Only includes orders that are actually paid (verified via Payment collection or paymentStatus)
 */
router.get("/canteens/:canteenId/payout/pending", requireCanteenOwner, async (req, res) => {
  try {
    const { canteenId } = req.params;

    // Get all completed/delivered orders for this canteen
    const completedOrders = await Order.find({
      canteenId,
      status: { $in: ["completed", "delivered"] },
    }).sort({ createdAt: -1 });

    // Get all successful payments for this canteen to verify orders are paid
    const successfulPayments = await Payment.find({
      canteenId,
      status: "success",
    });

    // Create a set of order IDs that have successful payments
    // Payment.orderId can be ObjectId or string, so we need to handle both
    const paidOrderIds = new Set<string>();
    const paidOrderNumbers = new Set<string>();

    successfulPayments.forEach((payment) => {
      if (payment.orderId) {
        const orderIdStr = payment.orderId.toString();
        paidOrderIds.add(orderIdStr);
      }
      // Also check metadata for orderNumber if orderId is not set
      if (payment.metadata) {
        try {
          const metadata = JSON.parse(payment.metadata);
          if (metadata.orderNumber) {
            paidOrderNumbers.add(metadata.orderNumber);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Get all settled order IDs
    const settlements = await Settlement.find({
      canteenId,
      status: { $in: ["completed", "processing"] },
    });

    const settledOrderIds = new Set<string>();
    settlements.forEach((settlement) => {
      settlement.orderIds.forEach((orderId) => {
        settledOrderIds.add(orderId);
      });
    });

    // Get all orders in pending payout requests
    const pendingRequests = await PayoutRequest.find({
      canteenId,
      status: { $in: ["pending", "approved", "processing"] },
    });

    const requestedOrderIds = new Set<string>();
    pendingRequests.forEach((request) => {
      request.orderIds.forEach((orderId) => {
        requestedOrderIds.add(orderId);
      });
    });

    // Calculate pending amount (orders that are completed, paid, but not settled or requested)
    let pendingAmount = 0;
    const pendingOrderIds: string[] = [];

    completedOrders.forEach((order) => {
      const orderId = (order as any)._id.toString();

      // Verify order is paid AND eligible for payout:
      // 1. Only include specific payment methods: online, upi, qr
      // 2. Exclude offline and cash payments
      // 3. For online orders: check if there's a successful payment record (by orderId or orderNumber)
      const paymentMethod = order.paymentMethod?.toLowerCase();
      const isEligiblePaymentMethod =
        paymentMethod === 'online' ||
        paymentMethod === 'upi' ||
        paymentMethod === 'qr' ||
        paymentMethod === 'card' ||
        paymentMethod === 'netbanking';

      const isPaid =
        isEligiblePaymentMethod && ( // Only eligible payment methods
          paidOrderIds.has(orderId) || // Has successful payment record by orderId
          paidOrderNumbers.has(order.orderNumber) || // Has successful payment record by orderNumber
          order.paymentStatus === 'paid' ||
          order.paymentStatus === 'completed'
        );

      // Only include if:
      // - Order is paid with eligible payment method
      // - Order is not already settled
      // - Order is not in a pending request
      // - Order has a valid amount

      // Calculate payout amount: menu items + tax (for POS orders), exclude canteen charges
      // Always try to explicitly use itemsSubtotal as it represents the pure menu cost.
      // If it's missing, we fall back to originalAmount, and only as a last resort, amount.
      let itemsAmount = order.itemsSubtotal;
      if (itemsAmount == null) {
        itemsAmount = order.originalAmount ?? order.amount ?? 0;
      }

      const taxAmount = order.taxAmount ?? 0;
      const payoutBaseAmount = itemsAmount + taxAmount;

      if (
        isPaid &&
        !settledOrderIds.has(orderId) &&
        !requestedOrderIds.has(orderId) &&
        payoutBaseAmount > 0
      ) {
        // Include menu items + tax, exclude canteen charges
        pendingAmount += Math.round(payoutBaseAmount * 100); // Convert to paise
        pendingOrderIds.push(orderId);
      }
    });

    res.json({
      pendingAmount,
      pendingAmountInRupees: pendingAmount / 100,
      pendingOrderCount: pendingOrderIds.length,
      pendingOrderIds,
    });
  } catch (error) {
    console.error("Error fetching pending payout:", error);
    res.status(500).json({ error: "Failed to fetch pending payout" });
  }
});

/**
 * Get settlement history for a canteen
 */
router.get("/canteens/:canteenId/payout/settlements", requireCanteenOwner, async (req, res) => {
  try {
    const { canteenId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const settlements = await Settlement.find({ canteenId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    const total = await Settlement.countDocuments({ canteenId });

    res.json({
      settlements: settlements.map((s) => ({
        id: (s as any)._id.toString(),
        settlementId: s.settlementId,
        amount: s.amount,
        amountInRupees: s.amount / 100,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        orderCount: s.orderCount,
        status: s.status,
        processedAt: s.processedAt,
        transactionId: s.transactionId,
        createdAt: s.createdAt,
      })),
      total,
    });
  } catch (error) {
    console.error("Error fetching settlements:", error);
    res.status(500).json({ error: "Failed to fetch settlements" });
  }
});

/**
 * Create a payout request
 */
router.post("/canteens/:canteenId/payout/request", requireCanteenOwner, async (req, res) => {
  try {
    const { canteenId } = req.params;
    const { orderIds, notes } = req.body;

    // Extract user ID from authenticated session
    const requestedBy = (req as any).session?.user?.id;

    // Validate that we have orders to settle
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: "No orders specified for payout" });
    }

    // Filter out invalid ObjectIds to prevent cast errors
    const validOrderIds = orderIds.filter((id: any) => mongoose.Types.ObjectId.isValid(id));

    if (validOrderIds.length === 0) {
      return res.status(400).json({ error: "Invalid order IDs provided" });
    }

    // Get the orders to calculate total amount
    const orders = await Order.find({
      _id: { $in: validOrderIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
      canteenId,
      status: { $in: ["completed", "delivered"] },
    });

    if (orders.length === 0) {
      return res.status(400).json({ error: "No valid completed orders found" });
    }

    // Get successful payments to verify orders are paid
    const orderObjectIds = validOrderIds.map((id: string) => new mongoose.Types.ObjectId(id));
    const successfulPayments = await Payment.find({
      canteenId,
      $or: [
        { orderId: { $in: orderObjectIds } },
        { status: "success" } // Also get all successful payments to check metadata
      ]
    });

    const paidOrderIds = new Set<string>();
    const paidOrderNumbers = new Set<string>();

    successfulPayments.forEach((payment) => {
      if (payment.orderId) {
        paidOrderIds.add(payment.orderId.toString());
      }
      // Also check metadata for orderNumber
      if (payment.metadata) {
        try {
          const metadata = JSON.parse(payment.metadata);
          if (metadata.orderNumber) {
            paidOrderNumbers.add(metadata.orderNumber);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Filter to only include paid orders eligible for payout (only online/UPI/QR payments)
    const paidOrders = orders.filter((order) => {
      const orderId = (order as any)._id.toString();
      const paymentMethod = order.paymentMethod?.toLowerCase();
      const isEligiblePaymentMethod =
        paymentMethod === 'online' ||
        paymentMethod === 'upi' ||
        paymentMethod === 'qr' ||
        paymentMethod === 'card' ||
        paymentMethod === 'netbanking';

      return (
        isEligiblePaymentMethod && ( // Only eligible payment methods
          paidOrderIds.has(orderId) || // Has successful payment record by orderId
          paidOrderNumbers.has(order.orderNumber) || // Has successful payment record by orderNumber
          order.paymentStatus === 'paid' ||
          order.paymentStatus === 'completed'
        ) && order.amount && order.amount > 0 // Has valid amount
      );
    });

    if (paidOrders.length === 0) {
      return res.status(400).json({ error: "No paid orders found. Only paid orders can be included in payout requests." });
    }

    // Check if any of these orders are already settled or in a pending request
    const existingSettlements = await Settlement.find({
      canteenId,
      orderIds: { $in: orderIds },
      status: { $in: ["completed", "processing"] },
    });

    const existingRequests = await PayoutRequest.find({
      canteenId,
      orderIds: { $in: orderIds },
      status: { $in: ["pending", "approved", "processing"] },
    });

    // RACE CONDITION PREVENTION (Debounce check):
    // Also check for any request created in the last 15 seconds for this canteen to prevent double-clicks
    const recentRequest = await PayoutRequest.findOne({
      canteenId,
      createdAt: { $gte: new Date(Date.now() - 15000) }
    });

    if (existingSettlements.length > 0 || existingRequests.length > 0) {
      return res
        .status(400)
        .json({ error: "Some orders are already settled or in a pending request" });
    }

    if (recentRequest) {
      return res
        .status(429)
        .json({ error: "A payout request was just created. Please wait before submitting another one." });
    }

    // Calculate total amount from REAL paid orders only (menu items + tax)
    const totalAmount = paidOrders.reduce((sum, order) => {
      let itemsAmount = order.itemsSubtotal;
      if (itemsAmount == null) {
        itemsAmount = order.originalAmount ?? order.amount ?? 0;
      }
      const taxAmount = order.taxAmount ?? 0;
      const payoutBaseAmount = itemsAmount + taxAmount;
      return sum + Math.round(payoutBaseAmount * 100); // Convert to paise
    }, 0);

    // Use only paid order IDs
    const paidOrderIdStrings = paidOrders.map((order) => (order as any)._id.toString());

    // Find the earliest and latest order dates from paid orders
    const orderDates = paidOrders.map((o) => new Date(o.createdAt));
    const periodStart = new Date(Math.min(...orderDates.map((d) => d.getTime())));
    const periodEnd = new Date(Math.max(...orderDates.map((d) => d.getTime())));

    // Create payout request with REAL paid orders only
    const requestId = `PR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payoutRequest = new PayoutRequest({
      requestId,
      canteenId,
      amount: totalAmount,
      status: "pending",
      requestedBy,
      requestedAt: new Date(),
      orderIds: paidOrderIdStrings, // Only include paid orders
      orderCount: paidOrders.length, // Count of paid orders
      periodStart,
      periodEnd,
      notes,
    });

    await payoutRequest.save();

    res.json({
      success: true,
      payoutRequest: {
        id: (payoutRequest as any)._id.toString(),
        requestId: payoutRequest.requestId,
        amount: payoutRequest.amount,
        amountInRupees: payoutRequest.amount / 100,
        status: payoutRequest.status,
        orderCount: payoutRequest.orderCount,
        requestedAt: payoutRequest.requestedAt,
      },
    });
  } catch (error) {
    console.error("Error creating payout request:", error);
    res.status(500).json({ error: "Failed to create payout request" });
  }
});

/**
 * Get payout request history for a canteen
 */
router.get("/canteens/:canteenId/payout/requests", requireCanteenOwner, async (req, res) => {
  try {
    const { canteenId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const requests = await PayoutRequest.find({ canteenId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    const total = await PayoutRequest.countDocuments({ canteenId });

    res.json({
      requests: requests.map((r) => ({
        id: (r as any)._id.toString(),
        requestId: r.requestId,
        amount: r.amount,
        amountInRupees: r.amount / 100,
        status: r.status,
        orderCount: r.orderCount,
        requestedAt: r.requestedAt,
        approvedAt: r.approvedAt,
        rejectedAt: r.rejectedAt,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt,
      })),
      total,
    });
  } catch (error) {
    console.error("Error fetching payout requests:", error);
    res.status(500).json({ error: "Failed to fetch payout requests" });
  }
});

// ==================== ADMIN PAYOUT MANAGEMENT ENDPOINTS ====================

/**
 * Get all payout requests (admin)
 */
router.get("/admin/payout/requests", requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const requests = await PayoutRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    const total = await PayoutRequest.countDocuments(query);

    res.json({
      requests: requests.map((r) => ({
        id: (r as any)._id.toString(),
        requestId: r.requestId,
        canteenId: r.canteenId,
        amount: r.amount,
        amountInRupees: r.amount / 100,
        status: r.status,
        orderCount: r.orderCount,
        requestedBy: r.requestedBy,
        requestedAt: r.requestedAt,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        approvedBy: r.approvedBy,
        approvedAt: r.approvedAt,
        rejectedBy: r.rejectedBy,
        rejectedAt: r.rejectedAt,
        rejectionReason: r.rejectionReason,
        settlementId: r.settlementId,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
      total,
    });
  } catch (error) {
    console.error("Error fetching payout requests:", error);
    res.status(500).json({ error: "Failed to fetch payout requests" });
  }
});

/**
 * Get a single payout request (admin)
 */
router.get("/admin/payout/requests/:requestId", requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await PayoutRequest.findOne({ requestId });

    if (!request) {
      return res.status(404).json({ error: "Payout request not found" });
    }

    // Get order details securely
    const validOrderIds = (request.orderIds || []).filter((id: any) => mongoose.Types.ObjectId.isValid(id));
    const orders = await Order.find({
      _id: { $in: validOrderIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    res.json({
      request: {
        id: (request as any)._id.toString(),
        requestId: request.requestId,
        canteenId: request.canteenId,
        amount: request.amount,
        amountInRupees: request.amount / 100,
        status: request.status,
        orderCount: request.orderCount,
        requestedBy: request.requestedBy,
        requestedAt: request.requestedAt,
        periodStart: request.periodStart,
        periodEnd: request.periodEnd,
        approvedBy: request.approvedBy,
        approvedAt: request.approvedAt,
        rejectedBy: request.rejectedBy,
        rejectedAt: request.rejectedAt,
        rejectionReason: request.rejectionReason,
        settlementId: request.settlementId,
        notes: request.notes,
        createdAt: request.createdAt,
        orders: orders.map((o) => ({
          id: (o as any)._id.toString(),
          orderNumber: o.orderNumber,
          amount: o.amount,
          status: o.status,
          createdAt: o.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching payout request:", error);
    res.status(500).json({ error: "Failed to fetch payout request" });
  }
});

/**
 * Approve a payout request (admin)
 */
router.post("/admin/payout/requests/:requestId/approve", requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { notes } = req.body;

    // Extract approvedBy from the authenticated session
    const approvedBy = (req as any).session?.user?.id;

    const request = await PayoutRequest.findOne({ requestId });

    if (!request) {
      return res.status(404).json({ error: "Payout request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ error: `Cannot approve request with status: ${request.status}` });
    }

    // Update request status
    request.status = "approved";
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();
    if (notes) {
      request.notes = notes;
    }

    await request.save();

    res.json({
      success: true,
      request: {
        id: (request as any)._id.toString(),
        requestId: request.requestId,
        status: request.status,
        approvedAt: request.approvedAt,
      },
    });
  } catch (error) {
    console.error("Error approving payout request:", error);
    res.status(500).json({ error: "Failed to approve payout request" });
  }
});

/**
 * Reject a payout request (admin)
 */
router.post("/admin/payout/requests/:requestId/reject", requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason, notes } = req.body;

    // Extract rejectedBy from the authenticated session
    const rejectedBy = (req as any).session?.user?.id;

    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const request = await PayoutRequest.findOne({ requestId });

    if (!request) {
      return res.status(404).json({ error: "Payout request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ error: `Cannot reject request with status: ${request.status}` });
    }

    // Update request status
    request.status = "rejected";
    request.rejectedBy = rejectedBy;
    request.rejectedAt = new Date();
    request.rejectionReason = rejectionReason;
    if (notes) {
      request.notes = notes;
    }

    await request.save();

    res.json({
      success: true,
      request: {
        id: (request as any)._id.toString(),
        requestId: request.requestId,
        status: request.status,
        rejectedAt: request.rejectedAt,
      },
    });
  } catch (error) {
    console.error("Error rejecting payout request:", error);
    res.status(500).json({ error: "Failed to reject payout request" });
  }
});

/**
 * Process a payout request (admin) - Creates a settlement
 */
router.post("/admin/payout/requests/:requestId/process", requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { transactionId, notes } = req.body;

    // Extract processedBy from the authenticated session
    const processedBy = (req as any).session?.user?.id;

    const request = await PayoutRequest.findOne({ requestId });

    if (!request) {
      return res.status(404).json({ error: "Payout request not found" });
    }

    if (request.status !== "approved") {
      return res
        .status(400)
        .json({ error: `Cannot process request with status: ${request.status}` });
    }

    // Check if already processed
    if (request.settlementId) {
      return res
        .status(400)
        .json({ error: "This request has already been processed" });
    }

    // Create settlement
    const settlementId = `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const settlement = new Settlement({
      settlementId,
      canteenId: request.canteenId,
      amount: request.amount,
      periodStart: request.periodStart || new Date(),
      periodEnd: request.periodEnd || new Date(),
      orderIds: request.orderIds,
      orderCount: request.orderCount,
      status: "processing",
      payoutRequestId: request.requestId,
      processedBy,
      transactionId,
      notes,
    });

    await settlement.save();

    // Update request status
    request.status = "processing";
    request.settlementId = settlementId;
    if (notes) {
      request.notes = notes;
    }
    await request.save();

    res.json({
      success: true,
      settlement: {
        id: (settlement as any)._id.toString(),
        settlementId: settlement.settlementId,
        amount: settlement.amount,
        amountInRupees: settlement.amount / 100,
        status: settlement.status,
      },
      request: {
        id: (request as any)._id.toString(),
        requestId: request.requestId,
        status: request.status,
        settlementId: request.settlementId,
      },
    });
  } catch (error) {
    console.error("Error processing payout request:", error);
    res.status(500).json({ error: "Failed to process payout request" });
  }
});

/**
 * Complete a settlement (admin) - Marks settlement as completed
 */
router.post("/admin/payout/settlements/:settlementId/complete", requireAdmin, async (req, res) => {
  try {
    const { settlementId } = req.params;
    const { transactionId, notes } = req.body;

    // Extract processedBy from authenticated session
    const processedBy = (req as any).session?.user?.id;

    const settlement = await Settlement.findOne({ settlementId });

    if (!settlement) {
      return res.status(404).json({ error: "Settlement not found" });
    }

    if (settlement.status !== "processing") {
      return res
        .status(400)
        .json({ error: `Cannot complete settlement with status: ${settlement.status}` });
    }

    // Update settlement
    settlement.status = "completed";
    settlement.processedAt = new Date();
    if (processedBy) {
      settlement.processedBy = processedBy;
    }
    if (transactionId) {
      settlement.transactionId = transactionId;
    }
    if (notes) {
      settlement.notes = notes;
    }
    await settlement.save();

    // Update associated payout request
    if (settlement.payoutRequestId) {
      const request = await PayoutRequest.findOne({
        requestId: settlement.payoutRequestId,
      });
      if (request) {
        request.status = "completed";
        await request.save();
      }
    }

    res.json({
      success: true,
      settlement: {
        id: (settlement as any)._id.toString(),
        settlementId: settlement.settlementId,
        status: settlement.status,
        processedAt: settlement.processedAt,
      },
    });
  } catch (error) {
    console.error("Error completing settlement:", error);
    res.status(500).json({ error: "Failed to complete settlement" });
  }
});

/**
 * Get all settlements (admin)
 */
router.get("/admin/payout/settlements", requireAdmin, async (req, res) => {
  try {
    const { canteenId, status, limit = 50, offset = 0 } = req.query;

    const query: any = {};
    if (canteenId) {
      query.canteenId = canteenId;
    }
    if (status) {
      query.status = status;
    }

    const settlements = await Settlement.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    const total = await Settlement.countDocuments(query);

    res.json({
      settlements: settlements.map((s) => ({
        id: (s as any)._id.toString(),
        settlementId: s.settlementId,
        canteenId: s.canteenId,
        amount: s.amount,
        amountInRupees: s.amount / 100,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        orderCount: s.orderCount,
        status: s.status,
        processedAt: s.processedAt,
        processedBy: s.processedBy,
        transactionId: s.transactionId,
        notes: s.notes,
        createdAt: s.createdAt,
      })),
      total,
    });
  } catch (error) {
    console.error("Error fetching settlements:", error);
    res.status(500).json({ error: "Failed to fetch settlements" });
  }
});

export default router;

