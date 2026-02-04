/**
 * Formatting utilities for consistent display across the app
 */

/**
 * Format currency amount to Indian Rupee format
 * @param amount - Amount to format
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "₹1,234.56")
 */
export function formatCurrency(
  amount: number | string,
  options: {
    showSymbol?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const {
    showSymbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = options;

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return showSymbol ? '₹0.00' : '0.00';
  }

  const formatted = new Intl.NumberFormat('en-IN', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numAmount);

  // If not using currency style, add ₹ symbol manually
  if (!showSymbol) {
    return `₹${formatted}`;
  }

  return formatted;
}

/**
 * Format date to readable string
 * @param date - Date string, Date object, or timestamp
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date | number,
  options: {
    includeTime?: boolean;
    format?: 'short' | 'long' | 'relative';
  } = {}
): string {
  const { includeTime = false, format = 'short' } = options;

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  if (format === 'relative') {
    return getRelativeTime(dateObj);
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'long' ? 'long' : 'short',
    day: 'numeric',
  };

  if (includeTime) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }

  return dateObj.toLocaleDateString('en-IN', dateOptions);
}

/**
 * Format time only
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(date: string | Date | number): string {
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Time';
  }

  return dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time string (e.g., "2 hours ago", "yesterday")
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return formatDate(date, { format: 'short' });
  }
}

/**
 * Format order ID for display
 * @param orderId - Order ID string
 * @returns Formatted order ID
 */
export function formatOrderId(orderId: string): string {
  if (!orderId) return '';
  // Remove common prefixes and format
  return orderId.replace(/^ORD/i, '').toUpperCase();
}


/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
