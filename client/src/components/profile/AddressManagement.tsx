import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Check } from "lucide-react";
import { useTheme } from '@/contexts/ThemeContext';
import AddressForm from "./AddressForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface AddressManagementProps {
  userId: number;
  onBack: () => void;
}

export default function AddressManagement({ userId, onBack }: AddressManagementProps) {
  const { resolvedTheme } = useTheme();
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteAddressId, setDeleteAddressId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch addresses
  const { data: addresses = [], isLoading } = useQuery<Address[]>({
    queryKey: ['/api/addresses', userId],
    queryFn: async () => {
      const response = await fetch(`/api/addresses?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch addresses');
      return response.json();
    },
  });

  const handleAddNew = () => {
    setEditingAddress(null);
    setShowForm(true);
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setShowForm(true);
  };

  const handleDelete = async (addressId: string) => {
    try {
      const response = await fetch(`/api/addresses/${addressId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete address');

      // Invalidate and refetch addresses
      queryClient.invalidateQueries({ queryKey: ['/api/addresses', userId] });
      setDeleteAddressId(null);
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Failed to delete address. Please try again.');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAddress(null);
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/addresses', userId] });
    handleFormClose();
  };

  if (showForm) {
    return (
      <AddressForm
        userId={userId}
        address={editingAddress || undefined}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    );
  }

  return (
    <div className={`min-h-screen overflow-x-hidden ${
      resolvedTheme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className="relative bg-red-600 px-4 pt-12 pb-6 rounded-b-2xl">
        <div className="relative z-10 flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 transition-all duration-200 rounded-full"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white tracking-tight">My Addresses</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* Add New Address Button */}
        <Button
          onClick={handleAddNew}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add New Address
        </Button>

        {/* Addresses List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading addresses...</div>
        ) : addresses.length === 0 ? (
          <Card className={`${
            resolvedTheme === 'dark'
              ? 'bg-black border border-gray-800 shadow-sm'
              : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            <CardContent className="p-8 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No addresses saved yet</p>
              <Button onClick={handleAddNew} variant="outline">
                Add Your First Address
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <Card
                key={address.id}
                className={`${
                  resolvedTheme === 'dark'
                    ? 'bg-black border border-gray-800 shadow-sm'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{address.label}</h3>
                      {address.isDefault && (
                        <Badge className="bg-red-600 text-white">Default</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(address)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => setDeleteAddressId(address.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{address.fullName}</p>
                    <p className="text-muted-foreground">{address.phoneNumber}</p>
                    <p className="text-muted-foreground">
                      {address.addressLine1}
                      {address.addressLine2 && `, ${address.addressLine2}`}
                    </p>
                    <p className="text-muted-foreground">
                      {address.city}, {address.state} - {address.pincode}
                    </p>
                    {address.landmark && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Landmark:</span> {address.landmark}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAddressId} onOpenChange={(open) => !open && setDeleteAddressId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAddressId && handleDelete(deleteAddressId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}












