import mongoose from 'mongoose';
import { MenuItem, CheckoutSession, PaymentSession } from '../models/mongodb-models';

/**
 * Add database indexes for frequently queried fields
 * SCALABILITY FIX: Improves query performance under high load
 */
export async function addPerformanceIndexes(): Promise<void> {
  try {
    console.log('📊 Adding performance indexes...');

    // MenuItem indexes
    await MenuItem.collection.createIndex({ canteenId: 1, isActive: 1 });
    await MenuItem.collection.createIndex({ stock: 1 }); // For stock queries
    await MenuItem.collection.createIndex({ category: 1, isActive: 1 });
    console.log('✅ MenuItem indexes created');

    // CheckoutSession indexes
    // SCALABILITY FIX: Check if indexes exist before creating to avoid conflicts
    try {
      await CheckoutSession.collection.createIndex({ sessionId: 1 }, { unique: true });
    } catch (error: any) {
      if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
    }
    
    try {
      await CheckoutSession.collection.createIndex({ customerId: 1, status: 1 });
    } catch (error: any) {
      if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
    }
    
    try {
      await CheckoutSession.collection.createIndex({ canteenId: 1, status: 1 });
    } catch (error: any) {
      if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
    }
    
    // expiresAt index might already exist with TTL options - skip if conflict
    try {
      await CheckoutSession.collection.createIndex({ expiresAt: 1 });
    } catch (error: any) {
      if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
      // Index exists with different options (likely TTL) - that's fine
    }
    
    try {
      await CheckoutSession.collection.createIndex({ status: 1, lastActivity: 1 });
    } catch (error: any) {
      if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
    }
    
    console.log('✅ CheckoutSession indexes created');

    // PaymentSession indexes (if exists)
    try {
      try {
        await PaymentSession.collection.createIndex({ merchantTransactionId: 1 }, { unique: true });
      } catch (error: any) {
        if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
      }
      
      try {
        await PaymentSession.collection.createIndex({ customerId: 1, status: 1 });
      } catch (error: any) {
        if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
      }
      
      try {
        await PaymentSession.collection.createIndex({ canteenId: 1, createdAt: -1 });
      } catch (error: any) {
        if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
      }
      
      try {
        await PaymentSession.collection.createIndex({ status: 1, createdAt: -1 });
      } catch (error: any) {
        if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') throw error;
      }
      
      console.log('✅ PaymentSession indexes created');
    } catch (error) {
      console.log('⚠️ PaymentSession indexes skipped (collection may not exist)');
    }

    console.log('✅ All performance indexes added successfully');
  } catch (error) {
    console.error('❌ Error adding performance indexes:', error);
    throw error;
  }
}

