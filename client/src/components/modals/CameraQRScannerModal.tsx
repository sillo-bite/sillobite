import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, SwitchCamera, X, Loader2 } from 'lucide-react';

interface CameraQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when a QR code is successfully decoded */
  onQRScanned: (value: string) => void;
}

type CameraStatus = 'idle' | 'requesting' | 'active' | 'error';

const CameraQRScannerModal: React.FC<CameraQRScannerModalProps> = ({
  isOpen,
  onClose,
  onQRScanned,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<string | null>(null);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [detected, setDetected] = useState(false);

  // ─── helpers ────────────────────────────────────────────────────────────────

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopStream();
    setStatus('requesting');
    setErrorMsg('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMsg('Camera access is not supported on this device or browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('active');
    } catch (err: any) {
      console.error('Camera error:', err);
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No camera found on this device.');
      } else {
        setErrorMsg(`Camera error: ${err.message || err.name}`);
      }
    }
  }, [stopStream]);

  // ─── scan loop ───────────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data && code.data !== lastScanRef.current) {
      lastScanRef.current = code.data;
      setDetected(true);

      // Brief pause so the user sees the "detected" flash, then fire callback
      setTimeout(() => {
        stopStream();
        onQRScanned(code.data);
        onClose();
      }, 300);
      return; // don't schedule another frame
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [onQRScanned, onClose, stopStream]);

  // start scan loop once camera is active
  useEffect(() => {
    if (status === 'active') {
      lastScanRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [status, tick]);

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setDetected(false);
      startCamera(facingMode);
    } else {
      stopStream();
      setStatus('idle');
      setErrorMsg('');
      setDetected(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: intentionally excluding startCamera/stopStream/facingMode to only react to isOpen changes

  const handleFlipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[95vw] max-w-[420px] p-0 overflow-hidden rounded-2xl z-[80]">
        <DialogHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Camera className="h-5 w-5 text-primary" />
            Scan QR Code
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Camera viewport */}
        <div className="relative bg-black" style={{ aspectRatio: '1 / 1' }}>
          {/* Video element */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />

          {/* Hidden canvas for jsQR */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay states */}
          {status === 'requesting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Requesting camera access…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 px-6 text-center">
              <CameraOff className="h-10 w-10 text-red-400" />
              <p className="text-sm font-medium">{errorMsg}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => startCamera(facingMode)}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Detection flash */}
          {detected && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/30 pointer-events-none">
              <div className="bg-green-500 text-white rounded-full px-4 py-2 text-sm font-bold shadow-lg">
                QR Detected!
              </div>
            </div>
          )}

          {/* Viewfinder corners (only when active) */}
          {status === 'active' && !detected && (
            <div className="absolute inset-0 pointer-events-none">
              {/* semi-transparent border overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="relative"
                  style={{ width: '65%', height: '65%' }}
                >
                  {/* corners */}
                  {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                    <span
                      key={c}
                      className="absolute w-6 h-6 border-primary"
                      style={{
                        borderTopWidth: c.startsWith('t') ? 3 : 0,
                        borderBottomWidth: c.startsWith('b') ? 3 : 0,
                        borderLeftWidth: c.endsWith('l') ? 3 : 0,
                        borderRightWidth: c.endsWith('r') ? 3 : 0,
                        top: c.startsWith('t') ? 0 : undefined,
                        bottom: c.startsWith('b') ? 0 : undefined,
                        left: c.endsWith('l') ? 0 : undefined,
                        right: c.endsWith('r') ? 0 : undefined,
                        borderColor: 'hsl(var(--primary))',
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* scanning line */}
              <div className="absolute inset-x-[17.5%] animate-scan-line h-0.5 bg-primary/70 rounded-full" />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-card">
          <p className="text-xs text-muted-foreground">
            {status === 'active'
              ? 'Point camera at the QR code on the order status screen'
              : status === 'requesting'
              ? 'Waiting for camera…'
              : status === 'error'
              ? 'Camera unavailable'
              : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFlipCamera}
            disabled={status !== 'active'}
            className="flex items-center gap-1.5 ml-2 flex-shrink-0"
          >
            <SwitchCamera className="h-4 w-4" />
            Flip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraQRScannerModal;
