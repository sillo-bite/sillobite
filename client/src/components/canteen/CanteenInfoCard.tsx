
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CanteenInfoCardProps {
    className?: string;
    title?: string;
    address?: string;
    rating?: number;
    deliveryTime?: string;
    hasFreeDelivery?: boolean;
    logoUrl?: string;
}

export const CanteenInfoCard: React.FC<CanteenInfoCardProps> = ({
    className,
    title,
    address,
    rating = 4.8,
    deliveryTime = "20-25 min",
    hasFreeDelivery = true,
    logoUrl
}) => {
    return (
        <Card className={cn("w-full shadow-xl rounded-3xl overflow-visible border-none relative", className)}>
            <CardContent className="p-0 pt-12 pb-6 relative">
                {/* Logo Placeholder */}
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                    <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center p-1 shadow-sm">
                        <div className="w-full h-full rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] text-muted-foreground font-bold">LOGO</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center px-6 mt-4 space-y-2">
                    <h2 className="text-2xl font-bold text-foreground text-center tracking-tight leading-none">
                        {title || "Canteen Name"}
                    </h2>

                    {address && (
                        <p className="text-sm text-muted-foreground text-center max-w-[250px] leading-tight">
                            {address}
                        </p>
                    )}

                    {/* Info Row: Rating, Time, Delivery */}
                    <div className="flex items-center justify-center space-x-4 mt-3 w-full">
                        <div className="flex items-center space-x-1">
                            <span className="text-yellow-400 text-lg">★</span>
                            <span className="text-sm font-bold">{rating}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span className="text-red-500 text-lg">⏰</span>
                            <span className="text-sm font-medium text-foreground">{deliveryTime}</span>
                        </div>
                        {hasFreeDelivery && (
                            <div className="flex items-center space-x-1">
                                <span className="text-orange-500 text-lg">🛵</span>
                                <span className="text-sm font-medium text-foreground">Free Delivery</span>
                            </div>
                        )}
                    </div>

                    {/* Categories Chips (Placeholder for now) */}
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {["Burger", "Pizza", "Fast Food"].map((cat) => (
                            <div key={cat} className="bg-muted/50 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                                {cat}
                            </div>
                        ))}
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};
