/**
 * Shared utility for calculating order totals securely on both frontend and backend.
 * This ensures that the payment amount requested matches the server-calculated amount.
 */

export interface CartItem {
    id: string;
    price: number;
    quantity: number;
}

export interface CouponDiscount {
    type: 'percent' | 'fixed';
    value: number;
    maxDiscountAmount?: number | null;
}

export interface CanteenCharge {
    name: string;
    type: 'percent' | 'fixed';
    value: number;
    active: boolean;
}

export interface PricingResult {
    subtotal: number;
    discountAmount: number;
    totalBeforeCharges: number;
    chargesTotal: number;
    finalTotal: number;
    chargesApplied: Array<{ name: string; type: 'percent' | 'fixed'; value: number; amount: number }>;
}

export function calculateOrderTotal(
    cart: CartItem[],
    activeCharges: CanteenCharge[],
    appliedCoupon?: CouponDiscount | null
): PricingResult {
    // 1. Calculate Subtotal
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 2. Calculate Discount
    let discountAmount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.type === 'percent') {
            discountAmount = (subtotal * appliedCoupon.value) / 100;
            if (appliedCoupon.maxDiscountAmount && discountAmount > appliedCoupon.maxDiscountAmount) {
                discountAmount = appliedCoupon.maxDiscountAmount;
            }
        } else {
            // Fixed discount
            discountAmount = appliedCoupon.value;
        }
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);
    const totalBeforeCharges = subtotal - discountAmount;

    // 3. Calculate Charges
    let chargesTotal = 0;
    const chargesApplied: Array<{ name: string; type: 'percent' | 'fixed'; value: number; amount: number }> = [];

    activeCharges.filter(c => c.active).forEach((charge) => {
        let amount = 0;
        if (charge.type === 'percent') {
            amount = (totalBeforeCharges * charge.value) / 100;
        } else {
            amount = charge.value;
        }

        if (amount > 0) {
            // Keep exact precision for calculation, UI can round it
            const roundedAmount = Number(amount.toFixed(2));
            chargesApplied.push({
                name: charge.name,
                type: charge.type,
                value: charge.value,
                amount: roundedAmount
            });
            chargesTotal += amount;
        }
    });

    const roundedChargesTotal = Number(chargesTotal.toFixed(2));
    const finalTotal = totalBeforeCharges + roundedChargesTotal;

    return {
        subtotal,
        discountAmount: Number(discountAmount.toFixed(2)),
        totalBeforeCharges: Number(totalBeforeCharges.toFixed(2)),
        chargesTotal: roundedChargesTotal,
        finalTotal: Number(finalTotal.toFixed(2)),
        chargesApplied
    };
}
