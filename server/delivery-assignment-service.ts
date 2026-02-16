import { getWebSocketManager } from './websocket';
import { db as getPostgresDb } from './db';
import { storage } from './storage-hybrid';

interface PendingAssignment {
  orderId: string;
  orderNumber: string;
  canteenId: string;
  currentDeliveryPersonIndex: number;
  deliveryPersonIds: string[];
  currentDeliveryPersonEmail: string | null; // Track which email was sent the current request
  assignedDeliveryPersonId: string | null;
  timer: NodeJS.Timeout | null;
  startTime: number;
  status: 'pending' | 'accepted' | 'rejected' | 'timeout' | 'completed';
}

class DeliveryAssignmentService {
  private pendingAssignments: Map<string, PendingAssignment> = new Map();
  private readonly ASSIGNMENT_TIMEOUT = 120000; // 2 minutes in milliseconds

  /**
   * Start the delivery person assignment process for an order
   */
  async startAssignment(orderId: string, orderNumber: string, canteenId: string): Promise<void> {
    try {
      console.log(`🚚 Starting delivery assignment for order ${orderNumber} (${orderId})`);

      // Get available delivery persons for this canteen
      const database = getPostgresDb();
      const availableDeliveryPersons = await database.deliveryPerson.findMany({
        where: {
          canteenId,
          isActive: true,
          isAvailable: true
        },
        orderBy: [
          { totalOrderDelivered: 'asc' }, // Prioritize those with fewer deliveries
          { createdAt: 'asc' } // Then by creation date
        ]
      });

      if (availableDeliveryPersons.length === 0) {
        console.log(`⚠️ No available delivery persons for canteen ${canteenId}`);
        return;
      }

      const deliveryPersonIds = availableDeliveryPersons.map(dp => dp.deliveryPersonId);
      console.log(`🚚 Found ${deliveryPersonIds.length} available delivery persons:`, deliveryPersonIds);

      // Create pending assignment
      const assignment: PendingAssignment = {
        orderId,
        orderNumber,
        canteenId,
        currentDeliveryPersonIndex: 0,
        deliveryPersonIds,
        currentDeliveryPersonEmail: null,
        assignedDeliveryPersonId: null,
        timer: null,
        startTime: Date.now(),
        status: 'pending'
      };

      this.pendingAssignments.set(orderId, assignment);

      // Start the assignment cycle
      this.sendAssignmentToNextPerson(orderId);
    } catch (error) {
      console.error(`❌ Error starting delivery assignment for order ${orderId}:`, error);
    }
  }

  /**
   * Send assignment request to the next available delivery person
   */
  private async sendAssignmentToNextPerson(orderId: string): Promise<void> {
    const assignment = this.pendingAssignments.get(orderId);
    if (!assignment || assignment.status !== 'pending') {
      return;
    }

    // Check if we've cycled through all persons - reset to start
    if (assignment.currentDeliveryPersonIndex >= assignment.deliveryPersonIds.length) {
      console.log(`🔄 Cycled through all delivery persons, resetting to first person`);
      assignment.currentDeliveryPersonIndex = 0; // Reset to start of cycle
    }

    const deliveryPersonId = assignment.deliveryPersonIds[assignment.currentDeliveryPersonIndex];
    console.log(`🚚 Sending assignment request to delivery person ${deliveryPersonId} (index ${assignment.currentDeliveryPersonIndex})`);

    // Get order details
    const order = await storage.getOrder(orderId);
    if (!order) {
      console.error(`❌ Order ${orderId} not found`);
      this.pendingAssignments.delete(orderId);
      return;
    }

    // Get delivery person details
    const database = getPostgresDb();
    const deliveryPerson = await database.deliveryPerson.findFirst({
      where: { deliveryPersonId }
    });

    if (!deliveryPerson) {
      console.error(`❌ Delivery person ${deliveryPersonId} not found`);
      assignment.currentDeliveryPersonIndex++;
      setTimeout(() => this.sendAssignmentToNextPerson(orderId), 1000);
      return;
    }

    if (!deliveryPerson.email) {
      console.error(`❌ Delivery person ${deliveryPersonId} has no email`);
      assignment.currentDeliveryPersonIndex++;
      setTimeout(() => this.sendAssignmentToNextPerson(orderId), 1000);
      return;
    }

    // Mark delivery person as unavailable
    await database.deliveryPerson.update({
      where: { id: deliveryPerson.id },
      data: { isAvailable: false }
    });

    // Store the current delivery person email for verification
    assignment.currentDeliveryPersonEmail = deliveryPerson.email;

    // Send assignment request via WebSocket
    const wsManager = getWebSocketManager();
    if (wsManager) {
      // Format delivery address if available
      let formattedAddress = 'Pickup from canteen';
      if (order.deliveryAddress) {
        const addr = order.deliveryAddress;
        const addressParts = [
          addr.addressLine1,
          addr.addressLine2,
          addr.city,
          addr.state,
          addr.pincode
        ].filter(Boolean);
        formattedAddress = addressParts.join(', ');
        if (addr.landmark) {
          formattedAddress += ` (Landmark: ${addr.landmark})`;
        }
      }

      wsManager.broadcastToDeliveryPerson(deliveryPerson.email, {
        type: 'delivery_assignment_request',
        data: {
          orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          amount: order.amount,
          items: order.items,
          address: formattedAddress,
          deliveryAddress: order.deliveryAddress, // Include full address object
          createdAt: order.createdAt,
          timeout: this.ASSIGNMENT_TIMEOUT,
          expiresAt: Date.now() + this.ASSIGNMENT_TIMEOUT
        }
      });
      console.log(`📤 Sent assignment request to delivery person ${deliveryPerson.email} (${deliveryPersonId}) for order ${order.orderNumber}`);
    } else {
      console.error(`❌ WebSocket manager not available`);
    }

    // Set timer for 2 minutes
    assignment.timer = setTimeout(() => {
      this.handleAssignmentTimeout(orderId);
    }, this.ASSIGNMENT_TIMEOUT);

    console.log(`⏱️ Timer set for 2 minutes for delivery person ${deliveryPersonId} (${deliveryPerson.email})`);
  }

  /**
   * Handle assignment acceptance
   */
  async acceptAssignment(orderId: string, deliveryPersonEmail: string): Promise<boolean> {
    const assignment = this.pendingAssignments.get(orderId);
    if (!assignment) {
      console.log(`⚠️ No assignment found for order ${orderId}`);
      return false;
    }

    if (assignment.status !== 'pending') {
      console.log(`⚠️ Assignment for order ${orderId} is not pending (status: ${assignment.status})`);
      return false;
    }

    // Get delivery person
    const database = getPostgresDb();
    const deliveryPerson = await database.deliveryPerson.findFirst({
      where: { email: deliveryPersonEmail }
    });

    if (!deliveryPerson) {
      console.log(`⚠️ Delivery person with email ${deliveryPersonEmail} not found`);
      return false;
    }

    // Check if this is the current person being asked - use email for more reliable matching
    const currentPersonId = assignment.deliveryPersonIds[assignment.currentDeliveryPersonIndex];
    const isCurrentPerson = assignment.currentDeliveryPersonEmail === deliveryPersonEmail ||
      deliveryPerson.deliveryPersonId === currentPersonId;

    console.log(`🔍 Checking assignment acceptance:`, {
      orderId,
      deliveryPersonEmail,
      deliveryPersonId: deliveryPerson.deliveryPersonId,
      currentPersonId,
      currentEmail: assignment.currentDeliveryPersonEmail,
      currentIndex: assignment.currentDeliveryPersonIndex,
      allPersonIds: assignment.deliveryPersonIds,
      status: assignment.status,
      isCurrentPerson
    });

    if (!isCurrentPerson) {
      console.log(`⚠️ Delivery person ${deliveryPersonEmail} (${deliveryPerson.deliveryPersonId}) tried to accept but is not the current assignee`);
      console.log(`   Expected email: ${assignment.currentDeliveryPersonEmail}, Expected ID: ${currentPersonId}`);
      console.log(`   Current index: ${assignment.currentDeliveryPersonIndex}, Total persons: ${assignment.deliveryPersonIds.length}`);
      return false;
    }

    // Clear timer
    if (assignment.timer) {
      clearTimeout(assignment.timer);
      assignment.timer = null;
    }

    // Clear current email tracking
    assignment.currentDeliveryPersonEmail = null;

    // Get the order to check which counters have ready items
    const order = await storage.getOrder(orderId);
    if (!order) {
      console.error(`❌ Order ${orderId} not found during assignment acceptance`);
      return false;
    }

    // Parse order items to find all counters
    const orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const countersWithItems = new Set<string>();
    orderItems.forEach((item: any) => {
      if (item.storeCounterId) {
        countersWithItems.add(item.storeCounterId);
      }
    });

    // Mark all ready items as "out_for_delivery" for each counter
    // This ensures that when a delivery person is assigned, all ready items are marked as out for delivery
    for (const counterId of Array.from(countersWithItems)) {
      try {
        await storage.markOrderOutForDelivery(orderId, counterId, deliveryPerson.deliveryPersonId);
        console.log(`✅ Marked items as out for delivery for counter ${counterId} in order ${orderId}`);
      } catch (error) {
        console.error(`❌ Error marking items as out for delivery for counter ${counterId}:`, error);
        // Continue with other counters even if one fails
      }
    }

    // Assign delivery person to order (this will also update deliveryPersonId if not already set)
    await storage.updateOrder(orderId, {
      deliveryPersonId: deliveryPerson.deliveryPersonId
    });

    // Update delivery person stats
    await database.deliveryPerson.update({
      where: { id: deliveryPerson.id },
      data: {
        isAvailable: false, // Mark as unavailable while delivering
        totalOrderDelivered: { increment: 1 }
      }
    });

    assignment.assignedDeliveryPersonId = deliveryPerson.deliveryPersonId;
    assignment.status = 'accepted';

    // Notify all other delivery persons that assignment is complete
    const wsManager = getWebSocketManager();
    if (wsManager) {
      // Notify the accepting person
      wsManager.broadcastToDeliveryPerson(deliveryPersonEmail, {
        type: 'delivery_assignment_accepted',
        data: {
          orderId,
          orderNumber: assignment.orderNumber
        }
      });

      // Make all other delivery persons available again
      for (const dpId of assignment.deliveryPersonIds) {
        if (dpId !== deliveryPerson.deliveryPersonId) {
          const otherDP = await database.deliveryPerson.findFirst({
            where: { deliveryPersonId: dpId }
          });
          if (otherDP) {
            await database.deliveryPerson.update({
              where: { id: otherDP.id },
              data: { isAvailable: true }
            });
            // Notify them that assignment is no longer available
            if (otherDP.email && wsManager) {
              wsManager.broadcastToDeliveryPerson(otherDP.email, {
                type: 'delivery_assignment_cancelled',
                data: {
                  orderId,
                  orderNumber: assignment.orderNumber
                }
              });
            }
          }
        }
      }
    }

    // Broadcast order update with delivery person info
    if (wsManager) {
      const updatedOrder = await storage.getOrder(orderId);
      if (updatedOrder) {
        const oldStatus = order?.status || 'pending';
        wsManager.broadcastOrderStatusUpdate(assignment.canteenId, updatedOrder, oldStatus, updatedOrder.status);

        // Also broadcast item-level status changes to all counter rooms
        if (updatedOrder.allStoreCounterIds && updatedOrder.allStoreCounterIds.length > 0) {
          updatedOrder.allStoreCounterIds.forEach((storeCounterId: string) => {
            wsManager.broadcastToCounter(storeCounterId, 'item_status_changed', updatedOrder);
          });
        }
      }
    }

    console.log(`✅ Delivery person ${deliveryPerson.deliveryPersonId} accepted order ${assignment.orderNumber}`);
    this.pendingAssignments.delete(orderId);
    return true;
  }

  /**
   * Handle assignment rejection
   */
  async rejectAssignment(orderId: string, deliveryPersonEmail: string): Promise<boolean> {
    const assignment = this.pendingAssignments.get(orderId);
    if (!assignment || assignment.status !== 'pending') {
      return false;
    }

    // Get delivery person
    const database = getPostgresDb();
    const deliveryPerson = await database.deliveryPerson.findFirst({
      where: { email: deliveryPersonEmail }
    });

    if (!deliveryPerson) {
      return false;
    }

    // Check if this is the current person being asked - use email for more reliable matching
    const currentPersonId = assignment.deliveryPersonIds[assignment.currentDeliveryPersonIndex];
    const isCurrentPerson = assignment.currentDeliveryPersonEmail === deliveryPersonEmail ||
      deliveryPerson.deliveryPersonId === currentPersonId;

    if (!isCurrentPerson) {
      console.log(`⚠️ Delivery person ${deliveryPersonEmail} (${deliveryPerson.deliveryPersonId}) tried to reject but is not the current assignee`);
      console.log(`   Expected email: ${assignment.currentDeliveryPersonEmail}, Expected ID: ${currentPersonId}`);
      return false;
    }

    // Clear timer
    if (assignment.timer) {
      clearTimeout(assignment.timer);
      assignment.timer = null;
    }

    // Make delivery person available again
    await database.deliveryPerson.update({
      where: { id: deliveryPerson.id },
      data: { isAvailable: true }
    });
    console.log(`✅ Marked delivery person ${deliveryPerson.deliveryPersonId} (${deliveryPersonEmail}) as available after rejection`);

    // Clear current email tracking
    assignment.currentDeliveryPersonEmail = null;

    // Move to next person
    assignment.currentDeliveryPersonIndex++;
    assignment.status = 'rejected';

    console.log(`❌ Delivery person ${deliveryPerson.deliveryPersonId} rejected order ${assignment.orderNumber}, moving to next person`);

    // Send to next person
    setTimeout(() => {
      assignment.status = 'pending';
      this.sendAssignmentToNextPerson(orderId);
    }, 500);

    return true;
  }

  /**
   * Handle assignment timeout
   */
  private async handleAssignmentTimeout(orderId: string): Promise<void> {
    const assignment = this.pendingAssignments.get(orderId);
    if (!assignment || assignment.status !== 'pending') {
      return;
    }

    const currentPersonId = assignment.deliveryPersonIds[assignment.currentDeliveryPersonIndex];
    console.log(`⏱️ Assignment timeout for delivery person ${currentPersonId} on order ${assignment.orderNumber}`);

    // Get delivery person and make available again
    const database = getPostgresDb();
    const deliveryPerson = await database.deliveryPerson.findFirst({
      where: { deliveryPersonId: currentPersonId }
    });

    if (deliveryPerson) {
      await database.deliveryPerson.update({
        where: { id: deliveryPerson.id },
        data: { isAvailable: true }
      });
    }

    // Clear current email tracking
    assignment.currentDeliveryPersonEmail = null;

    // Move to next person
    assignment.currentDeliveryPersonIndex++;
    assignment.status = 'timeout';

    // Send to next person
    setTimeout(() => {
      assignment.status = 'pending';
      this.sendAssignmentToNextPerson(orderId);
    }, 500);
  }

  /**
   * Get pending assignment for a delivery person
   */
  async getPendingAssignmentForPerson(deliveryPersonEmail: string): Promise<PendingAssignment | null> {
    const database = getPostgresDb();
    const deliveryPerson = await database.deliveryPerson.findFirst({
      where: { email: deliveryPersonEmail }
    });

    if (!deliveryPerson) {
      return null;
    }

    for (const assignment of Array.from(this.pendingAssignments.values())) {
      if (assignment.status === 'pending') {
        const currentPersonId = assignment.deliveryPersonIds[assignment.currentDeliveryPersonIndex];
        if (deliveryPerson.deliveryPersonId === currentPersonId) {
          return assignment;
        }
      }
    }
    return null;
  }

  /**
   * Clean up completed assignments
   */
  cleanup(): void {
    const now = Date.now();
    for (const [orderId, assignment] of Array.from(this.pendingAssignments.entries())) {
      // Remove assignments older than 10 minutes
      if (now - assignment.startTime > 600000) {
        if (assignment.timer) {
          clearTimeout(assignment.timer);
        }
        this.pendingAssignments.delete(orderId);
      }
    }
  }
}

// Singleton instance
export const deliveryAssignmentService = new DeliveryAssignmentService();

// Cleanup every 5 minutes
setInterval(() => {
  deliveryAssignmentService.cleanup();
}, 300000);

