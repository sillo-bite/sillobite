/**
 * Order status utilities for consistent status handling
 */

export type OrderStatus = 
  | 'pending' 
  | 'preparing' 
  | 'ready' 
  | 'completed' 
  | 'cancelled' 
  | 'rejected'
  | 'confirmed';

export type PaymentStatus = 
  | 'pending' 
  | 'success' 
  | 'failed' 
  | 'refunded'
  | 'processing';

/**
 * Get color classes for order status badge
 */
export function getOrderStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase();
  
  switch (normalizedStatus) {
    case 'pending':
    case 'confirmed':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'preparing':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'ready':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'cancelled':
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

/**
 * Get color classes for payment status badge
 */
export function getPaymentStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase();
  
  switch (normalizedStatus) {
    case 'success':
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'pending':
    case 'processing':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'refunded':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

/**
 * Get human-readable status label
 */
export function getOrderStatusLabel(status: string): string {
  const normalizedStatus = status.toLowerCase();
  
  const labels: Record<string, string> = {
    'pending': 'Pending',
    'confirmed': 'Confirmed',
    'preparing': 'Preparing',
    'ready': 'Ready',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'rejected': 'Rejected',
  };

  return labels[normalizedStatus] || status;
}

/**
 * Get human-readable payment status label
 */
export function getPaymentStatusLabel(status: string): string {
  const normalizedStatus = status.toLowerCase();
  
  const labels: Record<string, string> = {
    'success': 'Success',
    'pending': 'Pending',
    'failed': 'Failed',
    'refunded': 'Refunded',
    'processing': 'Processing',
  };

  return labels[normalizedStatus] || status;
}

/**
 * Check if order status allows cancellation
 */
export function canCancelOrder(status: string): boolean {
  const normalizedStatus = status.toLowerCase();
  return ['pending', 'confirmed', 'preparing'].includes(normalizedStatus);
}

/**
 * Check if order is in active state (not completed/cancelled)
 */
export function isOrderActive(status: string): boolean {
  const normalizedStatus = status.toLowerCase();
  return !['completed', 'cancelled', 'rejected'].includes(normalizedStatus);
}

