/**
 * PDF Generator Utility
 * Generate combined PDF from multiple images
 */

import { jsPDF } from 'jspdf';

/**
 * Generate PDF from multiple image data URLs or blobs
 * @param {Array} images - Array of {dataUrl, name} objects
 * @param {Object} options - Options
 * @returns {Promise<Blob>} PDF blob
 */
export async function generatePdfFromImages(images, options = {}) {
    const { title = 'document' } = options;

    if (!images || images.length === 0) {
        throw new Error('No images provided');
    }

    // Create PDF with A4 dimensions
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const maxWidth = pageWidth - (margin * 2);
    const maxHeight = pageHeight - (margin * 2);

    let successCount = 0;

    for (let i = 0; i < images.length; i++) {
        const image = images[i];

        try {
            // Add new page for each image (except first)
            if (successCount > 0) {
                pdf.addPage();
            }

            const imgData = image.dataUrl;

            if (!imgData) {
                console.error(`No data URL for image ${i + 1}`);
                continue;
            }

            // Get image dimensions
            const dimensions = await getImageDimensions(imgData);

            // Calculate dimensions to fit page while maintaining aspect ratio
            let imgWidth = dimensions.width;
            let imgHeight = dimensions.height;

            const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
            imgWidth = imgWidth * ratio;
            imgHeight = imgHeight * ratio;

            // Center image on page
            const x = margin + (maxWidth - imgWidth) / 2;
            const y = margin + (maxHeight - imgHeight) / 2;

            // Add image to PDF
            pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);

            // Add page number footer
            pdf.setFontSize(10);
            pdf.setTextColor(150);
            pdf.text(`${successCount + 1} / ${images.length}`, pageWidth / 2, pageHeight - 5, { align: 'center' });

            successCount++;
            console.log(`📄 Added page ${successCount}/${images.length} to PDF`);
        } catch (error) {
            console.error(`Failed to add image ${i + 1} to PDF:`, error);
        }
    }

    if (successCount === 0) {
        throw new Error('No images could be added to PDF');
    }

    // Return as blob
    const pdfBlob = pdf.output('blob');
    console.log(`✅ PDF generated: ${successCount} pages, ${formatBytes(pdfBlob.size)}`);

    return pdfBlob;
}

/**
 * Get image dimensions from base64 data URL
 */
function getImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = dataUrl;
    });
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Compress image using canvas
 * @param {File} file - Image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<{dataUrl: string, originalSize: number, compressedSize: number}>}
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = 1600,
        maxHeight = 1600,
        quality = 0.75,
        maxSizeKB = 500
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                // Only resize if image is larger than max dimensions
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Get compressed data URL
                const dataUrl = canvas.toDataURL('image/jpeg', quality);

                // Calculate compressed size (approximate from base64)
                const base64Length = dataUrl.length - 'data:image/jpeg;base64,'.length;
                const compressedSize = Math.round(base64Length * 0.75);

                resolve({
                    dataUrl,
                    originalSize: file.size,
                    compressedSize,
                    wasCompressed: file.size > maxSizeKB * 1024
                });
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}
