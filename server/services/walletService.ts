import { PrismaClient, TransactionType, TransactionStatus } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

export class WalletService {
  /**
   * Get or create wallet for a user
   */
  async getOrCreateWallet(userId: number) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: new Decimal(0),
          currency: 'INR',
          isActive: true
        },
        include: {
          transactions: true
        }
      });
      console.log(`💰 Created new wallet for user ${userId}`);
    }

    return wallet;
  }

  /**
   * Get wallet balance
   */
  async getBalance(userId: number): Promise<Decimal> {
    const wallet = await this.getOrCreateWallet(userId);
    return new Decimal(wallet.balance.toString());
  }

  /**
   * Add funds to wallet (Credit)
   */
  async creditWallet(params: {
    userId: number;
    amount: number;
    description: string;
    referenceType?: string;
    referenceId?: string;
    paymentMethod?: string;
    paymentId?: string;
    orderId?: string;
    metadata?: any;
  }) {
    const { userId, amount, description, referenceType, referenceId, paymentMethod, paymentId, orderId, metadata } = params;

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = new Decimal(wallet.balance.toString());
    const balanceAfter = balanceBefore.plus(amount);

    // Create transaction record
    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: TransactionType.CREDIT,
        amount: new Decimal(amount),
        balanceBefore,
        balanceAfter,
        description,
        referenceType,
        referenceId,
        paymentMethod,
        paymentId,
        orderId,
        status: TransactionStatus.COMPLETED,
        metadata: metadata || {}
      }
    });

    // Update wallet balance
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter }
    });

    console.log(`💰 Credited ₹${amount} to user ${userId} wallet. New balance: ₹${balanceAfter}`);

    return {
      transaction,
      newBalance: balanceAfter
    };
  }

  /**
   * Deduct funds from wallet (Debit)
   */
  async debitWallet(params: {
    userId: number;
    amount: number;
    description: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: any;
  }) {
    const { userId, amount, description, referenceType, referenceId, metadata } = params;

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = new Decimal(wallet.balance.toString());

    if (balanceBefore.lessThan(amount)) {
      throw new Error('Insufficient wallet balance');
    }

    const balanceAfter = balanceBefore.minus(amount);

    // Create transaction record
    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: TransactionType.DEBIT,
        amount: new Decimal(amount),
        balanceBefore,
        balanceAfter,
        description,
        referenceType,
        referenceId,
        status: TransactionStatus.COMPLETED,
        metadata: metadata || {}
      }
    });

    // Update wallet balance
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: balanceAfter }
    });

    console.log(`💰 Debited ₹${amount} from user ${userId} wallet. New balance: ₹${balanceAfter}`);

    return {
      transaction,
      newBalance: balanceAfter
    };
  }

  /**
   * Get wallet transaction history
   */
  async getTransactionHistory(userId: number, limit: number = 50, offset: number = 0) {
    const wallet = await this.getOrCreateWallet(userId);

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const totalCount = await prisma.walletTransaction.count({
      where: { walletId: wallet.id }
    });

    return {
      transactions,
      totalCount,
      hasMore: offset + limit < totalCount
    };
  }

  /**
   * Create pending transaction for payment processing
   */
  async createPendingTransaction(params: {
    userId: number;
    amount: number;
    description: string;
    referenceType: string;
    orderId: string;
    metadata?: any;
  }) {
    const { userId, amount, description, referenceType, orderId, metadata } = params;

    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = new Decimal(wallet.balance.toString());
    const balanceAfter = balanceBefore.plus(amount);

    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: TransactionType.CREDIT,
        amount: new Decimal(amount),
        balanceBefore,
        balanceAfter,
        description,
        referenceType,
        orderId,
        status: TransactionStatus.PENDING,
        metadata: metadata || {}
      }
    });

    console.log(`⏳ Created pending transaction ${transaction.id} for user ${userId}`);

    return transaction;
  }

  /**
   * Complete pending transaction
   */
  async completePendingTransaction(transactionId: string, paymentId: string, paymentMethod: string) {
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Transaction is not in pending state');
    }

    // Update transaction status
    const updatedTransaction = await prisma.walletTransaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.COMPLETED,
        paymentId,
        paymentMethod
      }
    });

    // Update wallet balance
    await prisma.wallet.update({
      where: { id: transaction.walletId },
      data: { balance: transaction.balanceAfter }
    });

    console.log(`✅ Completed transaction ${transactionId} for user ${transaction.userId}`);

    return updatedTransaction;
  }

  /**
   * Fail pending transaction
   */
  async failPendingTransaction(transactionId: string, reason?: string) {
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const updatedTransaction = await prisma.walletTransaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.FAILED,
        metadata: {
          ...(transaction.metadata as any || {}),
          failureReason: reason
        }
      }
    });

    console.log(`❌ Failed transaction ${transactionId} for user ${transaction.userId}`);

    return updatedTransaction;
  }

  /**
   * Refund transaction
   */
  async refundTransaction(params: {
    userId: number;
    amount: number;
    description: string;
    referenceType: string;
    referenceId: string;
    metadata?: any;
  }) {
    const { userId, amount, description, referenceType, referenceId, metadata } = params;

    return await this.creditWallet({
      userId,
      amount,
      description,
      referenceType,
      referenceId,
      metadata: {
        ...metadata,
        isRefund: true
      }
    });
  }

  /**
   * Check if user has sufficient balance
   */
  async hasSufficientBalance(userId: number, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance.greaterThanOrEqualTo(amount);
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(userId: number) {
    const wallet = await this.getOrCreateWallet(userId);

    const [totalCredits, totalDebits, transactionCount] = await Promise.all([
      prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          type: TransactionType.CREDIT,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true }
      }),
      prisma.walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true }
      }),
      prisma.walletTransaction.count({
        where: { walletId: wallet.id }
      })
    ]);

    return {
      balance: new Decimal(wallet.balance.toString()),
      totalCredits: totalCredits._sum.amount || new Decimal(0),
      totalDebits: totalDebits._sum.amount || new Decimal(0),
      transactionCount,
      currency: wallet.currency
    };
  }
}

export const walletService = new WalletService();
