
import { storage } from '../storage-hybrid';
import mongoose from 'mongoose';
import { stockService } from '../stock-service';
import { webPushService } from './webPushService';
import { CheckoutSessionService, checkDuplicatePaymentMiddleware } from '../checkout-session-service';
import { getWebSocketManager } from '../websocket';
import { MenuItem, CanteenCharge, Order } from '../models/mongodb-models';
import { PAYMENT_STATUS } from '@shared/razorpay';
import { generateOrderNumber } from '@shared/utils';
import { insertOrderSchema } from '@shared/schema';

// Removed: const webPushService = new WebPushService();

export interface CreateOrderParams {
    orderData: any;
    orderItems: any[];
    checkoutSessionId?: string;
    merchantTransactionId?: string;
    paymentId?: string; // Razorpay payment ID
    isPos?: boolean;
}

interface EnrichedOrderResult {
    enrichedItems: any[]; // Items with counter IDs
    allStoreCounterIds: string[];
    allPaymentCounterIds: string[];
    allKotCounterIds: string[];
    allCounterIds: string[];
    isMarkable: boolean;
    itemStatusByCounter: Record<string, Record<string, 'pending' | 'ready' | 'completed'>>;
    hasMarkableItem: boolean; // For status determination
    hasMarkableItemWithKot: boolean;
}

export class OrderService {
    /**
     * Enrich raw order items with details from DB (Counter IDs, etc.)
     */
    async enrichOrderItems(rawItems: any[]): Promise<EnrichedOrderResult> {
        const storeCounterIds = new Set<string>();
        const paymentCounterIds = new Set<string>();
        const kotCounterIds = new Set<string>();
        const enrichedItems = [];

        let hasMarkableItem = false;
        let hasMarkableItemWithKot = false;

        // Batch fetch items for performance
        const itemIds = rawItems.map(i => i.id);
        // Use mongoose model directly for lean query
        const menuItems = await MenuItem.find({ _id: { $in: itemIds } }).lean();
        const menuItemMap = new Map(menuItems.map(i => [i._id.toString(), i]));

        for (const item of rawItems) {
            const menuItem: any = menuItemMap.get(item.id);
            const enrichedItem = { ...item };

            if (menuItem) {
                enrichedItem.storeCounterId = menuItem.storeCounterId || null;
                enrichedItem.paymentCounterId = menuItem.paymentCounterId || null;
                enrichedItem.kotCounterId = menuItem.kotCounterId || null;
                enrichedItem.isMarkable = menuItem.isMarkable || false;
                enrichedItem.isVegetarian = menuItem.isVegetarian !== undefined ? menuItem.isVegetarian : true;
                enrichedItem.categoryId = menuItem.categoryId ? String(menuItem.categoryId) : null;
                enrichedItem.available = menuItem.available !== undefined ? menuItem.available : true;

                if (menuItem.storeCounterId) storeCounterIds.add(menuItem.storeCounterId);
                if (menuItem.paymentCounterId) paymentCounterIds.add(menuItem.paymentCounterId);
                if (menuItem.kotCounterId) kotCounterIds.add(menuItem.kotCounterId);

                if (menuItem.isMarkable) {
                    hasMarkableItem = true;
                    if (menuItem.kotCounterId) hasMarkableItemWithKot = true;
                }
            } else {
                enrichedItem.storeCounterId = null;
                enrichedItem.paymentCounterId = null;
                enrichedItem.kotCounterId = null;
                enrichedItem.isMarkable = false;
                enrichedItem.isVegetarian = true;
                enrichedItem.categoryId = null;
                enrichedItem.available = true;
            }
            enrichedItems.push(enrichedItem);
        }

        const allStoreCounterIds = Array.from(storeCounterIds);
        const allPaymentCounterIds = Array.from(paymentCounterIds);
        const allKotCounterIds = Array.from(kotCounterIds);
        const allCounterIds = Array.from(new Set([...allStoreCounterIds, ...allPaymentCounterIds, ...allKotCounterIds]));

        // Initialize auto-ready items status
        const itemStatusByCounter: Record<string, Record<string, 'pending' | 'ready' | 'completed'>> = {};

        for (const counterId of allCounterIds) {
            itemStatusByCounter[counterId] = {};
            for (const item of enrichedItems) {
                if (!item.isMarkable) {
                    itemStatusByCounter[counterId][item.id] = 'ready'; // Auto-ready
                } else {
                    itemStatusByCounter[counterId][item.id] = 'pending';
                }
            }
        }

        return {
            enrichedItems,
            allStoreCounterIds,
            allPaymentCounterIds,
            allKotCounterIds,
            allCounterIds,
            isMarkable: hasMarkableItem, // Legacy simple flag if needed
            itemStatusByCounter,
            hasMarkableItem,
            hasMarkableItemWithKot
        };
    }

    /**
     * Calculate charges based on totals and canteen config (mainly for POS)
     */
    async calculateCharges(canteenId: string, totals: any): Promise<{ chargesTotal: number, chargesApplied: any[] }> {
        let chargesTotal = 0;
        let chargesApplied: any[] = [];

        if (totals && totals.subtotal && totals.total) {
            // Simple logic: total - subtotal + tax = charges? 
            // Logic from routes.ts: expectedTotalWithoutCharges = subtotal - discount + tax
            // chargesTotal = total - expectedTotalWithoutCharges
            const discount = totals.discount || 0;
            const tax = totals.tax || 0;
            const subtotal = totals.subtotal;

            const expectedTotalWithoutCharges = subtotal - discount + tax;
            chargesTotal = totals.total - expectedTotalWithoutCharges;

            if (chargesTotal > 0) {
                try {
                    // Fetch charges to reconstruct details (best effort)
                    const canteenCharges = await CanteenCharge.find({ canteenId, active: true }).lean();
                    chargesApplied = canteenCharges.map((charge: any) => {
                        let chargeAmount = 0;
                        if (charge.type === 'percent') {
                            chargeAmount = (subtotal * charge.value) / 100;
                        } else {
                            chargeAmount = charge.value;
                        }
                        return {
                            name: charge.name,
                            type: charge.type,
                            value: charge.value,
                            amount: chargeAmount
                        };
                    });
                } catch (e) { console.error("Failed to fetch charges", e); }
            }
        }
        return { chargesTotal, chargesApplied };
    }

    /**
     * Helper to determine status based on markable items
     */
    determineInitialStatus(orderData: any, hasMarkableItem: boolean): string {
        if (orderData.isCounterOrder) { // Delivered immediately typically? Or depends. POS takeaway is usually delivered or ready?
            // Routes.ts Line 4299: `const orderStatus = hasMarkableItem ? "pending" : "ready";` for POS Create
            // But Line 5599 (Payment Callback) says: `if (orderData.isCounterOrder) orderStatus = orderData.status || "delivered";`
            // Wait, POS Create sets `status` to pending/ready.
            // Payment Callback (Online) uses `orderData.status`?
            return orderData.status || (hasMarkableItem ? "pending" : "ready");
        }

        if (orderData.isOffline) { // Cash/Offline
            const orderAmount = orderData.amount || 0;
            if (orderAmount <= 0) {
                return hasMarkableItem ? "pending" : "ready";
            } else {
                // If amount > 0 and offline, usually still pending until paid? But POS "create-offline" assumes paid?
                // Routes.ts Line 4458: `const orderStatus = hasMarkableItem ? "pending" : "ready";`
                // Routes Line 5605 (Payment Callback): `pending_payment` if amount > 0?
                // CONTEXT MATTERS: POS vs Online.
                return hasMarkableItem ? "pending" : "ready";
            }
        }

        // Regular online
        return hasMarkableItem ? "pending" : "ready";
    }

    /**
     * Create an order from payment callback (metadata + txnId)
     * This REPLACES `createOrderFromPaymentCallback` in routes.ts
     * 
     * RACE CONDITION FIX: Uses atomic findOneAndUpdate to claim order creation
     */
    async createOrderFromPayment(
        orderData: any,
        merchantTransactionId: string
    ) {
        console.log(`🎟️ [ORDER-SERVICE] createOrderFromPayment called:`, {
            merchantTransactionId,
            customerId: orderData.customerId,
            hasAppliedCoupon: !!orderData.appliedCoupon,
            appliedCouponValue: orderData.appliedCoupon,
            appliedCouponType: typeof orderData.appliedCoupon
        });

        // ATOMIC DUPLICATE PREVENTION: Claim order creation with findOneAndUpdate
        // This prevents race condition between webhook and client callback
        const { Payment } = await import('../models/mongodb-models');
        const mongoose = await import('mongoose');
        
        // Use a special ObjectId as a claiming marker (all zeros is a valid ObjectId)
        const CLAIMING_MARKER = new mongoose.Types.ObjectId('000000000000000000000000');
        
        const claimResult = await Payment.findOneAndUpdate(
            {
                merchantTransactionId: merchantTransactionId,
                orderId: { $exists: false } // Only if no orderId exists
            },
            {
                $set: { 
                    orderId: CLAIMING_MARKER, // Temporary ObjectId marker
                    updatedAt: new Date()
                }
            },
            {
                new: false, // Return the document BEFORE update
                upsert: false
            }
        );

        // If claimResult is null, another process already claimed or created the order
        if (!claimResult) {
            console.log(`⚠️ [ORDER-SERVICE] Order creation already claimed/completed for ${merchantTransactionId}`);
            
            // Check if order already exists
            const existingPayment = await Payment.findOne({ merchantTransactionId });
            if (existingPayment?.orderId) {
                const orderIdStr = String(existingPayment.orderId);
                // Check if it's not the claiming marker
                if (orderIdStr !== '000000000000000000000000') {
                    const existingOrder = await storage.getOrder(orderIdStr);
                    if (existingOrder) {
                        console.log(`✅ [ORDER-SERVICE] Returning existing order: ${existingOrder.orderNumber}`);
                        return existingOrder;
                    }
                }
            }
            
            throw new Error('Order creation already in progress or completed by another process');
        }

        console.log(`🔒 [ORDER-SERVICE] Successfully claimed order creation for ${merchantTransactionId}`);

        try {
            // 1. Duplicate Check (secondary check for safety)
            const customerId = orderData.customerId || 0;
            const canteenId = orderData.canteenId || '';
            const amount = orderData.amount || 0;

            if (amount > 0) {
                const duplicateCheck = await checkDuplicatePaymentMiddleware(customerId, amount, canteenId);
                if (!duplicateCheck.allowed) {
                    // Release the claim
                    await Payment.findOneAndUpdate(
                        { merchantTransactionId },
                        { $unset: { orderId: "" } }
                    );
                    throw new Error(duplicateCheck.message || 'Duplicate order session detected');
                }
            }

            // 2. Parse Items
            let rawItems = [];
            try {
                rawItems = typeof orderData.items === 'string' ? JSON.parse(orderData.items) : orderData.items;
            } catch (e) { 
                // Release the claim on error
                await Payment.findOneAndUpdate(
                    { merchantTransactionId },
                    { $unset: { orderId: "" } }
                );
                throw new Error("Invalid order items format"); 
            }

            // 3. Enrich Items
            const enriched = await this.enrichOrderItems(rawItems);

            // 4. Prepare Order Data
            const orderNumber = generateOrderNumber();
            const barcode = generateOrderNumber();
            const status = this.determineInitialStatus(orderData, enriched.hasMarkableItem);

            const completeOrderData = {
                ...orderData,
                orderNumber,
                barcode,
                status,
                paymentStatus: 'paid', // Assumed success for callback
                orderType: orderData.orderType || 'takeaway',
                items: JSON.stringify(enriched.enrichedItems),
                storeCounterId: enriched.allStoreCounterIds[0] || undefined,
                paymentCounterId: enriched.allPaymentCounterIds[0] || undefined,
                kotCounterId: enriched.allKotCounterIds[0] || undefined,
                allStoreCounterIds: enriched.allStoreCounterIds,
                allPaymentCounterIds: enriched.allPaymentCounterIds,
                allKotCounterIds: enriched.allKotCounterIds,
                allCounterIds: enriched.allCounterIds,
                itemStatusByCounter: enriched.itemStatusByCounter
            };

            // 5. Create Order
            // Note: We use `createOrder` which calls stock logic.
            // Online orders usually skip stock reduction if `checkoutSessionId` exists.
            const order = await this.createOrder({
                orderData: insertOrderSchema.parse(completeOrderData),
                orderItems: enriched.enrichedItems, // Passed for stock validation
                checkoutSessionId: orderData.checkoutSessionId,
                merchantTransactionId: merchantTransactionId,
                isPos: false
            });

            console.log(`✅ [ORDER-SERVICE] Order created successfully: ${order.orderNumber} (${order.id})`);
            return order;

        } catch (error) {
            // Release the claim on any error
            console.error(`❌ [ORDER-SERVICE] Error creating order for ${merchantTransactionId}, releasing claim:`, error);
            await Payment.findOneAndUpdate(
                { merchantTransactionId },
                { $unset: { orderId: "" } }
            );
            throw error;
        }
    }

    /**
     * Create order for failed payment (simple record, no broadcast usually)
     */
    async createOrderForFailedPayment(orderData: any, merchantTransactionId: string) {
        let rawItems = [];
        try {
            rawItems = typeof orderData.items === 'string' ? JSON.parse(orderData.items) : orderData.items;
        } catch (e) { throw new Error("Invalid items"); }

        const enriched = await this.enrichOrderItems(rawItems);
        const orderNumber = generateOrderNumber();

        const completeOrderData = {
            ...orderData,
            orderNumber,
            barcode: generateOrderNumber(),
            status: 'pending_payment',
            paymentStatus: 'failed',
            items: JSON.stringify(enriched.enrichedItems),
            // ... counters ...
            allCounterIds: enriched.allCounterIds,
            // etc
        };

        // Direct creation? Failed payments usually don't reserve stock or need atomic checks?
        // Actually routes.ts Line 5922 use `storage.createOrder`.
        // We can just use storage directly here to avoid stock reduction logic complexity for failed orders.
        // OR use createOrder with forced skipStock?
        // Better to use storage directly for "failed" records as they are inert.
        const order = await storage.createOrder(insertOrderSchema.parse(completeOrderData) as any);

        // Link payment to order
        if (merchantTransactionId && order && order.id) {
            try {
                const orderIdString = typeof order.id === 'string' ? order.id : String(order.id);
                await storage.updatePaymentByMerchantTxnId(merchantTransactionId, {
                    orderId: orderIdString
                });
            } catch (e) { console.error("Failed to link failed order to payment", e); }
        }

        return order;
    }

    /**
     * Centralized method to create an order.
     */
    async createOrder(params: CreateOrderParams) {
        const {
            orderData,
            orderItems,
            checkoutSessionId,
            merchantTransactionId,
            paymentId,
            isPos = false
        } = params;

        console.log(`🔄 OrderService: Creating order for ${orderData.customerName} (POS: ${isPos})`);

        // 1. Determine Stock Strategy
        // POS: Always reduce stock (unless explicitly handled elsewhere, but assuming not).
        // Online: Skip if session exists (reserved).
        const skipStockReduction = isPos ? false : !!checkoutSessionId;

        // 2. Create Order via StockService
        const order = await stockService.processOrderWithStockManagement(
            orderData,
            orderItems,
            skipStockReduction
        );

        if (!order) {
            throw new Error("Order creation failed - no order returned");
        }

        const orderId = order.id;
        const orderNumber = order.orderNumber;

        // 3. Apply Coupon (if provided)
        // Handle both string (coupon code) and object ({ code, discountAmount }) formats
        let couponCode: string | null = null;
        if (orderData.appliedCoupon) {
            if (typeof orderData.appliedCoupon === 'string') {
                couponCode = orderData.appliedCoupon;
            } else if (typeof orderData.appliedCoupon === 'object' && orderData.appliedCoupon.code) {
                couponCode = orderData.appliedCoupon.code;
            }
        }

        if (couponCode && orderData.customerId) {
            console.log(`🎟️ [ORDER-SERVICE] About to apply coupon:`, {
                couponCode: couponCode,
                orderId: orderId,
                orderNumber: orderNumber,
                customerId: orderData.customerId,
                customerIdType: typeof orderData.customerId,
                originalAmount: orderData.originalAmount || orderData.amount,
                itemsSubtotal: orderData.itemsSubtotal,
                appliedCouponType: typeof orderData.appliedCoupon
            });

            // CRITICAL: Ensure customerId is a number
            const customerIdAsNumber = Number(orderData.customerId);
            
            // Use itemsSubtotal (menu items cost only, before charges) for coupon validation
            // This ensures minimum order amount is checked against items only, not including charges
            const amountForCouponValidation = orderData.itemsSubtotal || orderData.originalAmount || orderData.amount;
            
            try {
                const couponApplication = await storage.applyCoupon(
                    couponCode,
                    customerIdAsNumber,
                    amountForCouponValidation, // Use items subtotal, not final amount
                    orderId,
                    orderNumber
                );

                console.log(`🎟️ [ORDER-SERVICE] Coupon application result:`, {
                    success: couponApplication.success,
                    message: couponApplication.message,
                    discountAmount: couponApplication.discountAmount,
                    amountUsedForValidation: amountForCouponValidation
                });

                if (!couponApplication.success) {
                    console.error(`❌ Failed to apply coupon after order creation: ${couponApplication.message}`);
                    // Order is already created, so we log the error but don't fail the request
                } else {
                    console.log(`✅ Coupon ${couponCode} applied successfully to order ${orderNumber}`);
                }
            } catch (error) {
                console.error(`❌ Error applying coupon ${couponCode}:`, error);
                // Don't fail the order creation if coupon application fails
            }
        } else {
            console.log(`🎟️ [ORDER-SERVICE] Skipping coupon application:`, {
                hasAppliedCoupon: !!orderData.appliedCoupon,
                appliedCouponValue: orderData.appliedCoupon,
                appliedCouponType: typeof orderData.appliedCoupon,
                hasCouponCode: !!couponCode,
                hasCustomerId: !!orderData.customerId,
                customerId: orderData.customerId
            });
        }

        // 4. Link Payment (Replace CLAIMING_MARKER with actual orderId)
        if (merchantTransactionId) {
            try {
                const orderIdString = typeof orderId === 'string' ? orderId : String(orderId);
                
                // Use findOneAndUpdate to ensure we're replacing the CLAIMING_MARKER
                const { Payment } = await import('../models/mongodb-models');
                const updateResult = await Payment.findOneAndUpdate(
                    { merchantTransactionId },
                    { 
                        $set: { 
                            orderId: orderIdString,
                            updatedAt: new Date()
                        }
                    },
                    { new: true }
                );
                
                if (updateResult) {
                    console.log(`🔗 Linked payment ${merchantTransactionId} to order ${orderNumber} (replaced claim marker)`);
                } else {
                    console.warn(`⚠️ Payment ${merchantTransactionId} not found when linking to order ${orderNumber}`);
                }
            } catch (err) {
                console.error(`❌ Failed to link payment ${merchantTransactionId} to order ${orderNumber}:`, err);
                // Don't throw - order is already created
            }
        }

        // 5. Clear Checkout Session
        if (checkoutSessionId) {
            try {
                await CheckoutSessionService.updateStatus(checkoutSessionId, 'completed', {
                    orderId: orderId,
                    orderNumber: orderNumber,
                    paymentMethod: orderData.paymentMethod
                });

                if (skipStockReduction) {
                    await CheckoutSessionService.clearReservedStock(checkoutSessionId);
                    console.log(`✅ Cleared reserved stock for session ${checkoutSessionId}`);
                }
            } catch (err) {
                console.error(`❌ Failed to update checkout session ${checkoutSessionId}:`, err);
            }
        }

        // 6. Broadcast WebSockets (Fire-and-forget)
        const wsManager = getWebSocketManager();
        if (wsManager) {
            new Promise<void>(async (resolve) => {
                try {
                    // Logic to determine target counters for broadcast (KOT vs Store)
                    // This logic was complex in routes.ts (lines 5726-5764).
                    // We should implement it here.

                    const broadcastItems = orderItems; // Enriched items
                    let itemStatusByCounter = order.itemStatusByCounter;
                    try {
                        if (typeof itemStatusByCounter === 'string') itemStatusByCounter = JSON.parse(itemStatusByCounter);
                    } catch (e) { }

                    const orderWithParsedData = {
                        ...order,
                        items: broadcastItems,
                        itemStatusByCounter
                    };

                    // A. Broadcast to Canteen
                    wsManager.broadcastToCanteen(order.canteenId, 'new_order', orderWithParsedData);

                    // B. Broadcast to Counters
                    // We need the routing logic.
                    const allStoreCounterIds = orderData.allStoreCounterIds || [];
                    const allPaymentCounterIds = orderData.allPaymentCounterIds || [];
                    const allKotCounterIds = orderData.allKotCounterIds || [];

                    const hasMarkableItem = broadcastItems.some((i: any) => i.isMarkable);
                    const hasMarkableItemWithKot = broadcastItems.some((i: any) => i.isMarkable && i.kotCounterId);

                    const targetCounterIds = new Set<string>();

                    // Always Payment
                    allPaymentCounterIds.forEach((id: string) => targetCounterIds.add(id));

                    if (hasMarkableItem) {
                        if (hasMarkableItemWithKot && allKotCounterIds.length > 0) {
                            allKotCounterIds.forEach((id: string) => targetCounterIds.add(id));
                            // Also store
                            allStoreCounterIds.forEach((id: string) => targetCounterIds.add(id));
                        } else {
                            // Markable but no KOT -> Store
                            allStoreCounterIds.forEach((id: string) => targetCounterIds.add(id));
                        }
                    } else {
                        // No markable -> Store
                        allStoreCounterIds.forEach((id: string) => targetCounterIds.add(id));
                    }

                    // Add KOT for non-markable if needed?
                    if (!hasMarkableItem) {
                        allKotCounterIds.forEach((id: string) => targetCounterIds.add(id));
                    }

                    const uniqueTargets = Array.from(targetCounterIds);
                    if (uniqueTargets.length > 0) {
                        uniqueTargets.forEach(cid => wsManager.broadcastToCounter(cid, 'new_order', orderWithParsedData));
                    }
                } catch (err) {
                    console.error(`❌ WebSocket broadcast failed for order ${orderNumber}:`, err);
                }
                resolve();
            }).catch(err => console.error(`❌ WebSocket async error for order ${orderNumber}:`, err));
        }


        // 6. Send Push Notifications (Fire-and-forget)
        new Promise<void>(async (resolve) => {
            try {
                console.log(`🔔 Triggering push notification for order ${orderNumber} to canteen ${orderData.canteenId}`);

                // Fetch involved counters (Store and KOT) to get names
                const involvedIds = Array.from(new Set([
                    ...(orderData.allStoreCounterIds || []),
                    ...(orderData.allKotCounterIds || [])
                ]));

                let involvedCounters: { id: string, name: string }[] = [];
                if (involvedIds.length > 0) {
                    try {
                        // Try fetching from 'storecounters' collection (common naming convention)
                        let counters: any[] = [];
                        try {
                            // Check if collection exists first to avoid error? No, just try find
                            if (mongoose.connection.db) {
                                counters = await mongoose.connection.db.collection('storecounters').find({ id: { $in: involvedIds } }).toArray();
                            }
                        } catch (e) { /* ignore */ }

                        if (!counters || counters.length === 0) {
                            try {
                                // Try 'counters' collection
                                if (mongoose.connection.db) {
                                    counters = await mongoose.connection.db.collection('counters').find({ id: { $in: involvedIds } }).toArray();
                                }
                            } catch (e) { /* ignore */ }
                        }

                        if (counters && counters.length > 0) {
                            involvedCounters = counters.map((c: any) => ({ id: c.id, name: c.name }));
                        }
                    } catch (err) {
                        console.error('⚠️ Failed to fetch counter names for push notification:', err);
                    }

                    // Fallback for any IDs not found in DB
                    const foundIds = involvedCounters.map(c => c.id);
                    involvedIds.forEach(id => {
                        if (!foundIds.includes(id as string)) {
                            involvedCounters.push({ id: id as string, name: `Counter ${id}` });
                        }
                    });
                }

                await webPushService.sendNewOrderNotification(
                    orderNumber,
                    orderData.customerName,
                    orderData.amount,
                    orderData.canteenId,
                    involvedCounters
                );
                console.log(`📲 Push notification sent for order ${orderNumber}`);
            } catch (err) {
                console.error(`❌ Push notification failed for order ${orderNumber}:`, err);
            }
            resolve();
        }).catch(err => console.error(`❌ Push notification async error for order ${orderNumber}:`, err));

        return order;
    }

    async getTrendingItems(canteenId: string): Promise<any[]> {
        try {
            // Priority 1: Fetch manually marked trending items
            const manualTrending = await MenuItem.find({
                canteenId,
                isTrending: true,
                available: true
            }).lean();

            if (manualTrending.length > 0) {
                // Format manual items
                return manualTrending.map(item => {
                    const obj: any = item;
                    if (obj._id) {
                        obj.id = obj._id.toString();
                        delete obj._id;
                    }
                    if (obj.__v !== undefined) delete obj.__v;
                    return obj;
                });
            }

            // Priority 2: Fallback to sales history if no manual items are selected
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // Use direct DB query for efficiency
            const recentOrders = await Order.find({
                canteenId,
                status: 'completed',
                createdAt: { $gte: sevenDaysAgo }
            }).lean(); // Use lean for performance

            // Aggregate items
            const itemCounts: Record<string, number> = {};

            for (const order of recentOrders) {
                try {
                    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(items)) {
                        for (const item of items) {
                            if (item.menuItemId) {
                                // Ensure we count by ID string
                                const id = item.menuItemId.toString();
                                itemCounts[id] = (itemCounts[id] || 0) + (item.quantity || 1);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error parsing items for order', (order as any)._id, e);
                }
            }

            // Sort by count and take top 5 IDs
            const sortedItemIds = Object.keys(itemCounts).sort((a, b) => itemCounts[b] - itemCounts[a]).slice(0, 5);

            if (sortedItemIds.length === 0) return [];

            // Fetch actual menu items from DB
            const menuItems = await MenuItem.find({
                _id: { $in: sortedItemIds },
                canteenId: canteenId
            }).lean();

            // Map back to maintain sort order and add orderCount
            const result = sortedItemIds.map(id => {
                const item = menuItems.find((m: any) => m._id.toString() === id);
                if (!item) return null;

                const plainItem: any = { ...item };
                if (plainItem._id) {
                    plainItem.id = plainItem._id.toString();
                    delete plainItem._id;
                }
                if (plainItem.__v !== undefined) delete plainItem.__v;

                return {
                    ...plainItem,
                    orderCount: itemCounts[id]
                };
            }).filter(item => item !== null);

            return result;
        } catch (error) {
            console.error('Error fetching trending items:', error);
            return [];
        }
    }

    async getActiveOrders(userId: number, canteenId: string): Promise<any[]> {
        try {
            // Use direct DB query for efficiency
            const orders = await Order.find({
                canteenId,
                customerId: userId,
                status: { $in: ['pending_payment', 'pending', 'preparing', 'ready'] }
            }).sort({ createdAt: -1 }).lean();

            // Format items
            return orders.map((o: any) => {
                const obj: any = o;
                if (obj._id) {
                    obj.id = obj._id.toString();
                    delete obj._id;
                }
                if (obj.__v !== undefined) delete obj.__v;
                return obj;
            });
        } catch (error) {
            console.error('Error fetching active orders:', error);
            return [];
        }
    }
}

export const orderService = new OrderService();
