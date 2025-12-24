import React, { useState, useRef, useEffect } from 'react';
import { Upload, Clipboard, FileText, X, Image } from 'lucide-react';

const PasteUpload = ({ 
  onFileSelect, 
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSize = 10, // MB
  placeholder = 'Paste screenshot atau pilih file'
}) => {
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteFocused, setIsPasteFocused] = useState(false);
  const fileInputRef = useRef(null);
  const pasteAreaRef = useRef(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Handle paste event
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Create named file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = file.type.split('/')[1] || 'png';
            const namedFile = new File(
              [file], 
              `screenshot-${timestamp}.${extension}`, 
              { type: file.type }
            );
            
            handleFile(namedFile);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleFile = (file) => {
    // Validate size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File terlalu besar. Maksimal ${maxSize}MB`);
      return;
    }

    // Set preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(url);
    } else {
      setPreview(null);
    }

    setFileName(file.name);
    onFileSelect(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName('');
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isImage = fileName && (
    fileName.endsWith('.jpg') || 
    fileName.endsWith('.jpeg') || 
    fileName.endsWith('.png') || 
    fileName.endsWith('.gif')
  );

  return (
    <div className="space-y-3">
      {/* Paste/Drop Area */}
      <div
        ref={pasteAreaRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onFocus={() => setIsPasteFocused(true)}
        onBlur={() => setIsPasteFocused(false)}
        tabIndex={0}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : isPasteFocused
              ? 'border-blue-400 bg-blue-50/50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept={accept}
          className="hidden"
        />

        {!fileName ? (
          <div className="space-y-3">
            {/* Paste Icon & Text */}
            <div className="flex justify-center">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                <Clipboard className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Paste Screenshot di sini
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tekan <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-xs">V</kbd> untuk paste
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 px-4">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400">atau</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* File Upload */}
            <div className="flex justify-center">
              <div className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Pilih file dari komputer</span>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              PDF, JPG, PNG (Maks. {maxSize}MB)
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Preview or File Icon */}
            {preview ? (
              <div className="relative inline-block">
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="max-h-40 max-w-full rounded-lg shadow-md mx-auto"
                />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="p-3 bg-green-100 rounded-xl">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
              </div>
            )}
            
            <p className="text-sm font-medium text-gray-800 truncate max-w-xs mx-auto">
              {fileName}
            </p>
            <p className="text-xs text-blue-600 hover:text-blue-700">
              Klik untuk ganti file
            </p>
          </div>
        )}
      </div>

      {/* Clear Button */}
      {fileName && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clearFile();
          }}
          className="w-full flex items-center justify-center space-x-2 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          <span>Hapus file</span>
        </button>
      )}

      {/* Hint */}
      {!fileName && (
        <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
          <Image className="w-3.5 h-3.5" />
          <span>Tip: Screenshot lalu langsung Ctrl+V di sini</span>
        </div>
      )}
    </div>
  );
};

export default PasteUpload;
