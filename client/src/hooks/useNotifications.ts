import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'order' | 'promotion' | 'system' | 'general';
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  canteenId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateNotificationData {
  title: string;
  description: string;
  type: 'order' | 'promotion' | 'system' | 'general';
  priority?: 'low' | 'medium' | 'high';
  actionUrl?: string;
  canteenId?: string;
  userId?: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: !!user,
    refetchInterval: false, // No polling - use WebSocket for real-time updates
    select: (data) => {
      // Transform the data to match our interface
      return data.map((notification: any) => ({
        id: notification.id || notification._id,
        title: notification.title,
        description: notification.description || notification.message,
        timestamp: new Date(notification.createdAt || notification.timestamp),
        type: notification.type || 'general',
        read: notification.read || false,
        priority: notification.priority || 'medium',
        actionUrl: notification.actionUrl,
        canteenId: notification.canteenId,
        userId: notification.userId,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt
      })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read: true }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifications = notifications.filter(n => !n.read);
      const promises = unreadNotifications.map(notification =>
        fetch(`/api/notifications/${notification.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ read: true }),
        })
      );
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Create notification (for admin/canteen owner use)
  const createNotificationMutation = useMutation({
    mutationFn: async (data: CreateNotificationData) => {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create notification');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
    },
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Clear all notifications
  const clearAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      const promises = notifications.map(notification =>
        fetch(`/api/notifications/${notification.id}`, {
          method: 'DELETE',
        })
      );
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      // Invalidate and refetch notifications
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Helper functions
  const markAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const markAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const createNotification = (data: CreateNotificationData) => {
    createNotificationMutation.mutate(data);
  };

  const deleteNotification = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  const clearAllNotifications = () => {
    clearAllNotificationsMutation.mutate();
  };

  // Computed values
  const unreadCount = notifications.filter(n => !n.read).length;
  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return {
    notifications,
    unreadCount,
    unreadNotifications,
    readNotifications,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
    createNotification,
    deleteNotification,
    clearAllNotifications,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isCreating: createNotificationMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
    isClearingAll: clearAllNotificationsMutation.isPending,
  };
}
