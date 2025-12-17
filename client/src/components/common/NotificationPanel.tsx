import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useReducedMotion } from '@/utils/dropdownAnimations';
import { 
  Bell, 
  X, 
  Package, 
  Gift, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  ChevronRight
} from 'lucide-react';

export interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'order' | 'promotion' | 'system' | 'general';
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll
}) => {
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Simple close handler
  const handleClose = () => {
    onClose();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'order':
        return <Package className={`${iconClass} text-primary`} />;
      case 'promotion':
        return <Gift className={`${iconClass} text-primary`} style={{ color: `hsl(var(--success))` }} />;
      case 'system':
        return <AlertCircle className={`${iconClass} text-primary`} style={{ color: `hsl(var(--warning))` }} />;
      default:
        return <Bell className={`${iconClass} text-muted-foreground`} />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-destructive';
      case 'medium':
        return resolvedTheme === 'dark' 
          ? 'border-l-accent-foreground' 
          : 'border-l-primary';
      default:
        return 'border-l-border';
    }
  };

  const getNotificationBackground = (notification: Notification) => {
    const { type, read } = notification;
    
    if (!read) {
      // Unread notifications - more prominent
      switch (type) {
        case 'order':
          return resolvedTheme === 'dark' 
            ? 'bg-muted/80 border-border' 
            : 'bg-accent/50 border-border';
        case 'promotion':
          return resolvedTheme === 'dark' 
            ? 'bg-muted/80 border-border' 
            : 'bg-accent/50 border-border';
        case 'system':
          return resolvedTheme === 'dark' 
            ? 'bg-muted/80 border-border' 
            : 'bg-accent/50 border-border';
        default:
          return resolvedTheme === 'dark' 
            ? 'bg-muted/80 border-border' 
            : 'bg-muted/50 border-border';
      }
    } else {
      // Read notifications - more subtle
      return resolvedTheme === 'dark' 
        ? 'bg-card/60 border-border' 
        : 'bg-card/40 border-border';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Notification Panel */}
      <div
        ref={panelRef}
         className={`fixed top-20 right-4 w-[calc(100vw-2rem)] sm:w-80 z-50 rounded-xl shadow-xl border transition-all duration-300 ease-out bg-card border-border ${
           prefersReducedMotion ? '' : 'animate-dropdown-enter'
         }`}
         style={{
           transformOrigin: 'top right'
         }}
        tabIndex={-1}
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
      >
            {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-foreground" />
            <div>
              <h3 className="font-semibold text-foreground">
                Notifications
              </h3>
              <p className="text-xs text-muted-foreground">
                Tap outside to close
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                onClick={onClearAll}
                className="text-xs px-2 py-1 rounded transition-colors text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                >
                  Clear all
                </button>
              )}
              {unreadCount > 0 && (
                <button
                onClick={onMarkAllAsRead}
                className="text-xs px-2 py-1 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Mark all read
                </button>
              )}
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
            </div>

         {/* Content */}
         <div className="max-h-96 overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
                </div>
              ) : (
            <div className="p-2 space-y-2">
              {notifications?.map((notification, index) => (
                 <div
                      key={notification.id}
                   className={`p-3 rounded-lg border-l-4 border transition-all duration-200 hover:scale-[1.02] cursor-pointer hover:bg-muted ${getPriorityColor(notification.priority)} ${getNotificationBackground(notification)} ${
                     prefersReducedMotion ? '' : 'animate-dropdown-stagger'
                   }`}
                  style={{
                    animationDelay: prefersReducedMotion ? '0ms' : `${index * 50}ms`
                  }}
                  onClick={() => {
                    if (!notification.read) {
                      onMarkAsRead(notification.id);
                    }
                    if (notification.actionUrl) {
                      window.location.href = notification.actionUrl;
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-foreground">
                              {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-destructive rounded-full flex-shrink-0 mt-1.5" />
                        )}
                          </div>
                      <p className="text-xs mt-1 text-muted-foreground">
                        {notification.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.timestamp)}
                              </span>
                        {notification.actionUrl && (
                          <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
                            )}
                      </div>
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
              )}
            </div>
    </div>
    </>
  );
};

export default NotificationPanel;