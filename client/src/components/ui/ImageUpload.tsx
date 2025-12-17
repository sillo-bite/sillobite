import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Loader2, 
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUpload: (file: File) => Promise<void>;
  onImageRemove: () => Promise<void>;
  onImageChange?: (imageUrl: string) => void;
  disabled?: boolean;
  maxSizeKB?: number;
  className?: string;
}

export default function ImageUpload({
  currentImageUrl,
  onImageUpload,
  onImageRemove,
  onImageChange,
  disabled = false,
  maxSizeKB = 100,
  className = ""
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelect = () => {
    if (disabled || isUploading || isRemoving) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset error state
    setError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB > maxSizeKB) {
      setError(`File size exceeds ${maxSizeKB}KB limit`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Store file locally (no immediate upload)
    try {
      setIsUploading(false); // No uploading state since we're not uploading immediately
      await onImageUpload(file);
      
      } catch (error) {
      console.error('Image selection error:', error);
      setError('Failed to select image');
      } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    if (disabled || isUploading || isRemoving) return;
    
    try {
      setIsRemoving(true);
      await onImageRemove();
      setPreviewUrl(null);
      setError(null);
      
      } catch (error) {
      console.error('Remove error:', error);
      } finally {
      setIsRemoving(false);
    }
  };

  const handleImageClick = () => {
    if (previewUrl && !disabled && !isUploading && !isRemoving) {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading || isRemoving}
      />

      {previewUrl ? (
        <Card className="relative overflow-hidden">
          <CardContent className="p-0">
            <div className="relative group">
              <img
                src={previewUrl}
                alt="Menu item preview"
                className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleImageClick}
              />
              
              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleFileSelect}
                  disabled={disabled || isUploading || isRemoving}
                  className="bg-white/90 hover:bg-white text-black"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isUploading ? 'Uploading...' : 'Change'}
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveImage}
                  disabled={disabled || isUploading || isRemoving}
                  className="bg-red-500/90 hover:bg-red-500 text-white"
                >
                  {isRemoving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  {isRemoving ? 'Removing...' : 'Remove'}
                </Button>
              </div>

              {/* Status indicators */}
              <div className="absolute top-2 right-2">
                {isRemoving && (
                  <div className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Removing
                  </div>
                )}
                {!isRemoving && !error && (
                  <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Selected
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card 
          className={`border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors cursor-pointer ${
            disabled || isUploading || isRemoving ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleFileSelect}
        >
          <CardContent className="flex flex-col items-center justify-center py-8">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Uploading image...</p>
              </>
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-1">Upload Menu Image</p>
                <p className="text-xs text-muted-foreground text-center">
                  Click to select an image (max {maxSizeKB}KB)
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground">
        <p>• Supported formats: JPG, PNG, GIF, WebP</p>
        <p>• Maximum size: {maxSizeKB}KB (will be compressed to 20KB)</p>
        <p>• Image will be uploaded when you save the form</p>
        <p>• Image is optional - you can add it later</p>
      </div>
    </div>
  );
}
