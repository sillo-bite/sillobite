import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import type { CartItem, Transaction, PaymentMethod } from "@/types/pos";

interface CreateOrderParams {
  canteenId: string;
  customerName: string;
  cart: CartItem[];
  total: number;
  subtotal: number;
  discount: number;
  couponCode?: string;
  paymentMethod: PaymentMethod;
}

export function usePosOrder(canteenId: string) {
  const queryClient = useQueryClient();
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: CreateOrderParams) => {
      const orderItems = orderData.cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const payload = {
        canteenId: orderData.canteenId,
        customerName: orderData.customerName.trim() || "Walk-in Customer",
        items: JSON.stringify(orderItems),
        amount: Math.round(orderData.total * 100) / 100,
        originalAmount: orderData.subtotal,
        discountAmount: orderData.discount,
        appliedCoupon: orderData.couponCode || undefined,
        isOffline: true,
        paymentStatus: 'completed',
        isCounterOrder: true,
        orderType: 'takeaway',
      };

      console.log('🔍 POS Order Payload:', payload);

      const data = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('✅ Order Response:', data);

      // Create transaction from response
      const transaction: Transaction = {
        id: data.id,
        orderNumber: data.orderNumber,
        customerName: orderData.customerName || "Walk-in Customer",
        amount: orderData.total,
        paymentMethod: orderData.paymentMethod,
        items: orderData.cart,
        discount: orderData.discount,
        createdAt: new Date(),
        status: data.status,
      };

      return transaction;
    },
    onSuccess: (transaction) => {
      toast.success(`Order ${transaction.orderNumber} has been created successfully.`);
      setCurrentTransaction(transaction);
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create order. Please try again.");
    },
  });

  const createOrder = async (params: CreateOrderParams): Promise<Transaction | null> => {
    try {
      const transaction = await createOrderMutation.mutateAsync(params);
      return transaction;
    } catch (error) {
      return null;
    }
  };

  return {
    createOrder,
    currentTransaction,
    setCurrentTransaction,
    isProcessing: createOrderMutation.isPending,
  };
}

