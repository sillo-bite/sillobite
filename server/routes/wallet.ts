import { Router } from 'express';
import { walletService } from '../services/walletService';
import { razorpayInstance, createRazorpayOrder, verifyPaymentSignature } from '@shared/razorpay';
import crypto from 'crypto';

const router = Router();

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
      transactions: result.transactions.map(t => ({
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
 * Create Razorpay order for wallet top-up
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

    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder(
      amount * 100, // Convert to paise
      'INR',
      `wallet_topup_${userId}_${Date.now()}`,
      {
        userId: userId.toString(),
        type: 'wallet_topup',
        amount: amount.toString()
      }
    );

    // Create pending transaction
    const transaction = await walletService.createPendingTransaction({
      userId,
      amount,
      description: `Wallet top-up of ₹${amount}`,
      referenceType: 'topup',
      orderId: razorpayOrder.id,
      metadata: {
        razorpayOrderId: razorpayOrder.id,
        amount: amount
      }
    });

    console.log(`💰 Created Razorpay order for wallet top-up: ${razorpayOrder.id}`);

    res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      transactionId: transaction.id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('❌ Error creating wallet top-up order:', error);
    res.status(500).json({ message: 'Failed to create top-up order' });
  }
});

/**
 * Verify Razorpay payment and complete wallet top-up
 */
router.post('/:userId/topup/verify', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transactionId) {
      return res.status(400).json({ message: 'Missing payment verification details' });
    }

    // Verify payment signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      // Fail the transaction
      await walletService.failPendingTransaction(transactionId, 'Invalid payment signature');
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // Complete the transaction
    const transaction = await walletService.completePendingTransaction(
      transactionId,
      razorpay_payment_id,
      'razorpay'
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
 * Webhook handler for Razorpay payment events
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ Razorpay webhook secret not configured');
      return res.status(500).json({ message: 'Webhook not configured' });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('❌ Invalid webhook signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📨 Received Razorpay webhook: ${event}`);

    // Handle payment success
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;

      // Find pending transaction
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const transaction = await prisma.walletTransaction.findFirst({
        where: {
          orderId,
          status: 'PENDING'
        }
      });

      if (transaction) {
        await walletService.completePendingTransaction(transaction.id, paymentId, 'razorpay');
        console.log(`✅ Webhook: Completed transaction ${transaction.id}`);
      }
    }

    // Handle payment failure
    if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const transaction = await prisma.walletTransaction.findFirst({
        where: {
          orderId,
          status: 'PENDING'
        }
      });

      if (transaction) {
        await walletService.failPendingTransaction(transaction.id, payment.error_description);
        console.log(`❌ Webhook: Failed transaction ${transaction.id}`);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

export default router;
