import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadNotifications: Notification[];
  readNotifications: Notification[];
  isLoading: boolean;
  error: any;
  refetch: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  createNotification: (data: any) => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  isMarkingAsRead: boolean;
  isMarkingAllAsRead: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isClearingAll: boolean;
  // Real-time notification handlers
  addNotification: (notification: Notification) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  
  const {
    notifications: serverNotifications,
    unreadCount,
    unreadNotifications,
    readNotifications,
    isLoading,
    error,
    refetch,
    markAsRead: serverMarkAsRead,
    markAllAsRead: serverMarkAllAsRead,
    createNotification: serverCreateNotification,
    deleteNotification: serverDeleteNotification,
    clearAllNotifications: serverClearAllNotifications,
    isMarkingAsRead,
    isMarkingAllAsRead,
    isCreating,
    isDeleting,
    isClearingAll,
  } = useNotifications();

  // Combine server notifications with local real-time notifications
  const allNotifications = React.useMemo(() => {
    const serverIds = new Set(serverNotifications.map(n => n.id));
    const localOnly = localNotifications.filter(n => !serverIds.has(n.id));
    return [...serverNotifications, ...localOnly].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [serverNotifications, localNotifications]);

  // WebSocket integration for real-time notifications
  const webSocketStatus = useWebSocket({
    canteenIds: user?.canteenId ? [user.canteenId] : [],
    enabled: !!user,
    onNewOrder: (order) => {
      // Create notification for new order
      const notification: Notification = {
        id: `order-${order.id || order.orderNumber}-${Date.now()}`,
        title: 'New Order Received',
        description: `Order #${order.orderNumber || order.id} has been placed`,
        timestamp: new Date(),
        type: 'order',
        read: false,
        priority: 'high',
        actionUrl: `/orders/${order.id || order.orderNumber}`,
        canteenId: order.canteenId,
        userId: user?.id?.toString()
      };
      addNotification(notification);
    },
    onOrderUpdate: (order) => {
      // Create notification for order update
      const notification: Notification = {
        id: `order-update-${order.id || order.orderNumber}-${Date.now()}`,
        title: 'Order Updated',
        description: `Order #${order.orderNumber || order.id} has been updated`,
        timestamp: new Date(),
        type: 'order',
        read: false,
        priority: 'medium',
        actionUrl: `/orders/${order.id || order.orderNumber}`,
        canteenId: order.canteenId,
        userId: user?.id?.toString()
      };
      addNotification(notification);
    },
    onOrderStatusChange: (order, oldStatus, newStatus) => {
      // Create notification for status change
      const statusMessages: { [key: string]: string } = {
        'preparing': 'Your order is being prepared! 👨‍🍳',
        'ready': 'Your order is ready for pickup! 📦',
        'delivered': 'Your order has been delivered! ✅',
        'cancelled': 'Your order has been cancelled ❌'
      };
      
      const message = statusMessages[newStatus] || `Order status updated to ${newStatus}`;
      
      const notification: Notification = {
        id: `status-change-${order.id || order.orderNumber}-${Date.now()}`,
        title: 'Order Status Update',
        description: message,
        timestamp: new Date(),
        type: 'order',
        read: false,
        priority: 'high',
        actionUrl: `/orders/${order.id || order.orderNumber}`,
        canteenId: order.canteenId,
        userId: user?.id?.toString()
      };
      addNotification(notification);
    },
    onConnected: () => {
      console.log('✅ Notification WebSocket connected');
    },
    onDisconnected: () => {
      console.log('❌ Notification WebSocket disconnected');
    },
    onError: (error) => {
      console.error('❌ Notification WebSocket error:', error);
    }
  });

  // Local notification management functions
  const addNotification = useCallback((notification: Notification) => {
    setLocalNotifications(prev => {
      // Avoid duplicates
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;
      
      return [notification, ...prev].slice(0, 50); // Keep last 50 notifications
    });
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    setLocalNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, ...updates } : n)
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Enhanced mark as read function
  const markAsRead = useCallback((id: string) => {
    // Update local notification first for immediate UI feedback
    updateNotification(id, { read: true });
    
    // Then update on server
    serverMarkAsRead(id);
  }, [updateNotification, serverMarkAsRead]);

  // Enhanced mark all as read function
  const markAllAsRead = useCallback(() => {
    // Update all local notifications first
    setLocalNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
    
    // Then update on server
    serverMarkAllAsRead();
  }, [serverMarkAllAsRead]);

  // Enhanced create notification function
  const createNotification = useCallback((data: any) => {
    // Add to local notifications immediately
    const notification: Notification = {
      id: `local-${Date.now()}`,
      title: data.title,
      description: data.description,
      timestamp: new Date(),
      type: data.type || 'general',
      read: false,
      priority: data.priority || 'medium',
      actionUrl: data.actionUrl,
      canteenId: data.canteenId,
      userId: user?.id?.toString()
    };
    
    addNotification(notification);
    
    // Then create on server
    serverCreateNotification(data);
  }, [addNotification, serverCreateNotification, user?.id]);

  // Enhanced delete notification function
  const deleteNotification = useCallback((id: string) => {
    // Remove from local notifications first
    removeNotification(id);
    
    // Then delete from server
    serverDeleteNotification(id);
  }, [removeNotification, serverDeleteNotification]);

  // Enhanced clear all notifications function
  const clearAllNotifications = useCallback(() => {
    // Clear all local notifications first
    setLocalNotifications([]);
    
    // Then clear all server notifications
    serverClearAllNotifications();
  }, [serverClearAllNotifications]);

  // Clean up old local notifications periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      setLocalNotifications(prev => 
        prev.filter(n => new Date(n.timestamp) > oneHourAgo)
      );
    }, 5 * 60 * 1000); // Clean up every 5 minutes

    return () => clearInterval(interval);
  }, []);

  const contextValue: NotificationContextType = {
    notifications: allNotifications,
    unreadCount: allNotifications.filter(n => !n.read).length,
    unreadNotifications: allNotifications.filter(n => !n.read),
    readNotifications: allNotifications.filter(n => n.read),
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
    createNotification,
    deleteNotification,
    clearAllNotifications,
    isMarkingAsRead,
    isMarkingAllAsRead,
    isCreating,
    isDeleting,
    isClearingAll,
    addNotification,
    updateNotification,
    removeNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}
