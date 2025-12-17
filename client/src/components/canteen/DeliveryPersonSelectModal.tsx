import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Truck, User, Phone, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DeliveryPerson {
  id: number;
  deliveryPersonId: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  isAvailable: boolean;
  totalOrderDelivered: number;
}

interface DeliveryPersonSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (deliveryPersonId: string, deliveryPersonEmail: string | null) => void;
  canteenId: string;
  orderNumber: string;
}

export default function DeliveryPersonSelectModal({
  open,
  onClose,
  onSelect,
  canteenId,
  orderNumber,
}: DeliveryPersonSelectModalProps) {
  const [selectedPerson, setSelectedPerson] = useState<DeliveryPerson | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch available delivery persons
  const { data: deliveryPersons, isLoading } = useQuery({
    queryKey: [`/api/canteens/${canteenId}/delivery-persons`],
    queryFn: async () => {
      const response = await apiRequest(`/api/canteens/${canteenId}/delivery-persons`);
      // Filter only available delivery persons
      return (response || []).filter((dp: DeliveryPerson) => dp.isAvailable);
    },
    enabled: open && !!canteenId,
  });

  const handleSelect = (person: DeliveryPerson) => {
    setSelectedPerson(person);
  };

  const handleConfirm = async () => {
    if (!selectedPerson) return;
    
    console.log('🚚 Confirming delivery person selection:', {
      deliveryPersonId: selectedPerson.deliveryPersonId,
      email: selectedPerson.email,
      name: selectedPerson.name,
      orderNumber
    });
    
    setIsConfirming(true);
    try {
      onSelect(selectedPerson.deliveryPersonId, selectedPerson.email);
      onClose();
    } catch (error) {
      console.error("Error selecting delivery person:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    setSelectedPerson(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Truck className="w-5 h-5" />
            Select Delivery Person
          </DialogTitle>
          <DialogDescription className="text-sm">
            Choose a delivery person for order #{orderNumber}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col sm:flex-row items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm sm:text-base">Loading available delivery persons...</span>
          </div>
        ) : !deliveryPersons || deliveryPersons.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm sm:text-base">No available delivery persons found.</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Please ensure there are active delivery persons for this canteen.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 max-h-[50vh] overflow-y-auto">
              {deliveryPersons.map((person: DeliveryPerson) => (
                <Card
                  key={person.id}
                  className={`cursor-pointer transition-all ${
                    selectedPerson?.id === person.id
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => handleSelect(person)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <h3 className="font-semibold text-sm sm:text-base truncate">{person.name}</h3>
                          {selectedPerson?.id === person.id && (
                            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">ID:</span>
                            <span className="truncate">{person.deliveryPersonId}</span>
                          </div>
                          {person.phoneNumber && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{person.phoneNumber}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Truck className="w-3 h-3 flex-shrink-0" />
                            <span>{person.totalOrderDelivered || 0} deliveries</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                disabled={isConfirming}
                className="w-full sm:w-auto h-11 order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!selectedPerson || isConfirming}
                className="w-full sm:w-auto h-11 order-1 sm:order-2"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Assignment
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

