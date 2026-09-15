import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Paperclip, Image, File, AlertCircle } from 'lucide-react';

/**
 * MultiFileUpload Component
 * Supports multiple file selection and drag & drop
 */
const MultiFileUpload = ({
    files = [],
    onFilesChange,
    accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx',
    maxSize = 10, // MB per file
    maxFiles = 10,
    uploading = false,
    uploadProgress = {},
    accentColor = 'primary', // 'primary' | 'violet' | 'blue'
    required = false,
    disabled = false
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    // Color classes based on accent
    const colorClasses = {
        primary: {
            border: 'border-primary-500',
            bg: 'bg-primary-50',
            text: 'text-primary-600',
            hover: 'hover:border-primary-400',
            ring: 'focus:ring-primary-500'
        },
        violet: {
            border: 'border-violet-500',
            bg: 'bg-violet-50',
            text: 'text-violet-600',
            hover: 'hover:border-violet-400',
            ring: 'focus:ring-violet-500'
        },
        blue: {
            border: 'border-blue-500',
            bg: 'bg-blue-50',
            text: 'text-blue-600',
            hover: 'hover:border-blue-400',
            ring: 'focus:ring-blue-500'
        }
    };

    const colors = colorClasses[accentColor] || colorClasses.primary;

    // Get file icon based on extension
    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (imageExts.includes(ext)) {
            return <Image className="w-5 h-5 text-blue-500" />;
        }
        return <File className="w-5 h-5 text-gray-500" />;
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Validate and add files
    const handleFiles = useCallback((newFiles) => {
        setError('');
        const validFiles = [];
        const fileArray = Array.from(newFiles);

        // Check total file count
        if (files.length + fileArray.length > maxFiles) {
            setError(`Maksimal ${maxFiles} file dapat diupload`);
            return;
        }

        for (const file of fileArray) {
            // Check file size
            if (file.size > maxSize * 1024 * 1024) {
                setError(`File "${file.name}" terlalu besar. Maksimal ${maxSize}MB per file`);
                continue;
            }

            // Check if file already exists
            const exists = files.some(f => f.name === file.name && f.size === file.size);
            if (exists) {
                continue;
            }

            validFiles.push(file);
        }

        if (validFiles.length > 0) {
            onFilesChange([...files, ...validFiles]);
        }
    }, [files, maxFiles, maxSize, onFilesChange]);

    // Handle file input change
    const handleInputChange = (e) => {
        if (e.target.files?.length > 0) {
            handleFiles(e.target.files);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    // Handle drag events
    const handleDragOver = (e) => {
        e.preventDefault();
        if (!disabled && !uploading) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled && !uploading && e.dataTransfer.files?.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    // Remove a file
    const removeFile = (index) => {
        if (disabled || uploading) return;
        const newFiles = files.filter((_, i) => i !== index);
        onFilesChange(newFiles);
        setError('');
    };

    // Open file picker
    const openFilePicker = () => {
        if (!disabled && !uploading) {
            fileInputRef.current?.click();
        }
    };

    return (
        <div className="space-y-3">
            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openFilePicker}
                className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer
          ${disabled || uploading ? 'cursor-not-allowed opacity-60' : ''}
          ${isDragging
                        ? `${colors.border} ${colors.bg}`
                        : `border-gray-300 ${colors.hover} hover:bg-gray-50`
                    }
        `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleInputChange}
                    accept={accept}
                    multiple
                    className="hidden"
                    disabled={disabled || uploading}
                />

                <div className="space-y-3">
                    {/* Upload Icon */}
                    <div className="flex justify-center">
                        <div className={`p-3 ${colors.bg} rounded-xl`}>
                            <Upload className={`w-8 h-8 ${colors.text}`} />
                        </div>
                    </div>

                    {/* Instructions */}
                    <div>
                        <p className="text-sm font-semibold text-gray-700">
                            Drag & drop file di sini
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            atau klik untuk memilih file
                        </p>
                    </div>

                    {/* File info */}
                    <p className="text-xs text-gray-400">
                        {accept.replace(/\./g, '').toUpperCase().split(',').join(', ')} • Maks. {maxSize}MB per file • Maks. {maxFiles} file
                    </p>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                        {files.length} file dipilih
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {files.map((file, index) => {
                            const progress = uploadProgress[file.name];
                            const isUploading = progress !== undefined && progress < 100;
                            const isComplete = progress === 100;

                            return (
                                <div
                                    key={`${file.name}-${index}`}
                                    className={`
                    flex items-center gap-3 p-3 rounded-lg border transition-colors
                    ${isComplete ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}
                  `}
                                >
                                    {/* File Icon */}
                                    <div className="flex-shrink-0">
                                        {getFileIcon(file.name)}
                                    </div>

                                    {/* File Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                            {file.name}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">
                                                {formatFileSize(file.size)}
                                            </span>
                                            {isUploading && (
                                                <span className={`text-xs ${colors.text}`}>
                                                    Mengupload... {progress}%
                                                </span>
                                            )}
                                            {isComplete && (
                                                <span className="text-xs text-green-600">
                                                    ✓ Selesai
                                                </span>
                                            )}
                                        </div>

                                        {/* Progress Bar */}
                                        {isUploading && (
                                            <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${colors.bg.replace('50', '500')} transition-all duration-300`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Remove Button */}
                                    {!uploading && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFile(index);
                                            }}
                                            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Hapus file"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiFileUpload;
