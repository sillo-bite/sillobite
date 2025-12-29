import type { MenuItem, Category } from "@shared/schema";

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  stock: number;
  categoryId?: string;
}

export interface Transaction {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  items: CartItem[];
  discount?: number;
  createdAt: Date;
  status: string;
}

export interface PosBillingProps {
  canteenId: string;
  onOpenSettings?: () => void;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface DiscountConfig {
  percent: number;
  amount: number;
}

