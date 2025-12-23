import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, MapPin, Check, Save } from "lucide-react";
import { useTheme } from '@/contexts/ThemeContext';

interface Address {
  id: string;
  userId: number;
  label: string;
  fullName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AddressSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (address: Address) => void;
  userId: number;
}

export default function AddressSelectionDialog({
  open,
  onClose,
  onSelect,
  userId,
}: AddressSelectionDialogProps) {
  const { resolvedTheme } = useTheme();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const queryClient = useQueryClient();
  
  // Address form state
  const [addressFormData, setAddressFormData] = useState({
    label: '',
    fullName: '',
    phoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    isDefault: false,
  });
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);

  // Fetch addresses
  const { data: addresses = [], isLoading, refetch } = useQuery<Address[]>({
    queryKey: ['/api/addresses', userId],
    queryFn: async () => {
      const response = await fetch(`/api/addresses?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch addresses');
      return response.json();
    },
    enabled: open && !!userId,
  });

  const handleSelect = (address: Address) => {
    setSelectedAddressId(address.id);
  };

  const handleConfirm = () => {
    if (!selectedAddressId) return;
    
    const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);
    if (selectedAddress) {
      // Call onSelect first, which will handle closing the dialog
      // Don't call onClose here to avoid the timing issue
      onSelect(selectedAddress);
    }
  };

  const handleCreateNew = () => {
    setShowAddressForm(true);
  };

  const handleFormClose = () => {
    setShowAddressForm(false);
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/addresses', userId] });
    refetch();
    setShowAddressForm(false);
    // Reset form
    setAddressFormData({
      label: '',
      fullName: '',
      phoneNumber: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      isDefault: false,
    });
  };

  const handleAddressFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAddress(true);

    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...addressFormData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save address');
      }

      // Address saved successfully
      const savedAddress = await response.json();
      handleFormSuccess();
      
      // Auto-select the newly created address
      setTimeout(() => {
        onSelect(savedAddress);
      }, 100);
    } catch (error) {
      console.error('Error saving address:', error);
      alert(error instanceof Error ? error.message : 'Failed to save address. Please try again.');
    } finally {
      setIsSubmittingAddress(false);
    }
  };

  return (
    <>
      {/* Address Form Dialog */}
      <Dialog open={showAddressForm} onOpenChange={(open) => {
        if (!open) {
          handleFormClose();
          // Reset form when closing
          setAddressFormData({
            label: '',
            fullName: '',
            phoneNumber: '',
            addressLine1: '',
            addressLine2: '',
            city: '',
            state: '',
            pincode: '',
            landmark: '',
            isDefault: false,
          });
        }
      }}>
        <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${
          resolvedTheme === 'dark' ? 'bg-[#31084A] border-gray-800' : 'bg-white'
        }`}>
          <DialogHeader>
            <DialogTitle className={`${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Add New Address
            </DialogTitle>
            <DialogDescription className={resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Enter the address details for delivery
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddressFormSubmit} className="space-y-4 mt-4">
            {/* Label */}
            <div>
              <Label htmlFor="label">Address Label *</Label>
              <Input
                id="label"
                value={addressFormData.label}
                onChange={(e) => setAddressFormData({ ...addressFormData, label: e.target.value })}
                placeholder="e.g., Home, Work, College"
                required
              />
            </div>

            {/* Full Name */}
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={addressFormData.fullName}
                onChange={(e) => setAddressFormData({ ...addressFormData, fullName: e.target.value })}
                placeholder="Enter full name"
                required
              />
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={addressFormData.phoneNumber}
                onChange={(e) => setAddressFormData({ ...addressFormData, phoneNumber: e.target.value })}
                placeholder="Enter phone number"
                required
              />
            </div>

            {/* Address Line 1 */}
            <div>
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Textarea
                id="addressLine1"
                value={addressFormData.addressLine1}
                onChange={(e) => setAddressFormData({ ...addressFormData, addressLine1: e.target.value })}
                placeholder="House/Flat No., Building Name, Street"
                required
                rows={2}
              />
            </div>

            {/* Address Line 2 */}
            <div>
              <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
              <Textarea
                id="addressLine2"
                value={addressFormData.addressLine2}
                onChange={(e) => setAddressFormData({ ...addressFormData, addressLine2: e.target.value })}
                placeholder="Area, Locality"
                rows={2}
              />
            </div>

            {/* City, State, Pincode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={addressFormData.city}
                  onChange={(e) => setAddressFormData({ ...addressFormData, city: e.target.value })}
                  placeholder="Enter city"
                  required
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={addressFormData.state}
                  onChange={(e) => setAddressFormData({ ...addressFormData, state: e.target.value })}
                  placeholder="Enter state"
                  required
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={addressFormData.pincode}
                  onChange={(e) => setAddressFormData({ ...addressFormData, pincode: e.target.value })}
                  placeholder="Enter pincode"
                  required
                />
              </div>
            </div>

            {/* Landmark */}
            <div>
              <Label htmlFor="landmark">Landmark (Optional)</Label>
              <Input
                id="landmark"
                value={addressFormData.landmark}
                onChange={(e) => setAddressFormData({ ...addressFormData, landmark: e.target.value })}
                placeholder="Nearby landmark"
              />
            </div>

            {/* Set as Default */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="isDefault">Set as Default Address</Label>
              <Switch
                id="isDefault"
                checked={addressFormData.isDefault}
                onCheckedChange={(checked) => setAddressFormData({ ...addressFormData, isDefault: checked })}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleFormClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingAddress}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isSubmittingAddress ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Address
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Address Selection Dialog */}
      <Dialog open={open && !showAddressForm} onOpenChange={onClose}>
      <DialogContent className={`max-w-md max-h-[80vh] overflow-y-auto ${
        resolvedTheme === 'dark' ? 'bg-[#31084A] border-gray-800' : 'bg-white'
      }`}>
        <DialogHeader>
          <DialogTitle className={`${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Select Delivery Address
          </DialogTitle>
          <DialogDescription className={resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            Choose an address for delivery or add a new one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading addresses...</div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className={`mb-4 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                No addresses saved yet
              </p>
              <Button onClick={handleCreateNew} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add New Address
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {addresses.map((address) => (
                  <Card
                    key={address.id}
                    className={`cursor-pointer transition-all ${
                      selectedAddressId === address.id
                        ? resolvedTheme === 'dark'
                          ? 'border-red-600 bg-red-600/10'
                          : 'border-red-600 bg-red-50'
                        : resolvedTheme === 'dark'
                        ? 'bg-[#562A6E] border-gray-800 hover:bg-[#724491]'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelect(address)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`font-semibold ${
                              resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {address.label}
                            </h3>
                            {address.isDefault && (
                              <Badge className="bg-red-600 text-white text-xs">Default</Badge>
                            )}
                          </div>

                          <div className={`space-y-1 text-sm ${
                            resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            <p className="font-medium">{address.fullName}</p>
                            <p>{address.phoneNumber}</p>
                            <p>
                              {address.addressLine1}
                              {address.addressLine2 && `, ${address.addressLine2}`}
                            </p>
                            <p>
                              {address.city}, {address.state} - {address.pincode}
                            </p>
                            {address.landmark && (
                              <p className="text-xs">
                                <span className="font-medium">Landmark:</span> {address.landmark}
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedAddressId === address.id && (
                          <div className="ml-4">
                            <Check className="w-6 h-6 text-red-600" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button
                onClick={handleCreateNew}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Address
              </Button>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedAddressId}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Confirm
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

