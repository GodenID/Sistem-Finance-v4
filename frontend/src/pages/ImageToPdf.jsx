import React, { useState, useCallback } from 'react';
import { Upload, FileImage, Trash2, Download, Image, GripVertical, FileText, Loader2, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { generatePdfFromImages, compressImage, formatBytes } from '../utils/pdfGenerator';

const ImageToPdf = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [images, setImages] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);

    // Handle file selection
    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        await processFiles(files);
        e.target.value = '';
    };

    // Handle drag and drop
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            await processFiles(files);
        }
    }, []);

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    // Process uploaded files
    const processFiles = async (files) => {
        if (images.length + files.length > 20) {
            showToast('Maksimal 20 gambar', 'error');
            return;
        }

        setIsProcessing(true);
        setProgress(0);

        const newImages = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!file.type.startsWith('image/')) {
                showToast(`${file.name} bukan gambar`, 'error');
                continue;
            }

            try {
                // Compress image if needed
                const result = await compressImage(file, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    quality: 0.75,
                    maxSizeKB: 500
                });

                newImages.push({
                    id: Date.now() + i,
                    name: file.name,
                    dataUrl: result.dataUrl,
                    originalSize: result.originalSize,
                    compressedSize: result.compressedSize,
                    wasCompressed: result.wasCompressed
                });

                setProgress(Math.round(((i + 1) / files.length) * 100));
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showToast(`Gagal memproses ${file.name}`, 'error');
            }
        }

        setImages(prev => [...prev, ...newImages]);
        setIsProcessing(false);
        setProgress(0);

        if (newImages.length > 0) {
            showToast(`${newImages.length} gambar berhasil ditambahkan`, 'success');
        }
    };

    // Remove image
    const removeImage = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    // Clear all images
    const clearAll = () => {
        setImages([]);
    };

    // Generate PDF
    const handleGeneratePdf = async () => {
        if (images.length === 0) {
            showToast('Tambahkan gambar terlebih dahulu', 'error');
            return;
        }

        setIsProcessing(true);
        setProgress(0);

        try {
            showToast('Membuat PDF...', 'info');

            const pdfBlob = await generatePdfFromImages(images, {
                title: `combined-${Date.now()}`
            });

            // Download PDF
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `combined-images-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast(`PDF berhasil dibuat (${formatBytes(pdfBlob.size)})`, 'success');
        } catch (error) {
            console.error('Error generating PDF:', error);
            showToast('Gagal membuat PDF: ' + error.message, 'error');
        } finally {
            setIsProcessing(false);
            setProgress(0);
        }
    };

    // Calculate total sizes
    const totalOriginalSize = images.reduce((sum, img) => sum + img.originalSize, 0);
    const totalCompressedSize = images.reduce((sum, img) => sum + img.compressedSize, 0);
    const savedSize = totalOriginalSize - totalCompressedSize;

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Image to PDF</h1>
                    <p className="text-sm text-gray-600 mt-1">Gabungkan beberapa gambar menjadi 1 file PDF</p>
                </div>
            </div>

            {/* Upload Area */}
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${dragOver
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-300 hover:border-violet-400 hover:bg-gray-50'
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                />
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-4">
                        <Upload className={`w-8 h-8 text-violet-600 ${isProcessing ? 'animate-pulse' : ''}`} />
                    </div>
                    <p className="text-lg font-semibold text-gray-700 mb-1">
                        {isProcessing ? 'Memproses gambar...' : 'Drag & drop gambar di sini'}
                    </p>
                    <p className="text-sm text-gray-500">atau klik untuk memilih file</p>
                    <p className="text-xs text-gray-400 mt-2">Mendukung: JPG, PNG, GIF, WebP (Max 20 gambar)</p>
                </div>

                {/* Processing Progress */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="w-10 h-10 text-violet-600 animate-spin mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-700">Memproses... {progress}%</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Image List */}
            {images.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* List Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center space-x-3">
                            <FileImage className="w-5 h-5 text-violet-600" />
                            <span className="font-semibold text-gray-700">{images.length} Gambar</span>
                            {savedSize > 0 && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                    Hemat {formatBytes(savedSize)}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={clearAll}
                            className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center space-x-1"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Hapus Semua</span>
                        </button>
                    </div>

                    {/* Image Grid */}
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {images.map((image, index) => (
                            <div key={image.id} className="relative group">
                                <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                    <img
                                        src={image.dataUrl}
                                        alt={image.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Page Number Badge */}
                                <div className="absolute top-2 left-2 w-6 h-6 bg-gray-800/70 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                    {index + 1}
                                </div>

                                {/* Compression Badge */}
                                {image.wasCompressed && (
                                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-violet-600 text-white text-[10px] font-medium rounded">
                                        🗜️ {formatBytes(image.compressedSize)}
                                    </div>
                                )}

                                {/* Remove Button */}
                                <button
                                    onClick={() => removeImage(image.id)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    title="Hapus"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Size Info */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="text-sm text-gray-600">
                                <span className="font-medium">Total: </span>
                                <span className="text-gray-500 line-through mr-2">{formatBytes(totalOriginalSize)}</span>
                                <span className="font-semibold text-violet-700">{formatBytes(totalCompressedSize)}</span>
                            </div>
                            <button
                                onClick={handleGeneratePdf}
                                disabled={isProcessing || images.length === 0}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-lg font-medium hover:from-violet-700 hover:to-violet-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Membuat PDF...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" />
                                        <span>Download PDF</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {images.length === 0 && !isProcessing && (
                <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">Belum ada gambar</h3>
                    <p className="text-sm text-gray-500">Upload gambar untuk memulai</p>
                </div>
            )}

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-6 border border-violet-200">
                <h3 className="font-semibold text-violet-800 mb-3">💡 Tips</h3>
                <ul className="space-y-2 text-sm text-violet-700">
                    <li>• Gambar akan otomatis dikompresi jika ukuran lebih dari 500KB</li>
                    <li>• Urutan gambar di preview adalah urutan di PDF</li>
                    <li>• Maksimal 20 gambar per PDF</li>
                    <li>• Hasil PDF ukuran A4 dengan gambar di tengah halaman</li>
                </ul>
            </div>
        </div>
    );
};

export default ImageToPdf;
