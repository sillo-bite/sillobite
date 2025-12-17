import { PaymentSession } from './models/mongodb-models';
import crypto from 'crypto';

/**
 * Payment Session Service
 * Manages payment sessions to prevent duplicate submissions
 */

export class PaymentSessionService {
  /**
   * Creates a new payment session
   * @param customerId - User ID
   * @param amount - Payment amount
   * @param canteenId - Canteen ID
   * @param orderData - Order data object
   * @param sessionDurationMinutes - Session validity duration in minutes (default: 10)
   * @returns Session ID
   */
  static async createSession(
    customerId: number,
    amount: number,
    canteenId: string,
    orderData: any,
    sessionDurationMinutes: number = 10
  ): Promise<string> {
    // Generate unique session ID
    const sessionId = `PSESS_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Calculate expiration time
    const expiresAt = new Date(Date.now() + sessionDurationMinutes * 60 * 1000);
    
    // Create session
    await PaymentSession.create({
      sessionId,
      customerId,
      amount,
      canteenId,
      orderData: JSON.stringify(orderData),
      status: 'active',
      expiresAt,
      createdAt: new Date()
    });
    
    console.log(`✅ Payment session created: ${sessionId} (expires at: ${expiresAt.toISOString()})`);
    
    return sessionId;
  }

  /**
   * Validates if user has an active session for similar payment
   * Returns existing session if found, null otherwise
   */
  static async checkDuplicateSession(
    customerId: number,
    amount: number,
    canteenId: string
  ): Promise<{ isDuplicate: boolean; existingSession?: any }> {
    // First, clean up any expired sessions for this user
    await this.cleanupExpiredSessions();
    
    // Look for active sessions with same customer, amount, and canteen
    // Only check for truly active sessions (not expired, not completed, not cancelled)
    const now = new Date();
    
    const existingSession = await PaymentSession.findOne({
      customerId,
      amount,
      canteenId,
      status: 'active',
      expiresAt: { $gt: now } // Not yet expired
    }).sort({ createdAt: -1 });

    if (existingSession) {
      // Check if this session has an associated successful payment
      // If payment was successful, allow new payment (user wants to order again)
      try {
        const { Payment } = await import('./models/mongodb-models');
        // SessionId is stored in payment metadata, so we need to search in metadata
        const payments = await Payment.find({
          $or: [
            { metadata: { $regex: new RegExp(`"sessionId":"${existingSession.sessionId}"`, 'i') } },
            { metadata: { $regex: new RegExp(existingSession.sessionId, 'i') } }
          ]
        }).sort({ createdAt: -1 });
        
        // If there's a successful payment for this session, allow new payment
        const successfulPayment = payments.find(p => p.status === 'success');
        if (successfulPayment) {
          console.log(`✅ Previous session had successful payment - allowing new payment for customer ${customerId}`);
          // Mark the old session as completed since payment was successful
          await this.completeSession(existingSession.sessionId);
          return { isDuplicate: false };
        }
      } catch (error) {
        console.error('Error checking payment status for session:', error);
        // Continue with duplicate check if payment check fails
      }
      
      // Check if session is actually expired (double check)
      if (existingSession.expiresAt <= now) {
        // Mark as expired and allow new payment
        await PaymentSession.updateOne(
          { sessionId: existingSession.sessionId },
          { status: 'expired' }
        );
        return { isDuplicate: false };
      }
      
      // Check if session is old (more than 2 minutes) and has no payment attempt
      // This handles cases where user closed payment modal but session wasn't cancelled
      const sessionAge = now.getTime() - existingSession.createdAt.getTime();
      const twoMinutes = 2 * 60 * 1000;
      
      if (sessionAge > twoMinutes) {
        try {
          const { Payment } = await import('./models/mongodb-models');
          const payments = await Payment.find({
            $or: [
              { metadata: { $regex: new RegExp(`"sessionId":"${existingSession.sessionId}"`, 'i') } },
              { metadata: { $regex: new RegExp(existingSession.sessionId, 'i') } }
            ]
          });
          
          // If no payment exists for this old session, likely user closed modal - allow new payment
          if (payments.length === 0) {
            console.log(`✅ Old session (${Math.floor(sessionAge / 1000)}s) with no payment - allowing new payment for customer ${customerId}`);
            await this.cancelSession(existingSession.sessionId);
            return { isDuplicate: false };
          }
        } catch (error) {
          console.error('Error checking payments for old session:', error);
          // Continue with duplicate check if payment check fails
        }
      }
      
      console.log(`⚠️ Duplicate session detected for customer ${customerId}:`, {
        existingSessionId: existingSession.sessionId,
        createdAt: existingSession.createdAt,
        expiresAt: existingSession.expiresAt,
        ageSeconds: Math.floor(sessionAge / 1000)
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

    return { isDuplicate: false };
  }

  /**
   * Gets session by ID
   */
  static async getSession(sessionId: string) {
    return await PaymentSession.findOne({ sessionId });
  }

  /**
   * Validates if a session is still active
   */
  static async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await PaymentSession.findOne({ sessionId });
    
    if (!session) {
      return false;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Mark as expired
      await PaymentSession.updateOne(
        { sessionId },
        { status: 'expired' }
      );
      return false;
    }

    return session.status === 'active';
  }

  /**
   * Marks a session as completed
   */
  static async completeSession(sessionId: string): Promise<void> {
    await PaymentSession.updateOne(
      { sessionId },
      { 
        status: 'completed',
        completedAt: new Date()
      }
    );
    
    console.log(`✅ Payment session completed: ${sessionId}`);
  }

  /**
   * Cancels a session
   */
  static async cancelSession(sessionId: string): Promise<void> {
    await PaymentSession.updateOne(
      { sessionId },
      { status: 'cancelled' }
    );
    
    console.log(`❌ Payment session cancelled: ${sessionId}`);
  }

  /**
   * Cleans up expired sessions (manual cleanup, TTL index also handles this automatically)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await PaymentSession.updateMany(
      {
        status: 'active',
        expiresAt: { $lt: new Date() }
      },
      { status: 'expired' }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned up ${result.modifiedCount} expired payment sessions`);
    }
    
    return result.modifiedCount;
  }

  /**
   * Gets active session count for a user
   */
  static async getUserActiveSessionCount(customerId: number): Promise<number> {
    return await PaymentSession.countDocuments({
      customerId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });
  }

  /**
   * Gets all active sessions for a user
   */
  static async getUserActiveSessions(customerId: number) {
    return await PaymentSession.find({
      customerId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
  }

  /**
   * Validates order data hasn't been tampered with
   */
  static validateOrderData(session: any, incomingOrderData: any): boolean {
    try {
      const storedOrderData = JSON.parse(session.orderData);
      
      // Compare critical fields
      return (
        storedOrderData.customerId === incomingOrderData.customerId &&
        storedOrderData.amount === incomingOrderData.amount &&
        session.canteenId === incomingOrderData.canteenId
      );
    } catch (error) {
      console.error('Error validating order data:', error);
      return false;
    }
  }
}

/**
 * Middleware to check for duplicate payment submissions
 */
export async function checkDuplicatePaymentMiddleware(
  customerId: number,
  amount: number,
  canteenId: string
): Promise<{ allowed: boolean; message?: string; existingSession?: any }> {
  try {
    const duplicateCheck = await PaymentSessionService.checkDuplicateSession(
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

