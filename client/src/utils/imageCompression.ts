/**
 * Compress an image file to a target size using HTML Canvas
 * @param file - Input file
 * @param targetSizeKB - Target size in KB (default: 20)
 * @param maxWidth - Maximum width (default: 800)
 * @param maxHeight - Maximum height (default: 800)
 * @returns Compressed Blob or null if compression fails
 */
export async function compressImage(
    file: File,
    targetSizeKB: number = 20,
    maxWidth: number = 800,
    maxHeight: number = 800,
    outputType: string = 'image/webp'
): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
        // If file is already small enough, return it (convert to blob)
        if (file.size <= targetSizeKB * 1024 && file.type === outputType) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Maintain aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Binary search for quality
                let minQuality = 0.1;
                let maxQuality = 0.9;
                let quality = 0.7;
                let bestBlob: Blob | null = null;
                let bestSize = Infinity;


                const attemptCompression = (q: number) => {
                    canvas.toBlob(
                        (b) => {
                            if (!b) {
                                reject(new Error('Compression failed'));
                                return;
                            }

                            // Keep track of the best blob we've found
                            if (b.size < bestSize) {
                                bestSize = b.size;
                                bestBlob = b;
                            }

                            // If we met the target or hit minimum quality, return the best blob
                            if (b.size <= targetSizeKB * 1024 || q <= 0.1) {
                                resolve(bestBlob || b);
                            } else {
                                // Try lower quality
                                attemptCompression(Math.max(0.1, q - 0.1));
                            }
                        },
                        outputType, // Prefer WebP for transparency & compression
                        q
                    );
                };

                attemptCompression(quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}
