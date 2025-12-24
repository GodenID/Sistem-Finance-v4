import React, { useState } from 'react';
import { X, Download, FileText, Image as ImageIcon, File, Loader2 } from 'lucide-react';

const FilePreview = ({ fileUrl, fileName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine file type
  const getFileType = (url, name) => {
    const lowerUrl = url?.toLowerCase() || '';
    const lowerName = name?.toLowerCase() || '';
    
    if (lowerUrl.includes('.pdf') || lowerName.endsWith('.pdf')) {
      return 'pdf';
    }
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)$/) || lowerName.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return 'image';
    }
    if (lowerUrl.match(/\.(doc|docx)$/) || lowerName.match(/\.(doc|docx)$/)) {
      return 'word';
    }
    if (lowerUrl.match(/\.(xls|xlsx)$/) || lowerName.match(/\.(xls|xlsx)$/)) {
      return 'excel';
    }
    return 'other';
  };

  const fileType = getFileType(fileUrl, fileName);
  const displayName = fileName || fileUrl?.split('/').pop() || 'File';

  const handleDownload = async () => {
    try {
      // Jika fileUrl adalah URL lengkap, gunakan langsung
      if (fileUrl && fileUrl.startsWith('http')) {
        // Coba download langsung
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = displayName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Fallback: buka di tab baru
        window.open(fileUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback: buka di tab baru
      window.open(fileUrl, '_blank');
    }
  };

  const renderPreview = () => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            {fileUrl && fileUrl.startsWith('http') ? (
              <iframe
                src={fileUrl}
                className="w-full h-full border-0"
                title={displayName}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Gagal memuat PDF. Silakan coba download file.');
                }}
              />
            ) : (
              <div className="text-center p-8">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">URL file tidak valid</p>
                <p className="text-sm text-gray-500">{fileUrl}</p>
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 p-4">
            {fileUrl && fileUrl.startsWith('http') ? (
              <img
                src={fileUrl}
                alt={displayName}
                className="max-w-full max-h-full object-contain"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Gagal memuat gambar. Silakan coba download file.');
                }}
              />
            ) : (
              <div className="text-center p-8">
                <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">URL gambar tidak valid</p>
                <p className="text-sm text-gray-500">{fileUrl}</p>
              </div>
            )}
          </div>
        );

      case 'word':
      case 'excel':
      case 'other':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 p-8">
            <div className="text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {fileType === 'word' || fileType === 'excel' ? (
                  <FileText className="w-12 h-12 text-blue-600" />
                ) : (
                  <File className="w-12 h-12 text-blue-600" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{displayName}</h3>
              <p className="text-gray-600 mb-6">
                {fileType === 'word' && 'Dokumen Word tidak dapat di-preview langsung'}
                {fileType === 'excel' && 'Dokumen Excel tidak dapat di-preview langsung'}
                {fileType === 'other' && 'File tidak dapat di-preview langsung'}
              </p>
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
              >
                <Download className="w-5 h-5" />
                <span>Download File</span>
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Preview tidak tersedia untuk file ini</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              {fileType === 'pdf' ? (
                <FileText className="w-6 h-6 text-white" />
              ) : fileType === 'image' ? (
                <ImageIcon className="w-6 h-6 text-white" />
              ) : (
                <File className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Preview File</h2>
              <p className="text-sm text-white/80 mt-1 truncate max-w-md">{displayName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Tutup"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden relative">
          {loading && fileType !== 'word' && fileType !== 'excel' && fileType !== 'other' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-gray-600">Memuat file...</p>
              </div>
            </div>
          )}
          {error ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <FileText className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download File
                </button>
              </div>
            </div>
          ) : (
            renderPreview()
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreview;

