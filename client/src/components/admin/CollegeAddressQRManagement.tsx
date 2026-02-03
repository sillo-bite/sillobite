import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    MapPin,
    Trash2,
    Plus,
    QrCode,
} from "lucide-react";
import QRCodeDisplay from "@/components/ui/qr-code-display";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// QR Code Address Interface
interface QRCodeAddress {
    label: string;
    fullName?: string;
    phoneNumber?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
}

interface CollegeAddressQRManagementProps {
    collegeId: string;
    mode?: 'address' | 'location';
}

export default function CollegeAddressQRManagement({ collegeId, mode = 'address' }: CollegeAddressQRManagementProps) {
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [addressForm, setAddressForm] = useState<QRCodeAddress>({
        label: '',
        fullName: '',
        phoneNumber: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
    });

    // Fetch QR codes
    const { data: qrCodesData, isLoading: qrCodesLoading, refetch: refetchQRCodes } = useQuery({
        queryKey: [`/api/system-settings/colleges/${collegeId}/qr-codes`],
        queryFn: async () => {
            const response = await fetch(`/api/system-settings/colleges/${collegeId}/qr-codes`);
            if (!response.ok) {
                throw new Error('Failed to fetch QR codes');
            }
            return response.json();
        },
        enabled: !!collegeId,
    });

    // Filter QR codes based on mode
    const qrCodes = (qrCodesData?.qrCodes || []).filter((qr: any) => {
        if (mode === 'location') {
            return qr.type === 'location'; // Or check if missing fullAddress details if type field migration is lagging
        }
        return qr.type === 'address' || (!qr.type && qr.fullAddress?.addressLine1); // Default/Legacy
    });

    // Create QR code mutation
    const createQRCodeMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await fetch(`/api/system-settings/colleges/${collegeId}/qr-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: mode,
                    ...data
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create QR code');
            }
            return response.json();
        },
        onSuccess: () => {
            // Reset form
            setAddressForm({
                label: '',
                fullName: '',
                phoneNumber: '',
                addressLine1: '',
                addressLine2: '',
                city: '',
                state: '',
                pincode: '',
                landmark: '',
            });
            setShowCreateDialog(false);
            refetchQRCodes();
            toast({
                title: "Success",
                description: `${mode === 'location' ? 'Location' : 'Address'} QR Code created successfully`,
            });
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to create QR code",
            });
        }
    });

    // Delete QR code mutation
    const deleteQRCodeMutation = useMutation({
        mutationFn: async (qrId: string) => {
            const response = await fetch(`/api/system-settings/colleges/${collegeId}/qr-codes/${qrId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete QR code');
            }
            return response.json();
        },
        onSuccess: () => {
            refetchQRCodes();
            toast({
                title: "Success",
                description: "QR Code deleted successfully",
            });
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to delete QR code",
            });
        }
    });

    const handleCreateQRCode = () => {
        // Validate based on mode
        if (mode === 'location') {
            if (!addressForm.label.trim()) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Please enter a label for this location",
                });
                return;
            }
            setIsCreating(true);
            createQRCodeMutation.mutate({
                label: addressForm.label,
                // No address details sent
            }, {
                onSettled: () => setIsCreating(false),
            });
        } else {
            // Address mode validation
            if (!addressForm.label.trim() || !addressForm.addressLine1.trim() ||
                !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.pincode.trim()) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Please fill in all required fields (Label, Address Line 1, City, State, Pincode)",
                });
                return;
            }
            setIsCreating(true);
            createQRCodeMutation.mutate({
                fullAddress: addressForm,
                address: addressForm.addressLine1, // Legacy support
            }, {
                onSettled: () => setIsCreating(false),
            });
        }
    };

    const handleDeleteQRCode = (qrId: string) => {
        if (confirm('Are you sure you want to delete this QR code?')) {
            deleteQRCodeMutation.mutate(qrId);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{mode === 'location' ? 'Location QR Codes' : 'Address QR Codes'}</h3>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="flex items-center space-x-2">
                            <Plus className="w-4 h-4" />
                            <span>Create {mode === 'location' ? 'Location' : ''} QR Code</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New {mode === 'location' ? 'Location' : 'Address'} QR</DialogTitle>
                            <p className="text-sm text-muted-foreground">
                                {mode === 'location'
                                    ? "Enter a label for this location (e.g., 'Main Campus'). Scanning this QR will set the user's location to this college."
                                    : "Enter the address details. This address will be linked to the generated QR code."}
                            </p>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {/* Label */}
                            <div className="space-y-2">
                                <Label htmlFor="label">{mode === 'location' ? 'Location Name' : 'Address Label'} *</Label>
                                <Input
                                    id="label"
                                    placeholder={mode === 'location' ? "e.g., Main Campus, North Block" : "e.g., Main Entrance, Admin Block"}
                                    value={addressForm.label}
                                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                                    required
                                />
                            </div>

                            {mode === 'address' && (
                                <>
                                    {/* Full Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="fullName">Full Name (Optional)</Label>
                                        <Input
                                            id="fullName"
                                            placeholder="Contact Person Name"
                                            value={addressForm.fullName || ''}
                                            onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                                        />
                                    </div>

                                    {/* Phone Number */}
                                    <div className="space-y-2">
                                        <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                                        <Input
                                            id="phoneNumber"
                                            type="tel"
                                            placeholder="Contact Phone Number"
                                            value={addressForm.phoneNumber || ''}
                                            onChange={(e) => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
                                        />
                                    </div>

                                    {/* Address Line 1 */}
                                    <div className="space-y-2">
                                        <Label htmlFor="addressLine1">Address Line 1 *</Label>
                                        <Textarea
                                            id="addressLine1"
                                            placeholder="Building Name, Street, etc."
                                            value={addressForm.addressLine1}
                                            onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                                            required
                                            rows={2}
                                        />
                                    </div>

                                    {/* Address Line 2 */}
                                    <div className="space-y-2">
                                        <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                                        <Textarea
                                            id="addressLine2"
                                            placeholder="Area, Locality"
                                            value={addressForm.addressLine2 || ''}
                                            onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                                            rows={2}
                                        />
                                    </div>

                                    {/* City, State, Pincode in a row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="city">City *</Label>
                                            <Input
                                                id="city"
                                                placeholder="Enter city"
                                                value={addressForm.city}
                                                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="state">State *</Label>
                                            <Input
                                                id="state"
                                                placeholder="Enter state"
                                                value={addressForm.state}
                                                onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="pincode">Pincode *</Label>
                                            <Input
                                                id="pincode"
                                                placeholder="Enter pincode"
                                                value={addressForm.pincode}
                                                onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Landmark */}
                                    <div className="space-y-2">
                                        <Label htmlFor="landmark">Landmark (Optional)</Label>
                                        <Input
                                            id="landmark"
                                            placeholder="Nearby landmark"
                                            value={addressForm.landmark || ''}
                                            onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreateDialog(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateQRCode}
                                    disabled={isCreating}
                                    className="flex-1"
                                >
                                    {isCreating ? 'Creating...' : 'Create QR Code'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {qrCodesLoading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Loading QR codes...</p>
                </div>
            ) : qrCodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/20">
                    <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No {mode === 'location' ? 'Location' : 'Address'} QR codes created yet.</p>
                    <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                        Create your first {mode === 'location' ? 'Location' : 'Address'} QR
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qrCodes.map((qrCode: any) => (
                        <Card key={qrCode.qrId} className="relative overflow-hidden">
                            <CardHeader className="pb-2 bg-muted/10">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="text-base font-medium flex items-center space-x-2 truncate">
                                            <MapPin className="w-4 h-4 text-primary shrink-0" />
                                            <span className="truncate" title={qrCode.fullAddress?.label || qrCode.address}>
                                                {qrCode.fullAddress?.label || qrCode.address}
                                            </span>
                                        </CardTitle>
                                        {mode === 'address' && (
                                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                                {qrCode.fullAddress?.addressLine1}
                                            </p>
                                        )}
                                        {mode === 'location' && (
                                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                                Location Context Only
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteQRCode(qrCode.qrId)}
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex flex-col items-center">
                                <QRCodeDisplay
                                    url={qrCode.qrCodeUrl}
                                    size={150}
                                    showActions={true}
                                    className="mb-2"
                                />
                                <div className="text-xs text-center text-muted-foreground mt-2 w-full">
                                    <div className="flex justify-between px-2">
                                        <span>Created: {new Date(qrCode.createdAt).toLocaleDateString()}</span>
                                        <span className={qrCode.isActive ? "text-green-600" : "text-red-500"}>
                                            {qrCode.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
