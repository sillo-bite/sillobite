import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Express } from 'express';
// SSE removed - using WebSocket only

// SSE removed - using WebSocket only
import { UserRole } from '@shared/schema';

export interface SocketUser {
  socketId: string;
  userId?: string;
  userRole?: string;
  canteenIds: string[];
  counterIds: string[]; // Track which counters the user is connected to
  connectedAt: Date;
}

export interface OrderUpdateData {
  type: 'new_order' | 'order_updated' | 'order_status_changed' | 'banner_updated' | 'payment_success';
  data: any;
  oldStatus?: string;
  newStatus?: string;
  orderNumber?: string;
}

class WebSocketManager {
  private io: SocketIOServer;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private canteenRooms: Map<string, Set<string>> = new Map(); // canteenId -> Set of socketIds
  private counterRooms: Map<string, Set<string>> = new Map(); // counterId -> Set of socketIds
  private deliveryPersonRooms: Map<string, Set<string>> = new Map(); // deliveryPersonEmail -> Set of socketIds

  constructor(httpServer: HTTPServer, app: Express) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.CLIENT_URL || 'https://your-domain.com'
          : ['http://localhost:3000', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    console.log('🔌 WebSocket server initialized with room-based architecture');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`📡 Client connected: ${socket.id}`);

      // Handle user authentication and room joining
      socket.on('joinCanteenRooms', (data: any) => {
        try {
          console.log('📡 Received joinCanteenRooms request:', data);

          // Handle both array format and object format for backward compatibility
          const ids = Array.isArray(data) ? data : data.canteenIds || [];
          const userId = data.userId;
          const userRole = data.userRole;

          console.log('📡 Processed data - ids:', ids, 'userId:', userId, 'userRole:', userRole);

          // Store user information
          const userInfo: SocketUser = {
            socketId: socket.id,
            userId,
            userRole,
            canteenIds: ids || [],
            counterIds: [], // Initialize empty counter IDs
            connectedAt: new Date()
          };

          this.connectedUsers.set(socket.id, userInfo);

          // Join canteen-specific rooms
          ids.forEach(canteenId => {
            const roomName = `canteen_${canteenId}`;
            socket.join(roomName);

            // Track room membership
            if (!this.canteenRooms.has(canteenId)) {
              this.canteenRooms.set(canteenId, new Set());
            }
            this.canteenRooms.get(canteenId)!.add(socket.id);

            console.log(`🏠 Socket ${socket.id} joined room: ${roomName}`);
          });

          // Send confirmation
          socket.emit('roomJoined', {
            type: 'connected',
            message: 'Successfully joined canteen rooms',
            canteenIds: ids,
            connectedAt: userInfo.connectedAt
          });

          console.log(`✅ User ${userId || 'anonymous'} joined ${ids.length} canteen rooms`);

        } catch (error) {
          console.error('❌ Error joining canteen rooms:', error);
          socket.emit('error', { message: 'Failed to join canteen rooms' });
        }
      });

      // Handle leaving specific canteen rooms
      socket.on('leaveCanteenRooms', (data: { canteenIds: string[] }) => {
        try {
          const { canteenIds } = data;

          canteenIds.forEach(canteenId => {
            const roomName = `canteen_${canteenId}`;
            socket.leave(roomName);

            // Update tracking
            const userInfo = this.connectedUsers.get(socket.id);
            if (userInfo) {
              userInfo.canteenIds = userInfo.canteenIds.filter(id => id !== canteenId);
            }

            const roomMembers = this.canteenRooms.get(canteenId);
            if (roomMembers) {
              roomMembers.delete(socket.id);
              if (roomMembers.size === 0) {
                this.canteenRooms.delete(canteenId);
              }
            }

            console.log(`🚪 Socket ${socket.id} left room: ${roomName}`);
          });

          socket.emit('left_room', { canteenIds });

        } catch (error) {
          console.error('❌ Error leaving canteen rooms:', error);
        }
      });

      // Handle joining counter rooms
      socket.on('joinCounterRoom', (data: { counterId: string; canteenId: string }) => {
        try {
          const { counterId, canteenId } = data;
          const roomName = `counter_${counterId}`;

          console.log(`🏪 Socket ${socket.id} attempting to join counter room:`, {
            counterId,
            canteenId,
            roomName
          });

          socket.join(roomName);

          // Track room membership
          if (!this.counterRooms.has(counterId)) {
            this.counterRooms.set(counterId, new Set());
          }
          this.counterRooms.get(counterId)!.add(socket.id);

          // Update user info
          const userInfo = this.connectedUsers.get(socket.id);
          if (userInfo && !userInfo.counterIds.includes(counterId)) {
            userInfo.counterIds.push(counterId);
          }

          console.log(`🏪 ✅ Socket ${socket.id} joined counter room: ${roomName} for canteen ${canteenId}`);
          console.log(`🏪 Counter room ${counterId} now has ${this.counterRooms.get(counterId)?.size || 0} members`);
          console.log(`🏪 All counter rooms:`, Object.fromEntries(this.counterRooms));

          // Send confirmation
          socket.emit('counterRoomJoined', {
            type: 'counter_connected',
            message: 'Successfully joined counter room',
            counterId,
            canteenId
          });

        } catch (error) {
          console.error('❌ Error joining counter room:', error);
          socket.emit('error', { message: 'Failed to join counter room' });
        }
      });

      // Handle leaving counter rooms
      socket.on('leaveCounterRoom', (data: { counterId: string }) => {
        try {
          const { counterId } = data;
          const roomName = `counter_${counterId}`;

          socket.leave(roomName);

          // Update tracking
          const userInfo = this.connectedUsers.get(socket.id);
          if (userInfo) {
            userInfo.counterIds = userInfo.counterIds.filter(id => id !== counterId);
          }

          const roomMembers = this.counterRooms.get(counterId);
          if (roomMembers) {
            roomMembers.delete(socket.id);
            if (roomMembers.size === 0) {
              this.counterRooms.delete(counterId);
            }
          }

          console.log(`🚪 Socket ${socket.id} left counter room: ${roomName}`);

          socket.emit('counterRoomLeft', { counterId });

        } catch (error) {
          console.error('❌ Error leaving counter room:', error);
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`📡 Client disconnected: ${socket.id}, reason: ${reason}`);
        this.handleDisconnection(socket.id);
      });

      // Handle joining delivery person room
      socket.on('joinDeliveryPersonRoom', (data: { email: string }) => {
        try {
          const { email } = data;
          if (!email) {
            console.error('❌ Email required for delivery person room');
            return;
          }

          const roomName = `delivery_person_${email}`;
          socket.join(roomName);

          // Track room membership
          if (!this.deliveryPersonRooms.has(email)) {
            this.deliveryPersonRooms.set(email, new Set());
          }
          this.deliveryPersonRooms.get(email)!.add(socket.id);

          // Update user info
          const userInfo = this.connectedUsers.get(socket.id);
          if (userInfo) {
            userInfo.userRole = UserRole.DELIVERY_PERSON;
          }

          console.log(`🚚 Socket ${socket.id} joined delivery person room: ${roomName}`);
          socket.emit('deliveryPersonRoomJoined', { email });
        } catch (error) {
          console.error('❌ Error joining delivery person room:', error);
        }
      });

      // Handle leaving delivery person room
      socket.on('leaveDeliveryPersonRoom', (data: { email: string }) => {
        try {
          const { email } = data;
          const roomName = `delivery_person_${email}`;
          socket.leave(roomName);

          const roomMembers = this.deliveryPersonRooms.get(email);
          if (roomMembers) {
            roomMembers.delete(socket.id);
            if (roomMembers.size === 0) {
              this.deliveryPersonRooms.delete(email);
            }
          }

          console.log(`🚚 Socket ${socket.id} left delivery person room: ${roomName}`);
        } catch (error) {
          console.error('❌ Error leaving delivery person room:', error);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
      });
    });
  }

  private handleDisconnection(socketId: string): void {
    const userInfo = this.connectedUsers.get(socketId);
    if (userInfo) {
      // Remove from all canteen rooms
      userInfo.canteenIds.forEach(canteenId => {
        const roomMembers = this.canteenRooms.get(canteenId);
        if (roomMembers) {
          roomMembers.delete(socketId);
          if (roomMembers.size === 0) {
            this.canteenRooms.delete(canteenId);
          }
        }
      });

      // Remove from all counter rooms
      userInfo.counterIds.forEach(counterId => {
        const roomMembers = this.counterRooms.get(counterId);
        if (roomMembers) {
          roomMembers.delete(socketId);
          if (roomMembers.size === 0) {
            this.counterRooms.delete(counterId);
          }
        }
      });

      // Remove from delivery person rooms (find by checking all rooms)
      for (const [email, members] of this.deliveryPersonRooms.entries()) {
        if (members.has(socketId)) {
          members.delete(socketId);
          if (members.size === 0) {
            this.deliveryPersonRooms.delete(email);
          }
        }
      }

      this.connectedUsers.delete(socketId);
      console.log(`🧹 Cleaned up disconnected user: ${socketId}`);
    }
  }

  // Broadcast new order to specific canteen room
  public broadcastNewOrder(canteenId: string, orderData: any): void {
    const roomName = `canteen_${canteenId}`;
    const roomMembers = this.canteenRooms.get(canteenId);

    if (roomMembers && roomMembers.size > 0) {
      const message: OrderUpdateData = {
        type: 'new_order',
        data: orderData,
        orderNumber: orderData.orderNumber
      };

      this.io.to(roomName).emit('orderUpdate', message);
      console.log(`📢 Broadcasted new order ${orderData.orderNumber} to room ${roomName} (${roomMembers.size} clients)`);
    } else {
      console.log(`📡 No clients in room ${roomName} for new order broadcast`);
    }

    // SSE removed - using WebSocket only
  }

  // Broadcast order status update to specific canteen room
  public broadcastOrderStatusUpdate(canteenId: string, orderData: any, oldStatus: string, newStatus: string): void {
    const roomName = `canteen_${canteenId}`;
    const roomMembers = this.canteenRooms.get(canteenId);

    if (roomMembers && roomMembers.size > 0) {
      const message: OrderUpdateData = {
        type: 'order_status_changed',
        data: orderData,
        oldStatus,
        newStatus,
        orderNumber: orderData.orderNumber
      };

      this.io.to(roomName).emit('orderUpdate', message);
      console.log(`📢 Broadcasted status update for order ${orderData.orderNumber} to room ${roomName} (${roomMembers.size} clients)`);
    } else {
      console.log(`📡 No clients in room ${roomName} for status update broadcast`);
    }

    // SSE removed - using WebSocket only
  }

  // Broadcast to all connected clients (for general updates)
  public broadcastToAll(message: OrderUpdateData): void {
    this.io.emit('orderUpdate', message);
    console.log(`📢 Broadcasted message to all ${this.connectedUsers.size} connected clients`);

    // SSE removed - using WebSocket only
  }

  // Broadcast checkout session status update (optimized with debouncing)
  private checkoutSessionBroadcastCache: Map<string, { lastBroadcast: number; lastTimeRemaining: number }> = new Map();

  public broadcastCheckoutSessionStatus(sessionId: string, status: string, timeRemaining: number, canteenId?: string): void {
    const now = Date.now();
    const BROADCAST_DEBOUNCE_MS = 2000; // Don't broadcast same status within 2 seconds
    const TIME_CHANGE_THRESHOLD = 5; // Only broadcast if time changed by more than 5 seconds

    // Check if we should skip this broadcast (debounce)
    const cached = this.checkoutSessionBroadcastCache.get(sessionId);
    if (cached) {
      const timeSinceLastBroadcast = now - cached.lastBroadcast;
      const timeRemainingDiff = Math.abs(timeRemaining - cached.lastTimeRemaining);

      // Skip if:
      // 1. Last broadcast was less than 2 seconds ago AND
      // 2. Time remaining hasn't changed significantly (less than 5 seconds)
      if (timeSinceLastBroadcast < BROADCAST_DEBOUNCE_MS && timeRemainingDiff < TIME_CHANGE_THRESHOLD) {
        // Skip duplicate broadcast silently
        return;
      }
    }

    // Update cache BEFORE broadcasting to reduce race conditions
    this.checkoutSessionBroadcastCache.set(sessionId, {
      lastBroadcast: now,
      lastTimeRemaining: timeRemaining
    });

    // Clean up old cache entries (older than 5 minutes)
    if (this.checkoutSessionBroadcastCache.size > 1000) {
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      for (const [key, value] of this.checkoutSessionBroadcastCache.entries()) {
        if (value.lastBroadcast < fiveMinutesAgo) {
          this.checkoutSessionBroadcastCache.delete(key);
        }
      }
    }

    const message = {
      type: 'checkout_session_status_changed',
      sessionId,
      status,
      timeRemaining,
      data: {
        sessionId,
        status,
        timeRemaining
      }
    };

    if (canteenId) {
      // Broadcast ONLY to specific canteen room (not to all clients)
      const roomName = `canteen_${canteenId}`;
      const roomMembers = this.canteenRooms.get(canteenId);

      if (roomMembers && roomMembers.size > 0) {
        this.io.to(roomName).emit('orderUpdate', message);
        console.log(`📢 Broadcasted checkout session status for ${sessionId} to canteen ${canteenId} (${roomMembers.size} clients)`);
      } else {
        // No clients in room, skip broadcast
        console.log(`📡 No clients in canteen room ${canteenId} for checkout session ${sessionId}`);
      }
    } else {
      // Only broadcast to all clients if canteenId is not available (fallback)
      this.io.emit('orderUpdate', message);
      console.log(`📢 Broadcasted checkout session status for ${sessionId} to all clients (no canteenId)`);
    }
  }

  // Broadcast menu updates
  public broadcastMenuUpdate(canteenId: string, menuData: any): void {
    const message: OrderUpdateData = {
      type: 'menu_updated',
      data: menuData
    };

    this.io.emit('orderUpdate', message);
    console.log(`📢 Broadcasted menu update for canteen ${canteenId}`);

    // SSE removed - using WebSocket only
  }

  // Broadcast banner updates
  public broadcastBannerUpdate(bannerData: any): void {
    const message: OrderUpdateData = {
      type: 'banner_updated',
      data: bannerData
    };

    this.io.emit('orderUpdate', message);
    console.log(`📢 Broadcasted banner update`);

    // SSE removed - using WebSocket only
  }

  // Broadcast to specific canteen room
  public broadcastToCanteen(canteenId: string, eventType: string, data: any): void {
    const roomName = `canteen_${canteenId}`;
    const roomMembers = this.canteenRooms.get(canteenId);

    const message = {
      type: eventType,
      data: data
    };

    if (roomMembers && roomMembers.size > 0) {
      this.io.to(roomName).emit('orderUpdate', message);
      console.log(`📢 Broadcasted ${eventType} to canteen ${canteenId} (${roomMembers.size} clients)`);
    } else {
      console.log(`📡 No clients in room ${roomName} for broadcast`);
    }
  }

  // Broadcast to specific counter room
  public broadcastToCounter(counterId: string, eventType: string, data: any): void {
    const roomName = `counter_${counterId}`;
    const roomMembers = this.counterRooms.get(counterId);

    const message = {
      type: eventType,
      data: data
    };

    console.log(`📢 Attempting to broadcast to counter ${counterId}:`, {
      roomName,
      roomMembers: roomMembers ? Array.from(roomMembers) : null,
      memberCount: roomMembers?.size || 0,
      messageType: message.type,
      orderNumber: message.data?.orderNumber,
      allCounterRooms: Object.fromEntries(this.counterRooms)
    });

    if (roomMembers && roomMembers.size > 0) {
      this.io.to(roomName).emit('orderUpdate', message);
      console.log(`📢 ✅ Successfully broadcasted ${eventType} to counter ${counterId} (${roomMembers.size} clients)`);
      console.log(`📢 Message details:`, {
        type: message.type,
        orderNumber: message.data?.orderNumber,
        canteenId: message.data?.canteenId,
        allStoreCounterIds: message.data?.allStoreCounterIds,
        messageSize: JSON.stringify(message).length
      });

      // Log the actual message being sent
      console.log(`📢 Full message being sent to counter ${counterId}:`, JSON.stringify(message, null, 2));
    } else {
      console.log(`📡 ❌ No clients in counter room ${roomName} for broadcast`);
      console.log(`📡 Available counter rooms:`, Object.keys(Object.fromEntries(this.counterRooms)));
      console.log(`📡 All counter room details:`, Object.fromEntries(this.counterRooms));
    }
  }

  // Broadcast to multiple counter rooms
  public broadcastToCounters(counterIds: string[], eventType: string, data: any): void {
    counterIds.forEach(counterId => {
      this.broadcastToCounter(counterId, eventType, data);
    });
  }

  // Broadcast to specific delivery person by email
  public broadcastToDeliveryPerson(deliveryPersonEmail: string, message: any): void {
    const roomName = `delivery_person_${deliveryPersonEmail}`;
    const roomMembers = this.deliveryPersonRooms.get(deliveryPersonEmail);

    console.log(`🚚 Attempting to broadcast to delivery person:`, {
      email: deliveryPersonEmail,
      roomName,
      hasRoomMembers: !!roomMembers,
      memberCount: roomMembers?.size || 0,
      messageType: message.type,
      allDeliveryPersonRooms: Array.from(this.deliveryPersonRooms.keys())
    });

    if (roomMembers && roomMembers.size > 0) {
      this.io.to(roomName).emit('deliveryAssignment', message);
      console.log(`🚚 ✅ Successfully broadcasted message to delivery person ${deliveryPersonEmail} (${roomMembers.size} clients)`);
      console.log(`🚚 Message content:`, JSON.stringify(message, null, 2));
    } else {
      console.log(`📡 ❌ No clients in delivery person room ${roomName} for broadcast`);
      console.log(`📡 Available delivery person rooms:`, Array.from(this.deliveryPersonRooms.keys()));
    }
  }

  // Get connection statistics
  public getStats(): {
    totalConnections: number;
    canteenRooms: { [canteenId: string]: number };
    counterRooms: { [counterId: string]: number };
    userRoles: { [role: string]: number };
  } {
    const canteenRooms: { [canteenId: string]: number } = {};
    const counterRooms: { [counterId: string]: number } = {};
    const userRoles: { [role: string]: number } = {};

    this.canteenRooms.forEach((members, canteenId) => {
      canteenRooms[canteenId] = members.size;
    });

    this.counterRooms.forEach((members, counterId) => {
      counterRooms[counterId] = members.size;
    });

    this.connectedUsers.forEach(user => {
      const role = user.userRole || 'anonymous';
      userRoles[role] = (userRoles[role] || 0) + 1;
    });

    return {
      totalConnections: this.connectedUsers.size,
      canteenRooms,
      counterRooms,
      userRoles
    };
  }

  // Get the Socket.IO instance for direct access if needed
  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Global instance
let webSocketManager: WebSocketManager | null = null;

export function initializeWebSocket(httpServer: HTTPServer, app: Express): WebSocketManager {
  if (!webSocketManager) {
    webSocketManager = new WebSocketManager(httpServer, app);
  }
  return webSocketManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return webSocketManager;
}

export default WebSocketManager;
