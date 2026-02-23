import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { setPWAAuth } from '@/utils/pwaAuth';
import { QrCode, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';

export default function QRHandlerPage() {
    const [, params] = useRoute("/qr/:type/:qrId");
    const [, setLocation] = useLocation();
    const { user, isLoading: authLoading, logout } = useAuth();
    const [error, setError] = useState<string | null>(null);

    const qrId = params?.qrId;
    const qrType = params?.type; // 'college' expected

    const applyContextMutation = useMutation({
        mutationFn: async () => {
            if (!user || !qrId) return;

            const endpoint = qrType === 'canteen'
                ? `/api/users/${user.id}/apply-canteen-qr-context`
                : `/api/users/${user.id}/apply-qr-context`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrId })
            });

            if (!res.ok) {
                const data = await res.json();
                const err = new Error(data.message || 'Failed to apply context');
                // Attach status code to error object for special handling in onError
                (err as any).status = res.status;
                throw err;
            }
            return res.json();
        },
        onSuccess: (data) => {
            // Update localStorage user with location data so LocationContext picks it up on /app load
            // This is critical because useAuth skips DB validation for GUEST users
            try {
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                if (data?.collegeId) {
                    storedUser.selectedLocationType = 'college';
                    storedUser.selectedLocationId = data.collegeId;
                    storedUser.college = data.collegeId;
                    storedUser.collegeName = data.collegeName;
                } else if (data?.locationType && data?.locationId) {
                    storedUser.selectedLocationType = data.locationType;
                    storedUser.selectedLocationId = data.locationId;
                }
                localStorage.setItem('user', JSON.stringify(storedUser));
                // Also save location to localStorage for LocationContext fallback
                localStorage.setItem('selectedLocation', JSON.stringify({
                    type: storedUser.selectedLocationType,
                    id: storedUser.selectedLocationId,
                    name: data.collegeName || data.locationId || ''
                }));
            } catch (e) {
                console.error('Failed to update localStorage with location data:', e);
            }

            // Hard reload to ensure all app context (sockets, cache) is fresh
            if (qrType === 'canteen' && data?.canteenId) {
                window.location.href = `/app?view=home&canteenId=${data.canteenId}`;
            } else {
                window.location.href = '/app';
            }
        },
        onError: async (err: Error) => {
            if ((err as any).status === 404 && err.message === 'User not found') {
                console.log('👤 Backend reported user not found. Stale session detected, clearing session.');
                // Don't call logout() here — it has a setTimeout that hard-redirects to /login,
                // which would race with our redirect below and lose the QR params.
                // Instead, clear the stale session manually.
                localStorage.removeItem('user');
                localStorage.removeItem('selectedLocation');
                sessionStorage.clear();
                const returnUrl = encodeURIComponent(window.location.pathname);
                window.location.href = `/onboarding?redirect=${returnUrl}&fromQR=true&sessionExpired=true`;
                return;
            }
            setError(err.message);
        }
    });

    useEffect(() => {
        console.log('📌 QRHandlerPage Debug:', { authLoading, user: user?.id, qrId, qrType, isPending: applyContextMutation.isPending, isSuccess: applyContextMutation.isSuccess, error });

        if (authLoading) return;

        if (!user) {
            console.log('👤 User not authenticated, redirecting to login');
            // Redirect to login with return URL
            // Using window.location.href for current full URL to ensure PWA/deep link context is kept if possible
            const returnUrl = encodeURIComponent(window.location.pathname);
            setLocation(`/onboarding?redirect=${returnUrl}&fromQR=true`);
            return;
        }

        if (user && qrId && !applyContextMutation.isPending && !applyContextMutation.isSuccess && !error) {
            console.log('🚀 Triggering QR context application...');
            applyContextMutation.mutate();
        }
    }, [user, authLoading, qrId, setLocation, applyContextMutation, error]);


    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md shadow-lg">
                    <CardContent className="pt-6 flex flex-col items-center text-center">
                        <div className="bg-red-100 p-3 rounded-full mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
                        <p className="text-gray-500 mb-6">{error}</p>
                        <Button onClick={() => setLocation('/')} className="w-full">
                            Go to Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <div className="flex flex-col items-center space-y-6 animate-in fade-in duration-500">
                {/* Logo or Brand Element could go here */}
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                    <div className="relative bg-white p-4 rounded-2xl shadow-xl">
                        <QrCode className="w-12 h-12 text-primary" />
                    </div>
                </div>

                <div className="text-center space-y-2 max-w-xs">
                    <h1 className="text-2xl font-bold tracking-tight">Setting up...</h1>
                    <p className="text-muted-foreground text-sm">
                        We're configuring your campus experience. <br /> This will take just a moment.
                    </p>
                </div>

                <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
        </div>
    );
}
