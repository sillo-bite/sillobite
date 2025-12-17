import mongoose from 'mongoose';
import { MenuItem } from './models/mongodb-models';
import { storage } from './storage-hybrid';

// Environment detection for MongoDB features
let MONGODB_SUPPORTS_TRANSACTIONS: boolean | null = null;

export interface StockUpdateItem {
  id: string;
  quantity: number;
  operation: 'deduct' | 'restore';
}

export interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  updates: StockUpdateItem[];
}

export class AtomicStockService {
  /**
   * Validates and prepares stock updates for order items
   * OPTIMIZED: Uses batch query instead of N sequential queries
   */
  async validateAndPrepareStockUpdates(orderItems: any[]): Promise<StockValidationResult> {
    const errors: string[] = [];
    const updates: StockUpdateItem[] = [];

    if (orderItems.length === 0) {
      return { isValid: true, errors: [], updates: [] };
    }

    // OPTIMIZATION: Batch query - fetch all menu items in a single DB query
    const itemIds = orderItems.map(item => item.id);
    const menuItems = await MenuItem.find({ _id: { $in: itemIds } }).lean();
    
    // Create a map for O(1) lookup
    const menuItemMap = new Map(menuItems.map(item => [item._id.toString(), item]));

    // Validate each item using the batch-fetched data
    for (const item of orderItems) {
      const menuItem = menuItemMap.get(item.id);
      if (!menuItem) {
        errors.push(`Item ${item.name || item.id} not found`);
        continue;
      }

      if (menuItem.stock < item.quantity) {
        errors.push(`Insufficient stock for ${item.name || menuItem.name}. Available: ${menuItem.stock}, Requested: ${item.quantity}`);
        continue;
      }

      updates.push({
        id: item.id,
        quantity: item.quantity,
        operation: 'deduct'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      updates
    };
  }

  /**
   * Detects if MongoDB supports transactions (cached result)
   */
  private async detectTransactionSupport(): Promise<boolean> {
    if (MONGODB_SUPPORTS_TRANSACTIONS !== null) {
      return MONGODB_SUPPORTS_TRANSACTIONS;
    }

    // Force disable transactions for MongoDB 4.4 and below due to known issues
    try {
      const admin = mongoose.connection.db?.admin();
      if (admin) {
        const buildInfo = await admin.buildInfo();
        const version = buildInfo.version;
        const majorVersion = parseInt(version.split('.')[0]);
        const minorVersion = parseInt(version.split('.')[1]);
        
        if (majorVersion < 4 || (majorVersion === 4 && minorVersion <= 4)) {
          MONGODB_SUPPORTS_TRANSACTIONS = false;
          console.log(`🔄 MongoDB ${version} detected - forcing non-transactional mode for compatibility`);
          return MONGODB_SUPPORTS_TRANSACTIONS;
        }
      }
    } catch (error) {
      console.log('⚠️ Could not detect MongoDB version, proceeding with transaction test');
    }

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      
      // Test actual transaction with a real operation using Mongoose
      await session.withTransaction(async () => {
        // Try to find a menu item within transaction to properly test
        await MenuItem.findOne({}).session(session).limit(1);
      });
      
      MONGODB_SUPPORTS_TRANSACTIONS = true;
      console.log('✅ MongoDB transactions supported (replica set detected)');
    } catch (error: any) {
      if (error.message?.includes('Transaction numbers are only allowed on a replica set') || 
          error.message?.includes('Transaction numbers') ||
          error.codeName === 'IllegalOperation' ||
          error.code === 20) {
        MONGODB_SUPPORTS_TRANSACTIONS = false;
        console.log('🔄 MongoDB transactions not supported (standalone instance detected)');
      } else {
        // For any other error, assume transactions are not supported to be safe
        MONGODB_SUPPORTS_TRANSACTIONS = false;
        console.log('🔄 MongoDB transaction detection failed, falling back to non-transactional mode:', error.message);
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    return MONGODB_SUPPORTS_TRANSACTIONS;
  }

  /**
   * Processes stock updates with fallback for non-replica set environments
   * OPTIMIZED: Uses bulk operations instead of N sequential updates
   * SCALABILITY FIX: Uses distributed locks for high-demand items
   */
  async processStockUpdates(updates: StockUpdateItem[]): Promise<void> {
    if (updates.length === 0) return;

    // SCALABILITY FIX: Use distributed locks for high-demand items to prevent race conditions
    const { DistributedLock, isRedisAvailable } = await import('./config/redis');
    const useLocks = await isRedisAvailable();

    const supportsTransactions = await this.detectTransactionSupport();

    if (supportsTransactions) {
      // Use transactions when available (replica set/sharded cluster)
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // SCALABILITY FIX: Acquire distributed locks for high-demand items
          const locks: any[] = [];
          if (useLocks) {
            for (const update of updates.filter(u => u.operation === 'deduct')) {
              const lock = new DistributedLock(`stock:${update.id}`, 30);
              const acquired = await lock.acquireWithRetry(10, 100);
              if (acquired) {
                locks.push({ lock, update });
              } else {
                throw new Error(`Could not acquire lock for item ${update.id}. Please try again.`);
              }
            }
          }

          try {
            // OPTIMIZATION: Use bulkWrite for batch operations
            const bulkOps = updates.map(update => {
            if (update.operation === 'deduct') {
              return {
                updateOne: {
                  filter: { 
                    _id: update.id, 
                    stock: { $gte: update.quantity } // Ensure sufficient stock atomically
                  },
                  update: { $inc: { stock: -update.quantity } }
                }
              };
            } else if (update.operation === 'restore') {
              return {
                updateOne: {
                  filter: { _id: update.id },
                  update: { $inc: { stock: update.quantity } }
                }
              };
            }
            return null;
          }).filter(op => op !== null) as any[];

          if (bulkOps.length > 0) {
            const result = await MenuItem.bulkWrite(bulkOps, { session });
            
            // Verify all updates succeeded (check matchedCount for deduct operations)
            const deductUpdates = updates.filter(u => u.operation === 'deduct');
            if (result.matchedCount < deductUpdates.length) {
              // Some items didn't have sufficient stock - find which ones
              const itemIds = deductUpdates.map(u => u.id);
              const currentStock = await MenuItem.find({ _id: { $in: itemIds } }, { _id: 1, stock: 1 }).session(session).lean();
              const stockMap = new Map(currentStock.map(item => [item._id.toString(), item.stock]));
              
              for (const update of deductUpdates) {
                const currentStockValue = stockMap.get(update.id) ?? 0;
                if (currentStockValue < update.quantity) {
                  throw new Error(`Insufficient stock for item ${update.id}. Available: ${currentStockValue}, Requested: ${update.quantity}`);
                }
              }
            }

            console.log(`📦 Bulk stock update: ${result.modifiedCount} items updated`);
          }
          } finally {
            // Release all locks
            if (useLocks) {
              for (const { lock } of locks) {
                await lock.release();
              }
            }
          }
        });
      } catch (error) {
        console.error('❌ Stock transaction failed:', error);
        throw error;
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback to bulk operations for standalone MongoDB (still optimized)
      console.log('🔄 Using bulk stock updates (standalone MongoDB)');
      
      const bulkOps = updates.map(update => {
        if (update.operation === 'deduct') {
          return {
            updateOne: {
              filter: { 
                _id: update.id, 
                stock: { $gte: update.quantity } // Ensure sufficient stock atomically
              },
              update: { $inc: { stock: -update.quantity } }
            }
          };
        } else if (update.operation === 'restore') {
          return {
            updateOne: {
              filter: { _id: update.id },
              update: { $inc: { stock: update.quantity } }
            }
          };
        }
        return null;
      }).filter(op => op !== null) as any[];

      if (bulkOps.length > 0) {
        const result = await MenuItem.bulkWrite(bulkOps);
        
        // Verify all updates succeeded
        const deductUpdates = updates.filter(u => u.operation === 'deduct');
        if (result.matchedCount < deductUpdates.length) {
          // Some items didn't have sufficient stock
          const itemIds = deductUpdates.map(u => u.id);
          const currentStock = await MenuItem.find({ _id: { $in: itemIds } }, { _id: 1, stock: 1 }).lean();
          const stockMap = new Map(currentStock.map(item => [item._id.toString(), item.stock]));
          
          for (const update of deductUpdates) {
            const currentStockValue = stockMap.get(update.id) ?? 0;
            if (currentStockValue < update.quantity) {
              throw new Error(`Insufficient stock for item ${update.id}. Available: ${currentStockValue}, Requested: ${update.quantity}`);
            }
          }
        }

        console.log(`📦 Bulk stock update: ${result.modifiedCount} items updated`);
      }
    }
  }

  /**
   * Updates stock for a single item with optional session using atomic operations
   */
  private async updateSingleItemStock(update: StockUpdateItem, session: mongoose.ClientSession | null): Promise<void> {
    // For deduction, use atomic findOneAndUpdate with stock validation
    if (update.operation === 'deduct') {
      let result;
      
      if (session) {
        // Use session when transactions are supported
        result = await MenuItem.findOneAndUpdate(
          { 
            _id: update.id, 
            stock: { $gte: update.quantity } // Ensure sufficient stock atomically
          },
          { $inc: { stock: -update.quantity } },
          { session, new: true }
        );
      } else {
        // Direct operation without session for standalone MongoDB
        result = await MenuItem.findOneAndUpdate(
          { 
            _id: update.id, 
            stock: { $gte: update.quantity } // Ensure sufficient stock atomically
          },
          { $inc: { stock: -update.quantity } },
          { new: true }
        );
      }

      if (!result) {
        // Check if item exists or if it's a stock issue
        const menuItem = await MenuItem.findById(update.id);
        if (!menuItem) {
          throw new Error(`Menu item ${update.id} not found during stock update`);
        } else {
          throw new Error(`Insufficient stock for item ${update.id}. Available: ${menuItem.stock}, Requested: ${update.quantity}`);
        }
      }

      console.log(`📦 Stock deducted for item ${update.id}: ${result.stock + update.quantity} → ${result.stock} (${update.quantity} deducted)`);
    } 
    // For restoration, use simple increment
    else if (update.operation === 'restore') {
      let result;
      
      if (session) {
        // Use session when transactions are supported
        result = await MenuItem.findByIdAndUpdate(
          update.id,
          { $inc: { stock: update.quantity } },
          { session, new: true }
        );
      } else {
        // Direct operation without session for standalone MongoDB
        result = await MenuItem.findByIdAndUpdate(
          update.id,
          { $inc: { stock: update.quantity } },
          { new: true }
        );
      }

      if (!result) {
        throw new Error(`Menu item ${update.id} not found during stock restoration`);
      }

      console.log(`📦 Stock restored for item ${update.id}: ${result.stock - update.quantity} → ${result.stock} (${update.quantity} restored)`);
    } else {
      throw new Error(`Invalid stock operation: ${update.operation}`);
    }
  }

  /**
   * Processes an order with atomic stock management
   * @param orderData - Order data
   * @param orderItems - Order items
   * @param skipStockReduction - If true, skip stock reduction (stock already reserved at checkout)
   */
  async processOrderWithStockManagement(orderData: any, orderItems: any[], skipStockReduction: boolean = false): Promise<any> {
    // Step 1: Validate stock availability (skip validation if stock already reserved at checkout)
    // When skipStockReduction is true, stock was already validated and reserved during checkout,
    // so we don't need to validate again (and it would fail because stock was already deducted)
    let validation: StockValidationResult;
    if (skipStockReduction) {
      // Stock already validated and reserved at checkout - skip validation
      console.log(`📦 Skipping stock validation (already validated and reserved at checkout)`);
      validation = {
        isValid: true,
        errors: [],
        updates: [] // No updates needed since stock already deducted
      };
    } else {
      // Normal flow: validate stock before deducting
      validation = await this.validateAndPrepareStockUpdates(orderItems);
      if (!validation.isValid) {
        throw new Error(`Stock validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Step 2: Process stock updates atomically (skip if stock already reserved)
    if (!skipStockReduction) {
      await this.processStockUpdates(validation.updates);
      console.log(`📦 Stock deducted during order creation`);
    } else {
      console.log(`📦 Skipping stock reduction (already reserved at checkout)`);
    }

    // Step 3: Create the order
    try {
      console.log(`🔍 StockService - Order data being passed to storage:`, {
        orderNumber: orderData.orderNumber,
        allStoreCounterIds: orderData.allStoreCounterIds,
        allPaymentCounterIds: orderData.allPaymentCounterIds,
        allCounterIds: orderData.allCounterIds
      });
      const order = await storage.createOrder(orderData);
      console.log(`✅ Order ${order.orderNumber} created successfully with atomic stock management`);
      console.log(`🔍 StockService - Order returned from storage:`, {
        orderNumber: order.orderNumber,
        allStoreCounterIds: order.allStoreCounterIds,
        allPaymentCounterIds: order.allPaymentCounterIds,
        allCounterIds: order.allCounterIds
      });
      return order;
    } catch (error) {
      // Step 4: If order creation fails, restore stock (only if we reduced it)
      if (!skipStockReduction) {
        console.error('❌ Order creation failed, restoring stock...');
        const restoreUpdates = validation.updates.map(update => ({
          ...update,
          operation: 'restore' as const
        }));
        
        try {
          await this.processStockUpdates(restoreUpdates);
          console.log('✅ Stock restored after order creation failure');
        } catch (restoreError) {
          console.error('❌ Failed to restore stock after order creation failure:', restoreError);
          // Log this critical error but don't throw to preserve original error
        }
      } else {
        console.error('❌ Order creation failed, but stock was already reserved at checkout - will be restored by checkout session cleanup');
      }
      
      throw error;
    }
  }

  /**
   * Restores stock for a cancelled order
   */
  async restoreStockForOrder(orderId: string): Promise<void> {
    const order = await storage.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    let orderItems: any[];
    try {
      orderItems = JSON.parse(order.items);
    } catch (error) {
      throw new Error(`Invalid order items format for order ${orderId}`);
    }

    const restoreUpdates: StockUpdateItem[] = orderItems.map(item => ({
      id: item.id,
      quantity: item.quantity,
      operation: 'restore'
    }));

    await this.processStockUpdates(restoreUpdates);
    console.log(`✅ Stock restored for cancelled order ${order.orderNumber}`);
  }

  /**
   * Gets current stock status for multiple items
   * Optimized: Uses single batch MongoDB query instead of N sequential queries
   */
  /**
   * Gets stock status for multiple items
   * OPTIMIZED: Uses batch query instead of N sequential queries
   */
  async getStockStatus(itemIds: string[]): Promise<Array<{id: string, stock: number, available: boolean}>> {
    // Early return for empty array
    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    try {
      // Convert string IDs to MongoDB ObjectIds
      const objectIds = itemIds
        .filter(id => id && id.length > 0)
        .map(id => {
          try {
            return new mongoose.Types.ObjectId(id);
          } catch (error) {
            console.warn(`Invalid ObjectId format: ${id}`);
            return null;
          }
        })
        .filter(id => id !== null) as mongoose.Types.ObjectId[];

      if (objectIds.length === 0) {
        return [];
      }

      // Single batch query with projection - only fetch needed fields
      // No populate needed since we don't need category info for stock status
      const menuItems = await MenuItem.find(
        { _id: { $in: objectIds } },
        { _id: 1, stock: 1, available: 1 } // Projection: only fetch these fields
      ).lean(); // Use lean() for better performance (returns plain JS objects)

      // Create a map for O(1) lookup
      const stockMap = new Map<string, { stock: number; available: boolean }>();
      menuItems.forEach(item => {
        const id = item._id.toString();
        stockMap.set(id, {
          stock: item.stock || 0,
          available: item.available && (item.stock || 0) > 0
        });
      });

      // Build response array maintaining order of input itemIds
      // Include all requested IDs, even if not found in DB (for consistency)
      const stockStatus = itemIds.map(itemId => {
        const item = stockMap.get(itemId);
        if (item) {
          return {
            id: itemId,
            stock: item.stock,
            available: item.available
          };
        }
        // Item not found in database - return with available: false
        return {
          id: itemId,
          stock: 0,
          available: false
        };
      });

      return stockStatus;
    } catch (error) {
      console.error('Error fetching stock status:', error);
      // Return empty array or items with available: false on error
      return itemIds.map(itemId => ({
        id: itemId,
        stock: 0,
        available: false
      }));
    }
  }
}

export const stockService = new AtomicStockService();