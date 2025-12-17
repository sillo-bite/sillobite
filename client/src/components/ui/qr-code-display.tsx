import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from './button';
import { Download, Copy, Check } from 'lucide-react';

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  showActions?: boolean;
  className?: string;
}

export default function QRCodeDisplay({ 
  url, 
  size = 200, 
  showActions = true, 
  className = "" 
}: QRCodeDisplayProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQRCode();
  }, [url]);

  const generateQRCode = async () => {
    if (!url) return;
    
    setIsGenerating(true);
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: size,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeDataUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.download = `qr-code-${Date.now()}.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  if (isGenerating) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-sm text-muted-foreground">Generating QR Code...</span>
      </div>
    );
  }

  if (!qrCodeDataUrl) {
    return (
      <div className={`flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg ${className}`}>
        <span className="text-sm text-muted-foreground">No QR Code Available</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* QR Code Image */}
      <div className="flex justify-center">
        <div className="p-4 bg-white rounded-lg shadow-sm border">
          <img 
            src={qrCodeDataUrl} 
            alt="QR Code" 
            className="block"
            style={{ width: size, height: size }}
          />
        </div>
      </div>

      {/* URL Display */}
      <div className="text-center">
        <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded break-all">
          {url}
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadQRCode}
            className="flex items-center space-x-1"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="flex items-center space-x-1"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy URL</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
