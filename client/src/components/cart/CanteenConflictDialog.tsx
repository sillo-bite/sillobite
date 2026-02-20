import React from 'react';
import { useCart } from '@/contexts/CartContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCanteenContext } from '@/contexts/CanteenContext';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ShoppingBag, AlertTriangle } from 'lucide-react';

export default function CanteenConflictDialog() {
    const { canteenConflict, pendingItem, confirmCanteenSwitch, cancelCanteenSwitch, getCartCanteenId } = useCart();
    const { resolvedTheme } = useTheme();
    const { availableCanteens } = useCanteenContext();

    if (!canteenConflict || !pendingItem) return null;

    // Get the name of the canteen whose items are currently in the cart
    const cartCanteenId = getCartCanteenId();
    const cartCanteenName = cartCanteenId
        ? availableCanteens.find(c => c.id === cartCanteenId)?.name || 'another canteen'
        : 'another canteen';

    return (
        <AlertDialog open={canteenConflict} onOpenChange={(open) => { if (!open) cancelCanteenSwitch(); }}>
            <AlertDialogContent
                className={`max-w-[90vw] sm:max-w-md rounded-3xl border-0 p-0 overflow-hidden ${resolvedTheme === 'dark'
                    ? 'bg-gray-900 shadow-[0_25px_60px_rgba(0,0,0,0.6)]'
                    : 'bg-white shadow-[0_25px_60px_rgba(0,0,0,0.15)]'
                    }`}
            >
                {/* Header accent */}
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

                <div className="px-6 pt-5 pb-6">
                    <AlertDialogHeader className="space-y-4">
                        {/* Icon */}
                        <div className="mx-auto flex items-center justify-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${resolvedTheme === 'dark'
                                ? 'bg-amber-500/15'
                                : 'bg-amber-50'
                                }`}>
                                <AlertTriangle className={`w-8 h-8 ${resolvedTheme === 'dark' ? 'text-amber-400' : 'text-amber-500'
                                    }`} />
                            </div>
                        </div>

                        <AlertDialogTitle className={`text-center text-lg font-bold ${resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                            }`}>
                            Replace cart items?
                        </AlertDialogTitle>

                        <AlertDialogDescription className={`text-center text-sm leading-relaxed ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            Your cart contains items from{' '}
                            <span className={`font-semibold ${resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                                }`}>
                                {cartCanteenName}
                            </span>
                            . Would you like to clear your cart and add{' '}
                            <span className={`font-semibold ${resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                                }`}>
                                {pendingItem.item.name}
                            </span>
                            {' '}instead?
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="flex flex-col gap-2.5 mt-6 sm:flex-col sm:space-x-0">
                        <AlertDialogAction
                            onClick={confirmCanteenSwitch}
                            className="w-full h-12 rounded-2xl font-semibold text-sm bg-primary hover:bg-primary/90 text-white transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
                        >
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            Clear Cart & Add New Item
                        </AlertDialogAction>
                        <AlertDialogCancel
                            onClick={cancelCanteenSwitch}
                            className={`w-full h-12 rounded-2xl font-semibold text-sm border-0 transition-all duration-200 active:scale-[0.98] mt-0 ${resolvedTheme === 'dark'
                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Keep Current Cart
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
