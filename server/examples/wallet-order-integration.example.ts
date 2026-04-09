/**
 * Example: Wallet Integration with Order Processing
 * 
 * This file demonstrates how to integrate the wallet system
 * with order creation and payment processing.
 * 
 * NOTE: This is an example file for future implementation.
 * Do not import or use this in production yet.
 */

import { walletService } from '../services/walletService';

/**
 * Example 1: Check wallet balance before order
 */
async function checkWalletBeforeOrder(userId: number, orderAmount: number) {
  try {
    const hasFunds = await walletService.hasSufficientBalance(userId, orderAmount);
    
    if (!hasFunds) {
      const balance = await walletService.getBalance(userId);
      throw new Error(`Insufficient wallet balance. Available: ₹${balance}, Required: ₹${orderAmount}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    throw error;
  }
}

/**
 * Example 2: Process order payment with wallet
 */
async function processOrderWithWallet(
  userId: number,
  orderId: string,
  orderAmount: number
) {
  try {
    // Check balance first
    await checkWalletBeforeOrder(userId, orderAmount);
    
    // Debit wallet
    const result = await walletService.debitWallet({
      userId,
      amount: orderAmount,
      description: `Payment for order #${orderId}`,
      referenceType: 'order',
      referenceId: orderId,
      metadata: {
        orderId,
        paymentMethod: 'wallet'
      }
    });
    
    console.log(`✅ Order ${orderId} paid with wallet. New balance: ₹${result.newBalance}`);
    
    return {
      success: true,
      transactionId: result.transaction.id,
      newBalance: result.newBalance
    };
  } catch (error) {
    console.error('Error processing order with wallet:', error);
    throw error;
  }
}

/**
 * Example 3: Partial payment (wallet + other method)
 */
async function processPartialPayment(
  userId: number,
  orderId: string,
  totalAmount: number,
  walletAmount: number,
  otherPaymentMethod: string
) {
  try {
    const balance = await walletService.getBalance(userId);
    
    // Validate wallet amount
    if (walletAmount > parseFloat(balance.toString())) {
      throw new Error('Insufficient wallet balance for partial payment');
    }
    
    if (walletAmount > totalAmount) {
      throw new Error('Wallet amount cannot exceed total amount');
    }
    
    // Debit wallet for partial amount
    const walletResult = await walletService.debitWallet({
      userId,
      amount: walletAmount,
      description: `Partial payment for order #${orderId} (Wallet)`,
      referenceType: 'order',
      referenceId: orderId,
      metadata: {
        orderId,
        paymentMethod: 'wallet',
        isPartialPayment: true,
        totalAmount,
        walletAmount,
        remainingAmount: totalAmount - walletAmount
      }
    });
    
    const remainingAmount = totalAmount - walletAmount;
    
    console.log(`✅ Partial payment processed:`);
    console.log(`   Wallet: ₹${walletAmount}`);
    console.log(`   Remaining: ₹${remainingAmount} (${otherPaymentMethod})`);
    console.log(`   New balance: ₹${walletResult.newBalance}`);
    
    return {
      success: true,
      walletTransactionId: walletResult.transaction.id,
      walletAmount,
      remainingAmount,
      newBalance: walletResult.newBalance
    };
  } catch (error) {
    console.error('Error processing partial payment:', error);
    throw error;
  }
}

/**
 * Example 4: Refund to wallet
 */
async function refundOrderToWallet(
  userId: number,
  orderId: string,
  refundAmount: number,
  reason: string
) {
  try {
    const result = await walletService.refundTransaction({
      userId,
      amount: refundAmount,
      description: `Refund for order #${orderId}: ${reason}`,
      referenceType: 'refund',
      referenceId: orderId,
      metadata: {
        orderId,
        reason,
        refundDate: new Date().toISOString()
      }
    });
    
    console.log(`✅ Refund processed for order ${orderId}. New balance: ₹${result.newBalance}`);
    
    return {
      success: true,
      transactionId: result.transaction.id,
      newBalance: result.newBalance
    };
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

/**
 * Example 5: Cashback on order
 */
async function addCashback(
  userId: number,
  orderId: string,
  cashbackAmount: number,
  cashbackPercentage: number
) {
  try {
    const result = await walletService.creditWallet({
      userId,
      amount: cashbackAmount,
      description: `${cashbackPercentage}% cashback on order #${orderId}`,
      referenceType: 'cashback',
      referenceId: orderId,
      metadata: {
        orderId,
        cashbackPercentage,
        cashbackAmount
      }
    });
    
    console.log(`✅ Cashback added for order ${orderId}. New balance: ₹${result.newBalance}`);
    
    return {
      success: true,
      transactionId: result.transaction.id,
      newBalance: result.newBalance
    };
  } catch (error) {
    console.error('Error adding cashback:', error);
    throw error;
  }
}

/**
 * Example 6: Complete order flow with wallet
 */
async function completeOrderFlowWithWallet(
  userId: number,
  orderDetails: {
    orderId: string;
    totalAmount: number;
    items: any[];
  }
) {
  try {
    console.log(`\n📦 Processing order ${orderDetails.orderId}...`);
    
    // Step 1: Check wallet balance
    const balance = await walletService.getBalance(userId);
    console.log(`💰 Current balance: ₹${balance}`);
    
    const hasFunds = await walletService.hasSufficientBalance(
      userId,
      orderDetails.totalAmount
    );
    
    if (!hasFunds) {
      throw new Error(
        `Insufficient balance. Need ₹${orderDetails.totalAmount}, have ₹${balance}`
      );
    }
    
    // Step 2: Process payment
    const paymentResult = await processOrderWithWallet(
      userId,
      orderDetails.orderId,
      orderDetails.totalAmount
    );
    
    // Step 3: Create order (your existing order creation logic)
    console.log(`📝 Creating order in database...`);
    // await createOrder(orderDetails);
    
    // Step 4: Calculate and add cashback (if applicable)
    const cashbackPercentage = 5; // 5% cashback
    const cashbackAmount = orderDetails.totalAmount * (cashbackPercentage / 100);
    
    if (cashbackAmount > 0) {
      await addCashback(
        userId,
        orderDetails.orderId,
        cashbackAmount,
        cashbackPercentage
      );
    }
    
    console.log(`\n✅ Order completed successfully!`);
    console.log(`   Order ID: ${orderDetails.orderId}`);
    console.log(`   Amount: ₹${orderDetails.totalAmount}`);
    console.log(`   Cashback: ₹${cashbackAmount}`);
    console.log(`   New balance: ₹${paymentResult.newBalance}`);
    
    return {
      success: true,
      orderId: orderDetails.orderId,
      transactionId: paymentResult.transactionId,
      newBalance: paymentResult.newBalance,
      cashbackAmount
    };
  } catch (error) {
    console.error('Error completing order:', error);
    throw error;
  }
}

/**
 * Example 7: Get wallet summary for user
 */
async function getWalletSummary(userId: number) {
  try {
    const [wallet, stats, recentTransactions] = await Promise.all([
      walletService.getOrCreateWallet(userId),
      walletService.getWalletStats(userId),
      walletService.getTransactionHistory(userId, 5, 0)
    ]);
    
    console.log(`\n💰 Wallet Summary for User ${userId}`);
    console.log(`   Balance: ₹${stats.balance}`);
    console.log(`   Total Added: ₹${stats.totalCredits}`);
    console.log(`   Total Spent: ₹${stats.totalDebits}`);
    console.log(`   Transactions: ${stats.transactionCount}`);
    console.log(`\n📊 Recent Transactions:`);
    
    recentTransactions.transactions.forEach((txn, index) => {
      const icon = txn.type === 'CREDIT' ? '↓' : '↑';
      const color = txn.type === 'CREDIT' ? '🟢' : '🔴';
      console.log(
        `   ${index + 1}. ${color} ${icon} ₹${txn.amount} - ${txn.description} (${txn.status})`
      );
    });
    
    return {
      wallet,
      stats,
      recentTransactions: recentTransactions.transactions
    };
  } catch (error) {
    console.error('Error getting wallet summary:', error);
    throw error;
  }
}

// Export examples for reference
export {
  checkWalletBeforeOrder,
  processOrderWithWallet,
  processPartialPayment,
  refundOrderToWallet,
  addCashback,
  completeOrderFlowWithWallet,
  getWalletSummary
};

/**
 * Usage in your order routes:
 * 
 * // In server/routes.ts or order routes
 * app.post('/api/orders', async (req, res) => {
 *   try {
 *     const { userId, items, paymentMethod, useWallet } = req.body;
 *     
 *     // Calculate total
 *     const totalAmount = calculateOrderTotal(items);
 *     
 *     if (paymentMethod === 'wallet' || useWallet) {
 *       // Check wallet balance
 *       const hasFunds = await walletService.hasSufficientBalance(userId, totalAmount);
 *       
 *       if (!hasFunds) {
 *         return res.status(400).json({ 
 *           message: 'Insufficient wallet balance' 
 *         });
 *       }
 *       
 *       // Process with wallet
 *       const result = await processOrderWithWallet(userId, orderId, totalAmount);
 *       
 *       // Create order
 *       const order = await createOrder({...});
 *       
 *       return res.json({ 
 *         success: true, 
 *         order, 
 *         walletTransaction: result 
 *       });
 *     }
 *     
 *     // Handle other payment methods...
 *   } catch (error) {
 *     res.status(500).json({ message: error.message });
 *   }
 * });
 */
