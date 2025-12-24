/**
 * Image Compression Utility
 * Compress images client-side before upload
 * Target: 1600px max width, 75% quality, ~200-500KB output
 */

/**
 * Compress an image file
 * @param {File} file - Original image file
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width in pixels (default: 1600)
 * @param {number} options.maxHeight - Maximum height in pixels (default: 1600)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.75)
 * @param {number} options.maxSizeKB - Target max size in KB (default: 500)
 * @returns {Promise<{file: File, originalSize: number, compressedSize: number, wasCompressed: boolean}>}
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = 1600,
        maxHeight = 1600,
        quality = 0.75,
        maxSizeKB = 500
    } = options;

    const originalSize = file.size;

    // Skip compression for non-image files
    if (!file.type.startsWith('image/')) {
        return {
            file,
            originalSize,
            compressedSize: originalSize,
            wasCompressed: false
        };
    }

    // Skip if already small enough (under maxSizeKB)
    if (file.size <= maxSizeKB * 1024) {
        return {
            file,
            originalSize,
            compressedSize: originalSize,
            wasCompressed: false
        };
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            try {
                // Calculate new dimensions
                let { width, height } = img;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;

                // Draw image with white background (for transparency)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        // Create new file with compressed blob
                        const compressedFile = new File(
                            [blob],
                            file.name.replace(/\.(png|gif|webp|heic|heif)$/i, '.jpg'),
                            { type: 'image/jpeg' }
                        );

                        console.log(`🗜️ Image compressed: ${formatBytes(originalSize)} → ${formatBytes(blob.size)} (${Math.round((1 - blob.size / originalSize) * 100)}% reduced)`);

                        resolve({
                            file: compressedFile,
                            originalSize,
                            compressedSize: blob.size,
                            wasCompressed: true
                        });
                    },
                    'image/jpeg',
                    quality
                );
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for compression'));
        };

        // Load image from file
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Format bytes to human readable string
 * @param {number} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file is an image
 * @param {File} file 
 * @returns {boolean}
 */
export function isImageFile(file) {
    return file.type.startsWith('image/');
}
