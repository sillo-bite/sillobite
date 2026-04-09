import { Request, Response } from 'express';
import { carebiteService } from '../services/carebiteService';
import { walletService } from '../services/walletService';
import { stockService } from '../stock-service';
import { orderService } from '../services/order-service';
import { storage } from '../storage-hybrid';
import { MenuItem } from '../models/mongodb-models';
import { webPushService } from '../services/webPushService';
import { getWebSocketManager } from '../websocket';

export const carebiteController = {
  async getMenu(req: Request, res: Response) {
    try {
      console.log('🍽️ CareBite menu request received');
      console.log('Body:', req.body);
      
      const { email, accessToken } = req.body;

      if (!email || !accessToken) {
        console.log('❌ Missing email or accessToken');
        return res.status(400).json({ error: 'Email and accessToken are required' });
      }

      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Token: ${accessToken.substring(0, 10)}...`);

      const result = await carebiteService.getMenuForUser(email, accessToken);

      if (!result.success) {
        console.log('❌ Service error:', result.error);
        return res.status(401).json({ error: result.error });
      }

      console.log('✅ Menu fetched successfully');
      console.log(`📊 Canteens: ${result.data?.canteens.length}, Items: ${result.data?.menuItems.length}`);
      
      res.json(result.data);
    } catch (err) {
      console.error('❌ CareBite menu error:', err);
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  },

  async createOrder(req: Request, res: Response) {
    try {
      console.log('🛒 CareBite order creation request received');
      console.log('Body:', JSON.stringify(req.body, null, 2));

      const { email, accessToken, menus, canteenId } = req.body;

      // 1. Validate required fields
      if (!email || !accessToken || !menus || !canteenId) {
        console.log('❌ Missing required fields');
        return res.status(400).json({ 
          success: false,
          error: 'Order creation failed',
          reason: 'missing_fields',
          message: 'Required fields are missing',
          details: {
            email: !email ? 'required' : 'provided',
            accessToken: !accessToken ? 'required' : 'provided',
            menus: !menus ? 'required' : 'provided',
            canteenId: !canteenId ? 'required' : 'provided'
          }
        });
      }

      if (!Array.isArray(menus) || menus.length === 0) {
        console.log('❌ Invalid menus format');
        return res.status(400).json({ 
          success: false,
          error: 'Order creation failed',
          reason: 'invalid_menu_format',
          message: 'Menu items must be provided as an array of [menuId, quantity] pairs',
          example: [["menu-item-id", 2], ["another-item-id", 1]]
        });
      }

      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Token: ${accessToken.substring(0, 10)}...`);
      console.log(`🏪 Canteen: ${canteenId}`);
      console.log(`📦 Items: ${menus.length}`);

      // 2. Validate user and access token
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log('❌ User not found');
        return res.status(404).json({ 
          success: false,
          error: 'Order creation failed',
          reason: 'user_not_found',
          message: 'No user account found with this email address',
          details: { email }
        });
      }

      // Validate access token
      const { connectionCodeService } = await import('../services/connectionCodeService');
      const validatedUserId = await connectionCodeService.validateToken(accessToken);
      
      if (!validatedUserId || validatedUserId !== user.id) {
        console.log('❌ Invalid access token');
        return res.status(401).json({ 
          success: false,
          error: 'Order creation failed',
          reason: 'invalid_token',
          message: 'Access token is invalid or expired',
          suggestion: 'Please reconnect your CareBite app to get a new access token'
        });
      }

      console.log(`✅ User validated: ${user.name} (ID: ${user.id})`);

      // 3. Fetch menu items and calculate total
      const menuItemIds = menus.map(([menuId]) => menuId);
      
      // Try to find by 'id' field first, then by '_id' if not found
      let menuItems = await MenuItem.find({ 
        id: { $in: menuItemIds },
        canteenId: canteenId
      }).lean();
      
      // If not found by 'id', try by '_id'
      if (menuItems.length === 0) {
        menuItems = await MenuItem.find({ 
          _id: { $in: menuItemIds },
          canteenId: canteenId
        }).lean();
      }

      // If not found by 'id', try by '_id'
      if (menuItems.length === 0) {
        menuItems = await MenuItem.find({ 
          _id: { $in: menuItemIds },
          canteenId: canteenId
        }).lean();
      }

      if (menuItems.length !== menuItemIds.length) {
        console.log('❌ Some menu items not found or unavailable');
        
        // Find which items are missing
        const foundIds = menuItems.map(item => item.id || item._id.toString());
        const missingIds = menuItemIds.filter(id => !foundIds.includes(id));
        
        return res.status(400).json({ 
          success: false,
          error: 'Order creation failed',
          reason: 'items_unavailable',
          message: 'Some menu items are not available or do not exist',
          details: {
            requestedItems: menuItemIds.length,
            availableItems: menuItems.length,
            missingItems: missingIds
          }
        });
      }

      // Build order items with quantities - use _id if id is not available
      const orderItems = menus.map(([menuId, count]) => {
        const item = menuItems.find(m => (m.id || m._id.toString()) === menuId);
        if (!item) {
          throw new Error(`Menu item ${menuId} not found`);
        }
        return {
          menuItemId: item.id || item._id.toString(),
          name: item.name,
          price: item.price,
          quantity: count,
          customizations: [],
          specialInstructions: ''
        };
      });

      // Calculate total amount
      const totalAmount = orderItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      console.log(`💰 Total amount: ₹${totalAmount}`);

      // 4. Validate stock availability
      console.log('📊 Validating stock...');
      const stockUpdates = orderItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity
      }));

      try {
        await stockService.validateAndPrepareStockUpdates(stockUpdates);
        console.log('✅ Stock validation passed');
      } catch (stockError: any) {
        console.log('❌ Stock validation failed:', stockError.message);
        
        // Parse stock error to get specific item details
        const stockErrorDetails = {
          reason: 'insufficient_stock',
          message: 'Some items are out of stock or have insufficient quantity',
          details: stockError.message,
          failedItems: []
        };

        // Try to extract which items failed
        const errorMatch = stockError.message.match(/item[:\s]+([^\s,]+)/i);
        if (errorMatch) {
          const failedItemId = errorMatch[1];
          const failedItem = orderItems.find(item => 
            item.menuItemId === failedItemId || item.name.includes(failedItemId)
          );
          if (failedItem) {
            stockErrorDetails.failedItems.push({
              menuItemId: failedItem.menuItemId,
              name: failedItem.name,
              requestedQuantity: failedItem.quantity
            });
          }
        }

        return res.status(400).json({ 
          success: false,
          error: 'Order creation failed',
          ...stockErrorDetails
        });
      }

      // 5. Check wallet balance
      console.log('💳 Checking wallet balance...');
      const currentBalance = await walletService.getBalance(user.id);
      const hasSufficientBalance = currentBalance.greaterThanOrEqualTo(totalAmount);

      if (!hasSufficientBalance) {
        console.log(`❌ Insufficient balance: ₹${currentBalance} < ₹${totalAmount}`);
        
        const shortfall = totalAmount - parseFloat(currentBalance.toString());
        
        return res.status(400).json({ 
          success: false,
          error: 'Order creation failed',
          reason: 'insufficient_balance',
          message: 'Your wallet does not have sufficient balance for this order',
          details: {
            orderAmount: totalAmount,
            currentBalance: currentBalance.toString(),
            shortfall: shortfall.toFixed(2),
            itemCount: orderItems.length
          },
          suggestion: `Please add ₹${shortfall.toFixed(2)} or more to your wallet to complete this order`
        });
      }

      console.log('✅ Sufficient wallet balance');

      // 6. Reserve stock
      console.log('🔒 Reserving stock...');
      await stockService.reduceStock(stockUpdates);
      console.log('✅ Stock reserved');

      // 7. Debit wallet
      console.log('💸 Debiting wallet...');
      const walletResult = await walletService.debitWallet({
        userId: user.id,
        amount: totalAmount,
        description: `Order payment for ${orderItems.length} items`,
        referenceType: 'order',
        metadata: {
          canteenId,
          itemCount: orderItems.length,
          source: 'carebite'
        }
      });

      console.log(`✅ Wallet debited. New balance: ₹${walletResult.newBalance}`);

      // 8. Create order
      console.log('📝 Creating order...');
      const { generateOrderNumber } = await import('../../shared/utils');
      const orderNumber = generateOrderNumber();

      const orderData = {
        orderNumber,
        customerId: user.id,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phoneNumber || '',
        canteenId,
        items: orderItems,
        amount: totalAmount,
        paymentMethod: 'wallet',
        paymentStatus: 'completed',
        status: 'pending',
        orderType: 'takeaway',
        deliveryAddress: null,
        specialInstructions: 'Order from CareBite app',
        createdAt: new Date(),
        metadata: {
          source: 'carebite',
          walletTransactionId: walletResult.transaction.id
        }
      };

      const order = await orderService.createOrder({
        orderData: orderData as any,
        orderItems: orderItems as any,
        skipStockReduction: true // Already reduced above
      });

      console.log(`✅ Order created: ${order.orderNumber}`);

      // 9. Send notifications to canteen owner
      console.log('📢 Sending notifications...');
      
      // WebSocket notification
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.notifyCanteenOwner(canteenId, {
          type: 'new_order',
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            amount: order.amount,
            items: order.items,
            status: order.status
          }
        });
        console.log('✅ WebSocket notification sent');
      }

      // Push notification
      try {
        await webPushService.sendOrderNotification(canteenId, {
          title: '🔔 New Order!',
          body: `Order #${order.orderNumber} - ₹${totalAmount} from ${user.name}`,
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            type: 'new_order'
          }
        });
        console.log('✅ Push notification sent');
      } catch (pushError) {
        console.warn('⚠️ Push notification failed:', pushError);
        // Don't fail the order if push fails
      }

      // 10. Return success response
      console.log('🎉 Order creation completed successfully');
      res.status(201).json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          amount: totalAmount,
          status: order.status,
          items: orderItems.length,
          walletBalance: walletResult.newBalance.toString()
        },
        message: 'Order placed successfully'
      });

    } catch (err: any) {
      console.error('❌ CareBite order creation error:', err);
      
      // Try to rollback if possible
      // Note: Stock rollback would need to be implemented in stockService
      
      res.status(500).json({ 
        error: 'Failed to create order',
        details: err.message 
      });
    }
  }
};
