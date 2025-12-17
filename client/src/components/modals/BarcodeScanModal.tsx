import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Search, AlertTriangle } from 'lucide-react';

interface BarcodeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  onBack?: () => void;
  title?: string;
}

const BarcodeScanModal: React.FC<BarcodeScanModalProps> = ({
  isOpen,
  onClose,
  onBarcodeScanned,
  onBack,
  title = "Scan Barcode"
}) => {
  const [barcode, setBarcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setIsLoading(true);
    try {
      await onBarcodeScanned(barcode.trim());
      setBarcode('');
      onClose();
    } catch (error) {
      console.error('Error processing barcode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[500px] p-4 sm:p-6 z-[60] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center text-lg sm:text-xl font-bold text-gray-900">
            <QrCode className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Barcode Input Section */}
          <div className="space-y-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800">Enter Barcode</h3>
            <div className="space-y-2">
              <Label htmlFor="barcode" className="text-sm font-medium text-gray-700">
                Barcode
              </Label>
              <Input
                id="barcode"
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter barcode and press Enter..."
                className="w-full text-base border-red-200 focus:border-red-400 focus:ring-red-400 h-12"
                autoFocus
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Instructions */}
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <AlertDescription className="text-yellow-800 text-sm">
              <div className="font-semibold mb-1">Instructions</div>
              <div>
                Enter the barcode and press <span className="bg-yellow-200 px-1 rounded font-semibold">Enter</span> to find the order.
              </div>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
            <div className="w-full sm:w-auto">
              {onBack && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onBack}
                  disabled={isLoading}
                  className="w-full sm:w-auto text-gray-600 hover:text-gray-800 h-11"
                >
                  ← Back to Order
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="w-full sm:w-auto h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!barcode.trim() || isLoading}
                className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white h-11"
              >
                <Search className="h-4 w-4 mr-2" />
                {isLoading ? 'Finding...' : 'Find Order'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanModal;
