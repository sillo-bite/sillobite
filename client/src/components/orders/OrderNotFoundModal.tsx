import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle } from 'lucide-react';

interface OrderNotFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedBarcode: string;
}

const OrderNotFoundModal: React.FC<OrderNotFoundModalProps> = ({
  isOpen,
  onClose,
  scannedBarcode
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[500px] p-4 sm:p-6 z-[70] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center text-lg sm:text-xl font-bold text-gray-900">
            <XCircle className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
            Order Not Found
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Error Message */}
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <AlertDescription className="text-red-800 text-sm">
              <div className="font-semibold mb-2">Barcode Mismatch</div>
              <div className="break-words">
                The scanned barcode <span className="font-mono bg-red-100 px-1 rounded text-xs sm:text-sm">"{scannedBarcode}"</span> does not match the order's barcode.
              </div>
            </AlertDescription>
          </Alert>

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
            <div className="text-sm text-yellow-800">
              <div className="font-semibold mb-2">Please check:</div>
              <ul className="list-disc list-inside space-y-1.5">
                <li>Make sure you're scanning the correct order</li>
                <li>Verify the barcode is clearly visible</li>
                <li>Try scanning again</li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={onClose}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white h-11"
            >
              Try Again
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderNotFoundModal;
