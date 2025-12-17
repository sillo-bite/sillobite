import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { CartItem } from "@/types/pos";
import type { MenuItem } from "@shared/schema";

export function usePosCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((item: MenuItem) => {
    if (item.stock <= 0 || !item.available) {
      toast.error(`${item.name} is out of stock.`);
      return;
    }

    setCart(prev => {
      const existingItem = prev.find(c => c.id === item.id);
      if (existingItem) {
        if (existingItem.quantity >= item.stock) {
          toast.error(`Only ${item.stock} ${item.name} available.`);
          return prev;
        }
        return prev.map(c =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        imageUrl: item.imageUrl,
        stock: item.stock,
        categoryId: item.categoryId,
      }];
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(c => c.id === itemId);
      if (!item) return prev;

      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        return prev.filter(c => c.id !== itemId);
      }
      if (newQuantity > item.stock) {
        toast.error(`Only ${item.stock} ${item.name} available.`);
        return prev;
      }
      return prev.map(c =>
        c.id === itemId ? { ...c, quantity: newQuantity } : c
      );
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(c => c.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };
}

