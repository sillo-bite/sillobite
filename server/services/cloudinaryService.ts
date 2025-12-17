import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface ImageUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export class CloudinaryService {
  constructor() {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.warn('⚠️ Cloudinary credentials not configured. Image uploads will fail.');
    }
  }

  /**
   * Compress image to target size (in bytes) while preserving format and transparency
   * @param buffer - Image buffer
   * @param targetSizeBytes - Target size in bytes (default: 2MB)
   * @returns Compressed image buffer
   */
  private async compressImage(buffer: Buffer, targetSizeBytes: number = 2 * 1024 * 1024): Promise<{ buffer: Buffer; format: string; mimeType: string }> {
    const metadata = await sharp(buffer).metadata();
    const originalFormat = metadata.format || 'jpeg';
    const hasAlpha = metadata.hasAlpha || false;
    
    // Determine the best format to preserve transparency
    const outputFormat = hasAlpha ? 'png' : originalFormat;
    const mimeType = hasAlpha ? 'image/png' : `image/${originalFormat}`;
    
    let quality = 80;
    let compressedBuffer = buffer;
    
    // Try different quality levels until we reach target size
    while (compressedBuffer.length > targetSizeBytes && quality > 10) {
      quality -= 10;
      
      if (hasAlpha) {
        // For PNG with transparency, use PNG compression
        compressedBuffer = await sharp(buffer)
          .png({ quality, compressionLevel: 9 })
          .toBuffer();
      } else {
        // For images without transparency, use JPEG
        compressedBuffer = await sharp(buffer)
          .jpeg({ quality, progressive: true })
          .toBuffer();
      }
    }
    
    // If still too large, resize the image
    if (compressedBuffer.length > targetSizeBytes) {
      const aspectRatio = metadata.width! / metadata.height!;
      let newWidth = metadata.width!;
      let newHeight = metadata.height!;
      
      // Reduce dimensions while maintaining aspect ratio
      while (compressedBuffer.length > targetSizeBytes && newWidth > 100) {
        newWidth = Math.floor(newWidth * 0.8);
        newHeight = Math.floor(newWidth / aspectRatio);
        
        if (hasAlpha) {
          // For PNG with transparency, use PNG compression
          compressedBuffer = await sharp(buffer)
            .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
            .png({ quality: 70, compressionLevel: 9 })
            .toBuffer();
        } else {
          // For images without transparency, use JPEG
          compressedBuffer = await sharp(buffer)
            .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70, progressive: true })
            .toBuffer();
        }
      }
    }
    
    return { buffer: compressedBuffer, format: outputFormat, mimeType };
  }

  /**
   * Upload image to Cloudinary with compression while preserving format and transparency
   * @param fileBuffer - Image file buffer
   * @param folder - Cloudinary folder path
   * @param publicId - Public ID for the image (optional)
   * @param maxSizeBytes - Maximum size in bytes (default: 2MB)
   * @returns Upload result
   */
  async uploadImage(
    fileBuffer: Buffer,
    folder: string = 'menu-items',
    publicId?: string,
    maxSizeBytes: number = 2 * 1024 * 1024
  ): Promise<ImageUploadResult> {
    try {
      // Check if Cloudinary is configured
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
      }

      // Validate file size (client-side limit: 50MB)
      if (fileBuffer.length > 50 * 1024 * 1024) {
        throw new Error('File size exceeds 50MB limit');
      }

      // Compress image to target size while preserving format and transparency
      const { buffer: compressedBuffer, format, mimeType } = await this.compressImage(fileBuffer, maxSizeBytes);
      
      // Upload to Cloudinary with proper format
      const result = await cloudinary.uploader.upload(
        `data:${mimeType};base64,${compressedBuffer.toString('base64')}`,
        {
          folder,
          public_id: publicId,
          resource_type: 'image',
          quality: 'auto',
          fetch_format: 'auto',
          // Only apply transformations that preserve transparency
          transformation: format === 'png' ? [
            { width: 800, height: 600, crop: 'limit' },
            { quality: 'auto' },
            { flags: 'lossy' } // Allow lossy compression for PNG if needed
          ] : [
            { width: 800, height: 600, crop: 'limit' },
            { quality: 'auto' }
          ]
        }
      );

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete image from Cloudinary
   * @param publicId - Public ID of the image to delete
   * @returns Deletion result
   */
  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return false;
    }
  }

  /**
   * Get optimized image URL with transformations
   * @param publicId - Public ID of the image
   * @param transformations - Cloudinary transformations
   * @returns Optimized image URL
   */
  getOptimizedImageUrl(
    publicId: string,
    transformations: Record<string, any> = {}
  ): string {
    return cloudinary.url(publicId, {
      ...transformations,
      quality: 'auto',
      fetch_format: 'auto'
    });
  }
}

export const cloudinaryService = new CloudinaryService();
