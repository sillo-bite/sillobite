import { CheckoutSession } from './models/mongodb-models';
import crypto from 'crypto';
import { stockService, StockUpdateItem } from './stock-service';

/**
 * Checkout Session Service
 * Manages checkout sessions to track user checkout flow
 */

export class CheckoutSessionService {
  /**
   * Creates a new checkout session
   * @param customerId - User ID
   * @param canteenId - Canteen ID (optional)
   * @param sessionDurationMinutes - Session validity duration in minutes (default: 20)
   * @returns Session ID
   */
  static async createSession(
    customerId: number,
    canteenId?: string,
    sessionDurationMinutes: number = 20
  ): Promise<string> {
    // Generate unique session ID
    const sessionId = `CHKOUT_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Calculate expiration time
    const expiresAt = new Date(Date.now() + sessionDurationMinutes * 60 * 1000);
    const now = new Date();
    
    // Create session
    await CheckoutSession.create({
      sessionId,
      customerId,
      canteenId,
      status: 'active',
      expiresAt,
      createdAt: now,
      lastActivity: now
    });
    
    console.log(`✅ Checkout session created: ${sessionId} (expires at: ${expiresAt.toISOString()})`);
    
    return sessionId;
  }

  /**
   * Gets session by ID
   */
  static async getSession(sessionId: string) {
    return await CheckoutSession.findOne({ sessionId });
  }

  /**
   * Updates session status
   */
  static async updateStatus(
    sessionId: string,
    status: 'active' | 'completed' | 'abandoned' | 'expired' | 'payment_initiated' | 'payment_completed' | 'payment_failed',
    metadata?: Record<string, any>
  ): Promise<void> {
    // Restore stock if status is payment_failed or abandoned (unless already completed)
    if (status === 'payment_failed' || status === 'abandoned') {
      await this.restoreStockForSession(sessionId);
    }
    
    const updateData: any = {
      status,
      lastActivity: new Date()
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      // Clear reserved stock metadata when order is completed
      await this.clearReservedStock(sessionId);
    } else if (status === 'abandoned') {
      updateData.abandonedAt = new Date();
    }

    if (metadata) {
      updateData.metadata = JSON.stringify(metadata);
    }

    await CheckoutSession.updateOne(
      { sessionId },
      updateData
    );
    
    console.log(`✅ Checkout session ${sessionId} status updated to: ${status}`);
  }

  /**
   * Updates last activity timestamp
   */
  static async updateActivity(sessionId: string): Promise<void> {
    await CheckoutSession.updateOne(
      { sessionId },
      { lastActivity: new Date() }
    );
  }

  /**
   * Validates if a session is still active
   */
  static async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await CheckoutSession.findOne({ sessionId });
    
    if (!session) {
      return false;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Restore stock before marking as expired
      await this.restoreStockForSession(sessionId);
      // Mark as expired
      await CheckoutSession.updateOne(
        { sessionId },
        { status: 'expired' }
      );
      return false;
    }

    return session.status === 'active' || session.status === 'payment_initiated';
  }

  /**
   * Marks a session as abandoned (user left checkout)
   * Also restores reserved stock if any
   */
  static async abandonSession(sessionId: string): Promise<void> {
    // Restore stock before marking as abandoned
    await this.restoreStockForSession(sessionId);
    
    await CheckoutSession.updateOne(
      { sessionId },
      { 
        status: 'abandoned',
        abandonedAt: new Date(),
        lastActivity: new Date()
      }
    );
    
    console.log(`❌ Checkout session abandoned: ${sessionId}`);
  }

  /**
   * Cleans up expired sessions (manual cleanup, TTL index also handles this automatically)
   * Also restores stock for expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const expiredSessions = await CheckoutSession.find({
      status: { $in: ['active', 'payment_initiated'] },
      expiresAt: { $lt: now }
    });
    
    // Restore stock for each expired session
    for (const session of expiredSessions) {
      await this.restoreStockForSession(session.sessionId);
    }
    
    const result = await CheckoutSession.updateMany(
      {
        status: { $in: ['active', 'payment_initiated'] },
        expiresAt: { $lt: now }
      },
      { status: 'expired' }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned up ${result.modifiedCount} expired checkout sessions and restored stock`);
    }
    
    return result.modifiedCount;
  }

  /**
   * Gets active session count for a user
   */
  static async getUserActiveSessionCount(customerId: number): Promise<number> {
    return await CheckoutSession.countDocuments({
      customerId,
      status: { $in: ['active', 'payment_initiated'] },
      expiresAt: { $gt: new Date() }
    });
  }

  /**
   * Gets all active sessions for a user
   */
  static async getUserActiveSessions(customerId: number) {
    return await CheckoutSession.find({
      customerId,
      status: { $in: ['active', 'payment_initiated'] },
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
  }

  /**
   * Gets session status with time remaining
   */
  static async getSessionStatus(sessionId: string) {
    const session = await CheckoutSession.findOne({ sessionId });
    
    if (!session) {
      return null;
    }

    const now = new Date();
    const isExpired = session.expiresAt < now;
    const timeRemaining = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      sessionId: session.sessionId,
      status: isExpired ? 'expired' : session.status,
      timeRemaining,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      canteenId: session.canteenId, // Include canteenId for WebSocket broadcasting
      metadata: session.metadata ? JSON.parse(session.metadata) : null
    };
  }

  /**
   * Check for duplicate payment from the same checkout session
   * Returns true if payment is already in progress for this session
   */
  static async checkDuplicatePaymentFromSession(
    checkoutSessionId: string
  ): Promise<{ isDuplicate: boolean; paymentInitiatedAt?: Date; existingPayment?: any }> {
    const session = await CheckoutSession.findOne({ sessionId: checkoutSessionId });
    
    if (!session) {
      return { isDuplicate: false };
    }

    // Check if session already has payment initiated or completed
    if (session.status === 'payment_initiated' || session.status === 'payment_completed') {
      let paymentInitiatedAt = null;
      let existingPayment = null;
      
      if (session.metadata) {
        try {
          const metadata = JSON.parse(session.metadata);
          paymentInitiatedAt = metadata.paymentInitiatedAt ? new Date(metadata.paymentInitiatedAt) : null;
          existingPayment = {
            razorpayOrderId: metadata.razorpayOrderId,
            merchantTransactionId: metadata.merchantTransactionId,
            amount: metadata.amount
          };
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Also check if payment record exists in database for this checkout session
      try {
        const { Payment } = await import('./models/mongodb-models');
        const existingPaymentRecord = await Payment.findOne({
          metadata: { $regex: new RegExp(`"checkoutSessionId":"${checkoutSessionId}"`, 'i') },
          status: { $in: ['pending', 'success'] }
        }).sort({ createdAt: -1 });

        if (existingPaymentRecord) {
          console.log(`⚠️ Duplicate payment request detected - payment record already exists for checkout session ${checkoutSessionId}`);
          return {
            isDuplicate: true,
            paymentInitiatedAt: existingPaymentRecord.createdAt,
            existingPayment: {
              merchantTransactionId: existingPaymentRecord.merchantTransactionId,
              razorpayOrderId: existingPaymentRecord.metadata ? (() => {
                try {
                  const meta = JSON.parse(existingPaymentRecord.metadata);
                  return meta.razorpayOrderId;
                } catch { return null; }
              })() : null,
              status: existingPaymentRecord.status
            }
          };
        }
      } catch (error) {
        console.error('Error checking payment records:', error);
      }

      // If payment was initiated less than 10 minutes ago, it's likely a duplicate
      if (paymentInitiatedAt) {
        const timeSinceInitiation = Date.now() - paymentInitiatedAt.getTime();
        const tenMinutes = 10 * 60 * 1000;
        
        if (timeSinceInitiation < tenMinutes) {
          console.log(`⚠️ Duplicate payment request detected for checkout session ${checkoutSessionId}:`, {
            paymentInitiatedAt,
            timeSinceInitiation: Math.floor(timeSinceInitiation / 1000) + 's',
            status: session.status
          });
          
          return {
            isDuplicate: true,
            paymentInitiatedAt,
            existingPayment
          };
        }
      } else if (session.status === 'payment_initiated') {
        // If status is payment_initiated but no timestamp, still consider it duplicate
        console.log(`⚠️ Duplicate payment request detected for checkout session ${checkoutSessionId} (status: ${session.status})`);
        return {
          isDuplicate: true,
          existingPayment: session.metadata ? JSON.parse(session.metadata) : null
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Check for duplicate checkout session (for payment prevention across sessions)
   * Returns true if there's an active session with payment initiated
   */
  static async checkDuplicatePayment(
    customerId: number,
    amount: number,
    canteenId: string
  ): Promise<{ isDuplicate: boolean; existingSession?: any }> {
    // First, clean up any expired sessions
    await this.cleanupExpiredSessions();
    
    // Look for active sessions with payment initiated for same customer, amount, and canteen
    const now = new Date();
    
    const existingSession = await CheckoutSession.findOne({
      customerId,
      canteenId,
      status: { $in: ['active', 'payment_initiated'] },
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    if (existingSession) {
      // Check if session has metadata with amount
      let sessionAmount = null;
      if (existingSession.metadata) {
        try {
          const metadata = JSON.parse(existingSession.metadata);
          sessionAmount = metadata.amount;
        } catch (e) {
          // Ignore parse errors
        }
      }

      // If amount matches and session is in payment_initiated, it's a duplicate
      if (existingSession.status === 'payment_initiated' && sessionAmount === amount) {
        console.log(`⚠️ Duplicate payment detected for customer ${customerId}:`, {
          existingSessionId: existingSession.sessionId,
          createdAt: existingSession.createdAt,
          expiresAt: existingSession.expiresAt
        });
        
        return {
          isDuplicate: true,
          existingSession: {
            sessionId: existingSession.sessionId,
            createdAt: existingSession.createdAt,
            expiresAt: existingSession.expiresAt,
            timeRemaining: Math.floor((existingSession.expiresAt.getTime() - Date.now()) / 1000)
          }
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Reserves stock for a checkout session
   * Stores reserved items in session metadata
   */
  static async reserveStockForSession(sessionId: string, cartItems: Array<{ id: string; quantity: number; name: string }>): Promise<void> {
    const session = await CheckoutSession.findOne({ sessionId });
    if (!session) {
      throw new Error(`Checkout session ${sessionId} not found`);
    }

    // Validate and prepare stock updates
    const validation = await stockService.validateAndPrepareStockUpdates(cartItems);
    if (!validation.isValid) {
      throw new Error(`Stock validation failed: ${validation.errors.join(', ')}`);
    }

    // Deduct stock
    await stockService.processStockUpdates(validation.updates);

    // Store reserved stock items in session metadata
    const existingMetadata = session.metadata ? JSON.parse(session.metadata) : {};
    const updatedMetadata = {
      ...existingMetadata,
      reservedStock: validation.updates.map(update => ({
        id: update.id,
        quantity: update.quantity
      })),
      stockReservedAt: new Date().toISOString()
    };

    await CheckoutSession.updateOne(
      { sessionId },
      { metadata: JSON.stringify(updatedMetadata) }
    );

    console.log(`✅ Stock reserved for checkout session ${sessionId}:`, validation.updates);
  }

  /**
   * Restores stock for a checkout session
   * Reads reserved items from session metadata and restores them
   */
  static async restoreStockForSession(sessionId: string): Promise<void> {
    const session = await CheckoutSession.findOne({ sessionId });
    if (!session) {
      console.warn(`⚠️ Checkout session ${sessionId} not found for stock restoration`);
      return;
    }

    // Check if stock was reserved
    if (!session.metadata) {
      return; // No stock was reserved
    }

    try {
      const metadata = JSON.parse(session.metadata);
      const reservedStock = metadata.reservedStock;

      if (!reservedStock || !Array.isArray(reservedStock) || reservedStock.length === 0) {
        return; // No stock was reserved
      }

      // Restore stock
      const restoreUpdates: StockUpdateItem[] = reservedStock.map((item: { id: string; quantity: number }) => ({
        id: item.id,
        quantity: item.quantity,
        operation: 'restore'
      }));

      await stockService.processStockUpdates(restoreUpdates);

      // Remove reserved stock from metadata
      const updatedMetadata = { ...metadata };
      delete updatedMetadata.reservedStock;
      delete updatedMetadata.stockReservedAt;

      await CheckoutSession.updateOne(
        { sessionId },
        { metadata: JSON.stringify(updatedMetadata) }
      );

      console.log(`✅ Stock restored for checkout session ${sessionId}:`, restoreUpdates);
    } catch (error) {
      console.error(`❌ Error restoring stock for checkout session ${sessionId}:`, error);
      // Don't throw - we don't want to block session updates if stock restoration fails
    }
  }

  /**
   * Clears reserved stock from session metadata (called when order is successfully placed)
   */
  static async clearReservedStock(sessionId: string): Promise<void> {
    const session = await CheckoutSession.findOne({ sessionId });
    if (!session || !session.metadata) {
      return;
    }

    try {
      const metadata = JSON.parse(session.metadata);
      if (metadata.reservedStock) {
        const updatedMetadata = { ...metadata };
        delete updatedMetadata.reservedStock;
        delete updatedMetadata.stockReservedAt;

        await CheckoutSession.updateOne(
          { sessionId },
          { metadata: JSON.stringify(updatedMetadata) }
        );

        console.log(`✅ Cleared reserved stock metadata for checkout session ${sessionId}`);
      }
    } catch (error) {
      console.error(`❌ Error clearing reserved stock metadata for checkout session ${sessionId}:`, error);
    }
  }
}

/**
 * Middleware to check for duplicate payment using checkout session
 */
export async function checkDuplicatePaymentMiddleware(
  customerId: number,
  amount: number,
  canteenId: string
): Promise<{ allowed: boolean; message?: string; existingSession?: any }> {
  try {
    const duplicateCheck = await CheckoutSessionService.checkDuplicatePayment(
      customerId,
      amount,
      canteenId
    );

    if (duplicateCheck.isDuplicate) {
      return {
        allowed: false,
        message: `You already have an active payment session. Please wait ${duplicateCheck.existingSession?.timeRemaining || 0} seconds before trying again, or complete the existing payment.`,
        existingSession: duplicateCheck.existingSession
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error in duplicate payment check:', error);
    // Allow payment if check fails to avoid blocking legitimate transactions
    return { allowed: true };
  }
}

