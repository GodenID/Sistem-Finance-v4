
import React from 'react';

const PageLoading = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 font-medium">Memuat...</p>
        </div>
    );
};

export default PageLoading;
