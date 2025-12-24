import React from 'react';
import { X, Building2, Info } from 'lucide-react';
import { COMPANY_IDS, getColorsByTipe } from '../constants/companyTypes';

const CompanyInfoModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 p-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Informasi Perusahaan</h3>
              <p className="text-primary-100 text-sm">Prasasti Group</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Kode Identifikasi Perusahaan</h4>
              <p className="text-sm text-blue-700">
                Setiap perusahaan memiliki kode ID unik yang digunakan dalam semua transaksi. 
                Gunakan kode ini untuk mempermudah identifikasi perusahaan.
              </p>
            </div>
          </div>

          {/* Company Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMPANY_IDS.map((company, index) => {
              const colors = getColorsByTipe(company.tipe);
              return (
                <div
                  key={company.id}
                  className={`border-2 ${colors.borderColor} ${colors.bgColor} rounded-xl p-5 hover:shadow-lg transition-shadow`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`px-4 py-2 ${colors.darkColor} rounded-lg`}>
                      <span className="text-white font-bold text-lg">{company.id}</span>
                    </div>
                    <div className={`w-10 h-10 ${colors.darkColor} rounded-lg flex items-center justify-center`}>
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  
                  <h4 className={`font-bold text-lg ${colors.textColor} mb-2`}>
                    {company.fullName}
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-300">
                      <span className="text-gray-600 font-medium">Kode ID:</span>
                      <span className={`font-bold ${colors.textColor}`}>{company.id}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-300">
                      <span className="text-gray-600 font-medium">Tipe:</span>
                      <span className={`font-semibold ${colors.textColor}`}>{company.tipe}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-300">
                      <span className="text-gray-600 font-medium">Warna:</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-6 h-6 ${colors.darkColor} rounded border-2 border-white shadow-sm`}></div>
                        <span className="text-xs text-gray-500 capitalize">{colors.color}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center">
              <span className="w-1 h-5 bg-primary-600 rounded mr-2"></span>
              Panduan Penggunaan
            </h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">1</span>
                <span>Setiap transaksi akan menampilkan <strong>Kode ID</strong> perusahaan di sebelah nama perusahaan</span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">2</span>
                <span>Badge perusahaan akan menggunakan <strong>warna khas</strong> masing-masing untuk memudahkan identifikasi visual</span>
              </li>
              <li className="flex items-start">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">3</span>
                <span>Gunakan kode ID atau nama lengkap saat membuat transaksi baru</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Mengerti, Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyInfoModal;

