import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

// Helper function to create the cropped image
async function createCroppedImg(
    imageSrc: string,
    pixelCrop: Area
): Promise<Blob | null> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return null;
    }

    // set canvas width to final desired crop size - this will force browser to resize the
    // result so it's not simply a crop of the original image
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // draw cropped image onto canvas
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.95);
    });
}

const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues on CodeSandbox
        image.src = url;
    });

interface ImageCropperProps {
    imageSrc: string | null;
    isOpen: boolean;
    onClose: () => void;
    onCropComplete: (croppedImageBlob: Blob) => void;
    aspect?: number;
}

export function ImageCropper({
    imageSrc,
    isOpen,
    onClose,
    onCropComplete,
    aspect = 16 / 9, // Default aspect ratio
}: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = useCallback(
        (croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        []
    );

    const handleSave = async () => {
        if (imageSrc && croppedAreaPixels) {
            try {
                setIsLoading(true);
                const croppedImage = await createCroppedImg(imageSrc, croppedAreaPixels);
                if (croppedImage) {
                    onCropComplete(croppedImage);
                    onClose(); // Close after successful crop
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Crop Image</DialogTitle>
                    <DialogDescription className="sr-only">
                        Adjust the cropping area to frame your image perfectly.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative w-full h-[300px] bg-black rounded-md overflow-hidden my-4">
                    {imageSrc && (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            onCropChange={onCropChange}
                            onCropComplete={onCropCompleteHandler}
                            onZoomChange={onZoomChange}
                        />
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <ZoomOut className="w-4 h-4 text-muted-foreground" />
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(value) => setZoom(value[0])}
                            className="flex-1"
                        />
                        <ZoomIn className="w-4 h-4 text-muted-foreground" />
                    </div>
                </div>

                <DialogFooter className="flex sm:justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? (
                            <span className="animate-spin mr-2">⏳</span>
                        ) : (
                            <Check className="w-4 h-4 mr-2" />
                        )}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
