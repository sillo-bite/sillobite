import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

export default function BarcodeDisplay({ 
  value, 
  width = 2, 
  height = 100, 
  displayValue = true,
  className = "" 
}: BarcodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: "CODE128",
          width: width,
          height: height,
          displayValue: displayValue,
          fontSize: 14,
          textAlign: "center",
          textPosition: "bottom",
          background: "#ffffff",
          lineColor: "#1a1a1a",
          margin: 10
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [value, width, height, displayValue]);

  if (!value) {
    return (
      <div className={`flex items-center justify-center p-4 border rounded ${className}`}>
        <span className="text-muted-foreground">No barcode available</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <canvas ref={canvasRef} className="border rounded" />
      {displayValue && (
        <span className="text-xs text-muted-foreground font-mono">{value}</span>
      )}
    </div>
  );
}