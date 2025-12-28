import type { CartItem, OrderTotals, DiscountConfig } from "@/types/pos";

const TAX_RATE = 0.05; // 5% GST

export function calculateSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

export function calculateDiscount(
  subtotal: number,
  discountConfig: DiscountConfig
): number {
  if (discountConfig.percent > 0) {
    return (subtotal * discountConfig.percent) / 100;
  }
  return discountConfig.amount;
}

export function calculateTax(subtotal: number, discount: number): number {
  return (subtotal - discount) * TAX_RATE;
}

export function calculateTotal(
  subtotal: number,
  discount: number,
  tax: number
): number {
  return subtotal - discount + tax;
}

export function calculateOrderTotals(
  cart: CartItem[],
  discountConfig: DiscountConfig
): OrderTotals {
  const subtotal = calculateSubtotal(cart);
  const discount = calculateDiscount(subtotal, discountConfig);
  const tax = calculateTax(subtotal, discount);
  const total = calculateTotal(subtotal, discount, tax);

  return {
    subtotal,
    discount,
    tax,
    total,
  };
}

export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0.00';
  }
  return `₹${amount.toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

