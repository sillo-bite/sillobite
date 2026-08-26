import { Router } from 'express';
import { walletService } from '../services/walletService';
import { createPaymentSession, getPaymentDetails, verifyWebhookSignature, ZOHO_PAYMENTS_CONFIG, ZOHO_PAYMENT_EVENTS } from '@shared/zoho-payments';
import { db } from '../db';

const router = Router();

// Type for wallet transaction from Prisma
type WalletTransaction = {
  id: string;
  walletId: number;
  userId: number;
  type: string;
  amount: any;
  balanceBefore: any;
  balanceAfter: any;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  paymentMethod: string | null;
  paymentId: string | null;
  orderId: string | null;
  status: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Get wallet details for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const wallet = await walletService.getOrCreateWallet(userId);
    const stats = await walletService.getWalletStats(userId);

    res.json({
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance.toString(),
        currency: wallet.currency,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      },
      stats: {
        balance: stats.balance.toString(),
        totalCredits: stats.totalCredits.toString(),
        totalDebits: stats.totalDebits.toString(),
        transactionCount: stats.transactionCount,
        currency: stats.currency
      }
    });
  } catch (error) {
    console.error('❌ Error fetching wallet:', error);
    res.status(500).json({ message: 'Failed to fetch wallet details' });
  }
});

/**
 * Get wallet transaction history
 */
router.get('/:userId/transactions', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const result = await walletService.getTransactionHistory(userId, limit, offset);

    res.json({
      transactions: result.transactions.map((t: WalletTransaction) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toString(),
        balanceBefore: t.balanceBefore.toString(),
        balanceAfter: t.balanceAfter.toString(),
        description: t.description,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        paymentMethod: t.paymentMethod,
        paymentId: t.paymentId,
        orderId: t.orderId,
        status: t.status,
        metadata: t.metadata,
        createdAt: t.createdAt
      })),
      totalCount: result.totalCount,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('❌ Error fetching transaction history:', error);
    res.status(500).json({ message: 'Failed to fetch transaction history' });
  }
});

/**
 * Create Zoho Payments session for wallet top-up
 */
router.post('/:userId/topup/create-order', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { amount } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Minimum top-up amount: ₹10
    if (amount < 10) {
      return res.status(400).json({ message: 'Minimum top-up amount is ₹10' });
    }

    // Maximum top-up amount: ₹10,000
    if (amount > 10000) {
      return res.status(400).json({ message: 'Maximum top-up amount is ₹10,000' });
    }

    // Create Zoho Payments session
    const sessionData = await createPaymentSession(
      amount,
      'INR',
      {
        description: `Wallet top-up of ₹${amount}`,
        notes: {
          userId: userId.toString(),
          type: 'wallet_topup',
          amount: amount.toString()
        }
      }
    );

    // Create pending transaction
    const transaction = await walletService.createPendingTransaction({
      userId,
      amount,
      description: `Wallet top-up of ₹${amount}`,
      referenceType: 'topup',
      orderId: sessionData.payment_session_id,
      metadata: {
        zohoPaymentSessionId: sessionData.payment_session_id,
        amount: amount
      }
    });

    console.log(`💰 Created Zoho Payments session for wallet top-up: ${sessionData.payment_session_id}`);

    res.json({
      orderId: sessionData.payment_session_id, // Keeping orderId key for frontend compatibility
      amount: sessionData.amount,
      currency: sessionData.currency,
      transactionId: transaction.id,
      accountId: ZOHO_PAYMENTS_CONFIG.ACCOUNT_ID,
      apiKey: ZOHO_PAYMENTS_CONFIG.API_KEY,
      isTestMode: ZOHO_PAYMENTS_CONFIG.ENV === 'sandbox'
    });
  } catch (error) {
    console.error('❌ Error creating wallet top-up session:', error);
    res.status(500).json({ message: 'Failed to create top-up session' });
  }
});

/**
 * Verify Zoho payment and complete wallet top-up
 */
router.post('/:userId/topup/verify', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { zoho_payment_session_id, zoho_payment_id, transactionId } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (!zoho_payment_session_id || !zoho_payment_id || !transactionId) {
      return res.status(400).json({ message: 'Missing payment verification details' });
    }

    // Verify payment details directly with Zoho API
    try {
      const paymentDetails = await getPaymentDetails(zoho_payment_id);
      if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized' && paymentDetails.status !== 'success') {
        await walletService.failPendingTransaction(transactionId, 'Payment is not in a successful state');
        return res.status(400).json({ message: 'Payment is not in a successful state' });
      }
    } catch (error) {
      console.error("Error verifying wallet top-up with Zoho:", error);
      await walletService.failPendingTransaction(transactionId, 'Failed to verify payment details');
      return res.status(400).json({ message: 'Failed to verify payment details' });
    }

    // Complete the transaction
    const transaction = await walletService.completePendingTransaction(
      transactionId,
      zoho_payment_id,
      'zoho'
    );

    const newBalance = await walletService.getBalance(userId);

    console.log(`✅ Wallet top-up completed for user ${userId}. New balance: ₹${newBalance}`);

    res.json({
      success: true,
      message: 'Wallet top-up successful',
      transaction: {
        id: transaction.id,
        amount: transaction.amount.toString(),
        balanceAfter: transaction.balanceAfter.toString(),
        status: transaction.status
      },
      newBalance: newBalance.toString()
    });
  } catch (error) {
    console.error('❌ Error verifying wallet top-up:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
});

/**
 * Check wallet balance
 */
router.get('/:userId/balance', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const balance = await walletService.getBalance(userId);

    res.json({
      balance: balance.toString(),
      currency: 'INR'
    });
  } catch (error) {
    console.error('❌ Error fetching wallet balance:', error);
    res.status(500).json({ message: 'Failed to fetch balance' });
  }
});

/**
 * Webhook handler for Zoho Payments events (wallet top-ups)
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-zoho-webhook-signature'] as string;
    const payload = req.body;

    if (!signature) {
      console.error('❌ Webhook missing signature');
      return res.status(401).json({ message: 'Missing signature' });
    }

    // Verify webhook signature
    const payloadString = JSON.stringify(payload);
    if (!verifyWebhookSignature(payloadString, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = payload.event || payload.event_type;
    const entity = payload.data?.payment || payload.data || payload.payment;

    if (!entity) {
      return res.status(400).json({ message: 'Invalid payload structure' });
    }

    console.log(`📨 Received Zoho webhook for wallet: ${event}`);

    const zohoPaymentSessionId = entity.payment_session_id;
    const zohoPaymentId = entity.payment_id || entity.id;

    // Handle payment success
    if (entity.status === 'captured' || entity.status === 'authorized' || entity.status === 'success' || event === ZOHO_PAYMENT_EVENTS.PAYMENT_SUCCEEDED) {
      // Find pending transaction
      const prisma = db();
      
      const transaction = await (prisma as any).walletTransaction.findFirst({
        where: {
          orderId: zohoPaymentSessionId,
          status: 'PENDING'
        }
      });

      if (transaction) {
        await walletService.completePendingTransaction(transaction.id, zohoPaymentId, 'zoho');
        console.log(`✅ Webhook: Completed wallet transaction ${transaction.id}`);
      }
    }

    // Handle payment failure
    if (entity.status === 'failed' || event === ZOHO_PAYMENT_EVENTS.PAYMENT_FAILED) {
      const prisma = db();
      
      const transaction = await (prisma as any).walletTransaction.findFirst({
        where: {
          orderId: zohoPaymentSessionId,
          status: 'PENDING'
        }
      });

      if (transaction) {
        await walletService.failPendingTransaction(transaction.id, entity.error_message || entity.error_description || 'Payment Failed');
        console.log(`❌ Webhook: Failed wallet transaction ${transaction.id}`);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Error processing wallet webhook:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

export default router;
